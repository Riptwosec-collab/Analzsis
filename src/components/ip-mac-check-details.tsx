"use client";

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { useAnalysisStore } from "@/store/analysis-store";
import type { AnalysisResult, Finding, IpInventoryRecord, Severity } from "@/types/network";
import { normalizeVrf, scopeFromEvidence } from "@/evidence/evidence-scope";
import { ipInSubnet, ipToNumber } from "@/utils/ip";

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

      <div className="rounded-lg border border-cyan-400/15 bg-slate-950/45 p-3">
        <div className="text-sm font-medium">Selected item problem summary</div>
        <ul className="mt-2 space-y-1 text-xs leading-5 text-cyan-50/80">
          {model.problemLines.map(line => <li key={line}>- {line}</li>)}
        </ul>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {model.checks.map(check => (
          <article key={check.id} className="rounded-lg border border-cyan-400/15 bg-slate-950/45 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="text-sm font-medium">{check.title}</div>
              <Badge severity={badgeSeverity(check.state)}>{stateLabel(check.state, language)}</Badge>
            </div>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">{check.detail}</p>
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
            <dt className="text-muted-foreground">{language === "th" ? "เหตุผลการจัดประเภท" : "Classification reason"}</dt>
            <dd>{classificationReasonText(row, language)}</dd>
            <dt className="text-muted-foreground">{language === "th" ? "DHCP Pool ที่เกี่ยวข้อง" : "Related DHCP pools"}</dt>
            <dd>{row.relatedPoolNames?.join(", ") || "-"}</dd>
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

      <div className="border-t border-cyan-400/15 pt-3 text-xs text-cyan-100/75">
        <span className="font-medium text-cyan-50">{language === "th" ? "แหล่งตรวจ:" : "Sources checked:"}</span>{" "}
        {model.sources.join(", ") || "-"}
        {row.missingSources?.length ? (
          <span className="text-muted-foreground"> {language === "th" ? `· หลักฐานที่ยังขาด: ${row.missingSources.join(", ")}` : `· Missing evidence: ${row.missingSources.join(", ")}`}</span>
        ) : null}
      </div>
    </section>
  );
}

function buildCheckModel(row: IpInventoryRecord, result: AnalysisResult, language: "en" | "th") {
  const recordScope = (evidence: IpInventoryRecord["evidence"], ip?: string, vrf?: string) => {
    const scope = scopeFromEvidence(evidence, { vrf });
    if (vrf || !ip) return scope;
    const candidates = result.subnets.filter(subnet => subnet.deviceId === scope.deviceId && ipInSubnet(ip, subnet.network, subnet.prefix));
    return candidates.length === 1 ? scopeFromEvidence(evidence, { vrf: candidates[0].vrf }) : scope;
  };
  const inRowScope = (evidence: IpInventoryRecord["evidence"], ip?: string, vrf?: string) => {
    const scope = recordScope(evidence, ip, vrf);
    return scope.deviceId === row.deviceId && normalizeVrf(scope.vrf) === row.vrf;
  };
  const arpMatches = result.arp.filter(item => inRowScope(item.evidence, item.ip, item.vrf) && (item.ip === row.ip || Boolean(item.mac && row.macs.includes(item.mac))));
  const dhcpBindings = result.dhcpBindings.filter(item => inRowScope(item.evidence, item.ip, item.vrf) && (item.ip === row.ip || Boolean(item.mac && row.macs.includes(item.mac))));
  const reservationPools = result.dhcpPools.filter(pool => inRowScope(pool.evidence, pool.host ?? pool.network, pool.vrf) && (pool.host === row.ip || Boolean(pool.hardwareAddress && row.macs.includes(pool.hardwareAddress))));
  const networkPools = result.dhcpPools.filter(pool => inRowScope(pool.evidence, pool.network, pool.vrf) && pool.network && pool.prefix !== undefined && ipInSubnet(row.ip, pool.network, pool.prefix));
  const excludedRanges = result.dhcpExcludedRanges.filter(range => inRowScope(range.evidence, range.startIp, range.vrf) && ipInRange(row.ip, range.startIp, range.endIp));
  const dhcpConflicts = result.dhcpConflicts.filter(item => inRowScope(item.evidence, item.ip, item.vrf) && item.ip === row.ip);
  const macRows = result.macTable.filter(item => inRowScope(item.evidence) && row.macs.includes(item.mac));
  const interfaces = result.interfaces.filter(item => inRowScope(item.evidence, item.ip, item.vrf) && (item.ip === row.ip || row.ports.includes(item.name) || arpMatches.some(arp => arp.interfaceName === item.name)));
  const subnets = result.subnets.filter(subnet => subnet.deviceId === row.deviceId && subnet.vrf === row.vrf && ipInSubnet(row.ip, subnet.network, subnet.prefix));
  const relatedFindings = [...result.findings, ...result.blockedDevices]
    .filter(finding => findingRelatesToRow(finding, row) && finding.evidence.some(item => inRowScope([item], row.ip)))
    .filter((finding, index, all) => all.findIndex(candidate => candidate.id === finding.id) === index);
  const relatedLogs = result.logs.filter(log => inRowScope(log.evidence, log.ip) && (log.ip === row.ip || Boolean(log.mac && row.macs.includes(log.mac))));

  const hasArpCommand = commandAvailable(result, ["show ip arp", "show arp"], row.deviceId);
  const hasDhcpCommand = commandAvailable(result, ["show ip dhcp binding", "show ip dhcp snooping binding", "show ip source binding", "show running-config"], row.deviceId);
  const hasMacCommand = commandAvailable(result, ["show mac address-table"], row.deviceId);
  const hasInterfaceCommand = commandAvailable(result, ["show interfaces status", "show interfaces description", "show interfaces switchport", "show interfaces trunk", "show ip interface brief", "show running-config"], row.deviceId);
  const hasLogCommand = commandAvailable(result, ["show logging", "show running-config"], row.deviceId);

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
  const mismatchDetails = arpMatches.flatMap(arp => {
    if (!arp.mac) return [];
    const rows = result.macTable.filter(mac => inRowScope(mac.evidence) && mac.mac === arp.mac);
    return rows
      .filter(mac => (arp.vlan !== undefined && mac.vlan !== undefined && arp.vlan !== mac.vlan) || (arp.interfaceName && mac.port !== arp.interfaceName))
      .map(mac => ({
        mac: arp.mac!,
        ip: arp.ip,
        arpVlan: arp.vlan,
        macVlan: mac.vlan,
        arpPort: arp.interfaceName,
        macPort: mac.port
      }));
  });

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
      dhcpBindings.length + reservationPools.length + excludedRanges.length + dhcpConflicts.length,
      language === "th"
        ? `Binding ${dhcpBindings.length} รายการ · Reservation ${reservationPools.length} รายการ · อยู่ใน Dynamic Pool ${networkPools.length} Pool`
        : `${dhcpBindings.length} binding(s) · ${reservationPools.length} reservation(s) · ${excludedRanges.length} excluded range(s) · ${dhcpConflicts.length} conflict(s) · member of ${networkPools.length} dynamic pool(s).`,
      ["show ip dhcp binding", "show ip dhcp snooping binding", "show ip source binding", "show ip dhcp conflict", "show running-config"]
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
    const macTableRows = result.macTable.filter(item => inRowScope(item.evidence) && item.mac === mac);
    const macDhcp = result.dhcpBindings.filter(item => inRowScope(item.evidence, item.ip, item.vrf) && item.mac === mac);
    const macArp = result.arp.filter(item => inRowScope(item.evidence, item.ip, item.vrf) && item.mac === mac);
    const macFindings = [...result.findings, ...result.blockedDevices].filter(finding => findingRelatesToMac(finding, mac) && finding.evidence.some(item => inRowScope([item], row.ip)));
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
      ...excludedRanges.flatMap(item => item.evidence),
      ...dhcpConflicts.flatMap(item => item.evidence),
      ...macRows.flatMap(item => item.evidence),
      ...interfaces.flatMap(item => item.evidence),
      ...relatedFindings.flatMap(item => item.evidence),
      ...relatedLogs.flatMap(item => item.evidence)
    ].map(item => `${item.device}:${item.line} [${item.command}] ${item.text}`)
  ).slice(0, 120);

  return {
    checks,
    problemLines: buildProblemLines({
      row,
      language,
      vlanMismatch,
      portMismatch,
      duplicateFinding,
      blockedFinding,
      relatedFindings,
      relatedLogs,
      macDetails,
      networkPools,
      excludedRanges,
      dhcpConflicts,
      mismatchDetails
    }),
    subnets: subnets.map(item => item.cidr),
    arpSummary: arpMatches.length ? `${arpMatches.length} record(s)` : "-",
    dhcpSummary: `${dhcpBindings.length} binding(s), ${reservationPools.length} reservation(s), ${excludedRanges.length} excluded, ${dhcpConflicts.length} conflict(s)`,
    interfaceSummary: interfaces.map(item => item.name).join(", ") || "-",
    relatedFindings,
    macDetails,
    evidenceLines,
    sources: unique([
      ...row.checkedSources ?? [],
      ...checks.flatMap(check => check.sources)
    ])
  };
}

