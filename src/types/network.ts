export type Vendor = "cisco" | "aruba" | "fortigate" | "juniper" | "mikrotik" | "generic";

export type Severity = "Critical" | "High" | "Medium" | "Low" | "Info" | "Passed";
export type CommandParseStatus = "parsed" | "partially-parsed" | "unsupported" | "malformed" | "empty";

export type CommandType =
  | "show ip arp"
  | "show arp"
  | "show mac address-table"
  | "show ip dhcp binding"
  | "show ip dhcp pool"
  | "show ip dhcp conflict"
  | "show ip dhcp snooping"
  | "show ip dhcp snooping binding"
  | "show ip arp inspection"
  | "show ip source binding"
  | "show vlan brief"
  | "show interfaces status"
  | "show interfaces description"
  | "show interfaces switchport"
  | "show interfaces trunk"
  | "show interfaces counters errors"
  | "show interfaces"
  | "show ip interface brief"
  | "show running-config"
  | "show logging"
  | "show spanning-tree"
  | "show spanning-tree detail"
  | "show spanning-tree inconsistentports"
  | "show etherchannel summary"
  | "show port-security"
  | "show port-security interface"
  | "show authentication sessions"
  | "show dot1x all"
  | "show access-lists"
  | "show ip access-lists"
  | "show cdp neighbors detail"
  | "show lldp neighbors detail"
  | "show version"
  | "show inventory"
  | "show ip route"
  | "show vrf"
  | "show standby brief"
  | "show vrrp brief"
  | "show environment"
  | "show processes cpu"
  | "show memory statistics"
  | "show errdisable recovery"
  | "unknown";

export interface Evidence {
  device: string;
  command: CommandType | string;
  line: number;
  text: string;
  sourceFile?: string;
  normalizedText?: string;
}

export interface DescriptionMetadata {
  description?: string;
  descriptionSource?: "CLI" | "Related" | "Generated" | "Unknown";
  descriptionConfidence?: number;
  descriptionEvidence?: Evidence[];
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
  parseStatus?: CommandParseStatus;
  parserVersion?: string;
  totalLines?: number;
  recognizedLines?: number;
  unrecognizedLines?: number;
  coveragePercent?: number;
  missingEvidence?: string[];
  recommendedFollowUpCommands?: string[];
  parser: string;
  warning?: string;
}

export interface DeviceRecord extends DescriptionMetadata {
  hostname: string;
  vendor: Vendor;
  os?: string;
  version?: string;
  model?: string;
  serialNumber?: string;
  role?: string;
  location?: string;
  commands: CommandType[];
}

export interface ArpRecord extends DescriptionMetadata {
  ip: string;
  mac: string | null;
  vlan?: number;
  interfaceName?: string;
  type?: string;
  vrf?: string;
  evidence: Evidence[];
}

export interface MacRecord extends DescriptionMetadata {
  mac: string;
  vlan?: number;
  port: string;
  type: "DYNAMIC" | "STATIC" | "SECURE" | "UNKNOWN";
  evidence: Evidence[];
}

export interface DhcpBindingRecord extends DescriptionMetadata {
  ip: string;
  mac: string | null;
  state?: string;
  lease?: string;
  type?: string;
  interfaceName?: string;
  clientIdentifier?: string;
  hostname?: string;
  vrf?: string;
  evidence: Evidence[];
}

export interface DhcpPoolRecord extends DescriptionMetadata {
  name: string;
  network?: string;
  prefix?: number;
  host?: string;
  clientIdentifier?: string;
  hardwareAddress?: string;
  leased?: number;
  total?: number;
  utilization?: number;
  defaultRouters: string[];
  dnsServers: string[];
  updateArp?: boolean;
  poolType?: "Dynamic" | "Reservation" | "Incomplete";
  vrf?: string;
  evidence: Evidence[];
}

