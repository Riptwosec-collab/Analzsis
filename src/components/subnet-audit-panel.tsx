"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { AuditModal } from "@/components/audit-modal";
import { SubnetCheckDetails } from "@/components/subnet-check-details";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAnalysisStore } from "@/store/analysis-store";

export function SubnetAuditPanel() {
  const result = useAnalysisStore(state => state.result);
  const [selectedCidr, setSelectedCidr] = useState("");
  const [query, setQuery] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);

  const filtered = useMemo(() => {
    if (!result) return [];
    const normalized = query.trim().toLowerCase();
    if (!normalized) return result.subnets;
    return result.subnets.filter(subnet => [
      subnet.cidr,
      subnet.network,
      subnet.firstHost,
      subnet.lastHost,
      subnet.broadcast,
      subnet.description
    ].filter(Boolean).join(" ").toLowerCase().includes(normalized));
  }, [query, result]);

  if (!result?.subnets.length) return null;

  const selected = result.subnets.find(subnet => subnet.cidr === selectedCidr)
    ?? filtered[0]
    ?? result.subnets[0];

  return (
    <section className="cyber-app bg-background px-3 pb-6 text-foreground md:px-5">
      <div className="mx-auto max-w-[1500px]">
        <Card className="rounded-[1.35rem] border-cyan-400/30">
          <CardHeader>
            <CardTitle className="text-base normal-case">ตรวจสอบ Subnet แบบละเอียดทุกคำสั่ง</CardTitle>
            <CardDescription>
              แสดงว่าแต่ละ Subnet ตรวจอะไรแล้ว พบอะไร ไม่พบอะไร หัวข้อใดยังไม่มีหลักฐาน และคำสั่งใดยังไม่ได้เก็บหรือ Parser ยังไม่รองรับ
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_400px]">
              <label className="relative">
                <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <input
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                  className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm"
                  placeholder="ค้นหา CIDR, Network, Host Range, Broadcast..."
                />
              </label>
              <select
                value={selected.cidr}
                onChange={event => setSelectedCidr(event.target.value)}
                className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
                aria-label="เลือก Subnet สำหรับตรวจรายละเอียด"
              >
                {filtered.map(subnet => (
                  <option key={subnet.cidr} value={subnet.cidr}>
                    {subnet.cidr} · Used {subnet.used} · Free {subnet.free} · {subnet.utilization}%
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
              <Summary label="CIDR" value={selected.cidr} mono />
              <Summary label="First Host" value={selected.firstHost} mono />
              <Summary label="Last Host" value={selected.lastHost} mono />
              <Summary label="Broadcast" value={selected.broadcast} mono />
              <Summary label="Used / Free" value={`${selected.used} / ${selected.free}`} />
              <Summary label="Utilization" value={`${selected.utilization}%`} />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" onClick={() => setDetailsOpen(true)}>Open selected subnet audit</Button>
              <div className="text-xs text-muted-foreground">The modal shows only checks and evidence related to the selected subnet.</div>
            </div>

            <div className="max-h-72 overflow-auto rounded-lg border border-cyan-400/15">
              {filtered.map(subnet => (
                <button
                  key={subnet.cidr}
                  type="button"
                  onClick={() => {
                    setSelectedCidr(subnet.cidr);
                    setDetailsOpen(true);
                  }}
                  className={`grid w-full gap-2 border-b border-cyan-400/10 px-3 py-2 text-left text-xs hover:bg-cyan-400/10 md:grid-cols-[150px_repeat(4,minmax(0,1fr))] ${subnet.cidr === selected.cidr ? "bg-cyan-400/10" : ""}`}
                >
                  <span className="font-mono text-cyan-100">{subnet.cidr}</span>
                  <span>Used {subnet.used}</span>
                  <span>Free {subnet.free}</span>
                  <span>Utilization {subnet.utilization}%</span>
                  <span className="font-mono">{subnet.firstHost} - {subnet.lastHost}</span>
                </button>
              ))}
            </div>

            <AuditModal
              open={detailsOpen}
              onClose={() => setDetailsOpen(false)}
              title={`Subnet audit: ${selected.cidr}`}
              subtitle={`Used ${selected.used} · Free ${selected.free} · Utilization ${selected.utilization}%`}
            >
              <SubnetCheckDetails subnet={selected} language="th" />
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
