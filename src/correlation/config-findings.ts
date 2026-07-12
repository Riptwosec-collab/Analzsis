import type { Finding, ParsedDataset } from "@/types/network";
import { scopeFromEvidence, scopeKey } from "@/evidence/evidence-scope";
import { ipInSubnet } from "@/utils/ip";

export function findConfigurationFindings(dataset: ParsedDataset): Finding[] {
  return [
    ...findIncompleteDhcpPools(dataset),
    ...findDuplicateDhcpIdentifiers(dataset),
    ...findDuplicateDhcpHosts(dataset),
    ...findDhcpGatewayMismatches(dataset),
    ...findOverlappingDynamicDhcpPools(dataset),
    ...findReservationsInsideDynamicPools(dataset),
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
    const key = `${scopeKey(scopeFromEvidence(pool.evidence, { vrf: pool.vrf }))}|${identifier}`;
    const list = map.get(key) ?? [];
    list.push(pool);
    map.set(key, list);
  }

  return [...map.entries()].flatMap(([key, pools], index): Finding[] => {
    if (pools.length < 2) return [];
    const identifier = pools[0].clientIdentifier ?? pools[0].hardwareAddress ?? key;
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
    const key = `${scopeKey(scopeFromEvidence(pool.evidence, { vrf: pool.vrf }))}|${pool.host}`;
    const list = map.get(key) ?? [];
    list.push(pool);
    map.set(key, list);
  }

  return [...map.entries()].flatMap(([key, pools], index): Finding[] => {
    if (pools.length < 2) return [];
    const host = pools[0].host ?? key;
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

function findOverlappingDynamicDhcpPools(dataset: ParsedDataset): Finding[] {
  const pools = dataset.dhcpPools.filter(pool => pool.poolType === "Dynamic" && pool.network && pool.prefix !== undefined);
  const findings: Finding[] = [];
  for (let leftIndex = 0; leftIndex < pools.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < pools.length; rightIndex += 1) {
      const left = pools[leftIndex];
      const right = pools[rightIndex];
      if (!left.network || left.prefix === undefined || !right.network || right.prefix === undefined) continue;
      if (scopeKey(scopeFromEvidence(left.evidence, { vrf: left.vrf })) !== scopeKey(scopeFromEvidence(right.evidence, { vrf: right.vrf }))) continue;
      if (!ipInSubnet(left.network, right.network, right.prefix) && !ipInSubnet(right.network, left.network, left.prefix)) continue;
      findings.push({
        id: `dhcp-overlap-${leftIndex}-${rightIndex}`,
        severity: "Critical",
        category: "DHCP",
        title: "Dynamic DHCP pools overlap",
        target: `${left.name} / ${right.name}`,
        description: `${left.name} (${left.network}/${left.prefix}) and ${right.name} (${right.network}/${right.prefix}) overlap in the same device and VRF scope.`,
        confidence: 100,
        evidence: [...left.evidence, ...right.evidence],
        recommendation: "Confirm the intended address boundaries and keep non-overlapping dynamic scopes before changing either DHCP pool.",
        verificationCommands: ["show running-config | section ^ip dhcp pool", "show ip dhcp pool", "show ip dhcp binding"]
      });
    }
  }
  return findings;
}

function findReservationsInsideDynamicPools(dataset: ParsedDataset): Finding[] {
  const dynamicPools = dataset.dhcpPools.filter(pool => pool.poolType === "Dynamic" && pool.network && pool.prefix !== undefined);
  const grouped = new Map<string, { pool: typeof dynamicPools[number]; reservations: typeof dataset.dhcpPools }>();
  for (const reservation of dataset.dhcpPools) {
    if (reservation.poolType !== "Reservation" || !reservation.host) continue;
    const scope = scopeKey(scopeFromEvidence(reservation.evidence, { vrf: reservation.vrf }));
    const pool = dynamicPools.find(item => item.network && item.prefix !== undefined && scopeKey(scopeFromEvidence(item.evidence, { vrf: item.vrf })) === scope && ipInSubnet(reservation.host!, item.network, item.prefix));
    if (!pool) continue;
    const key = `${scope}|${pool.name}`;
    const current = grouped.get(key) ?? { pool, reservations: [] };
    current.reservations.push(reservation);
    grouped.set(key, current);
  }

  return [...grouped.values()].map(({ pool, reservations }, index): Finding => {
    const addresses = reservations.map(item => item.host).filter((item): item is string => Boolean(item));
    return {
      id: `dhcp-reservation-in-dynamic-${index}`,
      severity: "Medium",
      category: "DHCP",
      title: "DHCP reservation is inside a dynamic pool",
      target: pool.name,
      description: `${reservations.length} reservation(s) (${addresses.slice(0, 12).join(", ")}${addresses.length > 12 ? ", ..." : ""}) fall inside dynamic pool ${pool.name} (${pool.network}/${pool.prefix}). This is a configuration review item, not a confirmed allocation collision.`,
      confidence: 75,
      evidence: [...pool.evidence, ...reservations.flatMap(item => item.evidence)],
      recommendation: "Verify the platform's reservation behavior and confirm that dynamic allocation cannot assign these addresses to a different client before changing the range.",
      verificationCommands: ["show running-config | section ^ip dhcp pool", "show ip dhcp binding", "show ip dhcp pool"]
    };
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
