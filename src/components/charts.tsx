"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";

export const BRAND = "#1a6d8e";
export const ACCENT = "#e8782a";
export const GRAY = "#94a3b8";

export type Series = { key: string; label: string; color: string; unit?: string; right?: boolean; dashed?: boolean };
type Row = Record<string, string | number | null>;

const nf = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

function TooltipBox({ active, payload, label, series }: { active?: boolean; payload?: { dataKey: string; value: number; color: string }[]; label?: string; series: Series[] }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-line bg-white px-3.5 py-2.5 text-xs shadow-pop">
      <p className="mb-1.5 font-semibold text-ink">{label}</p>
      {payload.map((p) => {
        const s = series.find((x) => x.key === p.dataKey);
        return (
          <p key={p.dataKey} className="flex items-center gap-2 text-muted">
            <span className="size-2 rounded-full" style={{ background: p.color }} />
            {s?.label} <b className="ml-auto pl-3 text-ink">{nf.format(p.value)}{s?.unit ? ` ${s.unit}` : ""}</b>
          </p>
        );
      })}
    </div>
  );
}

export function TrendChart({ data, series, height = 260, domain }: { data: Row[]; series: Series[]; height?: number; domain?: [number, number] }) {
  const hasRight = series.some((s) => s.right);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: hasRight ? 0 : 8, left: -14, bottom: 0 }}>
        <CartesianGrid stroke="#eef1f4" vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#66727e" }} dy={6} />
        <YAxis yAxisId="l" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#66727e" }} domain={domain ?? ["auto", "auto"]} width={44} />
        {hasRight && <YAxis yAxisId="r" orientation="right" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#66727e" }} domain={["auto", "auto"]} width={40} />}
        <Tooltip content={<TooltipBox series={series} />} cursor={{ stroke: "#cbd5e1", strokeDasharray: "4 4" }} />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 10 }} formatter={(v) => <span className="text-muted">{v}</span>} />
        {series.map((s) => (
          <Line
            key={s.key}
            yAxisId={s.right ? "r" : "l"}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={s.color}
            strokeWidth={2.5}
            strokeDasharray={s.dashed ? "5 4" : undefined}
            dot={{ r: 3.5, strokeWidth: 2, fill: "#fff" }}
            activeDot={{ r: 5.5, strokeWidth: 0 }}
            connectNulls
            animationDuration={700}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function WeeklyBars({ data, height = 240 }: { data: { label: string; value: number }[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
        <CartesianGrid stroke="#eef1f4" vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#66727e" }} dy={6} />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#66727e" }} />
        <Tooltip
          cursor={{ fill: "#f4f6f8" }}
          content={({ active, payload, label }) =>
            active && payload?.length ? (
              <div className="rounded-xl border border-line bg-white px-3 py-2 text-xs shadow-pop">
                <b>{label}</b> · {payload[0]!.value} séance(s)
              </div>
            ) : null
          }
        />
        <Bar dataKey="value" radius={[8, 8, 0, 0]} maxBarSize={42} animationDuration={700}>
          {data.map((_, i) => (
            <Cell key={i} fill={i === data.length - 1 ? ACCENT : BRAND} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
