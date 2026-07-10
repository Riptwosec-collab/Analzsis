import type { Evidence, PingRecord } from "@/types/network";

/**
 * Ping / reachability sweep parser (read-only).
 *
 * NetScope never sends ICMP itself. This parser only reads *pasted* results
 * from tools the engineer already ran, and turns them into reachability
 * evidence that raises or lowers Free-IP confidence. Supported inputs:
 *   - Windows  : ping ("Reply from x"), arp -a
 *   - Linux    : ping ("64 bytes from x"), fping ("x is alive/unreachable")
 *   - nmap -sn : "Nmap scan report for <host> (x)" / "Host is up"
 *   - generic  : "<ip> is alive|up|reachable|unreachable|down"
 *
 * A reply is strong "Used" evidence. A *no-reply* is deliberately weak: it can
 * only nudge confidence when combined with ARP/DHCP/MAC absence, never on its
 * own (a host may block ICMP or be powered off).
 */
const IPV4 = /\b((?:\d{1,3}\.){3}\d{1,3})\b/;

function isValidIpv4(ip: string): boolean {
  const parts = ip.split(".");
  if (parts.length !== 4) return false;
  return parts.every(part => {
    const n = Number(part);
    return Number.isInteger(n) && n >= 0 && n <= 255 && String(n) === part.replace(/^0+(?=\d)/, "");
  });
}

interface PingParse {
  ip: string;
  reachable: boolean;
  rttMs?: number;
  mac?: string;
  source: string;
}

function classifyLine(raw: string): PingParse | null {
  const line = raw.trim();
  if (!line) return null;
  const ipMatch = line.match(IPV4);
  if (!ipMatch || !isValidIpv4(ipMatch[1])) return null;
  const ip = ipMatch[1];

  // Windows: "Reply from 10.0.0.5: bytes=32 time=1ms TTL=64"
  if (/^reply from/i.test(line) && !/unreachable/i.test(line)) {
    const rtt = line.match(/time[=<]\s*(\d+)\s*ms/i);
    return { ip, reachable: true, rttMs: rtt ? Number(rtt[1]) : undefined, source: "windows-ping" };
  }
  // Windows destination unreachable reply is NOT proof the target is up.
  if (/^reply from/i.test(line) && /unreachable/i.test(line)) {
    return { ip, reachable: false, source: "windows-ping" };
  }
  // Linux: "64 bytes from 10.0.0.5: icmp_seq=1 ttl=64 time=0.5 ms"
  if (/bytes from/i.test(line)) {
    const rtt = line.match(/time[=<]\s*([\d.]+)\s*ms/i);
    return { ip, reachable: true, rttMs: rtt ? Number(rtt[1]) : undefined, source: "linux-ping" };
  }
  // fping / generic alive-dead phrasing
  if (/\bis\s+(alive|up|reachable)\b/i.test(line)) return { ip, reachable: true, source: "fping" };
  if (/\bis\s+(unreachable|down|dead)\b/i.test(line)) return { ip, reachable: false, source: "fping" };
  // nmap -sn: "Nmap scan report for host (10.0.0.5)" – reported hosts are up
  if (/^nmap scan report for/i.test(line)) return { ip, reachable: true, source: "nmap" };
  // "Host is up" without an inline IP is handled by the caller via context, skip here.
  // 100% packet loss summary for a specific IP
  if (/100%\s*(packet\s*)?loss/i.test(line)) return { ip, reachable: false, source: "ping-summary" };
  // Windows/Linux arp table: "10.0.0.5   00-11-22-33-44-55   dynamic"
  const macMatch = line.match(/\b([0-9a-f]{2}([:-])[0-9a-f]{2}(\2[0-9a-f]{2}){4})\b/i);
  if (macMatch && /(dynamic|static|reachable|stale|arpa)/i.test(line)) {
    return { ip, reachable: true, mac: normalizeMac(macMatch[1]), source: "arp-table" };
  }
  return null;
}

function normalizeMac(mac: string): string | undefined {
  const hex = mac.toLowerCase().replace(/[^0-9a-f]/g, "");
  if (hex.length !== 12) return undefined;
  return hex.match(/.{2}/g)!.join(":");
}

export function parsePingSweep(input: string, sourceFile?: string): PingRecord[] {
  if (!input) return [];
  const lines = input.replace(/\r\n/g, "\n").split("\n");
  // Deduplicate by ip, preferring a reachable result and the lowest RTT.
  const byIp = new Map<string, PingRecord>();
  lines.forEach((raw, index) => {
    const parsed = classifyLine(raw);
    if (!parsed) return;
    const evidence: Evidence = {
      device: "IMPORTED-SCAN",
      command: `ping/reachability (${parsed.source})`,
      line: index + 1,
      text: raw.trim(),
      sourceFile
    };
    const existing = byIp.get(parsed.ip);
    if (!existing) {
      byIp.set(parsed.ip, {
        ip: parsed.ip,
        reachable: parsed.reachable,
        rttMs: parsed.rttMs,
        mac: parsed.mac ?? null,
        source: parsed.source,
        evidence: [evidence]
      });
      return;
    }
    existing.evidence.push(evidence);
    if (parsed.reachable && !existing.reachable) {
      existing.reachable = true;
      existing.source = parsed.source;
    }
    if (parsed.rttMs !== undefined && (existing.rttMs === undefined || parsed.rttMs < existing.rttMs)) {
      existing.rttMs = parsed.rttMs;
    }
    if (parsed.mac && !existing.mac) existing.mac = parsed.mac;
  });
  return [...byIp.values()];
}
