import jsPDF from "jspdf";
import type { AnalysisResult } from "@/types/network";
import { downloadText } from "@/lib/utils";

export function exportJson(result: AnalysisResult) {
  downloadText("netscope-analysis.json", JSON.stringify(result, null, 2), "application/json;charset=utf-8");
}

export function exportMarkdown(result: AnalysisResult) {
  const lines = [
    "# NetScope Analyzer Report",
    "",
    `Generated: ${result.generatedAt}`,
    `Devices: ${result.devices.length}`,
    `Subnets: ${result.subnets.length}`,
    `Security Score: ${result.securityScore}/100`,
    "",
    "## Findings",
    ...result.findings.map(finding => `- **${finding.severity}** ${finding.title}${finding.target ? ` (${finding.target})` : ""}: ${finding.description}`)
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
    sheetXml("Findings", result.findings.map(({ evidence, verificationCommands, ...row }) => ({
    ...row,
    evidenceCount: evidence.length,
    verificationCommands: verificationCommands.join("\n")
    }))),
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
