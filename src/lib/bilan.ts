/**
 * Bilan sportif : constantes, lecture du formulaire et calcul du niveau de risque.
 * Module pur (aucun accès base) : utilisable côté serveur, côté client et dans le seed démo.
 */
import type {
  AlcoholType,
  BilanAnswers,
  DiabetesType,
  FlagLevel,
  ProfessionType,
  RiskFlag,
  RiskLevel,
  RiskResult,
  SleepQuality,
  SmokerType,
  SportLevel,
  Surgery,
  YesNo,
} from "./types-bilan";

/* ---------- Libellés ---------- */

export const PARQ_QUESTIONS = [
  "Un médecin vous a-t-il déjà dit que vous aviez un problème cardiaque et que vous ne deviez faire que des activités physiques recommandées par un médecin ?",
  "Ressentez-vous une douleur à la poitrine lorsque vous faites une activité physique ?",
  "Au cours du dernier mois, avez-vous ressenti une douleur à la poitrine alors que vous ne faisiez pas d'activité physique ?",
  "Perdez-vous l'équilibre à cause d'étourdissements ou avez-vous déjà perdu connaissance ?",
  "Avez-vous un problème osseux ou articulaire qui pourrait s'aggraver avec l'activité physique ?",
  "Un médecin vous prescrit-il actuellement des médicaments pour la tension artérielle ou le cœur ?",
  "Connaissez-vous une autre raison pour laquelle vous ne devriez pas faire d'activité physique ?",
] as const;

export const RISK_LABEL: Record<RiskLevel, string> = { vert: "Vert", orange: "Orange", rouge: "Rouge" };
export const RISK_TEXT: Record<RiskLevel, string> = {
  vert: "Aucune contre-indication repérée",
  orange: "Vigilance : adapter l'entraînement",
  rouge: "Avis médical recommandé avant effort intense",
};
export const RISK_TONE: Record<RiskLevel, "green" | "amber" | "red"> = { vert: "green", orange: "amber", rouge: "red" };

export const PROFESSION_LABEL: Record<ProfessionType, string> = { sedentaire: "Sédentaire (bureau)", debout: "Debout / marche", physique: "Physique (port de charges)" };
export const SPORT_LEVEL_LABEL: Record<SportLevel, string> = { debutant: "Débutant", intermediaire: "Intermédiaire", confirme: "Confirmé", ancien_sportif: "Ancien sportif" };
export const SLEEP_QUALITY_LABEL: Record<SleepQuality, string> = { bonne: "Bonne", moyenne: "Moyenne", mauvaise: "Mauvaise" };
export const DIABETES_LABEL: Record<DiabetesType, string> = { non: "Non", type1: "Type 1", type2: "Type 2", prediabete: "Pré-diabète" };
export const SMOKER_LABEL: Record<SmokerType, string> = { non: "Non", ancien: "Ancien fumeur", occasionnel: "Occasionnel", regulier: "Régulier" };
export const ALCOHOL_LABEL: Record<AlcoholType, string> = { non: "Non", occasionnel: "Occasionnel", regulier: "Régulier" };
export const ACTIVITY_FREQ = ["Aucune", "Moins d'1x / semaine", "1x / semaine", "2-3x / semaine", "4x / semaine ou plus"];
export const OBJECTIVES = ["Perte de poids", "Prise de masse", "Tonification", "Santé & bien-être", "Performance", "Mobilité", "Rééducation / reprise", "Préparation d'un événement"];

/* ---------- Valeurs ---------- */

export function emptyAnswers(): BilanAnswers {
  return {
    height_cm: null, weight_kg: null, profession: null, profession_label: null, sport_history: null, sport_level: null,
    activity_frequency: null, objectives: [], objectives_note: null, motivation: null, availability: null,
    sleep_hours: null, sleep_quality: null, stress: null, water_l: null, nutrition_habits: null,
    surgery: null, surgeries: [], diabetes: null, hypertension: null, hypertension_treated: null, cardiac: null, cardiac_details: null,
    respiratory: null, cholesterol: null, epilepsy: null, other_conditions: null, allergies: null, medications: null,
    pain_zones: [], pain_details: null, pregnant: null, pregnancy_weeks: null, smoker: null, cigarettes_per_day: null,
    alcohol: null, med_certificate: null, med_certificate_date: null, parq: Array(PARQ_QUESTIONS.length).fill(null),
    resting_hr: null, systolic: null, diastolic: null, waist_cm: null, flexibility_cm: null, pushups: null, plank_s: null,
    ruffier_p0: null, ruffier_p1: null, ruffier_p2: null, coach_notes: null, recommendations: null,
  };
}

