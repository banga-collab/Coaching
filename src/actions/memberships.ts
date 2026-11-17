"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { parseNum, str } from "@/lib/utils";
import type { FormState } from "@/components/action-form";
import type { Client, GymCheckin, Membership, Package } from "@/lib/types";
import {
  CHECKIN_COOLDOWN_MIN,
  accessCheck,
  addDaysKey,
  currentMembership,
  daysLeft,
  diffDays,
  frDay,
  normalizeCode,
  sessionsLeft,
  todayKey,
} from "@/lib/memberships";

type Supa = Awaited<ReturnType<typeof createClient>>;

/** Lien interne uniquement (évite les redirections ouvertes). */
function safeBack(v: FormDataEntryValue | null) {
  const s = v ? String(v) : "";
  return s.startsWith("/") && !s.startsWith("//") ? s : null;
}

function refresh(clientId?: string | null) {
  revalidatePath("/abonnements");
  revalidatePath("/acces");
  revalidatePath("/moi/carte");
  if (clientId) revalidatePath(`/clients/${clientId}`);
}

async function nextInvoiceNumber(supabase: Supa, year: string) {
  const prefix = `MU-${year}-`;
  const { data } = await supabase.from("invoices").select("number").ilike("number", `${prefix}%`);
  const rows = (data ?? []) as { number: string }[];
  const max = rows.reduce((m, r) => {
    const n = Number(String(r.number).slice(prefix.length));
    return Number.isFinite(n) && n > m ? n : m;
  }, 0);
  return `${prefix}${String(max + 1).padStart(4, "0")}`;
}

async function createInvoiceFor(supabase: Supa, me: { id: string }, m: Pick<Membership, "client_id" | "package_id" | "name" | "price_mad" | "start_date" | "end_date">) {
  const amount = Number(m.price_mad ?? 0);
  if (amount <= 0) return null;
  const issued_on = todayKey();
  const number = await nextInvoiceNumber(supabase, issued_on.slice(0, 4));
  const { data } = await supabase
    .from("invoices")
    .insert({
      number,
      client_id: m.client_id,
      package_id: m.package_id,
      lines: [{ label: `${m.name} (du ${frDay(m.start_date, { day: "numeric", month: "short" })} au ${frDay(m.end_date)})`, qty: 1, unit_price: amount }],
      amount_mad: amount,
      issued_on,
      due_on: addDaysKey(issued_on, 7),
      status: "envoyee",
      paid_on: null,
      method: null,
      notes: "Facture générée depuis l'abonnement.",
      created_by: me.id,
    })
    .select("id")
    .single();
  revalidatePath("/facturation");
  return (data as { id: string } | null)?.id ?? null;
}

/* ================= Création ================= */
export async function createMembershipAction(_: FormState, fd: FormData): Promise<FormState> {
  const me = await getProfile();
  if (me.role === "client") return { error: "Accès refusé." };
  const client_id = str(fd.get("client_id"));
  if (!client_id) return { error: "Choisis un client." };
  const name = str(fd.get("name"))?.slice(0, 120);
  if (!name) return { error: "Indique le nom de la formule." };
  const start_date = str(fd.get("start_date")) ?? todayKey();
  const end_date = str(fd.get("end_date"));
  if (!end_date || !/^\d{4}-\d{2}-\d{2}$/.test(end_date) || !/^\d{4}-\d{2}-\d{2}$/.test(start_date)) return { error: "Dates invalides." };
  if (end_date <= start_date) return { error: "La date de fin doit être postérieure à la date de début." };
  const sessionsRaw = parseNum(fd.get("sessions_total"));
  const sessions_total = sessionsRaw && sessionsRaw > 0 ? Math.round(sessionsRaw) : null;
  const priceRaw = parseNum(fd.get("price_mad"));
  const price_mad = priceRaw !== null && priceRaw >= 0 ? priceRaw : null;

  const supabase = await createClient();
  const { data: cData } = await supabase.from("clients").select("*").eq("id", client_id).maybeSingle();
  if (!cData) return { error: "Client introuvable." };

  const row = {
    client_id,
    package_id: str(fd.get("package_id")),
    name,
    start_date,
    end_date,
    sessions_total,
    sessions_used: 0,
    price_mad,
    status: "actif" as const,
    auto_renew: fd.get("auto_renew") === "on",
  };
  const { error } = await supabase.from("memberships").insert(row);
  if (error) return { error: error.message };
  if (fd.get("with_invoice") === "on") await createInvoiceFor(supabase, me, row);

  refresh(client_id);
  redirect(safeBack(fd.get("back")) ?? "/abonnements?ok=cree");
}

