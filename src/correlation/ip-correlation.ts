import type {
  AnalysisResult,
  Finding,
  IpInventoryRecord,
  ParsedDataset,
  SecurityCheck,
  SubnetRecord
} from "@/types/network";
import { calculateSubnet, ipInSubnet, ipToNumber, numberToIp } from "@/utils/ip";

export function correlate(dataset: ParsedDataset): AnalysisResult {
  const subnets = buildSubnets(dataset);
  const ipInventory = buildInventory(dataset, subnets);
  const findings = [
    ...dataset.parserWarnings,
    ...findDuplicateIpFindings(ipInventory),
    ...findMacFlapping(dataset),
    ...findDhcpPoolIssues(dataset),
    ...findLogFindings(dataset)
  ];
  const securityChecks = buildSecurityChecks(dataset);
  const securityFindings = securityChecks
    .filter(check => check.status === "Failed" || check.status === "Warning")
    .map((check): Finding => ({
      id: `security-${check.id}`,
      severity: check.severity,
      category: "Security",
      title: check.name,
      description: check.recommendation,
      confidence: check.evidence.length ? 80 : 45,
      evidence: check.evidence,
      recommendation: check.recommendation,
      verificationCommands: ["show running-config", "show ip dhcp snooping", "show ip arp inspection"]
    }));
  const allFindings = [...findings, ...securityFindings].sort((a, b) => severityRank(b.severity) - severityRank(a.severity));
  const blockedDevices = allFindings.filter(finding => /block|deny|err|quarantine|violation/i.test(`${finding.title} ${finding.description}`));
  const securityScore = Math.max(0, 100 - securityChecks.reduce((score, check) => {
    if (check.status === "Passed") return score;
    return score + (check.severity === "Critical" ? 25 : check.severity === "High" ? 18 : check.severity === "Medium" ? 10 : 4);
  }, 0));

  const result: AnalysisResult = {
    ...dataset,
    generatedAt: new Date().toISOString(),
    ipInventory,
    usedIps: ipInventory.filter(item => item.status === "Used"),
    freeIps: ipInventory.filter(item => item.status === "Likely Free"),
    subnets: subnets.map(subnet => ({
      ...subnet,
      used: ipInventory.filter(item => item.status === "Used" && ipInSubnet(item.ip, subnet.network, subnet.prefix)).length,
      free: ipInventory.filter(item => item.status === "Likely Free" && ipInSubnet(item.ip, subnet.network, subnet.prefix)).length,
      utilization: subnet.totalUsable ? Math.round((ipInventory.filter(item => item.status === "Used" && ipInSubnet(item.ip, subnet.network, subnet.prefix)).length / subnet.totalUsable) * 100) : 0
    })),
    findings: allFindings,
    securityChecks,
    securityScore,
    blockedDevices,
    recommendedCommands: buildRecommendedCommands(allFindings),
    telegramSummary: ""
  };

  result.telegramSummary = buildTelegramSummary(result);
  return result;
}

function buildSubnets(dataset: ParsedDataset): SubnetRecord[] {
  const map = new Map<string, SubnetRecord>();
  for (const intf of dataset.interfaces) {
    if (!intf.ip || intf.prefix === undefined) continue;
    const subnet = calculateSubnet(intf.ip, intf.prefix);
    if (!subnet) continue;
    map.set(subnet.cidr, {
      cidr: subnet.cidr,
      network: subnet.network,
      prefix: subnet.prefix,
      firstHost: subnet.firstHost,
      lastHost: subnet.lastHost,
      broadcast: subnet.broadcast,
      totalUsable: subnet.totalUsable,
      used: 0,
      free: 0,
      utilization: 0
    });
  }
  for (const pool of dataset.dhcpPools) {
    if (!pool.network || pool.prefix === undefined) continue;
    const subnet = calculateSubnet(pool.network, pool.prefix);
    if (!subnet) continue;
    map.set(subnet.cidr, {
      cidr: subnet.cidr,
      network: subnet.network,
      prefix: subnet.prefix,
      firstHost: subnet.firstHost,
      lastHost: subnet.lastHost,
      broadcast: subnet.broadcast,
      totalUsable: subnet.totalUsable,
      used: 0,
      free: 0,
      utilization: 0
    });
  }
  return [...map.values()].sort((a, b) => (ipToNumber(a.network) ?? 0) - (ipToNumber(b.network) ?? 0));
}

