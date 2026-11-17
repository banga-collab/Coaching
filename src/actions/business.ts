"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { dayKey, parseNum, str } from "@/lib/utils";
import type { FormState } from "@/components/action-form";
import type { Client, InvoiceLine } from "@/lib/types";

function fail(msg: string): FormState {
  return { error: msg };
}

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

/* ================= Factures ================= */
function parseLines(raw: FormDataEntryValue | null): InvoiceLine[] {
  try {
    const arr = JSON.parse(String(raw ?? "[]")) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr
      .map((l) => ({
        label: String((l as InvoiceLine).label ?? "").trim().slice(0, 200),
        qty: Math.max(0, Number((l as InvoiceLine).qty) || 0),
        unit_price: Math.max(0, Number((l as InvoiceLine).unit_price) || 0),
      }))
      .filter((l) => l.label && l.qty > 0);
  } catch {
    return [];
  }
}

async function nextInvoiceNumber(supabase: Awaited<ReturnType<typeof createClient>>, year: string) {
  const prefix = `MU-${year}-`;
  const { data } = await supabase.from("invoices").select("number").ilike("number", `${prefix}%`);
  const rows = (data ?? []) as { number: string }[];
  const max = rows.reduce((m, r) => {
    const n = Number(r.number.slice(prefix.length));
    return Number.isFinite(n) && n > m ? n : m;
  }, 0);
  return `${prefix}${String(Math.max(max, rows.length) + 1).padStart(4, "0")}`;
}

export async function createInvoiceAction(_: FormState, fd: FormData): Promise<FormState> {
  const me = await getProfile();
  if (me.role === "client") return fail("Accès refusé.");
  const client_id = str(fd.get("client_id"));
  if (!client_id) return fail("Choisis un client.");
  const lines = parseLines(fd.get("lines"));
  if (!lines.length) return fail("Ajoute au moins une ligne avec un libellé et une quantité.");
  const issued_on = str(fd.get("issued_on")) ?? dayKey(new Date());
  const due_on = str(fd.get("due_on"));
  if (due_on && due_on < issued_on) return fail("L'échéance doit être postérieure à la date d'émission.");
  const status = fd.get("status") === "envoyee" ? "envoyee" : "brouillon";
  const amount_mad = Math.round(lines.reduce((s, l) => s + l.qty * l.unit_price, 0) * 100) / 100;

  const supabase = await createClient();
  const { data: cData } = await supabase.from("clients").select("*").eq("id", client_id).maybeSingle();
  const client = cData as Client | null;
  if (!client) return fail("Client introuvable.");

  const number = await nextInvoiceNumber(supabase, issued_on.slice(0, 4));
  const { data, error } = await supabase
    .from("invoices")
    .insert({
      number,
      client_id,
      package_id: str(fd.get("package_id")),
      lines,
      amount_mad,
      issued_on,
      due_on,
      status,
      paid_on: null,
      method: null,
      notes: str(fd.get("notes")),
      created_by: me.id,
    })
    .select("id")
    .single();
  if (error || !data) return fail(error?.message ?? "Impossible de créer la facture.");

  if (status === "envoyee" && client.user_id) {
    await supabase.from("notifications").insert({
      user_id: client.user_id,
      title: `Nouvelle facture ${number}`,
      body: `${new Intl.NumberFormat("fr-FR").format(amount_mad)} MAD`,
      link: `/facturation/${data.id}`,
      kind: "paiement",
      read: false,
    });
  }
  revalidatePath("/facturation");
  revalidatePath(`/clients/${client_id}`);
  redirect(`/facturation/${data.id}`);
}

async function staffInvoice(fd: FormData) {
  const me = await getProfile();
  if (me.role === "client") redirect("/moi");
  const id = String(fd.get("id") ?? "");
  const supabase = await createClient();
  const { data } = await supabase.from("invoices").select("*").eq("id", id).maybeSingle();
  if (!data) redirect("/facturation");
  return { me, supabase, id, invoice: data as { client_id: string; number: string; amount_mad: number } };
}

function refresh(id: string, clientId: string) {
  revalidatePath("/facturation");
  revalidatePath(`/facturation/${id}`);
  revalidatePath(`/clients/${clientId}`);
}

export async function markInvoicePaidAction(fd: FormData) {
  const { supabase, id, invoice } = await staffInvoice(fd);
  const method = str(fd.get("method")) ?? "Espèces";
  const paid_on = str(fd.get("paid_on")) ?? dayKey(new Date());
  await supabase.from("invoices").update({ status: "payee", method, paid_on }).eq("id", id);
  refresh(id, invoice.client_id);
}

export async function markInvoiceSentAction(fd: FormData) {
  const { supabase, id, invoice } = await staffInvoice(fd);
  await supabase.from("invoices").update({ status: "envoyee" }).eq("id", id);
  const { data: c } = await supabase.from("clients").select("*").eq("id", invoice.client_id).maybeSingle();
  const uid = (c as Client | null)?.user_id;
  if (uid) {
    await supabase.from("notifications").insert({
      user_id: uid,
      title: `Nouvelle facture ${invoice.number}`,
      body: `${new Intl.NumberFormat("fr-FR").format(Number(invoice.amount_mad))} MAD`,
      link: `/facturation/${id}`,
      kind: "paiement",
      read: false,
    });
  }
  refresh(id, invoice.client_id);
}

export async function cancelInvoiceAction(fd: FormData) {
  const { supabase, id, invoice } = await staffInvoice(fd);
  await supabase.from("invoices").update({ status: "annulee" }).eq("id", id);
  refresh(id, invoice.client_id);
}

export async function reopenInvoiceAction(fd: FormData) {
  const { supabase, id, invoice } = await staffInvoice(fd);
  await supabase.from("invoices").update({ status: "envoyee", paid_on: null, method: null }).eq("id", id);
  refresh(id, invoice.client_id);
}

/* ================= Formules ================= */
export async function savePackageAction(_: FormState, fd: FormData): Promise<FormState> {
  const me = await getProfile();
  if (me.role !== "admin") return fail("Réservé à l'administrateur.");
  const name = String(fd.get("name") ?? "").trim();
  if (!name) return fail("Le nom de la formule est obligatoire.");
  const price = parseNum(fd.get("price_mad"));
  if (price === null || price < 0) return fail("Indique un prix valide.");
  const sessions = parseNum(fd.get("sessions_count"));
  const days = parseNum(fd.get("duration_days"));
  const row = {
    name,
    description: str(fd.get("description")),
    price_mad: price,
    sessions_count: sessions === null ? null : Math.round(sessions),
    duration_days: days === null ? null : Math.round(days),
    active: fd.get("active") === "on",
  };
  const id = str(fd.get("id"));
  const supabase = await createClient();
  const { error } = id ? await supabase.from("packages").update(row).eq("id", id) : await supabase.from("packages").insert(row);
  if (error) return fail(error.message);
  revalidatePath("/facturation/formules");
  revalidatePath("/facturation/nouvelle");
  redirect("/facturation/formules");
}

export async function togglePackageAction(fd: FormData) {
  const me = await getProfile();
  if (me.role !== "admin") return;
  const supabase = await createClient();
  await supabase
    .from("packages")
    .update({ active: fd.get("active") === "1" })
    .eq("id", String(fd.get("id") ?? ""));
  revalidatePath("/facturation/formules");
}
