import type {
  AccessListRecord,
  ArpRecord,
  CommandBlock,
  DhcpBindingRecord,
  DhcpPoolRecord,
  InterfaceRecord,
  LogRecord,
  MacRecord,
  ParsedDataset,
  TopologyLink,
  VlanRecord,
  VrfRecord
} from "@/types/network";
import { makeEvidence } from "@/parsers/detector/command-detector";
import { parseEnhancedRunningConfig } from "@/parsers/cisco-ios/running-config-parser";
import { maskToPrefix } from "@/utils/ip";
import { normalizeInterface } from "@/utils/interface";
import { normalizeMac } from "@/utils/mac";
import { parseVlanId } from "@/utils/vlan";

export function emptyDataset(lineCount: number): ParsedDataset {
  return {
    sourceLineCount: lineCount,
    devices: [],
    commandBlocks: [],
    parserWarnings: [],
    arp: [],
    macTable: [],
    dhcpBindings: [],
    dhcpPools: [],
    interfaces: [],
    vlans: [],
    vrfs: [],
    staticRoutes: [],
    accessLists: [],
    configFeatures: [],
    parserCoverage: {
      totalMeaningfulLines: 0,
      recognizedLines: 0,
      ignoredLines: 0,
      unrecognizedLines: 0,
      coveragePercent: 0
    },
    logs: [],
    topology: []
  };
}

export function parseBlock(block: CommandBlock, dataset: ParsedDataset): CommandBlock {
  switch (block.command) {
    case "show ip arp":
    case "show arp":
      dataset.arp.push(...parseArp(block));
      return parsed(block, "cisco-ios", ["show mac address-table", "show ip dhcp binding"]);
    case "show mac address-table":
      dataset.macTable.push(...parseMacTable(block));
      return parsed(block, "cisco-ios", ["show ip arp", "show interfaces status"]);
    case "show ip dhcp binding":
    case "show ip dhcp snooping binding":
    case "show ip source binding":
      dataset.dhcpBindings.push(...parseDhcpBindings(block));
      return parsed(block, "cisco-ios", ["show ip arp", "show mac address-table"]);
    case "show ip dhcp pool":
      dataset.dhcpPools.push(...parseDhcpPool(block));
      return parsed(block, "cisco-ios", ["show running-config | section ip dhcp"]);
    case "show running-config":
      parseEnhancedRunningConfig(block, dataset);
      return parsed(block, "cisco-ios-enhanced", ["show ip dhcp pool", "show interfaces status", "show vlan brief"]);
    case "show ip interface brief":
      dataset.interfaces.push(...parseIpInterfaceBrief(block));
      return parsed(block, "cisco-ios", ["show running-config interface", "show interfaces status"]);
    case "show interfaces status":
      dataset.interfaces.push(...parseInterfaceStatus(block));
      return parsed(block, "cisco-ios", ["show interfaces switchport", "show mac address-table"]);
    case "show interfaces description":
      dataset.interfaces.push(...parseInterfaceDescription(block));
      return parsed(block);
    case "show interfaces switchport":
      dataset.interfaces.push(...parseSwitchport(block));
      return parsed(block);
    case "show interfaces trunk":
      dataset.interfaces.push(...parseTrunk(block));
      return parsed(block);
    case "show vlan brief":
      dataset.vlans.push(...parseVlanBrief(block));
      return parsed(block);
    case "show logging":
      dataset.logs.push(...parseLogs(block));
      return parsed(block);
    case "show cdp neighbors detail":
    case "show lldp neighbors detail":
      dataset.topology.push(...parseTopology(block));
      return parsed(block);
    case "show version":
      parseVersion(block, dataset);
      return parsed(block);
    case "show inventory":
      parseInventory(block, dataset);
      return parsed(block);
    case "show ip route":
      parseIpRoute(block, dataset);
      return parsed(block);
    case "show vrf":
      dataset.vrfs.push(...parseShowVrf(block));
      return parsed(block);
    case "show access-lists":
    case "show ip access-lists":
      dataset.accessLists.push(...parseAccessLists(block));
      return parsed(block);
    case "show ip dhcp conflict":
    case "show ip dhcp snooping":
    case "show ip arp inspection":
    case "show interfaces counters errors":
    case "show interfaces":
    case "show spanning-tree":
    case "show spanning-tree detail":
    case "show spanning-tree inconsistentports":
    case "show etherchannel summary":
    case "show port-security":
    case "show port-security interface":
    case "show authentication sessions":
    case "show dot1x all":
    case "show standby brief":
    case "show vrrp brief":
    case "show environment":
    case "show processes cpu":
    case "show memory statistics":
    case "show errdisable recovery":
      parseOperationalEvidence(block, dataset);
      return parsed(block, "cisco-ios-operational");
    default:
      return withParseMetadata(block, block.lines.length ? "unsupported" : "empty", 0, recommendedForUnsupported(block.rawCommand), [
        "No structured parser is available yet; raw lines are kept as operational evidence."
      ]);
  }
}

