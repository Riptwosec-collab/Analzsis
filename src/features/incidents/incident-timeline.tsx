"use client";

import { useState } from "react";
import { AuditModal } from "@/components/audit-modal";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { IncidentRecord } from "@/types/network";

type IncidentLabels = {
  title: string;
  subtitle: string;
  records: string;
  noRecords: string;
  events: string;
  affected: string;
  start: string;
  end: string;
  duration: string;
  durationUnavailable: string;
  cause: string;
  commands: string;
  evidence: string;
  sources: string;
  separator: string;
  unavailable: string;
  vlan: string;
  seconds: string;
  minutes: string;
  severity: Record<string, string>;
  types: Record<string, string>;
};

export function IncidentTimeline({ incidents, labels }: { incidents: IncidentRecord[]; labels: IncidentLabels }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = incidents.find(incident => incident.id === selectedId);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{labels.title}</CardTitle>
        <CardDescription>{labels.subtitle}</CardDescription>
      </CardHeader>
      <CardContent>
        {incidents.length ? (
          <div className="space-y-2">
            {incidents.map(incident => (
              <button
                key={incident.id}
                type="button"
                onClick={() => setSelectedId(incident.id)}
                className="cyber-finding w-full rounded-lg border p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge severity={incident.severity}>{labels.severity[incident.severity] ?? incident.severity}</Badge>
                  <span className="font-medium">{labels.types[incident.type] ?? incident.type}</span>
                  <span className="font-mono text-xs text-muted-foreground">{incident.device}</span>
                  <span className="ms-auto text-xs text-muted-foreground">{incident.eventCount} {labels.events}{labels.separator}{incident.confidence}%</span>
                </div>
                <div className="mt-2 break-words font-mono text-xs text-cyan-100/70">{affectedTarget(incident, labels)}</div>
              </button>
            ))}
          </div>
        ) : <div className="rounded-lg border border-dashed border-cyan-400/20 p-4 text-sm text-muted-foreground">{labels.noRecords}</div>}
      </CardContent>
      <AuditModal
        open={Boolean(selected)}
        onClose={() => setSelectedId(null)}
        title={selected ? labels.types[selected.type] ?? selected.type : ""}
        subtitle={selected ? `${selected.device}${labels.separator}${selected.eventCount} ${labels.events}${labels.separator}${selected.confidence}%` : undefined}
      >
        {selected ? <IncidentDetail incident={selected} labels={labels} /> : null}
      </AuditModal>
    </Card>
  );
}

function IncidentDetail({ incident, labels }: { incident: IncidentRecord; labels: IncidentLabels }) {
  const sourceCommands = [...new Set(incident.evidence.map(item => item.command))];
  return (
    <div className="space-y-4 text-sm">
      <div className="grid gap-3 sm:grid-cols-2">
        <DetailValue label={labels.cause} value={labels.types[incident.type] ?? incident.type} unavailable={labels.unavailable} />
        <DetailValue label={labels.affected} value={affectedTarget(incident, labels)} unavailable={labels.unavailable} mono />
        <DetailValue label={labels.start} value={incident.startTimestamp} unavailable={labels.unavailable} />
        <DetailValue label={labels.end} value={incident.endTimestamp} unavailable={labels.unavailable} />
        <DetailValue label={labels.duration} value={incident.durationSeconds === undefined ? labels.durationUnavailable : formatDuration(incident.durationSeconds, labels)} unavailable={labels.unavailable} />
        <DetailValue label={labels.events} value={String(incident.eventCount)} unavailable={labels.unavailable} />
      </div>
      <section className="rounded-lg border border-cyan-400/15 bg-slate-950/45 p-3">
        <div className="font-medium">{labels.commands}</div>
        <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-md bg-black/25 p-3 text-xs">{incident.verificationCommands.join("\n")}</pre>
      </section>
      <section className="rounded-lg border border-cyan-400/15 bg-slate-950/45 p-3">
        <div className="font-medium">{labels.evidence}</div>
        <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-md bg-black/25 p-3 text-xs">{incident.evidence.map(item => `${item.device}:${item.line} [${item.command}] ${item.text}`).join("\n")}</pre>
      </section>
      <div className="border-t border-cyan-400/15 pt-3 text-xs text-cyan-100/75"><span className="font-medium text-cyan-50">{labels.sources}:</span> {sourceCommands.join(", ")}</div>
    </div>
  );
}

function DetailValue({ label, value, unavailable, mono = false }: { label: string; value?: string; unavailable: string; mono?: boolean }) {
  return <div className="rounded-lg border border-cyan-400/15 bg-slate-950/45 p-3"><div className="text-xs text-muted-foreground">{label}</div><div className={`mt-1 break-words text-sm ${mono ? "font-mono" : ""}`}>{value || unavailable}</div></div>;
}

function affectedTarget(incident: IncidentRecord, labels: IncidentLabels): string {
  return [incident.interfaceName, incident.ip, incident.mac, incident.vlan === undefined ? undefined : `${labels.vlan} ${incident.vlan}`].filter(Boolean).join(labels.separator) || incident.device;
}

function formatDuration(seconds: number, labels: IncidentLabels): string {
  if (seconds < 60) return `${seconds} ${labels.seconds}`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes} ${labels.minutes} ${seconds % 60} ${labels.seconds}`;
}
