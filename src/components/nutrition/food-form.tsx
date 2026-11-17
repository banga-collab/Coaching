"use client";

import { useState } from "react";
import { Save } from "lucide-react";
import type { Food } from "@/lib/types";
import { saveFoodAction } from "@/actions/nutrition";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { Field, Input, LinkButton, Select } from "@/components/ui";
import { FOOD_CATEGORIES } from "./shared";

export function FoodForm({ food }: { food?: Food | null }) {
  const [m, setM] = useState({
    kcal: food ? String(food.kcal) : "",
    protein: food ? String(food.protein) : "",
    carbs: food ? String(food.carbs) : "",
    fat: food ? String(food.fat) : "",
  });
  const n = (s: string) => Number(s.replace(",", ".")) || 0;
  const fromMacros = Math.round(n(m.protein) * 4 + n(m.carbs) * 4 + n(m.fat) * 9);
  const gap = m.kcal && fromMacros ? Math.abs(fromMacros - n(m.kcal)) / Math.max(1, n(m.kcal)) : 0;
  const bind = (k: keyof typeof m) => ({
    name: k,
    value: m[k],
    inputMode: "decimal" as const,
    onChange: (e: { target: { value: string } }) => setM((s) => ({ ...s, [k]: e.target.value })),
  });

  return (
    <ActionForm action={saveFoodAction} className="space-y-4">
      {food && <input type="hidden" name="id" value={food.id} />}
      <Field label="Nom">
        <Input name="name" required defaultValue={food?.name ?? ""} placeholder="Ex. Tajine de kefta aux œufs" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Catégorie">
          <Select name="category" defaultValue={food?.category ?? "Plats marocains"}>
            {FOOD_CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </Field>
        <Field label="Poids portion (g)">
          <Input name="grams" type="number" min={1} step="any" defaultValue={food?.grams ?? 100} />
        </Field>
      </div>
      <Field label="Portion" hint="Telle que l'adhérent la visualise">
        <Input name="portion" defaultValue={food?.portion ?? ""} placeholder="1 assiette (350 g)" />
      </Field>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label="kcal">
          <Input {...bind("kcal")} required placeholder="420" />
        </Field>
        <Field label="Protéines (g)">
          <Input {...bind("protein")} placeholder="38" />
        </Field>
        <Field label="Glucides (g)">
          <Input {...bind("carbs")} placeholder="22" />
        </Field>
        <Field label="Lipides (g)">
          <Input {...bind("fat")} placeholder="19" />
        </Field>
      </div>
      {fromMacros > 0 && (
        <p className={gap > 0.15 ? "rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800" : "text-xs text-muted"}>
          Les macros représentent ≈ {fromMacros} kcal{gap > 0.15 ? " : vérifie les valeurs saisies." : "."}
        </p>
      )}
      <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-line px-3.5 py-2.5 text-sm transition hover:bg-canvas">
        <input type="checkbox" name="moroccan" defaultChecked={food?.moroccan ?? true} className="size-4 accent-[#e8782a]" />
        <span>
          <span className="font-semibold text-ink">Plat / produit marocain</span>
          <span className="block text-xs text-muted">Affiche le badge « Plats marocains » dans la recherche</span>
        </span>
      </label>
      <div className="flex justify-end gap-2 pt-1">
        {food && (
          <LinkButton href="/nutrition?vue=aliments" variant="secondary">
            Annuler
          </LinkButton>
        )}
        <SubmitButton>
          <Save className="size-4" /> {food ? "Enregistrer" : "Ajouter l'aliment"}
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
