"use client";

import { Copy, Download, Eye, RotateCcw } from "lucide-react";
import { AuditModal } from "@/components/audit-modal";
import { Button } from "@/components/ui/button";
import { downloadText } from "@/lib/utils";
import type { SanitizationCategory, SanitizationOptions, SanitizationPreview } from "@/services/sanitization/sanitizer";

export interface SanitizationLabels {
  title: string;
  subtitle: string;
  raw: string;
  sanitized: string;
  options: string;
  preview: string;
  copy: string;
  download: string;
  reset: string;
  detected: string;
  categories: Record<SanitizationCategory, string>;
}

interface SanitizationDialogProps {
  open: boolean;
  onClose: () => void;
  rawCliText: string;
  sanitizedCliText: string;
  preview: SanitizationPreview;
  options: SanitizationOptions;
  labels: SanitizationLabels;
  onOptionsChange: (options: SanitizationOptions) => void;
  onGenerate: () => void;
  onReset: () => void;
}

export function SanitizationDialog({
  open,
  onClose,
  rawCliText,
  sanitizedCliText,
  preview,
  options,
  labels,
  onOptionsChange,
  onGenerate,
  onReset
}: SanitizationDialogProps) {
  const sanitized = sanitizedCliText || preview.sanitizedText;
  const updateOption = (category: SanitizationCategory, checked: boolean) => onOptionsChange({ ...options, [category]: checked });
  return (
    <AuditModal open={open} onClose={onClose} title={labels.title} subtitle={labels.subtitle}>
      <div className="space-y-4 text-sm">
        <section className="rounded-lg border border-cyan-400/15 bg-slate-950/35 p-3">
          <div className="text-sm font-medium text-cyan-50">{labels.options}</div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {(Object.keys(labels.categories) as SanitizationCategory[]).map(category => (
              <label key={category} className="flex items-center gap-2 rounded-md border border-cyan-400/15 bg-black/20 p-2 text-xs text-muted-foreground">
                <input type="checkbox" checked={options[category]} onChange={event => updateOption(category, event.target.checked)} />
                <span>{labels.categories[category]}</span>
                <span className="ml-auto font-mono text-cyan-100">{preview.counts[category] ?? 0}</span>
              </label>
            ))}
          </div>
        </section>
        <div className="grid gap-3 xl:grid-cols-2">
          <label className="grid gap-2"><span className="text-xs font-medium text-muted-foreground">{labels.raw}</span><textarea readOnly value={rawCliText} className="min-h-64 resize-y rounded-lg border border-cyan-400/15 bg-black/25 p-3 font-mono text-xs leading-5 text-cyan-50" /></label>
          <label className="grid gap-2"><span className="text-xs font-medium text-muted-foreground">{labels.sanitized}</span><textarea readOnly value={sanitized} className="min-h-64 resize-y rounded-lg border border-cyan-400/15 bg-black/25 p-3 font-mono text-xs leading-5 text-cyan-50" /></label>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={onGenerate}><Eye className="h-4 w-4" />{labels.preview}</Button>
          <Button type="button" variant="outline" onClick={() => void navigator.clipboard?.writeText(sanitized)} disabled={!sanitized}><Copy className="h-4 w-4" />{labels.copy}</Button>
          <Button type="button" variant="outline" onClick={() => downloadText("netscope-sanitized-cli.txt", sanitized)} disabled={!sanitized}><Download className="h-4 w-4" />{labels.download}</Button>
          <Button type="button" variant="ghost" onClick={onReset}><RotateCcw className="h-4 w-4" />{labels.reset}</Button>
        </div>
        <div className="border-t border-cyan-400/15 pt-3 text-xs text-muted-foreground">{labels.detected}: <span className="font-mono text-cyan-100">{preview.hits.length}</span></div>
      </div>
    </AuditModal>
  );
}
