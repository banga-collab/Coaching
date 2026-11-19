import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Client } from "@/lib/types";
import type { SportAssessment } from "@/lib/types-bilan";
import { age, fmtDate } from "@/lib/utils";
import { OBJECTIVES, normalizeAnswers } from "@/lib/bilan";
import { PageHeader } from "@/components/ui";
import { BackLink } from "@/components/back-link";
import { BilanForm } from "@/components/bilan/bilan-form";

export const metadata = { title: "Nouveau bilan sportif" };

export default async function NewBilanSportifPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireStaff();
  const supabase = await createClient();
  const [{ data: cData }, { data: prev }, { data: meas }] = await Promise.all([
    supabase.from("clients").select("*").eq("id", id).maybeSingle(),
    supabase.from("sport_assessments").select("*").eq("client_id", id).order("done_on", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("measurements").select("weight_kg, waist_cm, measured_on").eq("client_id", id).order("measured_on", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (!cData) notFound();
  const c = cData as Client;
  const last = prev as SportAssessment | null;

  // Pré-remplissage : le bilan précédent (sans les tests ni les observations, à refaire), sinon la fiche client
  const initial = normalizeAnswers(last?.answers);
  if (last) {
    Object.assign(initial, {
      resting_hr: null, systolic: null, diastolic: null, waist_cm: null, flexibility_cm: null, pushups: null, plank_s: null,
      ruffier_p0: null, ruffier_p1: null, ruffier_p2: null, coach_notes: null,
    });
  }
  initial.height_cm ??= c.height_cm;
  if (meas?.weight_kg) initial.weight_kg = Number(meas.weight_kg);
  if (!last && c.goal) {
    if (OBJECTIVES.includes(c.goal)) initial.objectives = [c.goal];
    else initial.objectives_note = c.goal;
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        back={<BackLink href={`/clients/${id}/bilan-sportif`} label={c.full_name} />}
        title={last ? "Nouveau bilan sportif" : "Bilan sportif d'entrée"}
        subtitle={last ? `${c.full_name} · pré-rempli avec le bilan du ${fmtDate(last.done_on)} (tests à refaire)` : `${c.full_name} · profil, mode de vie, santé, PAR-Q et tests`}
      />
      <BilanForm clientId={id} mode="coach" sex={c.sex} ageYears={age(c.birth_date)} initial={initial} cancelHref={`/clients/${id}/bilan-sportif`} />
    </div>
  );
}