function buildProblemLines({
  row,
  language,
  vlanMismatch,
  portMismatch,
  duplicateFinding,
  blockedFinding,
  relatedFindings,
  relatedLogs,
  macDetails,
  networkPools,
  excludedRanges,
  dhcpConflicts,
  mismatchDetails
}: {
  row: IpInventoryRecord;
  language: "en" | "th";
  vlanMismatch: boolean;
  portMismatch: boolean;
  duplicateFinding: boolean;
  blockedFinding: boolean;
  relatedFindings: Finding[];
  relatedLogs: AnalysisResult["logs"];
  macDetails: Array<{ mac: string; ports: string[]; arpIps: string[]; dhcpIps: string[]; findingTitles: string[]; hasWarning: boolean }>;
  networkPools: AnalysisResult["dhcpPools"];
  excludedRanges: AnalysisResult["dhcpExcludedRanges"];
  dhcpConflicts: AnalysisResult["dhcpConflicts"];
  mismatchDetails: Array<{ mac: string; ip: string; arpVlan?: number; macVlan?: number; arpPort?: string; macPort: string }>;
}) {
  const lines: string[] = [];
  if (row.status === "Not Free - In DHCP Pool" || row.sources.includes("DHCP Pool range")) {
    lines.push(language === "th"
      ? `${row.ip} อยู่ใน DHCP Pool จึงไม่ถือว่าเป็น IP ว่างสำหรับนำไปใช้แบบ static แม้ยังไม่เห็น lease`
      : `${row.ip} is inside a DHCP pool but has no ARP/DHCP lease evidence, so it is not treated as free.`);
  }
  if (row.status === "Excluded" || excludedRanges.length) {
    lines.push(language === "th"
      ? `${row.ip} ถูกกันไว้ด้วย ip dhcp excluded-address: ${excludedRanges.map(item => `${item.startIp}-${item.endIp}`).join(", ") || "-"}`
      : `${row.ip} is covered by ip dhcp excluded-address: ${excludedRanges.map(item => `${item.startIp}-${item.endIp}`).join(", ") || "-"}.`);
  }
  if (dhcpConflicts.length) {
    lines.push(language === "th"
      ? `${row.ip} มี DHCP conflict ${dhcpConflicts.length} รายการ ต้องตรวจ ARP/MAC/DHCP binding ก่อนใช้งาน`
      : `${row.ip} has ${dhcpConflicts.length} DHCP conflict record(s). Verify ARP, MAC table, and DHCP binding before reuse.`);
  }
  if (row.status === "Unknown" && row.sources.includes("Insufficient evidence for free-IP decision")) {
    lines.push(language === "th"
      ? `${row.ip} ยังไม่ถือว่าว่าง เพราะคำสั่งตรวจ ARP/DHCP/MAC หรือ subnet evidence ยังไม่ครบ`
      : `${row.ip} is not treated as free because ARP/DHCP/MAC or subnet evidence is incomplete.`);
  }
  if (row.missingSources?.length) {
    lines.push(language === "th"
      ? `หลักฐานที่ยังขาดก่อนยืนยันว่า IP ว่างได้: ${row.missingSources.join(", ")}`
      : `Missing evidence before this IP can be treated as likely free: ${row.missingSources.join(", ")}`);
  }
  if (row.statusReason) {
    const reason = classificationReasonText(row, language);
    if (!lines.some(line => line.includes(reason))) {
      lines.push(language === "th" ? `เหตุผลระบบ: ${reason}` : `Classifier reason: ${reason}`);
    }
  }
  if (row.macs.length > 1 || duplicateFinding) {
    lines.push(language === "th"
      ? `${row.ip} มีหลาย MAC หรือมี finding ประเภท duplicate: ${row.macs.join(", ") || relatedFindings.map(item => item.target).filter(Boolean).join(", ")}`
      : `${row.ip} has multiple MACs or a duplicate-related finding: ${row.macs.join(", ") || relatedFindings.map(item => item.target).filter(Boolean).join(", ")}`);
  }
  if (vlanMismatch || portMismatch) {
    lines.push(language === "th"
      ? "ARP กับ MAC table ชี้ VLAN/Port ไม่ตรงกัน ต้องตรวจ uplink, trunk, port-channel หรือ endpoint move"
      : "ARP and MAC-table evidence disagree on VLAN/port. Check uplinks, trunks, port-channels, or endpoint movement.");
  }
  for (const mismatch of mismatchDetails) {
    lines.push(language === "th"
      ? `MAC ${mismatch.mac} ของ IP ${mismatch.ip} ไม่ตรงกัน: ARP VLAN ${mismatch.arpVlan ?? "-"} Port ${mismatch.arpPort ?? "-"} แต่ MAC Table VLAN ${mismatch.macVlan ?? "-"} Port ${mismatch.macPort}`
      : `MAC ${mismatch.mac} for IP ${mismatch.ip} is inconsistent: ARP VLAN ${mismatch.arpVlan ?? "-"} port ${mismatch.arpPort ?? "-"}, MAC table VLAN ${mismatch.macVlan ?? "-"} port ${mismatch.macPort}.`);
  }
  for (const mac of macDetails.filter(item => item.hasWarning)) {
    lines.push(language === "th"
      ? `MAC ${mac.mac} มีข้อสังเกต: ports=${mac.ports.join(", ") || "-"}, ARP IP=${mac.arpIps.join(", ") || "-"}, DHCP IP=${mac.dhcpIps.join(", ") || "-"}, findings=${mac.findingTitles.join(", ") || "-"}`
      : `MAC ${mac.mac} needs review: ports=${mac.ports.join(", ") || "-"}, ARP IP=${mac.arpIps.join(", ") || "-"}, DHCP IP=${mac.dhcpIps.join(", ") || "-"}, findings=${mac.findingTitles.join(", ") || "-"}`);
  }
  if (blockedFinding) {
    lines.push(language === "th"
      ? `พบ event/finding ที่เกี่ยวกับการ block/deny/violation จำนวน ${relatedLogs.length + relatedFindings.length} รายการ`
      : `Found ${relatedLogs.length + relatedFindings.length} block/deny/violation-related event(s) or finding(s).`);
  }
  if (!lines.length) {
    lines.push(language === "th"
      ? `ยังไม่พบความผิดปกติชัดเจนสำหรับ ${row.ip} จากหลักฐานปัจจุบัน แต่ต้องดูว่าคำสั่ง ARP/DHCP/MAC ครบหรือไม่`
      : `No clear anomaly was found for ${row.ip} in the current evidence. Confirm that ARP, DHCP, and MAC-table data were all collected.`);
  }
  if (networkPools.length && row.status !== "Used" && row.status !== "Reserved") {
    lines.push(language === "th"
      ? `เกี่ยวข้องกับ DHCP Pool: ${networkPools.map(pool => pool.name).join(", ")}`
      : `Related DHCP pool(s): ${networkPools.map(pool => pool.name).join(", ")}`);
  }
  return lines;
}

