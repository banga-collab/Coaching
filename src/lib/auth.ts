import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "./supabase/server";
import type { Profile } from "./types";

/** Profil de l'utilisateur connecté (mis en cache par requête). */
export const getProfile = cache(async (): Promise<Profile> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (!data) redirect("/login");
  // Coach désactivé dans l'Espace admin : plus d'accès
  if ((data as Profile).active === false && (data as Profile).role !== "client") redirect("/login?desactive=1");
  return data as Profile;
});

export async function requireStaff() {
  const p = await getProfile();
  if (p.role === "client") redirect("/moi");
  return p;
}

/** Admin ou head coach : peuvent affecter les séances à n'importe quel coach. */
export const isManager = (role: string | null | undefined) => role === "admin" || role === "head_coach";
/** Personnel (tout sauf adhérent) */
export const isStaffRole = (role: string | null | undefined) => role === "admin" || role === "head_coach" || role === "coach";

/** Personnel actif (compte non désactivé) */
export const isActiveStaff = (p: Pick<Profile, "role" | "active"> | null | undefined) => !!p && isStaffRole(p.role) && p.active !== false;

type Db = Awaited<ReturnType<typeof createClient>>;

/**
 * Vérifie qu'un profil peut être coach référent d'un client ou animer une séance :
 * admin, head coach ou coach, et compte actif. Renvoie un message d'erreur, ou null si c'est valide.
 * (En production, le déclencheur de supabase/v5-securite.sql applique la même règle.)
 */
export async function checkActiveCoach(supabase: Db, coachId: string | null | undefined): Promise<string | null> {
  if (!coachId) return "Choisis un coach.";
  const { data } = await supabase.from("profiles").select("id, role, active").eq("id", coachId).maybeSingle();
  const p = data as Pick<Profile, "id" | "role" | "active"> | null;
  if (!p) return "Coach introuvable.";
  if (!isActiveStaff(p)) return "Ce compte n'est pas un coach actif de l'équipe.";
  return null;
}

/** Personnel actif (admin, head coach, coach) pour les listes « Coach référent ». */
export async function listActiveCoaches(supabase: Db) {
  const { data } = await supabase.from("profiles").select("id, full_name, email, role, active").in("role", ["admin", "head_coach", "coach"]).order("full_name");
  return ((data ?? []) as Pick<Profile, "id" | "full_name" | "email" | "role" | "active">[]).filter((p) => p.active !== false);
}

/**
 * Droit de gérer un dossier client (modifier, archiver, bilans…) : son coach référent, ou un manager
 * (admin / head coach). Renvoie le client, ou null si introuvable / non autorisé.
 */
export async function loadManagedClient(supabase: Db, me: Profile, clientId: string | null | undefined) {
  if (!clientId || !isActiveStaff(me)) return null;
  const { data } = await supabase.from("clients").select("id, coach_id, user_id, status, full_name").eq("id", clientId).maybeSingle();
  const c = data as { id: string; coach_id: string; user_id: string | null; status: string; full_name: string } | null;
  if (!c) return null;
  return isManager(me.role) || c.coach_id === me.id ? c : null;
}

export async function requireManager() {
  const p = await getProfile();
  if (!isManager(p.role)) redirect("/");
  return p;
}

export async function requireAdmin() {
  const p = await getProfile();
  if (p.role !== "admin") redirect("/");
  return p;
}
