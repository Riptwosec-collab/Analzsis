import type { AnalysisResult, CommandBlock, DeviceRecord, Finding, ParsedDataset, ParserCoverage, SecurityCheck } from "@/types/network";
import { correlate } from "@/correlation/ip-correlation";
import { findConfigurationFindings } from "@/correlation/config-findings";
import { detectCommandBlocks } from "@/parsers/detector/command-detector";
import { emptyDataset, parseBlock } from "@/parsers/cisco-ios/parser";
import { parsePingSweep } from "@/parsers/generic/ping-sweep-parser";

export function parseCli(input: string): ParsedDataset {
  const lineCount = input ? input.replace(/\r\n/g, "\n").split("\n").length : 0;
  const dataset = emptyDataset(lineCount);
  const blocks = detectCommandBlocks(input);
  const parsedBlocks = blocks.map(block => parseBlock(block, dataset));

  dataset.commandBlocks = parsedBlocks;
  dataset.parserCoverage = summarizeParserCoverage(parsedBlocks);
  dataset.devices = collectDevices(parsedBlocks, dataset.devices);
  const unsupported = parsedBlocks.filter(block => !block.parsed).map((block, index): Finding => ({
    id: `parser-${index}`,
    severity: "Low",
    category: "Parser",
    title: "Unsupported command",
    target: block.rawCommand,
    description: `Parse status: ${block.parseStatus ?? "unsupported"}. Coverage ${block.coveragePercent ?? 0}% (${block.recognizedLines ?? 0}/${block.totalLines ?? block.lines.length} lines). The block is kept as evidence but is not used for structured correlation.`,
    confidence: 100,
    evidence: block.lines.slice(0, 3),
    recommendation: block.missingEvidence?.join(" ") || "Add a parser module or paste a supported command for this device.",
    verificationCommands: block.recommendedFollowUpCommands?.length ? block.recommendedFollowUpCommands : ["show ip arp", "show mac address-table", "show ip dhcp binding"]
  }));
  const partial = parsedBlocks
    .filter(block => block.parseStatus === "partially-parsed" || block.parseStatus === "malformed" || block.parseStatus === "ambiguous-format")
    .map((block, index): Finding => ({
      id: `parser-partial-${index}`,
      severity: "Low",
      category: "Parser",
      title: "Parser coverage incomplete",
      target: block.rawCommand,
      description: `${block.rawCommand} recognized ${block.recognizedLines ?? 0} of ${block.totalLines ?? 0} meaningful lines. Unrecognized lines are retained as raw evidence and are excluded from high-confidence correlation.`,
      confidence: 100,
      evidence: block.lines.filter(line => block.unrecognizedLineNumbers?.includes(line.line)).slice(0, 5),
      recommendation: "Review the unrecognized lines and import the recommended read-only command output to improve evidence coverage.",
      verificationCommands: block.recommendedFollowUpCommands?.length ? block.recommendedFollowUpCommands : ["show running-config", "show interfaces status"]
    }));
  dataset.parserWarnings = [...unsupported, ...partial, ...findConfigurationFindings(dataset)];
  dataset.pingResults = parsePingSweep(input);

  return dataset;
}

function summarizeParserCoverage(blocks: CommandBlock[]): ParserCoverage {
  const totalMeaningfulLines = blocks.reduce((total, block) => total + (block.totalLines ?? 0), 0);
  const recognizedLines = blocks.reduce((total, block) => total + (block.recognizedLines ?? 0), 0);
  const ignoredLines = blocks.reduce((total, block) => total + (block.ignoredLines ?? 0), 0);
  const unrecognizedLines = blocks.reduce((total, block) => total + (block.unrecognizedLines ?? 0), 0);
  const malformedLines = blocks.reduce((total, block) => total + (block.malformedLines ?? 0), 0);
  return {
    totalMeaningfulLines,
    recognizedLines,
    ignoredLines,
    unrecognizedLines,
    malformedLines,
    coveragePercent: totalMeaningfulLines ? Math.round((recognizedLines / totalMeaningfulLines) * 100) : 0
  };
}

export function analyzeCli(input: string): AnalysisResult {
  const dataset = parseCli(input);
  const result = correlate(dataset);
  const applicable = result.securityChecks.filter(check => check.status !== "Not Applicable");
  const supported = applicable.filter(check => check.status !== "Unknown");

  result.securityScore = calculateEvidenceAwareSecurityScore(result.securityChecks);
  result.evidenceCoverage = applicable.length
    ? Math.round((supported.length / applicable.length) * 100)
    : 0;

  return result;
}

function calculateEvidenceAwareSecurityScore(checks: SecurityCheck[]): number {
  const penalty = checks.reduce((total, check) => {
    if (check.status === "Passed" || check.status === "Unknown" || check.status === "Not Applicable") return total;
    const weight = check.severity === "Critical"
      ? 25
      : check.severity === "High"
        ? 18
        : check.severity === "Medium"
          ? 10
          : 4;
    return total + (check.status === "Warning" ? Math.ceil(weight / 2) : weight);
  }, 0);

  return Math.max(0, 100 - penalty);
}

function collectDevices(blocks: ParsedDataset["commandBlocks"], parsedDevices: DeviceRecord[]): DeviceRecord[] {
  const map = new Map<string, DeviceRecord>();

  for (const device of parsedDevices) {
    map.set(device.hostname, { ...device, commands: [...device.commands] });
  }

  for (const block of blocks) {
    const bestParsed = parsedDevices.find(device => device.hostname !== "IMPORTED-CONFIG");
    const existing = map.get(block.device) ?? bestParsed ?? {
      hostname: block.device,
      vendor: block.vendor,
      commands: []
    };
    const hostname = existing.hostname === "IMPORTED-CONFIG" && block.device !== "IMPORTED-CONFIG" ? block.device : existing.hostname;
    const commands = [...existing.commands];
    if (!commands.includes(block.command)) commands.push(block.command);
    map.delete(existing.hostname);
    map.set(hostname, {
      ...existing,
      hostname,
      vendor: existing.vendor === "generic" ? block.vendor : existing.vendor,
      commands
    });
  }

  return [...map.values()];
}
