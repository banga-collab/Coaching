import { CheckCircle2, Layers, PlayCircle, Plus, Video } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth";
import type { Exercise, Program } from "@/lib/types";
import { normName, parseVideo } from "@/lib/video";
import { Kpi, LinkButton, PageHeader } from "@/components/ui";
import { ListToolbar } from "@/components/list-toolbar";
import { Fold } from "@/components/fold";
import { getExerciseLibrary } from "@/components/exercises/library-data";
import { ExerciseLibrary } from "@/components/exercises/exercise-library";

export const metadata = { title: "Vidéothèque" };

const OK: Record<string, string> = {
  ajout: "Exercice ajouté à la vidéothèque.",
  maj: "Exercice mis à jour.",
  suppr: "Exercice supprimé.",
};

const sortFr = (a: string, b: string) => a.localeCompare(b, "fr");

export default async function ExercisesPage({ searchParams }: { searchParams: Promise<{ ok?: string; q?: string; categorie?: string; muscle?: string }> }) {
  await requireStaff();
  const { ok, q = "", categorie = "", muscle = "" } = await searchParams;
  const supabase = await createClient();
  const [exercises, { data: pData }] = await Promise.all([getExerciseLibrary(), supabase.from("programs").select("*")]);
  const programs = (pData ?? []) as Program[];

  // "Utilisé dans N programmes" : correspondance par nom
  const programsByName = new Map<string, number>();
  for (const p of programs) {
    const names = new Set((p.days ?? []).flatMap((d) => (d.exercises ?? []).map((e) => normName(e.name))));
    for (const n of names) programsByName.set(n, (programsByName.get(n) ?? 0) + 1);
  }
  const usage: Record<string, number> = {};
  for (const e of exercises) usage[e.id] = programsByName.get(normName(e.name)) ?? 0;
  const withVideo = exercises.filter((e) => parseVideo(e.video_url)).length;
  const used = exercises.filter((e) => usage[e.id] > 0).length;
  const categoryNames = [...new Set(exercises.map((e) => e.category))].sort(sortFr);
  const muscleNames = [...new Set(exercises.flatMap((e) => e.muscles))].sort(sortFr);

  // Recherche (insensible à la casse et aux accents) puis filtres
  const needle = normName(q);
  const searched = needle ? exercises.filter((e) => normName([e.name, e.category, e.equipment, ...e.muscles].filter(Boolean).join(" ")).includes(needle)) : exercises;
  const count = (list: Exercise[], keys: (e: Exercise) => string[]) => {
    const m = new Map<string, number>();
    for (const e of list) for (const k of keys(e)) m.set(k, (m.get(k) ?? 0) + 1);
    return m;
  };
  const catCount = count(muscle ? searched.filter((e) => e.muscles.includes(muscle)) : searched, (e) => [e.category]);
  const muscleCount = count(categorie ? searched.filter((e) => e.category === categorie) : searched, (e) => e.muscles);
  const list = searched.filter((e) => (!categorie || e.category === categorie) && (!muscle || e.muscles.includes(muscle)));
  const filters = [
    { param: "categorie", label: "Catégorie", options: categoryNames.map((c) => ({ value: c, label: c, count: catCount.get(c) ?? 0 })) },
    ...(muscleNames.length ? [{ param: "muscle", label: "Muscle", options: muscleNames.map((m) => ({ value: m, label: m, count: muscleCount.get(m) ?? 0 })) }] : []),
  ];

  return (
    <>
      <PageHeader
        title="Vidéothèque"
        subtitle="Une courte vidéo par exercice, visible par tes adhérents dans leur programme."
        actions={
          <LinkButton href="/exercices/nouveau">
            <Plus className="size-4" /> Nouvel exercice
          </LinkButton>
        }
      />
      {ok && OK[ok] && (
        <p className="mb-5 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 animate-fade-up">
          <CheckCircle2 className="size-4" /> {OK[ok]}
        </p>
      )}
      <Fold id="exercices-kpis">
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <Kpi label="Exercices" value={exercises.length} icon={<PlayCircle className="size-5" />} />
          <Kpi label="Avec vidéo" value={withVideo} tone="accent" icon={<Video className="size-5" />} delta={exercises.length ? `${Math.round((withVideo / exercises.length) * 100)} % de la bibliothèque` : undefined} />
          <Kpi label="Catégories" value={categoryNames.length} icon={<Layers className="size-5" />} />
          <Kpi label="Utilisés en programme" value={used} tone="accent" icon={<CheckCircle2 className="size-5" />} delta={`${programs.length} programme(s)`} />
        </div>
      </Fold>
      <ListToolbar placeholder="Exercice, matériel, muscle…" filters={filters} exportKind="exercices" />
      <ExerciseLibrary exercises={list} usage={usage} filtered={!!(q || categorie || muscle)} />
    </>
  );
}
