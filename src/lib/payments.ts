import { createHash, timingSafeEqual } from "node:crypto";
import Stripe from "stripe";
import { createClient as createSupabase, type SupabaseClient } from "@supabase/supabase-js";
import { DEMO, DEMO_ADMIN, demoClient } from "./demo";
import { dayKey } from "./utils";
import type { Client, Invoice, OnlinePayment, Settings } from "./types";

/**
 * Paiement en ligne : Stripe Checkout ou CMI (3D Hosting, cartes marocaines).
 * Toutes les clés sont lues côté serveur depuis les variables d'environnement, jamais exposées ni journalisées.
 */

export const CMI_TEST_GATEWAY = "https://testpayment.cmi.co.ma/fim/est3Dgate";
export const ONLINE_METHOD = "Carte (en ligne)";

export type PaymentProvider = "stripe" | "cmi" | "aucun";
/** stripe/cmi = paiement réel ; demo = paiement simulé ; off = paiement en ligne désactivé. */
export type PaymentMode = "stripe" | "cmi" | "demo" | "off";

export function providerSetting(settings: Pick<Settings, "payment_provider">): PaymentProvider {
  const p = settings.payment_provider;
  return p === "cmi" || p === "aucun" ? p : "stripe";
}

export function paymentEnv() {
  return {
    stripeSecret: !!process.env.STRIPE_SECRET_KEY,
    stripeWebhook: !!process.env.STRIPE_WEBHOOK_SECRET,
    cmiClientId: !!process.env.CMI_CLIENT_ID,
    cmiStoreKey: !!process.env.CMI_STORE_KEY,
    cmiGatewayCustom: !!process.env.CMI_GATEWAY_URL,
    serviceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    appUrl: !!process.env.NEXT_PUBLIC_APP_URL,
  };
}

export const stripeReady = () => !!process.env.STRIPE_SECRET_KEY;
export const cmiReady = () => !!process.env.CMI_CLIENT_ID && !!process.env.CMI_STORE_KEY;

export function paymentMode(settings: Pick<Settings, "payment_provider">): { mode: PaymentMode; provider: PaymentProvider; reason: string | null } {
  const provider = providerSetting(settings);
  if (provider === "aucun") return { mode: "off", provider, reason: "Le paiement en ligne est désactivé dans les paramètres." };
  if (DEMO) return { mode: "demo", provider, reason: "Mode démo : le paiement est simulé, aucune carte n'est débitée." };
  if (provider === "stripe") {
    return stripeReady() ? { mode: "stripe", provider, reason: null } : { mode: "demo", provider, reason: "Clé STRIPE_SECRET_KEY manquante : paiement simulé." };
  }
  return cmiReady() ? { mode: "cmi", provider, reason: null } : { mode: "demo", provider, reason: "Identifiants CMI (CMI_CLIENT_ID / CMI_STORE_KEY) manquants : paiement simulé." };
}

/** Le paiement simulé est ouvert à tous en démo ; hors démo (clés manquantes), seulement au staff. */
export function canSimulate(role: string) {
  return DEMO || role !== "client";
}

let stripeInstance: Stripe | null = null;
export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY n'est pas configurée.");
  stripeInstance ??= new Stripe(key);
  return stripeInstance;
}

/** Montant MAD → centimes (entier). */
export function toCentimes(amount: number) {
  return Math.round(Number(amount) * 100);
}

/** URL publique de l'app : NEXT_PUBLIC_APP_URL sinon en-têtes de la requête. */
export function appBaseUrl(h: Headers) {
  const env = process.env.NEXT_PUBLIC_APP_URL;
  if (env) return env.replace(/\/+$/, "");
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto.split(",")[0]}://${host.split(",")[0]}`;
}

/**
 * Client Supabase sans session (webhooks, callbacks) : service-role en production, base de démo sinon.
 * Renvoie null si SUPABASE_SERVICE_ROLE_KEY manque.
 */
