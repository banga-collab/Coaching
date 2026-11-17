import type { ClassBooking, GroupClass } from "@/lib/types";
import { agadirToIso, dayKey } from "@/lib/utils";

export interface CategoryStyle {
  hex: string;
  soft: string; // fond clair + texte
  border: string; // bordure gauche de carte
  dot: string;
  emoji: string;
}

export const CATEGORIES: Record<string, CategoryStyle> = {
  CrossFit: { hex: "#e11d48", soft: "bg-rose-50 text-rose-700", border: "border-l-rose-500", dot: "bg-rose-500", emoji: "🏋️" },
  HIIT: { hex: "#ea580c", soft: "bg-orange-50 text-orange-700", border: "border-l-orange-500", dot: "bg-orange-500", emoji: "⚡" },
  Yoga: { hex: "#7c3aed", soft: "bg-violet-50 text-violet-700", border: "border-l-violet-500", dot: "bg-violet-500", emoji: "🧘" },
  Pilates: { hex: "#c026d3", soft: "bg-fuchsia-50 text-fuchsia-700", border: "border-l-fuchsia-500", dot: "bg-fuchsia-500", emoji: "🤸" },
  Cardio: { hex: "#0284c7", soft: "bg-sky-50 text-sky-700", border: "border-l-sky-500", dot: "bg-sky-500", emoji: "🏃" },
  Renforcement: { hex: "#059669", soft: "bg-emerald-50 text-emerald-700", border: "border-l-emerald-500", dot: "bg-emerald-500", emoji: "💪" },
};
const FALLBACK: CategoryStyle = { hex: "#475569", soft: "bg-slate-100 text-slate-700", border: "border-l-slate-400", dot: "bg-slate-500", emoji: "🎯" };

export const CATEGORY_NAMES = Object.keys(CATEGORIES);
export const LEVELS = ["Tous niveaux", "Débutant", "Intermédiaire", "Avancé"];
export const ROOMS = ["Box", "Studio 1", "Studio 2", "Plage d'Agadir"];

export function cat(name: string | null | undefined): CategoryStyle {
  return (name && CATEGORIES[name]) || FALLBACK;
}

export const BOOKING_LABEL: Record<ClassBooking["status"], { label: string; tone: "brand" | "green" | "amber" | "red" | "gray" }> = {
  inscrit: { label: "Inscrit", tone: "brand" },
  present: { label: "Présent", tone: "green" },
  absent: { label: "Absent", tone: "red" },
  attente: { label: "Liste d'attente", tone: "amber" },
  annule: { label: "Annulé", tone: "gray" },
};

export interface ClassStats {
  taken: number;
  waiting: number;
}

export function classStats(bookings: ClassBooking[], classId: string): ClassStats {
  let taken = 0;
  let waiting = 0;
  for (const b of bookings) {
    if (b.class_id !== classId) continue;
    if (b.status === "inscrit" || b.status === "present") taken++;
    else if (b.status === "attente") waiting++;
  }
  return { taken, waiting };
}

/* ---------- Dates (clés AAAA-MM-JJ, fuseau d'Agadir) ---------- */
export function addDayKey(key: string, n: number) {
  const d = new Date(`${key}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function weekdayIndex(key: string) {
  return (new Date(`${key}T12:00:00Z`).getUTCDay() + 6) % 7; // lundi = 0
}
export function mondayOf(key: string) {
  return addDayKey(key, -weekdayIndex(key));
}
export function isDayKey(v: string | undefined | null): v is string {
  return !!v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
}
/** Bornes ISO [début, fin[ d'une plage de jours à Agadir */
export function rangeIso(fromKey: string, days: number) {
  return { from: agadirToIso(fromKey, "00:00"), to: agadirToIso(addDayKey(fromKey, days), "00:00") };
}
export function classDay(c: GroupClass) {
  return dayKey(c.starts_at);
}
