"use client";

import { useState, type ReactNode } from "react";
import { Activity, AlertTriangle, ClipboardList, Dumbbell, HeartPulse, Moon, NotebookPen, Plus, ShieldCheck, Stethoscope, Trash2, User } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { Card, Field, Input, LinkButton, SectionTitle, Textarea } from "@/components/ui";
import { RangeField } from "@/components/range-field";
import { SubmitButton } from "@/components/submit-button";
import { saveBilanAction } from "@/actions/bilan";
import { PAIN_ZONES, cn } from "@/lib/utils";
import {
  ACTIVITY_FREQ,
  ALCOHOL_LABEL,
  DIABETES_LABEL,
  OBJECTIVES,
  PARQ_QUESTIONS,
  PROFESSION_LABEL,
  SLEEP_QUALITY_LABEL,
  SMOKER_LABEL,
  SPORT_LEVEL_LABEL,
  ruffierIndex,
  ruffierLabel,
} from "@/lib/bilan";
import type { BilanAnswers, SmokerType, YesNo } from "@/lib/types-bilan";

/* ---------- Petits champs ---------- */

/** Gros boutons Oui / Non (tactiles), avec détails révélés quand « Oui ». */
function YesNoField({ name, label, value, onChange, children, hint }: { name: string; label: ReactNode; value: YesNo; onChange: (v: YesNo) => void; children?: ReactNode; hint?: string }) {
  return (
    <div className={cn("rounded-xl border bg-white p-3.5 transition-colors", value === true ? "border-accent-200 bg-accent-50/30" : "border-line")}>
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <span className="text-sm font-semibold text-slate-700">{label}</span>
          {hint && <span className="mt-0.5 block text-xs text-muted">{hint}</span>}
        </div>
        <div className="grid shrink-0 grid-cols-2 gap-2 sm:w-44">
          {(["oui", "non"] as const).map((o) => (
            <label key={o} className="cursor-pointer">
              <input type="radio" name={name} value={o} checked={value === (o === "oui")} onChange={() => onChange(o === "oui")} className="peer sr-only" />
              <span
                className={cn(
                  "flex h-11 items-center justify-center rounded-xl border border-line bg-white text-sm font-bold text-slate-600 transition peer-focus-visible:ring-4 peer-focus-visible:ring-brand-100 hover:border-slate-300",
                  o === "oui" ? "peer-checked:border-accent-500 peer-checked:bg-accent-500 peer-checked:text-white" : "peer-checked:border-brand-500 peer-checked:bg-brand-500 peer-checked:text-white",
                )}
              >
                {o === "oui" ? "Oui" : "Non"}
              </span>
            </label>
          ))}
        </div>
      </div>
      {value === true && children && <div className="mt-3 border-t border-line pt-3">{children}</div>}
    </div>
  );
}

/** Choix unique en pastilles */
function Choice<T extends string>({ name, options, value, defaultValue, onChange }: { name: string; options: [T, string][]; value?: T | null; defaultValue?: T | null; onChange?: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(([v, label]) => (
        <label key={v} className="cursor-pointer">
          <input
            type="radio"
            name={name}
            value={v}
            {...(onChange ? { checked: value === v, onChange: () => onChange(v) } : { defaultChecked: defaultValue === v })}
            className="peer sr-only"
          />
          <span className="inline-flex min-h-10 items-center rounded-full border border-line bg-white px-4 py-2 text-sm font-medium text-slate-600 transition peer-checked:border-brand-500 peer-checked:bg-brand-500 peer-checked:text-white peer-focus-visible:ring-4 peer-focus-visible:ring-brand-100 hover:border-slate-300">
            {label}
          </span>
        </label>
      ))}
    </div>
  );
}

