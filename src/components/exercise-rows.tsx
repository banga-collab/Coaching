"use client";

import { useState } from "react";
import { GripVertical, Plus, X } from "lucide-react";

type Ex = { key: number; name: string; sets: string; reps: string; load: string; rpe: string };
const cell = "h-10 w-full rounded-lg border border-line bg-white px-3 text-sm focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-50";

export const EXERCISES = [
  "Squat barre", "Front squat", "Soulevé de terre", "Soulevé de terre roumain", "Fentes haltères", "Presse à cuisses", "Leg curl", "Leg extension", "Hip thrust",
  "Développé couché", "Développé incliné haltères", "Développé militaire", "Tractions", "Rowing barre", "Tirage vertical", "Dips", "Pompes",
  "Curl biceps", "Extension triceps", "Élévations latérales", "Gainage planche", "Kettlebell swing", "Burpees", "Corde à sauter", "Rameur", "Vélo",
];

export function ExerciseRows({ initial }: { initial?: Omit<Ex, "key">[] }) {
  const [rows, setRows] = useState<Ex[]>(
    (initial?.length ? initial : [{ name: "", sets: "", reps: "", load: "", rpe: "" }]).map((r, i) => ({ ...r, key: i })),
  );
  const add = () => setRows((r) => [...r, { key: Date.now(), name: "", sets: "", reps: "", load: "", rpe: "" }]);
  const remove = (k: number) => setRows((r) => (r.length > 1 ? r.filter((x) => x.key !== k) : r));

  return (
    <div>
      <datalist id="exercises">
        {EXERCISES.map((e) => (
          <option key={e} value={e} />
        ))}
      </datalist>
      <div className="hidden grid-cols-[20px_2.4fr_1fr_1fr_1fr_1fr_36px] gap-2 px-1 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 sm:grid">
        <span />
        <span>Exercice</span>
        <span>Séries</span>
        <span>Reps</span>
        <span>Charge kg</span>
        <span>RPE</span>
        <span />
      </div>
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={r.key} className="grid grid-cols-4 gap-2 rounded-xl bg-canvas/70 p-2 sm:grid-cols-[20px_2.4fr_1fr_1fr_1fr_1fr_36px] sm:bg-transparent sm:p-0">
            <span className="hidden items-center justify-center text-slate-300 sm:flex">
              <GripVertical className="size-4" />
            </span>
            <input name="ex_name" list="exercises" defaultValue={r.name} placeholder={`Exercice ${i + 1}`} className={`${cell} col-span-3 sm:col-span-1`} />
            <button type="button" onClick={() => remove(r.key)} className="grid size-10 place-items-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 sm:order-last" aria-label="Retirer">
              <X className="size-4" />
            </button>
            <input name="ex_sets" inputMode="numeric" defaultValue={r.sets} placeholder="Séries" className={cell} />
            <input name="ex_reps" defaultValue={r.reps} placeholder="Reps" className={cell} />
            <input name="ex_load" inputMode="decimal" defaultValue={r.load} placeholder="kg" className={cell} />
            <input name="ex_rpe" inputMode="numeric" defaultValue={r.rpe} placeholder="RPE" className={cell} />
          </div>
        ))}
      </div>
      <button type="button" onClick={add} className="mt-3 inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-semibold text-brand-500 hover:bg-brand-50">
        <Plus className="size-4" /> Ajouter un exercice
      </button>
    </div>
  );
}
