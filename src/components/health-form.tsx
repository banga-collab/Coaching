import { Activity, ClipboardCheck, HeartPulse, ShieldCheck, Stethoscope } from "lucide-react";
import { PAIN_ZONES } from "@/lib/utils";
import { ActionForm } from "./action-form";
import { Card, Field, Input, LinkButton, SectionTitle, Select, Textarea } from "./ui";
import { RangeField } from "./range-field";
import { SubmitButton } from "./submit-button";
import { addHealthCheckAction } from "@/app/(app)/actions";

const PARQ = [
  "Un médecin vous a-t-il déjà dit que vous aviez un problème cardiaque ?",
  "Ressentez-vous une douleur à la poitrine pendant l'effort ?",
  "Avez-vous déjà perdu connaissance ou eu des vertiges importants ?",
  "Avez-vous un problème osseux ou articulaire aggravé par l'activité ?",
  "Prenez-vous un traitement pour la tension ou le cœur ?",
];

export function HealthForm({ clientId, kind, mode, cancelHref }: { clientId: string; kind: "initial" | "mensuel" | "hebdo"; mode: "coach" | "client"; cancelHref: string }) {
  const isInitial = kind === "initial";
  return (
    <ActionForm action={addHealthCheckAction}>
      <input type="hidden" name="client_id" value={clientId} />
      <Card className="p-5 sm:p-7">
        {mode === "coach" && (
          <>
            <SectionTitle icon={<ClipboardCheck className="size-4" />}>Type de bilan</SectionTitle>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Type">
                <Select name="kind" defaultValue={kind}>
                  <option value="initial">Bilan initial complet</option>
                  <option value="mensuel">Bilan mensuel</option>
                  <option value="hebdo">Check-in hebdomadaire</option>
                </Select>
              </Field>
              <Field label="Date">
                <Input name="checked_on" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
              </Field>
            </div>

            <SectionTitle icon={<HeartPulse className="size-4" />}>Mesures</SectionTitle>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Field label="Poids (kg)">
                <Input name="weight_kg" inputMode="decimal" placeholder="72,5" />
              </Field>
              <Field label="Masse grasse (%)">
                <Input name="body_fat" inputMode="decimal" placeholder="21" />
              </Field>
              <Field label="Tour de taille (cm)">
                <Input name="waist_cm" inputMode="decimal" placeholder="84" />
              </Field>
              <Field label="Tension systolique">
                <Input name="systolic" inputMode="numeric" placeholder="120" />
              </Field>
              <Field label="Tension diastolique">
                <Input name="diastolic" inputMode="numeric" placeholder="80" />
              </Field>
              <Field label="FC au repos (bpm)">
                <Input name="resting_hr" inputMode="numeric" placeholder="65" />
              </Field>
            </div>
          </>
        )}

        <SectionTitle icon={<Activity className="size-4" />}>{mode === "client" ? "Comment te sens-tu cette semaine ?" : "Bien-être"}</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <RangeField name="sleep" label="Qualité du sommeil" />
          <RangeField name="energy" label="Niveau d'énergie" />
          <RangeField name="stress" label="Stress" defaultValue={4} invert />
          <RangeField name="motivation" label="Motivation" defaultValue={8} />
          <RangeField name="nutrition" label="Alimentation" defaultValue={6} />
          <RangeField name="recovery" label="Récupération" />
        </div>

        <SectionTitle icon={<Stethoscope className="size-4" />}>Douleurs</SectionTitle>
        <p className="mb-3 text-sm text-muted">Coche les zones où {mode === "client" ? "tu ressens" : "le client ressent"} une douleur ou une gêne.</p>
        <div className="flex flex-wrap gap-2">
          {PAIN_ZONES.map((z) => (
            <label key={z} className="cursor-pointer">
              <input type="checkbox" name="pain_zones" value={z} className="peer sr-only" />
              <span className="inline-flex items-center rounded-full border border-line bg-white px-3.5 py-2 text-sm font-medium text-slate-600 transition peer-checked:border-red-300 peer-checked:bg-red-50 peer-checked:text-red-700 peer-focus-visible:ring-4 peer-focus-visible:ring-brand-50 hover:border-slate-300">
                {z}
              </span>
            </label>
          ))}
        </div>

        {mode === "coach" && isInitial && (
          <>
            <SectionTitle icon={<Stethoscope className="size-4" />}>Antécédents</SectionTitle>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Pathologies / antécédents médicaux">
                <Textarea name="conditions" placeholder="Diabète, hypertension, asthme, chirurgie…" />
              </Field>
              <Field label="Médicaments en cours">
                <Textarea name="medications" placeholder="Nom et dosage" />
              </Field>
              <Field label="Blessures passées" className="sm:col-span-2">
                <Textarea name="injuries" placeholder="Entorse cheville 2023, tendinite épaule…" />
              </Field>
            </div>
            <div className="mt-5 rounded-xl border border-line bg-canvas/60 p-4">
              <p className="text-sm font-semibold">Questionnaire PAR-Q (aptitude à l&apos;activité physique)</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
                {PARQ.map((q) => (
                  <li key={q}>{q}</li>
                ))}
              </ul>
              <div className="mt-3 flex flex-wrap gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <input type="radio" name="parq" value="non" defaultChecked className="accent-brand-500" /> Non à toutes les questions
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" name="parq" value="oui" className="accent-accent-500" /> Au moins un « oui »
                </label>
              </div>
            </div>
          </>
        )}

        <SectionTitle>{mode === "client" ? "Un commentaire ?" : "Remarques du coach"}</SectionTitle>
        <Textarea name="notes" placeholder={mode === "client" ? "Fatigue, motivation, alimentation… dis-le à ton coach." : "Observations, ajustements du programme…"} />

        <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-xl bg-brand-50 p-4 text-sm text-brand-800 ring-1 ring-brand-100">
          <input type="checkbox" name="consent" defaultChecked={mode === "client"} required className="mt-0.5 size-4 accent-brand-500" />
          <span>
            <ShieldCheck className="mr-1 inline size-4 -translate-y-px" />
            {mode === "client" ? "J'accepte" : "Le client accepte"} que ces données de santé soient conservées par le Complexe Moov&apos;Up Sports, uniquement pour le suivi sportif (loi 09-08). Elles ne remplacent pas un avis médical.
          </span>
        </label>
      </Card>
      <div className="sticky bottom-20 z-10 mt-5 flex justify-end gap-2 lg:bottom-4">
        <LinkButton href={cancelHref} variant="secondary">
          Annuler
        </LinkButton>
        <SubmitButton>{mode === "client" ? "Envoyer mon check-in" : "Enregistrer le bilan"}</SubmitButton>
      </div>
    </ActionForm>
  );
}