/* ================= Renouvellement ================= */
export async function renewMembershipAction(fd: FormData) {
  const me = await getProfile();
  if (me.role === "client") return;
  const id = String(fd.get("id") ?? "");
  const supabase = await createClient();
  const { data } = await supabase.from("memberships").select("*").eq("id", id).maybeSingle();
  const m = data as Membership | null;
  if (!m) return;

  let pkg: Package | null = null;
  if (m.package_id) {
    const { data: p } = await supabase.from("packages").select("*").eq("id", m.package_id).maybeSingle();
    pkg = p as Package | null;
  }
  const today = todayKey();
  const start_date = m.end_date >= today ? addDaysKey(m.end_date, 1) : today;
  const duration = pkg?.duration_days ?? Math.max(1, diffDays(m.start_date, m.end_date));
  const row = {
    client_id: m.client_id,
    package_id: m.package_id,
    name: pkg?.name ?? m.name,
    start_date,
    end_date: addDaysKey(start_date, duration),
    sessions_total: pkg ? pkg.sessions_count : m.sessions_total,
    sessions_used: 0,
    price_mad: pkg ? pkg.price_mad : m.price_mad,
    status: "actif" as const,
    auto_renew: m.auto_renew,
  };
  await supabase.from("memberships").insert(row);
  if (fd.get("with_invoice") === "1") await createInvoiceFor(supabase, me, row);
  refresh(m.client_id);
}

/* ================= Suspendre / réactiver / annuler ================= */
export async function toggleSuspendMembershipAction(fd: FormData) {
  const me = await getProfile();
  if (me.role === "client") return;
  const id = String(fd.get("id") ?? "");
  const supabase = await createClient();
  const { data } = await supabase.from("memberships").select("*").eq("id", id).maybeSingle();
  const m = data as Membership | null;
  if (!m || m.status === "annule") return;
  await supabase.from("memberships").update({ status: m.status === "suspendu" ? "actif" : "suspendu" }).eq("id", id);
  refresh(m.client_id);
}

export async function cancelMembershipAction(fd: FormData) {
  const me = await getProfile();
  if (me.role === "client") return;
  const id = String(fd.get("id") ?? "");
  const supabase = await createClient();
  const { data } = await supabase.from("memberships").select("*").eq("id", id).maybeSingle();
  const m = data as Membership | null;
  if (!m) return;
  await supabase.from("memberships").update({ status: "annule", auto_renew: false }).eq("id", id);
  refresh(m.client_id);
}

/* ================= Passage à l'accueil ================= */
export type CheckInResult =
  | {
      ok: true;
      already: boolean;
      at: string;
      client: { id: string; name: string; first: string };
      membership: { name: string; end_date: string; daysLeft: number; sessionsLeft: number | null; sessionsTotal: number | null };
    }
  | { ok: false; title: string; reason: string; client?: { id: string; name: string; first: string } };

export async function checkInAction(input: { code?: string; clientId?: string; method: "qr" | "code" | "manuel" }): Promise<CheckInResult> {
  const me = await getProfile();
  if (me.role === "client") return { ok: false, title: "Accès refusé", reason: "Seule l'équipe peut enregistrer un passage." };
  const supabase = await createClient();

  let client: Client | null = null;
  if (input.clientId) {
    const { data } = await supabase.from("clients").select("*").eq("id", input.clientId).maybeSingle();
    client = data as Client | null;
  } else if (input.code) {
    const code = normalizeCode(input.code).slice(0, 64);
    if (code) {
      const { data } = await supabase.from("clients").select("*").eq("access_code", code).maybeSingle();
      client = data as Client | null;
    }
  }
  if (!client) return { ok: false, title: "Code inconnu", reason: "Aucun membre ne correspond à ce code. Vérifie la carte ou cherche le membre par son nom." };

  const who = { id: client.id, name: client.full_name, first: client.full_name.split(" ")[0] ?? client.full_name };
  const today = todayKey();
  const { data: mData } = await supabase.from("memberships").select("*").eq("client_id", client.id);
  const m = currentMembership((mData ?? []) as Membership[], today);
  const check = accessCheck(m, today);
  if (!check.ok || !m) return { ok: false, title: check.ok ? "Aucun abonnement" : check.title, reason: check.ok ? "" : check.reason, client: who };

  // Anti double passage
  const since = new Date(Date.now() - CHECKIN_COOLDOWN_MIN * 60000).toISOString();
  const { data: recent } = await supabase
    .from("gym_checkins")
    .select("*")
    .eq("client_id", client.id)
    .gte("checked_at", since)
    .order("checked_at", { ascending: false })
    .limit(1);
  const last = ((recent ?? []) as GymCheckin[])[0];
  const info = (mm: Membership) => ({
    name: mm.name,
    end_date: mm.end_date,
    daysLeft: daysLeft(mm, today),
    sessionsLeft: sessionsLeft(mm),
    sessionsTotal: mm.sessions_total,
  });
  if (last) return { ok: true, already: true, at: last.checked_at, client: who, membership: info(m) };

  const at = new Date().toISOString();
  const { error } = await supabase.from("gym_checkins").insert({ client_id: client.id, checked_at: at, method: input.method, created_by: me.id });
  if (error) return { ok: false, title: "Erreur", reason: error.message, client: who };
  let updated = m;
  if (m.sessions_total) {
    updated = { ...m, sessions_used: (m.sessions_used ?? 0) + 1 };
    await supabase.from("memberships").update({ sessions_used: updated.sessions_used }).eq("id", m.id);
  }
  refresh(client.id);
  return { ok: true, already: false, at, client: who, membership: info(updated) };
}
