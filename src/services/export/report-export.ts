import jsPDF from "jspdf";
import type { AnalysisResult } from "@/types/network";
import { downloadText } from "@/lib/utils";
import { ipInSubnet, ipToNumber } from "@/utils/ip";

export function exportJson(result: AnalysisResult) {
  downloadText("netscope-analysis.json", JSON.stringify(result, null, 2), "application/json;charset=utf-8");
}

export function exportMarkdown(result: AnalysisResult) {
  const poolRows = poolReportRows(result);
  const missingCommands = result.recommendedCommands;
  const verifiedFree = result.freeIps.filter(row => row.confidence >= 60);
  const configFree = result.freeIps.filter(row => row.confidence < 60);
  const poolNotFree = result.ipInventory.filter(row => row.status === "Not Free - In DHCP Pool");
  const anomalies = [...result.findings, ...result.blockedDevices].filter(item => item.severity !== "Info" && item.severity !== "Passed");
  const lines = [
    "# NetScope Analyzer Report",
    "",
    `Generated: ${result.generatedAt}`,
    `Devices: ${result.devices.length}`,
    `Subnets: ${result.subnets.length}`,
    `Security Score: ${result.securityScore}/100`,
    "",
    "## Likely Free IP - Verified",
    ...sectionRows(verifiedFree.map(row => `- ${row.ip} (${row.confidence}%): ${row.statusReason ?? row.sources.join(", ")}`)),
    "",
    "## Likely Free IP - Config Candidate",
    ...sectionRows(configFree.map(row => `- ${row.ip} (${row.confidence}%): ${row.statusReason ?? row.sources.join(", ")}`)),
    "",
    "## IP In DHCP Pool - Not Reusable Static Free",
    ...sectionRows(poolNotFree.map(row => `- ${row.ip}: ${row.relatedPoolNames?.join(", ") || "DHCP pool"} (${row.confidence}%)`)),
    "",
    "## DHCP Pool Analysis",
    ...sectionRows(poolRows.map(row => `- ${row.name} ${row.network}: leased=${row.leased}, poolFree=${row.poolFree}, excluded=${row.excluded}, reserved=${row.reserved}, conflict=${row.conflict}, gateway=${row.gateway || "-"}`)),
    "",
    "## Subnet Utilization",
    ...sectionRows(result.subnets.map(subnet => `- ${subnet.cidr}: used=${subnet.used}, likelyFree=${subnet.free}, usable=${subnet.totalUsable}, utilization=${subnet.utilization}%`)),
    "",
    "## MAC/IP Anomalies",
    ...sectionRows(anomalies.map(finding => `- **${finding.severity}** ${finding.title}${finding.target ? ` (${finding.target})` : ""}: ${finding.description}`)),
    "",
    "## Missing Commands",
    ...sectionRows(missingCommands.map(command => `- ${command}`)),
    "",
    "## Findings",
    ...sectionRows(result.findings.map(finding => `- **${finding.severity}** ${finding.title}${finding.target ? ` (${finding.target})` : ""}: ${finding.description}`))
  ];
  downloadText("netscope-report.md", lines.join("\n"), "text/markdown;charset=utf-8");
}

export function exportPdf(result: AnalysisResult) {
  const pdf = new jsPDF();
  pdf.setFontSize(16);
  pdf.text("NetScope Analyzer Report", 14, 18);
  pdf.setFontSize(10);
  const lines = [
    `Generated: ${result.generatedAt}`,
    `Devices: ${result.devices.length}`,
    `Subnets: ${result.subnets.length}`,
    `Used IP: ${result.usedIps.length}`,
    `Likely Free IP: ${result.freeIps.length}`,
    `Security Score: ${result.securityScore}/100`,
    "",
    "Top Findings:",
    ...result.findings.slice(0, 12).map(finding => `${finding.severity}: ${finding.title} ${finding.target ?? ""}`)
  ];
  pdf.text(lines, 14, 30);
  pdf.save("netscope-report.pdf");
}

