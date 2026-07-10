import { describe, expect, it } from "vitest";
import { parsePingSweep } from "@/parsers/generic/ping-sweep-parser";
import { analyzeCli } from "@/parsers";

describe("parsePingSweep", () => {
  it("marks Windows/Linux/fping/nmap replies reachable and timeouts unreachable", () => {
    const input = [
      "Reply from 10.0.0.5: bytes=32 time=1ms TTL=64",
      "Reply from 10.0.0.1: Destination host unreachable.",
      "64 bytes from 10.0.0.20: icmp_seq=1 ttl=64 time=0.5 ms",
      "10.0.0.99 is alive",
      "10.0.0.140 is unreachable",
      "Nmap scan report for host1 (10.0.0.11)"
    ].join("\n");
    const records = parsePingSweep(input);
    const byIp = Object.fromEntries(records.map(r => [r.ip, r.reachable]));
    expect(byIp["10.0.0.5"]).toBe(true);
    expect(byIp["10.0.0.1"]).toBe(false);
    expect(byIp["10.0.0.20"]).toBe(true);
    expect(byIp["10.0.0.99"]).toBe(true);
    expect(byIp["10.0.0.140"]).toBe(false);
    expect(byIp["10.0.0.11"]).toBe(true);
  });

  it("captures RTT and dedupes by IP preferring reachable", () => {
    const records = parsePingSweep("Request timed out.\nReply from 10.1.1.1: bytes=32 time=7ms TTL=128\nReply from 10.1.1.1: bytes=32 time=3ms TTL=128");
    const rec = records.find(r => r.ip === "10.1.1.1");
    expect(rec?.reachable).toBe(true);
    expect(rec?.rttMs).toBe(3);
  });

  it("reads an arp -a line as reachable with a normalized MAC", () => {
    const records = parsePingSweep("  10.2.2.2          aa-bb-cc-dd-ee-ff     dynamic");
    expect(records[0].ip).toBe("10.2.2.2");
    expect(records[0].reachable).toBe(true);
    expect(records[0].mac).toBe("aa:bb:cc:dd:ee:ff");
  });
});

describe("free-ip confidence with ping evidence", () => {
  const base = `R1#show ip interface brief
Interface              IP-Address      OK? Method Status                Protocol
Vlan20                 10.20.20.1      YES manual up                    up
R1#show running-config
interface Vlan20
 ip address 10.20.20.1 255.255.255.0
R1#show ip arp
Protocol Address       Age (min) Hardware Addr  Type Interface
Internet 10.20.20.1    -         0011.2233.4455 ARPA Vlan20
Internet 10.20.20.50   2         6c3b.e524.91f8 ARPA Vlan20
R1#show ip dhcp binding
10.20.20.50    0100.6c3b.e524.91f8   Infinite   Automatic
R1#show mac address-table
Vlan Mac Address       Type      Ports
20   6c3b.e524.91f8    DYNAMIC   Gi1/0/5`;

  it("raises a free IP to high confidence only when a ping no-reply is present", () => {
    const withoutPing = analyzeCli(base);
    const free1 = withoutPing.ipInventory.find(r => r.ip === "10.20.20.150");
    expect(free1?.status).toBe("Likely Free");
    expect(free1 ? free1.confidence < 85 : false).toBe(true);

    const withPing = analyzeCli(`${base}\n10.20.20.150 is unreachable`);
    const free2 = withPing.ipInventory.find(r => r.ip === "10.20.20.150");
    expect(free2?.status).toBe("Likely Free");
    expect(free2 ? free2.confidence >= 85 : false).toBe(true);
    expect(free2?.sources).toContain("Ping: no reply");

    const replied = withPing.ipInventory.find(r => r.ip === "10.20.20.50");
    expect(replied?.status).toBe("Used");
  });
});
