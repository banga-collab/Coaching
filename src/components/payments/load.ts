import { notFound } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings";
import { paymentMode } from "@/lib/payments";
import type { Client, Invoice, OnlinePayment } from "@/lib/types";

const UUID = /^[0-9a-f-]{36}$/i;

/** Charge une facture pour les pages /paiement/* et vérifie l'accès (membre propriétaire ou staff). */
export async function loadPaymentContext(invoiceId: string) {
  if (!UUID.test(invoiceId)) notFound();
  const me = await getProfile();
  const supabase = await createClient();
  const { data: iData } = await supabase.from("invoices").select("*").eq("id", invoiceId).maybeSingle();
  const invoice = iData as Invoice | null;
  if (!invoice) notFound();
  const [{ data: cData }, { data: pData }, settings] = await Promise.all([
    supabase.from("clients").select("*").eq("id", invoice.client_id).maybeSingle(),
    supabase.from("online_payments").select("*").eq("invoice_id", invoice.id).order("created_at", { ascending: false }),
    getSettings(),
  ]);
  const client = cData as Client | null;
  const isStaff = me.role !== "client";
  if (!isStaff && (client?.user_id !== me.id || invoice.status === "brouillon")) notFound();
  const payments = (pData ?? []) as OnlinePayment[];
  return { me, supabase, invoice, client, isStaff, settings, payments, ...paymentMode(settings) };
}

export const backHref = (isStaff: boolean, invoiceId: string) => (isStaff ? `/facturation/${invoiceId}` : "/moi?tab=factures");
