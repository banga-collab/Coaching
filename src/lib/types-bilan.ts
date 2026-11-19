/* Types du module « Bilan sportif » (V5) : questionnaire sportif et médical d'entrée. */

export type RiskLevel = "vert" | "orange" | "rouge";
/** valide = saisi ou relu par un coach ; a_valider = rempli par l'adhérent, en attente de relecture */
export type BilanStatus = "valide" | "a_valider";

export type ProfessionType = "sedentaire" | "debout" | "physique";
export type SportLevel = "debutant" | "intermediaire" | "confirme" | "ancien_sportif";
export type SleepQuality = "bonne" | "moyenne" | "mauvaise";
export type DiabetesType = "non" | "type1" | "type2" | "prediabete";
export type SmokerType = "non" | "ancien" | "occasionnel" | "regulier";
export type AlcoholType = "non" | "occasionnel" | "regulier";

/** Oui / non / non renseigné */
export type YesNo = boolean | null;

export interface Surgery {
  what: string;
  year: number | null;
  /** 1-12, facultatif (permet de détecter une opération de moins de 12 mois) */
  month: number | null;
}

/** Réponses complètes (colonne jsonb `answers`). Tous les champs sont facultatifs. */
export interface BilanAnswers {
  /* Profil */
  height_cm: number | null;
  weight_kg: number | null;
  profession: ProfessionType | null;
  profession_label: string | null;
  sport_history: string | null;
  sport_level: SportLevel | null;
  activity_frequency: string | null;
  objectives: string[];
  objectives_note: string | null;
  motivation: number | null;
  availability: string | null;

  /* Sommeil & mode de vie */
  sleep_hours: number | null;
  sleep_quality: SleepQuality | null;
  stress: number | null;
  water_l: number | null;
  nutrition_habits: string | null;

  /* Médical */
  surgery: YesNo;
  surgeries: Surgery[];
  diabetes: DiabetesType | null;
  hypertension: YesNo;
  hypertension_treated: YesNo;
  cardiac: YesNo;
  cardiac_details: string | null;
  respiratory: YesNo;
  cholesterol: YesNo;
  epilepsy: YesNo;
  other_conditions: string | null;
  allergies: string | null;
  medications: string | null;
  pain_zones: string[];
  pain_details: string | null;
  pregnant: YesNo;
  pregnancy_weeks: number | null;
  smoker: SmokerType | null;
  cigarettes_per_day: number | null;
  alcohol: AlcoholType | null;
  med_certificate: YesNo;
  med_certificate_date: string | null;
  /** Les 7 questions du PAR-Q, dans l'ordre de PARQ_QUESTIONS */
  parq: YesNo[];

  /* Tests physiques (facultatifs) */
  resting_hr: number | null;
  systolic: number | null;
  diastolic: number | null;
  waist_cm: number | null;
  flexibility_cm: number | null;
  pushups: number | null;
  plank_s: number | null;
  ruffier_p0: number | null;
  ruffier_p1: number | null;
  ruffier_p2: number | null;

  /* Coach */
  coach_notes: string | null;
  recommendations: string | null;
}

export interface SportAssessment {
  id: string;
  client_id: string;
  created_by: string | null;
  done_on: string;
  status: BilanStatus;
  validated_by: string | null;
  validated_at: string | null;
  risk_level: RiskLevel;
  risk_flags: string[];
  parq_positive: boolean;
  surgery: boolean;
  surgery_recent: boolean;
  diabetes: DiabetesType;
  smoker: SmokerType;
  alcohol: AlcoholType;
  hypertension: boolean;
  cardiac: boolean;
  pregnant: boolean;
  answers: BilanAnswers;
  created_at: string;
  updated_at?: string | null;
}

export type FlagLevel = "info" | "orange" | "rouge";
export interface RiskFlag {
  level: FlagLevel;
  /** Libellé court en français clair */
  label: string;
  /** Précaution conseillée au coach */
  precaution: string;
}
export interface RiskResult {
  level: RiskLevel;
  flags: RiskFlag[];
  precautions: string[];
}
