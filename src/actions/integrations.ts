"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { DEMO } from "@/lib/demo";
import { dayKey } from "@/lib/utils";

export type IntegrationState = { error?: string; ok?: string } | undefined;

/* ---------- Webhook ---------- */
export async function saveWebhook(_s: IntegrationState, formData: FormData): Promise<IntegrationState> {
  await requireAdmin();
  const raw = String(formData.get("webhook_url") ?? "").trim();
  if (raw) {
    try {
      const u = new URL(raw);
      if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error();
    } catch {
      return { error: "Adresse invalide : elle doit commencer par https://" };
    }
  }
  const supabase = await createClient();
  const { error } = await supabase.from("settings").update({ webhook_url: raw || null }).eq("id", 1);
  if (error) return { error: error.message };
  revalidatePath("/integrations");
  return { ok: raw ? "Webhook enregistré." : "Webhook désactivé." };
}

export async function testWebhook(): Promise<IntegrationState> {
  const me = await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase.from("settings").select("*").eq("id", 1).maybeSingle();
  const url = (data as { webhook_url?: string | null } | null)?.webhook_url;
  if (!url) return { error: "Enregistre d'abord une adresse de webhook." };

  const payload = {
    event: "test",
    sent_at: new Date().toISOString(),
    source: "moovup-coach",
    triggered_by: me.full_name || me.email,
    data: { message: "Ceci est un test envoyé depuis Moov'Up Coach.", example_client: { full_name: "Client Exemple", phone: "0600000000", goal: "Perte de poids" } },
  };

  if (DEMO) return { ok: "Mode démo : test simulé avec succès (HTTP 200), aucune requête réseau envoyée." };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": "MoovUp-Coach-Webhook/1.0" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
      cache: "no-store",
    });
    if (!res.ok) return { error: `Le service a répondu HTTP ${res.status} ${res.statusText}`.trim() };
    return { ok: `Test envoyé : réponse HTTP ${res.status}.` };
  } catch (e) {
    const timeout = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
    return { error: timeout ? "Pas de réponse après 10 secondes." : "Impossible de joindre cette adresse." };
  }
}

/* ---------- Calendrier ---------- */
export async function regenerateCalendarToken(): Promise<void> {
  await requireAdmin();
  const supabase = await createClient();
  await supabase.from("settings").update({ calendar_token: randomBytes(12).toString("hex") }).eq("id", 1);
  revalidatePath("/integrations");
}

/* ---------- Import CSV ---------- */
export type ImportRow = { full_name: string; email: string | null; phone: string | null; goal: string | null; birth_date: string | null };
export type ImportResult = { error?: string; imported?: number; skipped?: number };

export async function importClients(rows: ImportRow[]): Promise<ImportResult> {
  const me = await requireAdmin();
  if (!Array.isArray(rows) || rows.length === 0) return { error: "Aucune ligne à importer." };
  if (rows.length > 1000) return { error: "1 000 lignes maximum par import." };

  const clean = (v: unknown, max = 200) => {
    const s = typeof v === "string" ? v.trim().slice(0, max) : "";
    return s || null;
  };
  const today = dayKey(new Date());
  const valid = rows
    .map((r) => ({
      full_name: clean(r.full_name, 120),
      email: clean(r.email)?.toLowerCase() ?? null,
      phone: clean(r.phone, 40),
      goal: clean(r.goal),
      birth_date: clean(r.birth_date, 10),
    }))
    .filter((r) => r.full_name && (!r.email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email)) && (!r.birth_date || /^\d{4}-\d{2}-\d{2}$/.test(r.birth_date)))
    .map((r) => ({ ...r, coach_id: me.id, status: "actif", start_date: today }));

  if (!valid.length) return { error: "Aucune ligne valide (le nom est obligatoire)." };

  const supabase = await createClient();
  const { error } = await supabase.from("clients").insert(valid);
  if (error) return { error: error.message };
  revalidatePath("/clients");
  revalidatePath("/");
  return { imported: valid.length, skipped: rows.length - valid.length };
}
