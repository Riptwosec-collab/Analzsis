"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { ReactFlow, Background, Controls, type Edge, type Node } from "@xyflow/react";
import {
  CheckCircle2,
  Download,
  FileJson,
  FileSpreadsheet,
  FileText,
  Loader2,
  Moon,
  Play,
  ShieldAlert,
  Trash2
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useTheme } from "next-themes";
import { NAV_ITEMS, type ViewId } from "@/constants/navigation";
import { SAMPLE_DATA } from "@/constants/sample-data";
import { translations } from "@/constants/translations";
import { analyzeCli } from "@/parsers";
import { exportExcel, exportJson, exportMarkdown, exportPdf } from "@/services/export/report-export";
import { sanitizeCli, scanSensitiveData } from "@/services/sanitization/sanitizer";
import { useAnalysisStore } from "@/store/analysis-store";
import type { AnalysisResult, Finding, IpInventoryRecord, SecurityCheck } from "@/types/network";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export function NetScopeApp({ initialView }: { initialView: ViewId }) {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const { cliText, result, progress, setCliText, setResult, setProgress, clear } = useAnalysisStore();
  const [language, setLanguage] = useState<"en" | "th">("en");
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const t = translations[language];
  const currentView = routeToView(pathname, initialView);
  const criticalCount = result?.findings.filter(finding => finding.severity === "Critical").length ?? 0;

  async function analyze() {
    if (!cliText.trim()) return;
    setBusy(true);
    setProgress("Parsing CLI");
    try {
      const next = await runAnalysis(cliText);
      setResult(next);
    } finally {
      setBusy(false);
    }
  }

  const sensitiveHits = useMemo(() => scanSensitiveData(cliText), [cliText]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-border bg-card/95 lg:block">
        <div className="flex h-16 items-center border-b px-5">
          <div>
            <div className="text-base font-semibold">NetScope Analyzer</div>
            <div className="text-xs text-muted-foreground">CLI Security Audit</div>
          </div>
        </div>
        <nav className="space-y-1 p-3">
          {NAV_ITEMS.map(item => {
            const active = routeToView(pathname, initialView) === item.id;
            const Icon = item.icon;
            return (
              <Link
                key={item.id}
                href={item.href}
                className={cn(
                  "flex items-center justify-between rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                  active && "bg-accent text-accent-foreground"
                )}
              >
                <span className="flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  {item.label}
                </span>
                {item.id === "conflicts" && criticalCount > 0 ? <Badge severity="Critical">{criticalCount}</Badge> : null}
              </Link>
            );
          })}
        </nav>
      </aside>

      <main className="lg:pl-64">
        <header className="sticky top-0 z-20 flex min-h-16 items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur md:px-6">
          <div>
            <h1 className="text-lg font-semibold">{t.appName}</h1>
            <p className="text-xs text-muted-foreground">{t.tagline}</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              aria-label="Language"
              value={language}
              onChange={event => setLanguage(event.target.value as "en" | "th")}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="en">EN</option>
              <option value="th">TH</option>
            </select>
            <Button variant="outline" size="icon" aria-label="Toggle theme" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
              <Moon className="h-4 w-4" />
            </Button>
          </div>
        </header>

        <div className="space-y-5 p-4 md:p-6">
          <Card className="border-cyan-500/25">
            <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
              <div className="text-sm text-muted-foreground">{t.currentOnly}</div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => setCliText(SAMPLE_DATA)} variant="secondary">{t.loadSample}</Button>
                <Button size="sm" onClick={analyze} disabled={busy || !cliText.trim()}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                  {t.analyze}
                </Button>
                <Button size="sm" variant="outline" onClick={() => { setCliText(sanitizeCli(cliText, "mask")); }}>
                  <ShieldAlert className="h-4 w-4" />
                  {t.sanitize}
                </Button>
                <Button size="sm" variant="ghost" onClick={clear}>
                  <Trash2 className="h-4 w-4" />
                  {t.clear}
                </Button>
              </div>
            </CardContent>
          </Card>

          {currentView === "import" ? (
            <ImportView
              cliText={cliText}
              setCliText={setCliText}
              progress={progress}
              busy={busy}
              analyze={analyze}
              sensitiveHits={sensitiveHits}
            />
          ) : null}

          {!result && currentView !== "import" ? <EmptyState /> : null}
          {result ? <ViewRouter view={currentView} result={result} query={query} setQuery={setQuery} /> : null}
        </div>
      </main>
    </div>
  );
}

