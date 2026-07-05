import { describe, expect, it } from "vitest";
import { analyzeCli, parseCli } from "@/parsers";
import { SAMPLE_DATA } from "@/constants/sample-data";
import { calculateSubnet } from "@/utils/ip";
import { normalizeMac } from "@/utils/mac";

describe("network utilities", () => {
  it("normalizes MAC formats", () => {
    expect(normalizeMac("6c3b.e524.91f8")).toBe("6c:3b:e5:24:91:f8");
    expect(normalizeMac("016c.3be5.2491.f8")).toBe("6c:3b:e5:24:91:f8");
  });

  it("calculates subnets", () => {
    expect(calculateSubnet("10.10.10.1", 24)?.cidr).toBe("10.10.10.0/24");
    expect(calculateSubnet("10.10.10.1", 24)?.totalUsable).toBe(254);
  });
});

describe("parser", () => {
  it("detects devices and core commands", () => {
    const parsed = parseCli(SAMPLE_DATA);
    expect(parsed.devices[0]?.hostname).toBe("CORE-SW01");
    expect(parsed.arp.length).toBeGreaterThanOrEqual(4);
    expect(parsed.macTable.length).toBeGreaterThanOrEqual(5);
    expect(parsed.dhcpBindings.length).toBeGreaterThanOrEqual(2);
  });
});

describe("analysis", () => {
  it("finds duplicate IP, MAC flapping, DHCP pool warning, and security checks", () => {
    const result = analyzeCli(SAMPLE_DATA);
    expect(result.usedIps.length).toBeGreaterThan(0);
    expect(result.freeIps.length).toBeGreaterThan(0);
    expect(result.findings.some(finding => finding.title.includes("Duplicate IP"))).toBe(true);
    expect(result.findings.some(finding => finding.title.includes("MAC flapping"))).toBe(true);
    expect(result.securityChecks.length).toBeGreaterThan(0);
    expect(result.telegramSummary).toContain("Network Analysis Summary");
  });
});
