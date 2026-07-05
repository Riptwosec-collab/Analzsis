import { describe, expect, it } from "vitest";
import { analyzeCli, parseCli } from "@/parsers";
import { normalizeCommand } from "@/parsers/detector/command-detector";
import { SAMPLE_DATA } from "@/constants/sample-data";
import { calculateSubnet } from "@/utils/ip";
import { normalizeMac } from "@/utils/mac";

const LEGACY_SWITCH_CONFIG = `LAB-SW01#sh run
version 12.2
hostname LAB-SW01
service password-encryption
ip dhcp snooping vlan 1-3,45
ip dhcp snooping
spanning-tree mode pvst
interface Port-channel1
 switchport mode trunk
 ip dhcp snooping trust
!
interface FastEthernet0/1
 description APP-SERVER,10.10.7.6
 switchport access vlan 44
 switchport mode access
 spanning-tree portfast
 no shutdown
!
interface FastEthernet0/10
 description UNUSED-UPLINK
 switchport mode trunk
 shutdown
!
interface GigabitEthernet0/1
 description UPLINK-CORE
 switchport mode trunk
 channel-group 1 mode on
 ip dhcp snooping trust
!
interface Vlan1
 ip address 10.10.253.1 255.255.255.0
!
access-list 10 remark Monitoring sources
access-list 10 permit 10.1.1.0 0.0.0.255
no ip http server
logging 10.1.1.20
`;

const SDWAN_ROUTER_CONFIG = `LAB-RT01#show running-config
version 17.15
hostname LAB-RT01
vrf definition CORP
 description Corporate Users
 address-family ipv4
 exit-address-family
!
vrf definition TEST
 description Test VRF
 address-family ipv4
 exit-address-family
!
license udi pid C8200-1N-4T sn REDACTED123
endpoint-tracker TRACK_PUBLIC
 endpoint-ip 1.1.1.1
 tracker-type interface
!
interface Loopback0
 vrf forwarding CORP
 ip address 10.244.2.3 255.255.255.255
!
interface Tunnel0
 ip unnumbered GigabitEthernet0/0/0
 tunnel source GigabitEthernet0/0/0
 tunnel mode sdwan
!
interface GigabitEthernet0/0/0
 description INTERNET
 ip address dhcp client-id GigabitEthernet0/0/0
 ip nat outside
 endpoint-tracker TRACK_PUBLIC
 service-policy output WAN-SHAPE
!
interface GigabitEthernet0/0/3
 description LAN-TO-CORE
 vrf forwarding CORP
 ip address 10.10.253.222 255.255.255.0
!
router omp
ip route 0.0.0.0 0.0.0.0 10.15.5.133
ip route vrf CORP 10.10.1.0 255.255.255.0 10.10.253.30
`;

const DHCP_RESERVATION_FRAGMENT = `ip dhcp pool 10.10.2.51
 host 10.10.2.51 255.255.255.0
 client-identifier 016c.3be5.2df0.d9
 default-router 10.10.2.224
 dns-server 10.20.100.2 10.26.100.2
!
ip dhcp pool 10.10.2.1
 client-identifier 016c.3be5.2df0.d9
 default-router 10.10.2.224
!
ip dhcp pool 10.10.2.22
 host 10.10.2.22 255.255.255.0
 client-identifier 0110.604b.6af8.7c
 default-router 10.10.1.224
 update arp
!
ip dhcp pool USERS
 network 10.10.50.0 255.255.255.0
 default-router 10.10.50.1
 dns-server 10.20.100.2
`;

describe("network utilities", () => {
  it("normalizes MAC and DHCP client identifier formats", () => {
    expect(normalizeMac("6c3b.e524.91f8")).toBe("6c:3b:e5:24:91:f8");
    expect(normalizeMac("016c.3be5.2491.f8")).toBe("6c:3b:e5:24:91:f8");
  });

  it("calculates subnets", () => {
    expect(calculateSubnet("10.10.10.1", 24)?.cidr).toBe("10.10.10.0/24");
    expect(calculateSubnet("10.10.10.1", 24)?.totalUsable).toBe(254);
  });

  it("normalizes common abbreviated Cisco commands", () => {
    expect(normalizeCommand("sh run")).toBe("show running-config");
    expect(normalizeCommand("sh int status")).toBe("show interfaces status");
    expect(normalizeCommand("sh ip int br")).toBe("show ip interface brief");
    expect(normalizeCommand("sh mac add")).toBe("show mac address-table");
  });
});