function Chips({ name, options, defaultValues, tone = "brand" }: { name: string; options: string[]; defaultValues: string[]; tone?: "brand" | "red" }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <label key={o} className="cursor-pointer">
          <input type="checkbox" name={name} value={o} defaultChecked={defaultValues.includes(o)} className="peer sr-only" />
          <span
            className={cn(
              "inline-flex min-h-10 items-center rounded-full border border-line bg-white px-3.5 py-2 text-sm font-medium text-slate-600 transition peer-focus-visible:ring-4 peer-focus-visible:ring-brand-50 hover:border-slate-300",
              tone === "red" ? "peer-checked:border-red-300 peer-checked:bg-red-50 peer-checked:text-red-700" : "peer-checked:border-brand-300 peer-checked:bg-brand-50 peer-checked:text-brand-700",
            )}
          >
            {o}
          </span>
        </label>
      ))}
    </div>
  );
}

const v = (x: number | string | null | undefined) => (x === null || x === undefined ? "" : String(x));
const entries = <T extends string>(r: Record<T, string>) => Object.entries(r) as [T, string][];

const SECTIONS = [
  ["profil", "Profil"],
  ["mode-de-vie", "Mode de vie"],
  ["medical", "Médical"],
  ["parq", "PAR-Q"],
  ["tests", "Tests"],
  ["coach", "Coach"],
] as const;

let rowSeq = 0;

/* ---------- Formulaire ---------- */

