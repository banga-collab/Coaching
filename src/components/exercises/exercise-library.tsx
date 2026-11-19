"use client";

import { useCallback, useState } from "react";
import { Dumbbell, Layers, Pencil, Plus, Trash2 } from "lucide-react";
import type { Exercise } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Badge, Card, Empty, LinkButton } from "@/components/ui";
import { ConfirmButton } from "@/components/confirm-button";
import { deleteExerciseAction } from "@/actions/exercises";
import { ExerciseThumb } from "./exercise-thumb";
import { ExerciseModal, levelTone } from "./exercise-modal";

/** Grille de la vidéothèque. La recherche et les filtres sont faits côté serveur (URL : q, categorie, muscle). */
export function ExerciseLibrary({ exercises, usage, filtered = false }: { exercises: Exercise[]; usage: Record<string, number>; filtered?: boolean }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const close = useCallback(() => setOpenId(null), []);

  const list = exercises;
  const open = exercises.find((e) => e.id === openId) ?? null;

  return (
    <>
      {list.length === 0 ? (
        <Card>
          <Empty
            icon={<Dumbbell className="size-6" />}
            title={filtered ? "Aucun exercice trouvé" : "La vidéothèque est vide"}
            text={filtered ? "Essaie un autre mot-clé ou retire un filtre." : "Ajoute tes exercices avec une courte vidéo : ils apparaîtront dans les programmes de tes adhérents."}
            action={
              !filtered && (
                <LinkButton href="/exercices/nouveau">
                  <Plus className="size-4" /> Ajouter un exercice
                </LinkButton>
              )
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((e, i) => (
            <button
              key={e.id}
              type="button"
              onClick={() => setOpenId(e.id)}
              className="group animate-fade-up overflow-hidden rounded-2xl border border-line bg-white text-start shadow-card transition duration-200 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-pop focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100"
              style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}
            >
              <ExerciseThumb exercise={e} />
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-display text-[15px] font-bold leading-snug text-ink group-hover:text-brand-600">{e.name}</p>
                  {e.level && <Badge tone={levelTone(e.level)}>{e.level}</Badge>}
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {e.muscles.slice(0, 4).map((m) => (
                    <span key={m} className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-600">
                      {m}
                    </span>
                  ))}
                  {e.muscles.length > 4 && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">+{e.muscles.length - 4}</span>}
                </div>
                <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3 text-xs text-muted">
                  <span className="inline-flex min-w-0 items-center gap-1.5 truncate">
                    <Dumbbell className="size-3.5 shrink-0" /> {e.equipment || "Sans matériel"}
                  </span>
                  <span className={cn("inline-flex shrink-0 items-center gap-1 font-semibold", usage[e.id] ? "text-accent-600" : "text-slate-400")}>
                    <Layers className="size-3.5" />
                    {usage[e.id] ? `Utilisé dans ${usage[e.id]} programme${usage[e.id] > 1 ? "s" : ""}` : "Non utilisé"}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      <ExerciseModal
        exercise={open}
        onClose={close}
        extra={
          open && (
            <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-muted">
              <Layers className="size-3.5" />
              {usage[open.id] ? `Utilisé dans ${usage[open.id]} programme${usage[open.id] > 1 ? "s" : ""}` : "Pas encore utilisé dans un programme"}
            </p>
          )
        }
        footer={
          open && (
            <>
              <LinkButton href={`/exercices/${open.id}`} variant="secondary">
                <Pencil className="size-4" /> Modifier
              </LinkButton>
              <form action={deleteExerciseAction} className="ms-auto">
                <input type="hidden" name="id" value={open.id} />
                <ConfirmButton message={`Supprimer « ${open.name} » de la vidéothèque ? Cette action est définitive.`}>
                  <Trash2 className="size-4" /> Supprimer
                </ConfirmButton>
              </form>
            </>
          )
        }
      />
    </>
  );
}
