import type { ReactNode } from "react";

/** Anneau de progression SVG (0–100) */
export function ProgressRing({ pct, size = 112, stroke = 10, color = "#e8782a", track = "#f1f5f9", children }: { pct: number; size?: number; stroke?: number; color?: string; track?: string; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, pct));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - p / 100)}
          style={{ transition: "stroke-dashoffset .8s ease" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}

export function RankMedal({ rank, size = 36 }: { rank: number; size?: number }) {
  const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null;
  if (medal) return <span className="grid shrink-0 place-items-center leading-none" style={{ width: size, height: size, fontSize: size * 0.75 }}>{medal}</span>;
  return (
    <span className="grid shrink-0 place-items-center rounded-full bg-slate-100 font-display text-sm font-bold text-slate-500" style={{ width: size, height: size }}>
      {rank}
    </span>
  );
}