/** Complète des réponses partielles (anciennes versions, seed) avec les valeurs par défaut. */
export function normalizeAnswers(a: Partial<BilanAnswers> | null | undefined): BilanAnswers {
  const base = emptyAnswers();
  const out = { ...base, ...(a ?? {}) } as BilanAnswers;
  out.objectives = Array.isArray(out.objectives) ? out.objectives : [];
  out.pain_zones = Array.isArray(out.pain_zones) ? out.pain_zones : [];
  out.surgeries = Array.isArray(out.surgeries) ? out.surgeries : [];
  out.parq = base.parq.map((_, i) => (Array.isArray(a?.parq) ? (a!.parq[i] ?? null) : null));
  return out;
}

/** Indice de Ruffier : (P0 + P1 + P2 − 200) / 10 */
export function ruffierIndex(p0: number | null, p1: number | null, p2: number | null): number | null {
  if (!p0 || !p1 || !p2) return null;
  return Math.round(((p0 + p1 + p2 - 200) / 10) * 10) / 10;
}
export function ruffierLabel(i: number | null): string | null {
  if (i === null) return null;
  if (i <= 0) return "Excellente adaptation à l'effort";
  if (i <= 5) return "Bonne adaptation à l'effort";
  if (i <= 10) return "Adaptation moyenne";
  if (i <= 15) return "Adaptation faible";
  return "Adaptation très faible";
}

export function bmi(weight: number | null, heightCm: number | null) {
  if (!weight || !heightCm) return null;
  return Math.round((weight / (heightCm / 100) ** 2) * 10) / 10;
}

export const parqPositive = (a: BilanAnswers) => a.parq.some((v) => v === true);

/** Mois écoulés depuis une opération (null si date inconnue). Sans mois : milieu d'année. */
export function monthsSince(s: Surgery, now = new Date()): number | null {
  if (!s.year) return null;
  const m = s.month && s.month >= 1 && s.month <= 12 ? s.month : 6;
  return (now.getFullYear() - s.year) * 12 + (now.getMonth() + 1 - m);
}
export const isRecentSurgery = (s: Surgery, now = new Date()) => {
  const n = monthsSince(s, now);
  return n !== null && n < 12;
};
export const surgeryText = (s: Surgery) => {
  const months = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
  const when = s.year ? ` (${s.month ? `${months[s.month - 1]} ` : ""}${s.year})` : "";
  return `${s.what || "Opération"}${when}`;
};

/* ---------- Calcul du risque ---------- */

const RANK: Record<FlagLevel, number> = { info: 0, orange: 1, rouge: 2 };

/**
 * Niveau de risque (vert / orange / rouge), liste des signaux et précautions conseillées.
 * Règles volontairement prudentes : c'est une aide pour le coach, pas un diagnostic.
 */
