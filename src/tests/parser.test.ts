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

const DHCP_DEEP_ANALYSIS_FRAGMENT = `version 17.3
hostname DHCP-CORE
ip dhcp pool USERS
 network 10.60.0.0 255.255.255.0
 default-router 10.60.0.1
 dns-server 10.60.0.53
 domain-name corp.example
 option 148 ascii "controller=10.60.0.10"
 lease 0 1
!
ip dhcp pool USERS-OVERLAP
 network 10.60.0.128 255.255.255.128
 default-router 10.60.0.1
!
ip dhcp pool PRINTER-150
 host 10.60.0.150 255.255.255.0
 hardware-address 0011.2233.4455
 default-router 10.60.0.1
!
interface Vlan60
 ip address 10.60.0.1 255.255.255.0
 ip helper-address 10.60.253.201
 ip helper-address 10.60.253.202
`;

const LAYER2_OPERATIONAL_FRAGMENT = `CORE-SW01#show interfaces counters errors
Port        Align-Err    FCS-Err   Xmit-Err    Rcv-Err  UnderSize OutDiscards
Gi1/0/2             0          3          0          1          0           8
CORE-SW01#show spanning-tree
Interface           Role Sts Cost      Prio.Nbr Type
Gi1/0/1             Desg FWD 4         128.1    P2p
Gi1/0/2             Altn BLK 4         128.2    P2p
CORE-SW01#show etherchannel summary
Group  Port-channel  Protocol    Ports
1      Po1(SU)       LACP        Gi1/0/1(P) Gi1/0/2(P)
`;

