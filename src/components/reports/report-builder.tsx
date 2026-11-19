"use client";

import { useMemo, useState } from "react";
import { CalendarRange, Check, FileSpreadsheet, FileText, Layers, Search, Users, X } from "lucide-react";
import type { ClientStatus } from "@/lib/types";
import { REPORT_SECTIONS, type ReportSection } from "@/lib/export/report-sections";
import { cn, dayKey, fmtDate, STATUS_LABEL } from "@/lib/utils";
import { Badge, Card, CardHeader } from "@/components/ui";

export type ReportClient = { id: string; full_name: string; status: ClientStatus; goal: string | null };
type Scope = "un" | "selection" | "tous";

const fold = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const shift = (key: string, days: number) => {
  const d = new Date(`${key}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
const shiftMonths = (key: string, months: number) => {
  const d = new Date(`${key}T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
};
const STATUS_TONE: Record<ClientStatus, "green" | "amber" | "gray"> = { actif: "green", pause: "amber", termine: "gray" };
const field =
  "h-10 w-full rounded-xl border border-line bg-white px-3 text-sm text-ink focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-50";

export function ReportBuilder({ clients, preselected }: { clients: ReportClient[]; preselected: string[] }) {
  const today = useMemo(() => dayKey(new Date()), []);
  const known = useMemo(() => new Set(clients.map((c) => c.id)), [clients]);
  const initial = preselected.filter((id) => known.has(id));
  const [scope, setScope] = useState<Scope>(initial.length > 1 ? "selection" : "un");
  const [selected, setSelected] = useState<Set<string>>(() => new Set(initial));
  const [q, setQ] = useState("");
  const [statut, setStatut] = useState<"" | ClientStatus>("actif");
  const [from, setFrom] = useState(() => shiftMonths(today, -3));
  const [to, setTo] = useState(today);
  const [sections, setSections] = useState<Set<ReportSection>>(() => new Set(REPORT_SECTIONS.map((s) => s.key)));

  const index = useMemo(() => clients.map((c) => ({ c, key: fold(`${c.full_name} ${c.goal ?? ""}`) })), [clients]);
  const needle = fold(q.trim());
  const shown = needle ? index.filter((x) => x.key.includes(needle)).map((x) => x.c) : clients;
  const byStatus = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of clients) m.set(c.status, (m.get(c.status) ?? 0) + 1);
    return m;
  }, [clients]);
  const nameOf = useMemo(() => new Map(clients.map((c) => [c.id, c.full_name])), [clients]);

  const chosen = scope === "un" ? [...selected].slice(0, 1) : [...selected];
  const count = scope === "tous" ? (statut ? byStatus.get(statut) ?? 0 : clients.length) : chosen.length;
  const ready = count > 0 && sections.size > 0 && !!from && !!to;

  const toggle = (id: string) => {
    if (scope === "un") return setSelected(new Set([id]));
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const selectShown = (on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const c of shown) {
        if (on) next.add(c.id);
        else next.delete(c.id);
      }
      return next;
    });
  const toggleSection = (k: ReportSection) =>
    setSections((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  const href = (format: "pdf" | "xlsx") => {
    const p = new URLSearchParams();
    if (scope === "tous") {
      p.set("clients", "all");
      if (statut) p.set("statut", statut);
    } else p.set("clients", chosen.join(","));
    p.set("from", from <= to ? from : to);
    p.set("to", from <= to ? to : from);
    p.set("sections", REPORT_SECTIONS.filter((s) => sections.has(s.key)).map((s) => s.key).join(","));
    p.set("format", format);
    return `/api/rapport?${p.toString()}`;
  };

  const presets: { label: string; from: string }[] = [
    { label: "30 jours", from: shift(today, -29) },
    { label: "3 mois", from: shiftMonths(today, -3) },
    { label: "6 mois", from: shiftMonths(today, -6) },
    { label: "Cette année", from: `${today.slice(0, 4)}-01-01` },
  ];
  const presetOn = (f: string) => from === f && to === today;
  const dayLabel = (k: string) => (k ? fmtDate(`${k}T12:00:00Z`, { day: "numeric", month: "short", year: "numeric" }) : "…");

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-5">
        {/* 1. Clients */}
        <Card>
          <CardHeader title="Clients" subtitle="Un client, une sélection ou tous les clients" icon={<Users className="size-4" />} />
          <div className="px-5 pb-5">
            <div className="mb-4 flex w-full gap-1 rounded-xl bg-canvas p-1 ring-1 ring-line sm:w-max">
              {(
                [
                  ["un", "Un client"],
                  ["selection", "Sélection"],
                  ["tous", "Tous les clients"],
                ] as [Scope, string][]
              ).map(([k, l]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => {
                    setScope(k);
                    if (k === "un" && selected.size > 1) setSelected(new Set([...selected].slice(0, 1)));
                  }}
                  className={cn("flex-1 rounded-lg px-3 py-1.5 text-sm font-semibold transition sm:flex-none", scope === k ? "bg-brand-500 text-white shadow-sm" : "text-muted hover:text-ink")}
                >
                  {l}
                </button>
              ))}
            </div>

            {scope === "tous" ? (
              <div className="space-y-3">
                <p className="text-sm text-muted">Un rapport par client, précédé d&apos;une vue d&apos;ensemble.</p>
                <div className="flex flex-wrap gap-1.5">
                  {(["", "actif", "pause", "termine"] as const).map((s) => (
                    <button
                      key={s || "all"}
                      type="button"
                      onClick={() => setStatut(s)}
                      className={cn(
                        "inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[13px] font-semibold transition",
                        statut === s ? "bg-brand-500 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-ink",
                      )}
                    >
                      {s ? STATUS_LABEL[s] : "Tous statuts"}
                      <span className="text-xs tabular-nums opacity-70">{s ? byStatus.get(s) ?? 0 : clients.length}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative min-w-0 flex-1">
                    <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="search"
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      placeholder="Rechercher un client…"
                      aria-label="Rechercher un client"
                      className={cn(field, "ps-9")}
                    />
                  </div>
                  {scope === "selection" && (
                    <div className="flex gap-1">
                      <button type="button" onClick={() => selectShown(true)} className="h-10 rounded-xl px-3 text-sm font-semibold text-brand-600 hover:bg-brand-50">
                        Tout cocher
                      </button>
                      <button type="button" onClick={() => selectShown(false)} className="h-10 rounded-xl px-3 text-sm font-semibold text-slate-500 hover:bg-canvas hover:text-ink">
                        Décocher
                      </button>
                    </div>
                  )}
                </div>

                {chosen.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {chosen.slice(0, 12).map((id) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setSelected((prev) => new Set([...prev].filter((x) => x !== id)))}
                        className="inline-flex h-7 items-center gap-1 rounded-full bg-brand-50 px-2.5 text-xs font-semibold text-brand-600 ring-1 ring-inset ring-brand-100 hover:bg-brand-100"
                      >
                        {nameOf.get(id)}
                        <X className="size-3" />
                      </button>
                    ))}
                    {chosen.length > 12 && <span className="inline-flex h-7 items-center px-1 text-xs font-semibold text-muted">+{chosen.length - 12}</span>}
                  </div>
                )}

                <ul className="mt-3 max-h-[340px] divide-y divide-line overflow-y-auto rounded-xl border border-line">
                  {shown.length === 0 && <li className="px-4 py-6 text-center text-sm text-muted">Aucun client trouvé.</li>}
                  {shown.map((c) => {
                    const on = selected.has(c.id) && (scope !== "un" || chosen[0] === c.id);
                    return (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => toggle(c.id)}
                          aria-pressed={on}
                          className={cn("flex w-full items-center gap-3 px-3.5 py-2.5 text-start transition hover:bg-canvas", on && "bg-brand-50/60")}
                        >
                          <span
                            className={cn(
                              "grid size-5 shrink-0 place-items-center border transition",
                              scope === "un" ? "rounded-full" : "rounded-md",
                              on ? "border-brand-500 bg-brand-500 text-white" : "border-slate-300 bg-white",
                            )}
                          >
                            {on && <Check className="size-3.5" strokeWidth={3} />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-ink">{c.full_name}</span>
                            {c.goal && <span className="block truncate text-xs text-muted">{c.goal}</span>}
                          </span>
                          <Badge tone={STATUS_TONE[c.status]}>{STATUS_LABEL[c.status]}</Badge>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </div>
        </Card>

        {/* 2. Sections */}
        <Card>
          <CardHeader title="Contenu du rapport" subtitle="Sections à inclure" icon={<Layers className="size-4" />} />
          <div className="grid gap-2 px-5 pb-5 sm:grid-cols-2">
            {REPORT_SECTIONS.map((s) => {
              const on = sections.has(s.key);
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => toggleSection(s.key)}
                  aria-pressed={on}
                  className={cn("flex items-start gap-3 rounded-xl border px-3.5 py-3 text-start transition", on ? "border-brand-200 bg-brand-50/60" : "border-line bg-white hover:bg-canvas")}
                >
                  <span className={cn("mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border", on ? "border-brand-500 bg-brand-500 text-white" : "border-slate-300 bg-white")}>
                    {on && <Check className="size-3.5" strokeWidth={3} />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-ink">{s.label}</span>
                    <span className="block text-xs text-muted">{s.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </Card>
      </div>

      {/* 3. Période + génération */}
      <div className="space-y-5 lg:sticky lg:top-20 lg:self-start">
        <Card>
          <CardHeader title="Période" icon={<CalendarRange className="size-4" />} />
          <div className="space-y-3 px-5 pb-5">
            <div className="flex flex-wrap gap-1.5">
              {presets.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => {
                    setFrom(p.from);
                    setTo(today);
                  }}
                  className={cn(
                    "h-8 rounded-lg px-3 text-[13px] font-semibold transition",
                    presetOn(p.from) ? "bg-brand-500 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-ink",
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-slate-600">Du</span>
                <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className={field} />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-slate-600">Au</span>
                <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className={field} />
              </label>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <p className="text-sm font-semibold text-ink">
            {scope === "tous" ? `Tous les clients${statut ? ` (${STATUS_LABEL[statut].toLowerCase()})` : ""}` : count === 1 ? nameOf.get(chosen[0]!) : `${count} client${count > 1 ? "s" : ""}`}
          </p>
          <p className="mt-0.5 text-xs text-muted">
            Du {dayLabel(from)} au {dayLabel(to)} · {sections.size} section{sections.size > 1 ? "s" : ""}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <a
              href={ready ? href("pdf") : undefined}
              target="_blank"
              rel="noopener"
              aria-disabled={!ready}
              className={cn(
                "inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-brand-500 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600",
                !ready && "pointer-events-none opacity-50",
              )}
            >
              <FileText className="size-4" /> PDF
            </a>
            <a
              href={ready ? href("xlsx") : undefined}
              aria-disabled={!ready}
              className={cn(
                "inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-line bg-white px-4 text-sm font-semibold text-ink transition hover:border-slate-300 hover:bg-canvas",
                !ready && "pointer-events-none opacity-50",
              )}
            >
              <FileSpreadsheet className="size-4 text-emerald-600" /> Excel
            </a>
          </div>
          <p className="mt-3 text-xs text-muted">
            {count === 0
              ? "Choisissez au moins un client."
              : sections.size === 0
                ? "Choisissez au moins une section."
                : "PDF : la page s'ouvre et lance l'impression — choisissez « Enregistrer en PDF ». Excel : une ligne par client + feuilles de détail."}
          </p>
        </Card>
      </div>
    </div>
  );
}
