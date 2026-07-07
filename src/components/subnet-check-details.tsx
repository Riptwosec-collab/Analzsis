"use client";

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAnalysisStore } from "@/store/analysis-store";
import type {
  AnalysisResult,
  CommandType,
  Evidence,
  Finding,
  Severity,
  SubnetRecord
} from "@/types/network";
import { ipInSubnet, ipToNumber, prefixToMask } from "@/utils/ip";

interface SubnetCheckDetailsProps {
  subnet: SubnetRecord;
  language: "en" | "th";
}

type CheckState = "passed" | "found" | "warning" | "missing" | "not-applicable";

type CommandScope = "subnet" | "layer2" | "security" | "device";

interface CheckItem {
  id: string;
  title: string;
  state: CheckState;
  summary: string;
  details: string[];
  sources: string[];
  evidence: Evidence[];
}

interface CommandCatalogItem {
  command: CommandType;
  category: string;
  scope: CommandScope;
  purpose: string;
}

const COMMAND_CATALOG: CommandCatalogItem[] = [
  { command: "show ip arp", category: "IP", scope: "subnet", purpose: "จับคู่ IP, MAC, VLAN และ Interface จาก ARP" },
  { command: "show arp", category: "IP", scope: "subnet", purpose: "ARP รูปแบบทางเลือกของอุปกรณ์" },
  { command: "show mac address-table", category: "Layer 2", scope: "layer2", purpose: "หา MAC ว่าอยู่ VLAN และ Port ใด" },
  { command: "show ip dhcp binding", category: "DHCP", scope: "subnet", purpose: "ตรวจ DHCP Lease และ Client Identifier" },
  { command: "show ip dhcp pool", category: "DHCP", scope: "subnet", purpose: "ตรวจ Scope, Usage, Gateway และ DNS" },
  { command: "show ip dhcp conflict", category: "DHCP", scope: "subnet", purpose: "ตรวจ IP Conflict ที่ DHCP Server พบ" },
  { command: "show ip dhcp snooping", category: "Security", scope: "security", purpose: "ตรวจสถานะ DHCP Snooping และ Trusted Port" },
  { command: "show ip dhcp snooping binding", category: "Security", scope: "subnet", purpose: "ตรวจ Binding IP-MAC-VLAN-Port จาก Snooping" },
  { command: "show ip arp inspection", category: "Security", scope: "security", purpose: "ตรวจ Dynamic ARP Inspection และ VLAN ที่เปิดใช้" },
  { command: "show ip source binding", category: "Security", scope: "subnet", purpose: "ตรวจ IP Source Guard Binding" },
  { command: "show vlan brief", category: "Layer 2", scope: "layer2", purpose: "ตรวจ VLAN Database และสมาชิกพอร์ต" },
  { command: "show interfaces status", category: "Interface", scope: "layer2", purpose: "ตรวจสถานะ Port, VLAN, Duplex และ Speed" },
  { command: "show interfaces description", category: "Interface", scope: "layer2", purpose: "ดึง Description และสถานะ Interface" },
  { command: "show interfaces switchport", category: "Layer 2", scope: "layer2", purpose: "ตรวจ Access/Trunk, Native, Voice และ Allowed VLAN" },
  { command: "show interfaces trunk", category: "Layer 2", scope: "layer2", purpose: "ตรวจ Trunk, Native VLAN และ VLAN ที่ผ่านได้" },
  { command: "show interfaces counters errors", category: "Health", scope: "layer2", purpose: "ตรวจ Error, Drop, CRC และปัญหา Physical" },
  { command: "show interfaces", category: "Interface", scope: "layer2", purpose: "ตรวจ Interface แบบละเอียดและ Counter" },
  { command: "show ip interface brief", category: "IP", scope: "subnet", purpose: "ตรวจ Interface/SVI, IP, Status และ Protocol" },
  { command: "show running-config", category: "Configuration", scope: "subnet", purpose: "ตรวจ Config Interface, DHCP, Route, ACL, Security และ Description" },
  { command: "show logging", category: "Events", scope: "security", purpose: "ตรวจ Deny, Conflict, Flapping, Err-disable และ Security Event" },
  { command: "show spanning-tree", category: "Layer 2", scope: "layer2", purpose: "ตรวจ STP Root, Port State และ Loop Risk" },
  { command: "show spanning-tree detail", category: "Layer 2", scope: "layer2", purpose: "ตรวจ STP Change และรายละเอียดพอร์ต" },
  { command: "show spanning-tree inconsistentports", category: "Layer 2", scope: "layer2", purpose: "ตรวจพอร์ตที่ STP Block เพราะความไม่สอดคล้อง" },
  { command: "show etherchannel summary", category: "Layer 2", scope: "layer2", purpose: "ตรวจ Port-channel และสมาชิกที่ Bundled/Suspended" },
  { command: "show port-security", category: "Security", scope: "security", purpose: "ตรวจ Port Security และ Violation" },
  { command: "show port-security interface", category: "Security", scope: "security", purpose: "ตรวจ Secure MAC และสถานะรายพอร์ต" },
  { command: "show authentication sessions", category: "Access Control", scope: "security", purpose: "ตรวจ 802.1X/MAB Session และ Authorization" },
  { command: "show dot1x all", category: "Access Control", scope: "security", purpose: "ตรวจ 802.1X Configuration และ Session" },
  { command: "show access-lists", category: "Security", scope: "security", purpose: "ตรวจ ACL Permit/Deny ที่อาจเกี่ยวข้อง" },
  { command: "show ip access-lists", category: "Security", scope: "security", purpose: "ตรวจ IPv4 ACL แบบละเอียด" },
  { command: "show cdp neighbors detail", category: "Topology", scope: "device", purpose: "ตรวจเพื่อนบ้าน Cisco และเส้นทาง Uplink" },
  { command: "show lldp neighbors detail", category: "Topology", scope: "device", purpose: "ตรวจเพื่อนบ้านแบบมาตรฐาน LLDP" },
  { command: "show version", category: "Device", scope: "device", purpose: "ตรวจรุ่น OS, Model และ Uptime" },
  { command: "show inventory", category: "Device", scope: "device", purpose: "ตรวจ Model, Serial และ Module" },
  { command: "show ip route", category: "Routing", scope: "subnet", purpose: "ตรวจ Route ของ Subnet และ Next Hop" },
  { command: "show vrf", category: "Routing", scope: "subnet", purpose: "ตรวจ VRF และ Interface ที่สังกัด" },
  { command: "show standby brief", category: "Gateway", scope: "subnet", purpose: "ตรวจ HSRP Active/Standby และ Virtual IP" },
  { command: "show vrrp brief", category: "Gateway", scope: "subnet", purpose: "ตรวจ VRRP Master/Backup และ Virtual IP" },
  { command: "show environment", category: "Health", scope: "device", purpose: "ตรวจ Power, Fan และ Temperature" },
  { command: "show processes cpu", category: "Health", scope: "device", purpose: "ตรวจ CPU Utilization" },
  { command: "show memory statistics", category: "Health", scope: "device", purpose: "ตรวจ Memory Utilization" },
  { command: "show errdisable recovery", category: "Recovery", scope: "security", purpose: "ตรวจสาเหตุและ Recovery ของ Err-disabled Port" }
];