function ViewRouter({
  view,
  result,
  query,
  setQuery
}: {
  view: ViewId;
  result: AnalysisResult;
  query: string;
  setQuery: (query: string) => void;
}) {
  switch (view) {
    case "overview":
      return <Overview result={result} />;
    case "ip-inventory":
      return <IpTable title="IP Inventory" rows={filterInventory(result.ipInventory, query)} query={query} setQuery={setQuery} />;
    case "free-ip":
      return <IpTable title="Likely Free IP" rows={filterInventory(result.freeIps, query)} query={query} setQuery={setQuery} />;
    case "used-ip":
      return <IpTable title="Used IP" rows={filterInventory(result.usedIps, query)} query={query} setQuery={setQuery} />;
    case "devices":
      return <Devices result={result} />;
    case "vlans":
      return <Vlans result={result} />;
    case "conflicts":
      return <Findings title="Conflicts & Anomalies" findings={result.findings.filter(f => f.category !== "Security")} />;
    case "security":
      return <Security result={result} />;
    case "blocked-devices":
      return <Findings title="Blocked, Denied & Err-disabled" findings={result.blockedDevices} />;
    case "topology":
      return <Topology result={result} />;
    case "troubleshooting":
      return <Troubleshooting result={result} />;
    case "reports":
      return <Reports result={result} />;
    case "settings":
      return <Settings />;
    case "import":
      return null;
    default:
      return <Overview result={result} />;
  }
}

