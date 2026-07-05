"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { AuditModal } from "@/components/audit-modal";
import { IpMacCheckDetails } from "@/components/ip-mac-check-details";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAnalysisStore } from "@/store/analysis-store";

export function IpMacAuditPanel() {
  const result = useAnalysisStore(state => state.result);
  const [selectedIp, setSelectedIp] = useState("");
  const [query, setQuery] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);

  const filteredRows = useMemo(() => {
    if (!result) return [];
    const normalized = query.trim().toLowerCase();
    if (!normalized) return result.ipInventory;
    return result.ipInventory.filter(row => [
      row.ip,
      row.description,
      row.status,
      ...row.macs,
      ...row.ports,
      ...row.vlans.map(String),
      ...row.sources
    ].filter(Boolean).join(" ").toLowerCase().includes(normalized));
  }, [query, result]);

  if (!result?.ipInventory.length) return null;

  const selected = result.ipInventory.find(row => row.ip === selectedIp)
    ?? filteredRows[0]
    ?? result.ipInventory[0];

  return (
    <section className="cyber-app bg-background px-3 pb-6 text-foreground md:px-5">
      <div className="mx-auto max-w-[1500px]">
        <Card className="rounded-[1.35rem] border-cyan-400/30">
          <CardHeader>
            <CardTitle className="text-base normal-case">ตรวจสอบ IP และ MAC แบบละเอียด</CardTitle>
            <CardDescription>
              เลือก IP เพื่อดูว่าระบบตรวจ ARP, DHCP, MAC Table, VLAN, Port, Subnet, Duplicate และ Security Event อะไรไปแล้วบ้าง
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_360px]">
              <label className="relative">
                <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <input
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                  className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm"
                  placeholder="ค้นหา IP, MAC, Description, VLAN, Port..."
                />
              </label>
              <select
                value={selected?.ip ?? ""}
                onChange={event => setSelectedIp(event.target.value)}
                className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
                aria-label="เลือก IP สำหรับตรวจรายละเอียด"
              >
                {filteredRows.map(row => (
                  <option key={row.ip} value={row.ip}>
                    {row.ip} · {row.status} · {row.macs.join(", ") || "No MAC"}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <Summary label="IP" value={selected.ip} mono />
              <Summary label="Status" value={selected.status} />
              <Summary label="Confidence" value={`${selected.confidence}%`} />
              <Summary label="MAC" value={selected.macs.join(", ") || "-"} mono />
              <Summary label="Evidence" value={String(selected.evidence.length)} />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" onClick={() => setDetailsOpen(true)}>Open selected IP / MAC detail</Button>
              <div className="text-xs text-muted-foreground">Showing detail only for the selected IP/MAC when opened.</div>
            </div>

            <div className="max-h-80 overflow-auto rounded-lg border border-cyan-400/15">
              {filteredRows.slice(0, 80).map(row => (
                <button
                  key={row.ip}
                  type="button"
                  onClick={() => {
                    setSelectedIp(row.ip);
                    setDetailsOpen(true);
                  }}
                  className={`grid w-full gap-2 border-b border-cyan-400/10 px-3 py-2 text-left text-xs hover:bg-cyan-400/10 md:grid-cols-[140px_110px_minmax(0,1fr)_160px] ${row.ip === selected.ip ? "bg-cyan-400/10" : ""}`}
                >
                  <span className="font-mono text-cyan-100">{row.ip}</span>
                  <span>{row.status}</span>
                  <span className="font-mono text-cyan-100/80">{row.macs.join(", ") || "No MAC"}</span>
                  <span>{row.sources.join(", ") || "-"}</span>
                </button>
              ))}
            </div>

            <AuditModal
              open={detailsOpen}
              onClose={() => setDetailsOpen(false)}
              title={`IP / MAC detail: ${selected.ip}`}
              subtitle={`${selected.status} · ${selected.macs.join(", ") || "No MAC"} · ${selected.sources.join(", ") || "No source"}`}
            >
              <IpMacCheckDetails row={selected} language="th" />
            </AuditModal>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function Summary({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-lg border border-cyan-400/15 bg-slate-950/35 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 break-words text-sm font-medium ${mono ? "font-mono" : ""}`}>{value}</div>
    </div>
  );
}
