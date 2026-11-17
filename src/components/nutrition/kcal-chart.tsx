"use client";

import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const nf = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

/** Calories par jour vs objectif (ligne pointillée) */
export function KcalChart({ data, target, height = 220 }: { data: { label: string; kcal: number; protein: number }[]; target: number; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 12, right: 8, left: -14, bottom: 0 }}>
        <CartesianGrid stroke="#eef1f4" vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#66727e" }} dy={6} />
        <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#66727e" }} width={48} domain={[0, (max: number) => Math.max(max, target) * 1.1]} tickFormatter={(v: number) => nf.format(v)} />
        <Tooltip
          cursor={{ fill: "#f4f6f8" }}
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            const row = payload[0]!.payload as { kcal: number; protein: number };
            return (
              <div className="rounded-xl border border-line bg-white px-3.5 py-2.5 text-xs shadow-pop">
                <p className="mb-1 font-semibold text-ink">{label}</p>
                {row.kcal > 0 ? (
                  <>
                    <p className="text-muted">
                      <b className="text-ink">{nf.format(row.kcal)} kcal</b>
                      {target > 0 && ` · ${Math.round((row.kcal / target) * 100)} % de l'objectif`}
                    </p>
                    <p className="text-muted">Protéines : {nf.format(row.protein)} g</p>
                  </>
                ) : (
                  <p className="text-muted">Rien de noté</p>
                )}
              </div>
            );
          }}
        />
        {target > 0 && <ReferenceLine y={target} stroke="#e8782a" strokeDasharray="5 4" strokeWidth={1.5} label={{ value: `Objectif ${nf.format(target)}`, position: "insideTopRight", fontSize: 11, fill: "#c2611b" }} />}
        <Bar dataKey="kcal" radius={[8, 8, 0, 0]} maxBarSize={40} animationDuration={700}>
          {data.map((d, i) => (
            <Cell key={i} fill={!d.kcal ? "#e2e8f0" : target && d.kcal > target * 1.1 ? "#dc2626" : target && d.kcal < target * 0.8 ? "#94a3b8" : "#1a6d8e"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
