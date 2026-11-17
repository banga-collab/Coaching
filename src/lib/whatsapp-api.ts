import type { SupabaseClient } from "@supabase/supabase-js";
import { DEMO } from "./demo";
import { createClient } from "./supabase/server";
import { waNumber } from "./whatsapp";
import { WA_CATALOG, isWaTemplate } from "@/components/whatsapp/templates";
import type { WhatsAppMessage } from "./types";

/**
 * Envoi de messages via l'API WhatsApp Business Cloud (Meta).
 *
 * - Variables (serveur uniquement, jamais exposées au navigateur) :
 *   WHATSAPP_TOKEN (jeton d'accès permanent d'un utilisateur système), WHATSAPP_PHONE_ID (Phone number ID),
 *   WHATSAPP_TEMPLATE_* (optionnel : nom d'un modèle approuvé), WHATSAPP_TEMPLATE_LANG (défaut "fr").
 * - Hors de la fenêtre de 24 h (le membre ne vous a pas écrit récemment), Meta REFUSE les messages texte libres :
 *   seuls les modèles approuvés dans le WhatsApp Manager sont acceptés. Pour les rappels automatiques, renseignez donc
 *   WHATSAPP_TEMPLATE_<NOM> : le message part alors en modèle, avec les variables passées en paramètres {{1}}, {{2}}…
 * - Sans configuration (ou en mode démo, ou si WhatsApp est désactivé dans les paramètres), le message est
 *   enregistré avec le statut « simule » : rien n'est envoyé.
 */

const GRAPH_URL = "https://graph.facebook.com/v21.0";

export type WaEnvStatus = {
  token: boolean;
  phoneId: boolean;
  templates: { key: string; label: string; envName: string; set: boolean }[];
};

export function whatsappEnv(): WaEnvStatus {
  return {
    token: !!process.env.WHATSAPP_TOKEN,
    phoneId: !!process.env.WHATSAPP_PHONE_ID,
    templates: Object.values(WA_CATALOG)
      .filter((t) => t.envName)
      .map((t) => ({ key: t.key, label: t.label, envName: t.envName!, set: !!process.env[t.envName!] })),
  };
}

export type WaMode = { live: boolean; missing: string[] };

/** "live" si tout est réuni pour un envoi réel, sinon liste de ce qui manque. */
export function whatsappMode(enabled: boolean | undefined): WaMode {
  const env = whatsappEnv();
  const missing: string[] = [];
  if (DEMO) missing.push("Mode démo actif (aucun envoi réel)");
  if (!env.token) missing.push("Variable WHATSAPP_TOKEN");
  if (!env.phoneId) missing.push("Variable WHATSAPP_PHONE_ID");
  if (!enabled) missing.push("WhatsApp désactivé dans Paramètres");
  return { live: missing.length === 0, missing };
}

export type SendWhatsAppInput = {
  to: string | null | undefined;
  body: string;
  template: string;
  clientId?: string | null;
  /** Paramètres du modèle Meta ({{1}}, {{2}}…), utilisés seulement si WHATSAPP_TEMPLATE_* est défini. */
  params?: string[];
};

export type SendWhatsAppResult = { ok: boolean; status: WhatsAppMessage["status"]; error: string | null; id: string | null };

async function readEnabled(db: SupabaseClient) {
  try {
    const { data } = await db.from("settings").select("*").eq("id", 1).maybeSingle();
    return !!(data as { whatsapp_enabled?: boolean } | null)?.whatsapp_enabled;
  } catch {
    return false;
  }
}

/**
 * Envoie (ou simule) un message WhatsApp et l'enregistre TOUJOURS dans `whatsapp_messages`.
 * `db` : client Supabase à utiliser (service-role pour le cron) ; par défaut, celui de l'utilisateur.
 */
export async function sendWhatsApp(input: SendWhatsAppInput, db?: SupabaseClient): Promise<SendWhatsAppResult> {
  const supabase = db ?? (await createClient());
  const body = input.body.trim().slice(0, 4096);
  const template = input.template || "manuel";
  const to = waNumber(input.to);
  const now = new Date().toISOString();

  let status: WhatsAppMessage["status"] = "simule";
  let error: string | null = null;
  let providerId: string | null = null;

  if (!to) {
    status = "echec";
    error = "Numéro de téléphone manquant ou invalide.";
  } else if (!body) {
    status = "echec";
    error = "Message vide.";
  } else {
    const mode = whatsappMode(await readEnabled(supabase));
    if (mode.live) {
      const tplEnv = isWaTemplate(template) ? WA_CATALOG[template].envName : null;
      const tplName = tplEnv ? process.env[tplEnv] : undefined;
      const payload = tplName
        ? {
            messaging_product: "whatsapp",
            to,
            type: "template",
            template: {
              name: tplName,
              language: { code: process.env.WHATSAPP_TEMPLATE_LANG || "fr" },
              ...(input.params?.length
                ? { components: [{ type: "body", parameters: input.params.map((text) => ({ type: "text", text: String(text).slice(0, 1000) })) }] }
                : {}),
            },
          }
        : { messaging_product: "whatsapp", recipient_type: "individual", to, type: "text", text: { preview_url: false, body } };
      try {
        const res = await fetch(`${GRAPH_URL}/${encodeURIComponent(process.env.WHATSAPP_PHONE_ID!)}/messages`, {
          method: "POST",
          headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(10_000),
          cache: "no-store",
        });
        const json = (await res.json().catch(() => null)) as { messages?: { id: string }[]; error?: { message?: string; code?: number } } | null;
        if (res.ok && json?.messages?.[0]?.id) {
          status = "envoye";
          providerId = json.messages[0].id;
        } else {
          status = "echec";
          const code = json?.error?.code ? ` (code ${json.error.code})` : "";
          error = `${json?.error?.message ?? `Erreur HTTP ${res.status}`}${code}`.slice(0, 500);
        }
      } catch (e) {
        status = "echec";
        error = e instanceof Error && e.name === "TimeoutError" ? "Délai dépassé en contactant WhatsApp." : "Impossible de joindre l'API WhatsApp.";
      }
    }
  }

  await supabase.from("whatsapp_messages").insert({
    client_id: input.clientId ?? null,
    to_phone: to ?? String(input.to ?? "").slice(0, 40),
    template,
    body: body || "(vide)",
    status,
    error,
    provider_id: providerId,
    sent_at: status === "envoye" || status === "simule" ? now : null,
  });

  return { ok: status === "envoye" || status === "simule", status, error, id: providerId };
}
