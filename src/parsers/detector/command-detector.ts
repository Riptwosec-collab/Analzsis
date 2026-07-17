import type { CommandBlock, CommandType, Evidence, Vendor } from "@/types/network";

const commandPatterns: Array<[CommandType, RegExp]> = [
  ["show ip arp", /^show\s+ip\s+arp\b/i],
  ["show arp", /^show\s+arp\b/i],
  ["show mac address-table", /^show\s+mac(?:\s+address-table|\s+add(?:ress-table)?)\b/i],
  ["show ip dhcp binding", /^show\s+ip\s+dhcp\s+binding\b/i],
  ["show ip dhcp pool", /^show\s+ip\s+dhcp\s+pool\b/i],
  ["show ip dhcp conflict", /^show\s+ip\s+dhcp\s+conflict\b/i],
  ["show ip dhcp snooping binding", /^show\s+ip\s+dhcp\s+snooping\s+binding\b/i],
  ["show ip dhcp snooping", /^show\s+ip\s+dhcp\s+snooping\b/i],
  ["show ip arp inspection", /^show\s+ip\s+arp\s+inspection\b/i],
  ["show ip source binding", /^show\s+ip\s+source\s+binding\b/i],
  ["show vlan brief", /^show\s+vlan(?:\s+brief)?\b/i],
  ["show interfaces description", /^show\s+interfaces?\s+description\b/i],
  ["show interfaces status", /^show\s+interfaces?\s+status\b/i],
  ["show interfaces switchport", /^show\s+interfaces?\s+switchport\b/i],
  ["show interfaces trunk", /^show\s+interfaces?\s+trunk\b/i],
  ["show interfaces counters errors", /^show\s+interfaces?\s+counters?\s+errors\b/i],
  ["show ip interface brief", /^show\s+ip\s+interfaces?\s+brief\b/i],
  ["show interfaces", /^show\s+interfaces?\b/i],
  ["show running-config", /^show\s+(?:running-config|run)\b|^running-config\b/i],
  ["show logging", /^show\s+log(?:ging)?\b/i],
  ["show spanning-tree inconsistentports", /^show\s+spanning-tree\s+inconsistentports\b/i],
  ["show spanning-tree detail", /^show\s+spanning-tree\s+detail\b/i],
  ["show spanning-tree", /^show\s+spanning-tree\b/i],
  ["show etherchannel summary", /^show\s+etherchannel\s+summary\b/i],
  ["show port-security interface", /^show\s+port-security\s+interface\b/i],
  ["show port-security", /^show\s+port-security\b/i],
  ["show authentication sessions", /^show\s+authentication\s+sessions\b/i],
  ["show dot1x all", /^show\s+dot1x\s+all\b/i],
  ["show ip access-lists", /^show\s+ip\s+access-lists\b/i],
  ["show access-lists", /^show\s+access-lists\b/i],
  ["show cdp neighbors detail", /^show\s+cdp\s+neighbors?\s+detail\b/i],
  ["show lldp neighbors detail", /^show\s+lldp\s+neighbors?\s+detail\b/i],
  ["show version", /^show\s+version\b/i],
  ["show inventory", /^show\s+inventory\b/i],
  ["show ip route", /^show\s+ip\s+route\b/i],
  ["show vrf", /^show\s+vrf\b/i],
  ["show standby brief", /^show\s+standby\s+brief\b/i],
  ["show vrrp brief", /^show\s+vrrp\s+brief\b/i],
  ["show environment", /^show\s+environment\b/i],
  ["show processes cpu", /^show\s+processes?\s+cpu\b/i],
  ["show memory statistics", /^show\s+memory(?:\s+statistics)?\b/i],
  ["show errdisable recovery", /^show\s+errdisable\s+recovery\b/i]
];

export function normalizeCommand(raw: string): CommandType {
  const command = normalizeRawCommand(raw);
  return commandPatterns.find(([, pattern]) => pattern.test(command))?.[0] ?? "unknown";
}

export function normalizeRawCommand(raw: string): string {
  return expandCommandAliases(raw.trim().replace(/\s+/g, " "));
}

function expandCommandAliases(raw: string): string {
  let command = raw.replace(/^sh\b/i, "show");
  command = command.replace(/^show\s+ip\s+int\b/i, "show ip interface");
  command = command.replace(/^show\s+int\b/i, "show interfaces");
  command = command.replace(/\bintf\b/i, "interface");
  command = command.replace(/\bbr(?:ief)?\b/i, "brief");
  command = command.replace(/\brun(?:ning-config)?\b/i, "running-config");
  command = command.replace(/\bmac\s+add(?:ress-table)?\b/i, "mac address-table");
  command = command.replace(/^show\s+spanning\b/i, "show spanning-tree");
  command = command.replace(/\blog\b/i, "logging");
  command = command.replace(/\bdesc\b/i, "description");
  command = command.replace(/\bswitch(?:port)?\b/i, "switchport");
  command = command.replace(/\btr(?:unk)?\b/i, "trunk");
  command = command.replace(/\bstat(?:us)?\b/i, "status");
  return command;
}

export function detectVendor(text: string): Vendor {
  if (/FortiGate|config firewall|set allowaccess|diagnose\s+/i.test(text)) return "fortigate";
  if (/Cisco|IOS|NX-OS|hostname\s+\S+|ip dhcp pool|switchport\s+mode|interface\s+(?:Vlan|GigabitEthernet|FastEthernet|TenGigabitEthernet)|router omp/i.test(text)) return "cisco";
  if (/MikroTik|^\/ip address|RouterOS/i.test(text)) return "mikrotik";
  if (/Aruba|ProCurve|show\s+lldp\s+info/i.test(text)) return "aruba";
  if (/JUNOS|set interfaces|show ethernet-switching/i.test(text)) return "juniper";
  return "generic";
}

