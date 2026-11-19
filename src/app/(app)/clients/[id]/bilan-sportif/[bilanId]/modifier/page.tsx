import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Client } from "@/lib/types";
import type { SportAssessment } from "@/lib/types-bilan";
import { age, fmtDate } from "@/lib/utils";
import { normalizeAnswers } from "@/lib/bilan";
import { PageHeader } from "@/components/ui";
import { BackLink } from "@/components/back-link";
import { BilanForm } from "@/components/bilan/bilan-form";

export const metadata = { title: "Modifier le bilan sportif" };

export default async function EditBilanSportifPage({ params }: { params: Promise<{ id: string; bilanId: string }> }) {
  const { id, bilanId } = await params;
  await requireStaff();
  const supabase = await createClient();
  const [{ data: cData }, { data: bData }] = await Promise.all([
    supabase.from("clients").select("*").eq("id", id).maybeSingle(),
    supabase.from("sport_assessments").select("*").eq("id", bilanId).eq("client_id", id).maybeSingle(),
  ]);
  if (!cData || !bData) notFound();
  const c = cData as Client;
  const b = bData as SportAssessment;
  const back = `/clients/${id}/bilan-sportif?b=${b.id}`;

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        back={<BackLink href={back} label={c.full_name} />}
        title="Modifier le bilan sportif"
        subtitle={`${c.full_name} · bilan du ${fmtDate(b.done_on)}${b.status === "a_valider" ? " · rempli par l'adhérent, sera validé à l'enregistrement" : ""}`}
      />
      <BilanForm clientId={id} mode="coach" sex={c.sex} ageYears={age(c.birth_date)} initial={normalizeAnswers(b.answers)} bilanId={b.id} doneOn={b.done_on} cancelHref={back} />
    </div>
  );
}
