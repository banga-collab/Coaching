"use client";

import { Minus, Plus, SkipForward, Timer } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtClock } from "./utils";

/** Bottom sheet du temps de repos avec compte à rebours circulaire. */
export function RestSheet({
  remaining,
  total,
  next,
  onAdd,
  onSkip,
}: {
  remaining: number;
  total: number;
  next?: string | null;
  onAdd: (sec: number) => void;
  onSkip: () => void;
}) {
  const over = remaining <= 0;
  const r = 44;
  const c = 2 * Math.PI * r;
  const pct = total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0;
  return (
    <div className="no-print fixed inset-x-0 bottom-[72px] z-40 px-3 lg:bottom-6 lg:left-[260px]">
      <div
        className={cn(
          "mx-auto flex max-w-md items-center gap-4 rounded-3xl p-3.5 pr-4 text-white shadow-[0_20px_50px_-12px_rgba(15,23,42,.55)] ring-1 ring-white/10 animate-[rest-in_.3s_cubic-bezier(.2,.8,.2,1)]",
          over ? "bg-gradient-to-br from-emerald-600 to-emerald-500" : "bg-gradient-to-br from-slate-900 to-brand-900",
        )}
        role="timer"
        aria-live="polite"
      >
        <style>{`@keyframes rest-in{from{transform:translateY(24px);opacity:0}to{transform:none;opacity:1}}@keyframes rest-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}`}</style>
        <div className={cn("relative size-[104px] shrink-0", over && "animate-[rest-pulse_.8s_ease-in-out_infinite]")}>
          <svg viewBox="0 0 100 100" className="size-full -rotate-90">
            <circle cx="50" cy="50" r={r} fill="none" stroke="currentColor" strokeWidth="7" className="text-white/15" />
            <circle
              cx="50"
              cy="50"
              r={r}
              fill="none"
              stroke="currentColor"
              strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray={c}
              strokeDashoffset={c * (1 - pct)}
              className={cn("transition-[stroke-dashoffset] duration-300 ease-linear", over ? "text-white" : remaining <= 10 ? "text-accent-400" : "text-sky-300")}
            />
          </svg>
          <div className="absolute inset-0 grid place-items-center text-center">
            <div>
              <p className="font-display text-[26px] font-extrabold tabular-nums leading-none">{over ? "Go !" : fmtClock(remaining)}</p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-white/60">{over ? "repos fini" : "repos"}</p>
            </div>
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-white/70">
            <Timer className="size-3.5" /> {over ? "C'est reparti 💪" : "Récupère, respire…"}
          </p>
          {next && <p className="mt-0.5 truncate text-sm font-bold">Ensuite : {next}</p>}
          <div className="mt-2.5 flex items-center gap-2">
            <button
              type="button"
              onClick={() => onAdd(-15)}
              className="grid h-11 flex-1 place-items-center rounded-xl bg-white/10 text-sm font-bold transition active:scale-95 hover:bg-white/20"
              aria-label="Retirer 15 secondes"
            >
              <span className="inline-flex items-center gap-0.5"><Minus className="size-3.5" />15</span>
            </button>
            <button
              type="button"
              onClick={() => onAdd(15)}
              className="grid h-11 flex-1 place-items-center rounded-xl bg-white/10 text-sm font-bold transition active:scale-95 hover:bg-white/20"
              aria-label="Ajouter 15 secondes"
            >
              <span className="inline-flex items-center gap-0.5"><Plus className="size-3.5" />15</span>
            </button>
            <button
              type="button"
              onClick={onSkip}
              className={cn("grid h-11 flex-1 place-items-center rounded-xl text-sm font-bold transition active:scale-95", over ? "bg-white text-emerald-700" : "bg-accent-500 hover:bg-accent-600")}
              aria-label={over ? "Fermer" : "Passer le repos"}
            >
              <span className="inline-flex items-center gap-1">{over ? "OK" : <><SkipForward className="size-4" /></>}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
