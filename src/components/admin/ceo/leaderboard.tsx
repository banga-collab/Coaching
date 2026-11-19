"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, Crown, Eye, Settings2 } from "lucide-react";
import type { CoachRow } from "@/lib/ceo";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui";
import { fmtDelay, fmtHours, fmtInt, fmtMad, fmtPct, occTone } from "./format";

type Key = "done" | "hours" | "occupancy" | "absences" | "refusals" | "responseH" | "activeClients" | "assessments" | "value";
/** Sens « meilleur » de chaque colonne (pour le tri par défaut et la mise en avant) */
const COLS: { key: Key; label: string; short: string; better: "up" | "down"; title?: string }[] = [
  { key: "done", label: "Séances réalisées", short: "Séances", better: "up" },
  { key: "hours", label: "Heures", short: "Heures", better: "up" },
  { key: "occupancy", label: "Remplissage", short: "Rempl.", better: "up", title: "Heures réservées / heures disponibles sur la période" },
  { key: "absences", label: "Absences clients", short: "Abs.", better: "down" },
  { key: "refusals", label: "Refus", short: "Refus", better: "down" },
  { key: "responseH", label: "Délai de réponse", short: "Réponse", better: "down", title: "Délai moyen entre l'affectation et la réponse du coach" },
  { key: "activeClients", label: "Clients actifs", short: "Clients", better: "up" },
  { key: "assessments", label: "Bilans sportifs", short: "Bilans", better: "up" },
  { key: "value", label: "Valeur indicative", short: "Valeur ind.", better: "up", title: "Somme des prix indicatifs des séances réalisées (aucun encaissement)" },
];

function cell(r: CoachRow, k: Key) {
  switch (k) {
    case "hours":
      return fmtHours(r.hours);
    case "occupancy":
      return fmtPct(r.occupancy === null ? null : Math.round(r.occupancy));
    case "responseH":
      return fmtDelay(r.responseH);
    case "value":
      return fmtMad(r.value);
    case "absences":
      return r.absenceRate === null ? fmtInt(r.absences) : `${fmtInt(r.absences)} · ${Math.round(r.absenceRate)} %`;
    default:
      return fmtInt(r[k]);
  }
}
const num = (r: CoachRow, k: Key) => r[k];

