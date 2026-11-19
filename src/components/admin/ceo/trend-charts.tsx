"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, Line, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmtInt, fmtMad, fmtOne } from "./format";

type SalesRow = { label: string; ventes: number; seances: number; clients: number; nouveaux: number };

const AXIS = { tickLine: false, axisLine: false, tick: { fontSize: 11, fill: "var(--color-muted)" } } as const;
const monthOnly = (v: string) => String(v).split(" ")[0]!;
const compact = (n: number) => (n >= 1000 ? `${fmtOne(Math.round(n / 100) / 10)}k` : fmtInt(n));

type TipItem = { dataKey?: string | number; name?: string | number; value?: number | string; color?: string; payload?: SalesRow };
function Tip({ active, payload, label, money }: { active?: boolean; payload?: TipItem[]; label?: string | number; money?: boolean }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  return (
    <div className="rounded-xl border border-line bg-white px-3.5 py-2.5 text-xs shadow-pop">
      <p className="mb-1.5 font-semibold text-ink">{label}</p>
      {payload.map((p, i) => (
        <p key={String(p.dataKey ?? i)} className="flex items-center gap-2 text-muted">
          <span className="size-2 rounded-full" style={{ background: p.color }} />
          {p.name}
          <b className="ml-auto pl-3 tabular-nums text-ink">{money && p.dataKey === "ventes" ? fmtMad(Number(p.value)) : fmtInt(Number(p.value))}</b>
        </p>
      ))}
      {money && row && (
        <p className="mt-1.5 border-t border-line pt-1.5 text-muted">
          {fmtInt(row.seances)} séances · {fmtInt(row.clients)} clients
        </p>
      )}
    </div>
  );
}

/** Chiffre des ventes par mois (12 mois) */
export function SalesChart({ data }: { data: SalesRow[] }) {
  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 6, left: -6, bottom: 0 }}>
          <defs>
            <linearGradient id="ceoSales" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#e8782a" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#e8782a" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--color-line)" vertical={false} />
          <XAxis dataKey="label" {...AXIS} dy={6} interval="preserveStartEnd" minTickGap={14} tickFormatter={monthOnly} />
          <YAxis {...AXIS} width={52} tickFormatter={(v: number) => compact(v)} />
          <Tooltip content={<Tip money />} cursor={{ stroke: "var(--color-line)" }} />
          <Area type="monotone" dataKey="ventes" name="Ventes" stroke="#e8782a" strokeWidth={2.5} fill="url(#ceoSales)" dot={{ r: 3, fill: "#e8782a", strokeWidth: 0 }} activeDot={{ r: 5 }} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Clients venus (barres) et nouveaux clients (ligne) par mois */
export function ClientsChart({ data }: { data: SalesRow[] }) {
  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 6, left: -24, bottom: 0 }} barCategoryGap="24%">
          <CartesianGrid stroke="var(--color-line)" vertical={false} />
          <XAxis dataKey="label" {...AXIS} dy={6} interval="preserveStartEnd" minTickGap={14} tickFormatter={monthOnly} />
          <YAxis allowDecimals={false} {...AXIS} />
          <Tooltip content={<Tip />} cursor={{ fill: "var(--color-canvas)" }} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 10 }} formatter={(v) => <span className="text-muted">{v}</span>} />
          <Bar dataKey="clients" name="Clients venus" fill="#1a6d8e" radius={[4, 4, 0, 0]} maxBarSize={34} isAnimationActive={false} />
          <Line type="monotone" dataKey="nouveaux" name="Nouveaux clients" stroke="#e8782a" strokeWidth={2.5} dot={{ r: 3, fill: "#e8782a", strokeWidth: 0 }} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Ventes par coach (barres horizontales) */
export function CoachSalesChart({ data }: { data: { name: string; value: number; done: number }[] }) {
  const h = Math.max(160, data.length * 44 + 30);
  return (
    <div className="w-full" style={{ height: h }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }} barCategoryGap="28%">
          <CartesianGrid stroke="var(--color-line)" horizontal={false} />
          <XAxis type="number" {...AXIS} tickFormatter={(v: number) => compact(v)} />
          <YAxis type="category" dataKey="name" {...AXIS} width={110} tick={{ fontSize: 12, fill: "var(--color-ink)", fontWeight: 600 }} />
          <Tooltip
            cursor={{ fill: "var(--color-canvas)" }}
            content={({ active, payload }) => {
              const p = payload?.[0]?.payload as { name: string; value: number; done: number } | undefined;
              if (!active || !p) return null;
              return (
                <div className="rounded-xl border border-line bg-white px-3.5 py-2.5 text-xs shadow-pop">
                  <p className="font-semibold text-ink">{p.name}</p>
                  <p className="mt-1 text-muted">
                    <b className="text-ink">{fmtMad(p.value)}</b> · {fmtInt(p.done)} séances
                  </p>
                </div>
              );
            }}
          />
          <Bar dataKey="value" name="Ventes" fill="#1a6d8e" radius={[0, 6, 6, 0]} maxBarSize={26} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
