import { CheckCircle2, Layers, PlayCircle, Plus, Video } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth";
import type { Program } from "@/lib/types";
import { normName, parseVideo } from "@/lib/video";
import { Kpi, LinkButton, PageHeader } from "@/components/ui";
import { getExerciseLibrary } from "@/components/exercises/library-data";
import { ExerciseLibrary } from "@/components/exercises/exercise-library";

export const metadata = { title: "Vidéothèque" };

const OK: Record<string, string> = {
  ajout: "Exercice ajouté à la vidéothèque.",
  maj: "Exercice mis à jour.",
  suppr: "Exercice supprimé.",
};

export default async function ExercisesPage({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  await requireStaff();
  const { ok } = await searchParams;
  const supabase = await createClient();
  const [exercises, { data: pData }] = await Promise.all([getExerciseLibrary(), supabase.from("programs").select("*")]);
  const programs = (pData ?? []) as Program[];

  // "Utilisé dans N programmes" : correspondance par nom
  const usage: Record<string, number> = {};
  const namesByProgram = programs.map((p) => new Set((p.days ?? []).flatMap((d) => (d.exercises ?? []).map((e) => normName(e.name)))));
  for (const e of exercises) {
    const n = normName(e.name);
    usage[e.id] = namesByProgram.filter((s) => s.has(n)).length;
  }
  const withVideo = exercises.filter((e) => parseVideo(e.video_url)).length;
  const used = exercises.filter((e) => usage[e.id] > 0).length;
  const categories = new Set(exercises.map((e) => e.category)).size;

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
      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Kpi label="Exercices" value={exercises.length} icon={<PlayCircle className="size-5" />} />
        <Kpi label="Avec vidéo" value={withVideo} tone="accent" icon={<Video className="size-5" />} delta={exercises.length ? `${Math.round((withVideo / exercises.length) * 100)} % de la bibliothèque` : undefined} />
        <Kpi label="Catégories" value={categories} icon={<Layers className="size-5" />} />
        <Kpi label="Utilisés en programme" value={used} tone="accent" icon={<CheckCircle2 className="size-5" />} delta={`${programs.length} programme(s)`} />
      </div>
      <ExerciseLibrary exercises={exercises} usage={usage} />
    </>
  );
}
