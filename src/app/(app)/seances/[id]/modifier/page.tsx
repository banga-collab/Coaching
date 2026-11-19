import { notFound } from "next/navigation";
import { isManager, requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Session, SessionExercise } from "@/lib/types";
import { loadStaff } from "@/lib/planning";
import { sessionTypeOptions } from "@/lib/session-extras";
import { PageHeader } from "@/components/ui";
import { BackLink } from "@/components/back-link";
import { SessionForm } from "../../session-form";

export const metadata = { title: "Modifier la séance" };

export default async function EditSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireStaff();
  const manager = isManager(me.role);
  const supabase = await createClient();
  const [{ data: s }, { data: ex }, { data: clients }, staff, types] = await Promise.all([
    supabase.from("sessions").select("*").eq("id", id).maybeSingle(),
    supabase.from("session_exercises").select("*").eq("session_id", id).order("position"),
    supabase.from("clients").select("id, full_name").order("full_name"),
    manager ? loadStaff(supabase) : Promise.resolve([]),
    sessionTypeOptions(supabase),
  ]);
  if (!s) notFound();
  const session = s as Session;
  if (!manager && session.coach_id !== me.id) notFound();
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader back={<BackLink href={`/seances/${id}`} label="Séance" />} title="Modifier la séance" />
      <SessionForm clients={clients ?? []} session={session} exercises={(ex ?? []) as SessionExercise[]} coaches={manager ? staff : undefined} types={types.names} prices={types.prices} selfId={me.id} />
    </div>
  );
}
