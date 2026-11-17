"use client";

import { useState } from "react";
import { Check, Link2, Plus, Save, Video } from "lucide-react";
import type { Exercise } from "@/lib/types";
import { EXERCISE_CATEGORIES, EXERCISE_LEVELS, MUSCLE_GROUPS, parseVideo } from "@/lib/video";
import { cn } from "@/lib/utils";
import { Card, CardHeader, Field, Input, Select, Textarea } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { saveExerciseAction } from "@/actions/exercises";
import { ExerciseThumb } from "./exercise-thumb";
import { ExercisePlayer } from "./exercise-modal";

export function ExerciseForm({ exercise, equipmentSuggestions = [] }: { exercise?: Exercise | null; equipmentSuggestions?: string[] }) {
  const [name, setName] = useState(exercise?.name ?? "");
  const [category, setCategory] = useState(exercise?.category ?? "Musculation");
  const [muscles, setMuscles] = useState<string[]>(exercise?.muscles ?? []);
  const [custom, setCustom] = useState("");
  const [url, setUrl] = useState(exercise?.video_url ?? "");
  const video = parseVideo(url);
  const allMuscles = [...new Set([...MUSCLE_GROUPS, ...muscles])];
  const categories = [...new Set([...EXERCISE_CATEGORIES, category])];

  const toggle = (m: string) => setMuscles((cur) => (cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m]));
  const addCustom = () => {
    const v = custom.trim();
    if (v && !muscles.includes(v)) setMuscles((cur) => [...cur, v]);
    setCustom("");
  };

  return (
    <ActionForm action={saveExerciseAction}>
      {exercise && <input type="hidden" name="id" value={exercise.id} />}
      {muscles.map((m) => (
        <input key={m} type="hidden" name="muscles" value={m} />
      ))}
      <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
        <div className="space-y-5">
          <Card className="p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nom de l'exercice *" className="sm:col-span-2">
                <Input name="name" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. Squat goblet" />
              </Field>
              <Field label="Catégorie">
                <Select name="category" value={category} onChange={(e) => setCategory(e.target.value)}>
                  {categories.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Niveau">
                <Select name="level" defaultValue={exercise?.level ?? "Tous niveaux"}>
                  {EXERCISE_LEVELS.map((l) => (
                    <option key={l}>{l}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Matériel" className="sm:col-span-2">
                <Input name="equipment" list="equipment-list" defaultValue={exercise?.equipment ?? ""} placeholder="Ex. Haltères, Barre + banc, Aucun" maxLength={80} />
                <datalist id="equipment-list">
                  {equipmentSuggestions.map((e) => (
                    <option key={e} value={e} />
                  ))}
                </datalist>
              </Field>
            </div>
            <div className="mt-5">
              <span className="mb-2 block text-xs font-semibold text-slate-600">Muscles sollicités</span>
              <div className="flex flex-wrap gap-1.5">
                {allMuscles.map((m) => {
                  const on = muscles.includes(m);
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => toggle(m)}
                      aria-pressed={on}
                      className={cn(
                        "inline-flex h-9 items-center gap-1 rounded-full px-3 text-xs font-semibold ring-1 ring-inset transition",
                        on ? "bg-brand-500 text-white ring-brand-500" : "bg-white text-slate-600 ring-line hover:ring-slate-300",
                      )}
                    >
                      {on && <Check className="size-3.5" />} {m}
                    </button>
                  );
                })}
                <span className="inline-flex h-9 items-center gap-1 rounded-full bg-white pl-3 pr-1 ring-1 ring-inset ring-line">
                  <input
                    value={custom}
                    onChange={(e) => setCustom(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addCustom();
                      }
                    }}
                    placeholder="Autre…"
                    className="w-20 bg-transparent text-xs outline-none placeholder:text-slate-400"
                    maxLength={40}
                  />
                  <button type="button" onClick={addCustom} aria-label="Ajouter le muscle" className="grid size-7 place-items-center rounded-full text-brand-600 hover:bg-brand-50">
                    <Plus className="size-3.5" />
                  </button>
                </span>
              </div>
            </div>
          </Card>
          <Card className="p-5">
            <div className="grid gap-4">
              <Field label="Exécution" hint="Les étapes clés du mouvement, en quelques phrases.">
                <Textarea name="instructions" defaultValue={exercise?.instructions ?? ""} rows={4} maxLength={3000} placeholder="Pieds largeur d'épaules, descends en poussant les hanches en arrière…" />
              </Field>
              <Field label="Conseils du coach" hint="Points d'attention, erreurs fréquentes, variantes.">
                <Textarea name="tips" defaultValue={exercise?.tips ?? ""} rows={3} maxLength={2000} placeholder="Genoux dans l'axe des pieds, regard droit devant…" />
              </Field>
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          <Card className="overflow-hidden lg:sticky lg:top-6">
            <CardHeader title="Vidéo" subtitle="YouTube, Shorts, Vimeo ou lien .mp4" icon={<Video className="size-4" />} />
            <div className="px-5 pb-4">
              <label className="relative block">
                <Link2 className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
                <Input name="video_url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://youtu.be/…" className="pl-10" inputMode="url" maxLength={500} />
              </label>
              {url && !video && <p className="mt-2 text-xs font-medium text-red-600">Lien non reconnu — colle l&apos;URL d&apos;une vidéo YouTube, Vimeo ou d&apos;un fichier .mp4.</p>}
              {video && <p className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-emerald-600"><Check className="size-3.5" /> Vidéo {video.kind === "youtube" ? "YouTube" : video.kind === "vimeo" ? "Vimeo" : "MP4"} détectée</p>}
            </div>
            <ExercisePlayer
              url={url}
              title={name || "Aperçu"}
              fallback={<ExerciseThumb exercise={{ name: name || "Nouvel exercice", category, video_url: null }} showPlay={false} />}
            />
            {!video && <p className="px-5 py-3 text-xs text-muted">Sans vidéo, une vignette illustrée est générée automatiquement.</p>}
          </Card>
        </div>
      </div>
      <div className="sticky bottom-20 z-10 mt-5 flex justify-end gap-2 lg:bottom-4">
        <SubmitButton className="shadow-pop">
          <Save className="size-4" /> {exercise ? "Enregistrer" : "Ajouter à la vidéothèque"}
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
