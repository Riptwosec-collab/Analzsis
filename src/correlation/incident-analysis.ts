import type { IncidentRecord, LogRecord, Severity } from "@/types/network";

const SEVERITY_WEIGHT: Record<Severity, number> = {
  Critical: 5,
  High: 4,
  Medium: 3,
  Low: 2,
  Info: 1,
  Passed: 0
};

const VERIFICATION_COMMANDS: Record<string, string[]> = {
  MAC_FLAPPING: ["show mac address-table dynamic", "show logging", "show interfaces counters errors"],
  DENY_BLOCK: ["show logging", "show ip arp inspection", "show ip dhcp snooping binding"],
  ERR_DISABLED: ["show errdisable recovery", "show interfaces status", "show logging"],
  PORT_SECURITY: ["show port-security", "show port-security interface", "show logging"],
  LOG_EVENT: ["show logging"]
};

export function buildIncidents(logs: LogRecord[]): IncidentRecord[] {
  const groups = new Map<string, LogRecord[]>();
  for (const log of logs) {
    const device = log.evidence[0]?.scope?.deviceId ?? log.evidence[0]?.device ?? "UNKNOWN";
    const target = log.interfaceName ? `interface:${log.interfaceName}` : log.ip ? `ip:${log.ip}` : log.mac ? `mac:${log.mac}` : `type:${log.type}`;
    const key = `${device}|${log.type}|${target}`;
    groups.set(key, [...(groups.get(key) ?? []), log]);
  }

  return [...groups.entries()].map(([key, events]) => {
    const ordered = [...events].sort((left, right) => timestampValue(left) - timestampValue(right));
    const first = ordered[0];
    const last = ordered.at(-1) ?? first;
    const firstDate = parseTimestamp(first.deviceTimestamp);
    const lastDate = parseTimestamp(last.deviceTimestamp);
    const durationSeconds = firstDate && lastDate ? Math.max(0, Math.floor((lastDate - firstDate) / 1000)) : undefined;
    const evidence = ordered.flatMap(event => event.evidence);
    const corroboratedSources = new Set(evidence.map(item => item.command)).size;
    const confidence = Math.min(95, 60 + Math.min(20, evidence.length * 10) + Math.min(15, Math.max(0, corroboratedSources - 1) * 5));
    const device = first.evidence[0]?.scope?.deviceId ?? first.evidence[0]?.device ?? "UNKNOWN";

    return {
      id: `incident-${hashKey(key)}`,
      type: first.type,
      severity: ordered.reduce((highest, event) => SEVERITY_WEIGHT[event.severity] > SEVERITY_WEIGHT[highest] ? event.severity : highest, first.severity),
      device,
      interfaceName: first.interfaceName,
      ip: first.ip,
      mac: first.mac,
      vlan: first.vlan,
      startTimestamp: first.deviceTimestamp,
      endTimestamp: last.deviceTimestamp,
      durationSeconds,
      confidence,
      eventCount: ordered.length,
      events: ordered,
      evidence,
      verificationCommands: VERIFICATION_COMMANDS[first.type] ?? VERIFICATION_COMMANDS.LOG_EVENT
    };
  }).sort((left, right) => SEVERITY_WEIGHT[right.severity] - SEVERITY_WEIGHT[left.severity] || timestampValue(right.events[0]) - timestampValue(left.events[0]));
}

function parseTimestamp(value: string | undefined): number | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}[T\s]/.test(value)) return undefined;
  const parsed = Date.parse(value.replace(" ", "T"));
  return Number.isNaN(parsed) ? undefined : parsed;
}

function timestampValue(log: LogRecord): number {
  return parseTimestamp(log.deviceTimestamp) ?? 0;
}

function hashKey(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) hash = (hash * 31 + value.charCodeAt(index)) | 0;
  return Math.abs(hash).toString(36);
}
