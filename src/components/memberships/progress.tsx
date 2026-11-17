import { cn } from "@/lib/utils";

/** Barre de progression fine avec libellé. */
export function MiniProgress({ label, value, pct, tone = "brand" }: { label: string; value: string; pct: number; tone?: "brand" | "accent" | "amber" | "red" | "green" }) {
  const bar = { brand: "bg-brand-500", accent: "bg-accent-500", amber: "bg-amber-400", red: "bg-red-500", green: "bg-emerald-500" }[tone];
  return (
    <div className="min-w-0">
      <div className="mb-1 flex items-baseline justify-between gap-2 text-[11px]">
        <span className="font-medium text-muted">{label}</span>
        <span className="font-semibold tabular-nums text-slate-700">{value}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className={cn("h-full rounded-full transition-all", bar)} style={{ width: `${Math.max(2, Math.min(100, pct))}%` }} />
      </div>
    </div>
  );
}
