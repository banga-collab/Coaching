"use server";

import { revalidatePath } from "next/cache";
import { getProfile, isManager } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { sendWhatsApp } from "@/lib/whatsapp-api";
import { isWaTemplate } from "@/components/whatsapp/templates";
import type { Client, WhatsAppMessage } from "@/lib/types";

export type WaSendState = { error?: string; ok?: number; status?: WhatsAppMessage["status"]; detail?: string | null } | undefined;

/** Formulaire « Envoyer un message » de /whatsapp. */
export async function sendWhatsAppAction(_: WaSendState, fd: FormData): Promise<WaSendState> {
  const me = await getProfile();
  if (!isManager(me.role)) return { error: "Accès refusé." };
  const clientId = String(fd.get("client_id") ?? "");
  const template = String(fd.get("template") ?? "manuel");
  const body = String(fd.get("body") ?? "").trim();
  if (!clientId) return { error: "Choisissez un client." };
  if (!isWaTemplate(template)) return { error: "Modèle inconnu." };
  if (body.length < 2) return { error: "Le message est vide." };
  if (body.length > 4096) return { error: "Message trop long (4 096 caractères maximum)." };

  const supabase = await createClient();
  const { data } = await supabase.from("clients").select("*").eq("id", clientId).maybeSingle();
  const client = data as Client | null;
  if (!client) return { error: "Client introuvable." };
  if (!client.phone) return { error: `${client.full_name} n'a pas de numéro de téléphone sur sa fiche.` };

  // Envoi manuel : texte libre (le coach a rédigé le message). Hors fenêtre 24 h, Meta peut le refuser.
  const res = await sendWhatsApp({ to: client.phone, body, template, clientId: client.id }, supabase);
  revalidatePath("/whatsapp");
  if (res.status === "echec") return { error: `Échec de l'envoi : ${res.error ?? "erreur inconnue"}`, status: res.status };
  return { ok: Date.now(), status: res.status, detail: res.status === "simule" ? "Message enregistré en simulation (aucun envoi réel)." : "Message envoyé sur WhatsApp." };
}

/** Paramètres : activer / désactiver l'envoi WhatsApp. */
export async function saveWhatsAppSettingsAction(fd: FormData) {
  const me = await getProfile();
  if (me.role !== "admin") return;
  const enabled = fd.get("whatsapp_enabled") === "1";
  const supabase = await createClient();
  await supabase.from("settings").update({ whatsapp_enabled: enabled }).eq("id", 1);
  revalidatePath("/parametres");
  revalidatePath("/whatsapp");
}
