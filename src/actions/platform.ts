"use server";

import { revalidatePath } from "next/cache";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings";
import { DEMO } from "@/lib/demo";
import { waNumber } from "@/lib/whatsapp";
import { str } from "@/lib/utils";
import type { BookingRequest, Client } from "@/lib/types";
import { askAboutClient, draftMessage, suggestAdjustments, summarizeClient, type ChatTurn, type DraftIntent } from "@/lib/ai";
import { buildDays } from "@/components/platform/slots";
import { isHex } from "@/components/platform/colors";
import type { BookingState, SettingsState } from "@/components/platform/types";

async function staffOnly() {
  const me = await getProfile();
  if (me.role === "client") throw new Error("Accès refusé.");
  return me;
}

/* ===================== Assistant IA ===================== */
export async function aiSummaryAction(clientId: string) {
  await staffOnly();
  return summarizeClient(clientId);
}

export async function aiAdjustAction(clientId: string) {
  await staffOnly();
  return suggestAdjustments(clientId);
}

const INTENTS: DraftIntent[] = ["motivation", "rappel", "felicitations", "relance"];
export async function aiDraftAction(clientId: string, intent: DraftIntent) {
  await staffOnly();
  return draftMessage(clientId, INTENTS.includes(intent) ? intent : "motivation");
}

export async function aiAskAction(clientId: string, question: string, history: ChatTurn[]) {
  await staffOnly();
  const safe = (Array.isArray(history) ? history : [])
    .filter((t) => (t.role === "user" || t.role === "assistant") && typeof t.content === "string")
    .slice(-6);
  return askAboutClient(clientId, String(question ?? ""), safe);
}

/* ===================== Réservation en ligne (public) ===================== */
export async function createBookingAction(_: BookingState, fd: FormData): Promise<BookingState> {
  const settings = await getSettings();
  if (!settings.booking_enabled) return { error: "La réservation en ligne est momentanément fermée." };

  const full_name = String(fd.get("full_name") ?? "").trim().slice(0, 120);
  const phone = String(fd.get("phone") ?? "").trim().slice(0, 30);
  const email = str(fd.get("email"))?.toLowerCase().slice(0, 160) ?? null;
  const message = str(fd.get("message"))?.slice(0, 1000) ?? null;
  const type = String(fd.get("type") ?? "");
  const wanted_at = String(fd.get("wanted_at") ?? "");

  if (!settings.booking_types.includes(type)) return { error: "Choisissez un type de rendez-vous." };
  if (full_name.length < 2) return { error: "Indiquez votre nom complet." };
  if (!waNumber(phone)) return { error: "Numéro de téléphone invalide (ex. 06 12 34 56 78)." };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Adresse e-mail invalide." };

  const supabase = await createClient();
  // Les visiteurs anonymes ne lisent pas les séances (RLS) : chevauchements vérifiés en démo seulement
  let busy: { start: string; minutes: number }[] = [];
  if (DEMO) try {
    const from = new Date().toISOString();
    const to = new Date(Date.now() + 15 * 86400000).toISOString();
    const { data } = await supabase.from("sessions").select("starts_at, duration_min, status").gte("starts_at", from).lte("starts_at", to);
    busy = (data ?? []).filter((s) => s.status !== "annulee").map((s) => ({ start: s.starts_at as string, minutes: Number(s.duration_min) || 60 }));
  } catch {
    busy = [];
  }
  const free = buildDays(settings.booking_hours, busy).some((d) => d.slots.some((s) => s.iso === wanted_at));
  if (!free) return { error: "Ce créneau n'est plus disponible, merci d'en choisir un autre." };

  const { error } = await supabase.from("booking_requests").insert({ full_name, phone, email, type, wanted_at, message, status: "nouvelle", session_id: null });
  if (error) return { error: "La demande n'a pas pu être envoyée. Réessayez ou contactez-nous sur WhatsApp." };
  revalidatePath("/reservations");
  return { done: { name: full_name, type, iso: wanted_at } };
}

