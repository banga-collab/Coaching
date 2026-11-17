import { notFound } from "next/navigation";
import { Trash2 } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Exercise } from "@/lib/types";
import { PageHeader } from "@/components/ui";
import { BackLink } from "@/components/back-link";
import { ConfirmButton } from "@/components/confirm-button";
import { ExerciseForm } from "@/components/exercises/exercise-form";
import { getExerciseLibrary } from "@/components/exercises/library-data";
import { deleteExerciseAction } from "@/actions/exercises";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("exercises").select("name").eq("id", id).maybeSingle();
  return { title: data ? `Modifier ${(data as Pick<Exercise, "name">).name}` : "Exercice" };
}

export default async function EditExercisePage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  const supabase = await createClient();
  const [{ data }, lib] = await Promise.all([supabase.from("exercises").select("*").eq("id", id).maybeSingle(), getExerciseLibrary()]);
  if (!data) notFound();
  const exercise = data as Exercise;
  const equipment = [...new Set(lib.map((e) => e.equipment).filter((e): e is string => !!e))].sort((a, b) => a.localeCompare(b, "fr"));
  return (
    <>
      <PageHeader
        back={<BackLink href="/exercices" label="Vidéothèque" />}
        title={exercise.name}
        subtitle="Modifier la fiche de l'exercice"
        actions={
          <form action={deleteExerciseAction}>
            <input type="hidden" name="id" value={exercise.id} />
            <ConfirmButton message={`Supprimer « ${exercise.name} » de la vidéothèque ? Cette action est définitive.`}>
              <Trash2 className="size-4" /> Supprimer
            </ConfirmButton>
          </form>
        }
      />
      <ExerciseForm exercise={{ ...exercise, muscles: Array.isArray(exercise.muscles) ? exercise.muscles : [] }} equipmentSuggestions={equipment} />
    </>
  );
}
