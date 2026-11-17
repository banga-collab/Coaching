import { NextResponse, type NextRequest } from "next/server";
import { getStripe, recordOnlinePayment, SERVICE_ROLE_MISSING, serviceClient } from "@/lib/payments";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Webhook Stripe : à déclarer dans Stripe > Développeurs > Webhooks avec l'URL
 * https://<votre-domaine>/api/stripe/webhook et l'événement `checkout.session.completed`.
 * La signature est vérifiée sur le corps brut avec STRIPE_WEBHOOK_SECRET.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!process.env.STRIPE_SECRET_KEY || !secret) {
    return NextResponse.json({ error: "Stripe n'est pas configuré (STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET)." }, { status: 500 });
  }
  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Signature manquante." }, { status: 400 });

  const raw = await request.text();
  const stripe = getStripe();
  let event: ReturnType<typeof stripe.webhooks.constructEvent>;
  try {
    event = stripe.webhooks.constructEvent(raw, signature, secret);
  } catch {
    return NextResponse.json({ error: "Signature invalide." }, { status: 400 });
  }

  if (event.type !== "checkout.session.completed" && event.type !== "checkout.session.async_payment_succeeded") {
    return NextResponse.json({ received: true, ignored: event.type });
  }

  const session = event.data.object;
  if (session.payment_status !== "paid") return NextResponse.json({ received: true, pending: true });
  const invoiceId = session.metadata?.invoice_id ?? session.client_reference_id;
  if (!invoiceId) return NextResponse.json({ received: true, ignored: "sans facture" });

  const db = serviceClient();
  if (!db) return NextResponse.json({ error: SERVICE_ROLE_MISSING }, { status: 500 });

  if (session.currency && session.currency.toLowerCase() !== "mad") {
    return NextResponse.json({ error: "Devise inattendue." }, { status: 400 });
  }
  const res = await recordOnlinePayment(db, {
    invoiceId,
    provider: "stripe",
    providerRef: session.id,
    expectedAmount: session.amount_total !== null ? session.amount_total / 100 : undefined,
  });
  // Erreur définitive (facture annulée, montant différent…) : 200 pour que Stripe ne réessaie pas indéfiniment.
  if (!res.ok) return NextResponse.json({ received: true, error: res.error ?? "Enregistrement impossible." }, { status: res.permanent ? 200 : 500 });
  return NextResponse.json({ received: true, invoice: invoiceId, already: !!res.already });
}
