import type { AnalysisResult, DeviceRecord, Finding, ParsedDataset, SecurityCheck } from "@/types/network";
import { correlate } from "@/correlation/ip-correlation";
import { findConfigurationFindings } from "@/correlation/config-findings";
import { detectCommandBlocks } from "@/parsers/detector/command-detector";
import { emptyDataset, parseBlock } from "@/parsers/cisco-ios/parser";

export function parseCli(input: string): ParsedDataset {
  const lineCount = input ? input.replace(/\r\n/g, "\n").split("\n").length : 0;
  const dataset = emptyDataset(lineCount);
  const blocks = detectCommandBlocks(input);
  const parsedBlocks = blocks.map(block => parseBlock(block, dataset));

  dataset.commandBlocks = parsedBlocks;
  dataset.devices = collectDevices(parsedBlocks, dataset.devices);
  const unsupported = parsedBlocks.filter(block => !block.parsed).map((block, index): Finding => ({
    id: `parser-${index}`,
    severity: "Low",
    category: "Parser",
    title: "Unsupported command",
    target: block.rawCommand,
    description: `No parser is available yet for "${block.rawCommand}". The block is kept as evidence but is not used for correlation.`,
    confidence: 100,
    evidence: block.lines.slice(0, 3),
    recommendation: "Use a supported command or add a vendor-specific parser fixture for this exact output format.",
    verificationCommands: ["show ip arp", "show mac address-table", "show ip dhcp binding", "show running-config"]
  }));
  dataset.parserWarnings = [...unsupported, ...findConfigurationFindings(dataset)];

  return dataset;
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
