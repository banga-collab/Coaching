"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings";
import { DEMO } from "@/lib/demo";
import { dayKey, addDays } from "@/lib/utils";
import { appBaseUrl, canSimulate, getStripe, paymentMode, recordOnlinePayment, serviceClient, toCentimes } from "@/lib/payments";
import type { Client, Invoice, Package, Profile } from "@/lib/types";
import type { FormState } from "@/components/action-form";

const fail = (error: string): FormState => ({ error });
const UUID = /^[0-9a-f-]{36}$/i;

/** Charge la facture et vérifie que l'utilisateur peut la payer (membre propriétaire ou staff). */
async function loadPayable(invoiceId: string, me: Profile) {
  if (!UUID.test(invoiceId)) return { error: "Facture introuvable." } as const;
  const supabase = await createClient();
  const { data: iData } = await supabase.from("invoices").select("*").eq("id", invoiceId).maybeSingle();
  const invoice = iData as Invoice | null;
  if (!invoice) return { error: "Facture introuvable." } as const;
  const { data: cData } = await supabase.from("clients").select("*").eq("id", invoice.client_id).maybeSingle();
  const client = cData as Client | null;
  const isStaff = me.role !== "client";
  if (!isStaff && client?.user_id !== me.id) return { error: "Facture introuvable." } as const;
  if (invoice.status === "payee") return { error: "Cette facture est déjà réglée." } as const;
  if (invoice.status !== "envoyee") return { error: "Seule une facture envoyée peut être payée en ligne." } as const;
  if (!(Number(invoice.amount_mad) > 0)) return { error: "Le montant de la facture doit être supérieur à 0." } as const;
  return { supabase, invoice, client, isStaff } as const;
}

/** Bouton « Payer » de la page /paiement/[id] : redirige vers Stripe, CMI ou le paiement simulé. */
export async function startOnlinePaymentAction(_: FormState, fd: FormData): Promise<FormState> {
  const me = await getProfile();
  const invoiceId = String(fd.get("invoice_id") ?? "");
  const r = await loadPayable(invoiceId, me);
  if ("error" in r) return fail(r.error!);
  const { invoice, client } = r;
  const settings = await getSettings();
  const { mode } = paymentMode(settings);

  if (mode === "off") return fail("Le paiement en ligne est désactivé. Règle ta facture à l'accueil de la salle.");
  if (mode === "demo") {
    if (!canSimulate(me.role)) return fail("Le paiement en ligne n'est pas encore disponible. Merci de régler ta facture à l'accueil.");
    redirect(`/paiement/${invoice.id}/demo`);
  }
  if (mode === "cmi") redirect(`/paiement/${invoice.id}/cmi`);

  // ---- Stripe Checkout ----
  const base = appBaseUrl(await headers());
  let url: string | null = null;
  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      locale: "fr",
      client_reference_id: invoice.id,
      customer_email: client?.email || me.email || undefined,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "mad",
            unit_amount: toCentimes(invoice.amount_mad),
            product_data: {
              name: `Facture ${invoice.number} – ${settings.brand_name}`,
              description: invoice.lines.map((l) => l.label).join(", ").slice(0, 300) || undefined,
            },
          },
        },
      ],
      metadata: { invoice_id: invoice.id, invoice_number: invoice.number },
      payment_intent_data: { metadata: { invoice_id: invoice.id, invoice_number: invoice.number } },
      success_url: `${base}/paiement/${invoice.id}/succes?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/paiement/${invoice.id}/echec?raison=annule`,
    });
    url = session.url;
    // Trace « en attente » (service-role si dispo : le membre n'a pas le droit d'écrire cette table)
    const db = serviceClient() ?? r.supabase;
    await db.from("online_payments").insert({
      invoice_id: invoice.id,
      client_id: invoice.client_id,
      provider: "stripe",
      provider_ref: session.id,
      amount_mad: invoice.amount_mad,
      status: "en_attente",
      paid_at: null,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    return fail(`Impossible d'ouvrir le paiement Stripe pour le moment.${msg ? ` (${msg.slice(0, 160)})` : ""}`);
  }
  if (!url) return fail("Stripe n'a pas renvoyé d'adresse de paiement.");
  redirect(url);
}

const luhn = (digits: string) => {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
};

/** Paiement simulé (démo / clés absentes) : rien n'est envoyé à une banque. */
export async function demoPayAction(_: FormState, fd: FormData): Promise<FormState> {
  const me = await getProfile();
  const invoiceId = String(fd.get("invoice_id") ?? "");
  const r = await loadPayable(invoiceId, me);
  if ("error" in r) return fail(r.error!);
  const settings = await getSettings();
  const { mode } = paymentMode(settings);
  if (mode !== "demo") return fail("Le paiement simulé n'est pas disponible : un vrai prestataire est configuré.");
  if (!canSimulate(me.role)) return fail("Paiement simulé réservé à l'équipe.");

  const card = String(fd.get("card") ?? "").replace(/\D/g, "");
  const exp = String(fd.get("exp") ?? "").replace(/\s/g, "");
  const cvc = String(fd.get("cvc") ?? "").replace(/\D/g, "");
  const name = String(fd.get("name") ?? "").trim();
  if (!name) return fail("Indique le nom figurant sur la carte.");
  if (card.length < 13 || card.length > 19 || !luhn(card)) return fail("Numéro de carte invalide. En démo, utilise 4242 4242 4242 4242.");
  const m = exp.match(/^(\d{2})\/?(\d{2})$/);
  if (!m || Number(m[1]) < 1 || Number(m[1]) > 12) return fail("Date d'expiration invalide (MM/AA).");
  const now = new Date();
  const expEnd = new Date(2000 + Number(m[2]), Number(m[1]), 1);
  if (expEnd <= now) return fail("Cette carte est expirée.");
  if (cvc.length < 3 || cvc.length > 4) return fail("Code de sécurité (CVC) invalide.");
  if (card === "4000000000000002") {
    redirect(`/paiement/${invoiceId}/echec?raison=refuse`);
  }

  const db = serviceClient() ?? r.supabase;
  const res = await recordOnlinePayment(db, { invoiceId, provider: "demo", providerRef: `demo_${Date.now().toString(36)}`, expectedAmount: Number(r.invoice.amount_mad) });
  if (!res.ok) return fail(res.error ?? "Paiement impossible.");
  revalidatePath("/facturation");
  revalidatePath(`/facturation/${invoiceId}`);
  revalidatePath(`/clients/${r.invoice.client_id}`);
  revalidatePath("/moi");
  redirect(`/paiement/${invoiceId}/succes?mode=demo`);
}

