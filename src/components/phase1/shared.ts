import type { AssessmentField, FieldType, Goal, GoalMetric, Measurement } from "@/lib/types";
import { num } from "@/lib/utils";

/* ---------- Évaluations ---------- */
export const FIELD_TYPE_LABEL: Record<FieldType, string> = {
  number: "Nombre",
  scale: "Échelle 1-10",
  text: "Texte libre",
  choice: "Choix",
  yesno: "Oui / Non",
};

export const TEMPLATE_CATEGORIES = ["Performance", "Posture", "Mobilité", "Nutrition", "Santé", "Composition", "Mental", "Autre"];

export type Answer = string | number | boolean | null | undefined;

export function formatAnswer(f: AssessmentField, v: Answer): string {
  if (v === null || v === undefined || v === "") return "—";
  if (f.type === "number") return num(Number(v), f.unit ?? "");
  if (f.type === "scale") return `${v}/10`;
  if (f.type === "yesno") return v === true ? "Oui" : v === false ? "Non" : String(v);
  return String(v);
}

export const isNumericField = (f: AssessmentField) => f.type === "number" || f.type === "scale";

/* ---------- Objectifs ---------- */
export const METRIC_META: Record<GoalMetric, { label: string; unit: string }> = {
  weight_kg: { label: "Poids", unit: "kg" },
  body_fat: { label: "Masse grasse", unit: "%" },
  waist_cm: { label: "Tour de taille", unit: "cm" },
  squat_kg: { label: "Squat (1RM)", unit: "kg" },
  bench_kg: { label: "Développé couché (1RM)", unit: "kg" },
  deadlift_kg: { label: "Soulevé de terre (1RM)", unit: "kg" },
  sessions: { label: "Séances réalisées", unit: "séances" },
  custom: { label: "Personnalisé", unit: "" },
};

export const MEASURE_METRICS = ["weight_kg", "body_fat", "waist_cm", "squat_kg", "bench_kg", "deadlift_kg"] as const;
export type MeasureMetric = (typeof MEASURE_METRICS)[number];

export function latestMeasure(rows: Measurement[], key: MeasureMetric): { value: number; on: string } | null {
  for (let i = rows.length - 1; i >= 0; i--) {
    const v = rows[i]![key];
    if (v !== null && v !== undefined) return { value: Number(v), on: rows[i]!.measured_on };
  }
  return null;
}

export type GoalProgress = {
  start: number | null;
  current: number | null;
  target: number | null;
  pct: number; // 0..100
  reached: boolean;
  decreasing: boolean;
  remaining: number | null;
  currentOn: string | null;
};

/** Calcule la progression d'un objectif (gère les objectifs à la baisse). */
export function goalProgress(g: Goal, meas: Measurement[], doneSessions: string[]): GoalProgress {
  let current: number | null = null;
  let currentOn: string | null = null;
  let start = g.start_value === null ? null : Number(g.start_value);
  if (g.metric === "custom") current = g.current_value === null ? null : Number(g.current_value);
  else if (g.metric === "sessions") {
    const since = new Date(g.created_at).getTime();
    current = (start ?? 0) + doneSessions.filter((s) => new Date(s).getTime() >= since).length;
    start ??= 0;
  } else {
    const l = latestMeasure(meas, g.metric);
    if (l) {
      current = l.value;
      currentOn = l.on;
    }
    if (start === null) {
      const first = meas.find((m) => m[g.metric as MeasureMetric] !== null);
      start = first ? Number(first[g.metric as MeasureMetric]) : null;
    }
  }
  const target = g.target_value === null ? null : Number(g.target_value);
  const decreasing = start !== null && target !== null && target < start;
  let pct = 0;
  let reached = false;
  let remaining: number | null = null;
  if (target !== null && current !== null) {
    reached = decreasing ? current <= target : current >= target;
    remaining = Math.abs(target - current);
    if (start !== null && start !== target) pct = ((current - start) / (target - start)) * 100;
    else pct = reached ? 100 : 0;
  }
  pct = Math.max(0, Math.min(100, Math.round(pct)));
  if (reached) pct = 100;
  return { start, current, target, pct, reached, decreasing, remaining: reached ? 0 : remaining, currentOn };
}

export function daysUntil(date: string) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Casablanca" }).format(new Date());
  return Math.round((Date.parse(date) - Date.parse(today)) / 86_400_000);
}

/* ---------- Documents ---------- */
export const DOC_CATEGORIES = ["Certificat médical", "Bilan", "Programme", "Nutrition", "Contrat", "Photo", "Autre"];

export function fmtSize(bytes: number | null) {
  if (bytes === null || bytes === undefined) return "—";
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(bytes / 1024 / 1024)} Mo`;
}

export type DocKind = "pdf" | "image" | "sheet" | "video" | "doc" | "other";
export function docKind(mime: string | null, name: string): DocKind {
  const m = (mime ?? "").toLowerCase();
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (m === "application/pdf" || ext === "pdf") return "pdf";
  if (m.startsWith("image/") || ["jpg", "jpeg", "png", "webp", "heic", "gif"].includes(ext)) return "image";
  if (m.startsWith("video/") || ["mp4", "mov", "webm"].includes(ext)) return "video";
  if (m.includes("sheet") || m.includes("excel") || m === "text/csv" || ["xls", "xlsx", "csv"].includes(ext)) return "sheet";
  if (m.includes("word") || m.startsWith("text/") || ["doc", "docx", "txt", "odt"].includes(ext)) return "doc";
  return "other";
}