export function SubnetCheckDetails({ subnet, language }: SubnetCheckDetailsProps) {
  const result = useAnalysisStore(state => state.result);
  const model = useMemo(
    () => result ? buildSubnetModel(subnet, result, language) : null,
    [language, result, subnet]
  );

  if (!model) return null;

  return (
    <section className="mt-4 space-y-4 rounded-xl border border-cyan-400/20 bg-slate-950/35 p-4">
      <div>
        <h3 className="cyber-brand text-sm font-semibold">
          {language === "th" ? `Audit Matrix: ${subnet.cidr}` : `Audit matrix: ${subnet.cidr}`}
        </h3>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          {language === "th"
            ? "แสดงทุกหัวข้อที่ระบบพยายามตรวจ พร้อมผลว่าเจอ ไม่เจอ มีความผิดปกติ หรือยังไม่มีคำสั่ง/หลักฐานเพียงพอ"
            : "Shows every attempted check and whether data was found, no issue was found, an anomaly exists, or command evidence is missing."}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Summary label="ARP" value={model.arp.length} />
        <Summary label="DHCP Binding" value={model.bindings.length} />
        <Summary label="MAC" value={model.relatedMacs.length} />
        <Summary label="Interface / SVI" value={model.interfaces.length} />
        <Summary label="Finding / Event" value={model.findings.length + model.logs.length} />
      </div>

      <div className="rounded-lg border border-emerald-400/20 bg-emerald-400/5 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-medium">
            {language === "th" ? "IP ที่น่าจะว่างใน Subnet นี้" : "Likely free IP candidates in this subnet"}
          </div>
          <Badge severity={model.freeCandidates.length ? "Low" : "Info"}>
            {model.freeCandidates.length}
          </Badge>
        </div>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          {language === "th"
            ? "ระบบจะแสดงเฉพาะ IP ที่ผ่านเงื่อนไขหลักฐานครบและไม่อยู่ใน DHCP dynamic pool เท่านั้น ถ้า IP อยู่ใน pool จะไม่ถือว่าว่าง แม้ยังไม่เห็น lease ในข้อมูลที่นำเข้า"
            : "Only addresses with complete evidence and outside dynamic DHCP pools are listed. Addresses inside a DHCP pool are not treated as free even when no lease is present in the imported data."}
        </p>
        {model.freeCandidates.length ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {model.freeCandidates.slice(0, 32).map(row => (
              <div key={row.ip} className="rounded-md border border-emerald-400/15 bg-black/20 p-2 text-xs">
                <div className="font-mono text-emerald-100">{row.ip}</div>
                <div className="mt-1 text-muted-foreground">{row.statusReason ?? row.sources.join(", ")}</div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-xs text-muted-foreground">
            {language === "th" ? "ไม่พบ IP ที่น่าจะว่างจากหลักฐานรอบนี้" : "No likely free IP candidate was produced from this evidence set."}
          </p>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {model.checks.map(check => (
          <article key={check.id} className="rounded-lg border border-cyan-400/15 bg-slate-950/45 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="text-sm font-medium">{check.title}</div>
              <Badge severity={stateSeverity(check.state)}>{stateLabel(check.state, language)}</Badge>
            </div>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">{check.summary}</p>
            {check.details.length ? (
              <ul className="mt-2 space-y-1 text-[11px] leading-5 text-cyan-50/75">
                {check.details.slice(0, 8).map((detail, index) => <li key={`${check.id}-${index}`}>• {detail}</li>)}
              </ul>
            ) : null}
            <div className="mt-2 text-[11px] text-cyan-100/65">
              {language === "th" ? "ตรวจจาก:" : "Sources:"} {check.sources.join(", ") || "-"}
            </div>
          </article>
        ))}
      </div>

      <details open className="rounded-lg border border-cyan-400/15 bg-slate-950/45 p-3">
        <summary className="cursor-pointer text-sm font-medium">
          {language === "th" ? `สถานะทุกคำสั่ง (${COMMAND_CATALOG.length} รูปแบบ)` : `All command statuses (${COMMAND_CATALOG.length} patterns)`}
        </summary>
        <div className="mt-3 max-h-[680px] overflow-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{language === "th" ? "คำสั่ง" : "Command"}</TableHead>
                <TableHead>{language === "th" ? "หมวด" : "Category"}</TableHead>
                <TableHead>{language === "th" ? "สถานะ" : "Status"}</TableHead>
                <TableHead>{language === "th" ? "Block" : "Blocks"}</TableHead>
                <TableHead>{language === "th" ? "หลักฐานใน Subnet" : "Subnet evidence"}</TableHead>
                <TableHead>{language === "th" ? "ใช้ตรวจอะไร" : "Purpose"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {model.commandStatuses.map(item => (
                <TableRow key={item.command}>
                  <TableCell className="font-mono text-xs">{item.command}</TableCell>
                  <TableCell>{item.category}</TableCell>
                  <TableCell><Badge severity={stateSeverity(item.state)}>{stateLabel(item.state, language)}</Badge></TableCell>
                  <TableCell>{item.blocks}</TableCell>
                  <TableCell>{item.relevantEvidence}</TableCell>
                  <TableCell className="min-w-72 text-xs text-muted-foreground">{item.purpose}</TableCell>
                </TableRow>
              ))}
              {model.unknownCommands.map(item => (
                <TableRow key={item.id}>
                  <TableCell className="font-mono text-xs">{item.rawCommand}</TableCell>
                  <TableCell>Unknown</TableCell>
                  <TableCell><Badge severity="Low">{language === "th" ? "พบแต่ยังไม่รองรับ" : "Detected, unsupported"}</Badge></TableCell>
                  <TableCell>1</TableCell>
                  <TableCell>{countSubnetEvidence(item.lines, subnet)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{item.warning ?? "Parser unavailable"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </details>

      <div className="grid gap-4 xl:grid-cols-2">
        <details open className="rounded-lg border border-cyan-400/15 bg-slate-950/45 p-3">
          <summary className="cursor-pointer text-sm font-medium">
            {language === "th" ? "รายการ IP ใน Subnet" : "IP records in subnet"}
          </summary>
          <div className="mt-3 max-h-[460px] overflow-auto rounded-lg border border-border">
            <Table>
              <TableHeader><TableRow><TableHead>IP</TableHead><TableHead>Status</TableHead><TableHead>MAC</TableHead><TableHead>VLAN</TableHead><TableHead>Port</TableHead><TableHead>Source</TableHead></TableRow></TableHeader>
              <TableBody>
                {model.inventory.slice(0, 500).map(row => (
                  <TableRow key={row.ip}>
                    <TableCell className="font-mono">{row.ip}</TableCell>
                    <TableCell>{row.status}</TableCell>
                    <TableCell className="font-mono text-xs">{row.macs.join(", ") || "-"}</TableCell>
                    <TableCell>{row.vlans.join(", ") || "-"}</TableCell>
                    <TableCell className="font-mono text-xs">{row.ports.join(", ") || "-"}</TableCell>
                    <TableCell className="text-xs">{row.sources.join(", ") || "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </details>

        <details open className="rounded-lg border border-cyan-400/15 bg-slate-950/45 p-3">
          <summary className="cursor-pointer text-sm font-medium">
            {language === "th" ? "Finding และ Security Event ที่เกี่ยวข้อง" : "Related findings and security events"}
          </summary>
          <div className="mt-3 space-y-2">
            {model.findings.map(finding => (
              <FindingRow key={finding.id} finding={finding} />
            ))}
            {model.logs.map((log, index) => (
              <div key={`${log.type}-${index}`} className="rounded-md border border-orange-400/15 bg-orange-400/5 p-2 text-xs">
                <div className="flex flex-wrap items-center gap-2"><Badge severity={log.severity}>{log.severity}</Badge><span className="font-medium">{log.type}</span></div>
                <p className="mt-1 text-muted-foreground">{log.message}</p>
              </div>
            ))}
            {!model.findings.length && !model.logs.length ? (
              <p className="text-xs text-muted-foreground">{language === "th" ? "ไม่พบ Finding หรือ Event ที่สัมพันธ์กับ Subnet นี้" : "No related finding or event was detected."}</p>
            ) : null}
          </div>
        </details>
      </div>

      <details className="rounded-lg border border-cyan-400/15 bg-slate-950/45 p-3">
        <summary className="cursor-pointer text-sm font-medium">
          {language === "th" ? `หลักฐานทั้งหมดที่สัมพันธ์กับ ${subnet.cidr}` : `All evidence related to ${subnet.cidr}`}
        </summary>
        <pre className="mt-3 max-h-[520px] overflow-auto whitespace-pre-wrap rounded-md bg-black/25 p-3 text-[11px] leading-5 text-cyan-50/80">
          {model.evidenceLines.join("\n") || (language === "th" ? "ไม่มีบรรทัดหลักฐานโดยตรง" : "No direct evidence lines")}
        </pre>
      </details>
    </section>
  );
}

function buildSubnetModel(subnet: SubnetRecord, result: AnalysisResult, language: "en" | "th") {
  const inventory = result.ipInventory.filter(row => ipInSubnet(row.ip, subnet.network, subnet.prefix));
  const arp = result.arp.filter(row => ipInSubnet(row.ip, subnet.network, subnet.prefix));
  const bindings = result.dhcpBindings.filter(row => ipInSubnet(row.ip, subnet.network, subnet.prefix));
  const dynamicPools = result.dhcpPools.filter(pool => pool.poolType !== "Reservation" && !pool.host && pool.network && pool.prefix !== undefined && rangesOverlap(subnet.network, subnet.prefix, pool.network, pool.prefix));
  const reservations = result.dhcpPools.filter(pool => pool.host && ipInSubnet(pool.host, subnet.network, subnet.prefix));
  const interfaces = result.interfaces.filter(row => row.ip && ipInSubnet(row.ip, subnet.network, subnet.prefix));
  const gatewayIps = unique([
    ...dynamicPools.flatMap(pool => pool.defaultRouters),
    ...interfaces.filter(row => /^Vlan/i.test(row.name) || row.mode === "routed").map(row => row.ip).filter((value): value is string => Boolean(value))
  ]).filter(ip => ipInSubnet(ip, subnet.network, subnet.prefix));
  const relatedMacs = unique([
    ...arp.map(row => row.mac).filter((value): value is string => Boolean(value)),
    ...bindings.map(row => row.mac).filter((value): value is string => Boolean(value)),
    ...inventory.flatMap(row => row.macs)
  ]);
  const relatedVlans = unique([
    ...arp.map(row => row.vlan).filter((value): value is number => value !== undefined),
    ...interfaces.flatMap(row => [row.vlan, row.accessVlan, row.voiceVlan, row.nativeVlan]).filter((value): value is number => typeof value === "number")
  ]);
  const macRows = result.macTable.filter(row => relatedMacs.includes(row.mac) || (row.vlan !== undefined && relatedVlans.includes(row.vlan)));
  const routes = result.staticRoutes.filter(route => {
    const destinationInSubnet = ipInSubnet(route.destination, subnet.network, subnet.prefix) || ipInSubnet(subnet.network, route.destination, route.prefix ?? 32);
    const nextHopInSubnet = Boolean(route.nextHop && ipInSubnet(route.nextHop, subnet.network, subnet.prefix));
    return destinationInSubnet || nextHopInSubnet;
  });
  const logs = result.logs.filter(log =>
    Boolean(log.ip && ipInSubnet(log.ip, subnet.network, subnet.prefix))
    || Boolean(log.mac && relatedMacs.includes(log.mac))
    || Boolean(log.vlan !== undefined && relatedVlans.includes(log.vlan))
  );
  const findings = uniqueFindings([...result.findings, ...result.blockedDevices].filter(finding => findingRelatesToSubnet(finding, subnet, relatedMacs)));

  const arpIpSet = new Set(arp.map(row => row.ip));
  const macSet = new Set(result.macTable.map(row => row.mac));
  const dhcpNoArp = bindings.filter(row => !arpIpSet.has(row.ip));
  const arpNoMac = arp.filter(row => row.mac && !macSet.has(row.mac));
  const duplicateIps = inventory.filter(row => row.macs.length > 1);
  const macToIps = new Map<string, Set<string>>();
  for (const row of [...arp.map(item => ({ ip: item.ip, mac: item.mac })), ...bindings.map(item => ({ ip: item.ip, mac: item.mac }))]) {
    if (!row.mac) continue;
    const ips = macToIps.get(row.mac) ?? new Set<string>();
    ips.add(row.ip);
    macToIps.set(row.mac, ips);
  }
  const multiIpMacs = [...macToIps.entries()].filter(([, ips]) => ips.size > 1);
  const vlanMismatches = arp.filter(arpRow => {
    if (!arpRow.mac || arpRow.vlan === undefined) return false;
    const rows = result.macTable.filter(macRow => macRow.mac === arpRow.mac && macRow.vlan !== undefined);
    return rows.length > 0 && rows.some(macRow => macRow.vlan !== arpRow.vlan);
  });
  const networkOrBroadcastUsed = inventory.filter(row => row.ip === subnet.network || row.ip === subnet.broadcast);
  const gatewaysLeased = bindings.filter(row => gatewayIps.includes(row.ip));
  const reservationInDynamic = reservations.filter(reservation =>
    Boolean(reservation.host && dynamicPools.some(pool => pool.network && pool.prefix !== undefined && ipInSubnet(reservation.host!, pool.network, pool.prefix)))
  );
  const interfaceInDynamic = interfaces.filter(intf =>
    Boolean(intf.ip && !gatewayIps.includes(intf.ip) && dynamicPools.some(pool => pool.network && pool.prefix !== undefined && ipInSubnet(intf.ip!, pool.network, pool.prefix)))
  );
  const overlappingPools = findOverlappingPools(dynamicPools);
  const aclCollected = result.commandBlocks.some(block => ["show access-lists", "show ip access-lists", "show running-config"].includes(block.command) && block.parsed);
  const securityCollected = result.commandBlocks.some(block => ["show ip dhcp snooping", "show ip arp inspection", "show port-security", "show authentication sessions", "show dot1x all", "show logging", "show running-config"].includes(block.command) && block.parsed);

  const checks: CheckItem[] = [
    check("subnet-math", language === "th" ? "ตรวจ Network / Host Range / Broadcast" : "Network, host range, and broadcast", "passed", `${subnet.network}/${subnet.prefix} · ${subnet.firstHost} - ${subnet.lastHost} · Broadcast ${subnet.broadcast}`, [`Usable ${subnet.totalUsable}`, `Used ${subnet.used}`, `Free ${subnet.free}`, `Utilization ${subnet.utilization}%`], ["Subnet calculation"], []),
    check("interface", language === "th" ? "ตรวจ Interface / SVI / Gateway" : "Interface, SVI, and gateway", interfaces.length ? "found" : commandState(result, ["show ip interface brief", "show interfaces", "show running-config"]), interfaces.length ? `พบ ${interfaces.length} Interface ที่มี IP อยู่ใน Subnet` : "ไม่พบ Interface IP ใน Subnet จากข้อมูลที่มี", interfaces.map(item => `${item.name}: ${item.ip}/${item.prefix ?? "?"}${item.description ? ` · ${item.description}` : ""}`), ["show ip interface brief", "show running-config"], interfaces.flatMap(item => item.evidence)),
    check("gateway", language === "th" ? "ตรวจ Default Gateway / Virtual Gateway" : "Default and virtual gateway", gatewayIps.length ? "found" : commandState(result, ["show standby brief", "show vrrp brief", "show ip interface brief", "show running-config"]), gatewayIps.length ? `พบ Gateway ที่สัมพันธ์ ${gatewayIps.length} IP` : "ยังยืนยัน Gateway ไม่ได้", gatewayIps, ["DHCP default-router", "SVI/routed interface", "HSRP/VRRP"], [...dynamicPools.flatMap(pool => pool.evidence), ...interfaces.flatMap(item => item.evidence)]),
    check("dhcp-pool", language === "th" ? "ตรวจ DHCP Dynamic Pool" : "DHCP dynamic pool", dynamicPools.length ? "found" : commandState(result, ["show ip dhcp pool", "show running-config"]), dynamicPools.length ? `พบ ${dynamicPools.length} Pool ที่ทับหรือครอบคลุม Subnet` : "ไม่พบ Dynamic Pool ที่สัมพันธ์", dynamicPools.map(pool => `${pool.name}: ${pool.network}/${pool.prefix ?? "?"} · Gateway ${pool.defaultRouters.join(", ") || "-"}`), ["show ip dhcp pool", "show running-config"], dynamicPools.flatMap(pool => pool.evidence)),
    check("reservations", language === "th" ? "ตรวจ DHCP Reservation / Static Binding" : "DHCP reservations and static bindings", reservations.length ? "found" : commandState(result, ["show ip dhcp binding", "show ip dhcp snooping binding", "show running-config"]), reservations.length ? `พบ ${reservations.length} Reservation` : "ไม่พบ Reservation ใน Subnet", reservations.map(pool => `${pool.host} · ${pool.clientIdentifier ?? pool.hardwareAddress ?? "No identifier"}`), ["show ip dhcp binding", "show running-config"], reservations.flatMap(pool => pool.evidence)),
    check("bindings", language === "th" ? "ตรวจ DHCP Lease / Binding" : "DHCP leases and bindings", bindings.length ? "found" : commandState(result, ["show ip dhcp binding", "show ip dhcp snooping binding", "show ip source binding"]), bindings.length ? `พบ ${bindings.length} Binding` : "ไม่พบ Binding ใน Subnet", bindings.map(item => `${item.ip} · ${item.mac ?? item.clientIdentifier ?? "No MAC"} · ${item.state ?? item.type ?? "-"}`), ["show ip dhcp binding", "show ip dhcp snooping binding", "show ip source binding"], bindings.flatMap(item => item.evidence)),
    check("arp", language === "th" ? "ตรวจ ARP" : "ARP records", arp.length ? "found" : commandState(result, ["show ip arp", "show arp"]), arp.length ? `พบ ${arp.length} ARP Record` : "ไม่พบ ARP ใน Subnet", arp.map(item => `${item.ip} · ${item.mac ?? "Incomplete"} · ${item.interfaceName ?? "-"}`), ["show ip arp", "show arp"], arp.flatMap(item => item.evidence)),
    check("mac", language === "th" ? "ตรวจ MAC Table / VLAN / Port" : "MAC table, VLAN, and port", macRows.length ? "found" : commandState(result, ["show mac address-table"]), macRows.length ? `พบ ${macRows.length} MAC Table Record ที่สัมพันธ์` : "ไม่พบ MAC Table ที่สัมพันธ์", macRows.map(item => `${item.mac} · VLAN ${item.vlan ?? "-"} · ${item.port} · ${item.type}`), ["show mac address-table"], macRows.flatMap(item => item.evidence)),
    check("dhcp-no-arp", language === "th" ? "DHCP Binding แต่ไม่พบ ARP" : "DHCP binding without ARP", dhcpNoArp.length ? "warning" : bindings.length || arp.length ? "passed" : "missing", dhcpNoArp.length ? `พบ ${dhcpNoArp.length} IP ที่มี Binding แต่ไม่มี ARP` : "ไม่พบความผิดปกติชนิดนี้จากหลักฐานปัจจุบัน", dhcpNoArp.map(item => `${item.ip} · ${item.mac ?? item.clientIdentifier ?? "-"}`), ["DHCP binding", "ARP"], dhcpNoArp.flatMap(item => item.evidence)),
    check("arp-no-mac", language === "th" ? "ARP แต่ไม่พบ MAC Address Table" : "ARP without MAC-table entry", arpNoMac.length ? "warning" : arp.length && result.macTable.length ? "passed" : "missing", arpNoMac.length ? `พบ ${arpNoMac.length} ARP ที่ MAC ไม่ปรากฏใน MAC Table` : "ไม่พบความผิดปกติชนิดนี้จากหลักฐานปัจจุบัน", arpNoMac.map(item => `${item.ip} · ${item.mac ?? "-"} · ${item.interfaceName ?? "-"}`), ["ARP", "MAC address-table"], arpNoMac.flatMap(item => item.evidence)),
    check("duplicate-ip", language === "th" ? "IP เดียวมีหลาย MAC" : "One IP mapped to multiple MACs", duplicateIps.length ? "warning" : inventory.length ? "passed" : "missing", duplicateIps.length ? `พบ ${duplicateIps.length} IP ที่มีหลาย MAC` : "ไม่พบ Duplicate IP จากข้อมูลปัจจุบัน", duplicateIps.map(item => `${item.ip}: ${item.macs.join(", ")}`), ["IP correlation", "ARP", "DHCP"], duplicateIps.flatMap(item => item.evidence)),
    check("multi-ip-mac", language === "th" ? "MAC เดียวมีหลาย IP" : "One MAC mapped to multiple IPs", multiIpMacs.length ? "warning" : arp.length || bindings.length ? "passed" : "missing", multiIpMacs.length ? `พบ ${multiIpMacs.length} MAC ที่สัมพันธ์หลาย IP` : "ไม่พบ MAC เดียวหลาย IP จากข้อมูลปัจจุบัน", multiIpMacs.map(([mac, ips]) => `${mac}: ${[...ips].join(", ")}`), ["ARP", "DHCP binding"], []),
    check("vlan-mismatch", language === "th" ? "VLAN ไม่ตรงระหว่าง ARP และ MAC Table" : "ARP and MAC-table VLAN mismatch", vlanMismatches.length ? "warning" : arp.length && macRows.length ? "passed" : "missing", vlanMismatches.length ? `พบ ${vlanMismatches.length} รายการที่ VLAN ไม่ตรง` : "ไม่พบ VLAN Mismatch จากข้อมูลปัจจุบัน", vlanMismatches.map(item => `${item.ip} · ${item.mac} · ARP VLAN ${item.vlan}`), ["ARP", "MAC address-table"], vlanMismatches.flatMap(item => item.evidence)),
    check("network-broadcast", language === "th" ? "Network/Broadcast ถูกนำไปใช้" : "Network or broadcast address in use", networkOrBroadcastUsed.length ? "warning" : "passed", networkOrBroadcastUsed.length ? `พบ ${networkOrBroadcastUsed.length} Address ต้องห้ามใน Inventory` : "ไม่พบ Network หรือ Broadcast ถูกนำไปใช้", networkOrBroadcastUsed.map(item => `${item.ip} · ${item.status} · ${item.sources.join(", ")}`), ["IP inventory", "Subnet calculation"], networkOrBroadcastUsed.flatMap(item => item.evidence)),
    check("gateway-leased", language === "th" ? "Gateway ถูกแจกเป็น DHCP Lease" : "Gateway allocated as DHCP lease", gatewaysLeased.length ? "warning" : gatewayIps.length && bindings.length ? "passed" : "missing", gatewaysLeased.length ? `พบ Gateway ${gatewaysLeased.length} IP อยู่ใน DHCP Binding` : "ไม่พบ Gateway ถูกแจกผ่าน DHCP", gatewaysLeased.map(item => `${item.ip} · ${item.mac ?? item.clientIdentifier ?? "-"}`), ["Gateway correlation", "DHCP binding"], gatewaysLeased.flatMap(item => item.evidence)),
    check("static-dynamic", language === "th" ? "Static/Reservation อยู่ใน Dynamic Range" : "Static or reserved address inside dynamic range", reservationInDynamic.length || interfaceInDynamic.length ? "warning" : dynamicPools.length ? "passed" : "missing", reservationInDynamic.length || interfaceInDynamic.length ? `พบ ${reservationInDynamic.length} Reservation และ ${interfaceInDynamic.length} Interface IP อยู่ในช่วง Dynamic Pool` : "ไม่พบ Static/Reservation ทับช่วง Dynamic จากข้อมูลปัจจุบัน", [...reservationInDynamic.map(item => `Reservation ${item.host} · Pool ${item.name}`), ...interfaceInDynamic.map(item => `Interface ${item.name} · ${item.ip}`)], ["DHCP pools", "Reservations", "Interface IP"], [...reservationInDynamic.flatMap(item => item.evidence), ...interfaceInDynamic.flatMap(item => item.evidence)]),
    check("pool-overlap", language === "th" ? "DHCP Pool ทับกัน" : "Overlapping DHCP pools", overlappingPools.length ? "warning" : dynamicPools.length > 1 ? "passed" : dynamicPools.length ? "not-applicable" : "missing", overlappingPools.length ? `พบ ${overlappingPools.length} คู่ Pool ที่ช่วง Address ทับกัน` : "ไม่พบ Pool Overlap หรือมี Pool เดียว", overlappingPools, ["DHCP pool networks"], dynamicPools.flatMap(pool => pool.evidence)),
    check("routing", language === "th" ? "ตรวจ Route / VRF" : "Route and VRF", routes.length ? "found" : commandState(result, ["show ip route", "show vrf", "show running-config"]), routes.length ? `พบ ${routes.length} Route ที่สัมพันธ์กับ Subnet หรือ Next Hop` : "ไม่พบ Route แบบ Structured ที่สัมพันธ์", routes.map(route => `${route.vrf ?? "global"}: ${route.destination}/${route.prefix ?? "?"} via ${route.nextHop ?? route.outgoingInterface ?? "-"}`), ["show ip route", "show vrf", "show running-config"], routes.flatMap(route => route.evidence)),
    check("acl", language === "th" ? "ตรวจ ACL Permit / Deny" : "ACL permit and deny rules", result.accessLists.length ? "found" : aclCollected ? "passed" : "missing", result.accessLists.length ? `พบ ACL Rule ทั้งหมด ${result.accessLists.length} รายการ ต้องตรวจ Wildcard/Object เพิ่มเพื่อยืนยันผลต่อ Subnet` : aclCollected ? "มี Output ACL แต่ไม่พบ Rule ที่ Parser แยกได้" : "ยังไม่มีคำสั่ง ACL", result.accessLists.slice(0, 20).map(acl => `${acl.name} · ${acl.action ?? "-"} · ${acl.expression}`), ["show access-lists", "show ip access-lists", "show running-config"], result.accessLists.flatMap(acl => acl.evidence)),
    check("security", language === "th" ? "ตรวจ DHCP Snooping / DAI / Port Security / NAC" : "DHCP Snooping, DAI, Port Security, and NAC", result.securityChecks.some(item => item.status === "Failed" || item.status === "Warning") ? "warning" : securityCollected ? "found" : "missing", securityCollected ? `Security Check ${result.securityChecks.length} รายการ · Evidence Coverage ${result.evidenceCoverage ?? 0}%` : "ยังไม่มี Security Output เพียงพอ", result.securityChecks.map(item => `${item.name}: ${item.status}`), ["Snooping", "DAI", "Port Security", "802.1X/MAB", "Logs"], result.securityChecks.flatMap(item => item.evidence)),
    check("events", language === "th" ? "ตรวจ Blocked / Denied / Conflict / Flapping" : "Blocked, denied, conflict, and flapping events", logs.length || findings.length ? "warning" : result.logs.length || result.findings.length ? "passed" : commandState(result, ["show logging"]), logs.length || findings.length ? `พบ Finding ${findings.length} และ Log Event ${logs.length} ที่สัมพันธ์` : "ไม่พบ Event ที่สัมพันธ์กับ Subnet นี้", [...findings.map(item => `${item.severity} · ${item.title}`), ...logs.map(item => `${item.severity} · ${item.type} · ${item.message}`)], ["show logging", "Correlation findings"], [...findings.flatMap(item => item.evidence), ...logs.flatMap(item => item.evidence)]),
    check("parser", language === "th" ? "ตรวจความครอบคลุมของ Parser" : "Parser coverage", result.parserCoverage.coveragePercent < 70 || result.parserWarnings.length ? "warning" : "passed", `Coverage ${result.parserCoverage.coveragePercent}% · Recognized ${result.parserCoverage.recognizedLines}/${result.parserCoverage.totalMeaningfulLines} · Warning ${result.parserWarnings.length}`, result.parserWarnings.map(item => item.description), ["All imported command blocks"], result.parserWarnings.flatMap(item => item.evidence))
  ];

  const commandStatuses = COMMAND_CATALOG.map(item => {
    const blocks = result.commandBlocks.filter(block => block.command === item.command);
    const parsed = blocks.some(block => block.parsed);
    const relevantEvidence = item.scope === "device"
      ? blocks.reduce((total, block) => total + block.lines.length, 0)
      : blocks.reduce((total, block) => total + countSubnetEvidence(block.lines, subnet), 0);
    const state: CheckState = !blocks.length ? "missing" : !parsed ? "warning" : relevantEvidence > 0 || item.scope === "device" ? "found" : "passed";
    return { ...item, state, blocks: blocks.length, relevantEvidence };
  });

  const unknownCommands = result.commandBlocks.filter(block => block.command === "unknown" || !block.parsed);
  const evidenceLines = unique([
    ...arp.flatMap(item => item.evidence),
    ...bindings.flatMap(item => item.evidence),
    ...dynamicPools.flatMap(item => item.evidence),
    ...reservations.flatMap(item => item.evidence),
    ...interfaces.flatMap(item => item.evidence),
    ...macRows.flatMap(item => item.evidence),
    ...routes.flatMap(item => item.evidence),
    ...findings.flatMap(item => item.evidence),
    ...logs.flatMap(item => item.evidence),
    ...result.commandBlocks.flatMap(block => block.lines.filter(line => lineContainsSubnetIp(line.text, subnet)))
  ].map(formatEvidence)).slice(0, 500);

  const freeCandidates = inventory.filter(row => row.status === "Likely Free");

  return { inventory, freeCandidates, arp, bindings, relatedMacs, interfaces, findings, logs, checks, commandStatuses, unknownCommands, evidenceLines };
}

function check(id: string, title: string, state: CheckState, summary: string, details: string[], sources: string[], evidence: Evidence[]): CheckItem {
  return { id, title, state, summary, details, sources, evidence };
}

function commandState(result: AnalysisResult, commands: CommandType[]): CheckState {
  const blocks = result.commandBlocks.filter(block => commands.includes(block.command));
  if (!blocks.length) return "missing";
  return blocks.some(block => block.parsed) ? "passed" : "warning";
}

function rangesOverlap(networkA: string, prefixA: number, networkB: string, prefixB: number): boolean {
  const a = range(networkA, prefixA);
  const b = range(networkB, prefixB);
  if (!a || !b) return false;
  return a.start <= b.end && b.start <= a.end;
}

function range(network: string, prefix: number): { start: number; end: number } | null {
  const value = ipToNumber(network);
  const mask = prefixToMask(prefix);
  if (value === null || mask === null) return null;
  const start = (value & mask) >>> 0;
  const end = (start | (~mask >>> 0)) >>> 0;
  return { start, end };
}

function findOverlappingPools(pools: AnalysisResult["dhcpPools"]): string[] {
  const overlaps: string[] = [];
  for (let left = 0; left < pools.length; left += 1) {
    for (let right = left + 1; right < pools.length; right += 1) {
      const a = pools[left];
      const b = pools[right];
      if (!a.network || a.prefix === undefined || !b.network || b.prefix === undefined) continue;
      if (rangesOverlap(a.network, a.prefix, b.network, b.prefix)) {
        overlaps.push(`${a.name} (${a.network}/${a.prefix}) ↔ ${b.name} (${b.network}/${b.prefix})`);
      }
    }
  }
  return overlaps;
}

function findingRelatesToSubnet(finding: Finding, subnet: SubnetRecord, macs: string[]): boolean {
  const text = [finding.target, finding.targetDescription, finding.title, finding.description, ...finding.evidence.map(item => item.text)]
    .filter(Boolean)
    .join(" ");
  const ips = extractIps(text);
  return ips.some(ip => ipInSubnet(ip, subnet.network, subnet.prefix))
    || macs.some(mac => text.toLowerCase().includes(mac.toLowerCase()) || text.toLowerCase().includes(mac.replaceAll(":", ".").toLowerCase()));
}

function countSubnetEvidence(lines: Evidence[], subnet: SubnetRecord): number {
  return lines.filter(line => lineContainsSubnetIp(line.text, subnet)).length;
}

function lineContainsSubnetIp(text: string, subnet: SubnetRecord): boolean {
  return extractIps(text).some(ip => ipInSubnet(ip, subnet.network, subnet.prefix));
}

function extractIps(text: string): string[] {
  return text.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g) ?? [];
}

function uniqueFindings(items: Finding[]): Finding[] {
  return items.filter((item, index, all) => all.findIndex(candidate => candidate.id === item.id) === index);
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function formatEvidence(item: Evidence): string {
  return `${item.device}:${item.line} [${item.command}] ${item.text}`;
}

function stateLabel(state: CheckState, language: "en" | "th"): string {
  if (language === "th") {
    if (state === "passed") return "ตรวจแล้ว ไม่พบปัญหา";
    if (state === "found") return "ตรวจแล้ว พบข้อมูล";
    if (state === "warning") return "พบความผิดปกติ/ต้องตรวจเพิ่ม";
    if (state === "not-applicable") return "ไม่เกี่ยวข้อง";
    return "ยังไม่มีคำสั่ง/หลักฐาน";
  }
  if (state === "passed") return "Checked, no issue found";
  if (state === "found") return "Checked, data found";
  if (state === "warning") return "Anomaly or review needed";
  if (state === "not-applicable") return "Not applicable";
  return "Command/evidence missing";
}

function stateSeverity(state: CheckState): Severity {
  if (state === "passed") return "Passed";
  if (state === "found") return "Info";
  if (state === "warning") return "High";
  return "Low";
}

function Summary({ label, value }: { label: string; value: number }) {
  return <div className="rounded-lg border border-cyan-400/15 bg-black/20 p-3"><div className="text-xs text-muted-foreground">{label}</div><div className="mt-1 font-mono text-xl font-semibold">{value}</div></div>;
}

function FindingRow({ finding }: { finding: Finding }) {
  return (
    <div className="rounded-md border border-amber-400/15 bg-amber-400/5 p-2 text-xs">
      <div className="flex flex-wrap items-center gap-2"><Badge severity={finding.severity}>{finding.severity}</Badge><span className="font-medium">{finding.title}</span><span className="font-mono text-muted-foreground">{finding.target ?? ""}</span></div>
      <p className="mt-1 text-muted-foreground">{finding.description}</p>
    </div>
  );
}
