import { redirect } from "next/navigation";
import { Hourglass } from "lucide-react";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Client, ClientProgram, Program, WorkoutLog } from "@/lib/types";
import { normName } from "@/lib/video";
import { Card, Empty, PageHeader } from "@/components/ui";
import { getExerciseLibrary } from "@/components/exercises/library-data";
import { WorkoutApp, type LastInfo } from "@/components/workout/workout-app";
import { WorkoutHistory } from "@/components/workout/workout-history";
import { maxLoad } from "@/components/workout/utils";

export const metadata = { title: "Ma séance" };

export default async function WorkoutPage() {
  const me = await getProfile();
  if (me.role !== "client") redirect("/exercices");
  const supabase = await createClient();
  const { data: cData } = await supabase.from("clients").select("*").eq("user_id", me.id).maybeSingle();
  if (!cData) {
    return (
      <>
        <PageHeader title="Ma séance" />
        <Card>
          <Empty
            icon={<Hourglass className="size-6" />}
            title="Ton dossier n'est pas encore relié"
            text={`Demande à ton coach d'ajouter ton e-mail (${me.email}) à ta fiche pour suivre tes séances ici.`}
          />
        </Card>
      </>
    );
  }
  const client = cData as Client;

  const [{ data: cpData }, { data: lData }, library] = await Promise.all([
    supabase.from("client_programs").select("*").eq("client_id", client.id).eq("status", "actif").order("start_date", { ascending: false }),
    supabase.from("workout_logs").select("*").eq("client_id", client.id).order("started_at", { ascending: false }).limit(200),
    getExerciseLibrary(),
  ]);
  const links = (cpData ?? []) as ClientProgram[];
  let program: Program | null = null;
  if (links.length) {
    const { data: pData } = await supabase.from("programs").select("*").in("id", links.map((l) => l.program_id));
    const progs = (pData ?? []) as Program[];
    program = links.map((l) => progs.find((p) => p.id === l.program_id)).find((p): p is Program => !!p && (p.days ?? []).length > 0) ?? null;
  }
  const logs = ((lData ?? []) as WorkoutLog[]).map((l) => ({ ...l, entries: Array.isArray(l.entries) ? l.entries : [] }));

  // Jour suggéré : rotation selon le nombre de séances faites sur ce programme
  const days = program?.days ?? [];
  const doneOnProgram = program ? logs.filter((l) => l.program_id === program.id).length : 0;
  const suggested = days.length ? doneOnProgram % days.length : 0;

  // Dernière performance et meilleure charge par exercice
  const last: Record<string, LastInfo> = {};
  const best: Record<string, number> = {};
  for (const l of logs) {
    for (const e of l.entries) {
      const k = normName(e.exercise);
      const done = (e.sets ?? []).filter((s) => s.done);
      if (!last[k] && done.length) {
        last[k] = { date: l.started_at, sets: done.map((s) => ({ reps: s.reps === null ? "" : String(s.reps), load: s.load === null ? "" : String(s.load) })) };
      }
      const m = maxLoad(e);
      if (m > 0) best[k] = Math.max(best[k] ?? 0, m);
    }
  }

  return (
    <WorkoutApp
      clientId={client.id}
      firstName={client.full_name.split(" ")[0] ?? ""}
      program={program ? { id: program.id, name: program.name, days } : null}
      suggested={suggested}
      library={library}
      last={last}
      best={best}
    >
      <WorkoutHistory logs={logs} />
    </WorkoutApp>
  );
}
