import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Session, SessionExercise } from "@/lib/types";
import { PageHeader } from "@/components/ui";
import { BackLink } from "@/components/back-link";
import { SessionForm } from "../../session-form";

export const metadata = { title: "Modifier la séance" };

export default async function EditSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireStaff();
  const supabase = await createClient();
  const [{ data: s }, { data: ex }, { data: clients }] = await Promise.all([
    supabase.from("sessions").select("*").eq("id", id).single(),
    supabase.from("session_exercises").select("*").eq("session_id", id).order("position"),
    supabase.from("clients").select("id, full_name").order("full_name"),
  ]);
  if (!s) notFound();
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader back={<BackLink href={`/seances/${id}`} label="Séance" />} title="Modifier la séance" />
      <SessionForm clients={clients ?? []} session={s as Session} exercises={(ex ?? []) as SessionExercise[]} />
    </div>
  );
}