function parsed(block: CommandBlock, parser = "cisco-ios", recommendedFollowUpCommands: string[] = []): CommandBlock {
  const meaningfulLines = block.lines.filter(line => line.text.trim() && !/^[-!]+$/.test(line.text.trim())).length;
  return withParseMetadata(block, block.lines.length ? "parsed" : "empty", meaningfulLines, recommendedFollowUpCommands, [], parser);
}

function withParseMetadata(
  block: CommandBlock,
  parseStatus: NonNullable<CommandBlock["parseStatus"]>,
  recognizedLines: number,
  recommendedFollowUpCommands: string[],
  missingEvidence: string[] = [],
  parser = block.parser
): CommandBlock {
  const totalLines = block.lines.length;
  const coveragePercent = totalLines ? Math.round((recognizedLines / totalLines) * 100) : 0;
  return {
    ...block,
    parsed: parseStatus === "parsed" || parseStatus === "partially-parsed",
    parseStatus,
    parser,
    parserVersion: block.parserVersion ?? `${parser}@1`,
    totalLines,
    recognizedLines,
    unrecognizedLines: Math.max(0, totalLines - recognizedLines),
    coveragePercent,
    missingEvidence,
    recommendedFollowUpCommands,
    warning: parseStatus === "unsupported" ? `Unsupported command: ${block.rawCommand}` : block.warning
  };
}

function recommendedForUnsupported(rawCommand: string): string[] {
  if (/dhcp/i.test(rawCommand)) return ["show ip dhcp binding", "show ip dhcp pool", "show running-config | section ip dhcp"];
  if (/mac/i.test(rawCommand)) return ["show mac address-table", "show ip arp"];
  if (/interface|port|trunk|switchport/i.test(rawCommand)) return ["show interfaces status", "show interfaces switchport", "show running-config interface"];
  if (/spanning|stp/i.test(rawCommand)) return ["show spanning-tree detail", "show spanning-tree inconsistentports"];
  if (/security|auth|dot1x|access/i.test(rawCommand)) return ["show authentication sessions", "show access-lists", "show running-config"];
  return ["show running-config", "show logging", "show version"];
}

function parseArp(block: CommandBlock): ArpRecord[] {
  return block.lines.flatMap(line => {
    const text = line.text.trim();
    const match = text.match(/(?:Internet\s+)?(\d+\.\d+\.\d+\.\d+)\s+\S+\s+([0-9a-f.:-]+|Incomplete)\s+(?:ARPA|ether|dynamic|static)?\s*(\S+)?/i);
    if (!match || /^Protocol|Address/i.test(text)) return [];
    const mac = /incomplete/i.test(match[2]) ? null : normalizeMac(match[2]);
    const iface = normalizeInterface(match[3]);
    return [{
      ip: match[1],
      mac,
      vlan: parseVlanId(iface),
      interfaceName: iface,
      type: /static/i.test(text) ? "static" : "dynamic",
      evidence: [makeEvidence(block, line)]
    }];
  });
}

