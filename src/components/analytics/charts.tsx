"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const BRAND = "#1a6d8e";
const ACCENT = "#e8782a";
const AXIS = { fontSize: 12, fill: "#66727e" };
const nf = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

type TipItem = { dataKey?: string | number; name?: string | number; value?: number | string; color?: string; payload?: { fill?: string } };

function Tip({ active, payload, label, unit }: { active?: boolean; payload?: TipItem[]; label?: string | number; unit?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-line bg-white px-3.5 py-2.5 text-xs shadow-pop">
      {label !== undefined && <p className="mb-1.5 font-semibold text-ink">{label}</p>}
      {payload.map((p, i) => (
        <p key={String(p.dataKey ?? i)} className="flex items-center gap-2 text-muted">
          <span className="size-2 rounded-full" style={{ background: p.color ?? p.payload?.fill }} />
          {p.name}
          <b className="ml-auto pl-3 text-ink">
            {nf.format(Number(p.value ?? 0))}
            {unit ? ` ${unit}` : ""}
          </b>
        </p>
      ))}
    </div>
  );
}

/** Chiffre d'affaires mensuel (aire dégradée). */
export function RevenueArea({ data, height = 260 }: { data: { label: string; value: number }[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -6, bottom: 0 }}>
        <defs>
          <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={BRAND} stopOpacity={0.28} />
            <stop offset="100%" stopColor={BRAND} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#eef1f4" vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={AXIS} dy={6} />
        <YAxis tickLine={false} axisLine={false} tick={AXIS} width={52} tickFormatter={(v: number) => (v >= 1000 ? `${nf.format(v / 1000)}k` : String(v))} />
        <Tooltip content={<Tip unit="MAD" />} cursor={{ stroke: "#cbd5e1", strokeDasharray: "4 4" }} />
        <Area type="monotone" dataKey="value" name="Encaissé" stroke={BRAND} strokeWidth={2.5} fill="url(#revFill)" dot={{ r: 3.5, strokeWidth: 2, fill: "#fff" }} activeDot={{ r: 5.5, strokeWidth: 0 }} animationDuration={700} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Séances par mois empilées par statut. */
export function StackedSessions({ data, height = 260 }: { data: { label: string; realisee: number; absent: number; annulee: number; planifiee: number }[]; height?: number }) {
  const series = [
    { key: "realisee", label: "Réalisées", color: BRAND },
    { key: "planifiee", label: "Planifiées", color: "#7fb7cc" },
    { key: "absent", label: "Absences", color: ACCENT },
    { key: "annulee", label: "Annulées", color: "#cbd5e1" },
  ];
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
        <CartesianGrid stroke="#eef1f4" vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={AXIS} dy={6} />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={AXIS} />
        <Tooltip content={<Tip />} cursor={{ fill: "#f4f6f8" }} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 10 }} formatter={(v) => <span className="text-muted">{v}</span>} />
        {series.map((s, i) => (
          <Bar key={s.key} dataKey={s.key} name={s.label} stackId="s" fill={s.color} maxBarSize={42} radius={i === series.length - 1 ? [8, 8, 0, 0] : [0, 0, 0, 0]} animationDuration={700} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Clients actifs dans le temps. */
export function ActiveClientsLine({ data, height = 240 }: { data: { label: string; value: number }[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
        <CartesianGrid stroke="#eef1f4" vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={AXIS} dy={6} />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={AXIS} />
        <Tooltip content={<Tip />} cursor={{ stroke: "#cbd5e1", strokeDasharray: "4 4" }} />
        <Line type="monotone" dataKey="value" name="Clients actifs" stroke={ACCENT} strokeWidth={2.5} dot={{ r: 3.5, strokeWidth: 2, fill: "#fff" }} activeDot={{ r: 5.5, strokeWidth: 0 }} animationDuration={700} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export const DONUT_COLORS = [BRAND, ACCENT, "#0f766e", "#7fb7cc", "#f4b183", "#155a75", "#94a3b8", "#c2410c", "#38bdf8"];

/** Anneau + légende (répartition). */
export function Donut({ data, centerLabel = "Total" }: { data: { label: string; value: number }[]; centerLabel?: string }) {
  const total = data.reduce((a, d) => a + d.value, 0);
  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
      <div className="relative size-48 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="label" innerRadius="64%" outerRadius="100%" paddingAngle={2} stroke="none" animationDuration={700}>
              {data.map((_, i) => (
                <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<Tip unit="séance(s)" />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="font-display text-2xl font-extrabold text-ink">{total}</p>
            <p className="text-[11px] font-medium text-muted">{centerLabel}</p>
          </div>
        </div>
      </div>
      <ul className="w-full min-w-0 flex-1 space-y-2">
        {data.map((d, i) => (
          <li key={d.label} className="flex items-center gap-2.5 text-sm">
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
            <span className="min-w-0 flex-1 truncate text-slate-600">{d.label}</span>
            <b className="text-ink">{d.value}</b>
            <span className="w-10 text-right text-xs text-muted">{total ? Math.round((d.value / total) * 100) : 0}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
