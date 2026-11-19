/**
 * Données de l'espace admin : statistiques d'activité du personnel (coachs, clients, séances).
 * L'argent (paiements, packs, commissions) est géré par le CRM général, pas ici.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile, Session } from "@/lib/types";

/** Bornes [début, fin[ du mois (décalage en mois par rapport au mois courant), en ISO. */
export function monthRange(offset = 0, now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 1);
  return { start: start.toISOString(), end: end.toISOString(), label: start.toLocaleDateString("fr-FR", { month: "long", year: "numeric" }) };
}

export const STAFF_ROLES = ["admin", "head_coach", "coach"] as const;
export const ROLE_LABEL: Record<string, string> = { admin: "Admin", head_coach: "Head coach", coach: "Coach", client: "Adhérent" };
export const ROLE_TONE: Record<string, "accent" | "brand" | "green" | "gray"> = { admin: "accent", head_coach: "brand", coach: "green", client: "gray" };

/** Profils du personnel + clients par coach + séances réalisées du mois par coach. */
export async function loadStaffStats(supabase: SupabaseClient) {
  const month = monthRange(0);
  const [{ data: pData }, { data: cData }, { data: sData }] = await Promise.all([
    supabase.from("profiles").select("*").in("role", [...STAFF_ROLES]).order("created_at"),
    supabase.from("clients").select("id, coach_id, status"),
    supabase.from("sessions").select("id, coach_id, status, starts_at").gte("starts_at", month.start).lt("starts_at", month.end),
  ]);
  const staff = (pData ?? []) as Profile[];
  const clients = (cData ?? []) as { id: string; coach_id: string; status: string }[];
  const sessions = (sData ?? []) as Pick<Session, "id" | "coach_id" | "status" | "starts_at">[];
  const clientsOf = (id: string) => clients.filter((c) => c.coach_id === id && c.status !== "termine").length;
  const doneOf = (id: string) => sessions.filter((s) => s.coach_id === id && s.status === "realisee").length;
  return { staff, clients, sessions, clientsOf, doneOf, month };
}