function ImportView({
  cliText,
  setCliText,
  progress,
  busy,
  analyze,
  sensitiveHits
}: {
  cliText: string;
  setCliText: (text: string) => void;
  progress: string;
  busy: boolean;
  analyze: () => void;
  sensitiveHits: { type: string; line: number; preview: string }[];
}) {
  const preview = useMemo(() => ({
    lines: cliText ? cliText.split(/\r?\n/).length : 0,
    devices: new Set([...cliText.matchAll(/^([A-Za-z0-9_.:-]{2,64})[#>]/gm)].map(match => match[1])).size,
    commands: [...cliText.matchAll(/[#>]\s*(show|sh)\s+(.+)$/gim)].length,
    bytes: new Blob([cliText]).size
  }), [cliText]);

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <Card>
        <CardHeader>
          <CardTitle>Smart CLI Import</CardTitle>
          <CardDescription>Paste CLI from routers, switches, firewalls, or wireless controllers. Files remain local in the browser.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            aria-label="CLI input"
            value={cliText}
            onChange={event => setCliText(event.target.value)}
            className="min-h-[460px] font-mono text-xs"
            placeholder="CORE-SW01#show ip arp..."
          />
          <div className="flex flex-wrap gap-2">
            <FilePicker onText={text => setCliText(cliText ? `${cliText}\n${text}` : text)} />
            <Button onClick={analyze} disabled={busy || !cliText.trim()}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Analyze
            </Button>
          </div>
        </CardContent>
      </Card>
      <div className="space-y-5">
        <MetricCard label="Lines" value={preview.lines} />
        <MetricCard label="Detected Devices" value={preview.devices} />
        <MetricCard label="Detected Commands" value={preview.commands} />
        <MetricCard label="Input Size" value={`${(preview.bytes / 1024).toFixed(1)} KB`} />
        <Card>
          <CardHeader>
            <CardTitle>Parsing Progress</CardTitle>
            <CardDescription>{progress}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-2 rounded-full bg-muted">
              <div className="h-2 w-3/4 rounded-full bg-primary" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Sensitive Data</CardTitle>
            <CardDescription>{sensitiveHits.length} possible sensitive lines</CardDescription>
          </CardHeader>
          <CardContent className="max-h-44 space-y-2 overflow-auto text-xs">
            {sensitiveHits.length ? sensitiveHits.slice(0, 8).map(hit => (
              <div key={`${hit.type}-${hit.line}`} className="rounded-md border border-border p-2">
                <Badge severity="High">{hit.type}</Badge>
                <div className="mt-1 font-mono text-muted-foreground">Line {hit.line}: {hit.preview}</div>
              </div>
            )) : <div className="text-muted-foreground">No obvious sensitive data detected.</div>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Overview({ result }: { result: AnalysisResult }) {
  const summary = [
    ["Devices", result.devices.length],
    ["Subnets", result.subnets.length],
    ["VLANs", result.vlans.length],
    ["Interfaces", result.interfaces.length],
    ["Used IP", result.usedIps.length],
    ["Free IP", result.freeIps.length],
    ["Findings", result.findings.length],
    ["Security Score", `${result.securityScore}/100`]
  ];
  const issueData = ["Critical", "High", "Medium", "Low"].map(severity => ({
    severity,
    count: result.findings.filter(finding => finding.severity === severity).length
  }));
  const ipData = [
    { name: "Used", value: result.usedIps.length },
    { name: "Likely Free", value: result.freeIps.length },
    { name: "Reserved", value: result.ipInventory.filter(item => item.status === "Reserved").length },
    { name: "Unknown", value: result.ipInventory.filter(item => item.status === "Unknown").length }
  ];

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summary.map(([label, value]) => <MetricCard key={label} label={String(label)} value={value} />)}
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <ChartCard title="IP Status">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={ipData} dataKey="value" outerRadius={90} label>
                {ipData.map((entry, index) => <Cell key={entry.name} fill={["#22c55e", "#38bdf8", "#a78bfa", "#94a3b8"][index]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Issue Severity">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={issueData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="severity" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#38bdf8" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
      <Findings title="Critical Findings" findings={result.findings.slice(0, 6)} />
    </div>
  );
}

function IpTable({ title, rows, query, setQuery }: { title: string; rows: IpInventoryRecord[]; query: string; setQuery: (query: string) => void }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{rows.length} rows from current analysis</CardDescription>
      </CardHeader>
      <CardContent>
        <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search IP, MAC, VLAN, Port" className="mb-3 h-9 w-full rounded-md border border-input bg-background px-3 text-sm" />
        <DataTable headers={["IP", "Status", "Confidence", "MAC", "VLAN", "Ports", "Sources"]}>
          {rows.slice(0, 400).map(row => (
            <TableRow key={row.ip}>
              <TableCell className="font-mono">{row.ip}</TableCell>
              <TableCell><Badge severity={row.status === "Used" ? "Passed" : row.status === "Likely Free" ? "Low" : "Info"}>{row.status}</Badge></TableCell>
              <TableCell>{row.confidence}%</TableCell>
              <TableCell className="font-mono">{row.macs.join(", ") || "-"}</TableCell>
              <TableCell>{row.vlans.join(", ") || "-"}</TableCell>
              <TableCell className="font-mono">{row.ports.join(", ") || "-"}</TableCell>
              <TableCell>{row.sources.join(", ")}</TableCell>
            </TableRow>
          ))}
        </DataTable>
      </CardContent>
    </Card>
  );
}

function Devices({ result }: { result: AnalysisResult }) {
  return (
    <Card>
      <CardHeader><CardTitle>Devices</CardTitle><CardDescription>Detected hostnames, vendors, and command coverage</CardDescription></CardHeader>
      <CardContent>
        <DataTable headers={["Hostname", "Vendor", "Commands"]}>
          {result.devices.map(device => (
            <TableRow key={device.hostname}>
              <TableCell className="font-mono">{device.hostname}</TableCell>
              <TableCell>{device.vendor}</TableCell>
              <TableCell>{device.commands.join(", ")}</TableCell>
            </TableRow>
          ))}
        </DataTable>
      </CardContent>
    </Card>
  );
}

function Vlans({ result }: { result: AnalysisResult }) {
  return (
    <Card>
      <CardHeader><CardTitle>VLAN & Ports</CardTitle><CardDescription>VLAN records and interface state from current CLI</CardDescription></CardHeader>
      <CardContent>
        <DataTable headers={["Interface/VLAN", "Status", "VLAN", "Mode", "IP"]}>
          {result.interfaces.map(row => (
            <TableRow key={`${row.name}-${row.ip ?? row.vlan ?? ""}`}>
              <TableCell className="font-mono">{row.name}</TableCell>
              <TableCell>{row.status ?? "-"}</TableCell>
              <TableCell>{row.vlan ?? "-"}</TableCell>
              <TableCell>{row.mode ?? "-"}</TableCell>
              <TableCell className="font-mono">{row.ip ?? "-"}</TableCell>
            </TableRow>
          ))}
        </DataTable>
      </CardContent>
    </Card>
  );
}

function Findings({ title, findings }: { title: string; findings: Finding[] }) {
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle><CardDescription>{findings.length} findings with confidence and evidence</CardDescription></CardHeader>
      <CardContent className="space-y-3">
        {findings.length ? findings.map(finding => (
          <div key={finding.id} className="rounded-lg border border-border p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge severity={finding.severity}>{finding.severity}</Badge>
              <div className="font-medium">{finding.title}</div>
              {finding.target ? <div className="font-mono text-xs text-muted-foreground">{finding.target}</div> : null}
              <div className="ms-auto text-xs text-muted-foreground">Confidence {finding.confidence}%</div>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{finding.description}</p>
            <p className="mt-2 text-sm">{finding.recommendation}</p>
            <div className="mt-3 grid gap-2 lg:grid-cols-2">
              <pre className="overflow-auto rounded-md bg-muted p-3 text-xs">{finding.verificationCommands.join("\n")}</pre>
              <pre className="overflow-auto rounded-md bg-muted p-3 text-xs">{finding.evidence.slice(0, 4).map(e => `${e.device}:${e.line} ${e.text}`).join("\n") || "No direct evidence lines available."}</pre>
            </div>
          </div>
        )) : <EmptyPanel text="No findings in this category from the current CLI input." />}
      </CardContent>
    </Card>
  );
}

function Security({ result }: { result: AnalysisResult }) {
  return (
    <div className="space-y-5">
      <MetricCard label="Security Score" value={`${result.securityScore}/100`} />
      <Card>
        <CardHeader><CardTitle>Security Checks</CardTitle><CardDescription>Layer 2 and sensitive-data checks from current CLI</CardDescription></CardHeader>
        <CardContent>
          <DataTable headers={["Check", "Status", "Severity", "Evidence", "Recommendation"]}>
            {result.securityChecks.map((check: SecurityCheck) => (
              <TableRow key={check.id}>
                <TableCell>{check.name}</TableCell>
                <TableCell><Badge severity={check.status === "Passed" ? "Passed" : check.severity}>{check.status}</Badge></TableCell>
                <TableCell>{check.severity}</TableCell>
                <TableCell>{check.evidence.length}</TableCell>
                <TableCell>{check.recommendation}</TableCell>
              </TableRow>
            ))}
          </DataTable>
        </CardContent>
      </Card>
    </div>
  );
}

function Topology({ result }: { result: AnalysisResult }) {
  const nodes: Node[] = result.devices.map((device, index) => ({
    id: device.hostname,
    position: { x: 140 + (index % 4) * 220, y: 90 + Math.floor(index / 4) * 160 },
    data: { label: device.hostname },
    type: "default"
  }));
  const existing = new Set(nodes.map(node => node.id));
  result.topology.forEach((link, index) => {
    if (!existing.has(link.remoteDevice)) {
      nodes.push({ id: link.remoteDevice, position: { x: 220 + index * 180, y: 280 }, data: { label: link.remoteDevice } });
      existing.add(link.remoteDevice);
    }
  });
  const edges: Edge[] = result.topology.map((link, index) => ({
    id: `edge-${index}`,
    source: link.localDevice,
    target: link.remoteDevice,
    label: `${link.protocol} ${link.localInterface ?? ""} -> ${link.remoteInterface ?? ""}`,
    animated: false
  }));
  return (
    <Card>
      <CardHeader><CardTitle>Topology</CardTitle><CardDescription>Built from CDP/LLDP detail blocks when available</CardDescription></CardHeader>
      <CardContent>
        <div className="h-[560px] overflow-hidden rounded-lg border border-border">
          <ReactFlow nodes={nodes} edges={edges} fitView>
            <Background />
            <Controls />
          </ReactFlow>
        </div>
      </CardContent>
    </Card>
  );
}

function Troubleshooting({ result }: { result: AnalysisResult }) {
  return (
    <Card>
      <CardHeader><CardTitle>Troubleshooting Commands</CardTitle><CardDescription>Read-only verification commands. NetScope never sends commands to devices.</CardDescription></CardHeader>
      <CardContent>
        <pre className="overflow-auto rounded-md bg-muted p-4 text-sm">{result.recommendedCommands.join("\n") || "No commands generated yet."}</pre>
        <Button className="mt-3" variant="outline" onClick={() => navigator.clipboard.writeText(result.recommendedCommands.join("\n"))}>Copy Commands</Button>
      </CardContent>
    </Card>
  );
}

function Reports({ result }: { result: AnalysisResult }) {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle>Export Reports</CardTitle><CardDescription>Generated from the current analysis only</CardDescription></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button onClick={() => exportPdf(result)}><Download className="h-4 w-4" />PDF</Button>
          <Button onClick={() => exportExcel(result)} variant="secondary"><FileSpreadsheet className="h-4 w-4" />Excel</Button>
          <Button onClick={() => exportJson(result)} variant="outline"><FileJson className="h-4 w-4" />JSON</Button>
          <Button onClick={() => exportMarkdown(result)} variant="outline"><FileText className="h-4 w-4" />Markdown</Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Telegram Summary</CardTitle><CardDescription>Copy-ready summary. No automatic sending in this version.</CardDescription></CardHeader>
        <CardContent>
          <pre className="min-h-60 overflow-auto rounded-md bg-muted p-4 text-sm">{result.telegramSummary}</pre>
          <Button className="mt-3" variant="outline" onClick={() => navigator.clipboard.writeText(result.telegramSummary)}>Copy Summary</Button>
        </CardContent>
      </Card>
    </div>
  );
}

function Settings() {
  return (
    <Card>
      <CardHeader><CardTitle>Settings</CardTitle><CardDescription>Local UI preferences only. Raw CLI is not stored by default.</CardDescription></CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        {["Theme", "Language", "Default Vendor", "Severity Threshold", "DHCP Pool Warning %", "Free IP Confidence", "Report Header", "Include Evidence"].map(item => (
          <label key={item} className="grid gap-1 text-sm">
            <span>{item}</span>
            <input className="h-9 rounded-md border border-input bg-background px-3" placeholder="Configure as needed" />
          </label>
        ))}
      </CardContent>
    </Card>
  );
}

function DataTable({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-auto rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>{headers.map(header => <TableHead key={header}>{header}</TableHead>)}</TableRow>
        </TableHeader>
        <TableBody>{children}</TableBody>
      </Table>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="mt-2 text-2xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function EmptyState() {
  return (
    <Card>
      <CardContent className="flex min-h-80 flex-col items-center justify-center gap-3 text-center">
        <CheckCircle2 className="h-10 w-10 text-muted-foreground" />
        <div className="text-lg font-semibold">Paste CLI or load demo data to begin</div>
        <p className="max-w-xl text-sm text-muted-foreground">The dashboard only shows data derived from current CLI input. Use CLI Import to analyze router, switch, firewall, or controller output.</p>
        <Button asChild><Link href="/import">Open CLI Import</Link></Button>
      </CardContent>
    </Card>
  );
}

function EmptyPanel({ text }: { text: string }) {
  return <div className="rounded-md border border-dashed border-border p-6 text-sm text-muted-foreground">{text}</div>;
}

function FilePicker({ onText }: { onText: (text: string) => void }) {
  return (
    <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent">
      Upload Files
      <input
        type="file"
        className="hidden"
        multiple
        accept=".txt,.log,.cfg,.conf"
        onChange={async event => {
          const files = [...(event.target.files ?? [])];
          const text = (await Promise.all(files.map(file => file.text()))).join("\n");
          onText(text);
        }}
      />
    </label>
  );
}

function filterInventory(rows: IpInventoryRecord[], query: string) {
  if (!query.trim()) return rows;
  const q = query.toLowerCase();
  return rows.filter(row => [row.ip, row.status, ...row.macs, ...row.ports, ...row.sources, ...row.vlans.map(String)].join(" ").toLowerCase().includes(q));
}

function routeToView(pathname: string, fallback: ViewId): ViewId {
  const match = NAV_ITEMS.find(item => item.href === pathname);
  return match?.id ?? fallback;
}

async function runAnalysis(text: string): Promise<AnalysisResult> {
  if (typeof Worker === "undefined") return analyzeCli(text);
  try {
    return await new Promise<AnalysisResult>((resolve, reject) => {
      const worker = new Worker(new URL("../workers/analysis-worker.ts", import.meta.url));
      worker.onmessage = event => {
        resolve(event.data as AnalysisResult);
        worker.terminate();
      };
      worker.onerror = error => {
        reject(error);
        worker.terminate();
      };
      worker.postMessage({ text });
    });
  } catch {
    return analyzeCli(text);
  }
}
