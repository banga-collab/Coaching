/**
 * Passation d'un coach qui quitte l'équipe (désactivation ou retour au rôle adhérent) :
 * ses clients actifs et ses séances à venir doivent être transférés à un autre coach actif.
 * Module serveur sans "use server" (fonctions internes, pas des actions appelables depuis le navigateur).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Session } from "@/lib/types";

/** Statuts d'une séance à venir qui occupe encore le coach */
export const UPCOMING_STATUSES = ["planifiee", "acceptee", "reportee"] as const;

export type HandoverClient = { id: string; full_name: string; status: string };
export type HandoverSession = Pick<Session, "id" | "client_id" | "starts_at" | "status" | "duration_min" | "type">;
export type Handover = { clients: HandoverClient[]; sessions: HandoverSession[]; clientNames: Map<string, string> };

/** Clients non archivés suivis par le coach + séances à venir qui lui sont affectées. */
export async function loadHandover(supabase: SupabaseClient, coachId: string, nowIso = new Date().toISOString()): Promise<Handover> {
  const [{ data: cData }, { data: sData }] = await Promise.all([
    supabase.from("clients").select("id, full_name, status").eq("coach_id", coachId).neq("status", "termine").order("full_name"),
    supabase
      .from("sessions")
      .select("id, client_id, starts_at, status, duration_min, type")
      .eq("coach_id", coachId)
      .in("status", [...UPCOMING_STATUSES])
      .gte("starts_at", nowIso)
      .order("starts_at"),
  ]);
  const clients = (cData ?? []) as HandoverClient[];
  const sessions = (sData ?? []) as HandoverSession[];
  const clientNames = new Map(clients.map((c) => [c.id, c.full_name]));
  const missing = [...new Set(sessions.map((s) => s.client_id))].filter((id) => !clientNames.has(id));
  if (missing.length) {
    const { data } = await supabase.from("clients").select("id, full_name").in("id", missing);
    for (const c of (data ?? []) as { id: string; full_name: string }[]) clientNames.set(c.id, c.full_name);
  }
  return { clients, sessions, clientNames };
}

export const handoverCount = (h: Pick<Handover, "clients" | "sessions">) => h.clients.length + h.sessions.length;

export function handoverSummary(h: Pick<Handover, "clients" | "sessions">) {
  const parts = [
    h.clients.length ? `${h.clients.length} client${h.clients.length > 1 ? "s" : ""} actif${h.clients.length > 1 ? "s" : ""}` : "",
    h.sessions.length ? `${h.sessions.length} séance${h.sessions.length > 1 ? "s" : ""} à venir` : "",
  ].filter(Boolean);
  return parts.join(" et ");
}
