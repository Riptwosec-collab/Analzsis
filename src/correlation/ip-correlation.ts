import type {
  AnalysisResult,
  Finding,
  IpInventoryRecord,
  ParsedDataset,
  SecurityCheck,
  SubnetRecord
} from "@/types/network";
import { calculateConfidence } from "@/evidence/confidence-engine";
import { ipEntityKey, normalizeVrf, scopeFromEvidence, scopeKey, subnetEntityKey } from "@/evidence/evidence-scope";
import { buildEntityGraph } from "@/entities/entity-graph";
import { calculateSubnet, ipInSubnet, ipToNumber, numberToIp } from "@/utils/ip";

export function correlate(dataset: ParsedDataset): AnalysisResult {
  const subnets = buildSubnets(dataset);
  const ipInventory = buildInventory(dataset, subnets);
  const findings = [
    ...dataset.parserWarnings,
    ...findDuplicateIpFindings(ipInventory),
    ...findMacFlapping(dataset),
    ...findInterfaceCounterFindings(dataset),
    ...findDhcpPoolIssues(dataset),
    ...findDhcpConflicts(dataset),
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
      used: ipInventory.filter(item => item.status === "Used" && item.deviceId === subnet.deviceId && item.vrf === subnet.vrf && ipInSubnet(item.ip, subnet.network, subnet.prefix)).length,
      free: ipInventory.filter(item => item.status === "Likely Free" && item.deviceId === subnet.deviceId && item.vrf === subnet.vrf && ipInSubnet(item.ip, subnet.network, subnet.prefix)).length,
      utilization: subnet.totalUsable ? Math.round((ipInventory.filter(item => item.status === "Used" && item.deviceId === subnet.deviceId && item.vrf === subnet.vrf && ipInSubnet(item.ip, subnet.network, subnet.prefix)).length / subnet.totalUsable) * 100) : 0
    })),
    findings: allFindings,
    securityChecks,
    securityScore,
    blockedDevices,
    recommendedCommands: buildRecommendedCommands(allFindings),
    telegramSummary: "",
    entityGraph: buildEntityGraph(dataset, subnets)
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
    const scope = scopeFromEvidence(intf.evidence, { vrf: intf.vrf });
    const id = subnetEntityKey(scope, subnet.cidr);
    map.set(id, {
      id,
      deviceId: scope.deviceId,
      vrf: normalizeVrf(scope.vrf),
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
    const scope = scopeFromEvidence(pool.evidence, { vrf: pool.vrf });
    const id = subnetEntityKey(scope, subnet.cidr);
    map.set(id, {
      id,
      deviceId: scope.deviceId,
      vrf: normalizeVrf(scope.vrf),
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
  return [...map.values()].sort((a, b) => a.deviceId.localeCompare(b.deviceId) || a.vrf.localeCompare(b.vrf) || (ipToNumber(a.network) ?? 0) - (ipToNumber(b.network) ?? 0));
}

function buildInventory(dataset: ParsedDataset, subnets: SubnetRecord[]): IpInventoryRecord[] {
  const map = new Map<string, IpInventoryRecord>();
  const scopeForIp = (evidence: IpInventoryRecord["evidence"], ip: string, overrides: Parameters<typeof scopeFromEvidence>[1] = {}) => {
    const scope = scopeFromEvidence(evidence, overrides);
    if (overrides.vrf) return scope;
    const matchingSubnets = subnets.filter(subnet => subnet.deviceId === scope.deviceId && ipInSubnet(ip, subnet.network, subnet.prefix));
    return matchingSubnets.length === 1
      ? scopeFromEvidence(evidence, { ...overrides, vrf: matchingSubnets[0].vrf })
      : scope;
  };
  const sourceState = (scope: ReturnType<typeof scopeFromEvidence>) => {
    const commandSet = new Set(dataset.commandBlocks.filter(block => block.parsed && block.device === scope.deviceId).map(block => block.command));
    return { commandSet, checkedSources: collectedSourceNames(commandSet), missingSources: missingFreeEvidence(commandSet) };
  };
  const touch = (ip: string, scope: ReturnType<typeof scopeFromEvidence>, update: Partial<IpInventoryRecord>) => {
    const id = ipEntityKey(scope, ip);
    const current = map.get(id) ?? {
      id,
      deviceId: scope.deviceId,
      vrf: normalizeVrf(scope.vrf),
      ip,
      status: "Unknown",
      statusReason: "No evidence has classified this IP yet.",
      confidence: 35,
      macs: [],
      vlans: [],
      ports: [],
      sources: [],
      checkedSources: [],
      missingSources: [],
      relatedPoolNames: [],
      confidenceBreakdown: calculateConfidence({ baseEvidenceStrength: 35 }),
      contradictions: [],
      evidence: []
    } satisfies IpInventoryRecord;
    const status = chooseStatus(current.status, update.status);
    const statusAccepted = !update.status || status === update.status;
    map.set(id, {
      ...current,
      ...update,
      status,
      statusReason: statusAccepted ? (update.statusReason ?? current.statusReason) : current.statusReason,
      confidence: Math.max(current.confidence, update.confidence ?? 0),
      macs: unique([...current.macs, ...(update.macs ?? [])]),
      vlans: unique([...current.vlans, ...(update.vlans ?? [])]),
      ports: unique([...current.ports, ...(update.ports ?? [])]),
      sources: unique([...current.sources, ...(update.sources ?? [])]),
      checkedSources: unique([...(current.checkedSources ?? []), ...(update.checkedSources ?? [])]),
      missingSources: unique([...(current.missingSources ?? []), ...(update.missingSources ?? [])]),
      relatedPoolNames: unique([...(current.relatedPoolNames ?? []), ...(update.relatedPoolNames ?? [])]),
      evidence: [...current.evidence, ...(update.evidence ?? [])]
    });
  };

  for (const log of dataset.logs) {
    if (!log.ip) continue;
    const scope = scopeForIp(log.evidence, log.ip, { vlan: log.vlan, interfaceName: log.interfaceName });
    const state = sourceState(scope);
    touch(log.ip, scope, {
      status: "Unknown",
      statusReason: "Security or log evidence mentions this IP, but no ARP, DHCP binding, MAC-table, reservation, or interface ownership evidence resolved it.",
      confidence: 45,
      vlans: log.vlan ? [log.vlan] : [],
      ports: log.interfaceName ? [log.interfaceName] : [],
      sources: ["Log/Security Event"],
      checkedSources: state.checkedSources,
      missingSources: state.missingSources,
      evidence: log.evidence
    });
  }

  for (const record of dataset.arp) {
    const scope = scopeForIp(record.evidence, record.ip, { vrf: record.vrf, vlan: record.vlan, interfaceName: record.interfaceName });
    const state = sourceState(scope);
    touch(record.ip, scope, {
      status: record.mac ? "Used" : "Unknown",
      statusReason: record.mac ? "ARP entry with MAC was found." : "ARP entry exists but no MAC was parsed, so the IP is not confirmed free.",
      confidence: record.mac ? 90 : 45,
      macs: record.mac ? [record.mac] : [],
      vlans: record.vlan ? [record.vlan] : [],
      ports: record.interfaceName ? [record.interfaceName] : [],
      sources: ["ARP"],
      checkedSources: state.checkedSources,
      evidence: record.evidence
    });
  }
  for (const record of dataset.dhcpBindings) {
    const scope = scopeForIp(record.evidence, record.ip, { vrf: record.vrf, interfaceName: record.interfaceName });
    const state = sourceState(scope);
    touch(record.ip, scope, {
      status: "Used",
      statusReason: "DHCP binding or source-binding evidence exists for this IP.",
      confidence: record.mac ? 82 : 60,
      macs: record.mac ? [record.mac] : [],
      ports: record.interfaceName ? [record.interfaceName] : [],
      sources: ["DHCP Binding"],
      checkedSources: state.checkedSources,
      evidence: record.evidence
    });
  }
  for (const conflict of dataset.dhcpConflicts) {
    const scope = scopeForIp(conflict.evidence, conflict.ip, { vrf: conflict.vrf });
    const state = sourceState(scope);
    touch(conflict.ip, scope, {
      status: "Unknown",
      statusReason: "DHCP conflict evidence exists for this IP. It must be verified before reuse.",
      confidence: 80,
      sources: ["DHCP Conflict"],
      checkedSources: state.checkedSources,
      missingSources: state.missingSources,
      evidence: conflict.evidence
    });
  }
  for (const pool of dataset.dhcpPools) {
    if (!pool.host) continue;
    const scope = scopeForIp(pool.evidence, pool.host, { vrf: pool.vrf });
    const state = sourceState(scope);
    touch(pool.host, scope, {
      status: "Reserved",
      statusReason: "DHCP reservation or host pool is configured for this IP.",
      confidence: 100,
      macs: pool.hardwareAddress ? [pool.hardwareAddress] : [],
      sources: ["DHCP Reservation"],
      checkedSources: state.checkedSources,
      relatedPoolNames: [pool.name],
      evidence: pool.evidence
    });
  }
  for (const range of dataset.dhcpExcludedRanges) {
    const start = ipToNumber(range.startIp);
    const end = ipToNumber(range.endIp);
    if (start === null || end === null) continue;
    const count = Math.min(4096, Math.max(0, end - start + 1));
    const scope = scopeFromEvidence(range.evidence, { vrf: range.vrf });
    const state = sourceState(scope);
    for (let offset = 0; offset < count; offset += 1) {
      const ip = numberToIp(start + offset);
      touch(ip, scope, {
        status: "Excluded",
        statusReason: "IP is configured under ip dhcp excluded-address and must not be treated as free.",
        confidence: 100,
        sources: ["DHCP Excluded"],
        checkedSources: state.checkedSources,
        evidence: range.evidence
      });
    }
  }
  for (const record of dataset.interfaces) {
    if (!record.ip) continue;
    const scope = scopeFromEvidence(record.evidence, { vrf: record.vrf, vlan: typeof record.vlan === "number" ? record.vlan : undefined, interfaceName: record.name });
    const state = sourceState(scope);
    touch(record.ip, scope, {
      status: "Reserved",
      statusReason: "Interface, SVI, or routed interface owns this IP.",
      confidence: 100,
      vlans: typeof record.vlan === "number" ? [record.vlan] : [],
      ports: [record.name],
      sources: ["Interface IP"],
      checkedSources: state.checkedSources,
      evidence: record.evidence
    });
  }

  // Ping / reachability evidence (read-only; results are pasted, never sent).
  // A reply is strong "Used" proof. A no-reply is intentionally weak and only
  // raises Free confidence when ARP/DHCP/MAC evidence is also absent.
  const pingNoReply = new Set<string>();
  for (const ping of dataset.pingResults) {
    const scope = resolvePingScope(subnets, ping.ip) ?? scopeFromEvidence(ping.evidence);
    const state = sourceState(scope);
    if (ping.reachable) {
      touch(ping.ip, scope, {
        status: "Used",
        statusReason: "Host replied to a pasted ping/reachability scan.",
        confidence: 88,
        macs: ping.mac ? [ping.mac] : [],
        sources: [`Ping Reply${ping.rttMs !== undefined ? ` (${ping.rttMs} ms)` : ""}`],
        checkedSources: [...state.checkedSources, "Ping Sweep"],
        evidence: ping.evidence
      });
    } else {
      pingNoReply.add(ipEntityKey(scope, ping.ip));
    }
  }

  for (const subnet of subnets) {
    if (subnet.prefix < 20 || subnet.prefix > 30) continue;
    const start = ipToNumber(subnet.firstHost);
    const end = ipToNumber(subnet.lastHost);
    if (start === null || end === null) continue;
    const scope = scopeFromEvidence(undefined, { deviceId: subnet.deviceId, vrf: subnet.vrf });
    const state = sourceState(scope);
    for (let value = start; value <= end; value += 1) {
      const ip = numberToIp(value);
      if (!map.has(ipEntityKey(scope, ip))) {
        const excluded = findExcludedRangeForIp(dataset, ip, scope);
        if (excluded) {
          touch(ip, scope, {
            status: "Excluded",
            statusReason: "IP is configured under ip dhcp excluded-address and must not be treated as free.",
            confidence: 100,
            sources: ["DHCP Excluded"],
            checkedSources: state.checkedSources,
            evidence: excluded.evidence
          });
          continue;
        }
        const pool = findDynamicPoolForIp(dataset, ip, scope);
        if (pool) {
          touch(ip, scope, {
            status: "Not Free - In DHCP Pool",
            statusReason: "IP is inside a dynamic DHCP pool. Pool capacity is not the same as a reusable free IP.",
            confidence: 95,
            sources: ["DHCP Pool range"],
            checkedSources: state.checkedSources,
            relatedPoolNames: [pool.name],
            evidence: pool.evidence
          });
          continue;
        }
        const hasFullEvidence = hasEnoughEvidenceToCallFree(dataset, state.commandSet, subnet);
        const noReply = pingNoReply.has(ipEntityKey(scope, ip));
        const freeConfidence = hasFullEvidence ? (noReply ? 88 : 60) : (noReply ? 70 : 42);
        touch(ip, scope, {
          status: "Likely Free",
          statusReason: hasFullEvidence
            ? (noReply
              ? "No ARP, DHCP binding, MAC-table, reservation, interface, or dynamic-pool evidence, and the IP did not answer a pasted ping scan. High-confidence free candidate that still needs a final verification before assignment."
              : "No ARP, DHCP binding, MAC-table, reservation, interface, or dynamic-pool evidence was found after required checks.")
            : (noReply
              ? "No ARP/DHCP/MAC evidence and no ping reply, but ARP/DHCP/MAC coverage is incomplete. Medium-confidence free candidate."
              : "Config-derived subnet gap outside DHCP pools, reservations, and interface IPs. Treat as a likely free candidate that still needs ARP, DHCP binding, and MAC-table verification."),
          confidence: freeConfidence,
          sources: [
            "Subnet gap",
            ...(hasFullEvidence ? ["No ARP/DHCP/MAC evidence"] : ["Config-only candidate", "Outside DHCP Pool"]),
            ...(noReply ? ["Ping: no reply"] : [])
          ],
          checkedSources: noReply ? [...state.checkedSources, "Ping Sweep"] : state.checkedSources,
          missingSources: hasFullEvidence ? [] : state.missingSources,
          evidence: dataset.pingResults.find(record => record.ip === ip && scopeKey(scopeFromEvidence(record.evidence)) === scopeKey(scope))?.evidence ?? []
        });
      }
    }
  }

  return [...map.values()]
    .map(item => finalizeInventoryRecord(item, dataset, subnets))
    .sort((a, b) => a.deviceId.localeCompare(b.deviceId) || a.vrf.localeCompare(b.vrf) || (ipToNumber(a.ip) ?? 0) - (ipToNumber(b.ip) ?? 0));
}

function chooseStatus(current: IpInventoryRecord["status"], next?: IpInventoryRecord["status"]) {
  if (!next) return current;
  const rank: Record<IpInventoryRecord["status"], number> = {
    Unknown: 0,
    "Likely Free": 1,
    "Not Free - In DHCP Pool": 2,
    Used: 3,
    Excluded: 4,
    Reserved: 5
  };
  return rank[next] >= rank[current] ? next : current;
}

function findDynamicPoolForIp(dataset: ParsedDataset, ip: string, scope: ReturnType<typeof scopeFromEvidence>) {
  return dataset.dhcpPools.find(pool => {
    if (pool.poolType === "Reservation" || pool.host || !pool.network || pool.prefix === undefined) return false;
    return scopeKey(scopeFromEvidence(pool.evidence, { vrf: pool.vrf })) === scopeKey(scope) && ipInSubnet(ip, pool.network, pool.prefix);
  });
}

function findExcludedRangeForIp(dataset: ParsedDataset, ip: string, scope: ReturnType<typeof scopeFromEvidence>) {
  return dataset.dhcpExcludedRanges.find(range => {
    const value = ipToNumber(ip);
    const start = ipToNumber(range.startIp);
    const end = ipToNumber(range.endIp);
    return scopeKey(scopeFromEvidence(range.evidence, { vrf: range.vrf })) === scopeKey(scope) && value !== null && start !== null && end !== null && value >= start && value <= end;
  });
}

function collectedSourceNames(commandSet: Set<string>): string[] {
  const names: string[] = [];
  if (commandSet.has("show ip arp") || commandSet.has("show arp")) names.push("ARP");
  if (commandSet.has("show ip dhcp binding") || commandSet.has("show ip dhcp snooping binding") || commandSet.has("show ip source binding")) {
    names.push("DHCP Binding");
  }
  if (commandSet.has("show mac address-table")) names.push("MAC Table");
  if (commandSet.has("show running-config")) names.push("Running Config");
  if (commandSet.has("show ip interface brief")) names.push("Interface IP");
  return names;
}

function missingFreeEvidence(commandSet: Set<string>): string[] {
  const missing: string[] = [];
  if (!commandSet.has("show ip arp") && !commandSet.has("show arp")) missing.push("ARP");
  if (!commandSet.has("show ip dhcp binding") && !commandSet.has("show ip dhcp snooping binding") && !commandSet.has("show ip source binding")) {
    missing.push("DHCP Binding");
  }
  if (!commandSet.has("show mac address-table")) missing.push("MAC Table");
  return missing;
}

function hasEnoughEvidenceToCallFree(dataset: ParsedDataset, commandSet: Set<string>, subnet: SubnetRecord): boolean {
  const hasArp = commandSet.has("show ip arp") || commandSet.has("show arp");
  const hasDhcpBinding = commandSet.has("show ip dhcp binding") || commandSet.has("show ip dhcp snooping binding") || commandSet.has("show ip source binding");
  const hasMac = commandSet.has("show mac address-table");
  const hasSubnetEvidence = dataset.interfaces.some(item => item.ip && item.prefix !== undefined && scopeFromEvidence(item.evidence, { vrf: item.vrf }).deviceId === subnet.deviceId && normalizeVrf(item.vrf) === subnet.vrf && ipInSubnet(item.ip, subnet.network, subnet.prefix))
    || dataset.dhcpPools.some(pool => pool.network && pool.prefix !== undefined && scopeFromEvidence(pool.evidence, { vrf: pool.vrf }).deviceId === subnet.deviceId && normalizeVrf(pool.vrf) === subnet.vrf && ipInSubnet(pool.network, subnet.network, subnet.prefix));
  return hasSubnetEvidence && hasArp && hasDhcpBinding && hasMac;
}

function finalizeInventoryRecord(item: IpInventoryRecord, dataset: ParsedDataset, subnets: SubnetRecord[]): IpInventoryRecord {
  const scope = scopeFromEvidence(item.evidence, { deviceId: item.deviceId, vrf: item.vrf });
  const recordScope = (evidence: IpInventoryRecord["evidence"], ip: string, vrf?: string) => {
    const base = scopeFromEvidence(evidence, { vrf });
    if (vrf) return base;
    const matches = subnets.filter(subnet => subnet.deviceId === base.deviceId && ipInSubnet(ip, subnet.network, subnet.prefix));
    return matches.length === 1 ? scopeFromEvidence(evidence, { vrf: matches[0].vrf }) : base;
  };
  const arpMacs = dataset.arp
    .filter(record => record.ip === item.ip && scopeKey(recordScope(record.evidence, record.ip, record.vrf)) === scopeKey(scope))
    .map(record => record.mac)
    .filter((mac): mac is string => Boolean(mac));
  const bindingMacs = dataset.dhcpBindings
    .filter(record => record.ip === item.ip && scopeKey(recordScope(record.evidence, record.ip, record.vrf)) === scopeKey(scope))
    .map(record => record.mac)
    .filter((mac): mac is string => Boolean(mac));
  const contradictions = [...item.contradictions];
  if (new Set(item.macs).size > 1) contradictions.push("Multiple MAC addresses were observed for this IP in the same device and VRF scope.");
  if (arpMacs.length && bindingMacs.length && !arpMacs.some(mac => bindingMacs.includes(mac))) {
    contradictions.push("ARP and DHCP binding identify different MAC addresses for this IP in the same scope.");
  }
  const coverageValues = item.evidence
    .map(evidence => dataset.commandBlocks.find(block => block.device === evidence.device && block.command === evidence.command && evidence.line >= block.startLine && evidence.line <= (block.lines.at(-1)?.line ?? block.startLine))?.coveragePercent)
    .filter((value): value is number => value !== undefined);
  const parserCoverage = coverageValues.length ? Math.round(coverageValues.reduce((total, value) => total + value, 0) / coverageValues.length) : 100;
  const confidenceBreakdown = calculateConfidence({
    baseEvidenceStrength: item.confidence,
    parserCoverage,
    scopeMatch: item.deviceId === scope.deviceId && item.vrf === normalizeVrf(scope.vrf) ? 100 : 0,
    evidence: item.evidence,
    corroboratingSources: item.sources.length,
    contradictions: contradictions.length,
    missingEvidence: item.missingSources?.length ?? 0
  });
  return { ...item, contradictions: unique(contradictions), confidence: confidenceBreakdown.finalScore, confidenceBreakdown };
}

function resolvePingScope(subnets: SubnetRecord[], ip: string): ReturnType<typeof scopeFromEvidence> | null {
  const matches = subnets.filter(subnet => ipInSubnet(ip, subnet.network, subnet.prefix));
  if (matches.length !== 1) return null;
  return scopeFromEvidence(undefined, { deviceId: matches[0].deviceId, vrf: matches[0].vrf });
}

function findDuplicateIpFindings(inventory: IpInventoryRecord[]): Finding[] {
  return inventory.filter(item => item.macs.length > 1).map((item, index) => ({
    id: `duplicate-ip-${index}`,
    severity: "Critical",
    category: "IP",
    title: "Duplicate IP suspected",
    target: item.ip,
    description: `${item.ip} is associated with multiple MAC addresses in ${item.deviceId} / VRF ${item.vrf}: ${item.macs.join(", ")}.`,
    confidence: Math.min(100, item.confidence + 5),
    evidence: item.evidence,
    recommendation: "Verify ARP on the gateway, locate each MAC on the switch fabric, and confirm the owner before changing addressing.",
    verificationCommands: [`show ip arp ${item.ip}`, ...item.macs.map(mac => `show mac address-table address ${mac}`)]
  }));
}

function findMacFlapping(dataset: ParsedDataset): Finding[] {
  const map = new Map<string, { mac: string; deviceId: string; vlan?: number; ports: Set<string>; evidence: Finding["evidence"] }>();
  for (const mac of dataset.macTable) {
    const scope = scopeFromEvidence(mac.evidence, { vlan: mac.vlan, interfaceName: mac.port });
    const key = `${scope.deviceId}|${mac.vlan ?? "unknown"}|${mac.mac}`;
    const current = map.get(key) ?? { mac: mac.mac, deviceId: scope.deviceId, vlan: mac.vlan, ports: new Set<string>(), evidence: [] };
    current.ports.add(mac.port);
    current.evidence.push(...mac.evidence);
    map.set(key, current);
  }
  const findings = [...map.values()].filter(item => item.ports.size > 1).map((item, index): Finding => ({
    id: `mac-multiple-ports-${index}`,
    severity: "High",
    category: "Switching",
    title: "MAC appears on multiple ports",
    target: item.mac,
    description: `${item.mac} appears on ${[...item.ports].join(", ")} on ${item.deviceId}${item.vlan !== undefined ? ` VLAN ${item.vlan}` : ""}.`,
    confidence: 78,
    evidence: item.evidence,
    recommendation: "Check whether the ports are uplinks, port-channels, loops, or endpoint moves before treating it as a fault.",
    verificationCommands: [`show mac address-table address ${item.mac}`, "show logging | include MACFLAP", "show interfaces status"]
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

function findInterfaceCounterFindings(dataset: ParsedDataset): Finding[] {
  return dataset.interfaces.flatMap((record, index): Finding[] => {
    const counters = {
      input: record.inputErrors ?? 0,
      crc: record.crcErrors ?? 0,
      output: record.outputErrors ?? 0,
      drops: record.outputDrops ?? 0
    };
    if (!Object.values(counters).some(value => value > 0)) return [];
    const detail = Object.entries(counters).filter(([, value]) => value > 0).map(([name, value]) => `${name}=${value}`).join(", ");
    return [{
      id: `interface-counters-${index}`,
      severity: counters.crc > 0 || counters.input > 0 ? "High" : "Medium",
      category: "Interface",
      title: "Interface error counters detected",
      target: record.name,
      description: `${record.name} reports non-zero interface counters: ${detail}.`,
      confidence: 90,
      evidence: record.evidence,
      recommendation: "Check cabling, optics, speed/duplex, queue pressure, and counter trend before remediation.",
      verificationCommands: [`show interfaces ${record.name}`, `show interfaces counters errors | include ${record.name}`, "show logging"]
    }];
  });
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

function findDhcpConflicts(dataset: ParsedDataset): Finding[] {
  return dataset.dhcpConflicts.map((conflict, index): Finding => ({
    id: `dhcp-conflict-${index}`,
    severity: "High",
    category: "DHCP",
    title: "DHCP conflict detected",
    target: conflict.ip,
    description: `${conflict.ip} appears in DHCP conflict evidence${conflict.detectionMethod ? ` via ${conflict.detectionMethod}` : ""}.`,
    confidence: 92,
    evidence: conflict.evidence,
    recommendation: "Verify the endpoint with ARP, MAC table, and DHCP binding before reusing or clearing the conflict.",
    verificationCommands: [`show ip dhcp conflict | include ${conflict.ip}`, `show ip arp ${conflict.ip}`, "show mac address-table"]
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
  const configBlocks = dataset.commandBlocks.filter(block => block.command === "show running-config");
  if (!configBlocks.length) {
    return [
      { id: "dhcp-snooping-unknown", name: "DHCP Snooping", status: "Unknown", severity: "Medium", evidence: [], recommendation: "Collect show running-config and show ip dhcp snooping to verify this control." },
      { id: "dynamic-arp-inspection-unknown", name: "Dynamic ARP Inspection", status: "Unknown", severity: "Medium", evidence: [], recommendation: "Collect show running-config and show ip arp inspection to verify this control." },
      { id: "port-security-unknown", name: "Port Security", status: "Unknown", severity: "Low", evidence: [], recommendation: "Collect show running-config and show port-security to verify this control." },
      { id: "plain-secrets-unknown", name: "Plaintext Secret Exposure", status: "Unknown", severity: "High", evidence: [], recommendation: "Run sensitive-data masking before sharing configuration output." }
    ];
  }
  return configBlocks.flatMap(block => {
    const configText = block.lines.map(line => line.text).join("\n");
    const evidence = (pattern: RegExp, redact = false) => block.lines
      .filter(line => pattern.test(line.text))
      .map(line => redact ? { ...line, text: line.text.replace(/^(?:username\s+\S+\s+.*(?:secret|password)|snmp-server community\s+)\S+/i, "[REDACTED CONFIGURATION]") } : line);
    return [
      { id: `dhcp-snooping-${block.id}`, name: "DHCP Snooping", status: /ip dhcp snooping/i.test(configText) ? "Passed" : "Unknown", severity: "Medium", evidence: evidence(/ip dhcp snooping/i), recommendation: "Enable DHCP Snooping on access VLANs where supported and trust only uplinks." },
      { id: `dynamic-arp-inspection-${block.id}`, name: "Dynamic ARP Inspection", status: /ip arp inspection/i.test(configText) ? "Passed" : "Unknown", severity: "Medium", evidence: evidence(/ip arp inspection/i), recommendation: "Enable DAI on user VLANs after DHCP Snooping bindings are validated." },
      { id: `port-security-${block.id}`, name: "Port Security", status: /switchport port-security/i.test(configText) ? "Passed" : "Warning", severity: "Low", evidence: evidence(/switchport port-security/i), recommendation: "Use port-security, 802.1X, or NAC controls on access ports according to site policy." },
      { id: `plain-secrets-${block.id}`, name: "Plaintext Secret Exposure", status: /(password|secret|community)\s+\S+/i.test(configText) ? "Warning" : "Passed", severity: "High", evidence: evidence(/(password|secret|community)\s+\S+/i, true), recommendation: "Mask credentials before sharing CLI output and rotate exposed secrets if needed." }
    ] as SecurityCheck[];
  });
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
