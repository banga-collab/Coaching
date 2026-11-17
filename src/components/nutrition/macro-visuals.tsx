/** Visuels macros en SVG pur (sans état) : anneaux, barre de répartition, donut, barres cible. */
import { cn, num } from "@/lib/utils";
import { MACRO_COLORS, MACRO_LABELS, macroSplit, pct, type Totals } from "./shared";

/** Anneau de progression consommé / cible */
export function Ring({
  value,
  target,
  color,
  size = 88,
  stroke = 9,
  label,
  unit = "g",
  big,
}: {
  value: number;
  target: number;
  color: string;
  size?: number;
  stroke?: number;
  label: string;
  unit?: string;
  big?: boolean;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = target ? Math.min(1, value / target) : 0;
  const over = target > 0 && value > target * 1.05;
  return (
    <div className="flex flex-col items-center text-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#eef1f4" strokeWidth={stroke} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={over ? "#dc2626" : color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${c * p} ${c}`}
            className="transition-[stroke-dasharray] duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <div className="leading-none">
            <p className={cn("font-display font-extrabold text-ink", big ? "text-2xl" : "text-[15px]")}>{num(Math.round(value))}</p>
            <p className={cn("mt-1 text-muted", big ? "text-xs" : "text-[10px]")}>
              / {num(Math.round(target))} {unit}
            </p>
          </div>
        </div>
      </div>
      <p className="mt-2 text-xs font-semibold text-slate-600">
        {label}
        <span className="sr-only"> : {Math.round(value)} sur {Math.round(target)} {unit}</span>
      </p>
      {target > 0 && <p className={cn("text-[11px] font-semibold", over ? "text-red-600" : "text-muted")}>{pct(value, target)} %</p>}
    </div>
  );
}

/** Barre horizontale empilée : répartition énergétique P / G / L */
export function MacroSplitBar({ totals, showLegend = true, className }: { totals: Pick<Totals, "protein" | "carbs" | "fat">; showLegend?: boolean; className?: string }) {
  const s = macroSplit(totals);
  const empty = !s.protein && !s.carbs && !s.fat;
  return (
    <div className={className}>
      <div className="flex h-2 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`Protéines ${s.protein} %, glucides ${s.carbs} %, lipides ${s.fat} %`}>
        {!empty && (
          <>
            <span style={{ width: `${s.protein}%`, background: MACRO_COLORS.protein }} />
            <span style={{ width: `${s.carbs}%`, background: MACRO_COLORS.carbs }} />
            <span style={{ width: `${s.fat}%`, background: MACRO_COLORS.fat }} />
          </>
        )}
      </div>
      {showLegend && (
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted">
          {(["protein", "carbs", "fat"] as const).map((k) => (
            <span key={k} className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-full" style={{ background: MACRO_COLORS[k] }} />
              {MACRO_LABELS[k]} <b className="text-ink">{Math.round(totals[k])} g</b>
              <span className="text-slate-400">· {s[k]} %</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** Donut de répartition des macros (énergie) avec kcal au centre */
export function MacroDonut({ totals, size = 160 }: { totals: Totals; size?: number }) {
  const s = macroSplit(totals);
  const stroke = 20;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const keys = ["protein", "carbs", "fat"] as const;
  let offset = 0;
  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" role="img" aria-label="Répartition des macronutriments">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#eef1f4" strokeWidth={stroke} />
        {keys.map((k) => {
          const len = (s[k] / 100) * c;
          const el = (
            <circle
              key={k}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={MACRO_COLORS[k]}
              strokeWidth={stroke}
              strokeDasharray={`${Math.max(0, len - 2)} ${c}`}
              strokeDashoffset={-offset}
            />
          );
          offset += len;
          return el;
        })}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="font-display text-2xl font-extrabold leading-none text-ink">{num(Math.round(totals.kcal))}</p>
          <p className="mt-1 text-xs text-muted">kcal / jour</p>
        </div>
      </div>
    </div>
  );
}

/** Barre de progression valeur / cible (couleur + dépassement) */
export function TargetBar({ label, value, target, unit, color }: { label: string; value: number; target: number; unit: string; color: string }) {
  const p = target ? Math.min(100, (value / target) * 100) : 0;
  const ratio = target ? value / target : 0;
  const off = target > 0 && (ratio > 1.1 || ratio < 0.9);
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2 text-xs">
        <span className="inline-flex items-center gap-1.5 font-semibold text-slate-600">
          <span className="size-2 rounded-full" style={{ background: color }} />
          {label}
        </span>
        <span className="text-muted">
          <b className={cn("text-ink", off && "text-amber-600")}>{num(Math.round(value))}</b> / {num(Math.round(target))} {unit}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${p}%`, background: color }} />
      </div>
    </div>
  );
}
