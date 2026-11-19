"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import type { Client } from "@/lib/types";

/** Lien interne uniquement (évite les redirections ouvertes). */
function safeLink(v: string | null | undefined) {
  return v && v.startsWith("/") && !v.startsWith("//") ? v : null;
}

/* ================= Messages ================= */
export async function sendMessageAction(fd: FormData) {
  const me = await getProfile();
  const client_id = String(fd.get("client_id") ?? "");
  const body = String(fd.get("body") ?? "").trim().slice(0, 4000);
  if (!client_id || !body) return;
  const supabase = await createClient();
  const { data: cData } = await supabase.from("clients").select("*").eq("id", client_id).maybeSingle();
  const client = cData as Client | null;
  if (!client) return;

  const preview = body.length > 90 ? `${body.slice(0, 90)}…` : body;
  if (me.role === "client") {
    if (client.user_id !== me.id) return;
    const { error } = await supabase.from("messages").insert({ client_id, sender_id: me.id, from_client: true, body });
    if (error) return;
    // Peut être refusé par la RLS en production (insertion pour un autre utilisateur) : on ignore l'erreur.
    await supabase.from("notifications").insert({
      user_id: client.coach_id,
      title: `Nouveau message de ${client.full_name}`,
      body: preview,
      link: `/messages?client=${client_id}`,
      kind: "message",
      read: false,
    });
    revalidatePath("/moi/messages");
  } else {
    const { error } = await supabase.from("messages").insert({ client_id, sender_id: me.id, from_client: false, body });
    if (error) return;
    if (client.user_id) {
      await supabase.from("notifications").insert({
        user_id: client.user_id,
        title: "Nouveau message de ton coach",
        body: preview,
        link: "/moi/messages",
        kind: "message",
        read: false,
      });
    }
    revalidatePath("/messages");
  }
  revalidatePath("/", "layout");
}

/* ================= Notifications ================= */
export async function openNotificationAction(fd: FormData) {
  const me = await getProfile();
  const id = String(fd.get("id") ?? "");
  const supabase = await createClient();
  const { data } = await supabase.from("notifications").select("*").eq("id", id).eq("user_id", me.id).maybeSingle();
  if (data) await supabase.from("notifications").update({ read: true }).eq("id", id).eq("user_id", me.id);
  revalidatePath("/", "layout");
  redirect(safeLink((data as { link: string | null } | null)?.link) ?? "/notifications");
}

export async function markAllNotificationsReadAction() {
  const me = await getProfile();
  const supabase = await createClient();
  await supabase.from("notifications").update({ read: true }).eq("user_id", me.id).eq("read", false);
  revalidatePath("/", "layout");
}