describe("parser", () => {
  it("detects devices and core commands from the sample bundle", () => {
    const parsed = parseCli(SAMPLE_DATA);
    expect(parsed.devices[0]?.hostname).toBe("CORE-SW01");
    expect(parsed.arp.length).toBeGreaterThanOrEqual(4);
    expect(parsed.macTable.length).toBeGreaterThanOrEqual(5);
    expect(parsed.dhcpBindings.length).toBeGreaterThanOrEqual(2);
  });

  it("parses legacy switch descriptions, VLAN modes, trust, channels, and exact shutdown state", () => {
    const parsed = parseCli(LEGACY_SWITCH_CONFIG);
    const access = parsed.interfaces.find(item => item.name === "Fa0/1");
    const disabled = parsed.interfaces.find(item => item.name === "Fa0/10");
    const uplink = parsed.interfaces.find(item => item.name === "Gi0/1");

    expect(parsed.devices.some(item => item.hostname === "LAB-SW01" && item.role === "Layer 3 Switch")).toBe(true);
    expect(access?.description).toBe("APP-SERVER,10.10.7.6");
    expect(access?.accessVlan).toBe(44);
    expect(access?.portfast).toBe(true);
    expect(access?.shutdown).toBe(false);
    expect(access?.status).toBe("enabled");
    expect(disabled?.shutdown).toBe(true);
    expect(disabled?.status).toBe("disabled");
    expect(uplink?.channelGroup).toBe("1");
    expect(uplink?.dhcpSnoopingTrust).toBe(true);
    expect(parsed.accessLists.some(item => item.name === "10" && item.action === "permit")).toBe(true);
  });

  it("parses IOS XE SD-WAN VRFs, descriptions, DHCP WAN, tunnels, policies, and static routes", () => {
    const parsed = parseCli(SDWAN_ROUTER_CONFIG);
    const wan = parsed.interfaces.find(item => item.name === "Gi0/0/0");
    const lan = parsed.interfaces.find(item => item.name === "Gi0/0/3");

    expect(parsed.devices.some(item => item.model === "C8200-1N-4T" && item.role === "SD-WAN Router")).toBe(true);
    expect(parsed.vrfs.find(item => item.name === "CORP")?.description).toBe("Corporate Users");
    expect(wan?.dhcpClient).toBe(true);
    expect(wan?.natRole).toBe("outside");
    expect(wan?.servicePolicies).toContain("output:WAN-SHAPE");
    expect(lan?.vrf).toBe("CORP");
    expect(parsed.staticRoutes.length).toBe(2);
    expect(parsed.configFeatures.some(item => item.category === "SD-WAN" && item.feature === "OMP")).toBe(true);
  });

  it("parses config fragments and detects duplicate reservations, incomplete pools, and gateway mismatch", () => {
    const result = analyzeCli(DHCP_RESERVATION_FRAGMENT);
    expect(result.dhcpPools).toHaveLength(4);
    expect(result.dhcpPools.find(item => item.name === "10.10.2.51")?.hardwareAddress).toBe("6c:3b:e5:2d:f0:d9");
    expect(result.dhcpPools.find(item => item.name === "10.10.2.22")?.updateArp).toBe(true);
    expect(result.findings.some(item => item.title === "DHCP client identifier assigned more than once")).toBe(true);
    expect(result.findings.some(item => item.title === "Incomplete DHCP pool")).toBe(true);
    expect(result.findings.some(item => item.title === "DHCP default gateway is outside the pool subnet")).toBe(true);
    expect(result.parserCoverage.totalMeaningfulLines).toBeGreaterThan(0);
  });

  it("normalizes common command abbreviations and records coverage", () => {
    const parsed = parseCli([
      "CORE-SW01#sh ip int br",
      "Interface              IP-Address      OK? Method Status                Protocol",
      "Vlan10                 10.10.10.1      YES manual up                    up",
      "CORE-SW01#sh run",
      "interface Vlan20",
      " ip address 10.10.20.1 255.255.255.0"
    ].join("\n"));
    expect(parsed.commandBlocks.map(block => block.command)).toContain("show ip interface brief");
    expect(parsed.commandBlocks.map(block => block.command)).toContain("show running-config");
    expect(parsed.commandBlocks.every(block => block.parseStatus === "parsed")).toBe(true);
    expect(parsed.commandBlocks.every(block => (block.coveragePercent ?? 0) > 0)).toBe(true);
  });

  it("keeps unsupported commands as evidence with follow-up commands", () => {
    const parsed = parseCli([
      "CORE-SW01#show crypto isakmp sa",
      "IPv4 Crypto ISAKMP SA",
      "dst             src             state          conn-id status"
    ].join("\n"));
    const block = parsed.commandBlocks[0];
    expect(block.parsed).toBe(false);
    expect(block.parseStatus).toBe("unsupported");
    expect(block.lines.length).toBeGreaterThan(0);
    expect(block.recommendedFollowUpCommands?.length).toBeGreaterThan(0);
    expect(parsed.parserWarnings[0]?.description).toContain("Coverage");
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

  it("does not classify addresses inside a DHCP dynamic pool as likely free without lease evidence", () => {
    const result = analyzeCli(SAMPLE_DATA);
    const poolCandidate = result.ipInventory.find(item => item.ip === "10.10.10.30");
    expect(poolCandidate?.status).toBe("Unknown");
    expect(poolCandidate?.sources).toContain("DHCP Pool range");
    expect(result.freeIps.some(item => item.ip === "10.10.10.30")).toBe(false);
  });
});
