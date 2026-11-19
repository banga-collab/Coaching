"use server";

import { getProfile, isManager, isStaffRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type ClientPick = { id: string; name: string };

/**
 * Liste courte des clients pour le bouton « + » (choix du client d'un bilan sportif) et la recherche Ctrl+K.
 * Coach : ses clients ; admin / head coach : tous. Les clients archivés sont exclus.
 */
export async function quickClientsAction(): Promise<ClientPick[]> {
  const me = await getProfile();
  if (!isStaffRole(me.role)) return [];
  const supabase = await createClient();
  let q = supabase.from("clients").select("id, full_name, status, coach_id").order("full_name").limit(1000);
  if (!isManager(me.role)) q = q.eq("coach_id", me.id);
  const { data } = await q;
  return ((data ?? []) as { id: string; full_name: string; status: string }[]).filter((c) => c.status !== "termine").map((c) => ({ id: c.id, name: c.full_name }));
}
