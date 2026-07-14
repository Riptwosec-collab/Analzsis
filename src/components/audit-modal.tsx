"use client";

import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AuditModal({
  title,
  subtitle,
  open,
  onClose,
  children
}: {
  title: string;
  subtitle?: string;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusTimer = window.setTimeout(() => closeButtonRef.current?.focus(), 0);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const dialog = closeButtonRef.current?.closest("[role=dialog]");
      if (!dialog) return;
      const focusable = [...dialog.querySelectorAll<HTMLElement>("button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])")]
        .filter(element => !element.hasAttribute("hidden"));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", onKeyDown);
      openerRef.current?.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-3 backdrop-blur-md md:p-6" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative flex max-h-[92vh] w-full max-w-[1280px] flex-col overflow-hidden rounded-2xl border border-cyan-300/40 bg-[#031128]/95 shadow-[0_0_48px_rgba(0,217,255,0.26)]">
        <div className="flex items-start justify-between gap-3 border-b border-cyan-400/20 px-4 py-3 md:px-5">
          <div>
            <div id={titleId} className="text-base font-semibold text-cyan-50">{title}</div>
            {subtitle ? <div className="mt-1 text-xs text-cyan-100/70">{subtitle}</div> : null}
          </div>
          <Button ref={closeButtonRef} type="button" size="icon" variant="outline" aria-label="Close details" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="overflow-auto p-4 md:p-5">{children}</div>
      </div>
    </div>
  );
}