export function exportExcel(result: AnalysisResult) {
  const poolRows = poolReportRows(result);
  const sheets = [
    sheetXml("Summary", [{
    generatedAt: result.generatedAt,
    devices: result.devices.length,
    subnets: result.subnets.length,
    usedIp: result.usedIps.length,
    freeIp: result.freeIps.length,
    securityScore: result.securityScore
    }]),
    sheetXml("Devices", result.devices.map(device => ({ ...device, commands: device.commands.join(", ") }))),
    sheetXml("IP Inventory", result.ipInventory.map(({ evidence, macs, vlans, ports, sources, ...row }) => ({
      ...row,
      macs: macs.join(", "),
      vlans: vlans.join(", "),
      ports: ports.join(", "),
      sources: sources.join(", "),
      evidenceCount: evidence.length
    }))),
    sheetXml("Free IPs", result.freeIps.map(({ evidence, macs, vlans, ports, sources, checkedSources, missingSources, relatedPoolNames, ...row }) => ({
      ...row,
      level: row.confidence >= 60 ? "Likely Free - Verified" : "Likely Free - Config Candidate",
      macs: macs.join(", "),
      vlans: vlans.join(", "),
      ports: ports.join(", "),
      sources: sources.join(", "),
      checkedSources: checkedSources?.join(", ") ?? "",
      missingSources: missingSources?.join(", ") ?? "",
      relatedPoolNames: relatedPoolNames?.join(", ") ?? "",
      evidenceCount: evidence.length
    }))),
    sheetXml("Pool Not Free", result.ipInventory.filter(row => row.status === "Not Free - In DHCP Pool").map(({ evidence, macs, vlans, ports, sources, checkedSources, missingSources, relatedPoolNames, ...row }) => ({
      ...row,
      macs: macs.join(", "),
      vlans: vlans.join(", "),
      ports: ports.join(", "),
      sources: sources.join(", "),
      checkedSources: checkedSources?.join(", ") ?? "",
      missingSources: missingSources?.join(", ") ?? "",
      relatedPoolNames: relatedPoolNames?.join(", ") ?? "",
      evidenceCount: evidence.length
    }))),
    sheetXml("DHCP Pools", poolRows),
    sheetXml("Subnet Utilization", result.subnets.map(subnet => ({
      cidr: subnet.cidr,
      network: subnet.network,
      prefix: subnet.prefix,
      firstHost: subnet.firstHost,
      lastHost: subnet.lastHost,
      totalUsable: subnet.totalUsable,
      used: subnet.used,
      likelyFree: subnet.free,
      utilization: subnet.utilization
    }))),
    sheetXml("Findings", result.findings.map(({ evidence, verificationCommands, ...row }) => ({
    ...row,
    evidenceCount: evidence.length,
    verificationCommands: verificationCommands.join("\n")
    }))),
    sheetXml("Missing Commands", result.recommendedCommands.map(command => ({ command }))),
    sheetXml("Security", result.securityChecks.map(({ evidence, ...row }) => ({ ...row, evidenceCount: evidence.length })))
  ];
  const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
${sheets.join("\n")}
</Workbook>`;
  downloadText("netscope-analysis.xls", xml, "application/vnd.ms-excel;charset=utf-8");
}

function sectionRows(rows: string[]): string[] {
  return rows.length ? rows : ["- None"];
}

function poolReportRows(result: AnalysisResult) {
  return result.dhcpPools.map(pool => {
    const inPool = (ip: string) => Boolean(pool.network && pool.prefix !== undefined && ipInSubnet(ip, pool.network, pool.prefix));
    const excludedRanges = result.dhcpExcludedRanges.filter(range => inPool(range.startIp) || inPool(range.endIp));
    const excluded = excludedRanges.reduce((total, range) => total + ipRangeCount(range.startIp, range.endIp), 0);
    const reserved = result.dhcpPools.filter(item => item.host && inPool(item.host)).length;
    const conflict = result.dhcpConflicts.filter(item => inPool(item.ip)).length;
    const leased = pool.leased ?? result.dhcpBindings.filter(item => inPool(item.ip)).length;
    const total = pool.total ?? 0;
    return {
      name: pool.name,
      network: pool.network ? `${pool.network}/${pool.prefix ?? "?"}` : "",
      leased,
      total,
      poolFree: Math.max(0, total - leased - excluded - reserved - conflict),
      excluded,
      reserved,
      conflict,
      utilization: pool.utilization ?? "",
      gateway: pool.defaultRouters.join(", "),
      dns: pool.dnsServers.join(", "),
      warning: "Pool free is DHCP scope capacity only; do not treat it as reusable static free IP."
    };
  });
}

function ipRangeCount(startIp: string, endIp: string) {
  const start = ipToNumber(startIp);
  const end = ipToNumber(endIp);
  if (start === null || end === null) return 0;
  return Math.max(0, end - start + 1);
}

function sheetXml(name: string, rows: Array<Record<string, unknown>>): string {
  const keys = [...new Set(rows.flatMap(row => Object.keys(row)))];
  const header = `<Row>${keys.map(key => cell(key)).join("")}</Row>`;
  const body = rows.map(row => `<Row>${keys.map(key => cell(row[key])).join("")}</Row>`).join("\n");
  return `<Worksheet ss:Name="${escapeXml(name)}"><Table>${header}${body}</Table></Worksheet>`;
}

function cell(value: unknown): string {
  const type = typeof value === "number" ? "Number" : "String";
  return `<Cell><Data ss:Type="${type}">${escapeXml(String(value ?? ""))}</Data></Cell>`;
}

function escapeXml(value: string): string {
  return value.replace(/[<>&'"]/g, char => ({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    "'": "&apos;",
    "\"": "&quot;"
  }[char] ?? char));
}
