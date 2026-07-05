export type Vendor = "cisco" | "aruba" | "fortigate" | "juniper" | "mikrotik" | "generic";

export type Severity = "Critical" | "High" | "Medium" | "Low" | "Info" | "Passed";

export type CommandType =
  | "show ip arp"
  | "show arp"
  | "show mac address-table"
  | "show ip dhcp binding"
  | "show ip dhcp pool"
  | "show vlan brief"
  | "show interfaces status"
  | "show interfaces switchport"
  | "show interfaces trunk"
  | "show ip interface brief"
  | "show running-config"
  | "show logging"
  | "show cdp neighbors detail"
  | "show lldp neighbors detail"
  | "unknown";

export interface Evidence {
  device: string;
  command: CommandType | string;
  line: number;
  text: string;
}

export interface CommandBlock {
  id: string;
  device: string;
  vendor: Vendor;
  command: CommandType;
  rawCommand: string;
  startLine: number;
  lines: Evidence[];
  parsed: boolean;
  parser: string;
  warning?: string;
}

export interface DeviceRecord {
  hostname: string;
  vendor: Vendor;
  os?: string;
  commands: CommandType[];
}

export interface ArpRecord {
  ip: string;
  mac: string | null;
  vlan?: number;
  interfaceName?: string;
  type?: string;
  evidence: Evidence[];
}

export interface MacRecord {
  mac: string;
  vlan?: number;
  port: string;
  type: "DYNAMIC" | "STATIC" | "SECURE" | "UNKNOWN";
  evidence: Evidence[];
}

export interface DhcpBindingRecord {
  ip: string;
  mac: string | null;
  state?: string;
  lease?: string;
  type?: string;
  interfaceName?: string;
  evidence: Evidence[];
}

export interface DhcpPoolRecord {
  name: string;
  network?: string;
  prefix?: number;
  leased?: number;
  total?: number;
  utilization?: number;
  defaultRouters: string[];
  dnsServers: string[];
  evidence: Evidence[];
}

export interface InterfaceRecord {
  name: string;
  status?: string;
  protocol?: string;
  vlan?: number | string;
  ip?: string;
  prefix?: number;
  description?: string;
  mode?: "access" | "trunk" | "routed" | "unknown";
  evidence: Evidence[];
}

export interface VlanRecord {
  id: number;
  name?: string;
  status?: string;
  ports: string[];
  evidence: Evidence[];
}

export interface LogRecord {
  severity: Severity;
  type: string;
  message: string;
  ip?: string;
  mac?: string;
  vlan?: number;
  interfaceName?: string;
  evidence: Evidence[];
}

export interface TopologyLink {
  localDevice: string;
  localInterface?: string;
  remoteDevice: string;
  remoteInterface?: string;
  protocol: "CDP" | "LLDP";
  evidence: Evidence[];
}

export interface Finding {
  id: string;
  severity: Severity;
  category: "IP" | "DHCP" | "Switching" | "Security" | "Interface" | "Topology" | "Parser";
  title: string;
  target?: string;
  description: string;
  confidence: number;
  evidence: Evidence[];
  recommendation: string;
  verificationCommands: string[];
}

export interface IpInventoryRecord {
  ip: string;
  status: "Used" | "Likely Free" | "Reserved" | "Unknown";
  confidence: number;
  macs: string[];
  vlans: number[];
  ports: string[];
  sources: string[];
  evidence: Evidence[];
}

export interface SubnetRecord {
  cidr: string;
  network: string;
  prefix: number;
  firstHost: string;
  lastHost: string;
  broadcast: string;
  totalUsable: number;
  used: number;
  free: number;
  utilization: number;
}

export interface SecurityCheck {
  id: string;
  name: string;
  status: "Passed" | "Failed" | "Warning" | "Unknown";
  severity: Severity;
  evidence: Evidence[];
  recommendation: string;
}

export interface ParsedDataset {
  sourceLineCount: number;
  devices: DeviceRecord[];
  commandBlocks: CommandBlock[];
  parserWarnings: Finding[];
  arp: ArpRecord[];
  macTable: MacRecord[];
  dhcpBindings: DhcpBindingRecord[];
  dhcpPools: DhcpPoolRecord[];
  interfaces: InterfaceRecord[];
  vlans: VlanRecord[];
  logs: LogRecord[];
  topology: TopologyLink[];
}

export interface AnalysisResult extends ParsedDataset {
  generatedAt: string;
  ipInventory: IpInventoryRecord[];
  usedIps: IpInventoryRecord[];
  freeIps: IpInventoryRecord[];
  subnets: SubnetRecord[];
  findings: Finding[];
  securityChecks: SecurityCheck[];
  securityScore: number;
  blockedDevices: Finding[];
  recommendedCommands: string[];
  telegramSummary: string;
}
