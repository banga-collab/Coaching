"use client";

import { useState } from "react";
import { Repeat } from "lucide-react";
import { cn } from "@/lib/utils";

/** Option « répéter chaque semaine pendant N semaines » */
export function RepeatField() {
  const [on, setOn] = useState(false);
  const [weeks, setWeeks] = useState(4);
  return (
    <div className={cn("rounded-2xl border p-4 transition", on ? "border-brand-200 bg-brand-50/60" : "border-line bg-canvas/60")}>
      <label className="flex cursor-pointer items-center gap-3">
        <input type="checkbox" name="repeat" checked={on} onChange={(e) => setOn(e.target.checked)} className="size-5 rounded accent-brand-500" />
        <span className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Repeat className="size-4 text-brand-500" /> Répéter chaque semaine
        </span>
      </label>
      {on && (
        <div className="mt-3 flex flex-wrap items-center gap-2 pl-8 text-sm text-slate-600">
          pendant
          <input
            type="number"
            name="weeks"
            min={2}
            max={12}
            value={weeks}
            onChange={(e) => setWeeks(Number(e.target.value))}
            className="h-10 w-20 rounded-xl border border-line bg-white px-3 text-center font-semibold text-ink focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-50"
          />
          semaines
          <span className="w-full text-xs text-muted">{weeks > 1 ? `${weeks} cours seront créés, à la même heure chaque semaine.` : ""}</span>
        </div>
      )}
    </div>
  );
}
