import type { SessionStatus } from "@/lib/types";

/** Couleurs des blocs de séance par statut (planning, liste des séances) */
export const SESSION_TONE: Record<SessionStatus, string> = {
  planifiee: "bg-amber-50 border-amber-400 text-amber-800",
  acceptee: "bg-brand-50 border-brand-500 text-brand-800",
  refusee: "bg-red-50 border-red-300 text-red-700 line-through",
  reportee: "bg-violet-50 border-violet-400 text-violet-800",
  en_cours: "bg-orange-50 border-orange-500 text-orange-800",
  realisee: "bg-emerald-50 border-emerald-500 text-emerald-800",
  absent: "bg-red-50 border-red-400 text-red-800",
  annulee: "bg-slate-50 border-slate-300 text-slate-500 line-through",
};

/** Teinte de badge par statut */
export const SESSION_BADGE: Record<SessionStatus, "brand" | "accent" | "green" | "amber" | "red" | "gray"> = {
  planifiee: "amber",
  acceptee: "brand",
  refusee: "red",
  reportee: "amber",
  en_cours: "accent",
  realisee: "green",
  absent: "red",
  annulee: "gray",
};

/** Petite pastille de légende */
export const SESSION_DOT: Record<SessionStatus, string> = {
  planifiee: "bg-amber-400",
  acceptee: "bg-brand-500",
  refusee: "bg-red-300",
  reportee: "bg-violet-400",
  en_cours: "bg-orange-500",
  realisee: "bg-emerald-500",
  absent: "bg-red-400",
  annulee: "bg-slate-300",
};
