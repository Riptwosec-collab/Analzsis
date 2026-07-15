import { afterEach, describe, expect, it } from "vitest";
import { createSanitizationPreview, DEFAULT_SANITIZATION_OPTIONS, sanitizeCli } from "@/services/sanitization/sanitizer";
import { useAnalysisStore } from "@/store/analysis-store";

const CLI_WITH_SENSITIVE_VALUES = [
  "CORE-SW01#show running-config",
  "hostname CORE-SW01",
  "enable secret 9 super-secret",
  "snmp-server community monitor RW 10",
  "interface Vlan10",
  " ip address 8.8.8.8 255.255.255.0",
  " description peer 8.8.8.8 mac 0011.2233.4455",
  "mac-address 0011.2233.4455",
  "contact noc@example.com"
].join("\n");

afterEach(() => useAnalysisStore.getState().clearSession());

describe("sanitization", () => {
  it("uses deterministic aliases while preserving private addresses and sensitive redaction", () => {
    const sanitized = sanitizeCli(CLI_WITH_SENSITIVE_VALUES, "mask");

    expect(sanitized).toContain("hostname DEVICE-001");
    expect(sanitized).toContain("DEVICE-001#show running-config");
    expect(sanitized).toContain("enable secret 9 [REDACTED]");
    expect(sanitized).toContain("snmp-server community [REDACTED] RW 10");
    expect(sanitized.match(/192\.0\.2\.10/g)).toHaveLength(2);
    expect(sanitized.match(/02:00:00:00:01/g)).toHaveLength(2);
    expect(sanitized).toContain("[REDACTED_EMAIL]");
  });

  it("honors selected categories and reports the detected category counts", () => {
    const preview = createSanitizationPreview(CLI_WITH_SENSITIVE_VALUES, { ...DEFAULT_SANITIZATION_OPTIONS, publicIp: false, macAddress: false });

    expect(preview.sanitizedText).toContain("8.8.8.8");
    expect(preview.sanitizedText).toContain("0011.2233.4455");
    expect(preview.counts.credentials).toBeGreaterThan(0);
    expect(preview.counts.publicIp).toBeUndefined();
    expect(preview.counts.macAddress).toBeUndefined();
  });

  it("keeps raw CLI unchanged when a sanitized sharing preview is generated", () => {
    const store = useAnalysisStore.getState();
    store.setRawCliText(CLI_WITH_SENSITIVE_VALUES);
    store.generateSanitizedText();

    const state = useAnalysisStore.getState();
    expect(state.rawCliText).toBe(CLI_WITH_SENSITIVE_VALUES);
    expect(state.sanitizedCliText).not.toBe(CLI_WITH_SENSITIVE_VALUES);
    expect(state.sanitizedCliText).toContain("[REDACTED]");
  });
});
