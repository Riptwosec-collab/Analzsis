"use client";

import { useMemo, useState } from "react";
import { Background, Controls, ReactFlow, type Edge, type Node } from "@xyflow/react";
import {
  Activity,
  Calendar,
  CheckCircle2,
  CircuitBoard,
  ClipboardList,
  Database,
  Download,
  FileJson,
  FileSpreadsheet,
  FileText,
  HelpCircle,
  Loader2,
  Moon,
  Power,
  ShieldAlert,
  Terminal,
  Trash2,
  Upload
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useTheme } from "next-themes";
import { NAV_ITEMS, type ViewId } from "@/constants/navigation";
import { SAMPLE_DATA } from "@/constants/sample-data";
import { type Language, translations } from "@/constants/translations";
import { analyzeCli } from "@/parsers";
import { exportExcel, exportJson, exportMarkdown, exportPdf } from "@/services/export/report-export";
import { sanitizeCli, scanSensitiveData } from "@/services/sanitization/sanitizer";
import { useAnalysisStore } from "@/store/analysis-store";
import type { AnalysisResult, Finding, IpInventoryRecord, SecurityCheck, Severity } from "@/types/network";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Copy = (typeof translations)["en"] | (typeof translations)["th"];

const recommendedCollection = [
  "show interfaces switchport",
  "show interfaces",
  "show ip dhcp pool",
  "show ip dhcp snooping binding",
  "show ip dhcp snooping statistics",
  "show ip dhcp snooping information",
  "show ip verify source",
  "show redundancy",
  "show policy security addresses",
  "show port-security address",
  "show port-security interface",
  "show errdisable recovery",
  "show errdisable recovery causes",
  "show device-tracking",
  "show cts role",
  "show aaa",
  "show aaa servers",
  "show cdp neighbors",
  "show lldp neighbors detail",
  "show spanning-tree",
  "show ip route",
  "show crypto isakmp sa",
  "show logging last"
];

