import type { Evidence, EvidenceScope } from "@/types/network";

export const GLOBAL_VRF = "global";

export function normalizeVrf(vrf?: string): string {
  const value = vrf?.trim();
  return value && !/^default$/i.test(value) ? value : GLOBAL_VRF;
}

export function scopeFromEvidence(evidence: Evidence[] | undefined, overrides: Partial<EvidenceScope> = {}): EvidenceScope {
  const source = evidence?.[0];
  const sourceScope = source?.scope;
  const deviceId = overrides.deviceId ?? sourceScope?.deviceId ?? source?.device ?? "IMPORTED-CONFIG";
  return {
    deviceId,
    hostname: overrides.hostname ?? sourceScope?.hostname ?? source?.device,
    site: overrides.site ?? sourceScope?.site,
    vendor: overrides.vendor ?? sourceScope?.vendor,
    platform: overrides.platform ?? sourceScope?.platform,
    vrf: normalizeVrf(overrides.vrf ?? sourceScope?.vrf),
    vlan: overrides.vlan ?? sourceScope?.vlan,
    interfaceName: overrides.interfaceName ?? sourceScope?.interfaceName,
    sourceCommand: overrides.sourceCommand ?? sourceScope?.sourceCommand ?? source?.command,
    observedAt: overrides.observedAt ?? sourceScope?.observedAt,
    sourceAgeSeconds: overrides.sourceAgeSeconds ?? sourceScope?.sourceAgeSeconds
  };
}

export function scopeKey(scope: EvidenceScope): string {
  return `${scope.deviceId}|${normalizeVrf(scope.vrf)}`;
}

export function ipEntityKey(scope: EvidenceScope, ip: string): string {
  return `ip:${scopeKey(scope)}|${ip}`;
}

export function macEntityKey(scope: EvidenceScope, mac: string, vlan?: number): string {
  return `mac:${scope.deviceId}|${vlan ?? "unknown"}|${mac}`;
}

export function interfaceEntityKey(scope: EvidenceScope, interfaceName: string): string {
  return `interface:${scope.deviceId}|${interfaceName}`;
}

export function subnetEntityKey(scope: EvidenceScope, cidr: string): string {
  return `subnet:${scopeKey(scope)}|${cidr}`;
}