export function computeRisk(a: BilanAnswers, ctx: { sex?: "H" | "F" | null; age?: number | null; now?: Date } = {}): RiskResult {
  const now = ctx.now ?? new Date();
  const flags: RiskFlag[] = [];
  const add = (level: FlagLevel, label: string, precaution: string) => flags.push({ level, label, precaution });

  // Certificat médical de moins de 12 mois
  const certOk =
    a.med_certificate === true &&
    (!a.med_certificate_date || (now.getTime() - new Date(a.med_certificate_date).getTime()) / 86400000 <= 365);

  // PAR-Q
  if (parqPositive(a)) {
    const n = a.parq.filter((v) => v === true).length;
    if (certOk) add("orange", `PAR-Q positif (${n} « oui ») avec certificat médical`, "Respecter les restrictions du médecin et progresser par paliers.");
    else add("rouge", `PAR-Q positif (${n} « oui ») → avis médical avant effort intense`, "Demander un certificat médical d'aptitude avant tout effort intense ; en attendant, effort léger uniquement.");
  }

  // Cardiaque
  if (a.cardiac) add("rouge", "Problème cardiaque déclaré", "Avis du cardiologue obligatoire ; surveiller la FC, pas d'effort maximal.");

  // Tension
  if (a.hypertension && a.hypertension_treated === false) {
    add("rouge", "Hypertension non traitée", "Orienter vers un médecin ; éviter les blocages respiratoires et les charges lourdes.");
  } else if (a.hypertension) {
    add("orange", "Hypertension traitée", "Pas d'apnée ni de charges maximales ; échauffement et retour au calme progressifs.");
  }
  if (a.systolic && a.diastolic) {
    if (a.systolic >= 160 || a.diastolic >= 100) add("rouge", `Tension élevée au repos (${a.systolic}/${a.diastolic})`, "Reporter l'effort intense et conseiller une consultation médicale.");
    else if (a.systolic >= 140 || a.diastolic >= 90) add("orange", `Tension un peu élevée au repos (${a.systolic}/${a.diastolic})`, "Recontrôler la tension à la prochaine séance ; intensité modérée.");
  }
  if (a.resting_hr && a.resting_hr > 100) add("orange", `FC de repos élevée (${a.resting_hr} bpm)`, "Recontrôler au calme ; si elle reste > 100 bpm, avis médical.");

  // Diabète
  const smokes = a.smoker === "regulier" || a.smoker === "occasionnel";
  if (a.diabetes === "type1" || a.diabetes === "type2") {
    add("orange", `Diabète ${a.diabetes === "type1" ? "de type 1" : "de type 2"}`, "Prévoir une collation sucrée, vérifier la glycémie avant/après l'effort, surveiller les pieds.");
    if (smokes) add("rouge", "Diabète + tabac", "Cumul de risques cardiovasculaires : avis médical et reprise très progressive.");
  } else if (a.diabetes === "prediabete") {
    add("info", "Pré-diabète", "L'activité régulière est très bénéfique : viser la régularité et le travail cardio.");
  }

  // Cumul de facteurs de risque cardiovasculaire
  const age = ctx.age ?? null;
  const cv = [
    a.diabetes === "type1" || a.diabetes === "type2",
    !!a.hypertension,
    smokes,
    !!a.cholesterol,
    age !== null && age >= (ctx.sex === "F" ? 55 : 45),
    a.profession === "sedentaire" && (a.activity_frequency === "Aucune" || a.activity_frequency === "Moins d'1x / semaine"),
  ].filter(Boolean).length;
  if (cv >= 3 && !flags.some((f) => f.level === "rouge")) {
    add("orange", `Cumul de ${cv} facteurs de risque cardiovasculaire`, "Commencer à intensité modérée et augmenter par paliers ; un bilan médical est conseillé.");
  }

  // Opérations
  if (a.surgery) {
    for (const s of a.surgeries) {
      const n = monthsSince(s, now);
      if (n !== null && n < 12) add("orange", `Opération récente (< 12 mois) : ${surgeryText(s)}`, "Accord du chirurgien ou du kiné avant de solliciter la zone ; reprise progressive.");
      else add("info", `Antécédent opératoire : ${surgeryText(s)}`, "Adapter les exercices qui sollicitent la zone opérée.");
    }
    if (!a.surgeries.length) add("info", "Antécédent opératoire (détail non précisé)", "Faire préciser l'opération et la date.");
  }

  // Grossesse
  if (ctx.sex !== "H" && a.pregnant) {
    add("orange", `Grossesse${a.pregnancy_weeks ? ` (${a.pregnancy_weeks} semaines)` : ""}`, "Accord du médecin ou de la sage-femme ; pas d'abdos en flexion, pas de position allongée sur le dos après 16 semaines, pas de sports de contact.");
  }

  // Autres pathologies
  if (a.epilepsy) add("orange", "Épilepsie", "Éviter les exercices en hauteur et les charges au-dessus de la tête sans surveillance.");
  if (a.respiratory) add("info", "Asthme / problème respiratoire", "Garder le traitement de crise à portée de main ; échauffement long.");
  if (a.cholesterol) add("info", "Cholestérol", "Privilégier l'endurance régulière ; conseils nutrition.");

  // Tabac / alcool
  if (a.smoker === "regulier") add("orange", `Fumeur régulier${a.cigarettes_per_day ? ` (${a.cigarettes_per_day} cig./jour)` : ""}`, "Intensité cardio progressive ; encourager l'arrêt du tabac.");
  else if (a.smoker === "occasionnel") add("info", "Fumeur occasionnel", "Encourager l'arrêt du tabac.");
  if (a.alcohol === "regulier") add("orange", "Consommation d'alcool régulière", "Attention à l'hydratation et à la récupération ; pas d'entraînement après consommation.");

  // Douleurs
  if (a.pain_zones.length >= 3) add("orange", `Douleurs sur ${a.pain_zones.length} zones (${a.pain_zones.join(", ")})`, "Faire un bilan postural ; avis kiné si douleurs persistantes.");
  else if (a.pain_zones.length) add("info", `Douleurs : ${a.pain_zones.join(", ")}`, "Éviter les mouvements douloureux, renforcer la zone progressivement.");

  // Corpulence
  const imc = bmi(a.weight_kg, a.height_cm);
  if (imc !== null && imc >= 35) add("orange", `IMC élevé (${imc})`, "Limiter les impacts (sauts, course) au début ; privilégier vélo, rameur, marche.");
  else if (imc !== null && imc >= 30) add("info", `IMC ${imc}`, "Limiter les impacts au début.");

  // Condition physique
  const ri = ruffierIndex(a.ruffier_p0, a.ruffier_p1, a.ruffier_p2);
  if (ri !== null && ri > 15) add("orange", `Indice de Ruffier très faible (${ri})`, "Reprise cardio en douceur, intensité basse.");

  // Sommeil, stress
  if (a.sleep_quality === "mauvaise" || (a.sleep_hours !== null && a.sleep_hours < 6)) {
    const parts = [a.sleep_hours !== null ? `${a.sleep_hours} h` : null, a.sleep_quality === "mauvaise" ? "mauvaise qualité" : null].filter(Boolean);
    add("info", `Sommeil insuffisant${parts.length ? ` (${parts.join(", ")})` : ""}`, "Surveiller la récupération ; éviter les séances intenses tard le soir.");
  }
  if (a.stress !== null && a.stress >= 8) add("info", `Stress élevé (${a.stress}/10)`, "Inclure du retour au calme, de la respiration et de la mobilité.");

  if (age !== null && age >= 65) add("info", `${age} ans`, "Travailler l'équilibre et prévenir les chutes.");

  // Tri : rouge, orange, info
  flags.sort((x, y) => RANK[y.level] - RANK[x.level]);
  const top = flags.reduce<FlagLevel>((m, f) => (RANK[f.level] > RANK[m] ? f.level : m), "info");
  const level: RiskLevel = top === "rouge" ? "rouge" : top === "orange" ? "orange" : "vert";

  const general =
    level === "rouge"
      ? ["Pas d'effort intense tant qu'un médecin n'a pas donné son accord.", "Joindre le certificat médical au dossier (onglet Documents)."]
      : level === "orange"
        ? ["Démarrer à intensité modérée (RPE ≤ 6) et augmenter par paliers.", "Refaire un point santé dans 4 à 6 semaines."]
        : ["Programme standard possible ; progression habituelle."];
  if (!certOk && level !== "vert") general.push("Certificat médical d'aptitude conseillé.");
  const precautions = [...new Set([...flags.filter((f) => f.level !== "info").map((f) => f.precaution), ...general, ...flags.filter((f) => f.level === "info").map((f) => f.precaution)])];
  return { level, flags, precautions };
}

