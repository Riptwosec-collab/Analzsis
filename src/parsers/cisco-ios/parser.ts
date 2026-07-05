import type {
  ArpRecord,
  CommandBlock,
  DhcpBindingRecord,
  DhcpPoolRecord,
  InterfaceRecord,
  LogRecord,
  MacRecord,
  ParsedDataset,
  TopologyLink,
  VlanRecord
} from "@/types/network";
import { makeEvidence } from "@/parsers/detector/command-detector";
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
    logs: [],
    topology: []
  };
}

export function parseBlock(block: CommandBlock, dataset: ParsedDataset): CommandBlock {
  switch (block.command) {
    case "show ip arp":
    case "show arp":
      dataset.arp.push(...parseArp(block));
      return { ...block, parsed: true };
    case "show mac address-table":
      dataset.macTable.push(...parseMacTable(block));
      return { ...block, parsed: true };
    case "show ip dhcp binding":
      dataset.dhcpBindings.push(...parseDhcpBindings(block));
      return { ...block, parsed: true };
    case "show ip dhcp pool":
      dataset.dhcpPools.push(...parseDhcpPool(block));
      return { ...block, parsed: true };
    case "show running-config":
      parseRunningConfig(block, dataset);
      return { ...block, parsed: true };
    case "show ip interface brief":
      dataset.interfaces.push(...parseIpInterfaceBrief(block));
      return { ...block, parsed: true };
    case "show interfaces status":
      dataset.interfaces.push(...parseInterfaceStatus(block));
      return { ...block, parsed: true };
    case "show vlan brief":
      dataset.vlans.push(...parseVlanBrief(block));
      return { ...block, parsed: true };
    case "show logging":
      dataset.logs.push(...parseLogs(block));
      return { ...block, parsed: true };
    case "show cdp neighbors detail":
    case "show lldp neighbors detail":
      dataset.topology.push(...parseTopology(block));
      return { ...block, parsed: true };
    default:
      return { ...block, parsed: false, warning: `Unsupported command: ${block.rawCommand}` };
  }
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
    if (/^(Vlan|Mac Address|----|Total|Legend)/i.test(text)) return [];
    const match = text.match(/^(\d{1,4}|All)\s+([0-9a-f.:-]{12,17})\s+(\S+)\s+(\S+)/i)
      ?? text.match(/^([0-9a-f.:-]{12,17})\s+(\d{1,4})\s+(\S+)\s+(\S+)/i);
    if (!match) return [];
    const vlan = /^\d+$/.test(match[1]) ? Number(match[1]) : /^\d+$/.test(match[2]) ? Number(match[2]) : undefined;
    const mac = normalizeMac(match[2]) ?? normalizeMac(match[1]);
    const typeText = (match[3] ?? "").toUpperCase();
    const port = normalizeInterface(match[4]);
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
    const mac = normalizeMac(parts[1]);
    const state = parts.find(part => /Active|Expired|Selecting|Manual|Automatic/i.test(part));
    const iface = normalizeInterface(parts.find(part => /^(Vlan|Gi|Fa|Te|Eth|Po|Twe|Hu)/i.test(part)));
    return [{
      ip,
      mac,
      state,
      lease: parts.slice(2, 7).join(" "),
      type: /Manual|Reservation/i.test(text) ? "Reservation" : "Dynamic",
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
    const poolMatch = text.match(/^(?:Pool\s+)?([A-Za-z0-9_.:-]+)\s*:?\s*$/i);
    const configPool = text.match(/^ip dhcp pool\s+(.+)$/i);
    if (configPool || (poolMatch && /pool/i.test(block.rawCommand))) {
      if (current) pools.push(current);
      current = {
        name: configPool?.[1]?.trim() ?? poolMatch?.[1] ?? "pool",
        defaultRouters: [],
        dnsServers: [],
        evidence: [makeEvidence(block, line)]
      };
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

function parseRunningConfig(block: CommandBlock, dataset: ParsedDataset) {
  let currentPool: DhcpPoolRecord | null = null;
  let currentInterface: InterfaceRecord | null = null;
  for (const line of block.lines) {
    const raw = line.text;
    const text = raw.trim();
    const pool = text.match(/^ip dhcp pool\s+(.+)$/i);
    if (pool) {
      if (currentPool) dataset.dhcpPools.push(currentPool);
      currentPool = { name: pool[1], defaultRouters: [], dnsServers: [], evidence: [makeEvidence(block, line)] };
      currentInterface = null;
      continue;
    }
    const iface = text.match(/^interface\s+(.+)$/i);
    if (iface) {
      if (currentInterface) dataset.interfaces.push(currentInterface);
      currentInterface = { name: normalizeInterface(iface[1]) ?? iface[1], mode: "unknown", evidence: [makeEvidence(block, line)] };
      currentPool = null;
      continue;
    }
    if (currentPool) {
      const network = text.match(/^network\s+(\d+\.\d+\.\d+\.\d+)\s+(\d+\.\d+\.\d+\.\d+|\/\d+)/i);
      if (network) {
        currentPool.network = network[1];
        currentPool.prefix = network[2].startsWith("/") ? Number(network[2].slice(1)) : maskToPrefix(network[2]) ?? undefined;
        currentPool.evidence.push(makeEvidence(block, line));
      }
      const host = text.match(/^host\s+(\d+\.\d+\.\d+\.\d+)\s+(\d+\.\d+\.\d+\.\d+|\/\d+)/i);
      if (host) {
        currentPool.network = host[1];
        currentPool.prefix = host[2].startsWith("/") ? Number(host[2].slice(1)) : maskToPrefix(host[2]) ?? undefined;
      }
      if (/^default-router/i.test(text)) currentPool.defaultRouters.push(...text.split(/\s+/).slice(1));
      if (/^dns-server/i.test(text)) currentPool.dnsServers.push(...text.split(/\s+/).slice(1));
    }
    if (currentInterface) {
      const ip = text.match(/^ip address\s+(\d+\.\d+\.\d+\.\d+)\s+(\d+\.\d+\.\d+\.\d+)(?:\s+secondary)?/i);
      if (ip) {
        currentInterface.ip = ip[1];
        currentInterface.prefix = maskToPrefix(ip[2]) ?? undefined;
        currentInterface.mode = "routed";
        currentInterface.evidence.push(makeEvidence(block, line));
      }
      const access = text.match(/^switchport access vlan\s+(\d+)/i);
      if (access) {
        currentInterface.vlan = Number(access[1]);
        currentInterface.mode = "access";
      }
      if (/^switchport mode trunk/i.test(text)) currentInterface.mode = "trunk";
      if (/shutdown/i.test(text)) currentInterface.status = "disabled";
    }
    if (/errdisable|violation|deny|quarantine|DHCP_SNOOPING_DENY|SW_DAI/i.test(text)) {
      dataset.logs.push(logFromLine(block, line));
    }
  }
  if (currentPool) dataset.dhcpPools.push(currentPool);
  if (currentInterface) dataset.interfaces.push(currentInterface);
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
    const parts = text.split(/\s{2,}|\t+/).flatMap(part => part.split(/\s+/));
    if (!parts[0] || !/^(Gi|Fa|Te|Eth|Po|Twe|Hu)/i.test(parts[0])) return [];
    return [{
      name: normalizeInterface(parts[0]) ?? parts[0],
      status: parts.find(part => /connected|notconnect|disabled|err-disabled/i.test(part)),
      vlan: parts.find(part => /^\d+$|trunk|routed/i.test(part)),
      mode: parts.some(part => /trunk/i.test(part)) ? "trunk" : "access",
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
      status: match[3],
      ports: match[4]?.split(/,\s*|\s+/).filter(Boolean).map(port => normalizeInterface(port) ?? port) ?? [],
      evidence: [makeEvidence(block, line)]
    }];
  });
}

function parseLogs(block: CommandBlock): LogRecord[] {
  return block.lines.filter(line => /%[A-Z0-9_]+-\d-|errdisable|deny|violation|flap|quarantine/i.test(line.text))
    .map(line => logFromLine(block, line));
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
      evidence
    }];
  });
}
