"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2, Search, SlidersHorizontal, X } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { ExportMenu } from "./export-menu";

/**
 * Barre d'une page de liste, synchronisée avec l'URL (le filtrage se fait côté serveur via `searchParams`) :
 * - recherche instantanée (300 ms) dans le paramètre `param` (défaut `q`)
 * - tous les filtres regroupés dans un seul bouton « Filtres » (panneau déroulant), filtres actifs en puces
 * - bouton « Exporter » (Excel / PDF / CSV avec en-tête Moov'Up) si `exportKind` est fourni
 * Les autres paramètres de l'URL (ex. `semaine`) sont conservés.
 */
export type FilterOption = { value: string; label: string; count?: number };
export type FilterGroup = { param: string; label: string; options: FilterOption[] };

export function ListToolbar({
  placeholder,
  param = "q",
  filters = [],
  exportKind,
  exportParams,
  right,
  className,
}: {
  placeholder?: string;
  param?: string;
  filters?: FilterGroup[];
  exportKind?: string;
  /** Paramètres supplémentaires passés à l'export (ex. période affichée) */
  exportParams?: Record<string, string>;
  right?: React.ReactNode;
  className?: string;
}) {
  const t = useT();
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const [q, setQ] = useState(sp.get(param) ?? "");
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const first = useRef(true);
  const box = useRef<HTMLDivElement>(null);

  const push = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "") next.delete(k);
      else next.set(k, v);
    }
    next.delete("page");
    const qs = next.toString();
    start(() => router.replace(qs ? `${path}?${qs}` : path, { scroll: false }));
  };

  // Recherche différée
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const timer = setTimeout(() => push({ [param]: q.trim() || null }), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  // Fermeture du panneau : clic à l'extérieur ou Échap
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const activeFilters = filters
    .map((f) => {
      const v = sp.get(f.param);
      const o = v ? f.options.find((x) => x.value === v) : undefined;
      return o ? { group: f, option: o } : null;
    })
    .filter(Boolean) as { group: FilterGroup; option: FilterOption }[];
  const any = activeFilters.length > 0 || !!sp.get(param);
  const ph = placeholder ?? t("common.search");

  return (
    <div className={cn("no-print mb-4 flex flex-wrap items-center gap-2", className)}>
      <div className="relative min-w-0 flex-1 sm:max-w-xs">
        {pending ? (
          <Loader2 className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-brand-500" />
        ) : (
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        )}
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && setQ("")}
          placeholder={ph}
          aria-label={ph}
          className="h-10 w-full rounded-xl border border-line bg-white ps-9 pe-8 text-sm placeholder:text-slate-400 focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-50"
        />
        {q && (
          <button type="button" onClick={() => setQ("")} className="absolute end-1.5 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-lg text-slate-400 hover:text-ink" aria-label={t("common.clearSearch")}>
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {filters.length > 0 && (
        <div ref={box} className="relative">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className={cn(
              "inline-flex h-10 items-center gap-2 rounded-xl border px-3.5 text-sm font-semibold transition",
              activeFilters.length ? "border-brand-200 bg-brand-50 text-brand-600" : "border-line bg-white text-slate-600 hover:border-slate-300 hover:text-ink",
            )}
          >
            <SlidersHorizontal className="size-4" />
            {t("common.filters")}
            {activeFilters.length > 0 && <span className="grid size-5 place-items-center rounded-full bg-brand-500 text-[11px] font-bold text-white">{activeFilters.length}</span>}
          </button>
          {open && (
            <div className="absolute start-0 top-full z-30 mt-2 w-[min(92vw,360px)] space-y-4 rounded-2xl border border-line bg-white p-4 shadow-pop animate-fade-up">
              {filters.map((f) => {
                const cur = sp.get(f.param) ?? "";
                return (
                  <div key={f.param}>
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{f.label}</p>
                    <div className="flex flex-wrap gap-1.5">
                      <Chip on={!cur} onClick={() => push({ [f.param]: null })}>
                        {t("common.all")}
                      </Chip>
                      {f.options.map((o) => (
                        <Chip key={o.value} on={cur === o.value} onClick={() => push({ [f.param]: cur === o.value ? null : o.value })}>
                          {o.label}
                          {o.count !== undefined && <span className="text-xs tabular-nums opacity-70">{o.count}</span>}
                        </Chip>
                      ))}
                    </div>
                  </div>
                );
              })}
              {activeFilters.length > 0 && (
                <button type="button" onClick={() => push(Object.fromEntries(filters.map((f) => [f.param, null])))} className="text-sm font-semibold text-slate-500 hover:text-ink">
                  {t("common.clear")}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {activeFilters.map(({ group, option }) => (
        <button
          key={group.param}
          type="button"
          onClick={() => push({ [group.param]: null })}
          className="inline-flex h-8 items-center gap-1.5 rounded-full bg-brand-50 px-3 text-xs font-semibold text-brand-600 ring-1 ring-inset ring-brand-100 transition hover:bg-brand-100"
          title={t("common.clear")}
        >
          {option.label}
          <X className="size-3" />
        </button>
      ))}

      {any && (
        <button
          type="button"
          onClick={() => {
            setQ("");
            push(Object.fromEntries([[param, null], ...filters.map((f) => [f.param, null])]));
          }}
          className="hidden h-8 rounded-lg px-2 text-xs font-semibold text-slate-500 hover:bg-white hover:text-ink sm:inline-flex sm:items-center"
        >
          {t("common.clear")}
        </button>
      )}

      {(right || exportKind) && (
        <div className="ms-auto flex items-center gap-2">
          {right}
          {exportKind && <ExportMenu kind={exportKind} params={exportParams} />}
        </div>
      )}
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[13px] font-semibold transition",
        on ? "bg-brand-500 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}