function classificationReasonText(row: IpInventoryRecord, language: "en" | "th") {
  if (language === "en") return row.statusReason ?? "-";
  if (row.status === "Used" && row.sources.includes("ARP")) return "พบ ARP entry ที่ผูก IP กับ MAC จึงถือว่าใช้งานอยู่";
  if (row.status === "Used" && row.sources.includes("DHCP Binding")) return "พบ DHCP binding หรือ source-binding ของ IP นี้ จึงถือว่าใช้งานอยู่";
  if (row.status === "Reserved" && row.sources.includes("DHCP Reservation")) return "พบ DHCP reservation หรือ host pool ที่จอง IP นี้ไว้";
  if (row.status === "Reserved" && row.sources.includes("Interface IP")) return "IP นี้ถูกใช้เป็น IP ของ Interface, SVI หรือ routed interface";
  if (row.status === "Excluded") return "IP นี้ถูกกันไว้ด้วยคำสั่ง ip dhcp excluded-address จึงห้ามนับเป็น IP ว่าง";
  if (row.status === "Not Free - In DHCP Pool") return "IP นี้อยู่ใน dynamic DHCP pool จึงไม่ใช่ IP ว่างสำหรับใช้งานแบบ static";
  if (row.status === "Unknown" && row.sources.includes("DHCP Pool range")) return "IP อยู่ใน dynamic DHCP pool จึงห้ามสรุปว่าว่างจนกว่าจะมี lease, ARP หรือ MAC evidence เพิ่ม";
  if (row.status === "Unknown" && row.sources.includes("Insufficient evidence for free-IP decision")) return "ยังขาดหลักฐาน ARP, DHCP binding, MAC table หรือ subnet evidence จึงยังไม่ยืนยันว่า IP ว่าง";
  if (row.status === "Likely Free") return "ตรวจหลักฐานที่จำเป็นแล้วไม่พบ ARP, DHCP binding, MAC-table, reservation, interface หรือ dynamic-pool evidence ของ IP นี้";
  return row.statusReason ?? "-";
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

function commandAvailable(result: AnalysisResult, commands: string[], deviceId: string): boolean {
  return result.commandBlocks.some(block => block.device === deviceId && commands.includes(block.command) && block.parsed);
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

function ipInRange(ip: string, startIp: string, endIp: string): boolean {
  const value = ipToNumber(ip);
  const start = ipToNumber(startIp);
  const end = ipToNumber(endIp);
  return value !== null && start !== null && end !== null && value >= start && value <= end;
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