export interface InterfaceRecord extends DescriptionMetadata {
  name: string;
  status?: string;
  protocol?: string;
  vlan?: number | string;
  accessVlan?: number;
  voiceVlan?: number;
  nativeVlan?: number;
  allowedVlans?: string;
  ip?: string;
  prefix?: number;
  secondary?: boolean;
  dhcpClient?: boolean;
  vrf?: string;
  shutdown?: boolean;
  mode?: "access" | "trunk" | "routed" | "unknown";
  speed?: string;
  duplex?: string;
  channelGroup?: string;
  channelMode?: string;
  dhcpSnoopingTrust?: boolean;
  portfast?: boolean;
  endpointTracker?: string;
  natRole?: "inside" | "outside";
  servicePolicies?: string[];
  loadInterval?: number;
  evidence: Evidence[];
}

export interface VlanRecord extends DescriptionMetadata {
  id: number;
  name?: string;
  status?: string;
  ports: string[];
  evidence: Evidence[];
}

export interface VrfRecord extends DescriptionMetadata {
  name: string;
  addressFamilies: string[];
  interfaces: string[];
  evidence: Evidence[];
}

export interface StaticRouteRecord extends DescriptionMetadata {
  vrf?: string;
  destination: string;
  prefix?: number;
  mask?: string;
  nextHop?: string;
  outgoingInterface?: string;
  distance?: number;
  evidence: Evidence[];
}

export interface AccessListRecord extends DescriptionMetadata {
  name: string;
  family: "ipv4" | "ipv6";
  aclType: "standard" | "extended" | "named" | "numbered" | "unknown";
  action?: "permit" | "deny" | "remark";
  sequence?: number;
  expression: string;
  evidence: Evidence[];
}

export type ConfigFeatureCategory =
  | "Identity"
  | "Interface"
  | "Switching"
  | "Routing"
  | "DHCP"
  | "Security"
  | "Management"
  | "Monitoring"
  | "QoS"
  | "SD-WAN"
  | "Services"
  | "PKI"
  | "Other";

export interface ConfigFeatureRecord extends DescriptionMetadata {
  category: ConfigFeatureCategory;
  feature: string;
  value?: string;
  scope?: string;
  status?: "Enabled" | "Disabled" | "Configured" | "Warning" | "Unknown";
  evidence: Evidence[];
}

export interface ParserCoverage {
  totalMeaningfulLines: number;
  recognizedLines: number;
  ignoredLines: number;
  unrecognizedLines: number;
  coveragePercent: number;
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

export interface TopologyLink extends DescriptionMetadata {
  localDevice: string;
  localInterface?: string;
  remoteDevice: string;
  remoteInterface?: string;
  protocol: "CDP" | "LLDP";
  evidence: Evidence[];
}

export interface Finding extends DescriptionMetadata {
  id: string;
  severity: Severity;
  category: "IP" | "DHCP" | "Switching" | "Security" | "Interface" | "Topology" | "Parser" | "Routing";
  title: string;
  target?: string;
  targetDescription?: string;
  description: string;
  confidence: number;
  evidence: Evidence[];
  recommendation: string;
  verificationCommands: string[];
}

export interface IpInventoryRecord extends DescriptionMetadata {
  ip: string;
  status: "Used" | "Likely Free" | "Reserved" | "Unknown";
  statusReason?: string;
  confidence: number;
  macs: string[];
  vlans: number[];
  ports: string[];
  sources: string[];
  checkedSources?: string[];
  missingSources?: string[];
  relatedPoolNames?: string[];
  evidence: Evidence[];
}

export interface SubnetRecord extends DescriptionMetadata {
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

export interface SecurityCheck extends DescriptionMetadata {
  id: string;
  name: string;
  status: "Passed" | "Failed" | "Warning" | "Unknown" | "Not Applicable";
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
  vrfs: VrfRecord[];
  staticRoutes: StaticRouteRecord[];
  accessLists: AccessListRecord[];
  configFeatures: ConfigFeatureRecord[];
  parserCoverage: ParserCoverage;
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
  evidenceCoverage?: number;
  blockedDevices: Finding[];
  recommendedCommands: string[];
  telegramSummary: string;
}