/* ===================== Réservations (staff) ===================== */
export async function confirmBookingAction(fd: FormData) {
  const me = await staffOnly();
  const id = String(fd.get("id") ?? "");
  const supabase = await createClient();
  const { data } = await supabase.from("booking_requests").select("*").eq("id", id).maybeSingle();
  const b = data as BookingRequest | null;
  if (!b || b.status !== "nouvelle") return;
  const settings = await getSettings();

  // Client existant (même téléphone ou même e-mail) ou nouveau client
  const { data: list } = await supabase.from("clients").select("id, phone, email");
  const tel = waNumber(b.phone);
  const existing = ((list ?? []) as Pick<Client, "id" | "phone" | "email">[]).find(
    (c) => (tel && waNumber(c.phone) === tel) || (b.email && c.email?.toLowerCase() === b.email.toLowerCase()),
  );
  let clientId = existing?.id;
  if (!clientId) {
    const { data: created, error } = await supabase
      .from("clients")
      .insert({
        full_name: b.full_name,
        phone: b.phone,
        email: b.email,
        coach_id: me.id,
        status: "actif",
        start_date: new Date().toISOString().slice(0, 10),
        notes: `Créé depuis une réservation en ligne (${b.type})${b.message ? ` — « ${b.message} »` : ""}`,
      })
      .select("id")
      .single();
    if (error || !created) return;
    clientId = created.id as string;
  }

  const { data: session, error: sErr } = await supabase
    .from("sessions")
    .insert({
      client_id: clientId,
      coach_id: me.id,
      starts_at: b.wanted_at,
      duration_min: Number(settings.booking_hours.slot) || 60,
      type: b.type,
      status: "planifiee",
      notes: b.message ? `Réservation en ligne : ${b.message}` : "Réservation en ligne",
    })
    .select("id")
    .single();
  if (sErr || !session) return;

  await supabase.from("booking_requests").update({ status: "confirmee", session_id: session.id }).eq("id", id);
  revalidatePath("/reservations");
  revalidatePath("/seances");
  revalidatePath("/", "layout");
}

export async function refuseBookingAction(fd: FormData) {
  await staffOnly();
  const id = String(fd.get("id") ?? "");
  const supabase = await createClient();
  await supabase.from("booking_requests").update({ status: "refusee" }).eq("id", id).eq("status", "nouvelle");
  revalidatePath("/reservations");
}

/* ===================== Paramètres (marque blanche) ===================== */
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function saveSettingsAction(_: SettingsState, fd: FormData): Promise<SettingsState> {
  const me = await getProfile();
  if (me.role !== "admin") return { error: "Seul un administrateur peut modifier les paramètres." };

  const brand_name = String(fd.get("brand_name") ?? "").trim();
  const app_name = String(fd.get("app_name") ?? "").trim();
  const primary_color = String(fd.get("primary_color") ?? "").trim().toLowerCase();
  const accent_color = String(fd.get("accent_color") ?? "").trim().toLowerCase();
  const logo_url = str(fd.get("logo_url"));
  if (!brand_name || !app_name) return { error: "Le nom de la salle et le nom de l'application sont obligatoires." };
  if (!isHex(primary_color) || !isHex(accent_color)) return { error: "Les couleurs doivent être au format #RRGGBB." };
  if (logo_url && !/^(https:\/\/|\/)/.test(logo_url)) return { error: "L'URL du logo doit commencer par https:// ou /." };

  const types = String(fd.get("booking_types") ?? "")
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 12);
  const days = fd
    .getAll("days")
    .map(Number)
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6)
    .sort();
  const start = String(fd.get("start") ?? "08:00");
  const end = String(fd.get("end") ?? "20:00");
  const slot = Math.round(Number(fd.get("slot") ?? 60));
  const booking_enabled = fd.get("booking_enabled") === "on";
  if (!HHMM.test(start) || !HHMM.test(end) || start >= end) return { error: "Horaires de réservation invalides (l'heure de fin doit suivre l'heure de début)." };
  if (!Number.isFinite(slot) || slot < 15 || slot > 240) return { error: "La durée d'un créneau doit être comprise entre 15 et 240 minutes." };
  if (booking_enabled && (!types.length || !days.length)) return { error: "Indiquez au moins un type de rendez-vous et un jour ouvert." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("settings")
    .update({
      brand_name,
      app_name,
      primary_color,
      accent_color,
      logo_url,
      phone: str(fd.get("phone")),
      whatsapp: str(fd.get("whatsapp")),
      email: str(fd.get("email"))?.toLowerCase() ?? null,
      address: str(fd.get("address")),
      ice: str(fd.get("ice")),
      invoice_footer: str(fd.get("invoice_footer")),
      booking_enabled,
      booking_types: types,
      booking_hours: { start, end, days: [...new Set(days)], slot },
    })
    .eq("id", 1);
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: Date.now() };
}
