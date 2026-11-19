"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Download, FileSpreadsheet, FileText, Sheet } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

/**
 * Bouton « Exporter » : Excel (.xlsx), PDF (page imprimable) ou CSV, avec l'en-tête Moov'Up
 * (logo, titre, qui a exporté, date). Reprend les filtres affichés (paramètres de l'URL).
 * Les fichiers sont produits par /api/export/[kind]?format=xlsx|pdf|csv.
 */
export function ExportMenu({ kind, params, className, align = "end" }: { kind: string; params?: Record<string, string>; className?: string; align?: "start" | "end" }) {
  const t = useT();
  const sp = useSearchParams();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const href = (format: string) => {
    const q = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(params ?? {})) if (v) q.set(k, v);
    q.set("format", format);
    return `/api/export/${kind}?${q.toString()}`;
  };

  const item = "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-canvas hover:text-ink";
  return (
    <div ref={box} className={cn("no-print relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="inline-flex h-10 items-center gap-2 rounded-xl border border-line bg-white px-3.5 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-ink"
      >
        <Download className="size-4" />
        <span className="hidden sm:inline">{t("common.export")}</span>
      </button>
      {open && (
        <div className={cn("absolute top-full z-30 mt-2 w-52 rounded-2xl border border-line bg-white p-1.5 shadow-pop animate-fade-up", align === "end" ? "end-0" : "start-0")}>
          <a href={href("xlsx")} className={item} onClick={() => setOpen(false)}>
            <FileSpreadsheet className="size-4 text-emerald-600" /> {t("common.exportXlsx")}
          </a>
          <a href={href("pdf")} target="_blank" rel="noopener" className={item} onClick={() => setOpen(false)}>
            <FileText className="size-4 text-red-600" /> {t("common.exportPdf")}
          </a>
          <a href={href("csv")} className={item} onClick={() => setOpen(false)}>
            <Sheet className="size-4 text-slate-400" /> {t("common.exportCsv")}
          </a>
        </div>
      )}
    </div>
  );
}
