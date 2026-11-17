"use client";

import { useOptimistic, useTransition } from "react";
import { Droplet, Droplets, Minus, Plus } from "lucide-react";
import { addWaterAction } from "@/actions/nutrition";
import { cn, num } from "@/lib/utils";
import { WATER_GOAL_ML, WATER_STEP_ML } from "./shared";

export function WaterTracker({ date, ml }: { date: string; ml: number }) {
  const [value, setValue] = useOptimistic(ml);
  const [pending, startTransition] = useTransition();
  const glasses = Math.round(WATER_GOAL_ML / WATER_STEP_ML);
  const filled = Math.floor(value / WATER_STEP_ML);
  const pct = Math.min(100, Math.round((value / WATER_GOAL_ML) * 100));

  function change(delta: number) {
    startTransition(async () => {
      setValue(Math.max(0, value + delta));
      await addWaterAction(date, delta);
    });
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50 via-white to-white p-4 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-xl bg-sky-500 text-white shadow-sm shadow-sky-500/30">
            <Droplets className="size-5" />
          </span>
          <div>
            <p className="font-display text-[15px] font-bold text-ink">Hydratation</p>
            <p className="text-xs text-muted" aria-live="polite">
              <b className="text-base text-sky-700">{num(value / 1000)} L</b> / {num(WATER_GOAL_ML / 1000)} L · {pct} %
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => change(-WATER_STEP_ML)}
            disabled={value <= 0 || pending}
            className="grid size-11 place-items-center rounded-xl border border-sky-200 bg-white text-sky-700 transition active:scale-95 disabled:opacity-40"
            aria-label="Retirer 250 ml"
          >
            <Minus className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => change(WATER_STEP_ML)}
            className="inline-flex h-11 items-center gap-1.5 rounded-xl bg-sky-500 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-sky-600 active:scale-95"
            aria-label="Ajouter un verre de 250 ml"
          >
            <Plus className="size-4" /> 250 ml
          </button>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-8 gap-1.5" aria-hidden>
        {Array.from({ length: glasses }, (_, i) => (
          <div key={i} className={cn("grid h-9 place-items-center rounded-lg transition-colors duration-300", i < filled ? "bg-sky-500 text-white" : "bg-sky-100/70 text-sky-300")}>
            <Droplet className="size-4" fill={i < filled ? "currentColor" : "none"} />
          </div>
        ))}
      </div>
      {value >= WATER_GOAL_ML && <p className="mt-3 text-center text-xs font-semibold text-sky-700">Objectif d&apos;hydratation atteint, bravo ! 💧</p>}
    </div>
  );
}
