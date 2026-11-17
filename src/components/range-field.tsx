"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

const HINTS: Record<string, [string, string]> = {
  stress: ["Très calme", "Très stressé"],
  default: ["Très mauvais", "Excellent"],
};

export function RangeField({ name, label, defaultValue = 7, invert }: { name: string; label: string; defaultValue?: number; invert?: boolean }) {
  const [v, setV] = useState(defaultValue);
  const bad = invert ? v >= 7 : v <= 4;
  const mid = invert ? v >= 5 : v <= 6;
  const [lo, hi] = HINTS[invert ? "stress" : "default"]!;
  return (
    <div className="rounded-xl border border-line bg-white p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-700">{label}</span>
        <span className={cn("grid h-8 min-w-11 place-items-center rounded-lg px-2 font-display text-sm font-bold text-white transition-colors", bad ? "bg-red-500" : mid ? "bg-accent-500" : "bg-brand-500")}>
          {v}/10
        </span>
      </div>
      <input type="range" name={name} min={1} max={10} value={v} onChange={(e) => setV(Number(e.target.value))} className="mt-3 w-full cursor-pointer" />
      <div className="mt-1 flex justify-between text-[11px] text-slate-400">
        <span>{lo}</span>
        <span>{hi}</span>
      </div>
    </div>
  );
}
