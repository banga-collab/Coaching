/**
 * Outils partagés des formulaires de séance :
 * - ajout rapide d'un client depuis la liste déroulante (valeur "__new__")
 * - types de séance gérés en base (table session_types), ajoutables depuis la liste (valeur "__new__")
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { SESSION_TYPES, str } from "./utils";

export const NEW = "__new__";

export interface SessionType {
  id: string;
  name: string;
  duration_min: number | null;
  color: string | null;
  /** Prix indicatif par défaut (DH) — informatif seulement, aucun paiement */
  price_mad?: number | null;
  active: boolean;
  position: number;
  created_at?: string;
}

/* ---------- Types de séance ---------- */
export async function loadSessionTypes(supabase: SupabaseClient, all = false): Promise<SessionType[]> {
  try {
    const { data, error } = await supabase.from("session_types").select("*").order("position", { ascending: true });
    if (error) throw error;
    const rows = (data ?? []) as SessionType[];
    if (rows.length) return all ? rows : rows.filter((t) => t.active !== false);
  } catch {
    /* table absente : on retombe sur la liste par défaut */
  }
  return SESSION_TYPES.map((name, i) => ({ id: `default-${i}`, name, duration_min: null, color: null, active: true, position: i }));
}

export async function sessionTypeNames(supabase: SupabaseClient) {
  return (await loadSessionTypes(supabase)).map((t) => t.name);
}

/** Noms des types actifs + prix indicatif par défaut de chaque type (pour pré-remplir « Prix (DH) ») */
export async function sessionTypeOptions(supabase: SupabaseClient) {
  const list = await loadSessionTypes(supabase);
  return {
    names: list.map((t) => t.name),
    prices: Object.fromEntries(list.filter((t) => t.price_mad !== null && t.price_mad !== undefined).map((t) => [t.name, Number(t.price_mad)])) as Record<string, number>,
  };
}

/* ---------- Prix indicatif (DH) ---------- */
const dh = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });
/** 3600 → « 3 600 DH » */
export const fmtDh = (n: number) => `${dh.format(n)} DH`;
/** Prix saisi dans un formulaire : vide → null ; refuse les valeurs négatives ou absurdes */
export function readPrice(v: FormDataEntryValue | null): { price: number | null } | { error: string } {
  const raw = String(v ?? "").replace(/s/g, "").replace(",", ".").replace(/dh$/i, "");
  if (!raw) return { price: null };
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 100000) return { error: "Prix invalide (en DH, entre 0 et 100 000)." };
  return { price: Math.round(n * 100) / 100 };
}

/** Lit le type choisi ; si « Nouveau type… », l'enregistre dans la liste (sans doublon). */
export async function resolveSessionType(supabase: SupabaseClient, fd: FormData): Promise<string> {
  const picked = str(fd.get("type"));
  if (picked !== NEW) return picked ?? "Séance";
  const name = str(fd.get("new_type"));
  if (!name) return "Séance";
  const clean = name.replace(/\s+/g, " ").trim().slice(0, 80);
  const existing = await loadSessionTypes(supabase, true);
  const same = existing.find((t) => t.name.toLowerCase() === clean.toLowerCase());
  if (same) return same.name;
  try {
    // Première personnalisation : on recopie la liste par défaut pour la garder
    const rows = existing.filter((t) => t.id.startsWith("default-")).map((t) => ({ name: t.name, active: true, position: t.position, duration_min: null, color: null }));
    if (rows.length) await supabase.from("session_types").insert(rows);
    await supabase.from("session_types").insert({ name: clean, active: true, position: existing.length, duration_min: null, color: null });
  } catch {
    /* sans table, le type reste libre sur la séance */
  }
  return clean;
}

/* ---------- Ajout rapide d'un client ---------- */
export type NewClient = { full_name: string; phone: string | null; email: string | null; goal: string | null };

/** null = un client existant a été choisi ; { error } = saisie incomplète */
export function readNewClient(fd: FormData): NewClient | { error: string } | null {
  if (str(fd.get("client_id")) !== NEW) return null;
  const full_name = str(fd.get("new_client_name"))?.replace(/\s+/g, " ").trim();
  if (!full_name || full_name.length < 2) return { error: "Indique le nom du nouveau client." };
  const email = str(fd.get("new_client_email"));
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "E-mail du nouveau client invalide." };
  return { full_name, phone: str(fd.get("new_client_phone")), email: email?.toLowerCase() ?? null, goal: str(fd.get("new_client_goal")) };
}

/** Crée la fiche client (rattachée au coach de la séance). Refuse un doublon exact de nom ou d'e-mail. */
export async function createQuickClient(supabase: SupabaseClient, c: NewClient, coachId: string) {
  const { data: same } = await supabase.from("clients").select("id, full_name, email").ilike("full_name", c.full_name);
  const dup = ((same ?? []) as { id: string; full_name: string; email: string | null }[]).find(
    (x) => x.full_name.toLowerCase() === c.full_name.toLowerCase() || (!!c.email && x.email?.toLowerCase() === c.email),
  );
  if (dup) return { error: `« ${dup.full_name} » existe déjà : choisis-le dans la liste.` } as const;
  const { data, error } = await supabase
    .from("clients")
    .insert({ full_name: c.full_name, phone: c.phone, email: c.email, goal: c.goal, coach_id: coachId, status: "actif", start_date: new Date().toISOString().slice(0, 10) })
    .select("id, full_name, user_id, coach_id")
    .single();
  if (error || !data) return { error: error?.message ?? "Impossible de créer le client." } as const;
  return { client: data as { id: string; full_name: string; user_id: string | null; coach_id: string } } as const;
}