function parseMacTable(block: CommandBlock): MacRecord[] {
  return block.lines.flatMap(line => {
    const text = line.text.trim();
    if (/^(Vlan|Mac Address|----|Total|Legend|Unicast Entries|Multicast Entries)/i.test(text)) return [];
    const match = text.match(/^(\d{1,4}|All)\s+([0-9a-f.:-]{12,17})\s+(\S+)\s+(.+)$/i)
      ?? text.match(/^([0-9a-f.:-]{12,17})\s+(\d{1,4})\s+(\S+)\s+(.+)$/i);
    if (!match) return [];
    const vlan = /^\d+$/.test(match[1]) ? Number(match[1]) : /^\d+$/.test(match[2]) ? Number(match[2]) : undefined;
    const mac = normalizeMac(match[2]) ?? normalizeMac(match[1]);
    const typeText = (match[3] ?? "").toUpperCase();
    const portText = match[4].trim().split(/[\s,]+/).at(-1);
    const port = normalizeInterface(portText);
    if (!mac || !port) return [];
    return [{
      mac,
      vlan,
      port,
      type: typeText.includes("STATIC") ? "STATIC" : typeText.includes("SECURE") ? "SECURE" : typeText.includes("DYNAMIC") ? "DYNAMIC" : "UNKNOWN",
      evidence: [makeEvidence(block, line)]
    }];
  });
}

function parseDhcpBindings(block: CommandBlock): DhcpBindingRecord[] {
  return block.lines.flatMap(line => {
    const text = line.text.trim();
    if (!/^\d+\.\d+\.\d+\.\d+/.test(text) || /^IP address/i.test(text)) return [];
    const parts = text.split(/\s+/);
    const ip = parts[0];
    const identifier = parts[1];
    const mac = normalizeMac(identifier);
    const state = parts.find(part => /Active|Expired|Selecting|Manual|Automatic|Infinite/i.test(part));
    const iface = normalizeInterface(parts.find(part => /^(Vlan|Gi|Fa|Te|Eth|Po|Twe|Hu|Lo|Tu)/i.test(part)));
    return [{
      ip,
      mac,
      clientIdentifier: identifier,
      state,
      lease: parts.slice(2, 7).join(" "),
      type: /Manual|Reservation|Infinite/i.test(text) ? "Reservation" : "Dynamic",
      interfaceName: iface,
      evidence: [makeEvidence(block, line)]
    }];
  });
}

function parseDhcpPool(block: CommandBlock): DhcpPoolRecord[] {
  const pools: DhcpPoolRecord[] = [];
  let current: DhcpPoolRecord | null = null;
  for (const line of block.lines) {
    const text = line.text.trim();
    const poolMatch = text.match(/^(?:Pool\s+)?([^:]+)\s*:\s*$/i);
    if (poolMatch) {
      if (current) pools.push(current);
      current = { name: poolMatch[1].trim(), defaultRouters: [], dnsServers: [], evidence: [makeEvidence(block, line)] };
      continue;
    }
    if (!current) continue;
    const network = text.match(/(?:network|Network)\s+(\d+\.\d+\.\d+\.\d+)\s+(?:\/(\d+)|(\d+\.\d+\.\d+\.\d+))/i);
    if (network) {
      current.network = network[1];
      current.prefix = network[2] ? Number(network[2]) : network[3] ? maskToPrefix(network[3]) ?? undefined : undefined;
      current.evidence.push(makeEvidence(block, line));
    }
    const leased = text.match(/(?:Leased addresses|leased)\s*[:=]?\s*(\d+)/i);
    const total = text.match(/(?:Total addresses|total)\s*[:=]?\s*(\d+)/i);
    if (leased) current.leased = Number(leased[1]);
    if (total) current.total = Number(total[1]);
    if (current.leased !== undefined && current.total) current.utilization = Math.round((current.leased / current.total) * 100);
  }
  if (current) pools.push(current);
  return pools;
}

function parseIpInterfaceBrief(block: CommandBlock): InterfaceRecord[] {
  return block.lines.flatMap(line => {
    const text = line.text.trim();
    if (/^Interface\s+IP-Address/i.test(text)) return [];
    const parts = text.split(/\s+/);
    if (parts.length < 6 || !/^(Vlan|Gi|Fa|Te|Eth|Lo|Po|Tu|Twe|Hu)/i.test(parts[0])) return [];
    return [{
      name: normalizeInterface(parts[0]) ?? parts[0],
      ip: parts[1] === "unassigned" ? undefined : parts[1],
      status: parts[4],
      protocol: parts[5],
      vlan: parseVlanId(parts[0]),
      mode: parts[1] === "unassigned" ? "unknown" : "routed",
      evidence: [makeEvidence(block, line)]
    }];
  });
}

