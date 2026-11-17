import { Save, Trophy } from "lucide-react";
import type { Challenge } from "@/lib/types";
import { COVERS, METRICS } from "@/lib/challenges";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { Card, Field, Input, Select, Textarea } from "@/components/ui";
import { saveChallengeAction } from "@/actions/challenges";

export function ChallengeForm({ initial, defaults }: { initial?: Challenge; defaults: { start: string; end: string } }) {
  const cover = initial?.cover ?? "🔥";
  return (
    <ActionForm action={saveChallengeAction}>
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="p-5 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Titre du défi" className="sm:col-span-2">
              <Input name="title" required defaultValue={initial?.title} placeholder="Ex. Défi 12 présences de novembre" />
            </Field>
            <Field label="Description" className="sm:col-span-2" hint="Les règles, en une ou deux phrases motivantes.">
              <Textarea name="description" defaultValue={initial?.description ?? ""} placeholder="Viens 12 fois à la salle ce mois-ci et décroche ta récompense !" />
            </Field>
            <Field label="Métrique" hint="Présences et squat sont calculés automatiquement.">
              <Select name="metric" defaultValue={initial?.metric ?? "presences"}>
                {(Object.keys(METRICS) as Challenge["metric"][]).map((m) => (
                  <option key={m} value={m}>
                    {METRICS[m].label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Unité" hint="Laisser vide pour l'unité par défaut.">
              <Input name="unit" defaultValue={initial?.unit ?? ""} placeholder="passages, kg, pas…" />
            </Field>
            <Field label="Objectif (facultatif)" hint="Valeur à atteindre pour compléter le défi.">
              <Input name="goal_value" inputMode="decimal" defaultValue={initial?.goal_value ?? ""} placeholder="12" />
            </Field>
            <Field label="Récompense">
              <Input name="reward" defaultValue={initial?.reward ?? ""} placeholder="1 séance de coaching offerte" />
            </Field>
            <Field label="Début">
              <Input type="date" name="start_date" required defaultValue={initial?.start_date ?? defaults.start} />
            </Field>
            <Field label="Fin">
              <Input type="date" name="end_date" required defaultValue={initial?.end_date ?? defaults.end} />
            </Field>
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="p-5">
            <p className="mb-3 text-xs font-semibold text-slate-600">Emoji de couverture</p>
            <div className="grid grid-cols-6 gap-2">
              {COVERS.map((e) => (
                <label key={e} className="cursor-pointer">
                  <input type="radio" name="cover" value={e} defaultChecked={e === cover} className="peer sr-only" />
                  <span className="grid aspect-square place-items-center rounded-xl border border-line bg-white text-2xl transition hover:bg-canvas peer-checked:border-accent-500 peer-checked:bg-accent-50 peer-checked:ring-4 peer-checked:ring-accent-100">
                    {e}
                  </span>
                </label>
              ))}
            </div>
            {!COVERS.includes(cover) && <input type="hidden" name="cover" value={cover} />}
          </Card>
          <div className="sticky bottom-20 z-10 lg:bottom-4">
            <SubmitButton className="h-12 w-full shadow-pop">
              {initial ? <Save className="size-4" /> : <Trophy className="size-4" />}
              {initial ? "Enregistrer le défi" : "Lancer le défi"}
            </SubmitButton>
          </div>
        </div>
      </div>
    </ActionForm>
  );
}
