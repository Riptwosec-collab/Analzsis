"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useTheme } from "next-themes";
import { AlertTriangle, Car, CheckCircle2, ChevronLeft, Moon, RotateCcw, Search, ShieldAlert, Sun, Wrench } from "lucide-react";
import { SELF_CHECK_ITEMS, SELF_CHECK_SOURCES, type CheckCategory, type CheckStatus, type SelfCheckItem } from "@/constants/civic-self-checks";

const STORAGE_KEY = "civic-self-check-results-v1";

type CheckResult = { status: CheckStatus; note: string; updatedAt: string };
type CheckResults = Record<string, CheckResult>;

const statusOptions = [
  { value: "ok" as const, label: "ปกติ", icon: CheckCircle2, className: "border-emerald-400/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  { value: "watch" as const, label: "เฝ้าดู", icon: AlertTriangle, className: "border-amber-400/50 bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  { value: "service" as const, label: "ควรเข้าศูนย์", icon: Wrench, className: "border-rose-400/50 bg-rose-500/10 text-rose-700 dark:text-rose-300" }
];

export function CivicSelfCheckPage() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [results, setResults] = useState<CheckResults>({});
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<"all" | CheckCategory>("all");
  const [status, setStatus] = useState<"all" | CheckStatus>("all");

  useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setResults(JSON.parse(saved) as CheckResults);
    } catch {
      setResults({});
    }
  }, []);

  const categories = useMemo(() => Array.from(new Set(SELF_CHECK_ITEMS.map(item => item.category))), []);
  const visibleItems = useMemo(() => {
    const text = query.trim().toLowerCase();
    return SELF_CHECK_ITEMS.filter(item => {
      const current = results[item.id]?.status ?? "unchecked";
      const matchesText = !text || `${item.title} ${item.category} ${item.howToCheck} ${item.warning}`.toLowerCase().includes(text);
      return matchesText && (category === "all" || item.category === category) && (status === "all" || current === status);
    });
  }, [category, query, results, status]);

  const stats = useMemo(() => {
    const values = SELF_CHECK_ITEMS.map(item => results[item.id]?.status ?? "unchecked");
    return {
      checked: values.filter(value => value !== "unchecked").length,
      ok: values.filter(value => value === "ok").length,
      watch: values.filter(value => value === "watch").length,
      service: values.filter(value => value === "service").length
    };
  }, [results]);

  function persist(next: CheckResults) {
    setResults(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
  }

  function setItemStatus(item: SelfCheckItem, nextStatus: Exclude<CheckStatus, "unchecked">) {
    persist({ ...results, [item.id]: { status: nextStatus, note: results[item.id]?.note ?? "", updatedAt: new Date().toISOString() } });
  }

  function setItemNote(item: SelfCheckItem, note: string) {
    persist({ ...results, [item.id]: { status: results[item.id]?.status ?? "unchecked", note, updatedAt: new Date().toISOString() } });
  }

  const completion = Math.round((stats.checked / SELF_CHECK_ITEMS.length) * 100);

  return (
    <main className="min-h-screen bg-background px-3 py-4 text-foreground md:px-6">
      <div className="mx-auto max-w-[1500px] space-y-4">
        <header className="rounded-[1.5rem] border bg-card p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Car className="h-8 w-8" /></div>
              <div><p className="text-sm font-semibold text-primary">Civic Care · สายบัว</p><h1 className="mt-1 text-2xl font-bold md:text-3xl">ตรวจรถด้วยตนเอง</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">ตรวจได้เองก่อนขับ รายเดือน และก่อนเดินทางไกล พร้อมข้อควรระวังสำหรับระบบ Hybrid</p></div>
            </div>
            <div className="flex gap-2">
              <Link href="/" className="inline-flex h-10 items-center gap-2 rounded-xl border bg-background px-4 text-sm font-semibold hover:bg-muted"><ChevronLeft className="h-4 w-4" />กลับ NetScope</Link>
              <button type="button" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")} className="inline-flex h-10 items-center gap-2 rounded-xl border bg-background px-4 text-sm font-semibold hover:bg-muted" aria-label="เปลี่ยนธีม">{mounted && resolvedTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}ธีม</button>
            </div>
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Summary label="ตรวจแล้ว" value={`${stats.checked}/${SELF_CHECK_ITEMS.length}`} tone="text-primary" />
          <Summary label="ความคืบหน้า" value={`${completion}%`} tone="text-foreground" />
          <Summary label="ปกติ" value={String(stats.ok)} tone="text-emerald-600 dark:text-emerald-300" />
          <Summary label="เฝ้าดู" value={String(stats.watch)} tone="text-amber-600 dark:text-amber-300" />
          <Summary label="ควรเข้าศูนย์" value={String(stats.service)} tone="text-rose-600 dark:text-rose-300" />
        </section>

        <section className="rounded-[1.5rem] border bg-card p-4 shadow-sm">
          <div className="grid gap-3 xl:grid-cols-[1fr_auto_auto_auto]">
            <label className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="ค้นหา เช่น ลมยาง เบรก น้ำมันเครื่อง Hybrid" className="h-11 w-full rounded-xl border bg-background pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring/30" /></label>
            <select value={category} onChange={event => setCategory(event.target.value as "all" | CheckCategory)} className="h-11 rounded-xl border bg-background px-3 text-sm"><option value="all">ทุกหมวด</option>{categories.map(item => <option key={item} value={item}>{item}</option>)}</select>
            <select value={status} onChange={event => setStatus(event.target.value as "all" | CheckStatus)} className="h-11 rounded-xl border bg-background px-3 text-sm"><option value="all">ทุกสถานะ</option><option value="unchecked">ยังไม่ได้ตรวจ</option><option value="ok">ปกติ</option><option value="watch">เฝ้าดู</option><option value="service">ควรเข้าศูนย์</option></select>
            <button type="button" onClick={() => { if (confirm("ล้างผลตรวจทั้งหมดหรือไม่?")) persist({}); }} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-destructive/35 bg-destructive/5 px-4 text-sm font-semibold text-destructive"><RotateCcw className="h-4 w-4" />เริ่มรอบใหม่</button>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${completion}%` }} /></div>
        </section>

        <section className="space-y-3">
          {visibleItems.map(item => <CheckCard key={item.id} item={item} result={results[item.id]} onStatus={value => setItemStatus(item, value)} onNote={value => setItemNote(item, value)} />)}
          {!visibleItems.length ? <div className="rounded-[1.5rem] border border-dashed bg-card p-10 text-center text-muted-foreground">ไม่พบรายการที่ตรงกับตัวกรอง</div> : null}
        </section>

        <section className="rounded-[1.5rem] border border-amber-400/35 bg-amber-500/5 p-5">
          <div className="flex gap-3"><ShieldAlert className="mt-0.5 h-6 w-6 shrink-0 text-amber-600 dark:text-amber-300" /><div><h2 className="font-bold">ความปลอดภัย</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">รายการนี้เป็นการตรวจเบื้องต้น ให้ยึดป้ายข้างประตูและคู่มือ Honda Civic e:HEV ของรถคุณเป็นหลัก ห้ามเปิดหรือซ่อมแบตเตอรี่แรงดันสูงและชิ้นส่วนแรงดันสูงด้วยตนเอง</p></div></div>
        </section>

        <section className="rounded-[1.5rem] border bg-card p-5 shadow-sm">
          <h2 className="font-bold">แหล่งข้อมูลอ้างอิง</h2>
          <div className="mt-3 grid gap-3 lg:grid-cols-3">{SELF_CHECK_SOURCES.map(source => <a key={source.url} href={source.url} target="_blank" rel="noreferrer" className="rounded-2xl border bg-background p-4 hover:border-primary/50"><p className="font-semibold">{source.name}</p><p className="mt-2 text-sm leading-6 text-muted-foreground">{source.summary}</p></a>)}</div>
        </section>
      </div>
    </main>
  );
}

