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
  return data as Profile;
});

export async function requireStaff() {
  const p = await getProfile();
  if (p.role === "client") redirect("/moi");
  return p;
}

export async function requireAdmin() {
  const p = await getProfile();
  if (p.role !== "admin") redirect("/");
  return p;
}
