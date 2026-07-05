export function normalizeInterface(input: string | undefined): string | undefined {
  if (!input) return undefined;
  return input
    .replace(/^GigabitEthernet/i, "Gi")
    .replace(/^TenGigabitEthernet/i, "Te")
    .replace(/^TwentyFiveGigE/i, "Twe")
    .replace(/^FortyGigabitEthernet/i, "Fo")
    .replace(/^HundredGigE/i, "Hu")
    .replace(/^FastEthernet/i, "Fa")
    .replace(/^Ethernet/i, "Eth")
    .replace(/^Port-channel/i, "Po")
    .replace(/^Vlan/i, "Vlan");
}