function parseInterfaceStatus(block: CommandBlock): InterfaceRecord[] {
  return block.lines.flatMap(line => {
    const text = line.text.trim();
    if (/^Port\s+Name|^Port\s+Status/i.test(text)) return [];
    const match = text.match(/^(\S+)\s+(.{0,18}?)\s{2,}(connected|notconnect|disabled|err-disabled|inactive|monitoring)\s+(\S+)\s+(\S+)\s+(\S+)\s+(.+)$/i);
    if (!match || !/^(Gi|Fa|Te|Eth|Po|Twe|Hu)/i.test(match[1])) return [];
    const vlanText = match[4];
    return [{
      name: normalizeInterface(match[1]) ?? match[1],
      description: match[2].trim() || undefined,
      descriptionSource: match[2].trim() ? "CLI" : "Unknown",
      descriptionConfidence: match[2].trim() ? 100 : 0,
      status: match[3],
      vlan: /^\d+$/.test(vlanText) ? Number(vlanText) : vlanText,
      mode: /trunk/i.test(vlanText) ? "trunk" : /routed/i.test(vlanText) ? "routed" : "access",
      duplex: match[5],
      speed: match[6],
      evidence: [makeEvidence(block, line)]
    }];
  });
}

function parseInterfaceDescription(block: CommandBlock): InterfaceRecord[] {
  return block.lines.flatMap(line => {
    const text = line.text.trim();
    if (/^Interface\s+Status/i.test(text)) return [];
    const match = text.match(/^(\S+)\s+(up|down|admin down|administratively down)\s+(up|down)\s*(.*)$/i);
    if (!match) return [];
    return [{
      name: normalizeInterface(match[1]) ?? match[1],
      status: match[2],
      protocol: match[3],
      description: match[4].trim() || undefined,
      descriptionSource: match[4].trim() ? "CLI" : "Unknown",
      descriptionConfidence: match[4].trim() ? 100 : 0,
      evidence: [makeEvidence(block, line)]
    }];
  });
}

function parseSwitchport(block: CommandBlock): InterfaceRecord[] {
  const records: InterfaceRecord[] = [];
  let current: InterfaceRecord | null = null;
  for (const line of block.lines) {
    const text = line.text.trim();
    const name = text.match(/^Name:\s*(.+)$/i);
    if (name) {
      if (current) records.push(current);
      current = { name: normalizeInterface(name[1]) ?? name[1], mode: "unknown", evidence: [makeEvidence(block, line)] };
      continue;
    }
    if (!current) continue;
    const access = text.match(/^Access Mode VLAN:\s*(\d+)/i);
    const voice = text.match(/^Voice VLAN:\s*(\d+)/i);
    const native = text.match(/^Trunking Native Mode VLAN:\s*(\d+)/i);
    const mode = text.match(/^Administrative Mode:\s*(.+)$/i);
    if (access) { current.accessVlan = Number(access[1]); current.vlan = Number(access[1]); }
    if (voice) current.voiceVlan = Number(voice[1]);
    if (native) current.nativeVlan = Number(native[1]);
    if (mode) current.mode = /trunk/i.test(mode[1]) ? "trunk" : /static access|access/i.test(mode[1]) ? "access" : /routed/i.test(mode[1]) ? "routed" : "unknown";
    current.evidence.push(makeEvidence(block, line));
  }
  if (current) records.push(current);
  return records;
}

function parseTrunk(block: CommandBlock): InterfaceRecord[] {
  return block.lines.flatMap(line => {
    const text = line.text.trim();
    if (/^(Port\s+Mode|Port\s+Vlans|----)/i.test(text)) return [];
    const match = text.match(/^(\S+)\s+(on|off|desirable|auto)\s+(\S+)\s+(trunking|not-trunking)\s+(\d+)/i);
    if (!match) return [];
    return [{
      name: normalizeInterface(match[1]) ?? match[1],
      mode: "trunk",
      status: match[4],
      nativeVlan: Number(match[5]),
      evidence: [makeEvidence(block, line)]
    }];
  });
}

function parseVlanBrief(block: CommandBlock): VlanRecord[] {
  return block.lines.flatMap(line => {
    const text = line.text.trim();
    if (/^VLAN\s+Name|^-/.test(text)) return [];
    const match = text.match(/^(\d{1,4})\s+(\S+)\s+(\S+)\s*(.*)$/);
    if (!match) return [];
    return [{
      id: Number(match[1]),
      name: match[2],
      description: match[2],
      descriptionSource: "CLI",
      descriptionConfidence: 100,
      status: match[3],
      ports: match[4]?.split(/,\s*|\s+/).filter(Boolean).map(port => normalizeInterface(port) ?? port) ?? [],
      evidence: [makeEvidence(block, line)]
    }];
  });
}

