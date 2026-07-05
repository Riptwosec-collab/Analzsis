import * as React from "react";
import { cn } from "@/lib/utils";

const tone = {
  Critical: "border-red-500/40 bg-red-500/15 text-red-300",
  High: "border-orange-500/40 bg-orange-500/15 text-orange-300",
  Medium: "border-yellow-500/40 bg-yellow-500/15 text-yellow-200",
  Low: "border-sky-500/40 bg-sky-500/15 text-sky-300",
  Info: "border-zinc-500/40 bg-zinc-500/15 text-zinc-300",
  Passed: "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
} as const;

export function Badge({
  className,
  severity,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { severity?: keyof typeof tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
        severity ? tone[severity] : "border-border bg-secondary text-secondary-foreground",
        className
      )}
      {...props}
    />
  );
}
