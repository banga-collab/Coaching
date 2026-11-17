import { requireStaff } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { BackLink } from "@/components/back-link";
import { ExerciseForm } from "@/components/exercises/exercise-form";
import { getExerciseLibrary } from "@/components/exercises/library-data";

export const metadata = { title: "Nouvel exercice" };

export default async function NewExercisePage() {
  await requireStaff();
  const lib = await getExerciseLibrary();
  const equipment = [...new Set(lib.map((e) => e.equipment).filter((e): e is string => !!e))].sort((a, b) => a.localeCompare(b, "fr"));
  return (
    <>
      <PageHeader
        back={<BackLink href="/exercices" label="Vidéothèque" />}
        title="Nouvel exercice"
        subtitle="Une vidéo courte et des consignes claires : tes adhérents la retrouveront dans leur programme et pendant leur séance."
      />
      <ExerciseForm equipmentSuggestions={equipment} />
    </>
  );
}