export function serviceClient(): SupabaseClient | null {
  if (DEMO) return demoClient(DEMO_ADMIN) as SupabaseClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createSupabase(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export const SERVICE_ROLE_MISSING =
  "SUPABASE_SERVICE_ROLE_KEY n'est pas configurée : impossible d'enregistrer le paiement sans session utilisateur. Ajoutez-la dans les variables d'environnement du serveur.";

/* ======================= CMI (3D Pay Hosting) ======================= */

const escapeCmi = (v: string) => v.replace(/\\/g, "\\\\").replace(/\|/g, "\\|");

/**
 * HASH « ver3 » CMI : noms de paramètres triés sans tenir compte de la casse (hors "hash" et "encoding"),
 * valeurs échappées (\ et |) jointes par "|", suivies de la clé du magasin échappée → SHA-512 → base64.
 */
export function cmiHash(params: Record<string, string>, storeKey: string) {
  const keys = Object.keys(params)
    .filter((k) => !["hash", "encoding"].includes(k.toLowerCase()))
    .sort((a, b) => {
      const x = a.toLowerCase();
      const y = b.toLowerCase();
      return x < y ? -1 : x > y ? 1 : 0;
    });
  const plain = keys.map((k) => escapeCmi(String(params[k] ?? "").trim())).join("|") + "|" + escapeCmi(storeKey);
  return createHash("sha512").update(plain, "utf8").digest("base64");
}

export function verifyCmiHash(params: Record<string, string>, storeKey: string) {
  const received = Object.entries(params).find(([k]) => k.toLowerCase() === "hash")?.[1];
  if (!received) return false;
  const expected = Buffer.from(cmiHash(params, storeKey));
  const got = Buffer.from(received);
  return expected.length === got.length && timingSafeEqual(expected, got);
}

export function cmiGateway() {
  return process.env.CMI_GATEWAY_URL || CMI_TEST_GATEWAY;
}

/** Champs du formulaire CMI (avec HASH) pour une facture. */
export function buildCmiFields(opts: { invoice: Invoice; client: Client | null; baseUrl: string; email?: string | null }) {
  const clientId = process.env.CMI_CLIENT_ID;
  const storeKey = process.env.CMI_STORE_KEY;
  if (!clientId || !storeKey) throw new Error("Identifiants CMI manquants.");
  const { invoice, client, baseUrl } = opts;
  const q = `invoice=${encodeURIComponent(invoice.id)}`;
  const fields: Record<string, string> = {
    clientid: clientId,
    amount: Number(invoice.amount_mad).toFixed(2),
    okUrl: `${baseUrl}/api/cmi/ok?${q}`,
    failUrl: `${baseUrl}/api/cmi/fail?${q}`,
    callbackUrl: `${baseUrl}/api/cmi/callback`,
    shopurl: `${baseUrl}/paiement/${invoice.id}`,
    TranType: "PreAuth",
    currency: "504",
    rnd: String(Date.now()) + Math.random().toString(36).slice(2, 8),
    storetype: "3D_PAY_HOSTING",
    hashAlgorithm: "ver3",
    lang: "fr",
    refreshtime: "5",
    oid: invoice.number,
    email: (opts.email ?? client?.email ?? "").slice(0, 64),
    BillToName: (client?.full_name ?? "Client").slice(0, 64),
    tel: (client?.phone ?? "").slice(0, 32),
    encoding: "UTF-8",
    AutoRedirect: "true",
  };
  fields.HASH = cmiHash(fields, storeKey);
  return fields;
}

/* ======================= Enregistrement d'un paiement ======================= */

export type MarkPaidResult = { ok: boolean; already?: boolean; error?: string; permanent?: boolean; invoice?: Invoice };

/**
 * Marque la facture payée (idempotent), enregistre `online_payments` (reussi) et notifie le coach (+ le membre).
 * `expectedAmount` (MAD) : vérifié contre le montant de la facture quand fourni.
 */
export async function recordOnlinePayment(
  db: SupabaseClient,
  opts: { invoiceId: string; provider: OnlinePayment["provider"]; providerRef: string | null; expectedAmount?: number },
): Promise<MarkPaidResult> {
  const { data: iData, error: iErr } = await db.from("invoices").select("*").eq("id", opts.invoiceId).maybeSingle();
  if (iErr) return { ok: false, error: iErr.message };
  const invoice = iData as Invoice | null;
  if (!invoice) return { ok: false, permanent: true, error: "Facture introuvable." };
  if (invoice.status === "annulee") return { ok: false, permanent: true, error: "Facture annulée." };
  if (opts.expectedAmount !== undefined && toCentimes(opts.expectedAmount) !== toCentimes(invoice.amount_mad)) {
    return { ok: false, permanent: true, error: "Le montant payé ne correspond pas au montant de la facture." };
  }

  const nowIso = new Date().toISOString();
  const { data: pData } = await db.from("online_payments").select("*").eq("invoice_id", invoice.id);
  const payments = (pData ?? []) as OnlinePayment[];
  const existing =
    payments.find((p) => opts.providerRef && p.provider_ref === opts.providerRef) ??
    payments.find((p) => p.provider === opts.provider && p.status === "en_attente");

  if (existing?.status === "reussi" && invoice.status === "payee") return { ok: true, already: true, invoice };

  if (existing) {
    const { error } = await db
      .from("online_payments")
      .update({ status: "reussi", paid_at: nowIso, provider_ref: opts.providerRef ?? existing.provider_ref, amount_mad: invoice.amount_mad })
      .eq("id", existing.id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await db.from("online_payments").insert({
      invoice_id: invoice.id,
      client_id: invoice.client_id,
      provider: opts.provider,
      provider_ref: opts.providerRef,
      amount_mad: invoice.amount_mad,
      status: "reussi",
      paid_at: nowIso,
    });
    if (error) return { ok: false, error: error.message };
  }

  const already = invoice.status === "payee";
  if (!already) {
    const { error } = await db.from("invoices").update({ status: "payee", paid_on: dayKey(new Date()), method: ONLINE_METHOD }).eq("id", invoice.id);
    if (error) return { ok: false, error: error.message };

    const { data: cData } = await db.from("clients").select("*").eq("id", invoice.client_id).maybeSingle();
    const client = cData as Client | null;
    const amount = `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(Number(invoice.amount_mad))} MAD`;
    const label = opts.provider === "cmi" ? "CMI" : opts.provider === "stripe" ? "Stripe" : "paiement simulé";
    const notes = [];
    if (client?.coach_id) {
      notes.push({
        user_id: client.coach_id,
        title: "Paiement en ligne reçu",
        body: `${client.full_name} – ${invoice.number} – ${amount} (${label})`,
        link: `/facturation/${invoice.id}`,
        kind: "paiement",
        read: false,
      });
    }
    if (client?.user_id) {
      notes.push({
        user_id: client.user_id,
        title: "Paiement confirmé",
        body: `Merci ! Ta facture ${invoice.number} (${amount}) est réglée.`,
        link: `/facturation/${invoice.id}`,
        kind: "paiement",
        read: false,
      });
    }
    if (notes.length) await db.from("notifications").insert(notes);
  }

  return { ok: true, already, invoice: { ...invoice, status: "payee" } };
}

/** Enregistre un échec (sans toucher à la facture). */
export async function recordFailedPayment(db: SupabaseClient, opts: { invoice: Invoice; provider: OnlinePayment["provider"]; providerRef: string | null }) {
  const { data } = await db.from("online_payments").select("*").eq("invoice_id", opts.invoice.id).eq("status", "en_attente");
  const pending = ((data ?? []) as OnlinePayment[]).find((p) => p.provider === opts.provider);
  if (pending) {
    await db.from("online_payments").update({ status: "echoue", provider_ref: opts.providerRef ?? pending.provider_ref }).eq("id", pending.id);
  } else {
    await db.from("online_payments").insert({
      invoice_id: opts.invoice.id,
      client_id: opts.invoice.client_id,
      provider: opts.provider,
      provider_ref: opts.providerRef,
      amount_mad: opts.invoice.amount_mad,
      status: "echoue",
      paid_at: null,
    });
  }
}

/** Libellés d'affichage */
export const PROVIDER_LABEL: Record<OnlinePayment["provider"], string> = { stripe: "Stripe", cmi: "CMI", demo: "Démo" };
export const PAYMENT_STATUS: Record<OnlinePayment["status"], { label: string; tone: "green" | "amber" | "red" }> = {
  reussi: { label: "Réussi", tone: "green" },
  en_attente: { label: "En attente", tone: "amber" },
  echoue: { label: "Échoué", tone: "red" },
};