export function detectCommandBlocks(input: string): CommandBlock[] {
  const lines = input.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const blocks: CommandBlock[] = [];
  let current: CommandBlock | null = null;

  lines.forEach((text, index) => {
    const lineNumber = index + 1;
    const prompt = text.match(/^([A-Za-z0-9_.:-]{2,96})(?:\([^)]+\))?[#>]\s*(.+)$/);
    const isCommand = prompt && /^(show|sh|display|diagnose|get|config|\/)/i.test(prompt[2].trim());

    if (prompt && isCommand) {
      if (current) blocks.push(current);
      const rawCommand = normalizeRawCommand(prompt[2]);
      const command = normalizeCommand(rawCommand);
      current = {
        id: `${lineNumber}-${prompt[1]}-${command}`,
        device: prompt[1],
        vendor: detectVendor(`${text}\n${input.slice(0, 4000)}`),
        command,
        rawCommand,
        startLine: lineNumber,
        lines: [],
        parsed: false,
        parseStatus: "empty",
        parserVersion: "cisco-ios@1",
        totalLines: 0,
        recognizedLines: 0,
        ignoredLines: 0,
        malformedLines: 0,
        unrecognizedLines: 0,
        coveragePercent: 0,
        missingEvidence: [],
        recommendedFollowUpCommands: [],
        parser: command === "unknown" ? "unsupported" : "cisco-ios"
      };
      return;
    }

    if (!current && text.trim()) {
      const vendor = detectVendor(input);
      const command = sniffCommand(input);
      current = {
        id: `1-imported-cli-${command}`,
        device: detectHostname(input) ?? "IMPORTED-CONFIG",
        vendor,
        command,
        rawCommand: command === "show running-config" ? "auto-detected running-config" : "auto-detected",
        startLine: 1,
        lines: [],
        parsed: false,
        parseStatus: "empty",
        parserVersion: vendor === "generic" ? "generic@1" : "auto@1",
        totalLines: 0,
        recognizedLines: 0,
        ignoredLines: 0,
        malformedLines: 0,
        unrecognizedLines: 0,
        coveragePercent: 0,
        missingEvidence: [],
        recommendedFollowUpCommands: [],
        parser: vendor === "generic" ? "generic" : "auto"
      };
    }

    if (current) {
      current.lines.push({
        device: current.device,
        command: current.command,
        line: lineNumber,
        text,
        normalizedText: text.trim()
      });
    }
  });

  if (current) blocks.push(current);
  return blocks.map(block => ({
    ...block,
    vendor: block.vendor === "generic" ? detectVendor(block.lines.map(line => line.text).join("\n")) : block.vendor
  }));
}

export function detectHostname(input: string): string | null {
  return input.match(/^hostname\s+([A-Za-z0-9_.-]+)/im)?.[1]
    ?? input.match(/^([A-Za-z0-9_.:-]{2,96})(?:\([^)]+\))?[#>]/m)?.[1]
    ?? null;
}

function sniffCommand(input: string): CommandType {
  if (/Protocol\s+Address|Internet\s+\d+\.\d+\.\d+\.\d+/i.test(input)) return "show ip arp";
  // Check configuration signatures before broad operational-table keywords.
  // Running configuration frequently includes words such as "static" and MAC
  // addresses, neither of which make it a MAC address-table command.
  if (/^\s*(?:version\s+\S+|hostname\s+\S+|ip dhcp pool\s+\S+|interface\s+\S+|vrf definition\s+\S+|router omp)\b/im.test(input)) return "show running-config";
  if (/^(?:Mac Address Table|Vlan\s+Mac Address)\b/im.test(input)) return "show mac address-table";
  if (/IP address\s+Client-ID|Bindings from all pools/i.test(input)) return "show ip dhcp binding";
  if (/Interface\s+IP-Address\s+OK\?/i.test(input)) return "show ip interface brief";
  if (/Port\s+Name\s+Status\s+Vlan/i.test(input)) return "show interfaces status";
  if (/Interface\s+Status\s+Protocol\s+Description/i.test(input)) return "show interfaces description";
  if (/Port\s+Mode\s+Encapsulation\s+Status\s+Native vlan/i.test(input)) return "show interfaces trunk";
  if (/Switchport:\s+(?:Enabled|Disabled)/i.test(input)) return "show interfaces switchport";
  if (/%[A-Z0-9_]+-\d-/i.test(input)) return "show logging";
  return "unknown";
}

export function makeEvidence(block: CommandBlock, line: Evidence): Evidence {
  return {
    device: block.device,
    command: block.command,
    line: line.line,
    text: line.text,
    sourceFile: line.sourceFile,
    normalizedText: line.normalizedText ?? line.text.trim(),
    collectedAt: line.collectedAt,
    deviceTimestamp: line.deviceTimestamp,
    ageSeconds: line.ageSeconds,
    freshness: line.freshness,
    scope: {
      deviceId: block.device,
      hostname: block.device,
      vendor: block.vendor,
      sourceCommand: block.command,
      observedAt: line.deviceTimestamp,
      sourceAgeSeconds: line.ageSeconds
    }
  };
}