function buildInventory(dataset: ParsedDataset, subnets: SubnetRecord[]): IpInventoryRecord[] {
  const map = new Map<string, IpInventoryRecord>();
  const touch = (ip: string, update: Partial<IpInventoryRecord>) => {
    const current = map.get(ip) ?? {
      ip,
      status: "Unknown",
      confidence: 35,
      macs: [],
      vlans: [],
      ports: [],
      sources: [],
      evidence: []
    } satisfies IpInventoryRecord;
    map.set(ip, {
      ...current,
      ...update,
      confidence: Math.max(current.confidence, update.confidence ?? 0),
      macs: unique([...current.macs, ...(update.macs ?? [])]),
      vlans: unique([...current.vlans, ...(update.vlans ?? [])]),
      ports: unique([...current.ports, ...(update.ports ?? [])]),
      sources: unique([...current.sources, ...(update.sources ?? [])]),
      evidence: [...current.evidence, ...(update.evidence ?? [])]
    });
  };

  for (const record of dataset.arp) {
    touch(record.ip, {
      status: record.mac ? "Used" : "Unknown",
      confidence: record.mac ? 90 : 45,
      macs: record.mac ? [record.mac] : [],
      vlans: record.vlan ? [record.vlan] : [],
      ports: record.interfaceName ? [record.interfaceName] : [],
      sources: ["ARP"],
      evidence: record.evidence
    });
  }
  for (const record of dataset.dhcpBindings) {
    touch(record.ip, {
      status: "Used",
      confidence: record.mac ? 82 : 60,
      macs: record.mac ? [record.mac] : [],
      ports: record.interfaceName ? [record.interfaceName] : [],
      sources: ["DHCP Binding"],
      evidence: record.evidence
    });
  }
  for (const record of dataset.interfaces) {
    if (!record.ip) continue;
    touch(record.ip, {
      status: "Reserved",
      confidence: 100,
      vlans: typeof record.vlan === "number" ? [record.vlan] : [],
      ports: [record.name],
      sources: ["Interface IP"],
      evidence: record.evidence
    });
  }

  const arpIps = new Set(dataset.arp.map(record => record.ip));
  for (const subnet of subnets) {
    if (subnet.prefix < 20 || subnet.prefix > 30) continue;
    const start = ipToNumber(subnet.firstHost);
    const end = ipToNumber(subnet.lastHost);
    if (start === null || end === null) continue;
    for (let value = start; value <= end; value += 1) {
      const ip = numberToIp(value);
      if (!map.has(ip) && !arpIps.has(ip)) {
        touch(ip, {
          status: "Likely Free",
          confidence: dataset.arp.length || dataset.dhcpBindings.length ? 65 : 35,
          sources: ["Subnet gap"],
          evidence: []
        });
      }
    }
  }

  return [...map.values()].sort((a, b) => (ipToNumber(a.ip) ?? 0) - (ipToNumber(b.ip) ?? 0));
}

function findDuplicateIpFindings(inventory: IpInventoryRecord[]): Finding[] {
  return inventory.filter(item => item.macs.length > 1).map((item, index) => ({
    id: `duplicate-ip-${index}`,
    severity: "Critical",
    category: "IP",
    title: "Duplicate IP suspected",
    target: item.ip,
    description: `${item.ip} is associated with multiple MAC addresses: ${item.macs.join(", ")}.`,
    confidence: Math.min(100, item.confidence + 5),
    evidence: item.evidence,
    recommendation: "Verify ARP on the gateway, locate each MAC on the switch fabric, and confirm the owner before changing addressing.",
    verificationCommands: [`show ip arp ${item.ip}`, ...item.macs.map(mac => `show mac address-table address ${mac}`)]
  }));
}

function findMacFlapping(dataset: ParsedDataset): Finding[] {
  const map = new Map<string, Set<string>>();
  for (const mac of dataset.macTable) {
    const ports = map.get(mac.mac) ?? new Set<string>();
    ports.add(mac.port);
    map.set(mac.mac, ports);
  }
  const findings = [...map.entries()].filter(([, ports]) => ports.size > 1).map(([mac, ports], index): Finding => ({
    id: `mac-multiple-ports-${index}`,
    severity: "High",
    category: "Switching",
    title: "MAC appears on multiple ports",
    target: mac,
    description: `${mac} appears on ${[...ports].join(", ")} in the imported MAC table.`,
    confidence: 78,
    evidence: dataset.macTable.filter(row => row.mac === mac).flatMap(row => row.evidence),
    recommendation: "Check whether the ports are uplinks, port-channels, loops, or endpoint moves before treating it as a fault.",
    verificationCommands: [`show mac address-table address ${mac}`, "show logging | include MACFLAP", "show interfaces status"]
  }));
  const logFindings = dataset.logs.filter(log => log.type === "MAC_FLAPPING").map((log, index): Finding => ({
    id: `mac-flap-log-${index}`,
    severity: "High",
    category: "Switching",
    title: "MAC flapping log detected",
    target: log.mac,
    description: log.message,
    confidence: 92,
    evidence: log.evidence,
    recommendation: "Trace the MAC address across access and uplink switches. Verify STP and cabling before remediation.",
    verificationCommands: log.mac ? [`show mac address-table address ${log.mac}`, "show spanning-tree inconsistentports"] : ["show logging | include MACFLAP"]
  }));
  return [...findings, ...logFindings];
}

