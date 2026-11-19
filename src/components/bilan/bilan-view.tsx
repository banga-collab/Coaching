import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, ClipboardList, Dumbbell, Info, Moon, NotebookPen, ShieldAlert, ShieldCheck, Stethoscope, User } from "lucide-react";
import { Card, CardHeader } from "@/components/ui";
import { cn, fmtDate, num } from "@/lib/utils";
import {
  ALCOHOL_LABEL,
  DIABETES_LABEL,
  PARQ_QUESTIONS,
  PROFESSION_LABEL,
  RISK_LABEL,
  RISK_TEXT,
  SLEEP_QUALITY_LABEL,
  SMOKER_LABEL,
  SPORT_LEVEL_LABEL,
  bmi,
  isRecentSurgery,
  parqPositive,
  ruffierIndex,
  ruffierLabel,
  surgeryText,
} from "@/lib/bilan";
import type { BilanAnswers, FlagLevel, RiskLevel, RiskResult, YesNo } from "@/lib/types-bilan";

const RISK_STYLE: Record<RiskLevel, { pill: string; panel: string; dot: string }> = {
  vert: { pill: "bg-emerald-500 text-white", panel: "border-emerald-200 bg-emerald-50 text-emerald-900", dot: "bg-emerald-500" },
  orange: { pill: "bg-accent-500 text-white", panel: "border-accent-200 bg-accent-50 text-accent-700", dot: "bg-accent-500" },
  rouge: { pill: "bg-red-600 text-white", panel: "border-red-200 bg-red-50 text-red-800", dot: "bg-red-600" },
};
const FLAG_STYLE: Record<FlagLevel, { cls: string; icon: ReactNode }> = {
  rouge: { cls: "border-red-200 bg-red-50 text-red-800", icon: <ShieldAlert className="mt-0.5 size-4 shrink-0 text-red-600" /> },
  orange: { cls: "border-accent-200 bg-accent-50 text-accent-700", icon: <AlertTriangle className="mt-0.5 size-4 shrink-0 text-accent-500" /> },
  info: { cls: "border-line bg-canvas/60 text-slate-700", icon: <Info className="mt-0.5 size-4 shrink-0 text-brand-500" /> },
};

/** Pastille colorée du niveau de risque */
export function RiskBadge({ level, size = "md" }: { level: RiskLevel; size?: "sm" | "md" | "lg" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-bold print:border print:border-current",
        RISK_STYLE[level].pill,
        size === "sm" ? "px-2 py-0.5 text-[11px]" : size === "lg" ? "px-4 py-1.5 text-sm" : "px-3 py-1 text-xs",
      )}
    >
      <span className="size-1.5 rounded-full bg-white/90" />
      Risque {RISK_LABEL[level].toLowerCase()}
    </span>
  );
}

