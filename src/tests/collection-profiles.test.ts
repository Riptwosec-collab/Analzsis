import { describe, expect, it } from "vitest";
import { analyzeCli } from "@/parsers";
import { COLLECTION_PROFILES, missingCollectionCommands } from "@/features/troubleshooting/collection-profiles";

describe("collection profiles", () => {
  it("reports only commands not present in the current import", () => {
    const result = analyzeCli(["CORE#show ip arp", "Protocol Address Age (min) Hardware Addr Type Interface"].join("\n"));
    const duplicateIp = COLLECTION_PROFILES.find(item => item.id === "duplicate-ip");
    expect(duplicateIp).toBeDefined();
    const missing = missingCollectionCommands(result, duplicateIp!);
    expect(missing.some(item => item.command === "show ip arp")).toBe(false);
    expect(missing.some(item => item.command === "show ip dhcp binding")).toBe(true);
  });
});