export function CoachLeaderboard({ rows }: { rows: CoachRow[] }) {
  const [sort, setSort] = useState<{ key: Key; desc: boolean }>({ key: "done", desc: true });
  const sorted = useMemo(() => {
    const out = [...rows];
    out.sort((a, b) => {
      const x = num(a, sort.key);
      const y = num(b, sort.key);
      if (x === null && y === null) return 0;
      if (x === null) return 1;
      if (y === null) return -1;
      return sort.desc ? y - x : x - y;
    });
    return out;
  }, [rows, sort]);

  // Meilleure valeur de chaque colonne (mise en avant)
  const bestOf = useMemo(() => {
    const m = new Map<Key, number>();
    if (rows.length < 2) return m;
    for (const c of COLS) {
      const vals = rows.map((r) => num(r, c.key)).filter((v): v is number => v !== null);
      if (!vals.length) continue;
      const best = c.better === "up" ? Math.max(...vals) : Math.min(...vals);
      if (c.better === "up" && best <= 0) continue;
      if (vals.every((v) => v === best)) continue;
      m.set(c.key, best);
    }
    return m;
  }, [rows]);

  const toggle = (key: Key) => setSort((s) => (s.key === key ? { key, desc: !s.desc } : { key, desc: COLS.find((c) => c.key === key)!.better === "up" }));

  return (
    <>
      {/* Tableau (grand écran) */}
      <div className="hidden overflow-x-auto xl:block">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-y border-line bg-canvas/60 text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
              <th className="px-5 py-2.5">Coach</th>
              {COLS.map((c) => (
                <th key={c.key} className="px-2 py-2.5 text-right" title={c.title ?? c.label}>
                  <button type="button" onClick={() => toggle(c.key)} className={cn("inline-flex items-center gap-1 uppercase hover:text-ink", sort.key === c.key && "text-brand-600")}>
                    {c.short}
                    {sort.key === c.key && (sort.desc ? <ArrowDown className="size-3" /> : <ArrowUp className="size-3" />)}
                  </button>
                </th>
              ))}
              <th className="px-3 py-2.5" aria-label="Liens" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {sorted.map((r) => (
              <tr key={r.id} className={cn("transition hover:bg-canvas/60", r.best && "bg-emerald-50/50", r.watch && "bg-amber-50/50")}>
                <td className="px-5 py-3">
                  <Link href={`/coachs/${r.id}`} className="flex min-w-0 items-center gap-2.5 hover:text-brand-600">
                    <Avatar name={r.name} size={30} />
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5 font-semibold">
                        <span className="truncate">{r.name}</span>
                        {r.best && <Crown className="size-3.5 shrink-0 text-accent-500" aria-label="Meilleur coach de la période" />}
                      </span>
                      {r.watch ? <span className="block text-[11px] font-semibold text-amber-700">{r.watch}</span> : r.best ? <span className="block text-[11px] font-semibold text-emerald-700">Le plus actif</span> : null}
                    </span>
                  </Link>
                </td>
                {COLS.map((c) => {
                  const v = num(r, c.key);
                  const top = v !== null && bestOf.get(c.key) === v;
                  return (
                    <td key={c.key} className={cn("whitespace-nowrap px-2 py-3 text-right tabular-nums", top ? "font-bold text-emerald-700" : "text-ink")}>
                      {c.key === "occupancy" ? (
                        <span className="inline-flex items-center gap-1.5">
                          <span className="hidden h-1.5 w-10 overflow-hidden rounded-full bg-canvas lg:inline-block">
                            <span className={cn("block h-full rounded-full", occTone(r.occupancy))} style={{ width: `${Math.min(100, Math.round(r.occupancy ?? 0))}%` }} />
                          </span>
                          {cell(r, c.key)}
                        </span>
                      ) : (
                        cell(r, c.key)
                      )}
                    </td>
                  );
                })}
                <td className="px-3 py-3">
                  <span className="flex justify-end gap-1">
                    <Link href={`/coachs/${r.id}`} title="Fiche coach (planning, disponibilités)" className="grid size-7 place-items-center rounded-lg text-muted hover:bg-brand-50 hover:text-brand-600">
                      <Eye className="size-4" />
                    </Link>
                    <Link href={`/admin/coachs/${r.id}`} title="Gérer le compte (admin)" className="grid size-7 place-items-center rounded-lg text-muted hover:bg-brand-50 hover:text-brand-600">
                      <Settings2 className="size-4" />
                    </Link>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Cartes (mobile / tablette) */}
      <ul className="divide-y divide-line border-t border-line xl:hidden">
        {sorted.map((r) => (
          <li key={r.id} className={cn("px-4 py-3", r.best && "bg-emerald-50/50", r.watch && "bg-amber-50/50")}>
            <div className="flex items-center gap-2.5">
              <Avatar name={r.name} size={32} />
              <Link href={`/coachs/${r.id}`} className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 text-sm font-semibold">
                  <span className="truncate">{r.name}</span>
                  {r.best && <Crown className="size-3.5 shrink-0 text-accent-500" />}
                </span>
                {r.watch && <span className="block text-[11px] font-semibold text-amber-700">{r.watch}</span>}
              </Link>
              <Link href={`/admin/coachs/${r.id}`} title="Gérer le compte (admin)" className="grid size-8 place-items-center rounded-lg text-muted hover:bg-brand-50 hover:text-brand-600">
                <Settings2 className="size-4" />
              </Link>
            </div>
            <dl className="mt-2.5 grid grid-cols-3 gap-x-3 gap-y-2 text-xs sm:grid-cols-5">
              {COLS.map((c) => (
                <div key={c.key} className="min-w-0">
                  <dt className="truncate text-muted">{c.label}</dt>
                  <dd className="font-semibold tabular-nums text-ink">{cell(r, c.key)}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}
