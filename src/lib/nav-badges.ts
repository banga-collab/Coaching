import { cache } from "react";
import { createClient } from "./supabase/server";
import { isManager } from "./auth";
import type { Role } from "./types";

/**
 * Pastilles du menu (clé = href) : messages non lus, tâches dues, séances à confirmer,
 * demandes de réservation. Mis en cache par requête (layout, page « Plus », onglets de l'agenda).
 */
export const loadNavBadges = cache(async (userId: string, role: Role): Promise<Record<string, number>> => {
  const profile = { id: userId, role };
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const badges: Record<string, number> = {};
  if (profile.role === "client") {
    const { data: me } = await supabase.from("clients").select("id").eq("user_id", profile.id).maybeSingle();
    if (me) {
      const { count } = await supabase.from("messages").select("id", { count: "exact", head: true }).eq("client_id", me.id).eq("from_client", false).is("read_at", null);
      badges["/moi/messages"] = count ?? 0;
    }
    return badges;
  }
  const nowIso = new Date().toISOString();
  const [{ count: unread }, { count: due }, { count: toConfirm }, { count: requests }, { count: toHandle }] = await Promise.all([
    supabase.from("messages").select("id", { count: "exact", head: true }).eq("from_client", true).is("read_at", null),
    supabase.from("tasks").select("id", { count: "exact", head: true }).eq("done", false).eq("assigned_to", profile.id).lte("due_date", today),
    // Séances qu'on m'a affectées et qui attendent ma réponse
    supabase.from("sessions").select("id", { count: "exact", head: true }).eq("coach_id", profile.id).eq("status", "planifiee").gte("starts_at", nowIso),
    supabase.from("booking_requests").select("id", { count: "exact", head: true }).eq("status", "nouvelle"),
    // Refus et reports à traiter (managers)
    isManager(profile.role)
      ? supabase.from("sessions").select("id", { count: "exact", head: true }).in("status", ["refusee", "reportee"]).gte("starts_at", nowIso)
      : Promise.resolve({ count: 0 }),
  ]);
  badges["/messages"] = unread ?? 0;
  badges["/taches"] = due ?? 0;
  badges["/seances"] = toConfirm ?? 0;
  badges["/reservations"] = requests ?? 0;
  if (isManager(profile.role)) {
    badges["/planning"] = toHandle ?? 0;
    // Réclamations de coach pas encore prises en charge
    const { count: complaints } = await supabase.from("reclamations").select("id", { count: "exact", head: true }).eq("source", "coach").eq("status", "nouvelle");
    badges["/reclamations"] = complaints ?? 0;
  }
  return badges;
});
