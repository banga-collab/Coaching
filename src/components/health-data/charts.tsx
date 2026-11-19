/** Petits graphiques rendus côté serveur (aucun JavaScript envoyé au navigateur). */
import { cn, fmtDate } from "@/lib/utils";

const short = (day: string) => fmtDate(`${day}T12:00:00Z`, { day: "numeric", month: "short" });
const long = (day: string) => fmtDate(`${day}T12:00:00Z`, { weekday: "short", day: "numeric", month: "short" });

function Axis({ days }: { days: string[] }) {
  if (!days.length) return null;
  const mid = days[Math.floor((days.length - 1) / 2)]!;
  return (
    <div className="mt-1.5 flex justify-between text-[11px] text-muted tabular-nums">
      <span>{short(days[0]!)}</span>
      {days.length > 6 && <span className="hidden sm:inline">{short(mid)}</span>}
      <span>{short(days.at(-1)!)}</span>
    </div>
  );
}

/** Barres par jour avec ligne d'objectif. */
export function DayBars({
  days,
  values,
  max,
  goal,
  goalLabel,
  barClass,
  format,
  label,
}: {
  days: string[];
  values: (number | null)[];
  max: number;
  goal?: number;
  goalLabel?: string;
  barClass: (v: number) => string;
  format: (v: number) => string;
  label: string;
}) {
  const dense = days.length > 40;
  return (
    <figure aria-label={label}>
      <div className="relative h-36 sm:h-40">
        {goal !== undefined && goal <= max && (
          <div className="pointer-events-none absolute inset-x-0 z-10 border-t border-dashed border-slate-400/70" style={{ bottom: `${(goal / max) * 100}%` }}>
            {goalLabel && <span className="absolute -top-4 right-0 rounded bg-white/90 px-1 text-[10px] font-semibold text-slate-500">{goalLabel}</span>}
          </div>
        )}
        <div className={cn("flex h-full items-end", dense ? "gap-px" : "gap-[3px] sm:gap-1")}>
          {days.map((d, i) => {
            const v = values[i];
            return (
              <div key={d} className="group relative flex h-full min-w-0 flex-1 items-end" title={`${long(d)} : ${v === null || v === undefined ? "pas de donnée" : format(v)}`}>
                {v === null || v === undefined ? (
                  <div className="h-1 w-full rounded-sm bg-slate-100" />
                ) : (
                  <div className={cn("w-full transition-opacity group-hover:opacity-80", dense ? "rounded-[1px]" : "rounded-t-md", barClass(v))} style={{ height: `${Math.max(2, Math.min(100, (v / max) * 100))}%` }} />
                )}
              </div>
            );
          })}
        </div>
      </div>
      <Axis days={days} />
    </figure>
  );
}

/** Courbe (valeurs du jour en points clairs + moyenne glissante en trait plein). */
export function TrendLine({ days, values, smooth, label, unit }: { days: string[]; values: (number | null)[]; smooth: (number | null)[]; label: string; unit: string }) {
  const all = [...values, ...smooth].filter((v): v is number => v !== null);
  if (!all.length) return null;
  const lo = Math.floor(Math.min(...all) - 2);
  const hi = Math.ceil(Math.max(...all) + 2);
  const W = 600;
  const H = 160;
  const x = (i: number) => (days.length <= 1 ? W / 2 : (i / (days.length - 1)) * W);
  const y = (v: number) => H - ((v - lo) / (hi - lo || 1)) * H;
  const path = (arr: (number | null)[]) => {
    let d = "";
    let pen = false;
    arr.forEach((v, i) => {
      if (v === null) {
        pen = false;
        return;
      }
      d += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)} `;
      pen = true;
    });
    return d;
  };
  return (
    <figure aria-label={label}>
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex flex-col justify-between text-[10px] text-muted tabular-nums">
          <span>{hi}</span>
          <span>{lo}</span>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="ml-6 h-36 w-[calc(100%-1.5rem)] overflow-visible sm:h-40" role="img" aria-label={`${label} (${unit})`}>
          {[0.25, 0.5, 0.75].map((f) => (
            <line key={f} x1={0} x2={W} y1={H * f} y2={H * f} stroke="var(--color-line)" vectorEffect="non-scaling-stroke" />
          ))}
          <path d={path(values)} fill="none" stroke="var(--color-brand-200)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
          <path d={path(smooth)} fill="none" stroke="var(--color-accent-500)" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
      <div className="ml-6">
        <Axis days={days} />
      </div>
    </figure>
  );
}

/** Barre empilée horizontale (phases de sommeil). */
export function StackBar({ parts }: { parts: { label: string; value: number; className: string }[] }) {
  const total = parts.reduce((a, p) => a + p.value, 0);
  if (!total) return null;
  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-full bg-slate-100">
        {parts.map((p) => (
          <div key={p.label} className={p.className} style={{ width: `${(p.value / total) * 100}%` }} title={`${p.label} : ${Math.round((p.value / total) * 100)} %`} />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
        {parts.map((p) => (
          <span key={p.label} className="inline-flex items-center gap-1.5">
            <span className={cn("size-2 rounded-full", p.className)} />
            {p.label} {Math.round((p.value / total) * 100)} %
          </span>
        ))}
      </div>
    </div>
  );
}
