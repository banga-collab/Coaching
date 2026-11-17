import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Challenge } from "@/lib/types";
import { PageHeader } from "@/components/ui";
import { BackLink } from "@/components/back-link";
import { ChallengeForm } from "@/components/challenges/challenge-form";

export const metadata = { title: "Modifier le défi" };

export default async function EditChallengePage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }] = await Promise.all([params, requireStaff()]);
  const supabase = await createClient();
  const { data } = await supabase.from("challenges").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const ch = data as Challenge;
  return (
    <>
      <PageHeader title="Modifier le défi" subtitle={ch.title} back={<BackLink href={`/defis/${id}`} label="Retour au défi" />} />
      <ChallengeForm initial={ch} defaults={{ start: ch.start_date, end: ch.end_date }} />
    </>
  );
}
