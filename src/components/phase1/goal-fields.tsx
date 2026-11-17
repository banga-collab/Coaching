"use client";

import { useState } from "react";
import { Activity, CalendarCheck, Dumbbell, Ruler, Scale, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import type { GoalMetric } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Field, Input } from "@/components/ui";
import { METRIC_META } from "./shared";

const ICONS: Record<GoalMetric, typeof Scale> = {
  weight_kg: Scale,
  body_fat: Activity,
  waist_cm: Ruler,
  squat_kg: Dumbbell,
  bench_kg: Dumbbell,
  deadlift_kg: Dumbbell,
  sessions: CalendarCheck,
  custom: Sparkles,
};
const ORDER: GoalMetric[] = ["weight_kg", "body_fat", "waist_cm", "squat_kg", "bench_kg", "deadlift_kg", "sessions", "custom"];
const nf = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

export type CurrentValues = Partial<Record<GoalMetric, { value: number; on: string }>>;

export function GoalFields({ current }: { current: CurrentValues }) {
  const [metric, setMetric] = useState<GoalMetric>("weight_kg");
  const [title, setTitle] = useState("");
  const [unit, setUnit] = useState(METRIC_META.weight_kg.unit);
  const [start, setStart] = useState(current.weight_kg ? String(current.weight_kg.value).replace(".", ",") : "");
  const [target, setTarget] = useState("");

  const pick = (m: GoalMetric) => {
    setMetric(m);
    setUnit(METRIC_META[m].unit);
    const c = current[m];
    setStart(m === "sessions" ? "0" : c ? String(c.value).replace(".", ",") : "");
  };

  const s = Number(start.replace(",", "."));
  const t = Number(target.replace(",", "."));
  const direction = start && target && Number.isFinite(s) && Number.isFinite(t) && s !== t ? (t < s ? "down" : "up") : null;
  const cur = current[metric];

  return (
    <div className="space-y-5">
      <input type="hidden" name="metric" value={metric} />
      <div>
        <span className="mb-2 block text-xs font-semibold text-slate-600">Indicateur suivi</span>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {ORDER.map((m) => {
            const Icon = ICONS[m];
            const active = metric === m;
            return (
              <button
                key={m}
                type="button"
                onClick={() => pick(m)}
                className={cn(
                  "flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm font-semibold transition",
                  active ? "border-brand-500 bg-brand-50 text-brand-700 ring-4 ring-brand-50" : "border-line bg-white text-slate-600 hover:border-slate-300 hover:bg-canvas",
                )}
              >
                <Icon className={cn("size-4 shrink-0", active ? "text-brand-500" : "text-slate-400")} />
                <span className="min-w-0 leading-tight">{METRIC_META[m].label.replace(" (1RM)", "")}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-muted">
          {metric === "custom"
            ? "Valeur mise à jour à la main depuis la fiche (ex. km courus, tractions, minutes de gainage)."
            : metric === "sessions"
              ? "Compte automatiquement les séances réalisées à partir d'aujourd'hui."
              : cur
                ? `Suivi automatique via les mesures — dernière valeur : ${nf.format(cur.value)} ${METRIC_META[metric].unit} (${new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(new Date(cur.on))}).`
                : "Suivi automatique via les mesures — aucune mesure encore enregistrée pour cet indicateur."}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
        <Field label="Intitulé de l'objectif">
          <Input name="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={placeholder(metric)} required />
        </Field>
        <Field label="Unité">
          <Input name="unit" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="km" readOnly={metric !== "custom"} className={metric !== "custom" ? "bg-canvas text-muted" : undefined} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Field label="Valeur de départ">
          <Input name="start_value" inputMode="decimal" value={start} onChange={(e) => setStart(e.target.value)} placeholder="95" />
        </Field>
        <Field label="Valeur cible">
          <Input name="target_value" inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="82" required />
        </Field>
        <Field label="Échéance" className="col-span-2 sm:col-span-1">
          <Input name="due_date" type="date" />
        </Field>
      </div>
      {metric === "custom" && (
        <Field label="Valeur actuelle (optionnel)" hint="Laisse vide pour partir de la valeur de départ." className="sm:max-w-xs">
          <Input name="current_value" inputMode="decimal" placeholder="—" />
        </Field>
      )}

      {direction && (
        <p className={cn("flex items-center gap-2 rounded-xl px-4 py-3 text-sm", direction === "down" ? "bg-accent-50 text-accent-700" : "bg-brand-50 text-brand-700")}>
          {direction === "down" ? <TrendingDown className="size-4" /> : <TrendingUp className="size-4" />}
          Objectif {direction === "down" ? "à la baisse" : "à la hausse"} : {direction === "down" ? "−" : "+"}
          {nf.format(Math.abs(t - s))} {unit}
        </p>
      )}
    </div>
  );
}

function placeholder(m: GoalMetric) {
  switch (m) {
    case "weight_kg":
      return "Descendre à 82 kg";
    case "body_fat":
      return "Masse grasse sous 20 %";
    case "waist_cm":
      return "Tour de taille sous 90 cm";
    case "squat_kg":
      return "Squat à 120 kg";
    case "bench_kg":
      return "Développé couché à 100 kg";
    case "deadlift_kg":
      return "Soulevé de terre à 150 kg";
    case "sessions":
      return "12 séances ce mois-ci";
    default:
      return "Courir 5 km sans s'arrêter";
  }
}
