"use client";

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { useAnalysisStore } from "@/store/analysis-store";
import type { AnalysisResult, Finding, IpInventoryRecord, Severity } from "@/types/network";
import { ipInSubnet } from "@/utils/ip";

interface IpMacCheckDetailsProps {
  row: IpInventoryRecord;
  language: "en" | "th";
}

type CheckState = "found" | "clear" | "warning" | "not-collected";

interface CheckItem {
  id: string;
  title: string;
  state: CheckState;
  detail: string;
  sources: string[];
}

export function IpMacCheckDetails({ row, language }: IpMacCheckDetailsProps) {
  const result = useAnalysisStore(state => state.result);
  const model = useMemo(() => result ? buildCheckModel(row, result, language) : null, [language, result, row]);

  if (!model) return null;

  return (
    <section className="mt-4 space-y-4 rounded-xl border border-cyan-400/20 bg-slate-950/35 p-4">
      <div>
        <h3 className="cyber-brand text-sm font-semibold">
          {language === "th" ? "รายละเอียดการตรวจสอบ IP และ MAC" : "IP and MAC check details"}
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {language === "th"
            ? "แยกให้เห็นว่าระบบมีข้อมูลคำสั่งใด ตรวจพบอะไร ไม่พบอะไร และหัวข้อใดยังตรวจไม่ได้เพราะไม่มีหลักฐาน"
            : "Shows which command data was collected, what matched, what did not match, and which checks could not run due to missing evidence."}
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {model.checks.map(check => (
          <article key={check.id} className="rounded-lg border border-cyan-400/15 bg-slate-950/45 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="text-sm font-medium">{check.title}</div>
              <Badge severity={badgeSeverity(check.state)}>{stateLabel(check.state, language)}</Badge>
            </div>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">{check.detail}</p>
            <div className="mt-2 text-[11px] text-cyan-100/70">
              {language === "th" ? "แหล่งตรวจ:" : "Checked from:"} {check.sources.join(", ") || "-"}
            </div>
          </article>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-lg border border-cyan-400/15 bg-slate-950/45 p-3">
          <div className="text-sm font-medium">{language === "th" ? "ความสัมพันธ์ของ IP" : "IP relationships"}</div>
          <dl className="mt-3 grid grid-cols-[140px_minmax(0,1fr)] gap-x-3 gap-y-2 text-xs">
            <dt className="text-muted-foreground">{language === "th" ? "คำอธิบาย" : "Description"}</dt>
            <dd>{row.description ?? (language === "th" ? "ไม่มีคำอธิบาย" : "No description")}</dd>
            <dt className="text-muted-foreground">{language === "th" ? "ที่มาคำอธิบาย" : "Description source"}</dt>
            <dd>{row.descriptionSource ?? "Unknown"}{row.descriptionConfidence !== undefined ? ` · ${row.descriptionConfidence}%` : ""}</dd>
            <dt className="text-muted-foreground">Subnet</dt>
            <dd className="font-mono">{model.subnets.join(", ") || "-"}</dd>
            <dt className="text-muted-foreground">ARP</dt>
            <dd>{model.arpSummary}</dd>
            <dt className="text-muted-foreground">DHCP</dt>
            <dd>{model.dhcpSummary}</dd>
            <dt className="text-muted-foreground">Interface</dt>
            <dd>{model.interfaceSummary}</dd>
            <dt className="text-muted-foreground">Findings</dt>
            <dd>{model.relatedFindings.length}</dd>
          </dl>
        </div>

        <div className="rounded-lg border border-cyan-400/15 bg-slate-950/45 p-3">
          <div className="text-sm font-medium">{language === "th" ? "รายละเอียดแต่ละ MAC" : "Per-MAC details"}</div>
          <div className="mt-3 space-y-3">
            {model.macDetails.length ? model.macDetails.map(mac => (
              <div key={mac.mac} className="rounded-md border border-cyan-400/10 bg-black/20 p-3 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-cyan-100">{mac.mac}</span>
                  <Badge severity={mac.hasWarning ? "High" : "Info"}>
                    {mac.hasWarning ? (language === "th" ? "มีข้อสังเกต" : "Needs review") : (language === "th" ? "พบข้อมูล" : "Observed")}
                  </Badge>
                </div>
                <div className="mt-2 grid grid-cols-[110px_minmax(0,1fr)] gap-x-2 gap-y-1.5">
                  <span className="text-muted-foreground">VLAN</span><span>{mac.vlans.join(", ") || "-"}</span>
                  <span className="text-muted-foreground">Port</span><span className="font-mono">{mac.ports.join(", ") || "-"}</span>
                  <span className="text-muted-foreground">DHCP IP</span><span className="font-mono">{mac.dhcpIps.join(", ") || "-"}</span>
                  <span className="text-muted-foreground">ARP IP</span><span className="font-mono">{mac.arpIps.join(", ") || "-"}</span>
                  <span className="text-muted-foreground">Findings</span><span>{mac.findingTitles.join(" · ") || "-"}</span>
                </div>
              </div>
            )) : (
              <p className="text-xs text-muted-foreground">
                {language === "th" ? "ไม่พบ MAC ที่เชื่อมกับ IP นี้จากข้อมูลรอบปัจจุบัน" : "No MAC was correlated to this IP in the current input."}
              </p>
            )}
          </div>
        </div>
      </div>

      {model.relatedFindings.length ? (
        <div className="rounded-lg border border-amber-400/20 bg-amber-400/5 p-3">
          <div className="text-sm font-medium">{language === "th" ? "ประเด็นที่เกี่ยวข้อง" : "Related findings"}</div>
          <div className="mt-2 space-y-2">
            {model.relatedFindings.map(finding => (
              <div key={finding.id} className="flex flex-col gap-1 rounded-md border border-amber-400/10 bg-black/15 p-2 text-xs md:flex-row md:items-center md:gap-3">
                <Badge severity={finding.severity}>{finding.severity}</Badge>
                <span className="font-medium">{finding.title}</span>
                <span className="text-muted-foreground">{finding.description}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="rounded-lg border border-cyan-400/15 bg-slate-950/45 p-3">
        <div className="text-sm font-medium">{language === "th" ? "หลักฐานที่ใช้" : "Evidence used"}</div>
        <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-md bg-black/25 p-3 text-[11px] leading-5 text-cyan-50/80">
          {model.evidenceLines.join("\n") || (language === "th" ? "ไม่มีบรรทัดหลักฐานโดยตรง" : "No direct evidence lines")}
        </pre>
      </div>
    </section>
  );
}

function buildCheckModel(row: IpInventoryRecord, result: AnalysisResult, language: "en" | "th") {
  const arpMatches = result.arp.filter(item => item.ip === row.ip || Boolean(item.mac && row.macs.includes(item.mac)));
  const dhcpBindings = result.dhcpBindings.filter(item => item.ip === row.ip || Boolean(item.mac && row.macs.includes(item.mac)));
  const reservationPools = result.dhcpPools.filter(pool => pool.host === row.ip || Boolean(pool.hardwareAddress && row.macs.includes(pool.hardwareAddress)));
  const networkPools = result.dhcpPools.filter(pool => pool.network && pool.prefix !== undefined && ipInSubnet(row.ip, pool.network, pool.prefix));
  const macRows = result.macTable.filter(item => row.macs.includes(item.mac));
  const interfaces = result.interfaces.filter(item => item.ip === row.ip || row.ports.includes(item.name) || arpMatches.some(arp => arp.interfaceName === item.name));
  const subnets = result.subnets.filter(subnet => ipInSubnet(row.ip, subnet.network, subnet.prefix));
  const relatedFindings = [...result.findings, ...result.blockedDevices]
    .filter(finding => findingRelatesToRow(finding, row))
    .filter((finding, index, all) => all.findIndex(candidate => candidate.id === finding.id) === index);
  const relatedLogs = result.logs.filter(log => log.ip === row.ip || Boolean(log.mac && row.macs.includes(log.mac)));

  const hasArpCommand = commandAvailable(result, ["show ip arp", "show arp"]);
  const hasDhcpCommand = commandAvailable(result, ["show ip dhcp binding", "show ip dhcp snooping binding", "show ip source binding", "show running-config"]);
  const hasMacCommand = commandAvailable(result, ["show mac address-table"]);
  const hasInterfaceCommand = commandAvailable(result, ["show interfaces status", "show interfaces description", "show interfaces switchport", "show interfaces trunk", "show ip interface brief", "show running-config"]);
  const hasLogCommand = commandAvailable(result, ["show logging", "show running-config"]);

  const vlanMismatch = hasSetMismatch(
    arpMatches.map(item => item.vlan).filter((value): value is number => value !== undefined),
    macRows.map(item => item.vlan).filter((value): value is number => value !== undefined)
  );
  const portMismatch = hasSetMismatch(
    arpMatches.map(item => item.interfaceName).filter((value): value is string => Boolean(value)),
    macRows.map(item => item.port)
  );
  const duplicateFinding = relatedFindings.some(finding => /duplicate|หลาย mac|หลาย ip|flap|multiple/i.test(`${finding.title} ${finding.description}`));
  const blockedFinding = relatedFindings.some(finding => /block|deny|err.?disabled|violation|quarantine|rejection/i.test(`${finding.title} ${finding.description}`)) || relatedLogs.length > 0;

  const checks: CheckItem[] = [
    commandCheck(
      "arp",
      language === "th" ? "ตรวจ ARP" : "ARP correlation",
      hasArpCommand,
      arpMatches.length,
      language === "th"
        ? arpMatches.length ? `พบ ${arpMatches.length} รายการ เชื่อม IP กับ MAC/Interface จาก ARP` : "มีข้อมูล ARP แต่ไม่พบ IP หรือ MAC นี้"
        : arpMatches.length ? `Found ${arpMatches.length} ARP record(s) linking the IP to a MAC/interface.` : "ARP data was collected, but this IP/MAC was not present.",
      ["show ip arp", "show arp"]
    ),
    commandCheck(
      "dhcp",
      language === "th" ? "ตรวจ DHCP Binding / Reservation" : "DHCP binding / reservation",
      hasDhcpCommand,
      dhcpBindings.length + reservationPools.length,
      language === "th"
        ? `Binding ${dhcpBindings.length} รายการ · Reservation ${reservationPools.length} รายการ · อยู่ใน Dynamic Pool ${networkPools.length} Pool`
        : `${dhcpBindings.length} binding(s) · ${reservationPools.length} reservation(s) · member of ${networkPools.length} dynamic pool(s).`,
      ["show ip dhcp binding", "show ip dhcp snooping binding", "show running-config"]
    ),
    commandCheck(
      "mac-table",
      language === "th" ? "ตรวจ MAC Address Table" : "MAC address-table correlation",
      hasMacCommand,
      macRows.length,
      language === "th"
        ? macRows.length ? `พบ MAC ${macRows.length} รายการบนพอร์ต ${unique(macRows.map(item => item.port)).join(", ")}` : "มี MAC Table แต่ไม่พบ MAC ที่สัมพันธ์กับ IP นี้"
        : macRows.length ? `Found ${macRows.length} MAC-table record(s) on ${unique(macRows.map(item => item.port)).join(", ")}.` : "MAC-table data was collected, but no related MAC was found.",
      ["show mac address-table"]
    ),
    {
      id: "vlan-port",
      title: language === "th" ? "ตรวจ VLAN และ Port ตรงกันหรือไม่" : "VLAN and port consistency",
      state: vlanMismatch || portMismatch ? "warning" : (arpMatches.length && macRows.length ? "clear" : "not-collected"),
      detail: language === "th"
        ? vlanMismatch || portMismatch ? "ข้อมูล ARP กับ MAC Table ชี้ VLAN หรือ Port ไม่ตรงกัน ต้องตรวจ Uplink/Trunk/Port-channel เพิ่ม" : arpMatches.length && macRows.length ? "VLAN และ Port ที่สัมพันธ์กันไม่พบความขัดแย้งจากข้อมูลรอบนี้" : "หลักฐาน ARP หรือ MAC Table ยังไม่ครบ จึงยืนยันความสอดคล้องไม่ได้"
        : vlanMismatch || portMismatch ? "ARP and MAC-table evidence disagree on VLAN or port. Verify uplinks, trunks, and port-channels." : arpMatches.length && macRows.length ? "No VLAN/port inconsistency was detected in the current evidence." : "ARP or MAC-table evidence is incomplete, so consistency cannot be confirmed.",
      sources: ["ARP", "MAC table", "Interface state"]
    },
    {
      id: "subnet",
      title: language === "th" ? "ตรวจ Subnet และประเภท IP" : "Subnet and address-role check",
      state: subnets.length ? "clear" : "warning",
      detail: language === "th"
        ? subnets.length ? `อยู่ใน ${subnets.map(item => item.cidr).join(", ")} · สถานะที่ระบบจัดให้: ${row.status}` : "ไม่พบ Subnet ที่ครอบคลุม IP นี้จากข้อมูลที่นำเข้า"
        : subnets.length ? `Covered by ${subnets.map(item => item.cidr).join(", ")} · classified as ${row.status}.` : "No imported subnet covers this IP.",
      sources: ["Interface addressing", "DHCP pools", "Subnet calculation"]
    },
    {
      id: "interface",
      title: language === "th" ? "ตรวจ Interface / SVI / Gateway" : "Interface, SVI, and gateway check",
      state: interfaces.length ? "found" : hasInterfaceCommand ? "clear" : "not-collected",
      detail: language === "th"
        ? interfaces.length ? `สัมพันธ์กับ ${interfaces.map(item => `${item.name}${item.description ? ` (${item.description})` : ""}`).join(", ")}` : hasInterfaceCommand ? "มีข้อมูล Interface แต่ไม่พบ IP/Port นี้เป็น Interface IP หรือพอร์ตที่สัมพันธ์โดยตรง" : "ยังไม่มีข้อมูล Interface เพียงพอ"
        : interfaces.length ? `Related to ${interfaces.map(item => `${item.name}${item.description ? ` (${item.description})` : ""}`).join(", ")}.` : hasInterfaceCommand ? "Interface data was collected, but no direct interface/SVI relationship was found." : "Interface evidence was not collected.",
      sources: ["show ip interface brief", "show interfaces", "show running-config"]
    },
    {
      id: "duplicates",
      title: language === "th" ? "ตรวจ IP/MAC ซ้ำและการย้ายพอร์ต" : "Duplicate IP/MAC and movement check",
      state: duplicateFinding ? "warning" : relatedFindings.length || hasArpCommand || hasMacCommand ? "clear" : "not-collected",
      detail: language === "th"
        ? duplicateFinding ? "พบ Finding ที่เกี่ยวกับ IP/MAC ซ้ำ, หลายพอร์ต หรือ MAC Flapping" : "ไม่พบ Finding ประเภท Duplicate/Flapping ที่สัมพันธ์กับรายการนี้ในรอบปัจจุบัน"
        : duplicateFinding ? "A related duplicate-IP, duplicate-MAC, multi-port, or MAC-flapping finding exists." : "No related duplicate or flapping finding was produced in the current analysis.",
      sources: ["ARP correlation", "MAC-table correlation", "Logs", "Anomaly rules"]
    },
    {
      id: "blocked",
      title: language === "th" ? "ตรวจ Blocked / Denied / Security Event" : "Blocked, denied, and security-event check",
      state: blockedFinding ? "warning" : hasLogCommand ? "clear" : "not-collected",
      detail: language === "th"
        ? blockedFinding ? `พบเหตุการณ์หรือ Finding ที่เกี่ยวข้อง ${relatedLogs.length + relatedFindings.filter(item => /block|deny|violation|err/i.test(item.title)).length} รายการ` : hasLogCommand ? "ไม่พบ Block/Denied/Security Event ที่สัมพันธ์กับ IP/MAC นี้" : "ยังไม่มี Log หรือ Security Output เพียงพอ"
        : blockedFinding ? `Found ${relatedLogs.length + relatedFindings.filter(item => /block|deny|violation|err/i.test(item.title)).length} related event(s) or finding(s).` : hasLogCommand ? "No related blocked, denied, or security event was found." : "Log/security evidence was not collected.",
      sources: ["show logging", "ACL/security findings", "Port-security / DAI / Snooping events"]
    }
  ];

  const macDetails = row.macs.map(mac => {
    const macTableRows = result.macTable.filter(item => item.mac === mac);
    const macDhcp = result.dhcpBindings.filter(item => item.mac === mac);
    const macArp = result.arp.filter(item => item.mac === mac);
    const macFindings = [...result.findings, ...result.blockedDevices].filter(finding => findingRelatesToMac(finding, mac));
    return {
      mac,
      vlans: unique([...macTableRows.map(item => item.vlan), ...macArp.map(item => item.vlan)].filter((value): value is number => value !== undefined).map(String)),
      ports: unique([...macTableRows.map(item => item.port), ...macArp.map(item => item.interfaceName)].filter((value): value is string => Boolean(value))),
      dhcpIps: unique(macDhcp.map(item => item.ip)),
      arpIps: unique(macArp.map(item => item.ip)),
      findingTitles: unique(macFindings.map(item => item.title)),
      hasWarning: macFindings.some(item => item.severity === "Critical" || item.severity === "High")
    };
  });

  const evidenceLines = unique(
    [
      ...row.evidence,
      ...arpMatches.flatMap(item => item.evidence),
      ...dhcpBindings.flatMap(item => item.evidence),
      ...reservationPools.flatMap(item => item.evidence),
      ...macRows.flatMap(item => item.evidence),
      ...interfaces.flatMap(item => item.evidence),
      ...relatedFindings.flatMap(item => item.evidence),
      ...relatedLogs.flatMap(item => item.evidence)
    ].map(item => `${item.device}:${item.line} [${item.command}] ${item.text}`)
  ).slice(0, 120);

  return {
    checks,
    subnets: subnets.map(item => item.cidr),
    arpSummary: arpMatches.length ? `${arpMatches.length} record(s)` : "-",
    dhcpSummary: `${dhcpBindings.length} binding(s), ${reservationPools.length} reservation(s)`,
    interfaceSummary: interfaces.map(item => item.name).join(", ") || "-",
    relatedFindings,
    macDetails,
    evidenceLines
  };
}

function commandCheck(id: string, title: string, collected: boolean, matches: number, detail: string, sources: string[]): CheckItem {
  return {
    id,
    title,
    state: !collected ? "not-collected" : matches > 0 ? "found" : "clear",
    detail,
    sources
  };
}

function commandAvailable(result: AnalysisResult, commands: string[]): boolean {
  return result.commandBlocks.some(block => commands.includes(block.command) && block.parsed);
}

function findingRelatesToRow(finding: Finding, row: IpInventoryRecord): boolean {
  const text = [finding.target, finding.targetDescription, finding.title, finding.description, ...finding.evidence.map(item => item.text)]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return text.includes(row.ip.toLowerCase()) || row.macs.some(mac => text.includes(mac.toLowerCase()) || text.includes(mac.replaceAll(":", ".").toLowerCase()));
}

function findingRelatesToMac(finding: Finding, mac: string): boolean {
  const text = [finding.target, finding.title, finding.description, ...finding.evidence.map(item => item.text)]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return text.includes(mac.toLowerCase()) || text.includes(mac.replaceAll(":", ".").toLowerCase());
}

function hasSetMismatch<T extends string | number>(a: T[], b: T[]): boolean {
  if (!a.length || !b.length) return false;
  const left = new Set(a);
  const right = new Set(b);
  return [...left].some(item => !right.has(item)) || [...right].some(item => !left.has(item));
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function stateLabel(state: CheckState, language: "en" | "th"): string {
  if (language === "th") {
    return state === "found" ? "พบข้อมูล" : state === "clear" ? "ไม่พบปัญหา" : state === "warning" ? "ต้องตรวจเพิ่ม" : "ยังไม่มีข้อมูล";
  }
  return state === "found" ? "Observed" : state === "clear" ? "No issue found" : state === "warning" ? "Needs review" : "Not collected";
}

function badgeSeverity(state: CheckState): Severity {
  return state === "found" ? "Passed" : state === "warning" ? "High" : state === "clear" ? "Info" : "Low";
}