describe("network utilities", () => {
  it("normalizes MAC and DHCP client identifier formats", () => {
    expect(normalizeMac("6c3b.e524.91f8")).toBe("6c:3b:e5:24:91:f8");
    expect(normalizeMac("016c.3be5.2491.f8")).toBe("6c:3b:e5:24:91:f8");
    expect(normalizeMac("0100.6677.8899.aabb")).toBe("66:77:88:99:aa:bb");
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

  it("parses DHCP lease, domain, options, helper addresses, and scoped dynamic-pool risks", () => {
    const result = analyzeCli(DHCP_DEEP_ANALYSIS_FRAGMENT);
    const users = result.dhcpPools.find(item => item.name === "USERS");
    const svi = result.interfaces.find(item => item.name === "Vlan60");

    expect(users?.lease).toBe("0 1");
    expect(users?.leaseSeconds).toBe(3600);
    expect(users?.domainName).toBe("corp.example");
    expect(users?.options).toEqual([{ code: 148, format: "ascii", value: '"controller=10.60.0.10"' }]);
    expect(svi?.helperAddresses).toEqual(["10.60.253.201", "10.60.253.202"]);
    expect(result.findings.some(item => item.title === "Dynamic DHCP pools overlap")).toBe(true);
    expect(result.findings.some(item => item.title === "DHCP reservation is inside a dynamic pool")).toBe(true);
  });

  it("parses Layer 2 operational counters, STP state, and EtherChannel members", () => {
    const result = analyzeCli(LAYER2_OPERATIONAL_FRAGMENT);
    const counters = result.interfaces.find(item => item.name === "Gi1/0/2" && item.crcErrors !== undefined);
    const blocked = result.interfaces.find(item => item.name === "Gi1/0/2" && item.stpState !== undefined);
    const member = result.interfaces.find(item => item.name === "Gi1/0/1" && item.etherChannelState !== undefined);

    expect(counters).toMatchObject({ crcErrors: 3, inputErrors: 1, outputDrops: 8 });
    expect(blocked).toMatchObject({ stpRole: "Altn", stpState: "BLK" });
    expect(member).toMatchObject({ channelGroup: "1", channelMode: "LACP", etherChannelState: "SU/P" });
    expect(result.findings.some(item => item.title === "Interface error counters detected" && item.target === "Gi1/0/2")).toBe(true);
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
    expect(parsed.commandBlocks.every(block => block.parseStatus === "fully-parsed")).toBe(true);
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

  it("detects a raw IOS running configuration before broad static or MAC keywords", () => {
    const parsed = parseCli([
      "! Last configuration change at 10:00:00 UTC",
      "version 17.3",
      "hostname CORE-C9500",
      "ip dhcp pool USERS",
      " network 10.77.0.0 255.255.255.0",
      "interface Vlan77",
      " ip address 10.77.0.1 255.255.255.0",
      "arp 10.77.0.10 0011.2233.4455 ARPA",
      "ip route 10.90.0.0 255.255.0.0 10.77.0.254"
    ].join("\n"));

    expect(parsed.commandBlocks[0]?.command).toBe("show running-config");
    expect(parsed.commandBlocks[0]?.vendor).toBe("cisco");
    expect(parsed.dhcpPools.some(item => item.name === "USERS")).toBe(true);
    expect(parsed.interfaces.some(item => item.name === "Vlan77")).toBe(true);
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

  it("does not enumerate addresses inside a DHCP dynamic pool as unknown or likely free without lease evidence", () => {
    const result = analyzeCli(SAMPLE_DATA);
    const poolCandidate = result.ipInventory.find(item => item.ip === "10.10.10.30");
    expect(poolCandidate?.status).toBe("Not Free - In DHCP Pool");
    expect(poolCandidate?.sources).toContain("DHCP Pool range");
    expect(result.freeIps.some(item => item.ip === "10.10.10.30")).toBe(false);
  });

  it("parses DHCP exclusions, conflicts, snooping bindings, and source bindings into distinct IP states", () => {
    const result = analyzeCli([
      "CORE-SW01#show running-config",
      "ip dhcp excluded-address 10.50.50.1 10.50.50.10",
      "interface Vlan50",
      " ip address 10.50.50.1 255.255.255.0",
      "!",
      "ip dhcp pool USERS",
      " network 10.50.50.0 255.255.255.0",
      " default-router 10.50.50.1",
      " dns-server 10.20.100.2",
      "CORE-SW01#show ip dhcp conflict",
      "IP address        Detection method   Detection time",
      "10.50.50.20      Gratuitous ARP     Jan 01 2026 10:00 AM",
      "CORE-SW01#show ip dhcp snooping binding",
      "MacAddress          IpAddress        Lease(sec) Type           VLAN  Interface",
      "0011.2233.4455      10.50.50.30      86400      dhcp-snooping  50    Gi1/0/5",
      "CORE-SW01#show ip source binding",
      "MacAddress          IpAddress        Lease(sec) Type           VLAN  Interface",
      "0011.2233.4466      10.50.50.31      86400      static         50    Gi1/0/6",
      "CORE-SW01#show ip arp",
      "Protocol  Address          Age (min)  Hardware Addr   Type   Interface",
      "Internet  10.50.50.30             2   0011.2233.4455  ARPA   Vlan50",
      "CORE-SW01#show mac address-table",
      "Vlan    Mac Address       Type        Ports",
      "  50    0011.2233.4455    DYNAMIC     Gi1/0/5",
      "  50    0011.2233.4466    DYNAMIC     Gi1/0/6"
    ].join("\n"));

    expect(result.dhcpExcludedRanges).toHaveLength(1);
    expect(result.dhcpConflicts).toHaveLength(1);
    expect(result.dhcpBindings.some(item => item.ip === "10.50.50.30" && item.mac === "00:11:22:33:44:55")).toBe(true);
    expect(result.dhcpBindings.some(item => item.ip === "10.50.50.31" && item.type === "Source Binding")).toBe(true);

    expect(result.ipInventory.find(item => item.ip === "10.50.50.2")?.status).toBe("Excluded");
    expect(result.ipInventory.find(item => item.ip === "10.50.50.20")?.sources).toContain("DHCP Conflict");
    expect(result.ipInventory.find(item => item.ip === "10.50.50.30")?.status).toBe("Used");
    expect(result.ipInventory.find(item => item.ip === "10.50.50.31")?.status).toBe("Used");
    expect(result.ipInventory.find(item => item.ip === "10.50.50.40")?.status).toBe("Not Free - In DHCP Pool");
    expect(result.freeIps.some(item => item.ip === "10.50.50.40")).toBe(false);
  });

  it("marks DHCP reservation host addresses as reserved", () => {
    const result = analyzeCli(DHCP_RESERVATION_FRAGMENT);
    const reservation = result.ipInventory.find(item => item.ip === "10.10.2.51");
    expect(reservation?.status).toBe("Reserved");
    expect(reservation?.sources).toContain("DHCP Reservation");
    expect(reservation?.statusReason).toContain("DHCP reservation");
    expect(reservation?.relatedPoolNames).toContain("10.10.2.51");
    expect(result.freeIps.some(item => item.ip === "10.10.2.51")).toBe(false);
  });

  it("marks config-only subnet gaps outside DHCP pools as low-confidence likely free candidates", () => {
    const result = analyzeCli([
      "CORE-SW01#show running-config",
      "interface Vlan30",
      " ip address 10.30.30.1 255.255.255.0"
    ].join("\n"));
    const candidate = result.ipInventory.find(item => item.ip === "10.30.30.10");
    expect(candidate?.status).toBe("Likely Free");
    expect(candidate?.confidence).toBe(35);
    expect(candidate?.sources).toEqual(expect.arrayContaining(["Config-only candidate", "Outside DHCP Pool"]));
    expect(candidate?.missingSources).toEqual(expect.arrayContaining(["ARP", "DHCP Binding", "MAC Table"]));
    expect(result.freeIps.some(item => item.ip === "10.30.30.10")).toBe(true);
  });

  it("keeps evidence-backed unresolved log IPs as unknown", () => {
    const result = analyzeCli([
      "CORE-SW01#show running-config",
      "interface Vlan40",
      " ip address 10.40.40.1 255.255.255.0",
      "CORE-SW01#show logging",
      "%SW_DAI-4-DHCP_SNOOPING_DENY: 1 Invalid ARPs on Gi1/0/14, vlan 40.([aaaa.bbbb.cccc/10.40.40.25/0000.0000.0000/10.40.40.1/12:02:03 UTC])"
    ].join("\n"));
    const logIp = result.ipInventory.find(item => item.ip === "10.40.40.25");
    expect(logIp?.status).toBe("Unknown");
    expect(logIp?.sources).toContain("Log/Security Event");
    expect(logIp?.missingSources).toEqual(expect.arrayContaining(["ARP", "DHCP Binding", "MAC Table"]));
    expect(result.freeIps.some(item => item.ip === "10.40.40.25")).toBe(false);
    expect(result.freeIps.length).toBeGreaterThan(0);
  });

  it("explains likely free addresses only after required evidence is present", () => {
    const result = analyzeCli(SAMPLE_DATA);
    const freeCandidate = result.ipInventory.find(item => item.ip === "10.10.20.30");
    expect(freeCandidate?.status).toBe("Likely Free");
    expect(freeCandidate?.missingSources ?? []).toHaveLength(0);
    expect(freeCandidate?.checkedSources).toEqual(expect.arrayContaining(["ARP", "DHCP Binding", "MAC Table"]));
    expect(freeCandidate?.statusReason).toContain("No ARP");
  });

  it("keeps identical IP and MAC evidence separate across device and VRF scopes", () => {
    const result = analyzeCli([
      "EDGE-A#show running-config",
      "hostname EDGE-A",
      "vrf definition BLUE",
      " address-family ipv4",
      " exit-address-family",
      "interface Vlan10",
      " vrf forwarding BLUE",
      " ip address 10.90.10.1 255.255.255.0",
      "EDGE-A#show ip arp",
      "Protocol  Address          Age (min)  Hardware Addr   Type   Interface",
      "Internet  10.90.10.20            2   0011.2233.4455  ARPA   Vlan10",
      "EDGE-A#show mac address-table",
      "Vlan    Mac Address       Type        Ports",
      "  10    0011.2233.4455    DYNAMIC     Gi1/0/5",
      "EDGE-B#show running-config",
      "hostname EDGE-B",
      "interface Vlan10",
      " ip address 10.90.10.1 255.255.255.0",
      "EDGE-B#show ip arp",
      "Protocol  Address          Age (min)  Hardware Addr   Type   Interface",
      "Internet  10.90.10.20            2   0011.2233.4455  ARPA   Vlan10",
      "EDGE-B#show mac address-table",
      "Vlan    Mac Address       Type        Ports",
      "  10    0011.2233.4455    DYNAMIC     Gi1/0/9"
    ].join("\n"));

    const sharedIp = result.ipInventory.filter(item => item.ip === "10.90.10.20");
    expect(sharedIp).toHaveLength(2);
    expect(new Set(sharedIp.map(item => item.id)).size).toBe(2);
    expect(result.findings.some(item => item.title === "Duplicate IP suspected")).toBe(false);
    expect(result.findings.some(item => item.title === "MAC appears on multiple ports")).toBe(false);
    expect(result.entityGraph.nodes.filter(item => item.type === "ip" && item.label === "10.90.10.20")).toHaveLength(2);
  });

  it("reports partial parser coverage from unrecognized lines instead of treating every line as parsed", () => {
    const parsed = parseCli([
      "CORE-SW01#show running-config",
      "interface Vlan70",
      " ip address 10.70.70.1 255.255.255.0",
      " unsupported-feature value-that-has-no-parser"
    ].join("\n"));
    const block = parsed.commandBlocks[0];

    expect(block.parseStatus).toBe("partially-parsed");
    expect(block.recognizedLineNumbers).toEqual(expect.arrayContaining([2, 3]));
    expect(block.unrecognizedLineNumbers).toContain(4);
    expect(block.coveragePercent).toBeLessThan(100);
    expect(parsed.parserWarnings.some(item => item.title === "Parser coverage incomplete")).toBe(true);
  });

  it("explains ARP and DHCP MAC contradictions with a confidence breakdown", () => {
    const result = analyzeCli([
      "CORE-SW01#show ip arp",
      "Protocol  Address          Age (min)  Hardware Addr   Type   Interface",
      "Internet  10.99.99.20            2   0011.2233.4455  ARPA   Vlan99",
      "CORE-SW01#show ip dhcp binding",
      "10.99.99.20    0100.6677.8899.aabb   Infinite   Automatic"
    ].join("\n"));
    const row = result.ipInventory.find(item => item.ip === "10.99.99.20");

    expect(row?.contradictions.some(item => item.includes("ARP and DHCP binding"))).toBe(true);
    expect(row?.confidenceBreakdown.contradictionPenalty).toBeGreaterThan(0);
    expect(row?.confidenceBreakdown.finalScore).toBe(row?.confidence);
  });
});