function findDhcpPoolIssues(dataset: ParsedDataset): Finding[] {
  return dataset.dhcpPools.filter(pool => (pool.utilization ?? 0) >= 85).map((pool, index): Finding => ({
    id: `dhcp-pool-${index}`,
    severity: (pool.utilization ?? 0) >= 95 ? "Critical" : "High",
    category: "DHCP",
    title: "DHCP pool near capacity",
    target: pool.name,
    description: `${pool.name} is ${pool.utilization}% utilized.`,
    confidence: pool.total ? 90 : 65,
    evidence: pool.evidence,
    recommendation: "Review lease duration, stale bindings, excluded ranges, and whether the scope needs expansion.",
    verificationCommands: ["show ip dhcp pool", "show ip dhcp binding", "show ip dhcp conflict"]
  }));
}

function findLogFindings(dataset: ParsedDataset): Finding[] {
  return dataset.logs.filter(log => log.type !== "MAC_FLAPPING").map((log, index): Finding => ({
    id: `log-${index}`,
    severity: log.severity,
    category: /DENY|PORT_SECURITY/i.test(log.type) ? "Security" : "Interface",
    title: log.type.replaceAll("_", " "),
    target: log.ip ?? log.mac ?? log.interfaceName,
    description: log.message,
    confidence: 88,
    evidence: log.evidence,
    recommendation: "Use the verification commands to confirm whether the event is current before applying remediation.",
    verificationCommands: ["show logging", "show interfaces status", "show running-config interface"]
  }));
}

function buildSecurityChecks(dataset: ParsedDataset): SecurityCheck[] {
  const configText = dataset.commandBlocks.filter(block => block.command === "show running-config").flatMap(block => block.lines).map(line => line.text).join("\n");
  return [
    {
      id: "dhcp-snooping",
      name: "DHCP Snooping",
      status: /ip dhcp snooping/i.test(configText) ? "Passed" : "Unknown",
      severity: "Medium",
      evidence: findEvidence(dataset, /ip dhcp snooping/i),
      recommendation: "Enable DHCP Snooping on access VLANs where supported and trust only uplinks."
    },
    {
      id: "dynamic-arp-inspection",
      name: "Dynamic ARP Inspection",
      status: /ip arp inspection/i.test(configText) ? "Passed" : "Unknown",
      severity: "Medium",
      evidence: findEvidence(dataset, /ip arp inspection/i),
      recommendation: "Enable DAI on user VLANs after DHCP Snooping bindings are validated."
    },
    {
      id: "port-security",
      name: "Port Security",
      status: /switchport port-security/i.test(configText) ? "Passed" : "Warning",
      severity: "Low",
      evidence: findEvidence(dataset, /switchport port-security/i),
      recommendation: "Use port-security, 802.1X, or NAC controls on access ports according to site policy."
    },
    {
      id: "plain-secrets",
      name: "Plaintext Secret Exposure",
      status: /(password|secret|community)\s+\S+/i.test(configText) ? "Warning" : "Passed",
      severity: "High",
      evidence: findEvidence(dataset, /(password|secret|community)\s+\S+/i),
      recommendation: "Mask credentials before sharing CLI output and rotate exposed secrets if needed."
    }
  ];
}

function findEvidence(dataset: ParsedDataset, pattern: RegExp) {
  return dataset.commandBlocks.flatMap(block => block.lines.filter(line => pattern.test(line.text)));
}

function buildRecommendedCommands(findings: Finding[]): string[] {
  return unique(findings.flatMap(finding => finding.verificationCommands)).slice(0, 24);
}

function buildTelegramSummary(result: AnalysisResult): string {
  const severity = (name: string) => result.findings.filter(finding => finding.severity === name).length;
  const top = result.findings.slice(0, 3).map((finding, index) => `${index + 1}. ${finding.title}${finding.target ? ` - ${finding.target}` : ""}`).join("\n");
  return [
    "Network Analysis Summary",
    "",
    `Devices: ${result.devices.length}`,
    `Subnets: ${result.subnets.length}`,
    `Used IP: ${result.usedIps.length}`,
    `Free IP: ${result.freeIps.length}`,
    "",
    `Critical: ${severity("Critical")}`,
    `High: ${severity("High")}`,
    `Medium: ${severity("Medium")}`,
    "",
    "Top Findings:",
    top || "No critical findings from current CLI input.",
    "",
    `Security Score: ${result.securityScore}/100`
  ].join("\n");
}

function severityRank(severity: string): number {
  return { Critical: 5, High: 4, Medium: 3, Low: 2, Info: 1, Passed: 0 }[severity] ?? 0;
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}
