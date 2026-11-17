"use client";

import { useMemo, useState } from "react";
import { ArrowRight, CalendarRange, Columns2, Scale, SlidersHorizontal, TrendingDown, TrendingUp } from "lucide-react";
import { cn, fmtDate, num, signed } from "@/lib/utils";
import { CompareSlider } from "./compare-slider";
import { POSE_LABEL, type Pose } from "./shared";

export type ComparePhoto = { id: string; taken_on: string; pose: Pose; weight_kg: number | null };

const fmt = (d: string) => fmtDate(`${d}T12:00:00Z`, { day: "numeric", month: "short", year: "numeric" });

export function PhotoCompare({ photos }: { photos: ComparePhoto[] }) {
  const poses = (["face", "profil", "dos"] as Pose[]).filter((p) => new Set(photos.filter((x) => x.pose === p).map((x) => x.taken_on)).size >= 2);
  const [pose, setPose] = useState<Pose>(poses[0] ?? "face");
  const dates = useMemo(() => [...new Set(photos.filter((p) => p.pose === pose).map((p) => p.taken_on))].sort(), [photos, pose]);
  const [from, setFrom] = useState<string>(dates[0] ?? "");
  const [to, setTo] = useState<string>(dates.at(-1) ?? "");
  const [mode, setMode] = useState<"slider" | "side">("slider");

  // Recale les dates si la pose change
  const a = dates.includes(from) ? from : (dates[0] ?? "");
  const b = dates.includes(to) && to !== a ? to : (dates.filter((d) => d !== a).at(-1) ?? "");
  const [d1, d2] = a <= b ? [a, b] : [b, a];
  const first = photos.find((p) => p.pose === pose && p.taken_on === d1) ?? null;
  const second = photos.find((p) => p.pose === pose && p.taken_on === d2) ?? null;

  // Poids : celui de la photo, sinon celui d'une autre pose le même jour
  const weightOn = (d: string) => photos.find((p) => p.taken_on === d && p.weight_kg !== null)?.weight_kg ?? null;
  const wA = d1 ? weightOn(d1) : null;
  const wB = d2 ? weightOn(d2) : null;
  const delta = wA !== null && wB !== null ? Math.round((Number(wB) - Number(wA)) * 10) / 10 : null;
  const days = d1 && d2 ? Math.round((new Date(d2).getTime() - new Date(d1).getTime()) / 86400000) : 0;

  if (!poses.length) return null;

  const sel = "h-11 w-full appearance-none rounded-xl border border-line bg-white px-3.5 text-sm font-semibold text-ink focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-50";

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-gradient-to-r from-brand-50/80 via-white to-accent-50/60 px-5 py-4">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl bg-brand-500 text-white shadow-sm shadow-brand-500/30">
            <Columns2 className="size-4" />
          </span>
          <div>
            <h3 className="font-display text-[15px] font-bold text-ink">Avant / après</h3>
            <p className="text-xs text-muted">Compare deux dates pour la même pose</p>
          </div>
        </div>
        <div className="flex gap-1 rounded-xl bg-white p-1 ring-1 ring-line">
          {(
            [
              ["slider", "Curseur", SlidersHorizontal],
              ["side", "Côte à côte", Columns2],
            ] as const
          ).map(([k, l, Icon]) => (
            <button
              key={k}
              type="button"
              onClick={() => setMode(k)}
              aria-pressed={mode === k}
              className={cn("inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition", mode === k ? "bg-brand-500 text-white shadow-sm" : "text-muted hover:text-ink")}
            >
              <Icon className="size-3.5" /> {l}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        {/* Sélecteurs */}
        <div className="grid gap-3 sm:grid-cols-[auto_1fr_auto_1fr] sm:items-end">
          <div>
            <p className="mb-1.5 text-xs font-semibold text-slate-600">Pose</p>
            <div className="flex gap-1 rounded-xl bg-canvas p-1">
              {(["face", "profil", "dos"] as Pose[]).map((p) => {
                const ok = poses.includes(p);
                return (
                  <button
                    key={p}
                    type="button"
                    disabled={!ok}
                    onClick={() => setPose(p)}
                    aria-pressed={pose === p}
                    className={cn("min-h-9 flex-1 rounded-lg px-3 text-sm font-semibold transition disabled:opacity-35", pose === p ? "bg-white text-brand-600 shadow-sm" : "text-muted hover:text-ink")}
                  >
                    {POSE_LABEL[p]}
                  </button>
                );
              })}
            </div>
          </div>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-600">Avant</span>
            <select value={a} onChange={(e) => setFrom(e.target.value)} className={sel}>
              {dates.map((d) => (
                <option key={d} value={d} disabled={d === b}>
                  {fmt(d)}
                </option>
              ))}
            </select>
          </label>
          <ArrowRight className="mx-auto mb-3 hidden size-4 text-slate-300 sm:block" />
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-slate-600">Après</span>
            <select value={b} onChange={(e) => setTo(e.target.value)} className={sel}>
              {dates.map((d) => (
                <option key={d} value={d} disabled={d === a}>
                  {fmt(d)}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* Bilan */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Fact icon={<CalendarRange className="size-4" />} label="Écart" value={days >= 60 ? `${Math.round(days / 30.4)} mois` : `${Math.abs(days)} jours`} />
          <Fact
            icon={delta !== null && delta < 0 ? <TrendingDown className="size-4" /> : <TrendingUp className="size-4" />}
            label="Poids"
            value={delta !== null ? signed(delta, "kg") : "–"}
            tone={delta === null ? "gray" : delta < 0 ? "green" : delta > 0 ? "accent" : "gray"}
          />
          <Fact icon={<Scale className="size-4" />} label="De → à" value={wA !== null && wB !== null ? `${num(wA)} → ${num(wB)} kg` : "–"} className="col-span-2 sm:col-span-1" />
        </div>

        {first && second ? (
          mode === "slider" ? (
            <div className="mx-auto max-w-md">
              <CompareSlider
                key={`${first.id}-${second.id}`}
                before={{ src: `/api/photos/${first.id}`, label: fmt(first.taken_on), sub: weightOn(first.taken_on) !== null ? `${num(weightOn(first.taken_on))} kg` : undefined }}
                after={{ src: `/api/photos/${second.id}`, label: fmt(second.taken_on), sub: weightOn(second.taken_on) !== null ? `${num(weightOn(second.taken_on))} kg` : undefined }}
              />
              <p className="mt-2 text-center text-xs text-muted">Glisse la poignée ou utilise les flèches du clavier (Maj pour aller plus vite).</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {[
                { p: first, tag: "Avant", tone: "bg-black/55" },
                { p: second, tag: "Après", tone: "bg-accent-500/90" },
              ].map(({ p, tag, tone }) => (
                <figure key={p.id} className="overflow-hidden rounded-2xl border border-line bg-slate-900">
                  <div className="relative aspect-[3/4]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/photos/${p.id}`} alt={`${tag} : ${fmt(p.taken_on)}`} className="absolute inset-0 size-full object-cover" loading="lazy" />
                    <span className={cn("absolute left-2 top-2 rounded-lg px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur", tone)}>{tag}</span>
                  </div>
                  <figcaption className="bg-white px-3 py-2.5">
                    <p className="text-sm font-bold text-ink">{fmt(p.taken_on)}</p>
                    <p className="text-xs text-muted">{weightOn(p.taken_on) !== null ? `${num(weightOn(p.taken_on))} kg` : "Poids non renseigné"}</p>
                  </figcaption>
                </figure>
              ))}
            </div>
          )
        ) : (
          <p className="rounded-xl bg-canvas px-4 py-6 text-center text-sm text-muted">Choisis deux dates différentes.</p>
        )}
      </div>
    </div>
  );
}

function Fact({ icon, label, value, tone = "brand", className }: { icon: React.ReactNode; label: string; value: string; tone?: "brand" | "green" | "accent" | "gray"; className?: string }) {
  const cls = { brand: "bg-brand-50 text-brand-500", green: "bg-emerald-50 text-emerald-600", accent: "bg-accent-50 text-accent-600", gray: "bg-slate-100 text-slate-500" }[tone];
  return (
    <div className={cn("flex items-center gap-2.5 rounded-xl border border-line px-3 py-2.5", className)}>
      <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg", cls)}>{icon}</span>
      <div className="min-w-0">
        <p className={cn("truncate font-display text-sm font-extrabold", tone === "green" ? "text-emerald-700" : "text-ink")}>{value}</p>
        <p className="text-[11px] text-muted">{label}</p>
      </div>
    </div>
  );
}
