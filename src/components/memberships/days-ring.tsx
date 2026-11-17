import { cn } from "@/lib/utils";

/** Anneau de progression : part du temps restant sur l'abonnement. */
export function DaysRing({
  left,
  total,
  size = 112,
  stroke = 9,
  tone = "light",
  label = "jours",
}: {
  left: number;
  total: number;
  size?: number;
  stroke?: number;
  tone?: "light" | "dark";
  label?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = total > 0 ? Math.max(0, Math.min(1, left / total)) : 0;
  const color = left < 0 ? "#f87171" : left <= 7 ? "#fbbf24" : tone === "light" ? "#ffffff" : "#1a6d8e";
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className={tone === "light" ? "stroke-white/20" : "stroke-slate-100"} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          className="transition-[stroke-dashoffset] duration-700"
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <p className={cn("font-display font-extrabold leading-none tabular-nums", tone === "light" ? "text-white" : "text-ink")} style={{ fontSize: size * 0.28 }}>
            {Math.max(0, left)}
          </p>
          <p className={cn("mt-1 text-[11px] font-semibold uppercase tracking-wider", tone === "light" ? "text-white/70" : "text-muted")}>{label}</p>
        </div>
      </div>
    </div>
  );
}
