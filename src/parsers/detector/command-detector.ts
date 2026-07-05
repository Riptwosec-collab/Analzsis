import type { CommandBlock, CommandType, Evidence, Vendor } from "@/types/network";

const commandPatterns: Array<[CommandType, RegExp]> = [
  ["show ip arp", /^(show\s+ip\s+arp|show\s+arp)$/i],
  ["show arp", /^show\s+arp$/i],
  ["show mac address-table", /^show\s+mac\s+address-table/i],
  ["show ip dhcp binding", /^show\s+ip\s+dhcp\s+binding/i],
  ["show ip dhcp pool", /^show\s+ip\s+dhcp\s+pool/i],
  ["show vlan brief", /^show\s+vlan(?:\s+brief)?$/i],
  ["show interfaces status", /^show\s+interfaces\s+status/i],
  ["show interfaces switchport", /^show\s+interfaces\s+switchport/i],
  ["show interfaces trunk", /^show\s+interfaces\s+trunk/i],
  ["show ip interface brief", /^show\s+ip\s+interface\s+brief/i],
  ["show running-config", /^(show\s+running-config|show\s+run|running-config)/i],
  ["show logging", /^show\s+log(?:ging)?/i],
  ["show cdp neighbors detail", /^show\s+cdp\s+neighbors\s+detail/i],
  ["show lldp neighbors detail", /^show\s+lldp\s+neighbors\s+detail/i]
];

export function normalizeCommand(raw: string): CommandType {
  const command = raw.trim().replace(/\s+/g, " ");
  return commandPatterns.find(([, pattern]) => pattern.test(command))?.[0] ?? "unknown";
}

export function detectVendor(text: string): Vendor {
  if (/FortiGate|config firewall|set allowaccess|diagnose /i.test(text)) return "fortigate";
  if (/MikroTik|\/ip address|RouterOS/i.test(text)) return "mikrotik";
  if (/Aruba|ProCurve|show\s+lldp\s+info/i.test(text)) return "aruba";
  if (/JUNOS|set interfaces|show ethernet-switching/i.test(text)) return "juniper";
  if (/Cisco|IOS|NX-OS|show ip |show mac address-table|interface Vlan/i.test(text)) return "cisco";
  return "generic";
}

export function detectCommandBlocks(input: string): CommandBlock[] {
  const lines = input.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const blocks: CommandBlock[] = [];
  let current: CommandBlock | null = null;

  lines.forEach((text, index) => {
    const lineNumber = index + 1;
    const prompt = text.match(/^([A-Za-z0-9_.:-]{2,64})(?:\([^)]+\))?[#>]\s*(.+)$/);
    const isCommand = prompt && /^(show|sh|display|diagnose|get|config|\/)/i.test(prompt[2].trim());

    if (prompt && isCommand) {
      if (current) blocks.push(current);
      const rawCommand = prompt[2].trim().replace(/^sh\b/i, "show");
      const command = normalizeCommand(rawCommand);
      current = {
        id: `${lineNumber}-${prompt[1]}-${command}`,
        device: prompt[1],
        vendor: detectVendor(text),
        command,
        rawCommand,
        startLine: lineNumber,
        lines: [],
        parsed: false,
        parser: command === "unknown" ? "unsupported" : "cisco-ios"
      };
      return;
    }

    if (!current && text.trim()) {
      const vendor = detectVendor(input);
      current = {
        id: `1-imported-cli`,
        device: detectHostname(input) ?? "DEVICE",
        vendor,
        command: sniffCommand(input),
        rawCommand: "auto-detected",
        startLine: 1,
        lines: [],
        parsed: false,
        parser: vendor === "generic" ? "generic" : "auto"
      };
    }

    if (current) {
      current.lines.push({
        device: current.device,
        command: current.command,
        line: lineNumber,
        text
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
    ?? input.match(/^([A-Za-z0-9_.:-]{2,64})(?:\([^)]+\))?[#>]/m)?.[1]
    ?? null;
}

function sniffCommand(input: string): CommandType {
  if (/Protocol\s+Address|Internet\s+\d+\.\d+\.\d+\.\d+/i.test(input)) return "show ip arp";
  if (/Mac Address Table|Vlan\s+Mac Address|DYNAMIC|STATIC/i.test(input)) return "show mac address-table";
  if (/IP address\s+Client-ID|Bindings from all pools/i.test(input)) return "show ip dhcp binding";
  if (/Interface\s+IP-Address\s+OK\?/i.test(input)) return "show ip interface brief";
  if (/Port\s+Name\s+Status\s+Vlan/i.test(input)) return "show interfaces status";
  if (/ip dhcp pool|interface\s+\S+/i.test(input)) return "show running-config";
  if (/%[A-Z0-9_]+-\d-/i.test(input)) return "show logging";
  return "unknown";
}

export function makeEvidence(block: CommandBlock, line: Evidence): Evidence {
  return {
    device: block.device,
    command: block.command,
    line: line.line,
    text: line.text
  };
}