function Summary({ label, value, tone }: { label: string; value: string; tone: string }) {
  return <article className="rounded-2xl border bg-card p-4 shadow-sm"><p className="text-sm text-muted-foreground">{label}</p><p className={`mt-2 text-2xl font-bold ${tone}`}>{value}</p></article>;
}

function CheckCard({ item, result, onStatus, onNote }: { item: SelfCheckItem; result?: CheckResult; onStatus: (status: Exclude<CheckStatus, "unchecked">) => void; onNote: (note: string) => void }) {
  const current = result?.status ?? "unchecked";
  return <article className="rounded-[1.35rem] border bg-card p-4 shadow-sm md:p-5"><div className="grid gap-5 xl:grid-cols-[1.15fr_1.15fr_.8fr]">
    <div><div className="flex flex-wrap gap-2"><span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">{item.category}</span><span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">{item.frequency}</span></div><h2 className="mt-3 text-lg font-bold">{item.title}</h2><p className="mt-3 text-sm leading-6 text-foreground/85">{item.howToCheck}</p></div>
    <div className="space-y-3 text-sm leading-6"><Info tone="emerald" title="ลักษณะปกติ" text={item.normal} /><Info tone="amber" title="สิ่งผิดปกติที่ควรระวัง" text={item.warning} />{item.safety ? <Info tone="rose" title="ความปลอดภัย" text={item.safety} /> : null}<p className="text-xs text-muted-foreground">อ้างอิง: {item.source}</p></div>
    <div className="space-y-3"><p className="text-sm font-semibold">ผลตรวจ</p><div className="grid gap-2">{statusOptions.map(option => { const Icon = option.icon; const active = current === option.value; return <button key={option.value} type="button" onClick={() => onStatus(option.value)} aria-pressed={active} className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-semibold ${option.className} ${active ? "ring-2 ring-current/25" : "opacity-65 hover:opacity-100"}`}><Icon className="h-4 w-4" />{option.label}</button>; })}</div><textarea value={result?.note ?? ""} onChange={event => onNote(event.target.value)} placeholder="หมายเหตุ เช่น ค่าแรงดัน ตำแหน่งรอยรั่ว หรืออาการ" className="min-h-24 w-full rounded-xl border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring/30" />{result?.updatedAt ? <p className="text-xs text-muted-foreground">บันทึกล่าสุด {new Date(result.updatedAt).toLocaleString("th-TH")}</p> : null}</div>
  </div></article>;
}

function Info({ tone, title, text }: { tone: "emerald" | "amber" | "rose"; title: string; text: string }) {
  const classes = { emerald: "border-emerald-400/30 bg-emerald-500/5", amber: "border-amber-400/30 bg-amber-500/5", rose: "border-rose-400/30 bg-rose-500/5" };
  return <div className={`rounded-xl border p-3 ${classes[tone]}`}><p className="font-semibold">{title}</p><p className="mt-1 text-muted-foreground">{text}</p></div>;
}
