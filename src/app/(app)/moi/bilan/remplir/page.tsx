import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Client } from "@/lib/types";
import type { SportAssessment } from "@/lib/types-bilan";
import { age } from "@/lib/utils";
import { normalizeAnswers } from "@/lib/bilan";
import { PageHeader } from "@/components/ui";
import { BackLink } from "@/components/back-link";
import { BilanForm } from "@/components/bilan/bilan-form";

export const metadata = { title: "Remplir mon bilan sportif" };

export default async function FillMyBilanPage() {
  const me = await getProfile();
  const supabase = await createClient();
  const { data: cData } = await supabase.from("clients").select("*").eq("user_id", me.id).maybeSingle();
  if (!cData) redirect("/moi");
  const c = cData as Client;
  const { data } = await supabase.from("sport_assessments").select("*").eq("client_id", c.id).order("done_on", { ascending: false }).limit(1).maybeSingle();
  const prev = data as SportAssessment | null;
  const initial = normalizeAnswers(prev?.answers);
  initial.height_cm ??= c.height_cm;

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader back={<BackLink href="/moi/bilan" label="Mon bilan sportif" />} title="Mon bilan sportif" subtitle="Réponds le plus précisément possible : tes réponses restent entre toi et l'équipe de coachs." />
      <BilanForm clientId={c.id} mode="client" sex={c.sex} ageYears={age(c.birth_date)} initial={initial} cancelHref="/moi/bilan" />
    </div>
  );
}
