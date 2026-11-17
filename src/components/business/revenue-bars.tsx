"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ACCENT, BRAND } from "@/components/charts";

const nf = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const compact = (v: number) => (v >= 1000 ? `${nf.format(v / 1000)}k` : nf.format(v));

export function RevenueBars({ data, height = 230 }: { data: { label: string; value: number }[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
        <CartesianGrid stroke="#eef1f4" vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#66727e" }} dy={6} interval={0} />
        <YAxis tickFormatter={compact} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#66727e" }} width={44} />
        <Tooltip
          cursor={{ fill: "#f4f6f8" }}
          content={({ active, payload, label }) =>
            active && payload?.length ? (
              <div className="rounded-xl border border-line bg-white px-3 py-2 text-xs shadow-pop">
                <p className="font-semibold capitalize text-ink">{label}</p>
                <p className="mt-0.5 text-muted">
                  Encaissé <b className="text-ink">{nf.format(Number(payload[0]!.value))} MAD</b>
                </p>
              </div>
            ) : null
          }
        />
        <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={34} animationDuration={700}>
          {data.map((_, i) => (
            <Cell key={i} fill={i === data.length - 1 ? ACCENT : BRAND} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
