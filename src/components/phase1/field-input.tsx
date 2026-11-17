"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import type { AssessmentField } from "@/lib/types";
import { cn } from "@/lib/utils";

const inputCls =
  "w-full rounded-xl border border-line bg-white px-3.5 h-11 text-sm text-ink placeholder:text-slate-400 transition focus:outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-50";

/** Rendu d'un champ d'évaluation (formulaire réel ou aperçu du constructeur). */
export function AssessmentFieldInput({ field, name, previous, index }: { field: AssessmentField; name?: string; previous?: string; index?: number }) {
  return (
    <div className="rounded-xl border border-line bg-white p-4 transition hover:border-slate-300">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-700">
            {index !== undefined && <span className="mr-1.5 text-slate-400">{index + 1}.</span>}
            {field.label || <span className="italic text-slate-400">Champ sans titre</span>}
          </p>
          {field.help && <p className="mt-0.5 text-xs text-muted">{field.help}</p>}
        </div>
        {previous && <span className="shrink-0 rounded-lg bg-canvas px-2 py-1 text-[11px] font-medium text-muted">Précédent : {previous}</span>}
      </div>
      <Control field={field} name={name} />
    </div>
  );
}

function Control({ field, name }: { field: AssessmentField; name?: string }) {
  switch (field.type) {
    case "number":
      return (
        <div className="relative sm:max-w-xs">
          <input name={name} inputMode="decimal" placeholder="—" className={cn(inputCls, field.unit && "pr-16")} />
          {field.unit && <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm font-medium text-muted">{field.unit}</span>}
        </div>
      );
    case "scale":
      return <ScaleInput name={name} />;
    case "text":
      return <textarea name={name} rows={3} placeholder="Observations…" className={cn(inputCls, "h-auto min-h-[84px] resize-y py-3")} />;
    case "choice":
      return <ChoiceInput name={name} options={field.options ?? []} />;
    case "yesno":
      return <YesNoInput name={name} />;
  }
}

function ScaleInput({ name }: { name?: string }) {
  const [v, setV] = useState(5);
  const [touched, setTouched] = useState(false);
  const tone = v <= 4 ? "bg-red-500" : v <= 6 ? "bg-accent-500" : "bg-brand-500";
  return (
    <div>
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={1}
          max={10}
          value={v}
          onChange={(e) => {
            setV(Number(e.target.value));
            setTouched(true);
          }}
          className="w-full cursor-pointer"
          aria-label="Note sur 10"
        />
        <span className={cn("grid h-8 min-w-12 place-items-center rounded-lg px-2 font-display text-sm font-bold text-white transition-colors", touched ? tone : "bg-slate-300")}>
          {touched ? `${v}/10` : "–"}
        </span>
      </div>
      <div className="mt-1 flex justify-between pr-[60px] text-[11px] text-slate-400">
        <span>1 · faible</span>
        <span>10 · excellent</span>
      </div>
      {name && <input type="hidden" name={name} value={touched ? v : ""} />}
    </div>
  );
}

function ChoiceInput({ name, options }: { name?: string; options: string[] }) {
  const [v, setV] = useState<string | null>(null);
  if (!options.length) return <p className="text-xs italic text-slate-400">Ajoute des options pour ce choix.</p>;
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          role="radio"
          aria-checked={v === o}
          onClick={() => setV(v === o ? null : o)}
          className={cn(
            "inline-flex h-9 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition",
            v === o ? "border-brand-500 bg-brand-500 text-white shadow-sm shadow-brand-500/20" : "border-line bg-white text-slate-600 hover:border-brand-200 hover:bg-brand-50",
          )}
        >
          {v === o && <Check className="size-3.5" />}
          {o}
        </button>
      ))}
      {name && <input type="hidden" name={name} value={v ?? ""} />}
    </div>
  );
}

function YesNoInput({ name }: { name?: string }) {
  const [v, setV] = useState<"oui" | "non" | null>(null);
  return (
    <div className="inline-flex rounded-xl border border-line bg-canvas p-1">
      {(["oui", "non"] as const).map((o) => (
        <button
          key={o}
          type="button"
          aria-pressed={v === o}
          onClick={() => setV(v === o ? null : o)}
          className={cn(
            "inline-flex h-9 min-w-24 items-center justify-center gap-1.5 rounded-lg px-4 text-sm font-semibold transition",
            v === o ? (o === "oui" ? "bg-emerald-500 text-white shadow-sm" : "bg-slate-700 text-white shadow-sm") : "text-slate-500 hover:text-ink",
          )}
        >
          {o === "oui" ? <Check className="size-4" /> : <X className="size-4" />}
          {o === "oui" ? "Oui" : "Non"}
        </button>
      ))}
      {name && <input type="hidden" name={name} value={v ?? ""} />}
    </div>
  );
}
