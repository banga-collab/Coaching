"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

/**
 * Bloc repliable (indicateurs, éléments secondaires). L'état ouvert / fermé est mémorisé
 * dans le navigateur par `id`. Usage : <Fold id="clients-kpis">…tuiles…</Fold>
 */
export function Fold({ id, title, defaultOpen = true, extra, children, className }: { id: string; title?: React.ReactNode; defaultOpen?: boolean; extra?: React.ReactNode; children: React.ReactNode; className?: string }) {
  const t = useT();
  const [open, setOpen] = useState(defaultOpen);
  const key = `mu:fold:${id}`;

  useEffect(() => {
    try {
      const v = window.localStorage.getItem(key);
      if (v === "0" || v === "1") setOpen(v === "1");
    } catch {
      // stockage indisponible
    }
  }, [key]);

  const toggle = () => {
    setOpen((o) => {
      try {
        window.localStorage.setItem(key, o ? "0" : "1");
      } catch {
        // stockage indisponible
      }
      return !o;
    });
  };

  return (
    <section className={cn("mb-4", className)}>
      <div className="no-print mb-2 flex items-center gap-2">
        <button type="button" onClick={toggle} aria-expanded={open} className="inline-flex items-center gap-1.5 rounded-lg py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400 transition hover:text-ink">
          <ChevronDown className={cn("size-3.5 transition-transform", !open && "-rotate-90 rtl:rotate-90")} />
          {title ?? t("common.indicators")}
        </button>
        {extra && <div className="ms-auto">{extra}</div>}
      </div>
      {open && children}
    </section>
  );
}
