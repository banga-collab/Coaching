/**
 * Santé connectée : données venant des montres / téléphones (Apple Santé, Health Connect,
 * Samsung Health) ou saisies à la main. Une ligne = une valeur agrégée par jour.
 */

export const HEALTH_METRICS = ["sleep", "steps", "hr_resting", "hr_avg", "active_kcal", "vo2max", "weight"] as const;
export type HealthMetric = (typeof HEALTH_METRICS)[number];

export const HEALTH_SOURCES = ["apple_health", "health_connect", "samsung_health", "manuel"] as const;
export type HealthSource = (typeof HEALTH_SOURCES)[number];

/** Phases de sommeil et heures (en minutes / "HH:MM"), quand la montre les fournit. */
export type SleepDetails = {
  deep?: number;
  light?: number;
  rem?: number;
  awake?: number;
  in_bed?: number;
  bed?: string;
  wake?: string;
};
export type HealthDetails = SleepDetails & { min?: number; max?: number; device?: string };

export interface HealthSample {
  id: string;
  client_id: string;
  day: string; // AAAA-MM-JJ (jour local ; pour le sommeil : jour du réveil)
  metric: HealthMetric;
  value: number;
  unit: string;
  source: HealthSource;
  details: HealthDetails | null;
  created_by: string | null;
  created_at: string;
  updated_at?: string | null;
}

/** Valeur journalière prête à envoyer (import fichier, saisie, API mobile). */
export type DailyInput = { day: string; metric: HealthMetric; value: number; details?: HealthDetails | null };

export const METRIC_META: Record<HealthMetric, { label: string; unit: string; min: number; max: number }> = {
  sleep: { label: "Sommeil", unit: "min", min: 30, max: 960 },
  steps: { label: "Pas", unit: "pas", min: 0, max: 100000 },
  hr_resting: { label: "FC au repos", unit: "bpm", min: 25, max: 140 },
  hr_avg: { label: "FC moyenne", unit: "bpm", min: 30, max: 200 },
  active_kcal: { label: "Calories actives", unit: "kcal", min: 0, max: 8000 },
  vo2max: { label: "VO2max", unit: "mL/kg/min", min: 10, max: 95 },
  weight: { label: "Poids", unit: "kg", min: 20, max: 350 },
};

export const SOURCE_LABEL: Record<HealthSource, string> = {
  apple_health: "Apple Santé",
  health_connect: "Health Connect",
  samsung_health: "Samsung Health",
  manuel: "Saisie manuelle",
};

/** Ordre de préférence quand plusieurs sources donnent une valeur le même jour. */
export const SOURCE_PRIORITY: HealthSource[] = ["manuel", "apple_health", "health_connect", "samsung_health"];

export const isMetric = (v: unknown): v is HealthMetric => typeof v === "string" && (HEALTH_METRICS as readonly string[]).includes(v);
export const isSource = (v: unknown): v is HealthSource => typeof v === "string" && (HEALTH_SOURCES as readonly string[]).includes(v);

/** 452 → "7 h 32" */
export function fmtSleep(min: number | null | undefined) {
  if (min === null || min === undefined || !Number.isFinite(min)) return "–";
  const m = Math.round(min);
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}`;
}
