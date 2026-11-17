import { notFound } from "next/navigation";
import { Dumbbell, Ruler, Scale } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Measurement } from "@/lib/types";
import { num } from "@/lib/utils";
import { Card, Field, Input, LinkButton, PageHeader, SectionTitle, Textarea } from "@/components/ui";
import { BackLink } from "@/components/back-link";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { addMeasurementAction } from "../../../actions";

export const metadata = { title: "Nouvelle mesure" };

export default async function MeasurePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireStaff();
  const supabase = await createClient();
  const [{ data: c }, { data: lastData }] = await Promise.all([
    supabase.from("clients").select("full_name").eq("id", id).single(),
    supabase.from("measurements").select("*").eq("client_id", id).order("measured_on", { ascending: false }).limit(1),
  ]);
  if (!c) notFound();
  const last = (lastData?.[0] ?? null) as Measurement | null;
  const prev = (k: keyof Measurement, unit: string) => (last && last[k] !== null ? `Précédent : ${num(last[k] as number, unit)}` : undefined);

  const F = ({ name, label, unit, ph }: { name: keyof Measurement; label: string; unit: string; ph: string }) => (
    <Field label={`${label} (${unit})`} hint={prev(name, unit)}>
      <Input name={name} inputMode="decimal" placeholder={ph} />
    </Field>
  );

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader back={<BackLink href={`/clients/${id}`} label={c.full_name} />} title="Nouvelle mesure" subtitle="Remplis seulement ce que tu as mesuré aujourd'hui." />
      <ActionForm action={addMeasurementAction}>
        <input type="hidden" name="client_id" value={id} />
        <Card className="p-5 sm:p-7">
          <Field label="Date" className="sm:max-w-xs">
            <Input name="measured_on" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
          </Field>
          <SectionTitle icon={<Scale className="size-4" />}>Composition corporelle</SectionTitle>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <F name="weight_kg" label="Poids" unit="kg" ph="72,5" />
            <F name="body_fat" label="Masse grasse" unit="%" ph="21" />
            <F name="muscle_kg" label="Masse musculaire" unit="kg" ph="32" />
          </div>
          <SectionTitle icon={<Ruler className="size-4" />}>Mensurations</SectionTitle>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <F name="waist_cm" label="Tour de taille" unit="cm" ph="84" />
            <F name="hips_cm" label="Hanches" unit="cm" ph="98" />
            <F name="chest_cm" label="Poitrine" unit="cm" ph="100" />
            <F name="arm_cm" label="Bras" unit="cm" ph="33" />
            <F name="thigh_cm" label="Cuisse" unit="cm" ph="56" />
          </div>
          <SectionTitle icon={<Dumbbell className="size-4" />}>Performances (1RM)</SectionTitle>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <F name="squat_kg" label="Squat" unit="kg" ph="100" />
            <F name="bench_kg" label="Développé couché" unit="kg" ph="70" />
            <F name="deadlift_kg" label="Soulevé de terre" unit="kg" ph="120" />
          </div>
          <SectionTitle>Notes</SectionTitle>
          <Textarea name="notes" placeholder="Conditions de la mesure, matériel utilisé…" />
        </Card>
        <div className="sticky bottom-20 z-10 mt-5 flex justify-end gap-2 lg:bottom-4">
          <LinkButton href={`/clients/${id}`} variant="secondary">
            Annuler
          </LinkButton>
          <SubmitButton>Enregistrer la mesure</SubmitButton>
        </div>
      </ActionForm>
    </div>
  );
}