function parseLogs(block: CommandBlock): LogRecord[] {
  return block.lines.filter(line => /%[A-Z0-9_]+-\d-|errdisable|deny|violation|flap/i.test(line.text)).map(line => logFromLine(block, line));
}

function logFromLine(block: CommandBlock, line: { text: string; line: number }): LogRecord {
  const text = line.text;
  const mac = normalizeMac(text.match(/([0-9a-f]{4}\.[0-9a-f]{4}\.[0-9a-f]{4}|[0-9a-f:-]{17})/i)?.[1]);
  const ip = text.match(/\b(\d+\.\d+\.\d+\.\d+)\b/)?.[1];
  const vlan = parseVlanId(text.match(/\bvlan\s+(\d+)/i)?.[1]);
  const iface = normalizeInterface(text.match(/\b(Gi|Fa|Te|Eth|Po|Twe|Hu)\S+/i)?.[0]);
  const type = /flap/i.test(text) ? "MAC_FLAPPING" : /deny|DAI|DHCP_SNOOPING/i.test(text) ? "DENY_BLOCK" : /err-?disabled/i.test(text) ? "ERR_DISABLED" : /violation|PSECURE/i.test(text) ? "PORT_SECURITY" : "LOG_EVENT";
  return {
    severity: type === "MAC_FLAPPING" || type === "DENY_BLOCK" ? "High" : "Medium",
    type,
    message: text.trim(),
    ip,
    mac: mac ?? undefined,
    vlan,
    interfaceName: iface,
    evidence: [makeEvidence(block, { ...line, device: block.device, command: block.command })]
  };
}

function parseTopology(block: CommandBlock): TopologyLink[] {
  const chunks = block.lines.map(line => line.text).join("\n").split(/\n-{3,}|\nDevice ID:|\nSystem Name:/i);
  return chunks.flatMap((chunk, index) => {
    const remote = chunk.match(/^\s*([A-Za-z0-9_.-]+)/)?.[1] ?? chunk.match(/Device ID:\s*(\S+)/i)?.[1] ?? chunk.match(/System Name:\s*(\S+)/i)?.[1];
    const localInterface = normalizeInterface(chunk.match(/Interface:\s*([^,\n]+)/i)?.[1] ?? chunk.match(/Local Intf:\s*(\S+)/i)?.[1]);
    const remoteInterface = normalizeInterface(chunk.match(/Port ID \(outgoing port\):\s*(.+)/i)?.[1] ?? chunk.match(/Port id:\s*(.+)/i)?.[1]);
    if (!remote || remote === block.device) return [];
    const evidence = block.lines.slice(Math.max(0, index - 1), Math.min(block.lines.length, index + 3)).map(line => makeEvidence(block, line));
    return [{
      localDevice: block.device,
      localInterface,
      remoteDevice: remote,
      remoteInterface,
      protocol: block.command.includes("lldp") ? "LLDP" : "CDP",
      description: remoteInterface ? `${remote} via ${remoteInterface}` : remote,
      descriptionSource: "Related",
      descriptionConfidence: 85,
      evidence
    }];
  });
}