/* ---------- Lecture du formulaire ---------- */

const s = (fd: FormData, k: string) => {
  const v = String(fd.get(k) ?? "").trim();
  return v ? v.slice(0, 2000) : null;
};
const n = (fd: FormData, k: string, min = 0, max = 100000) => {
  const raw = String(fd.get(k) ?? "").trim().replace(",", ".");
  if (!raw) return null;
  const v = Number(raw);
  return Number.isFinite(v) && v >= min && v <= max ? v : null;
};
const yn = (fd: FormData, k: string): YesNo => {
  const v = fd.get(k);
  return v === "oui" ? true : v === "non" ? false : null;
};
function oneOf<T extends string>(fd: FormData, k: string, values: readonly T[]): T | null {
  const v = String(fd.get(k) ?? "");
  return (values as readonly string[]).includes(v) ? (v as T) : null;
}

/** Construit les réponses depuis le formulaire (champs inconnus ignorés, valeurs bornées). */
export function answersFromForm(fd: FormData, opts: { sex?: "H" | "F" | null; withTests?: boolean; withCoach?: boolean } = {}): BilanAnswers {
  const a = emptyAnswers();
  a.height_cm = n(fd, "height_cm", 100, 250);
  a.weight_kg = n(fd, "weight_kg", 25, 350);
  a.profession = oneOf(fd, "profession", ["sedentaire", "debout", "physique"] as const);
  a.profession_label = s(fd, "profession_label");
  a.sport_history = s(fd, "sport_history");
  a.sport_level = oneOf(fd, "sport_level", ["debutant", "intermediaire", "confirme", "ancien_sportif"] as const);
  a.activity_frequency = oneOf(fd, "activity_frequency", ACTIVITY_FREQ);
  a.objectives = fd.getAll("objectives").map(String).filter((o) => OBJECTIVES.includes(o));
  a.objectives_note = s(fd, "objectives_note");
  a.motivation = n(fd, "motivation", 1, 10);
  a.availability = s(fd, "availability");

  a.sleep_hours = n(fd, "sleep_hours", 0, 16);
  a.sleep_quality = oneOf(fd, "sleep_quality", ["bonne", "moyenne", "mauvaise"] as const);
  a.stress = n(fd, "stress", 1, 10);
  a.water_l = n(fd, "water_l", 0, 10);
  a.nutrition_habits = s(fd, "nutrition_habits");

  a.surgery = yn(fd, "surgery");
  if (a.surgery) {
    const what = fd.getAll("surgery_what").map(String);
    const year = fd.getAll("surgery_year").map(String);
    const month = fd.getAll("surgery_month").map(String);
    const thisYear = new Date().getFullYear();
    a.surgeries = what
      .map((w, i) => {
        const y = Number(year[i]);
        const m = Number(month[i]);
        return {
          what: w.trim().slice(0, 200),
          year: Number.isInteger(y) && y >= 1930 && y <= thisYear ? y : null,
          month: Number.isInteger(m) && m >= 1 && m <= 12 ? m : null,
        };
      })
      .filter((x) => x.what || x.year)
      .slice(0, 10);
  }
  a.diabetes = oneOf(fd, "diabetes", ["non", "type1", "type2", "prediabete"] as const);
  a.hypertension = yn(fd, "hypertension");
  a.hypertension_treated = a.hypertension ? yn(fd, "hypertension_treated") : null;
  a.cardiac = yn(fd, "cardiac");
  a.cardiac_details = a.cardiac ? s(fd, "cardiac_details") : null;
  a.respiratory = yn(fd, "respiratory");
  a.cholesterol = yn(fd, "cholesterol");
  a.epilepsy = yn(fd, "epilepsy");
  a.other_conditions = s(fd, "other_conditions");
  a.allergies = s(fd, "allergies");
  a.medications = s(fd, "medications");
  a.pain_zones = [...new Set(fd.getAll("pain_zones").map(String).filter(Boolean))].slice(0, 20);
  a.pain_details = s(fd, "pain_details");
  if (opts.sex !== "H") {
    a.pregnant = yn(fd, "pregnant");
    a.pregnancy_weeks = a.pregnant ? n(fd, "pregnancy_weeks", 1, 42) : null;
  }
  a.smoker = oneOf(fd, "smoker", ["non", "ancien", "occasionnel", "regulier"] as const);
  a.cigarettes_per_day = a.smoker === "regulier" || a.smoker === "occasionnel" ? n(fd, "cigarettes_per_day", 0, 100) : null;
  a.alcohol = oneOf(fd, "alcohol", ["non", "occasionnel", "regulier"] as const);
  a.med_certificate = yn(fd, "med_certificate");
  a.med_certificate_date = a.med_certificate ? s(fd, "med_certificate_date") : null;
  a.parq = PARQ_QUESTIONS.map((_, i) => yn(fd, `parq_${i}`));

  if (opts.withTests !== false) {
    a.resting_hr = n(fd, "resting_hr", 25, 220);
    a.systolic = n(fd, "systolic", 60, 260);
    a.diastolic = n(fd, "diastolic", 30, 160);
    a.waist_cm = n(fd, "waist_cm", 40, 250);
    a.flexibility_cm = n(fd, "flexibility_cm", -50, 60);
    a.pushups = n(fd, "pushups", 0, 300);
    a.plank_s = n(fd, "plank_s", 0, 3600);
    a.ruffier_p0 = n(fd, "ruffier_p0", 25, 250);
    a.ruffier_p1 = n(fd, "ruffier_p1", 25, 250);
    a.ruffier_p2 = n(fd, "ruffier_p2", 25, 250);
  }
  if (opts.withCoach !== false) {
    a.coach_notes = s(fd, "coach_notes");
    a.recommendations = s(fd, "recommendations");
  }
  return a;
}

/** Colonnes indexées (signaux clés) dérivées des réponses : utilisées pour filtrer en base. */
export function keyColumns(a: BilanAnswers, risk: RiskResult, now = new Date()) {
  return {
    risk_level: risk.level,
    risk_flags: risk.flags.map((f) => f.label),
    parq_positive: parqPositive(a),
    surgery: !!a.surgery,
    surgery_recent: !!a.surgery && a.surgeries.some((x) => isRecentSurgery(x, now)),
    diabetes: a.diabetes ?? "non",
    smoker: a.smoker ?? "non",
    alcohol: a.alcohol ?? "non",
    hypertension: !!a.hypertension,
    cardiac: !!a.cardiac,
    pregnant: !!a.pregnant,
  };
}
