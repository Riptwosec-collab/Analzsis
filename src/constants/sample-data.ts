export const SAMPLE_DATA = `! Demo Data - Cisco core/access sample for NetScope Analyzer
CORE-SW01#show ip interface brief
Interface              IP-Address      OK? Method Status                Protocol
Vlan10                 10.10.10.1      YES manual up                    up
Vlan20                 10.10.20.1      YES manual up                    up
Gi1/0/1                unassigned      YES unset  up                    up
Gi1/0/24               unassigned      YES unset  up                    up

CORE-SW01#show ip arp
Protocol  Address          Age (min)  Hardware Addr   Type   Interface
Internet  10.10.10.10             2   6c3b.e524.91f8  ARPA   Vlan10
Internet  10.10.10.20             4   0011.2233.4455  ARPA   Vlan10
Internet  10.10.20.15             1   aaaa.bbbb.cccc  ARPA   Vlan20
Internet  10.10.20.15             0   dddd.eeee.ffff  ARPA   Vlan20

CORE-SW01#show mac address-table
Vlan    Mac Address       Type        Ports
----    -----------       --------    -----
10      6c3b.e524.91f8    DYNAMIC     Gi1/0/10
10      0011.2233.4455    DYNAMIC     Gi1/0/11
20      aaaa.bbbb.cccc    DYNAMIC     Gi1/0/12
20      dddd.eeee.ffff    DYNAMIC     Gi1/0/13
20      6c3b.e524.91f8    DYNAMIC     Gi1/0/24

CORE-SW01#show ip dhcp binding
IP address      Client-ID/              Lease expiration        Type       State      Interface
                Hardware address/
10.10.10.10     016c.3be5.2491.f8       Jul 05 2026 10:30 AM   Automatic  Active     Vlan10
10.10.10.20     0100.1122.3344.55       Jul 05 2026 10:31 AM   Automatic  Active     Vlan10

CORE-SW01#show ip dhcp pool
Pool VLAN10 :
 Utilization mark (high/low)    : 95 / 0
 Subnet size (first/next)       : 0 / 0
 Total addresses                : 254
 Leased addresses               : 238
 Pending event                  : none

CORE-SW01#show running-config
hostname CORE-SW01
ip dhcp snooping
ip arp inspection vlan 10,20
snmp-server community public RO
interface Gi1/0/10
 switchport mode access
 switchport access vlan 10
 switchport port-security
interface Gi1/0/24
 switchport mode trunk
interface Vlan10
 ip address 10.10.10.1 255.255.255.0
interface Vlan20
 ip address 10.10.20.1 255.255.255.0
ip dhcp pool VLAN10
 network 10.10.10.0 255.255.255.0
 default-router 10.10.10.1
 dns-server 8.8.8.8

CORE-SW01#show logging
%SW_MATM-4-MACFLAP_NOTIF: Host 6c3b.e524.91f8 in vlan 20 is flapping between port Gi1/0/10 and port Gi1/0/24
%PM-4-ERR_DISABLE: psecure-violation error detected on Gi1/0/13, putting Gi1/0/13 in err-disable state
%SW_DAI-4-DHCP_SNOOPING_DENY: 2 Invalid ARPs on Gi1/0/12, vlan 20.([aaaa.bbbb.cccc/10.10.20.15/0000.0000.0000/10.10.20.1/12:02:03 UTC])

CORE-SW01#show cdp neighbors detail
Device ID: ACCESS-SW02
Interface: GigabitEthernet1/0/24,  Port ID (outgoing port): GigabitEthernet1/0/48
Platform: cisco WS-C2960X, Capabilities: Switch IGMP
`;