function parseVersion(block: CommandBlock, dataset: ParsedDataset): void {
  const text = block.lines.map(line => line.text).join("\n");
  const version = text.match(/Cisco IOS(?: XE)? Software.*?Version\s+([^,\s]+)/i)?.[1] ?? text.match(/^Version\s+(.+)$/im)?.[1];
  const model = text.match(/cisco\s+(\S+)\s+\(.+?processor/i)?.[1];
  const serial = text.match(/Processor board ID\s+(\S+)/i)?.[1];
  dataset.devices.push({ hostname: block.device, vendor: "cisco", os: /IOS XE/i.test(text) ? "Cisco IOS XE" : "Cisco IOS", version, model, serialNumber: serial, commands: ["show version"], description: [model, version].filter(Boolean).join(" · ") || undefined, descriptionSource: "CLI", descriptionConfidence: 95 });
}

function parseInventory(block: CommandBlock, dataset: ParsedDataset): void {
  const text = block.lines.map(line => line.text).join("\n");
  const model = text.match(/PID:\s*([^,\s]+)/i)?.[1];
  const serial = text.match(/SN:\s*([^,\s]+)/i)?.[1];
  dataset.devices.push({ hostname: block.device, vendor: "cisco", model, serialNumber: serial, commands: ["show inventory"], description: [model, serial].filter(Boolean).join(" · ") || undefined, descriptionSource: "CLI", descriptionConfidence: 95 });
}

function parseIpRoute(block: CommandBlock, dataset: ParsedDataset): void {
  for (const line of block.lines) {
    const text = line.text.trim();
    const match = text.match(/^[SLCORBDEi*+ ]+\s+(\d+\.\d+\.\d+\.\d+)\/(\d+)\s+(?:\[[^\]]+\]\s+)?via\s+(\d+\.\d+\.\d+\.\d+)(?:,\s*([^,\s]+))?/i);
    if (!match) continue;
    dataset.staticRoutes.push({ destination: match[1], prefix: Number(match[2]), nextHop: match[3], outgoingInterface: normalizeInterface(match[4]), evidence: [makeEvidence(block, line)], description: `Route to ${match[1]}/${match[2]}`, descriptionSource: "Generated", descriptionConfidence: 90 });
  }
}

function parseShowVrf(block: CommandBlock): VrfRecord[] {
  return block.lines.flatMap(line => {
    const text = line.text.trim();
    if (/^(Name|VRF-Name|----)/i.test(text)) return [];
    const match = text.match(/^(\S+)\s+(?:\d+|<not set>)\s+(.+)$/);
    if (!match) return [];
    const interfaces = match[2].split(/\s+/).filter(item => /^(Gi|Fa|Te|Eth|Lo|Po|Tu|Vlan)/i.test(item)).map(item => normalizeInterface(item) ?? item);
    return [{ name: match[1], addressFamilies: [], interfaces, evidence: [makeEvidence(block, line)] }];
  });
}

function parseAccessLists(block: CommandBlock): AccessListRecord[] {
  const records: AccessListRecord[] = [];
  let name = "unnamed";
  let type: AccessListRecord["aclType"] = "unknown";
  for (const line of block.lines) {
    const text = line.text.trim();
    const header = text.match(/^(Standard|Extended) IP access list\s+(.+)$/i);
    if (header) {
      type = header[1].toLowerCase() === "standard" ? "standard" : "extended";
      name = header[2].trim();
      continue;
    }
    const rule = text.match(/^(?:(\d+)\s+)?(permit|deny|remark)\s+(.+)$/i);
    if (!rule) continue;
    records.push({ name, family: "ipv4", aclType: type, sequence: rule[1] ? Number(rule[1]) : undefined, action: rule[2].toLowerCase() as "permit" | "deny" | "remark", expression: rule[3].trim(), evidence: [makeEvidence(block, line)], description: rule[2].toLowerCase() === "remark" ? rule[3].trim() : undefined, descriptionSource: rule[2].toLowerCase() === "remark" ? "CLI" : "Unknown", descriptionConfidence: rule[2].toLowerCase() === "remark" ? 100 : 0 });
  }
  return records;
}

function parseOperationalEvidence(block: CommandBlock, dataset: ParsedDataset): void {
  const meaningful = block.lines.filter(line => line.text.trim() && !/^[-=]+$/.test(line.text.trim()));
  dataset.configFeatures.push({
    category: operationalCategory(block.command),
    feature: block.command,
    value: `${meaningful.length} output lines`,
    scope: block.device,
    status: "Configured",
    description: `Operational output captured for ${block.command}. Raw evidence is retained for review.`,
    descriptionSource: "Generated",
    descriptionConfidence: 100,
    evidence: meaningful.slice(0, 20).map(line => makeEvidence(block, line))
  });
}

function operationalCategory(command: string): "Security" | "Switching" | "Interface" | "Routing" | "Monitoring" {
  if (/port-security|authentication|dot1x|snooping|inspection|source binding/i.test(command)) return "Security";
  if (/spanning|etherchannel/i.test(command)) return "Switching";
  if (/route|standby|vrrp/i.test(command)) return "Routing";
  if (/environment|cpu|memory/i.test(command)) return "Monitoring";
  return "Interface";
}
