"use client";

import { Children, isValidElement, useMemo, useState, type ReactNode } from "react";
import { Background, Controls, ReactFlow, type Edge, type Node } from "@xyflow/react";
import {
  Activity,
  Calendar,
  ChevronLeft,
  ChevronRight,
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
import { scopeFromEvidence, scopeKey } from "@/evidence/evidence-scope";
import { ipInSubnet, ipToNumber } from "@/utils/ip";
import { AuditModal } from "@/components/audit-modal";
import { IpMacCheckDetails } from "@/components/ip-mac-check-details";
import { SubnetCheckDetails } from "@/components/subnet-check-details";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Copy = (typeof translations)["en"] | (typeof translations)["th"];
type MetricFocus =
  | "devices"
  | "commands"
  | "networks"
  | "usable"
  | "used"
  | "free"
  | "reserved"
  | "unknown"
  | "pools"
  | "posture"
  | "blocked"
  | "conflicts"
  | "score"
  | "warnings";

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
  const [metricFocus, setMetricFocus] = useState<MetricFocus | null>(null);
  const t = translations[language];
  const sensitiveHits = useMemo(() => scanSensitiveData(cliText), [cliText]);
  const preview = useMemo(() => buildPreview(cliText), [cliText]);
  const criticalCount = result?.findings.filter(finding => finding.severity === "Critical").length ?? 0;

  async function analyze() {
    if (!cliText.trim()) return;
    setBusy(true);
    setProgress(t.uploadMode);
    try {
      setResult(await runAnalysis(cliText));
      if (activeView === "import") setActiveView("overview");
    } finally {
      setBusy(false);
    }
  }

  function openMetric(focus: MetricFocus, view: ViewId, nextQuery = "") {
    setMetricFocus(focus);
    setQuery(nextQuery);
    setActiveView(result ? view : "import");
    window.setTimeout(() => document.getElementById("analysis-detail")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
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
            onRecommended={() => {
              setMetricFocus(null);
              setActiveView("troubleshooting");
            }}
            onExport={() => {
              setMetricFocus(null);
              setActiveView("reports");
            }}
          />

          <AlertBand t={t} />

          <MetricGrid t={t} result={result} preview={preview} activeFocus={metricFocus} onOpen={openMetric} />

          <ControlBand t={t} result={result} query={query} setQuery={setQuery} />

          <TabStrip
            t={t}
            activeView={activeView}
            setActiveView={view => {
              setMetricFocus(null);
              setActiveView(view);
            }}
            result={result}
            criticalCount={criticalCount}
          />

          <section id="analysis-detail" className="rounded-[1.35rem] border border-cyan-400/30 bg-[#031128]/80 p-3 shadow-[0_0_42px_rgba(0,217,255,0.16)]">
            {!result && activeView !== "import" ? <EmptyState t={t} onOpenImport={() => setActiveView("import")} /> : null}
            {activeView === "import" ? (
              <ImportDetails t={t} result={result} sensitiveHits={sensitiveHits} progress={progress} />
            ) : null}
            {result && activeView !== "import" ? (
              metricFocus
                ? <MetricDrilldown focus={metricFocus} result={result} t={t} language={language} />
                : <ViewRouter view={activeView} result={result} query={query} setQuery={setQuery} t={t} language={language} />
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
  const values = [
    { icon: Database, label: t.deviceAnalyzed, value: result?.devices[0]?.hostname ?? preview.firstDevice ?? "-" },
    { icon: Power, label: t.scanDate, value: result ? new Date(result.generatedAt).toLocaleString() : "-" },
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

function MetricGrid({
  t,
  result,
  preview,
  activeFocus,
  onOpen
}: {
  t: Copy;
  result: AnalysisResult | null;
  preview: Preview;
  activeFocus: MetricFocus | null;
  onOpen: (focus: MetricFocus, view: ViewId, query?: string) => void;
}) {
  const values = [
    { focus: "devices", label: t.metrics.devices, value: result?.devices.length ?? preview.devices, tone: "cyan", view: "devices" },
    { focus: "commands", label: t.metrics.commands, value: result?.commandBlocks.length ?? preview.commands, tone: "cyan", view: "overview" },
    { focus: "networks", label: t.metrics.networks, value: result?.subnets.length ?? 0, tone: "cyan", view: "ip-inventory" },
    { focus: "usable", label: t.metrics.usable, value: result?.subnets.reduce((sum, subnet) => sum + subnet.totalUsable, 0) ?? 0, tone: "cyan", view: "ip-inventory" },
    { focus: "used", label: t.metrics.used, value: result?.usedIps.length ?? 0, tone: "green", view: "used-ip" },
    { focus: "free", label: t.metrics.free, value: result?.freeIps.length ?? 0, tone: "cyan", view: "free-ip" },
    { focus: "reserved", label: t.metrics.reserved, value: result?.ipInventory.filter(ip => ip.status === "Reserved").length ?? 0, tone: "purple", view: "ip-inventory", query: "Reserved" },
    { focus: "unknown", label: t.metrics.unknown, value: result?.ipInventory.filter(ip => ip.status === "Unknown").length ?? 0, tone: "purple", view: "ip-inventory", query: "Unknown" },
    { focus: "pools", label: t.metrics.pools, value: result?.dhcpPools.length ?? 0, tone: "cyan", view: "overview" },
    { focus: "posture", label: t.metrics.posture, value: result ? `${result.securityChecks.filter(check => check.status === "Passed").length}/${result.securityChecks.length}` : "0/0", tone: "green", view: "security" },
    { focus: "blocked", label: t.metrics.blocked, value: result?.blockedDevices.length ?? 0, tone: "red", view: "blocked-devices" },
    { focus: "conflicts", label: t.metrics.conflicts, value: result?.findings.length ?? 0, tone: "yellow", view: "conflicts" },
    { focus: "score", label: t.metrics.score, value: result ? `${result.securityScore}%` : "0%", tone: "cyan", view: "security" },
    { focus: "warnings", label: t.metrics.warnings, value: result?.parserWarnings.length ?? 0, tone: "cyan", view: "conflicts" }
  ] satisfies {
    focus: MetricFocus;
    label: string;
    value: React.ReactNode;
    tone: "cyan" | "green" | "yellow" | "purple" | "red";
    view: ViewId;
    query?: string;
  }[];
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
      {values.map(item => (
        <MetricCard
          key={item.focus}
          label={item.label}
          value={item.value}
          tone={item.tone}
          active={activeFocus === item.focus}
          onClick={() => onOpen(item.focus, item.view, item.query ?? "")}
        />
      ))}
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
              {(t.tabs as Record<ViewId, string>)[item.id] ?? item.label} {count > 0 ? <span className="ms-1 rounded-full bg-cyan-400/15 px-1.5">{count}</span> : null}
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
    case "configuration":
      return <Configuration result={result} t={t} language={language} />;
    case "ip-inventory":
      return <IpTable title={t.tabs["ip-inventory"]} rows={filterInventory(result.ipInventory, query)} query={query} setQuery={setQuery} t={t} />;
    case "free-ip":
      return <IpTable title={t.tabs["free-ip"]} rows={filterInventory(result.freeIps, query)} query={query} setQuery={setQuery} t={t} />;
    case "used-ip":
      return <IpTable title={t.tabs["used-ip"]} rows={filterInventory(result.usedIps, query)} query={query} setQuery={setQuery} t={t} />;
    case "devices":
      return <Devices result={result} t={t} />;
    case "vlans":
      return <Vlans result={result} t={t} language={language} />;
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
          <DataTable headers={[t.table.command, t.table.status, "Coverage"]}>
            {(result?.commandBlocks ?? []).map(block => (
              <TableRow key={block.id}>
                <TableCell className="font-mono">{block.rawCommand}</TableCell>
                <TableCell><Badge severity={block.parsed ? "Passed" : "Low"}>{commandStatusLabel(block, t)}</Badge></TableCell>
                <TableCell>{block.coveragePercent ?? 0}%</TableCell>
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
  const [selectedId, setSelectedId] = useState(result.commandBlocks[0]?.id ?? "");
  const detected = result.commandBlocks;
  const selected = detected.find(block => block.id === selectedId) ?? detected[0];
  const detectedText = new Set(detected.flatMap(block => [block.rawCommand.toLowerCase(), block.command.toLowerCase()]));
  const missing = recommendedCollection.filter(command => !detectedText.has(command.toLowerCase()));
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <Card>
        <CardHeader>
          <CardTitle>{t.panels.detectedCommands} ({detected.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable headers={[t.table.command, t.table.status, "Coverage", "Lines"]}>
            {detected.map(block => (
              <TableRow
                key={block.id}
                onClick={() => setSelectedId(block.id)}
                className={cn("cursor-pointer", selected?.id === block.id && "bg-cyan-400/10")}
              >
                <TableCell className="font-mono">{block.rawCommand}</TableCell>
                <TableCell>
                  <Badge severity={block.parsed ? "Passed" : "Low"}>{commandStatusLabel(block, t)}</Badge>
                </TableCell>
                <TableCell>{block.coveragePercent ?? 0}%</TableCell>
                <TableCell>{block.recognizedLines ?? 0}/{block.totalLines ?? block.lines.length}</TableCell>
              </TableRow>
            ))}
          </DataTable>
          {selected ? (
            <DetailBlock
              title={`${detailLabel(t)}: ${selected.rawCommand}`}
              lines={[
                `${t.source}: ${selected.device}`,
                `Parser: ${selected.parser} ${selected.parserVersion ?? ""}`.trim(),
                `${t.table.status}: ${commandStatusLabel(selected, t)}`,
                `Coverage: ${selected.coveragePercent ?? 0}%`,
                `Recognized Lines: ${selected.recognizedLines ?? 0}`,
                `Unrecognized Lines: ${selected.unrecognizedLines ?? 0}`,
                `${t.table.evidence}: ${selected.lines.length}`,
                `Missing Evidence: ${(selected.missingEvidence ?? []).join("; ") || "-"}`,
                `Recommended Commands: ${(selected.recommendedFollowUpCommands ?? []).join(", ") || "-"}`,
                "",
                ...selected.lines.slice(0, 80).map(line => `${line.line}: ${line.text}`)
              ]}
            />
          ) : null}
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

function MetricDrilldown({ focus, result, t, language }: { focus: MetricFocus; result: AnalysisResult; t: Copy; language: Language }) {
  switch (focus) {
    case "devices":
      return <Devices result={result} t={t} />;
    case "commands":
      return <CommandCoverage result={result} t={t} />;
    case "networks":
    case "usable":
      return <SubnetTable result={result} t={t} />;
    case "used":
      return <IpTable title={t.metrics.used} rows={result.usedIps} query="" setQuery={() => undefined} t={t} />;
    case "free":
      return <IpTable title={t.metrics.free} rows={result.freeIps} query="" setQuery={() => undefined} t={t} />;
    case "reserved":
      return <IpTable title={t.metrics.reserved} rows={result.ipInventory.filter(row => row.status === "Reserved")} query="" setQuery={() => undefined} t={t} />;
    case "unknown":
      return <IpTable title={t.metrics.unknown} rows={result.ipInventory.filter(row => row.status === "Unknown")} query="" setQuery={() => undefined} t={t} />;
    case "pools":
      return <DhcpPools result={result} t={t} />;
    case "posture":
    case "score":
      return <Security result={result} t={t} />;
    case "blocked":
      return <Findings title={t.metrics.blocked} findings={result.blockedDevices} t={t} language={language} />;
    case "conflicts":
      return <Findings title={t.metrics.conflicts} findings={result.findings} t={t} language={language} />;
    case "warnings":
      return <Findings title={t.metrics.warnings} findings={result.parserWarnings} t={t} language={language} />;
    default:
      return null;
  }
}

function SubnetTable({ result, t }: { result: AnalysisResult; t: Copy }) {
  const [selectedId, setSelectedId] = useState(result.subnets[0]?.id ?? "");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const subnetPage = useRecordPage(result.subnets);
  const selected = result.subnets.find(subnet => subnet.id === selectedId) ?? result.subnets[0];
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.metrics.networks}</CardTitle>
        <CardDescription>{result.subnets.length} {t.panels.currentRows}</CardDescription>
      </CardHeader>
      <CardContent>
        <DataTable headers={["CIDR", "Network", "First Host", "Last Host", t.metrics.usable, t.metrics.used, t.metrics.free, "%"]}>
          {subnetPage.items.map(subnet => (
            <TableRow
              key={subnet.id}
              onClick={() => {
                setSelectedId(subnet.id);
                setDetailsOpen(true);
              }}
              className={cn("cursor-pointer", selected?.id === subnet.id && "bg-cyan-400/10")}
            >
              <TableCell className="font-mono">{subnet.cidr}</TableCell>
              <TableCell className="font-mono">{subnet.network}</TableCell>
              <TableCell className="font-mono">{subnet.firstHost}</TableCell>
              <TableCell className="font-mono">{subnet.lastHost}</TableCell>
              <TableCell>{subnet.totalUsable}</TableCell>
              <TableCell>{subnet.used}</TableCell>
              <TableCell>{subnet.free}</TableCell>
              <TableCell>{subnet.utilization}%</TableCell>
            </TableRow>
          ))}
        </DataTable>
        <RecordPager page={subnetPage.page} pageCount={subnetPage.pageCount} total={result.subnets.length} onPageChange={subnetPage.setPage} />
        {selected ? (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-cyan-400/15 bg-slate-950/35 p-3 text-xs">
            <div className="font-mono text-cyan-100">{selected.cidr}</div>
            <div>{t.metrics.used}: {selected.used}</div>
            <div>{t.metrics.free}: {selected.free}</div>
            <div>{t.metrics.score}: {selected.utilization}%</div>
            <Button type="button" size="sm" onClick={() => setDetailsOpen(true)}>
              Open selected subnet audit
            </Button>
          </div>
        ) : null}
        {selected ? (
          <AuditModal
            open={detailsOpen}
            onClose={() => setDetailsOpen(false)}
            title={`Subnet audit: ${selected.cidr}`}
            subtitle={`Used ${selected.used} · Likely free ${selected.free} · Utilization ${selected.utilization}%`}
          >
            <SubnetCheckDetails subnet={selected} language={isThaiCopy(t) ? "th" : "en"} />
          </AuditModal>
        ) : null}
      </CardContent>
    </Card>
  );
}

function DhcpPools({ result, t }: { result: AnalysisResult; t: Copy }) {
  const [selectedKey, setSelectedKey] = useState(result.dhcpPools[0] ? dhcpPoolKey(result.dhcpPools[0]) : "");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const poolPage = useRecordPage(result.dhcpPools);
  const selected = result.dhcpPools.find(pool => dhcpPoolKey(pool) === selectedKey) ?? result.dhcpPools[0];
  const selectedStats = selected ? poolStats(result, selected) : null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.metrics.pools}</CardTitle>
        <CardDescription>{result.dhcpPools.length} {t.panels.currentRows}</CardDescription>
      </CardHeader>
      <CardContent>
        <DataTable headers={["Pool", "Network", "Leased", "Pool free", "Excluded", "Reserved", "Conflict", "%", "Gateway"]}>
          {poolPage.items.map(pool => (
            <TableRow
              key={dhcpPoolKey(pool)}
              onClick={() => {
                setSelectedKey(dhcpPoolKey(pool));
                setDetailsOpen(true);
              }}
              className={cn("cursor-pointer", selected && dhcpPoolKey(selected) === dhcpPoolKey(pool) && "bg-cyan-400/10")}
            >
              {(() => {
                const stats = poolStats(result, pool);
                return (
                  <>
              <TableCell className="font-mono">{pool.name}</TableCell>
              <TableCell className="font-mono">{pool.network ? `${pool.network}/${pool.prefix ?? "-"}` : "-"}</TableCell>
              <TableCell>{stats.leased}</TableCell>
              <TableCell>{stats.poolFree}</TableCell>
              <TableCell>{stats.excluded}</TableCell>
              <TableCell>{stats.reserved}</TableCell>
              <TableCell>{stats.conflicts}</TableCell>
              <TableCell>{pool.utilization ?? "-"}%</TableCell>
              <TableCell className="font-mono">{pool.defaultRouters.join(", ") || "-"}</TableCell>
                  </>
                );
              })()}
            </TableRow>
          ))}
        </DataTable>
        <RecordPager page={poolPage.page} pageCount={poolPage.pageCount} total={result.dhcpPools.length} onPageChange={poolPage.setPage} />
        {selected && selectedStats ? (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-cyan-400/15 bg-slate-950/35 p-3 text-xs">
            <div className="font-mono text-cyan-100">{selected.name}</div>
            <div>Leased: {selectedStats.leased}</div>
            <div>Pool free: {selectedStats.poolFree}</div>
            <div>Excluded: {selectedStats.excluded}</div>
            <div>Conflict: {selectedStats.conflicts}</div>
            <Button type="button" size="sm" onClick={() => setDetailsOpen(true)}>Open selected DHCP pool detail</Button>
          </div>
        ) : null}
        {selected && selectedStats ? (
          <AuditModal
            open={detailsOpen}
            onClose={() => setDetailsOpen(false)}
            title={`DHCP pool detail: ${selected.name}`}
            subtitle={`${selected.network ?? "-"}/${selected.prefix ?? "-"} · pool free is not reusable free IP`}
          >
            <DhcpPoolDetail pool={selected} stats={selectedStats} />
          </AuditModal>
        ) : null}
      </CardContent>
    </Card>
  );
}

function DhcpPoolDetail({ pool, stats }: { pool: AnalysisResult["dhcpPools"][number]; stats: ReturnType<typeof poolStats> }) {
  return (
    <div className="space-y-4 text-sm">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <DetailMetric label="Leased" value={stats.leased} />
        <DetailMetric label="Pool free" value={stats.poolFree} />
        <DetailMetric label="Excluded" value={stats.excluded} />
        <DetailMetric label="Conflicts" value={stats.conflicts} />
      </div>
      <div className="rounded-lg border border-yellow-400/20 bg-yellow-400/5 p-3 text-xs leading-5">
        Pool free means addresses not currently leased inside the DHCP scope. It is not the same as reusable static free IP. Excluded, reserved, conflict, interface, and active binding evidence must be checked first.
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <PoolList title="Excluded ranges" rows={stats.excludedRanges.map(item => `${item.startIp}${item.endIp !== item.startIp ? ` - ${item.endIp}` : ""}`)} />
        <PoolList title="Reservations" rows={stats.reservationsRows.map(item => `${item.host} · ${item.clientIdentifier ?? item.hardwareAddress ?? "-"}`)} />
        <PoolList title="Conflicts" rows={stats.conflictRows.map(item => `${item.ip} · ${item.detectionMethod ?? "-"} · ${item.detectionTime ?? "-"}`)} />
        <PoolList title="Gateway / DNS" rows={[`Gateway: ${pool.defaultRouters.join(", ") || "-"}`, `DNS: ${pool.dnsServers.join(", ") || "-"}`]} />
      </div>
      <PoolList
        title="Lease / domain / options"
        rows={[
          `Lease: ${pool.lease ?? "device default"}${pool.leaseSeconds !== undefined ? ` (${pool.leaseSeconds}s)` : ""}`,
          `Domain: ${pool.domainName ?? "-"}`,
          ...(pool.options ?? []).map(option => `Option ${option.code}${option.format ? ` ${option.format}` : ""}: ${option.value}`)
        ]}
      />
      <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-md bg-black/25 p-3 text-[11px] leading-5 text-cyan-50/80">
        {pool.evidence.map(line => `${line.device}:${line.line} [${line.command}] ${line.text}`).join("\n") || "No evidence"}
      </pre>
    </div>
  );
}

function DetailMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-cyan-400/15 bg-black/20 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono text-xl font-semibold text-cyan-100">{value}</div>
    </div>
  );
}

function PoolList({ title, rows }: { title: string; rows: string[] }) {
  return (
    <div className="rounded-lg border border-cyan-400/15 bg-slate-950/45 p-3">
      <div className="text-sm font-medium">{title}</div>
      {rows.length ? <ul className="mt-2 space-y-1 text-xs">{rows.map(row => <li key={row}>- {row}</li>)}</ul> : <p className="mt-2 text-xs text-muted-foreground">-</p>}
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
  const [selectedId, setSelectedId] = useState(rows[0]?.id ?? "");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const ipPage = useRecordPage(rows);
  const selected = rows.find(row => row.id === selectedId) ?? rows[0];
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
          {ipPage.items.map(row => (
            <TableRow
              key={row.id}
              onClick={() => {
                setSelectedId(row.id);
                setDetailsOpen(true);
              }}
              className={cn("cursor-pointer", selected?.id === row.id && "bg-cyan-400/10")}
            >
              <TableCell className="font-mono">{row.ip}</TableCell>
              <TableCell><Badge severity={ipStatusSeverity(row.status)}>{translateIpStatus(row.status, t)}</Badge></TableCell>
              <TableCell>{row.confidence}%</TableCell>
              <TableCell className="font-mono">{row.macs.join(", ") || "-"}</TableCell>
              <TableCell>{row.vlans.join(", ") || "-"}</TableCell>
              <TableCell className="font-mono">{row.ports.join(", ") || "-"}</TableCell>
              <TableCell>{row.sources.join(", ")}</TableCell>
            </TableRow>
          ))}
        </DataTable>
        <RecordPager page={ipPage.page} pageCount={ipPage.pageCount} total={rows.length} onPageChange={ipPage.setPage} />
        {selected ? (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-cyan-400/15 bg-slate-950/35 p-3 text-xs">
            <div className="font-mono text-cyan-100">{selected.ip}</div>
            <div>{t.table.status}: {translateIpStatus(selected.status, t)}</div>
            <div>{t.table.mac}: <span className="font-mono">{selected.macs.join(", ") || "-"}</span></div>
            <div>{t.table.sources}: {selected.sources.join(", ") || "-"}</div>
            <Button type="button" size="sm" onClick={() => setDetailsOpen(true)}>
              Open selected IP / MAC detail
            </Button>
          </div>
        ) : null}
        {selected ? (
          <AuditModal
            open={detailsOpen}
            onClose={() => setDetailsOpen(false)}
            title={`IP / MAC detail: ${selected.ip}`}
            subtitle={`${selected.status} · ${selected.macs.join(", ") || "No MAC"} · ${selected.sources.join(", ") || "No source"}`}
          >
            <IpMacCheckDetails row={selected} language={isThaiCopy(t) ? "th" : "en"} />
          </AuditModal>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Devices({ result, t }: { result: AnalysisResult; t: Copy }) {
  const [selectedHost, setSelectedHost] = useState(result.devices[0]?.hostname ?? "");
  const selected = result.devices.find(device => device.hostname === selectedHost) ?? result.devices[0];
  return (
    <Card>
      <CardHeader><CardTitle>{t.tabs.devices}</CardTitle><CardDescription>{t.panels.devices}</CardDescription></CardHeader>
      <CardContent>
        <DataTable headers={[t.table.hostname, t.table.vendor, t.table.commands]}>
          {result.devices.map(device => (
            <TableRow
              key={device.hostname}
              onClick={() => setSelectedHost(device.hostname)}
              className={cn("cursor-pointer", selected?.hostname === device.hostname && "bg-cyan-400/10")}
            >
              <TableCell className="font-mono">{device.hostname}</TableCell>
              <TableCell>{device.vendor}</TableCell>
              <TableCell>{device.commands.join(", ")}</TableCell>
            </TableRow>
          ))}
        </DataTable>
        {selected ? (
          <DetailBlock
            title={`${detailLabel(t)}: ${selected.hostname}`}
            lines={[
              `${t.table.vendor}: ${selected.vendor}`,
              `OS: ${selected.os ?? "-"}`,
              `${t.table.commands}:`,
              ...selected.commands.map(command => `- ${command}`)
            ]}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}

function Vlans({ result, t, language }: { result: AnalysisResult; t: Copy; language: Language }) {
  const [selectedKey, setSelectedKey] = useState(result.interfaces[0] ? interfaceKey(result.interfaces[0]) : "");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const interfacePage = useRecordPage(result.interfaces);
  const selected = result.interfaces.find(row => interfaceKey(row) === selectedKey) ?? result.interfaces[0];
  return (
    <Card>
      <CardHeader><CardTitle>{t.tabs.vlans}</CardTitle><CardDescription>{t.panels.vlans}</CardDescription></CardHeader>
      <CardContent>
        <DataTable headers={[t.table.interface, t.table.status, t.table.vlan, t.table.mode, t.table.ip]}>
          {interfacePage.items.map(row => (
            <TableRow
              key={interfaceKey(row)}
              onClick={() => {
                setSelectedKey(interfaceKey(row));
                setDetailsOpen(true);
              }}
              className={cn("cursor-pointer", selected && interfaceKey(selected) === interfaceKey(row) && "bg-cyan-400/10")}
            >
              <TableCell className="font-mono">{row.name}</TableCell>
              <TableCell>{row.status ?? "-"}</TableCell>
              <TableCell>{row.vlan ?? "-"}</TableCell>
              <TableCell>{row.mode ?? "-"}</TableCell>
              <TableCell className="font-mono">{row.ip ?? "-"}</TableCell>
            </TableRow>
          ))}
        </DataTable>
        <RecordPager page={interfacePage.page} pageCount={interfacePage.pageCount} total={result.interfaces.length} onPageChange={interfacePage.setPage} />
        {selected ? (
          <AuditModal
            open={detailsOpen}
            onClose={() => setDetailsOpen(false)}
            title={`${language === "th" ? "รายละเอียด Interface" : "Interface detail"}: ${selected.name}`}
            subtitle={`${selected.evidence[0]?.device ?? "-"} · ${selected.vrf ?? "global"}`}
          >
            <div className="space-y-4 text-sm">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <DetailMetric label={t.table.status} value={selected.status ?? "-"} />
                <DetailMetric label={t.table.vlan} value={selected.vlan ?? "-"} />
                <DetailMetric label={t.table.mode} value={selected.mode ?? "-"} />
              </div>
              <div className="rounded-lg border border-cyan-400/15 bg-slate-950/45 p-3 text-sm">
                <dl className="grid grid-cols-[130px_minmax(0,1fr)] gap-x-3 gap-y-2">
                  <dt className="text-muted-foreground">IP</dt><dd className="font-mono">{selected.ip ? `${selected.ip}/${selected.prefix ?? "?"}` : "-"}</dd>
                  <dt className="text-muted-foreground">{language === "th" ? "คำอธิบาย" : "Description"}</dt><dd>{selected.description ?? "-"}</dd>
                  <dt className="text-muted-foreground">{language === "th" ? "ที่มาคำอธิบาย" : "Description source"}</dt><dd>{selected.descriptionSource ?? "Unknown"}{selected.descriptionConfidence !== undefined ? ` · ${selected.descriptionConfidence}%` : ""}</dd>
                  <dt className="text-muted-foreground">Port-channel</dt><dd>{selected.channelGroup ? `${selected.channelGroup} (${selected.channelMode ?? "-"})` : "-"}</dd>
                  <dt className="text-muted-foreground">DHCP</dt><dd>{selected.dhcpSnoopingTrust ? "Trusted" : "-"}</dd>
                </dl>
              </div>
              <div className="rounded-lg border border-cyan-400/15 bg-slate-950/45 p-3">
                <div className="text-sm font-medium">{t.table.evidence}</div>
                <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap rounded-md bg-black/25 p-3 text-xs">{selected.evidence.map(line => `${line.device}:${line.line} [${line.command}] ${line.text}`).join("\n") || t.states.noEvidence}</pre>
              </div>
              <div className="border-t border-cyan-400/15 pt-3 text-xs text-cyan-100/75"><span className="font-medium text-cyan-50">{t.table.sources}:</span>{" "}{[...new Set(selected.evidence.map(line => line.command))].join(", ") || "-"}</div>
            </div>
          </AuditModal>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Findings({ title, findings, t, language }: { title: string; findings: Finding[]; t: Copy; language: Language }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = findings.find(finding => finding.id === selectedId);
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle><CardDescription>{findings.length} {t.panels.findings}</CardDescription></CardHeader>
      <CardContent className="space-y-3">
        {findings.length ? findings.map(finding => (
          <button
            key={finding.id}
            type="button"
            onClick={() => setSelectedId(finding.id)}
            className="cyber-finding w-full rounded-lg border p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
          >
            <div className="flex flex-wrap items-center gap-2">
              <Badge severity={finding.severity}>{translateSeverity(finding.severity, t)}</Badge>
              <div className="font-medium">{translateFindingTitle(finding.title, language)}</div>
              {finding.target ? <div className="font-mono text-xs text-muted-foreground">{finding.target}</div> : null}
              <div className="ms-auto text-xs text-muted-foreground">{t.table.confidence} {finding.confidence}%</div>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{localizeFindingDescription(finding, language)}</p>
          </button>
        )) : <EmptyPanel text={t.states.noFindings} />}
      </CardContent>
      <AuditModal
        open={Boolean(selected)}
        onClose={() => setSelectedId(null)}
        title={selected ? translateFindingTitle(selected.title, language) : ""}
        subtitle={selected ? `${selected.target ?? t.states.noEvidence} · ${t.table.confidence} ${selected.confidence}%` : ""}
      >
        {selected ? (
          <div className="space-y-4 text-sm">
            <div className="rounded-lg border border-cyan-400/15 bg-slate-950/45 p-3">
              <div className="flex flex-wrap items-center gap-2"><Badge severity={selected.severity}>{translateSeverity(selected.severity, t)}</Badge><span className="font-mono text-xs text-muted-foreground">{selected.target ?? "-"}</span></div>
              <p className="mt-3 leading-6 text-muted-foreground">{localizeFindingDescription(selected, language)}</p>
            </div>
            <div className="rounded-lg border border-cyan-400/15 bg-slate-950/45 p-3">
              <div className="text-sm font-medium">{t.table.recommendation}</div>
              <p className="mt-2 leading-6">{localizeRecommendation(selected, language)}</p>
            </div>
            <div className="rounded-lg border border-cyan-400/15 bg-slate-950/45 p-3">
              <div className="text-sm font-medium">Verification commands</div>
              <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap rounded-md bg-black/25 p-3 text-xs">{selected.verificationCommands.join("\n") || "-"}</pre>
            </div>
            <div className="rounded-lg border border-cyan-400/15 bg-slate-950/45 p-3">
              <div className="text-sm font-medium">{t.table.evidence}</div>
              <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap rounded-md bg-black/25 p-3 text-xs">{selected.evidence.map(e => `${e.device}:${e.line} [${e.command}] ${e.text}`).join("\n") || t.states.noEvidence}</pre>
            </div>
            <div className="border-t border-cyan-400/15 pt-3 text-xs text-cyan-100/75">
              <span className="font-medium text-cyan-50">Sources checked:</span>{" "}{[...new Set(selected.evidence.map(e => e.command))].join(", ") || "-"}
            </div>
          </div>
        ) : null}
      </AuditModal>
    </Card>
  );
}

function Configuration({ result, t, language }: { result: AnalysisResult; t: Copy; language: Language }) {
  const features = useMemo(() => {
    const grouped = new Map<string, {
      key: string;
      category: string;
      feature: string;
      scopeLabel: string;
      description?: string;
      values: string[];
      evidence: AnalysisResult["configFeatures"][number]["evidence"];
    }>();
    for (const item of result.configFeatures) {
      const scope = scopeFromEvidence(item.evidence);
      const scopeLabel = `${scope.deviceId} · ${scope.vrf ?? "global"}`;
      const key = `${scopeKey(scope)}|${item.scope ?? "global"}|${item.category}|${item.feature}`;
      const existing = grouped.get(key);
      if (existing) {
        existing.values.push(item.value ?? "-");
        existing.evidence.push(...item.evidence);
        continue;
      }
      grouped.set(key, {
        key,
        category: item.category,
        feature: item.feature,
        scopeLabel,
        description: item.description,
        values: [item.value ?? "-"],
        evidence: [...item.evidence]
      });
    }
    return [...grouped.values()].sort((left, right) => left.category.localeCompare(right.category) || left.feature.localeCompare(right.feature));
  }, [result.configFeatures]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const selected = features.find(feature => feature.key === selectedKey);
  const byCategory = features.reduce<Record<string, typeof features>>((groups, feature) => {
    (groups[feature.category] ??= []).push(feature);
    return groups;
  }, {});

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.tabs.configuration}</CardTitle>
        <CardDescription>{language === "th" ? "หัวข้อ Config ที่ตรวจพบจาก CLI รอบปัจจุบัน เลือกหัวข้อเพื่อดูคำอธิบายและหลักฐานเฉพาะที่เกี่ยวข้อง" : "Configuration features found in the current CLI. Select a feature to inspect its explanation and only its related evidence."}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {features.length ? Object.entries(byCategory).map(([category, categoryFeatures]) => (
          <section key={category} aria-label={category}>
            <h2 className="mb-2 text-sm font-semibold text-cyan-100">{category}</h2>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {categoryFeatures.map(feature => (
                <button
                  key={feature.key}
                  type="button"
                  onClick={() => setSelectedKey(feature.key)}
                  className="rounded-lg border border-cyan-400/15 bg-slate-950/45 p-3 text-left hover:bg-cyan-400/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                >
                  <div className="flex items-start justify-between gap-2"><span className="text-sm font-medium">{localizeConfigFeature(feature.feature, language)}</span><Badge severity="Info">{feature.evidence.length}</Badge></div>
                  <div className="mt-1 font-mono text-[11px] text-cyan-100/65">{feature.scopeLabel}</div>
                  <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">{localizeConfigDescription(feature.description, language)}</p>
                </button>
              ))}
            </div>
          </section>
        )) : <EmptyPanel text={t.states.noEvidence} />}
      </CardContent>
      <AuditModal
        open={Boolean(selected)}
        onClose={() => setSelectedKey(null)}
        title={selected ? localizeConfigFeature(selected.feature, language) : ""}
        subtitle={selected ? `${selected.category} · ${selected.scopeLabel}` : undefined}
      >
        {selected ? (
          <div className="space-y-4 text-sm">
            <div className="rounded-lg border border-cyan-400/15 bg-slate-950/45 p-3">
              <div className="text-sm font-medium">{language === "th" ? "คำอธิบาย" : "Description"}</div>
              <p className="mt-2 leading-6 text-muted-foreground">{localizeConfigDescription(selected.description, language)}</p>
            </div>
            <div className="rounded-lg border border-cyan-400/15 bg-slate-950/45 p-3">
              <div className="text-sm font-medium">{language === "th" ? "ค่าที่ตรวจพบ" : "Detected values"}</div>
              <ul className="mt-2 space-y-1 text-xs leading-5 text-cyan-50/80">
                {[...new Set(selected.values)].map(value => <li key={value}>- {value}</li>)}
              </ul>
            </div>
            <div className="rounded-lg border border-cyan-400/15 bg-slate-950/45 p-3">
              <div className="text-sm font-medium">{t.table.evidence}</div>
              <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap rounded-md bg-black/25 p-3 text-xs">{selected.evidence.map(item => `${item.device}:${item.line} [${item.command}] ${item.text}`).join("\n") || t.states.noEvidence}</pre>
            </div>
            <div className="border-t border-cyan-400/15 pt-3 text-xs text-cyan-100/75"><span className="font-medium text-cyan-50">{t.table.sources}:</span>{" "}{[...new Set(selected.evidence.map(item => item.command))].join(", ") || "-"}</div>
          </div>
        ) : null}
      </AuditModal>
    </Card>
  );
}

function Security({ result, t }: { result: AnalysisResult; t: Copy }) {
  const [selectedId, setSelectedId] = useState(result.securityChecks[0]?.id ?? "");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const selected = result.securityChecks.find(check => check.id === selectedId) ?? result.securityChecks[0];
  return (
    <div className="space-y-4">
      <MetricCard label={t.metrics.score} value={`${result.securityScore}%`} tone="cyan" />
      <Card>
        <CardHeader><CardTitle>{t.tabs.security}</CardTitle><CardDescription>{t.panels.securityChecks}</CardDescription></CardHeader>
        <CardContent>
          <DataTable headers={[t.table.check, t.table.sources, t.table.status, t.table.severity, t.table.evidence, t.table.recommendation]}>
            {result.securityChecks.map((check: SecurityCheck) => (
              <TableRow
                key={check.id}
                onClick={() => {
                  setSelectedId(check.id);
                  setDetailsOpen(true);
                }}
                className={cn("cursor-pointer", selected?.id === check.id && "bg-cyan-400/10")}
              >
                <TableCell>{translateSecurityCheck(check.name, isThaiCopy(t) ? "th" : "en")}</TableCell>
                <TableCell className="font-mono text-xs">{check.evidence[0]?.device ?? "-"}</TableCell>
                <TableCell><Badge severity={check.status === "Passed" ? "Passed" : check.severity}>{translateCheckStatus(check.status, t)}</Badge></TableCell>
                <TableCell>{translateSeverity(check.severity, t)}</TableCell>
                <TableCell>{check.evidence.length}</TableCell>
                <TableCell>{translateFindingDescription(check.recommendation, isThaiCopy(t) ? "th" : "en")}</TableCell>
              </TableRow>
            ))}
          </DataTable>
          {selected ? (
            <AuditModal
              open={detailsOpen}
              onClose={() => setDetailsOpen(false)}
              title={`${detailLabel(t)}: ${translateSecurityCheck(selected.name, isThaiCopy(t) ? "th" : "en")}`}
              subtitle={selected.evidence[0]?.device ?? "-"}
            >
              <div className="space-y-4 text-sm">
                <div className="rounded-lg border border-cyan-400/15 bg-slate-950/45 p-3">
                  <div className="flex flex-wrap items-center gap-2"><Badge severity={selected.status === "Passed" ? "Passed" : selected.severity}>{translateCheckStatus(selected.status, t)}</Badge><span>{translateSeverity(selected.severity, t)}</span></div>
                  <p className="mt-3 leading-6">{translateFindingDescription(selected.recommendation, isThaiCopy(t) ? "th" : "en")}</p>
                </div>
                <div className="rounded-lg border border-cyan-400/15 bg-slate-950/45 p-3"><div className="text-sm font-medium">{t.table.evidence}</div><pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap rounded-md bg-black/25 p-3 text-xs">{selected.evidence.map(line => `${line.device}:${line.line} [${line.command}] ${line.text}`).join("\n") || t.states.noEvidence}</pre></div>
                <div className="border-t border-cyan-400/15 pt-3 text-xs text-cyan-100/75"><span className="font-medium text-cyan-50">{t.table.sources}:</span>{" "}{[...new Set(selected.evidence.map(line => line.command))].join(", ") || "-"}</div>
              </div>
            </AuditModal>
          ) : null}
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

function dhcpPoolKey(pool: AnalysisResult["dhcpPools"][number]): string {
  const scope = scopeKey(scopeFromEvidence(pool.evidence, { vrf: pool.vrf }));
  return `${scope}|${pool.name}|${pool.host ?? pool.network ?? "-"}`;
}

function poolStats(result: AnalysisResult, pool: AnalysisResult["dhcpPools"][number]) {
  const poolScope = scopeKey(scopeFromEvidence(pool.evidence, { vrf: pool.vrf }));
  const inScope = (evidence: AnalysisResult["dhcpPools"][number]["evidence"], vrf?: string) => scopeKey(scopeFromEvidence(evidence, { vrf })) === poolScope;
  const inPool = (ip: string) => Boolean(pool.network && pool.prefix !== undefined && ipInSubnet(ip, pool.network, pool.prefix));
  const excludedRanges = result.dhcpExcludedRanges.filter(range => inScope(range.evidence, range.vrf) && (inPool(range.startIp) || inPool(range.endIp)));
  const excluded = excludedRanges.reduce((total, range) => total + ipRangeCount(range.startIp, range.endIp), 0);
  const reservations = result.dhcpPools.filter(item => inScope(item.evidence, item.vrf) && item.host && inPool(item.host));
  const conflictRows = result.dhcpConflicts.filter(item => inScope(item.evidence, item.vrf) && inPool(item.ip));
  const leased = pool.leased ?? result.dhcpBindings.filter(item => inScope(item.evidence, item.vrf) && inPool(item.ip)).length;
  const total = pool.total ?? 0;
  const poolFree = Math.max(0, total - leased - excluded - reservations.length - conflictRows.length);
  return { leased, total, poolFree, excluded, reserved: reservations.length, conflicts: conflictRows.length, excludedRanges, conflictRows, reservationsRows: reservations };
}

function ipRangeCount(startIp: string, endIp: string) {
  const start = ipToNumber(startIp);
  const end = ipToNumber(endIp);
  if (start === null || end === null) return 0;
  return Math.max(0, end - start + 1);
}

function DataTable({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  const rows = Children.toArray(children);
  const [filter, setFilter] = useState("");
  const [sort, setSort] = useState<{ column: number; direction: "asc" | "desc" } | null>(null);
  const pageSize = 50;
  const [page, setPage] = useState(0);
  const filteredRows = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return q ? rows.filter(row => nodeText(row).toLowerCase().includes(q)) : rows;
  }, [filter, rows]);
  const sortedRows = useMemo(() => {
    if (!sort) return filteredRows;
    return [...filteredRows].sort((a, b) => {
      const left = cellTexts(a)[sort.column] ?? "";
      const right = cellTexts(b)[sort.column] ?? "";
      const numericLeft = Number(left.replace(/[%,$]/g, ""));
      const numericRight = Number(right.replace(/[%,$]/g, ""));
      const result = Number.isFinite(numericLeft) && Number.isFinite(numericRight)
        ? numericLeft - numericRight
        : left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" });
      return sort.direction === "asc" ? result : -result;
    });
  }, [filteredRows, sort]);
  const pageCount = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const visibleRows = sortedRows.slice(currentPage * pageSize, currentPage * pageSize + pageSize);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <input
          value={filter}
          onChange={event => {
            setFilter(event.target.value);
            setPage(0);
          }}
          placeholder="Filter table"
          className="h-9 min-w-56 rounded-lg border px-3 text-xs"
        />
        <span className="text-xs text-muted-foreground">{sortedRows.length} / {rows.length} rows</span>
      </div>
      <div className="cyber-table overflow-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              {headers.map((header, column) => (
                <TableHead key={header}>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-left hover:text-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                    onClick={() => {
                      setSort(current => current?.column === column
                        ? { column, direction: current.direction === "asc" ? "desc" : "asc" }
                        : { column, direction: "asc" });
                      setPage(0);
                    }}
                  >
                    {header}
                    <span className="text-[10px] text-muted-foreground">{sort?.column === column ? (sort.direction === "asc" ? "↑" : "↓") : "↕"}</span>
                  </button>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>{visibleRows}</TableBody>
        </Table>
      </div>
      {sortedRows.length > pageSize ? (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>Showing {currentPage * pageSize + 1}-{Math.min(sortedRows.length, (currentPage + 1) * pageSize)} of {sortedRows.length}</span>
          <div className="flex gap-2">
            <Button type="button" size="icon" variant="outline" title="Previous page" aria-label="Previous page" disabled={currentPage === 0} onClick={() => setPage(value => Math.max(0, value - 1))}><ChevronLeft className="h-4 w-4" /></Button>
            <Button type="button" size="icon" variant="outline" title="Next page" aria-label="Next page" disabled={currentPage >= pageCount - 1} onClick={() => setPage(value => Math.min(pageCount - 1, value + 1))}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function useRecordPage<T>(records: T[], pageSize = 50) {
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(records.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  return {
    items: records.slice(currentPage * pageSize, currentPage * pageSize + pageSize),
    page: currentPage,
    pageCount,
    setPage,
  };
}

function RecordPager({ page, pageCount, total, onPageChange }: { page: number; pageCount: number; total: number; onPageChange: (page: number) => void }) {
  if (pageCount <= 1) return null;
  const start = page * 50 + 1;
  const end = Math.min(total, (page + 1) * 50);
  return (
    <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
      <span>{start}-{end} / {total}</span>
      <div className="flex gap-2">
        <Button type="button" size="icon" variant="outline" title="Previous page" aria-label="Previous page" disabled={page === 0} onClick={() => onPageChange(page - 1)}><ChevronLeft className="h-4 w-4" /></Button>
        <Button type="button" size="icon" variant="outline" title="Next page" aria-label="Next page" disabled={page >= pageCount - 1} onClick={() => onPageChange(page + 1)}><ChevronRight className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}

function cellTexts(row: ReactNode): string[] {
  if (!isValidElement<{ children?: ReactNode }>(row)) return [nodeText(row)];
  return flattenCells(row.props.children).map(nodeText);
}

function flattenCells(node: ReactNode): ReactNode[] {
  return Children.toArray(node).flatMap(child => {
    if (!isValidElement<{ children?: ReactNode }>(child)) return [child];
    const typeName = typeof child.type === "string" ? child.type : "";
    if (typeName === "td" || typeName === "th") return [child];
    return flattenCells(child.props.children);
  });
}

function nodeText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join(" ");
  if (isValidElement<{ children?: ReactNode }>(node)) return nodeText(node.props.children);
  return "";
}

function DetailBlock({ title, lines }: { title: string; lines: string[] }) {
  return (
    <div className="mt-4 rounded-lg border border-cyan-400/25 bg-slate-950/45 p-4">
      <div className="mb-2 text-sm font-semibold text-cyan-100">{title}</div>
      <pre className="max-h-[360px] overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 text-xs leading-5 text-cyan-100/85">
        {lines.filter(Boolean).join("\n") || "-"}
      </pre>
    </div>
  );
}

function detailLabel(t: Copy) {
  return isThaiCopy(t) ? "รายละเอียด" : "Detail";
}

function commandStatusLabel(block: { parseStatus?: string; parsed: boolean; warning?: string }, t: Copy) {
  if (block.parseStatus === "fully-parsed") return t.states.parsed;
  if (block.parseStatus === "partially-parsed") return isThaiCopy(t) ? "อ่านได้บางส่วน" : "Partially Parsed";
  if (block.parseStatus === "unsupported") return isThaiCopy(t) ? "ยังไม่รองรับ Parser" : "Unsupported Parser";
  if (block.parseStatus === "malformed") return isThaiCopy(t) ? "รูปแบบข้อมูลผิดปกติ" : "Malformed";
  if (block.parseStatus === "ambiguous-format") return isThaiCopy(t) ? "รูปแบบข้อมูลกำกวม" : "Ambiguous Format";
  if (block.parseStatus === "empty") return isThaiCopy(t) ? "ไม่มีข้อมูลในคำสั่ง" : "Empty";
  return block.parsed ? t.states.parsed : (block.warning ?? "-");
}

function interfaceKey(row: { name: string; ip?: string; vlan?: number | string; mode?: string }) {
  return `${row.name}-${row.ip ?? ""}-${row.vlan ?? ""}-${row.mode ?? ""}`;
}

function MetricCard({
  label,
  value,
  tone = "cyan",
  active = false,
  onClick
}: {
  label: string;
  value: React.ReactNode;
  tone?: "cyan" | "green" | "yellow" | "purple" | "red";
  active?: boolean;
  onClick?: () => void;
}) {
  const toneClass = {
    cyan: "text-cyan-300",
    green: "text-emerald-300",
    yellow: "text-yellow-300",
    purple: "text-fuchsia-300",
    red: "text-red-300"
  }[tone];
  return (
    <Card className={cn("cyber-metric-card rounded-xl transition", active && "border-cyan-200 bg-cyan-400/10 shadow-[0_0_24px_rgba(0,217,255,0.22)]")}>
      <CardContent className="p-0">
        <button
          type="button"
          onClick={onClick}
          className="group flex h-full min-h-[104px] w-full flex-col items-start rounded-xl p-4 text-left outline-none transition hover:bg-cyan-400/5 focus-visible:ring-2 focus-visible:ring-cyan-300"
        >
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={cn("cyber-metric-value mt-2 text-3xl font-semibold", toneClass)}>{value}</div>
        </button>
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
  return rows.filter(row => [
    row.ip,
    row.status,
    row.statusReason ?? "",
    ...row.macs,
    ...row.ports,
    ...row.sources,
    ...(row.checkedSources ?? []),
    ...(row.missingSources ?? []),
    ...(row.relatedPoolNames ?? []),
    ...row.vlans.map(String)
  ].join(" ").toLowerCase().includes(q));
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
    Excluded: "กันไว้",
    "Not Free - In DHCP Pool": "อยู่ใน DHCP Pool",
    Unknown: "ไม่ทราบ"
  }[status];
}

function ipStatusSeverity(status: IpInventoryRecord["status"]): Severity {
  if (status === "Used") return "Passed";
  if (status === "Likely Free") return "Low";
  if (status === "Unknown") return "Info";
  return "Medium";
}

function translateCheckStatus(status: SecurityCheck["status"], t: Copy) {
  if (!isThaiCopy(t)) return status;
  return {
    Passed: "ผ่าน",
    Failed: "ไม่ผ่าน",
    Warning: "เตือน",
    Unknown: "ไม่ทราบ",
    "Not Applicable": "ไม่เกี่ยวข้อง"
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

function localizeConfigFeature(feature: string, language: Language): string {
  if (language === "en") return feature;
  const labels: Record<string, string> = {
    "AAA": "AAA / การยืนยันตัวตน",
    "DHCP Snooping": "DHCP Snooping",
    "Dynamic ARP Inspection": "Dynamic ARP Inspection",
    "Spanning Tree": "Spanning Tree",
    "SNMP": "SNMP",
    "Logging": "Syslog / Logging",
    "NTP": "NTP / เวลาเครือข่าย",
    "VRF": "VRF",
    "NAT": "NAT",
    "Flow and Performance Monitoring": "NetFlow / การติดตามประสิทธิภาพ",
    "OMP": "SD-WAN OMP",
    "First-Hop Redundancy": "Gateway Redundancy",
    "Access List": "Access List",
    "Static Route": "Static Route"
  };
  return labels[feature] ?? feature;
}

function localizeConfigDescription(description: string | undefined, language: Language): string {
  if (!description || language === "en") return description ?? "-";
  const descriptions: Record<string, string> = {
    "Authentication, authorization, and accounting settings were detected. Review the configured TACACS+/RADIUS path and local fallback policy.": "ตรวจพบการตั้งค่า Authentication, Authorization และ Accounting ควรตรวจเส้นทาง TACACS+/RADIUS และนโยบาย fallback แบบ local.",
    "DHCP Snooping is configured. Inspect its enabled VLANs and trusted uplink ports before relying on binding evidence.": "ตั้งค่า DHCP Snooping แล้ว ควรตรวจ VLAN ที่เปิดใช้และ uplink ที่เชื่อถือได้ก่อนใช้ binding เป็นหลักฐาน.",
    "Dynamic ARP Inspection is configured. Validate that the protected VLANs and trusted ports match the intended Layer 2 design.": "ตั้งค่า Dynamic ARP Inspection แล้ว ควรตรวจว่า VLAN ที่ป้องกันและพอร์ต trusted ตรงกับแบบ Layer 2 ที่ตั้งใจไว้.",
    "Spanning Tree settings were detected. Confirm root placement, PortFast use, and any blocked or inconsistent ports with operational output.": "ตรวจพบการตั้งค่า Spanning Tree ควรยืนยันตำแหน่ง root, การใช้ PortFast และพอร์ต blocked/inconsistent ด้วยข้อมูล operational.",
    "SNMP management settings were detected. Sensitive credentials are masked; review version, access restrictions, trap hosts, and read/write exposure.": "ตรวจพบการตั้งค่า SNMP โดยค่าลับถูกปิดบัง ควรตรวจเวอร์ชัน ข้อจำกัดการเข้าถึง trap host และสิทธิ์ read/write.",
    "Syslog configuration was detected. Verify the source interface, destination reachability, and retention policy.": "ตรวจพบการตั้งค่า Syslog ควรตรวจ source interface การเข้าถึงปลายทาง และนโยบายเก็บรักษา log.",
    "Time synchronization configuration was detected. Verify source interface, VRF, preferred server, and synchronization state.": "ตรวจพบการตั้งค่าเวลา ควรตรวจ source interface, VRF, preferred server และสถานะการ sync.",
    "A VRF definition was detected. IP, route, and DHCP evidence must be correlated only within this VRF.": "ตรวจพบ VRF ต้องเชื่อมโยงหลักฐาน IP, route และ DHCP ภายใน VRF เดียวกันเท่านั้น.",
    "NAT configuration was detected. Review inside/outside roles, overload rules, and the associated access list before troubleshooting address translation.": "ตรวจพบ NAT ควรตรวจบทบาท inside/outside, กฎ overload และ access list ที่เกี่ยวข้องก่อนวิเคราะห์การแปลงที่อยู่.",
    "Flow or performance monitoring is configured. Verify exporter reachability, monitor attachment, and collector policy.": "ตั้งค่า Flow หรือ monitoring แล้ว ควรตรวจการเข้าถึง exporter, จุดที่ผูก monitor และนโยบาย collector.",
    "SD-WAN OMP configuration was detected. Review transport, control-plane, and route exchange state with read-only operational commands.": "ตรวจพบ SD-WAN OMP ควรตรวจ transport, control-plane และการแลก route ด้วยคำสั่งตรวจสอบแบบ read-only.",
    "First-hop redundancy configuration was detected. Validate active/standby or master/backup state and virtual gateway addresses.": "ตรวจพบ gateway redundancy ควรยืนยันสถานะ active/standby หรือ master/backup และ virtual gateway address.",
    "An access-list entry was detected. Review its order, direction, and effective interface attachment before concluding traffic is permitted or denied.": "ตรวจพบ access-list ควรตรวจลำดับ ทิศทาง และ interface ที่นำไปใช้จริง ก่อนสรุปว่า traffic ถูกอนุญาตหรือปฏิเสธ.",
    "A static route was detected. Verify the next hop, VRF, outgoing interface, and route availability with operational routing output.": "ตรวจพบ static route ควรตรวจ next hop, VRF, outgoing interface และการใช้งาน route ด้วยข้อมูล routing operational."
  };
  return descriptions[description] ?? "ตรวจพบการตั้งค่าใน CLI ที่นำเข้า เลือกดูหลักฐานเพื่อยืนยันขอบเขตและผลกระทบ.";
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
