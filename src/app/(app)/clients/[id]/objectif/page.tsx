import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Measurement } from "@/lib/types";
import { Card, LinkButton, PageHeader } from "@/components/ui";
import { BackLink } from "@/components/back-link";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { GoalFields, type CurrentValues } from "@/components/phase1/goal-fields";
import { MEASURE_METRICS, latestMeasure } from "@/components/phase1/shared";
import { createGoalAction } from "@/actions/phase1";

export const metadata = { title: "Nouvel objectif" };

export default async function NewGoalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireStaff();
  const supabase = await createClient();
  const [{ data: c }, { data: mData }] = await Promise.all([
    supabase.from("clients").select("id, full_name").eq("id", id).single(),
    supabase.from("measurements").select("*").eq("client_id", id).order("measured_on"),
  ]);
  if (!c) notFound();
  const meas = (mData ?? []) as Measurement[];
  const current: CurrentValues = {};
  for (const k of MEASURE_METRICS) {
    const l = latestMeasure(meas, k);
    if (l) current[k] = l;
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        back={<BackLink href={`/clients/${id}?tab=objectifs`} label={c.full_name} />}
        title="Nouvel objectif"
        subtitle="Un objectif clair, chiffré et daté — la progression se calcule toute seule."
      />
      <ActionForm action={createGoalAction}>
        <input type="hidden" name="client_id" value={id} />
        <Card className="p-5 sm:p-7">
          <GoalFields current={current} />
        </Card>
        <div className="sticky bottom-20 z-10 mt-5 flex justify-end gap-2 lg:bottom-4">
          <LinkButton href={`/clients/${id}?tab=objectifs`} variant="secondary">
            Annuler
          </LinkButton>
          <SubmitButton>Créer l&apos;objectif</SubmitButton>
        </div>
      </ActionForm>
    </div>
  );
}