async function nextInvoiceNumber(supabase: Awaited<ReturnType<typeof createClient>>, year: string) {
  const prefix = `MU-${year}-`;
  const { data } = await supabase.from("invoices").select("number").ilike("number", `${prefix}%`);
  const rows = (data ?? []) as { number: string }[];
  const max = rows.reduce((mx, row) => {
    const n = Number(row.number.slice(prefix.length));
    return Number.isFinite(n) && n > mx ? n : mx;
  }, 0);
  return `${prefix}${String(Math.max(max, rows.length) + 1).padStart(4, "0")}`;
}

/** Le membre choisit une formule : création d'une facture « envoyée » puis redirection vers son paiement. */
export async function buyPackageAction(_: FormState, fd: FormData): Promise<FormState> {
  const me = await getProfile();
  if (me.role !== "client") return fail("Pour un client, créez la facture depuis la facturation.");
  const packageId = String(fd.get("package_id") ?? "");
  if (!UUID.test(packageId)) return fail("Formule introuvable.");
  const settings = await getSettings();
  const { mode } = paymentMode(settings);
  if (mode === "off" || (mode === "demo" && !canSimulate(me.role))) return fail("Le paiement en ligne n'est pas disponible pour le moment. Passe à l'accueil pour t'abonner.");

  const supabase = await createClient();
  const { data: cData } = await supabase.from("clients").select("*").eq("user_id", me.id).maybeSingle();
  const client = cData as Client | null;
  if (!client) return fail("Ton dossier n'est pas encore relié à ton compte.");
  const { data: pData } = await supabase.from("packages").select("*").eq("id", packageId).maybeSingle();
  const pkg = pData as Package | null;
  if (!pkg || !pkg.active) return fail("Cette formule n'est plus disponible.");

  // Le membre n'a pas le droit de créer de facture (RLS) : clé service-role nécessaire hors démo.
  const db = DEMO ? supabase : serviceClient();
  if (!db) return fail("L'achat en ligne de formules n'est pas encore activé. Demande à ton coach de t'envoyer la facture.");

  // Réutilise une facture en attente pour la même formule (évite les doublons)
  const { data: openData } = await db.from("invoices").select("*").eq("client_id", client.id).eq("status", "envoyee");
  const reuse = ((openData ?? []) as Invoice[]).find((i) => i.package_id === pkg.id && Number(i.amount_mad) === Number(pkg.price_mad));
  if (reuse) redirect(`/paiement/${reuse.id}`);

  const today = dayKey(new Date());
  const number = await nextInvoiceNumber(db, today.slice(0, 4));
  const { data, error } = await db
    .from("invoices")
    .insert({
      number,
      client_id: client.id,
      package_id: pkg.id,
      lines: [{ label: pkg.name, qty: 1, unit_price: Number(pkg.price_mad) }],
      amount_mad: Number(pkg.price_mad),
      issued_on: today,
      due_on: dayKey(addDays(new Date(), 7)),
      status: "envoyee",
      paid_on: null,
      method: null,
      notes: "Achat en ligne depuis l'espace membre.",
      created_by: me.id,
    })
    .select("id")
    .single();
  if (error || !data) return fail(error?.message ?? "Impossible de préparer le paiement.");
  if (client.coach_id) {
    await db.from("notifications").insert({
      user_id: client.coach_id,
      title: "Achat de formule en cours",
      body: `${client.full_name} – ${pkg.name} – ${number}`,
      link: `/facturation/${data.id}`,
      kind: "paiement",
      read: false,
    });
  }
  revalidatePath("/facturation");
  redirect(`/paiement/${data.id}`);
}

/* ======================= Paramètres ======================= */
export type PaymentSettingsState = { error?: string; ok?: number } | undefined;

export async function savePaymentSettingsAction(_: PaymentSettingsState, fd: FormData): Promise<PaymentSettingsState> {
  const me = await getProfile();
  if (me.role !== "admin") return { error: "Réservé à l'administrateur." };
  const v = String(fd.get("payment_provider") ?? "");
  if (!["stripe", "cmi", "aucun"].includes(v)) return { error: "Prestataire inconnu." };
  const supabase = await createClient();
  const { error } = await supabase.from("settings").update({ payment_provider: v }).eq("id", 1);
  if (error) return { error: error.message };
  revalidatePath("/parametres");
  revalidatePath("/paiement");
  return { ok: Date.now() };
}
