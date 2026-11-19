"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { cn } from "@/lib/utils";

type Row = { label: string; realisee: number; absent: number; annulee: number };

const SERIES = [
  { key: "realisee", label: "Réalisées", color: "#1a6d8e" },
  { key: "absent", label: "Absences", color: "#e8782a" },
  { key: "annulee", label: "Annulées / refusées", color: "#94a3b8" },
] as const;

type TipItem = { dataKey?: string | number; name?: string | number; value?: number | string; color?: string };
function Tip({ active, payload, label }: { active?: boolean; payload?: TipItem[]; label?: string | number }) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((n, p) => n + Number(p.value ?? 0), 0);
  return (
    <div className="rounded-xl border border-line bg-white px-3.5 py-2.5 text-xs shadow-pop">
      <p className="mb-1.5 font-semibold text-ink">{label}</p>
      {payload.map((p, i) => (
        <p key={String(p.dataKey ?? i)} className="flex items-center gap-2 text-muted">
          <span className="size-2 rounded-full" style={{ background: p.color }} />
          {p.name}
          <b className="ml-auto pl-3 text-ink tabular-nums">{p.value}</b>
        </p>
      ))}
      <p className="mt-1.5 flex border-t border-line pt-1.5 text-muted">
        Total <b className="ml-auto pl-3 text-ink tabular-nums">{total}</b>
      </p>
    </div>
  );
}

/** Séances par mois (12 mois) ou par semaine (52 semaines) : réalisées / absences / annulées. */
export function ActivityChart({ months, weeks }: { months: Row[]; weeks: Row[] }) {
  const [view, setView] = useState<"mois" | "semaine">("mois");
  const data = view === "mois" ? months : weeks;
  return (
    <div>
      <div className="no-print mb-3 inline-flex rounded-xl border border-line bg-canvas p-1 text-xs font-semibold" role="tablist" aria-label="Regrouper par">
        {(["mois", "semaine"] as const).map((v) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={view === v}
            onClick={() => setView(v)}
            className={cn("rounded-lg px-3 py-1.5 transition", view === v ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink")}
          >
            {v === "mois" ? "Par mois (12)" : "Par semaine (52)"}
          </button>
        ))}
      </div>
      <div className="h-[260px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 4, left: -24, bottom: 0 }} barCategoryGap={view === "mois" ? "22%" : "12%"}>
            <CartesianGrid stroke="var(--color-line)" vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--color-muted)" }} dy={6} interval="preserveStartEnd" minTickGap={14} tickFormatter={(v: string) => (view === "mois" ? String(v).split(" ")[0]! : String(v))} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--color-muted)" }} />
            <Tooltip content={<Tip />} cursor={{ fill: "var(--color-canvas)" }} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 10 }} formatter={(v) => <span className="text-muted">{v}</span>} />
            {SERIES.map((s, i) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.label}
                stackId="s"
                fill={s.color}
                stroke="var(--color-white)"
                strokeWidth={view === "mois" ? 1 : 0}
                maxBarSize={36}
                radius={i === SERIES.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