export function BilanForm({
  clientId,
  mode,
  sex,
  ageYears,
  initial,
  bilanId,
  doneOn,
  cancelHref,
}: {
  clientId: string;
  mode: "coach" | "client";
  sex: "H" | "F" | null;
  ageYears: number | null;
  initial: BilanAnswers;
  bilanId?: string;
  doneOn?: string;
  cancelHref: string;
}) {
  const coach = mode === "coach";
  const tu = (coachText: string, clientText: string) => (coach ? coachText : clientText);

  const [yn, setYn] = useState<Record<string, YesNo>>({
    surgery: initial.surgery,
    hypertension: initial.hypertension,
    hypertension_treated: initial.hypertension_treated,
    cardiac: initial.cardiac,
    respiratory: initial.respiratory,
    cholesterol: initial.cholesterol,
    epilepsy: initial.epilepsy,
    pregnant: initial.pregnant,
    med_certificate: initial.med_certificate,
  });
  const setOne = (k: string) => (val: YesNo) => setYn((s) => ({ ...s, [k]: val }));
  const [parq, setParq] = useState<YesNo[]>(initial.parq);
  const [smoker, setSmoker] = useState<SmokerType | null>(initial.smoker);
  const [surgeries, setSurgeries] = useState(() =>
    (initial.surgeries.length ? initial.surgeries : [{ what: "", year: null, month: null }]).map((s) => ({ ...s, key: ++rowSeq })),
  );
  const [ruf, setRuf] = useState({ p0: v(initial.ruffier_p0), p1: v(initial.ruffier_p1), p2: v(initial.ruffier_p2) });
  const ri = ruffierIndex(Number(ruf.p0) || null, Number(ruf.p1) || null, Number(ruf.p2) || null);
  const parqYes = parq.filter((x) => x === true).length;
  const thisYear = new Date().getFullYear();
  const sections = SECTIONS.filter(([k]) => coach || (k !== "tests" && k !== "coach"));

  return (
    <ActionForm action={saveBilanAction}>
      <input type="hidden" name="client_id" value={clientId} />
      {bilanId && <input type="hidden" name="bilan_id" value={bilanId} />}

      <nav className="no-print sticky top-0 z-10 -mx-1 mb-4 flex gap-1.5 overflow-x-auto bg-canvas/90 px-1 py-2 backdrop-blur">
        {sections.map(([k, label], i) => (
          <a key={k} href={`#${k}`} className="whitespace-nowrap rounded-full border border-line bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-brand-300 hover:text-brand-600">
            {i + 1}. {label}
          </a>
        ))}
      </nav>

      <Card className="p-5 sm:p-7">
        {/* ---------- Profil ---------- */}
        <div id="profil" className="scroll-mt-16" />
        <SectionTitle icon={<User className="size-4" />}>1. Profil</SectionTitle>
        <div className="mb-4 flex flex-wrap gap-2 text-sm">
          <span className="rounded-lg bg-canvas px-3 py-1.5 text-slate-600">
            Âge : <b className="text-ink">{ageYears !== null ? `${ageYears} ans` : "date de naissance non renseignée"}</b>
          </span>
          <span className="rounded-lg bg-canvas px-3 py-1.5 text-slate-600">
            Sexe : <b className="text-ink">{sex === "H" ? "Homme" : sex === "F" ? "Femme" : "non renseigné"}</b>
          </span>
          {coach && <span className="self-center text-xs text-muted">(depuis la fiche client)</span>}
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {coach && (
            <Field label="Date du bilan">
              <Input name="done_on" type="date" defaultValue={doneOn ?? new Date().toISOString().slice(0, 10)} />
            </Field>
          )}
          <Field label="Taille (cm)">
            <Input name="height_cm" inputMode="decimal" defaultValue={v(initial.height_cm)} placeholder="175" />
          </Field>
          <Field label="Poids (kg)">
            <Input name="weight_kg" inputMode="decimal" defaultValue={v(initial.weight_kg)} placeholder="72,5" />
          </Field>
          <Field label="Métier" className={coach ? "" : "col-span-2"}>
            <Input name="profession_label" defaultValue={v(initial.profession_label)} placeholder="Comptable, infirmière…" />
          </Field>
        </div>
        <p className="mb-2 mt-5 text-xs font-semibold text-slate-600">Type d&apos;activité professionnelle</p>
        <Choice name="profession" options={entries(PROFESSION_LABEL)} defaultValue={initial.profession} />
        <p className="mb-2 mt-5 text-xs font-semibold text-slate-600">Niveau sportif</p>
        <Choice name="sport_level" options={entries(SPORT_LEVEL_LABEL)} defaultValue={initial.sport_level} />
        <p className="mb-2 mt-5 text-xs font-semibold text-slate-600">Activité physique actuelle</p>
        <Choice name="activity_frequency" options={ACTIVITY_FREQ.map((f) => [f, f] as [string, string])} defaultValue={initial.activity_frequency} />
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="Passé sportif" className="sm:col-span-2">
            <Textarea name="sport_history" defaultValue={v(initial.sport_history)} placeholder="Sports pratiqués, années, niveau, compétitions…" />
          </Field>
        </div>
        <p className="mb-2 mt-5 text-xs font-semibold text-slate-600">Objectifs</p>
        <Chips name="objectives" options={OBJECTIVES} defaultValues={initial.objectives} />
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Objectif précis">
            <Input name="objectives_note" defaultValue={v(initial.objectives_note)} placeholder="Perdre 8 kg avant l'été…" />
          </Field>
          <Field label="Disponibilités">
            <Input name="availability" defaultValue={v(initial.availability)} placeholder="Lundi et jeudi 18h…" />
          </Field>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <RangeField name="motivation" label="Motivation" defaultValue={initial.motivation ?? 8} />
        </div>

        {/* ---------- Sommeil & mode de vie ---------- */}
        <div id="mode-de-vie" className="scroll-mt-16" />
        <SectionTitle icon={<Moon className="size-4" />}>2. Sommeil & mode de vie</SectionTitle>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Field label="Heures de sommeil / nuit">
            <Input name="sleep_hours" inputMode="decimal" defaultValue={v(initial.sleep_hours)} placeholder="7" />
          </Field>
          <Field label="Eau / jour (litres)">
            <Input name="water_l" inputMode="decimal" defaultValue={v(initial.water_l)} placeholder="1,5" />
          </Field>
        </div>
        <p className="mb-2 mt-5 text-xs font-semibold text-slate-600">Qualité du sommeil</p>
        <Choice name="sleep_quality" options={entries(SLEEP_QUALITY_LABEL)} defaultValue={initial.sleep_quality} />
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <RangeField name="stress" label="Stress" defaultValue={initial.stress ?? 5} invert />
        </div>
        <Field label="Habitudes alimentaires" className="mt-4">
          <Textarea name="nutrition_habits" defaultValue={v(initial.nutrition_habits)} placeholder="Nombre de repas, grignotage, sucres, restauration rapide…" />
        </Field>

        {/* ---------- Médical ---------- */}
        <div id="medical" className="scroll-mt-16" />
        <SectionTitle icon={<Stethoscope className="size-4" />}>3. Médical</SectionTitle>
        <div className="grid gap-3">
          <YesNoField name="surgery" label={tu("Déjà opéré(e) ?", "As-tu déjà été opéré(e) ?")} value={yn.surgery ?? null} onChange={setOne("surgery")}>
            <div className="space-y-2">
              {surgeries.map((s, i) => (
                <div key={s.key} className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[1fr_100px_110px_auto]">
                  <Input name="surgery_what" defaultValue={s.what} placeholder="Quelle opération ? (ex. ménisque genou droit)" className="col-span-2 sm:col-span-1" aria-label={`Opération ${i + 1}`} />
                  <Input name="surgery_year" inputMode="numeric" defaultValue={v(s.year)} placeholder="Année" aria-label="Année" min={1930} max={thisYear} />
                  <select name="surgery_month" defaultValue={v(s.month)} aria-label="Mois" className="h-11 rounded-xl border border-line bg-white px-3 text-sm">
                    <option value="">Mois</option>
                    {["Janv.", "Févr.", "Mars", "Avr.", "Mai", "Juin", "Juil.", "Août", "Sept.", "Oct.", "Nov.", "Déc."].map((m, k) => (
                      <option key={m} value={k + 1}>
                        {m}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setSurgeries((rows) => (rows.length > 1 ? rows.filter((r) => r.key !== s.key) : rows))}
                    className="grid size-11 place-items-center rounded-xl border border-line text-slate-400 transition hover:border-red-200 hover:text-red-600"
                    aria-label="Retirer cette opération"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setSurgeries((rows) => [...rows, { what: "", year: null, month: null, key: ++rowSeq }])}
                className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-semibold text-brand-600 hover:bg-brand-50"
              >
                <Plus className="size-4" /> Ajouter une opération
              </button>
              <p className="text-xs text-muted">Le mois permet de repérer une opération de moins de 12 mois.</p>
            </div>
          </YesNoField>

          <div className="rounded-xl border border-line bg-white p-3.5">
            <p className="mb-2.5 text-sm font-semibold text-slate-700">Diabète</p>
            <Choice name="diabetes" options={entries(DIABETES_LABEL)} defaultValue={initial.diabetes} />
          </div>

          <YesNoField name="hypertension" label="Hypertension (tension élevée)" value={yn.hypertension ?? null} onChange={setOne("hypertension")}>
            <YesNoField name="hypertension_treated" label="Traitée par un médecin ?" value={yn.hypertension_treated ?? null} onChange={setOne("hypertension_treated")} />
          </YesNoField>
          <YesNoField name="cardiac" label="Problèmes cardiaques" value={yn.cardiac ?? null} onChange={setOne("cardiac")}>
            <Input name="cardiac_details" defaultValue={v(initial.cardiac_details)} placeholder="Lequel ? (arythmie, souffle, infarctus…)" />
          </YesNoField>
          <YesNoField name="respiratory" label="Asthme / problème respiratoire" value={yn.respiratory ?? null} onChange={setOne("respiratory")} />
          <YesNoField name="cholesterol" label="Cholestérol" value={yn.cholesterol ?? null} onChange={setOne("cholesterol")} />
          <YesNoField name="epilepsy" label="Épilepsie" value={yn.epilepsy ?? null} onChange={setOne("epilepsy")} />
          {sex !== "H" && (
            <YesNoField name="pregnant" label={tu("Enceinte actuellement ?", "Es-tu enceinte actuellement ?")} value={yn.pregnant ?? null} onChange={setOne("pregnant")}>
              <Field label="Nombre de semaines">
                <Input name="pregnancy_weeks" inputMode="numeric" defaultValue={v(initial.pregnancy_weeks)} placeholder="12" className="max-w-32" />
              </Field>
            </YesNoField>
          )}

          <div className="rounded-xl border border-line bg-white p-3.5">
            <p className="mb-2.5 text-sm font-semibold text-slate-700">Tabac</p>
            <Choice name="smoker" options={entries(SMOKER_LABEL)} value={smoker} onChange={setSmoker} />
            {(smoker === "regulier" || smoker === "occasionnel") && (
              <Field label="Cigarettes par jour" className="mt-3">
                <Input name="cigarettes_per_day" inputMode="numeric" defaultValue={v(initial.cigarettes_per_day)} placeholder="10" className="max-w-32" />
              </Field>
            )}
          </div>
          <div className="rounded-xl border border-line bg-white p-3.5">
            <p className="mb-2.5 text-sm font-semibold text-slate-700">Alcool</p>
            <Choice name="alcohol" options={entries(ALCOHOL_LABEL)} defaultValue={initial.alcohol} />
          </div>
          <YesNoField name="med_certificate" label="Certificat médical d'aptitude" value={yn.med_certificate ?? null} onChange={setOne("med_certificate")}>
            <Field label="Date du certificat">
              <Input name="med_certificate_date" type="date" defaultValue={v(initial.med_certificate_date)} className="max-w-48" />
            </Field>
          </YesNoField>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Autres maladies">
            <Textarea name="other_conditions" defaultValue={v(initial.other_conditions)} placeholder="Arthrose, thyroïde, hernie discale…" />
          </Field>
          <Field label="Allergies">
            <Textarea name="allergies" defaultValue={v(initial.allergies)} placeholder="Médicaments, aliments, pollen…" />
          </Field>
          <Field label="Médicaments en cours" className="sm:col-span-2">
            <Textarea name="medications" defaultValue={v(initial.medications)} placeholder="Nom et dosage" />
          </Field>
        </div>
        <p className="mb-2 mt-5 text-xs font-semibold text-slate-600">Blessures / douleurs actuelles (zones)</p>
        <Chips name="pain_zones" options={PAIN_ZONES} defaultValues={initial.pain_zones} tone="red" />
        <Field label="Précisions sur les douleurs / blessures" className="mt-4">
          <Input name="pain_details" defaultValue={v(initial.pain_details)} placeholder="Depuis quand, mouvements douloureux…" />
        </Field>

        {/* ---------- PAR-Q ---------- */}
        <div id="parq" className="scroll-mt-16" />
        <SectionTitle icon={<ClipboardList className="size-4" />}>4. Questionnaire PAR-Q</SectionTitle>
        <p className="mb-3 text-sm text-muted">Questionnaire standard d&apos;aptitude à l&apos;activité physique. Un seul « oui » suffit pour demander un avis médical avant un effort intense.</p>
        <div className="grid gap-2.5">
          {PARQ_QUESTIONS.map((q, i) => (
            <YesNoField key={i} name={`parq_${i}`} label={<><span className="mr-1 text-brand-600">{i + 1}.</span> {q}</>} value={parq[i] ?? null} onChange={(val) => setParq((p) => p.map((x, k) => (k === i ? val : x)))} />
          ))}
        </div>
        {parqYes > 0 && (
          <p className="mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" /> PAR-Q positif ({parqYes} « oui ») : avis médical recommandé avant tout effort intense.
          </p>
        )}

        {coach && (
          <>
            {/* ---------- Tests ---------- */}
            <div id="tests" className="scroll-mt-16" />
            <SectionTitle icon={<Dumbbell className="size-4" />}>5. Tests physiques (facultatif)</SectionTitle>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Field label="FC repos (bpm)">
                <Input name="resting_hr" inputMode="numeric" defaultValue={v(initial.resting_hr)} placeholder="65" />
              </Field>
              <Field label="Tension systolique">
                <Input name="systolic" inputMode="numeric" defaultValue={v(initial.systolic)} placeholder="120" />
              </Field>
              <Field label="Tension diastolique">
                <Input name="diastolic" inputMode="numeric" defaultValue={v(initial.diastolic)} placeholder="80" />
              </Field>
              <Field label="Tour de taille (cm)">
                <Input name="waist_cm" inputMode="decimal" defaultValue={v(initial.waist_cm)} placeholder="84" />
              </Field>
              <Field label="Souplesse (cm)" hint="Distance doigts-sol / sit and reach (+ ou −)">
                <Input name="flexibility_cm" inputMode="decimal" defaultValue={v(initial.flexibility_cm)} placeholder="-5" />
              </Field>
              <Field label="Pompes (max)">
                <Input name="pushups" inputMode="numeric" defaultValue={v(initial.pushups)} placeholder="20" />
              </Field>
              <Field label="Gainage (secondes)">
                <Input name="plank_s" inputMode="numeric" defaultValue={v(initial.plank_s)} placeholder="60" />
              </Field>
            </div>
            <div className="mt-4 rounded-xl border border-line bg-canvas/50 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <HeartPulse className="size-4 text-accent-500" /> Test de Ruffier
              </p>
              <p className="mt-1 text-xs text-muted">P0 au repos, P1 juste après 30 flexions en 45 s, P2 après 1 minute de récupération (pulsations / minute).</p>
              <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-[repeat(3,minmax(0,140px))_1fr]">
                {(["p0", "p1", "p2"] as const).map((k) => (
                  <Field key={k} label={k.toUpperCase()}>
                    <Input name={`ruffier_${k}`} inputMode="numeric" value={ruf[k]} onChange={(e) => setRuf((r) => ({ ...r, [k]: e.target.value }))} placeholder={k === "p0" ? "70" : k === "p1" ? "120" : "85"} />
                  </Field>
                ))}
                <div className="col-span-3 flex items-end sm:col-span-1">
                  <div className="w-full rounded-xl bg-white px-4 py-2.5 ring-1 ring-line">
                    <p className="text-xs text-muted">Indice de Ruffier</p>
                    <p className="font-display text-lg font-extrabold text-brand-600">
                      {ri ?? "–"} <span className="text-xs font-semibold text-muted">{ruffierLabel(ri) ?? ""}</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* ---------- Coach ---------- */}
            <div id="coach" className="scroll-mt-16" />
            <SectionTitle icon={<NotebookPen className="size-4" />}>6. Notes du coach</SectionTitle>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Observations">
                <Textarea name="coach_notes" defaultValue={v(initial.coach_notes)} placeholder="Posture, ressenti, points de vigilance…" />
              </Field>
              <Field label="Recommandations">
                <Textarea name="recommendations" defaultValue={v(initial.recommendations)} placeholder="Exercices à privilégier / à éviter, intensité, suivi…" />
              </Field>
            </div>
          </>
        )}

        <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-xl bg-brand-50 p-4 text-sm text-brand-800 ring-1 ring-brand-100">
          <input type="checkbox" name="consent" defaultChecked={!!bilanId} required className="mt-0.5 size-4 accent-brand-500" />
          <span>
            <ShieldCheck className="mr-1 inline size-4 -translate-y-px" />
            {tu("Le client accepte", "J'accepte")} que ces données de santé soient conservées par le Complexe Moov&apos;Up Sports, uniquement pour le suivi sportif (loi 09-08). Elles ne remplacent pas un avis médical.
          </span>
        </label>
        {!coach && (
          <p className="mt-3 flex items-center gap-2 text-xs text-muted">
            <Activity className="size-3.5" /> Ton coach relira tes réponses et complétera les tests physiques lors de ta prochaine séance.
          </p>
        )}
      </Card>
      <div className="sticky bottom-20 z-10 mt-5 flex justify-end gap-2 lg:bottom-4">
        <LinkButton href={cancelHref} variant="secondary">
          Annuler
        </LinkButton>
        <SubmitButton>{coach ? (bilanId ? "Enregistrer les modifications" : "Enregistrer le bilan") : "Envoyer à mon coach"}</SubmitButton>
      </div>
    </ActionForm>
  );
}
