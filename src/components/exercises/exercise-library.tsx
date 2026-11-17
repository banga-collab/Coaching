"use client";

import { useCallback, useMemo, useState } from "react";
import { Dumbbell, Layers, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import type { Exercise } from "@/lib/types";
import { normName } from "@/lib/video";
import { cn } from "@/lib/utils";
import { Badge, Card, Empty, LinkButton } from "@/components/ui";
import { ConfirmButton } from "@/components/confirm-button";
import { deleteExerciseAction } from "@/actions/exercises";
import { ExerciseThumb } from "./exercise-thumb";
import { ExerciseModal, levelTone } from "./exercise-modal";

export function ExerciseLibrary({ exercises, usage }: { exercises: Exercise[]; usage: Record<string, number> }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [muscle, setMuscle] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const close = useCallback(() => setOpenId(null), []);

  const categories = useMemo(() => [...new Set(exercises.map((e) => e.category))].sort((a, b) => a.localeCompare(b, "fr")), [exercises]);
  const muscles = useMemo(() => [...new Set(exercises.flatMap((e) => e.muscles))].sort((a, b) => a.localeCompare(b, "fr")), [exercises]);

  const needle = normName(q);
  const list = exercises.filter(
    (e) =>
      (!cat || e.category === cat) &&
      (!muscle || e.muscles.includes(muscle)) &&
      (!needle || normName([e.name, e.equipment, ...e.muscles].join(" ")).includes(needle)),
  );
  const open = exercises.find((e) => e.id === openId) ?? null;
  const filtered = !!(q || cat || muscle);

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
          <div className="flex w-max gap-1 rounded-xl bg-white p-1 ring-1 ring-line">
            {["", ...categories].map((c) => (
              <button
                key={c || "all"}
                type="button"
                onClick={() => setCat(c)}
                className={cn(
                  "whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold transition",
                  cat === c ? "bg-brand-500 text-white shadow-sm" : "text-muted hover:text-ink",
                )}
              >
                {c || "Toutes"}
              </button>
            ))}
          </div>
        </div>
        <label className="relative block lg:w-80">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher un exercice, un matériel…"
            className="h-11 w-full rounded-xl border border-line bg-white pl-10 pr-10 text-sm text-ink placeholder:text-slate-400 transition focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-50"
          />
          {q && (
            <button type="button" onClick={() => setQ("")} aria-label="Effacer" className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-lg text-muted hover:bg-canvas hover:text-ink">
              <X className="size-4" />
            </button>
          )}
        </label>
      </div>

      {muscles.length > 0 && (
        <div className="-mx-4 mb-5 overflow-x-auto px-4 lg:mx-0 lg:px-0">
          <div className="flex w-max gap-1.5 lg:w-auto lg:flex-wrap">
            {muscles.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMuscle(muscle === m ? "" : m)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset transition",
                  muscle === m ? "bg-accent-500 text-white ring-accent-500" : "bg-white text-slate-600 ring-line hover:ring-slate-300",
                )}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      )}

      {filtered && (
        <p className="mb-3 flex items-center gap-2 text-sm text-muted">
          {list.length} résultat{list.length > 1 ? "s" : ""}
          <button type="button" onClick={() => { setQ(""); setCat(""); setMuscle(""); }} className="font-semibold text-brand-600 hover:underline">
            Réinitialiser
          </button>
        </p>
      )}

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
              className="group animate-fade-up overflow-hidden rounded-2xl border border-line bg-white text-left shadow-card transition duration-200 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-pop focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100"
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
              <form action={deleteExerciseAction} className="ml-auto">
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