/** Bloc niveau de risque + signaux + précautions (personnel uniquement) */
export function RiskPanel({ risk }: { risk: RiskResult }) {
  const alerts = risk.flags.filter((f) => f.level !== "info");
  const infos = risk.flags.filter((f) => f.level === "info");
  return (
    <Card className="overflow-hidden">
      <div className={cn("flex flex-wrap items-center gap-3 border-b px-5 py-4", RISK_STYLE[risk.level].panel)}>
        <RiskBadge level={risk.level} size="lg" />
        <p className="text-sm font-semibold">{RISK_TEXT[risk.level]}</p>
      </div>
      <div className="grid gap-5 p-5 lg:grid-cols-2">
        <div>
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-brand-600">Signaux repérés</h4>
          {risk.flags.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-emerald-700">
              <CheckCircle2 className="size-4" /> Aucun signal particulier.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {[...alerts, ...infos].map((f, i) => (
                <li key={i} className={cn("flex items-start gap-2 rounded-lg border px-3 py-2 text-sm", FLAG_STYLE[f.level].cls)}>
                  {FLAG_STYLE[f.level].icon}
                  <span>{f.label}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-brand-600">Précautions conseillées</h4>
          <ul className="space-y-1.5 text-sm text-slate-700">
            {risk.precautions.map((p, i) => (
              <li key={i} className="flex items-start gap-2">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand-500" />
                <span>{p}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] text-muted">Aide à la décision pour le coach, ne remplace pas un avis médical.</p>
        </div>
      </div>
    </Card>
  );
}

/* ---------- Réponses ---------- */

const yesNo = (x: YesNo) => (x === true ? "Oui" : x === false ? "Non" : null);

function Row({ label, value, alert }: { label: string; value: ReactNode; alert?: boolean }) {
  const empty = value === null || value === undefined || value === "" || (Array.isArray(value) && !value.length);
  return (
    <div className="border-b border-line py-2.5 print:py-1.5">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className={cn("mt-0.5 text-sm font-medium", empty ? "text-slate-400" : alert ? "font-semibold text-accent-700" : "text-ink")}>{empty ? "—" : value}</dd>
    </div>
  );
}

function Block({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <Card>
      <CardHeader title={title} icon={icon} />
      <dl className="grid gap-x-6 px-5 pb-4 sm:grid-cols-2">{children}</dl>
    </Card>
  );
}

/** Résumé des réponses d'un bilan */
export function BilanAnswersView({ a, sex, ageYears, showCoach, doneOn }: { a: BilanAnswers; sex: "H" | "F" | null; ageYears: number | null; showCoach: boolean; doneOn: string }) {
  const imc = bmi(a.weight_kg, a.height_cm);
  const ri = ruffierIndex(a.ruffier_p0, a.ruffier_p1, a.ruffier_p2);
  const now = new Date(doneOn);
  const parqYes = a.parq.map((x, i) => (x === true ? i : -1)).filter((i) => i >= 0);
  const hasTests = [a.resting_hr, a.systolic, a.waist_cm, a.flexibility_cm, a.pushups, a.plank_s, ri].some((x) => x !== null);

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Block title="Profil" icon={<User className="size-4" />}>
        <Row label="Âge / sexe" value={[ageYears !== null ? `${ageYears} ans` : null, sex === "H" ? "Homme" : sex === "F" ? "Femme" : null].filter(Boolean).join(" · ")} />
        <Row label="Taille / poids" value={[a.height_cm ? num(a.height_cm, "cm") : null, a.weight_kg ? num(a.weight_kg, "kg") : null, imc ? `IMC ${num(imc)}` : null].filter(Boolean).join(" · ")} />
        <Row label="Métier" value={[a.profession_label, a.profession ? PROFESSION_LABEL[a.profession] : null].filter(Boolean).join(" · ")} />
        <Row label="Niveau sportif" value={a.sport_level ? SPORT_LEVEL_LABEL[a.sport_level] : null} />
        <Row label="Activité actuelle" value={a.activity_frequency} />
        <Row label="Motivation" value={a.motivation !== null ? `${a.motivation}/10` : null} />
        <Row label="Objectifs" value={[a.objectives.join(", "), a.objectives_note].filter(Boolean).join(" — ")} />
        <Row label="Disponibilités" value={a.availability} />
        <div className="sm:col-span-2">
          <Row label="Passé sportif" value={a.sport_history} />
        </div>
      </Block>

      <Block title="Sommeil & mode de vie" icon={<Moon className="size-4" />}>
        <Row label="Sommeil" value={[a.sleep_hours !== null ? `${num(a.sleep_hours)} h / nuit` : null, a.sleep_quality ? `qualité ${SLEEP_QUALITY_LABEL[a.sleep_quality].toLowerCase()}` : null].filter(Boolean).join(" · ")} alert={a.sleep_quality === "mauvaise" || (a.sleep_hours !== null && a.sleep_hours < 6)} />
        <Row label="Stress" value={a.stress !== null ? `${a.stress}/10` : null} alert={(a.stress ?? 0) >= 8} />
        <Row label="Eau / jour" value={a.water_l !== null ? `${num(a.water_l)} L` : null} />
        <Row label="Tabac" value={a.smoker ? `${SMOKER_LABEL[a.smoker]}${a.cigarettes_per_day ? ` · ${a.cigarettes_per_day} cig./jour` : ""}` : null} alert={a.smoker === "regulier" || a.smoker === "occasionnel"} />
        <Row label="Alcool" value={a.alcohol ? ALCOHOL_LABEL[a.alcohol] : null} alert={a.alcohol === "regulier"} />
        <div className="sm:col-span-2">
          <Row label="Habitudes alimentaires" value={a.nutrition_habits} />
        </div>
      </Block>

      <Block title="Médical" icon={<Stethoscope className="size-4" />}>
        <div className="sm:col-span-2">
          <Row
            label="Opérations"
            alert={!!a.surgery}
            value={
              a.surgery === false
                ? "Aucune"
                : a.surgery
                  ? a.surgeries.length
                    ? a.surgeries.map((s) => `${surgeryText(s)}${isRecentSurgery(s, now) ? " — moins de 12 mois" : ""}`).join(" ; ")
                    : "Oui (non précisé)"
                  : null
            }
          />
        </div>
        <Row label="Diabète" value={a.diabetes ? DIABETES_LABEL[a.diabetes] : null} alert={!!a.diabetes && a.diabetes !== "non"} />
        <Row label="Hypertension" value={a.hypertension ? `Oui${a.hypertension_treated === true ? " (traitée)" : a.hypertension_treated === false ? " (non traitée)" : ""}` : yesNo(a.hypertension)} alert={!!a.hypertension} />
        <Row label="Problèmes cardiaques" value={a.cardiac ? `Oui${a.cardiac_details ? ` — ${a.cardiac_details}` : ""}` : yesNo(a.cardiac)} alert={!!a.cardiac} />
        <Row label="Asthme / respiratoire" value={yesNo(a.respiratory)} alert={!!a.respiratory} />
        <Row label="Cholestérol" value={yesNo(a.cholesterol)} alert={!!a.cholesterol} />
        <Row label="Épilepsie" value={yesNo(a.epilepsy)} alert={!!a.epilepsy} />
        {sex !== "H" && <Row label="Grossesse" value={a.pregnant ? `Oui${a.pregnancy_weeks ? ` (${a.pregnancy_weeks} sem.)` : ""}` : yesNo(a.pregnant)} alert={!!a.pregnant} />}
        <Row label="Certificat médical" value={a.med_certificate ? `Oui${a.med_certificate_date ? ` (${fmtDate(a.med_certificate_date)})` : ""}` : yesNo(a.med_certificate)} />
        <Row label="Autres maladies" value={a.other_conditions} />
        <Row label="Allergies" value={a.allergies} />
        <Row label="Médicaments" value={a.medications} />
        <Row label="Douleurs / blessures" value={[a.pain_zones.join(", "), a.pain_details].filter(Boolean).join(" — ")} alert={a.pain_zones.length > 0} />
      </Block>

      <Card>
        <CardHeader title="PAR-Q" icon={<ClipboardList className="size-4" />} subtitle={a.parq.every((x) => x === null) ? "Non renseigné" : parqPositive(a) ? `${parqYes.length} réponse(s) « oui »` : "Non à toutes les questions"} />
        <ol className="space-y-1.5 px-5 pb-5">
          {PARQ_QUESTIONS.map((q, i) => (
            <li key={i} className="flex items-start gap-3 text-sm">
              <span
                className={cn(
                  "mt-0.5 inline-flex h-5 min-w-9 shrink-0 items-center justify-center rounded-md text-[11px] font-bold",
                  a.parq[i] === true ? "bg-red-600 text-white" : a.parq[i] === false ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100" : "bg-slate-50 text-slate-400 ring-1 ring-slate-200",
                )}
              >
                {a.parq[i] === true ? "OUI" : a.parq[i] === false ? "non" : "?"}
              </span>
              <span className={cn("text-slate-600", a.parq[i] === true && "font-semibold text-ink")}>{q}</span>
            </li>
          ))}
        </ol>
      </Card>

      {hasTests && (
        <Block title="Tests physiques" icon={<Dumbbell className="size-4" />}>
          <Row label="FC repos" value={a.resting_hr ? `${a.resting_hr} bpm` : null} alert={(a.resting_hr ?? 0) > 100} />
          <Row label="Tension" value={a.systolic && a.diastolic ? `${a.systolic}/${a.diastolic}` : null} alert={(a.systolic ?? 0) >= 140 || (a.diastolic ?? 0) >= 90} />
          <Row label="Tour de taille" value={a.waist_cm ? num(a.waist_cm, "cm") : null} />
          <Row label="Souplesse" value={a.flexibility_cm !== null ? `${a.flexibility_cm > 0 ? "+" : ""}${num(a.flexibility_cm)} cm` : null} />
          <Row label="Pompes" value={a.pushups !== null ? `${a.pushups}` : null} />
          <Row label="Gainage" value={a.plank_s !== null ? `${a.plank_s} s` : null} />
          <div className="sm:col-span-2">
            <Row label="Test de Ruffier" value={ri !== null ? `Indice ${num(ri)} — ${ruffierLabel(ri)} (P0 ${a.ruffier_p0} · P1 ${a.ruffier_p1} · P2 ${a.ruffier_p2})` : null} alert={ri !== null && ri > 10} />
          </div>
        </Block>
      )}

      {showCoach && (a.coach_notes || a.recommendations) && (
        <Card className="lg:col-span-2">
          <CardHeader title="Notes du coach" icon={<NotebookPen className="size-4" />} />
          <div className="grid gap-4 px-5 pb-5 sm:grid-cols-2">
            <div>
              <p className="text-xs text-muted">Observations</p>
              <p className="mt-1 whitespace-pre-line text-sm text-slate-700">{a.coach_notes || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted">Recommandations</p>
              <p className="mt-1 whitespace-pre-line text-sm text-slate-700">{a.recommendations || "—"}</p>
            </div>
          </div>
        </Card>
      )}
      {!showCoach && a.recommendations && (
        <Card className="lg:col-span-2">
          <CardHeader title="Recommandations de ton coach" icon={<NotebookPen className="size-4" />} />
          <p className="whitespace-pre-line px-5 pb-5 text-sm text-slate-700">{a.recommendations}</p>
        </Card>
      )}
    </div>
  );
}