export function NetScopeApp({ initialView }: { initialView: ViewId }) {
  const { theme, setTheme } = useTheme();
  const { cliText, result, progress, setCliText, setResult, setProgress, clear } = useAnalysisStore();
  const [activeView, setActiveView] = useState<ViewId>(initialView);
  const [language, setLanguage] = useState<Language>("th");
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const t = translations[language];
  const sensitiveHits = useMemo(() => scanSensitiveData(cliText), [cliText]);
  const preview = useMemo(() => buildPreview(cliText), [cliText]);
  const criticalCount = result?.findings.filter(finding => finding.severity === "Critical").length ?? 0;

  async function analyze() {
    if (!cliText.trim()) return;
    setBusy(true);
    setProgress(language === "th" ? "กำลังอ่าน CLI" : "Parsing CLI");
    try {
      setResult(await runAnalysis(cliText));
      if (activeView === "import") setActiveView("overview");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="cyber-app min-h-screen bg-background px-3 py-4 text-foreground md:px-5">
      <div className="mx-auto max-w-[1500px]">
        <main className="space-y-4">
          <HeroHeader
            t={t}
            language={language}
            setLanguage={setLanguage}
            theme={theme}
            setTheme={setTheme}
            onLoadSample={() => setCliText(SAMPLE_DATA)}
          />

          <StatusPills t={t} result={result} preview={preview} />

          <AnalyzerPanel
            t={t}
            cliText={cliText}
            setCliText={setCliText}
            busy={busy}
            analyze={analyze}
            clear={clear}
            sensitiveHits={sensitiveHits}
            progress={progress}
            preview={preview}
            onRecommended={() => setActiveView("troubleshooting")}
            onExport={() => setActiveView("reports")}
          />

          <AlertBand t={t} />

          <MetricGrid t={t} result={result} preview={preview} />

          <ControlBand t={t} result={result} query={query} setQuery={setQuery} />

          <TabStrip t={t} activeView={activeView} setActiveView={setActiveView} result={result} criticalCount={criticalCount} />

          <section className="rounded-[1.35rem] border border-cyan-400/30 bg-[#031128]/80 p-3 shadow-[0_0_42px_rgba(0,217,255,0.16)]">
            {!result && activeView !== "import" ? <EmptyState t={t} onOpenImport={() => setActiveView("import")} /> : null}
            {activeView === "import" ? (
              <ImportDetails t={t} result={result} sensitiveHits={sensitiveHits} progress={progress} />
            ) : null}
            {result && activeView !== "import" ? (
              <ViewRouter view={activeView} result={result} query={query} setQuery={setQuery} t={t} language={language} />
            ) : null}
          </section>
        </main>
      </div>
    </div>
  );
}

function HeroHeader({
  t,
  language,
  setLanguage,
  theme,
  setTheme,
  onLoadSample
}: {
  t: Copy;
  language: Language;
  setLanguage: (language: Language) => void;
  theme: string | undefined;
  setTheme: (theme: string) => void;
  onLoadSample: () => void;
}) {
  return (
    <header className="cyber-header cyber-panel relative rounded-[1.35rem] border px-4 py-4 md:px-6">
      <div className="relative z-[1] flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-cyan-300/50 bg-cyan-400/10 shadow-[0_0_26px_rgba(0,217,255,0.22)]">
            <CircuitBoard className="h-9 w-9 text-cyan-100" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-normal text-white md:text-3xl">{t.appName}</h1>
            <p className="mt-1 max-w-4xl text-sm leading-6 text-cyan-100/80">{t.subtitle}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            aria-label={t.language}
            value={language}
            onChange={event => setLanguage(event.target.value as Language)}
            className="h-10 rounded-lg border px-3 text-sm"
          >
            <option value="th">ไทย</option>
            <option value="en">English</option>
          </select>
          <Button variant="outline" onClick={onLoadSample}>
            <Download className="h-4 w-4" />
            {t.loadResults}
          </Button>
          <Button variant="outline" size="icon" aria-label={t.help}>
            <HelpCircle className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" aria-label={t.refresh} onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
            <Moon className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}

function StatusPills({ t, result, preview }: { t: Copy; result: AnalysisResult | null; preview: Preview }) {
  const now = result ? new Date(result.generatedAt) : new Date();
  const values = [
    { icon: Database, label: t.deviceAnalyzed, value: result?.devices[0]?.hostname ?? preview.firstDevice ?? "-" },
    { icon: Power, label: t.scanDate, value: now.toLocaleString() },
    { icon: Calendar, label: t.uploadMode, value: result ? t.states.parsed : t.states.ready }
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-3 xl:w-[760px]">
      {values.map(item => {
        const Icon = item.icon;
        return (
          <div key={item.label} className="cyber-panel flex items-center gap-3 rounded-xl border px-4 py-3">
            <Icon className="h-5 w-5 text-cyan-200" />
            <div>
              <div className="text-xs text-muted-foreground">{item.label}</div>
              <div className="font-mono text-sm font-semibold text-white">{item.value}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AnalyzerPanel({
  t,
  cliText,
  setCliText,
  busy,
  analyze,
  clear,
  sensitiveHits,
  progress,
  preview,
  onRecommended,
  onExport
}: {
  t: Copy;
  cliText: string;
  setCliText: (text: string) => void;
  busy: boolean;
  analyze: () => void;
  clear: () => void;
  sensitiveHits: { type: string; line: number; preview: string }[];
  progress: string;
  preview: Preview;
  onRecommended: () => void;
  onExport: () => void;
}) {
  return (
    <Card className="cyber-border-energy cyber-light-sweep rounded-[1.35rem]">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base normal-case">
          <Terminal className="h-5 w-5 text-cyan-200" />
          {t.pasteTitle}
        </CardTitle>
        <CardDescription>{t.pasteHint}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea
          aria-label={t.pasteTitle}
          value={cliText}
          onChange={event => setCliText(event.target.value)}
          className="cyber-cli-editor min-h-[210px] rounded-xl border-dashed font-mono text-xs leading-6 md:text-sm"
          placeholder="CORE-SW01#show ip arp&#10;Internet 10.10.21.1 2 001a.2f38.4184 ARPA Vlan43"
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={analyze} disabled={busy || !cliText.trim()}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />}
            {t.analyze}
          </Button>
          <Button variant="outline" onClick={clear}>
            <Trash2 className="h-4 w-4" />
            {t.clear}
          </Button>
          <FilePicker label={t.importTxt} onText={text => setCliText(cliText ? `${cliText}\n${text}` : text)} />
          <Button variant="outline" onClick={() => setCliText(SAMPLE_DATA)}>
            <ClipboardList className="h-4 w-4" />
            {t.loadSample}
          </Button>
          <Button variant="outline" onClick={() => setCliText(sanitizeCli(cliText, "mask"))}>
            <ShieldAlert className="h-4 w-4" />
            {t.sanitize}
          </Button>
          <Button variant="outline" onClick={onRecommended}>
            <Terminal className="h-4 w-4" />
            {t.recommendedCommands}
          </Button>
          <Button variant="outline" onClick={onExport}>
            <Download className="h-4 w-4" />
            {t.exportCurrent}
          </Button>
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span>{t.source}: <span className="text-cyan-200">CLI</span></span>
          <span>{t.deviceDetected}: <span className="text-cyan-200">{preview.devices}</span></span>
          <span>{t.commandsLoaded}: <span className="text-cyan-200">{preview.commands}</span></span>
          <span>{t.size}: <span className="text-cyan-200">{(preview.bytes / 1024).toFixed(2)} KB</span></span>
          <span>{t.panels.parsingProgress}: <span className="text-cyan-200">{progress}</span></span>
          <span>{t.panels.sensitive}: <span className={sensitiveHits.length ? "text-orange-300" : "text-emerald-300"}>{sensitiveHits.length}</span></span>
        </div>
      </CardContent>
    </Card>
  );
}

function AlertBand({ t }: { t: Copy }) {
  return (
    <div className="rounded-xl border border-yellow-400/45 bg-yellow-400/10 px-4 py-3 text-sm text-yellow-100 shadow-[0_0_24px_rgba(255,201,40,0.12)]">
      <div className="flex gap-3">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-yellow-300" />
        <p><span className="font-semibold">{t.advisory}: </span>{t.advisoryText} {t.noSnapshot}</p>
      </div>
    </div>
  );
}

function MetricGrid({ t, result, preview }: { t: Copy; result: AnalysisResult | null; preview: Preview }) {
  const values = [
    [t.metrics.devices, result?.devices.length ?? preview.devices, "cyan"],
    [t.metrics.commands, result?.commandBlocks.length ?? preview.commands, "cyan"],
    [t.metrics.networks, result?.subnets.length ?? 0, "cyan"],
    [t.metrics.usable, result?.subnets.reduce((sum, subnet) => sum + subnet.totalUsable, 0) ?? 0, "cyan"],
    [t.metrics.used, result?.usedIps.length ?? 0, "green"],
    [t.metrics.free, result?.freeIps.length ?? 0, "cyan"],
    [t.metrics.reserved, result?.ipInventory.filter(ip => ip.status === "Reserved").length ?? 0, "purple"],
    [t.metrics.unknown, result?.ipInventory.filter(ip => ip.status === "Unknown").length ?? 0, "purple"],
    [t.metrics.pools, result?.dhcpPools.length ?? 0, "cyan"],
    [t.metrics.posture, result ? `${result.securityChecks.filter(check => check.status === "Passed").length}/${result.securityChecks.length}` : "0/0", "green"],
    [t.metrics.blocked, result?.blockedDevices.length ?? 0, "red"],
    [t.metrics.conflicts, result?.findings.length ?? 0, "yellow"],
    [t.metrics.score, result ? `${result.securityScore}%` : "0%", "cyan"],
    [t.metrics.warnings, result?.parserWarnings.length ?? 0, "cyan"]
  ] as const;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
      {values.map(([label, value, tone]) => <MetricCard key={label} label={label} value={value} tone={tone} />)}
    </div>
  );
}

function ControlBand({
  t,
  result,
  query,
  setQuery
}: {
  t: Copy;
  result: AnalysisResult | null;
  query: string;
  setQuery: (query: string) => void;
}) {
  return (
    <div className="cyber-panel grid gap-3 rounded-xl border p-3 md:grid-cols-[220px_1fr_260px]">
      <label className="grid gap-1 text-xs text-muted-foreground">
        {t.subnet}
        <select className="h-10 rounded-lg border px-3 text-sm text-foreground">
          <option>{t.allSubnets} ({result?.subnets.length ?? 0})</option>
          {result?.subnets.map(subnet => <option key={subnet.cidr}>{subnet.cidr}</option>)}
        </select>
      </label>
      <label className="grid gap-1 text-xs text-muted-foreground">
        {t.actions.search}
        <div className="flex gap-2">
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="10.36.2.0/24, IP, MAC, VLAN, Port"
            className="h-10 min-w-0 flex-1 rounded-lg border px-3 text-sm"
          />
          <Button size="sm" variant="outline" className="h-10">{isThaiCopy(t) ? "ใช้" : "Apply"}</Button>
        </div>
      </label>
      <label className="grid gap-1 text-xs text-muted-foreground">
        {t.analysisTime}
        <div className="flex h-10 items-center rounded-lg border border-input bg-background/70 px-3 font-mono text-sm text-cyan-100">
          {result ? new Date(result.generatedAt).toLocaleString() : "-"}
        </div>
      </label>
    </div>
  );
}

function TabStrip({
  t,
  activeView,
  setActiveView,
  result,
  criticalCount
}: {
  t: Copy;
  activeView: ViewId;
  setActiveView: (view: ViewId) => void;
  result: AnalysisResult | null;
  criticalCount: number;
}) {
  return (
    <div className="cyber-panel rounded-xl border p-3">
      <div className="flex gap-2 overflow-x-auto pb-2">
        {NAV_ITEMS.map(item => {
          const count = tabCount(item.id, result, criticalCount);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveView(item.id)}
              className={cn(
                "shrink-0 rounded-lg border px-3 py-2 text-xs text-muted-foreground transition",
                activeView === item.id
                  ? "border-cyan-300/70 bg-cyan-400/15 text-cyan-100 shadow-[0_0_16px_rgba(0,217,255,0.16)]"
                  : "border-cyan-400/20 bg-background/40 hover:border-cyan-300/50 hover:text-cyan-100"
              )}
            >
              {t.tabs[item.id]} {count > 0 ? <span className="ms-1 rounded-full bg-cyan-400/15 px-1.5">{count}</span> : null}
            </button>
          );
        })}
      </div>
      <div className="h-2 rounded-full bg-slate-950/70">
        <div className="h-2 w-2/3 rounded-full bg-gradient-to-r from-fuchsia-400 via-cyan-300 to-blue-500" />
      </div>
    </div>
  );
}

function ViewRouter({
  view,
  result,
  query,
  setQuery,
  t,
  language
}: {
  view: ViewId;
  result: AnalysisResult;
  query: string;
  setQuery: (query: string) => void;
  t: Copy;
  language: Language;
}) {
  switch (view) {
    case "overview":
      return <Overview result={result} t={t} />;
    case "ip-inventory":
      return <IpTable title={t.tabs["ip-inventory"]} rows={filterInventory(result.ipInventory, query)} query={query} setQuery={setQuery} t={t} />;
    case "free-ip":
      return <IpTable title={t.tabs["free-ip"]} rows={filterInventory(result.freeIps, query)} query={query} setQuery={setQuery} t={t} />;
    case "used-ip":
      return <IpTable title={t.tabs["used-ip"]} rows={filterInventory(result.usedIps, query)} query={query} setQuery={setQuery} t={t} />;
    case "devices":
      return <Devices result={result} t={t} />;
    case "vlans":
      return <Vlans result={result} t={t} />;
    case "conflicts":
      return <Findings title={t.tabs.conflicts} findings={result.findings.filter(f => f.category !== "Security")} t={t} language={language} />;
    case "security":
      return <Security result={result} t={t} />;
    case "blocked-devices":
      return <Findings title={t.tabs["blocked-devices"]} findings={result.blockedDevices} t={t} language={language} />;
    case "topology":
      return <Topology result={result} t={t} />;
    case "troubleshooting":
      return <Troubleshooting result={result} t={t} />;
    case "reports":
      return <Reports result={result} t={t} language={language} />;
    case "settings":
      return <Settings t={t} />;
    case "import":
      return <ImportDetails t={t} result={result} sensitiveHits={[]} progress="" />;
    default:
      return <Overview result={result} t={t} />;
  }
}

function ImportDetails({
  t,
  result,
  sensitiveHits,
  progress
}: {
  t: Copy;
  result: AnalysisResult | null;
  sensitiveHits: { type: string; line: number; preview: string }[];
  progress: string;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <Card>
        <CardHeader>
          <CardTitle>{t.panels.detectedCommands}</CardTitle>
          <CardDescription>{result?.commandBlocks.length ?? 0} {t.panels.currentRows}</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable headers={[t.table.command, t.table.status]}>
            {(result?.commandBlocks ?? []).map(block => (
              <TableRow key={block.id}>
                <TableCell className="font-mono">{block.rawCommand}</TableCell>
                <TableCell><Badge severity={block.parsed ? "Passed" : "Low"}>{block.parsed ? t.states.parsed : block.warning}</Badge></TableCell>
              </TableRow>
            ))}
          </DataTable>
        </CardContent>
      </Card>
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>{t.panels.parsingProgress}</CardTitle>
            <CardDescription>{progress || t.states.idle}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-2 rounded-full bg-muted">
              <div className="h-2 w-3/4 rounded-full bg-primary" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t.panels.sensitive}</CardTitle>
            <CardDescription>{sensitiveHits.length} {t.panels.currentRows}</CardDescription>
          </CardHeader>
          <CardContent className="max-h-56 space-y-2 overflow-auto text-xs">
            {sensitiveHits.length ? sensitiveHits.slice(0, 10).map(hit => (
              <div key={`${hit.type}-${hit.line}`} className="rounded-md border border-border p-2">
                <Badge severity="High">{hit.type}</Badge>
                <div className="mt-1 font-mono text-muted-foreground">Line {hit.line}: {hit.preview}</div>
              </div>
            )) : <div className="text-muted-foreground">{t.states.noSensitive}</div>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t.panels.notDetected}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-1 text-xs text-cyan-100/80 sm:grid-cols-2 xl:grid-cols-1">
              {recommendedCollection.slice(0, 14).map(command => <li key={command} className="font-mono">• {command}</li>)}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Overview({ result, t }: { result: AnalysisResult; t: Copy }) {
  const issueData = ["Critical", "High", "Medium", "Low"].map(severity => ({
    severity: translateSeverity(severity as Severity, t),
    count: result.findings.filter(finding => finding.severity === severity).length
  }));
  const ipData = [
    { name: t.metrics.used, value: result.usedIps.length },
    { name: t.metrics.free, value: result.freeIps.length },
    { name: t.metrics.reserved, value: result.ipInventory.filter(item => item.status === "Reserved").length },
    { name: t.metrics.unknown, value: result.ipInventory.filter(item => item.status === "Unknown").length }
  ];

  return (
    <div className="space-y-4">
      <CommandCoverage result={result} t={t} />
      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard title={t.panels.ipStatus}>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={ipData} dataKey="value" outerRadius={90} label>
                {ipData.map((entry, index) => <Cell key={entry.name} fill={["#20e39a", "#39efff", "#a855f7", "#8daac2"][index]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title={t.panels.issueSeverity}>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={issueData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,217,255,0.12)" />
              <XAxis dataKey="severity" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#39efff" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
      <Findings title={t.panels.criticalFindings} findings={result.findings.slice(0, 6)} t={t} language={isThaiCopy(t) ? "th" : "en"} />
    </div>
  );
}

function CommandCoverage({ result, t }: { result: AnalysisResult; t: Copy }) {
  const detected = result.commandBlocks;
  const detectedText = new Set(detected.flatMap(block => [block.rawCommand.toLowerCase(), block.command.toLowerCase()]));
  const missing = recommendedCollection.filter(command => !detectedText.has(command.toLowerCase()));
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <Card>
        <CardHeader>
          <CardTitle>{t.panels.detectedCommands} ({detected.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable headers={[t.table.command, t.table.status]}>
            {detected.map(block => (
              <TableRow key={block.id}>
                <TableCell className="font-mono">{block.rawCommand}</TableCell>
                <TableCell>
                  <Badge severity={block.parsed ? "Passed" : "Low"}>{block.parsed ? t.states.parsed : block.warning}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </DataTable>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t.panels.notDetected}</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="max-h-[420px] overflow-auto rounded-md bg-muted p-4 text-xs leading-5 text-cyan-100/80">{missing.join("\n") || "-"}</pre>
        </CardContent>
      </Card>
    </div>
  );
}

function IpTable({
  title,
  rows,
  query,
  setQuery,
  t
}: {
  title: string;
  rows: IpInventoryRecord[];
  query: string;
  setQuery: (query: string) => void;
  t: Copy;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{rows.length} {t.panels.currentRows}</CardDescription>
      </CardHeader>
      <CardContent>
        <input
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder={t.actions.search}
          className="mb-3 h-10 w-full rounded-lg border px-3 text-sm"
        />
        <DataTable headers={[t.table.ip, t.table.status, t.table.confidence, t.table.mac, t.table.vlan, t.table.ports, t.table.sources]}>
          {rows.slice(0, 500).map(row => (
            <TableRow key={row.ip}>
              <TableCell className="font-mono">{row.ip}</TableCell>
              <TableCell><Badge severity={row.status === "Used" ? "Passed" : row.status === "Likely Free" ? "Low" : "Info"}>{translateIpStatus(row.status, t)}</Badge></TableCell>
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

function Devices({ result, t }: { result: AnalysisResult; t: Copy }) {
  return (
    <Card>
      <CardHeader><CardTitle>{t.tabs.devices}</CardTitle><CardDescription>{t.panels.devices}</CardDescription></CardHeader>
      <CardContent>
        <DataTable headers={[t.table.hostname, t.table.vendor, t.table.commands]}>
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

function Vlans({ result, t }: { result: AnalysisResult; t: Copy }) {
  return (
    <Card>
      <CardHeader><CardTitle>{t.tabs.vlans}</CardTitle><CardDescription>{t.panels.vlans}</CardDescription></CardHeader>
      <CardContent>
        <DataTable headers={[t.table.interface, t.table.status, t.table.vlan, t.table.mode, t.table.ip]}>
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

function Findings({ title, findings, t, language }: { title: string; findings: Finding[]; t: Copy; language: Language }) {
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle><CardDescription>{findings.length} {t.panels.findings}</CardDescription></CardHeader>
      <CardContent className="space-y-3">
        {findings.length ? findings.map(finding => (
          <div key={finding.id} className="cyber-finding rounded-lg border p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge severity={finding.severity}>{translateSeverity(finding.severity, t)}</Badge>
              <div className="font-medium">{translateFindingTitle(finding.title, language)}</div>
              {finding.target ? <div className="font-mono text-xs text-muted-foreground">{finding.target}</div> : null}
              <div className="ms-auto text-xs text-muted-foreground">{t.table.confidence} {finding.confidence}%</div>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{localizeFindingDescription(finding, language)}</p>
            <p className="mt-2 text-sm">{localizeRecommendation(finding, language)}</p>
            <div className="mt-3 grid gap-2 lg:grid-cols-2">
              <pre className="overflow-auto rounded-md bg-muted p-3 text-xs">{finding.verificationCommands.join("\n")}</pre>
              <pre className="overflow-auto rounded-md bg-muted p-3 text-xs">{finding.evidence.slice(0, 4).map(e => `${e.device}:${e.line} ${e.text}`).join("\n") || t.states.noEvidence}</pre>
            </div>
          </div>
        )) : <EmptyPanel text={t.states.noFindings} />}
      </CardContent>
    </Card>
  );
}

function Security({ result, t }: { result: AnalysisResult; t: Copy }) {
  return (
    <div className="space-y-4">
      <MetricCard label={t.metrics.score} value={`${result.securityScore}%`} tone="cyan" />
      <Card>
        <CardHeader><CardTitle>{t.tabs.security}</CardTitle><CardDescription>{t.panels.securityChecks}</CardDescription></CardHeader>
        <CardContent>
          <DataTable headers={[t.table.check, t.table.status, t.table.severity, t.table.evidence, t.table.recommendation]}>
            {result.securityChecks.map((check: SecurityCheck) => (
              <TableRow key={check.id}>
                <TableCell>{translateSecurityCheck(check.name, isThaiCopy(t) ? "th" : "en")}</TableCell>
                <TableCell><Badge severity={check.status === "Passed" ? "Passed" : check.severity}>{translateCheckStatus(check.status, t)}</Badge></TableCell>
                <TableCell>{translateSeverity(check.severity, t)}</TableCell>
                <TableCell>{check.evidence.length}</TableCell>
                <TableCell>{translateFindingDescription(check.recommendation, isThaiCopy(t) ? "th" : "en")}</TableCell>
              </TableRow>
            ))}
          </DataTable>
        </CardContent>
      </Card>
    </div>
  );
}

function Topology({ result, t }: { result: AnalysisResult; t: Copy }) {
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
      <CardHeader><CardTitle>{t.tabs.topology}</CardTitle><CardDescription>{t.panels.topology}</CardDescription></CardHeader>
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

function Troubleshooting({ result, t }: { result: AnalysisResult; t: Copy }) {
  return (
    <Card>
      <CardHeader><CardTitle>{t.tabs.troubleshooting}</CardTitle><CardDescription>{t.panels.troubleshooting}</CardDescription></CardHeader>
      <CardContent>
        <pre className="overflow-auto rounded-md bg-muted p-4 text-sm">{result.recommendedCommands.join("\n") || t.states.noCommands}</pre>
        <Button className="mt-3" variant="outline" onClick={() => navigator.clipboard.writeText(result.recommendedCommands.join("\n"))}>{t.actions.copyCommands}</Button>
      </CardContent>
    </Card>
  );
}

function Reports({ result, t, language }: { result: AnalysisResult; t: Copy; language: Language }) {
  const summary = localizedTelegramSummary(result, t);
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle>{t.tabs.reports}</CardTitle><CardDescription>{t.panels.reports}</CardDescription></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button onClick={() => exportPdf(result)}><Download className="h-4 w-4" />PDF</Button>
          <Button onClick={() => exportExcel(result)} variant="secondary"><FileSpreadsheet className="h-4 w-4" />Excel</Button>
          <Button onClick={() => exportJson(result)} variant="outline"><FileJson className="h-4 w-4" />JSON</Button>
          <Button onClick={() => exportMarkdown(result)} variant="outline"><FileText className="h-4 w-4" />Markdown</Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Telegram</CardTitle><CardDescription>{t.panels.telegram}</CardDescription></CardHeader>
        <CardContent>
          <pre className="min-h-60 overflow-auto rounded-md bg-muted p-4 text-sm">{language === "en" ? result.telegramSummary : summary}</pre>
          <Button className="mt-3" variant="outline" onClick={() => navigator.clipboard.writeText(language === "en" ? result.telegramSummary : summary)}>{t.actions.copySummary}</Button>
        </CardContent>
      </Card>
    </div>
  );
}

function Settings({ t }: { t: Copy }) {
  const items = [t.language, t.metrics.score, t.metrics.pools, t.metrics.free, t.tabs.reports, t.table.evidence];
  return (
    <Card>
      <CardHeader><CardTitle>{t.tabs.settings}</CardTitle><CardDescription>{t.panels.settings}</CardDescription></CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        {items.map(item => (
          <label key={item} className="grid gap-1 text-sm">
            <span>{item}</span>
            <input className="h-10 rounded-lg border px-3" placeholder={item} />
          </label>
        ))}
      </CardContent>
    </Card>
  );
}

function DataTable({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <div className="cyber-table overflow-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>{headers.map(header => <TableHead key={header}>{header}</TableHead>)}</TableRow>
        </TableHeader>
        <TableBody>{children}</TableBody>
      </Table>
    </div>
  );
}

function MetricCard({ label, value, tone = "cyan" }: { label: string; value: React.ReactNode; tone?: "cyan" | "green" | "yellow" | "purple" | "red" }) {
  const toneClass = {
    cyan: "text-cyan-300",
    green: "text-emerald-300",
    yellow: "text-yellow-300",
    purple: "text-fuchsia-300",
    red: "text-red-300"
  }[tone];
  return (
    <Card className="cyber-metric-card rounded-xl">
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={cn("cyber-metric-value mt-2 text-3xl font-semibold", toneClass)}>{value}</div>
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

function EmptyState({ t, onOpenImport }: { t: Copy; onOpenImport: () => void }) {
  return (
    <Card>
      <CardContent className="flex min-h-80 flex-col items-center justify-center gap-3 text-center">
        <CheckCircle2 className="h-10 w-10 text-muted-foreground" />
        <div className="text-lg font-semibold">{t.states.empty}</div>
        <p className="max-w-xl text-sm text-muted-foreground">{t.states.emptyHelp}</p>
        <Button onClick={onOpenImport}>{t.actions.openImport}</Button>
      </CardContent>
    </Card>
  );
}

function EmptyPanel({ text }: { text: string }) {
  return <div className="rounded-md border border-dashed border-border p-6 text-sm text-muted-foreground">{text}</div>;
}

function FilePicker({ label, onText }: { label: string; onText: (text: string) => void }) {
  return (
    <label className="cyber-button inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-background/70 px-4 py-2 text-sm font-medium hover:bg-accent">
      <Upload className="h-4 w-4" />
      {label}
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

interface Preview {
  lines: number;
  devices: number;
  commands: number;
  bytes: number;
  firstDevice?: string;
}

function buildPreview(text: string): Preview {
  const devices = [...text.matchAll(/^([A-Za-z0-9_.:-]{2,64})[#>]/gm)].map(match => match[1]);
  return {
    lines: text ? text.split(/\r?\n/).length : 0,
    devices: new Set(devices).size,
    commands: [...text.matchAll(/[#>]\s*(show|sh)\s+(.+)$/gim)].length,
    bytes: new Blob([text]).size,
    firstDevice: devices[0]
  };
}

function tabCount(view: ViewId, result: AnalysisResult | null, criticalCount: number) {
  if (!result) return 0;
  const counts: Partial<Record<ViewId, number>> = {
    overview: result.findings.length,
    import: result.commandBlocks.length,
    "ip-inventory": result.ipInventory.length,
    "free-ip": result.freeIps.length,
    "used-ip": result.usedIps.length,
    devices: result.devices.length,
    vlans: result.interfaces.length + result.vlans.length,
    conflicts: result.findings.filter(f => f.category !== "Security").length,
    security: result.securityChecks.length,
    "blocked-devices": result.blockedDevices.length,
    topology: result.topology.length,
    troubleshooting: result.recommendedCommands.length,
    reports: result.findings.length,
    settings: criticalCount
  };
  return counts[view] ?? 0;
}

function translateSeverity(severity: Severity, t: Copy) {
  if (!isThaiCopy(t)) return severity;
  return {
    Critical: "วิกฤต",
    High: "สูง",
    Medium: "กลาง",
    Low: "ต่ำ",
    Info: "ข้อมูล",
    Passed: "ผ่าน"
  }[severity];
}

function translateIpStatus(status: IpInventoryRecord["status"], t: Copy) {
  if (!isThaiCopy(t)) return status;
  return {
    Used: "ใช้งาน",
    "Likely Free": "น่าจะว่าง",
    Reserved: "สงวนไว้",
    Unknown: "ไม่ทราบ"
  }[status];
}

function translateCheckStatus(status: SecurityCheck["status"], t: Copy) {
  if (!isThaiCopy(t)) return status;
  return {
    Passed: "ผ่าน",
    Failed: "ไม่ผ่าน",
    Warning: "เตือน",
    Unknown: "ไม่ทราบ"
  }[status];
}

function translateSecurityCheck(value: string, language: Language) {
  if (language === "en") return value;
  return ({
    "DHCP Snooping": "DHCP Snooping",
    "Dynamic ARP Inspection": "Dynamic ARP Inspection",
    "Port Security": "Port Security",
    "Plaintext Secret Exposure": "พบข้อมูลลับแบบไม่ปิดบัง"
  } as Record<string, string>)[value] ?? value;
}

function translateFindingTitle(value: string, language: Language) {
  if (language === "en") return value;
  const map: Record<string, string> = {
    "Unsupported command": "คำสั่งยังไม่รองรับ",
    "Duplicate IP suspected": "สงสัย IP ซ้ำ",
    "MAC appears on multiple ports": "MAC ปรากฏหลายพอร์ต",
    "MAC flapping log detected": "พบ Log MAC Flapping",
    "DHCP pool near capacity": "DHCP Pool ใกล้เต็ม",
    "DENY BLOCK": "ถูกปฏิเสธ / ถูกบล็อก",
    "ERR DISABLED": "พอร์ต Err-disabled",
    "PORT SECURITY": "Port Security แจ้งเตือน",
    "LOG EVENT": "เหตุการณ์จาก Log",
    "Plaintext Secret Exposure": "พบข้อมูลลับแบบไม่ปิดบัง"
  };
  return map[value] ?? value;
}

function translateFindingDescription(value: string, language: Language) {
  if (language === "en") return value;
  return value
    .replace("No parser is available yet", "ยังไม่มี Parser สำหรับคำสั่งนี้")
    .replace("The block is kept as evidence but is not used for correlation.", "ระบบเก็บบล็อกนี้เป็นหลักฐาน แต่ยังไม่นำไปเชื่อมโยงข้อมูล")
    .replace("Verify ARP on the gateway", "ตรวจสอบ ARP บน Gateway")
    .replace("Check whether the ports are uplinks, port-channels, loops, or endpoint moves before treating it as a fault.", "ตรวจสอบก่อนว่าเป็น uplink, port-channel, loop หรือเครื่องย้ายพอร์ต ก่อนสรุปว่าเป็นปัญหา")
    .replace("Trace the MAC address across access and uplink switches. Verify STP and cabling before remediation.", "ไล่ MAC ผ่าน access/uplink switch และตรวจ STP กับสายสัญญาณก่อนแก้ไขจริง")
    .replace("Review lease duration, stale bindings, excluded ranges, and whether the scope needs expansion.", "ตรวจ lease duration, binding ค้าง, excluded range และพิจารณาขยาย scope หากจำเป็น")
    .replace("Use the verification commands to confirm whether the event is current before applying remediation.", "ใช้คำสั่งตรวจสอบเพื่อยืนยันว่าเหตุการณ์ยังเกิดอยู่ก่อนแก้ไขจริง")
    .replace("Enable DHCP Snooping on access VLANs where supported and trust only uplinks.", "เปิด DHCP Snooping บน access VLAN ที่รองรับ และ trust เฉพาะ uplink")
    .replace("Enable DAI on user VLANs after DHCP Snooping bindings are validated.", "เปิด DAI บน user VLAN หลังตรวจสอบ DHCP Snooping binding แล้ว")
    .replace("Use port-security, 802.1X, or NAC controls on access ports according to site policy.", "ใช้ port-security, 802.1X หรือ NAC บน access port ตามนโยบายของหน่วยงาน")
    .replace("Mask credentials before sharing CLI output and rotate exposed secrets if needed.", "ปิดบังข้อมูลลับก่อนแชร์ CLI และหมุน secret ใหม่หากจำเป็น");
}

function localizeFindingDescription(finding: Finding, language: Language) {
  if (language === "en") return finding.description;
  const target = finding.target ? ` ${finding.target}` : "";
  if (finding.title === "Duplicate IP suspected") {
    return `พบว่า IP${target} มีหลักฐานผูกกับ MAC มากกว่าหนึ่งค่า จึงมีความเสี่ยงว่า IP ซ้ำหรือข้อมูล ARP/MAC ยังไม่สอดคล้องกัน`;
  }
  if (finding.title === "MAC appears on multiple ports") {
    return `พบ MAC${target} ปรากฏบนหลายพอร์ตจากข้อมูล MAC Table รอบปัจจุบัน`;
  }
  if (finding.title === "MAC flapping log detected") {
    return `พบเหตุการณ์ MAC Flapping จาก Log ของอุปกรณ์ ข้อความต้นฉบับถูกแสดงไว้ในหลักฐานด้านล่าง`;
  }
  if (finding.title === "DHCP pool near capacity") {
    return `พบ DHCP Pool${target} ใช้งานใกล้เต็มหรือเกินเกณฑ์ที่ควรตรวจสอบ`;
  }
  if (finding.title === "Unsupported command") {
    return `พบคำสั่งที่ระบบยังไม่มี Parser เฉพาะ จึงเก็บไว้เป็นหลักฐานแต่ยังไม่นำไปคำนวณความสัมพันธ์`;
  }
  if (/DENY|BLOCK|ERR|PORT SECURITY|LOG EVENT/i.test(finding.title)) {
    return `พบเหตุการณ์ผิดปกติจาก Log หรือ Security Control ของอุปกรณ์ โปรดตรวจหลักฐานและสถานะปัจจุบันก่อนแก้ไขจริง`;
  }
  if (finding.category === "Security") {
    return `พบประเด็นด้านความปลอดภัยจาก CLI รอบปัจจุบัน ต้องตรวจสอบนโยบายและหลักฐานก่อนดำเนินการ`;
  }
  return translateFindingDescription(finding.description, language);
}

function localizeRecommendation(finding: Finding, language: Language) {
  if (language === "en") return finding.recommendation;
  if (finding.title === "Duplicate IP suspected") {
    return "ตรวจสอบ ARP บน Gateway, ไล่ตำแหน่ง MAC บน Switch และยืนยันเจ้าของเครื่องก่อนเปลี่ยน IP หรือแก้ DHCP";
  }
  if (finding.title === "MAC appears on multiple ports") {
    return "ตรวจสอบว่าเป็น uplink, port-channel, loop หรือการย้ายเครื่อง ก่อนสรุปว่าเป็นความผิดปกติ";
  }
  if (finding.title === "MAC flapping log detected") {
    return "ไล่ MAC ผ่าน access/uplink switch ตรวจ STP และสายสัญญาณ ก่อนดำเนินการแก้ไข";
  }
  if (finding.title === "DHCP pool near capacity") {
    return "ตรวจ lease duration, binding ค้าง, excluded range และพิจารณาขยาย DHCP Scope หากจำเป็น";
  }
  if (finding.title === "Unsupported command") {
    return "เพิ่ม Parser สำหรับคำสั่งนี้ หรือเก็บคำสั่งมาตรฐานที่ระบบรองรับเพื่อให้วิเคราะห์ได้ละเอียดขึ้น";
  }
  return translateFindingDescription(finding.recommendation, language);
}

function localizedTelegramSummary(result: AnalysisResult, t: Copy) {
  const top = result.findings.slice(0, 3).map((finding, index) => `${index + 1}. ${translateFindingTitle(finding.title, "th")}${finding.target ? ` - ${finding.target}` : ""}`).join("\n");
  return [
    "สรุปผลวิเคราะห์เครือข่าย",
    "",
    `${t.metrics.devices}: ${result.devices.length}`,
    `${t.metrics.networks}: ${result.subnets.length}`,
    `${t.metrics.used}: ${result.usedIps.length}`,
    `${t.metrics.free}: ${result.freeIps.length}`,
    "",
    `${translateSeverity("Critical", t)}: ${result.findings.filter(finding => finding.severity === "Critical").length}`,
    `${translateSeverity("High", t)}: ${result.findings.filter(finding => finding.severity === "High").length}`,
    `${translateSeverity("Medium", t)}: ${result.findings.filter(finding => finding.severity === "Medium").length}`,
    "",
    `${t.panels.criticalFindings}:`,
    top || t.states.noFindings,
    "",
    `${t.metrics.score}: ${result.securityScore}/100`
  ].join("\n");
}

function isThaiCopy(t: Copy) {
  return t.language === "ภาษา";
}
