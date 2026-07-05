import type { Finding, ParsedDataset } from "@/types/network";
import { ipInSubnet } from "@/utils/ip";

export function findConfigurationFindings(dataset: ParsedDataset): Finding[] {
  return [
    ...findIncompleteDhcpPools(dataset),
    ...findDuplicateDhcpIdentifiers(dataset),
    ...findDuplicateDhcpHosts(dataset),
    ...findDhcpGatewayMismatches(dataset),
    ...findParserCoverageIssue(dataset)
  ];
}

function findIncompleteDhcpPools(dataset: ParsedDataset): Finding[] {
  return dataset.dhcpPools.flatMap((pool, index): Finding[] => {
    if (pool.network || pool.host) return [];
    return [{
      id: `dhcp-incomplete-${index}`,
      severity: "High",
      category: "DHCP",
      title: "Incomplete DHCP pool",
      target: pool.name,
      targetDescription: pool.description,
      description: `DHCP pool ${pool.name} has no host or network statement, so it cannot allocate or reserve an address reliably.`,
      confidence: 100,
      evidence: pool.evidence,
      recommendation: "Review the pool and add the intended host or network statement, or remove the stale pool after confirming it is unused.",
      verificationCommands: ["show running-config | section ^ip dhcp pool", "show ip dhcp pool", "show ip dhcp binding"]
    }];
  });
}

function findDuplicateDhcpIdentifiers(dataset: ParsedDataset): Finding[] {
  const map = new Map<string, typeof dataset.dhcpPools>();
  for (const pool of dataset.dhcpPools) {
    const identifier = pool.clientIdentifier ?? pool.hardwareAddress;
    if (!identifier) continue;
    const list = map.get(identifier) ?? [];
    list.push(pool);
    map.set(identifier, list);
  }

  return [...map.entries()].flatMap(([identifier, pools], index): Finding[] => {
    if (pools.length < 2) return [];
    const targets = pools.map(pool => pool.host ?? pool.network ?? pool.name);
    return [{
      id: `dhcp-duplicate-client-${index}`,
      severity: "Critical",
      category: "DHCP",
      title: "DHCP client identifier assigned more than once",
      target: identifier,
      description: `${identifier} is configured in multiple DHCP pools: ${targets.join(", ")}. This can produce an incorrect or unpredictable reservation.`,
      confidence: 100,
      evidence: pools.flatMap(pool => pool.evidence),
      recommendation: "Confirm the endpoint MAC/client identifier and keep only the correct reservation. Check whether the duplicate entry is stale before removing it.",
      verificationCommands: [
        `show running-config | include ${identifier}`,
        "show ip dhcp binding",
        "show ip arp"
      ]
    }];
  });
}

function findDuplicateDhcpHosts(dataset: ParsedDataset): Finding[] {
  const map = new Map<string, typeof dataset.dhcpPools>();
  for (const pool of dataset.dhcpPools) {
    if (!pool.host) continue;
    const list = map.get(pool.host) ?? [];
    list.push(pool);
    map.set(pool.host, list);
  }

  return [...map.entries()].flatMap(([host, pools], index): Finding[] => {
    if (pools.length < 2) return [];
    return [{
      id: `dhcp-duplicate-host-${index}`,
      severity: "Critical",
      category: "DHCP",
      title: "DHCP address reserved more than once",
      target: host,
      description: `${host} appears in ${pools.length} DHCP pool definitions.`,
      confidence: 100,
      evidence: pools.flatMap(pool => pool.evidence),
      recommendation: "Keep one authoritative reservation and remove or correct duplicate pool definitions after validating the endpoint owner.",
      verificationCommands: [`show running-config | include ${host}`, "show ip dhcp binding", `show ip arp ${host}`]
    }];
  });
}

function findDhcpGatewayMismatches(dataset: ParsedDataset): Finding[] {
  const findings: Finding[] = [];
  dataset.dhcpPools.forEach((pool, poolIndex) => {
    const anchor = pool.host ?? pool.network;
    if (!anchor || pool.prefix === undefined) return;
    pool.defaultRouters.forEach((router, routerIndex) => {
      if (ipInSubnet(router, anchor, pool.prefix ?? 32)) return;
      findings.push({
        id: `dhcp-gateway-mismatch-${poolIndex}-${routerIndex}`,
        severity: "Critical",
        category: "DHCP",
        title: "DHCP default gateway is outside the pool subnet",
        target: pool.host ?? pool.name,
        targetDescription: pool.description,
        description: `${router} is configured as the default router for ${anchor}/${pool.prefix}, but it is outside that subnet.`,
        confidence: 100,
        evidence: pool.evidence,
        recommendation: "Verify the intended VLAN and gateway, then correct the default-router statement. Do not change it until the active gateway and subnet are confirmed.",
        verificationCommands: [
          `show running-config | section ^ip dhcp pool ${pool.name}`,
          `show ip route ${router}`,
          `show ip arp ${router}`,
          "show ip interface brief"
        ]
      });
    });
  });
  return findings;
}

function findParserCoverageIssue(dataset: ParsedDataset): Finding[] {
  const coverage = dataset.parserCoverage;
  if (!coverage.totalMeaningfulLines || coverage.coveragePercent >= 70) return [];
  return [{
    id: "parser-coverage-low",
    severity: "Low",
    category: "Parser",
    title: "Partial configuration coverage",
    target: `${coverage.coveragePercent}%`,
    description: `${coverage.recognizedLines} of ${coverage.totalMeaningfulLines} meaningful configuration lines were structurally recognized. Unrecognized lines remain available as raw evidence and are not silently treated as valid data.`,
    confidence: 100,
    evidence: [],
    recommendation: "Review unrecognized command families and add sanitized fixtures before using those sections for automated decisions.",
    verificationCommands: ["show running-config"]
  }];
}
