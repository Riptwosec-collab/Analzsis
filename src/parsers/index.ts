import type { AnalysisResult, DeviceRecord, Finding, ParsedDataset } from "@/types/network";
import { correlate } from "@/correlation/ip-correlation";
import { detectCommandBlocks } from "@/parsers/detector/command-detector";
import { emptyDataset, parseBlock } from "@/parsers/cisco-ios/parser";

export function parseCli(input: string): ParsedDataset {
  const lineCount = input ? input.replace(/\r\n/g, "\n").split("\n").length : 0;
  const dataset = emptyDataset(lineCount);
  const blocks = detectCommandBlocks(input);
  const parsedBlocks = blocks.map(block => parseBlock(block, dataset));

  dataset.commandBlocks = parsedBlocks;
  dataset.devices = collectDevices(parsedBlocks);
  dataset.parserWarnings = parsedBlocks.filter(block => !block.parsed).map((block, index): Finding => ({
    id: `parser-${index}`,
    severity: "Low",
    category: "Parser",
    title: "Unsupported command",
    target: block.rawCommand,
    description: `No parser is available yet for "${block.rawCommand}". The block is kept as evidence but is not used for correlation.`,
    confidence: 100,
    evidence: block.lines.slice(0, 3),
    recommendation: "Add a parser module or paste a supported command for this device.",
    verificationCommands: ["show ip arp", "show mac address-table", "show ip dhcp binding"]
  }));

  return dataset;
}

export function analyzeCli(input: string): AnalysisResult {
  const dataset = parseCli(input);
  return correlate(dataset);
}

function collectDevices(blocks: ParsedDataset["commandBlocks"]): DeviceRecord[] {
  const map = new Map<string, DeviceRecord>();
  for (const block of blocks) {
    const existing = map.get(block.device) ?? { hostname: block.device, vendor: block.vendor, commands: [] };
    if (!existing.commands.includes(block.command)) existing.commands.push(block.command);
    if (existing.vendor === "generic" && block.vendor !== "generic") existing.vendor = block.vendor;
    map.set(block.device, existing);
  }
  return [...map.values()];
}
