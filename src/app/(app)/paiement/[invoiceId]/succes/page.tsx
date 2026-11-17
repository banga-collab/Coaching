import { CheckCircle2, Clock, Download, Receipt } from "lucide-react";
import { Card, LinkButton } from "@/components/ui";
import { mad } from "@/components/business/format";
import { fmtDate, fmtTime } from "@/lib/utils";
import { getStripe, PROVIDER_LABEL, recordOnlinePayment, serviceClient, stripeReady } from "@/lib/payments";
import { loadPaymentContext, backHref } from "@/components/payments/load";
import { PendingRefresh } from "@/components/payments/pending-refresh";

export const metadata = { title: "Paiement confirmé" };
export const dynamic = "force-dynamic";

/** Confirme côté serveur une session Stripe (au cas où le webhook arrive après le retour du client). */
async function confirmStripe(invoiceId: string, sessionId: string) {
  if (!stripeReady() || !/^cs_[A-Za-z0-9_]+$/.test(sessionId)) return;
  const db = serviceClient();
  if (!db) return;
  try {
    const s = await getStripe().checkout.sessions.retrieve(sessionId);
    if (s.payment_status !== "paid" || (s.metadata?.invoice_id ?? s.client_reference_id) !== invoiceId) return;
    await recordOnlinePayment(db, { invoiceId, provider: "stripe", providerRef: s.id, expectedAmount: s.amount_total !== null ? s.amount_total / 100 : undefined });
  } catch {
    // Le webhook prendra le relais.
  }
}

export default async function PaymentSuccessPage({ params, searchParams }: { params: Promise<{ invoiceId: string }>; searchParams: Promise<{ session_id?: string }> }) {
  const { invoiceId } = await params;
  const { session_id } = await searchParams;
  let ctx = await loadPaymentContext(invoiceId);
  if (ctx.invoice.status !== "payee" && session_id) {
    await confirmStripe(invoiceId, session_id);
    ctx = await loadPaymentContext(invoiceId);
  }
  const { invoice, client, isStaff, payments, me } = ctx;
  const paid = invoice.status === "payee";
  const pay = payments.find((p) => p.status === "reussi");
  const first = (client?.full_name ?? me.full_name ?? "").split(" ")[0];

  return (
    <div className="mx-auto grid min-h-[60vh] max-w-lg place-items-center">
      <Card className="relative w-full overflow-hidden text-center animate-fade-up">
        <div className={paid ? "h-1.5 bg-gradient-to-r from-emerald-400 to-brand-500" : "h-1.5 bg-gradient-to-r from-amber-300 to-accent-500"} />
        <div className="p-6 sm:p-8">
          <span className={`mx-auto grid size-16 place-items-center rounded-full ${paid ? "bg-emerald-50 text-emerald-500 ring-8 ring-emerald-50/60" : "bg-amber-50 text-amber-500 ring-8 ring-amber-50/60"}`}>
            {paid ? <CheckCircle2 className="size-9" /> : <Clock className="size-8" />}
          </span>
          <h1 className="mt-5 font-display text-2xl font-extrabold tracking-tight text-ink">
            {paid ? (isStaff ? "Paiement confirmé" : `Merci ${first} ! 🎉`) : "Paiement en cours de validation"}
          </h1>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
            {paid
              ? isStaff
                ? `La facture ${invoice.number} est marquée comme payée et le coach a été notifié.`
                : `Ton paiement est bien reçu : ta facture ${invoice.number} est réglée. À très vite à la salle !`
              : "Nous attendons la confirmation de la banque. Cette page se met à jour automatiquement."}
          </p>

          <dl className="mx-auto mt-6 grid max-w-sm grid-cols-2 gap-px overflow-hidden rounded-2xl bg-line text-left text-sm ring-1 ring-line">
            <div className="bg-white px-4 py-3">
              <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Montant</dt>
              <dd className="mt-0.5 font-display font-bold tabular-nums text-ink">{mad(invoice.amount_mad)}</dd>
            </div>
            <div className="bg-white px-4 py-3">
              <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Facture</dt>
              <dd className="mt-0.5 font-mono text-[13px] font-semibold text-ink">{invoice.number}</dd>
            </div>
            <div className="bg-white px-4 py-3">
              <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Moyen</dt>
              <dd className="mt-0.5 font-semibold text-ink">{pay ? `Carte · ${PROVIDER_LABEL[pay.provider]}` : (invoice.method ?? "Carte")}</dd>
            </div>
            <div className="bg-white px-4 py-3">
              <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Date</dt>
              <dd className="mt-0.5 font-semibold text-ink">
                {pay?.paid_at ? `${fmtDate(pay.paid_at, { day: "numeric", month: "short" })} · ${fmtTime(pay.paid_at)}` : invoice.paid_on ? fmtDate(invoice.paid_on) : "—"}
              </dd>
            </div>
          </dl>

          {!paid && (
            <div className="mt-5">
              <PendingRefresh />
            </div>
          )}

          <div className="mt-7 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <LinkButton href={`/facturation/${invoice.id}`} variant="brand" className="h-12 sm:h-11">
              <Download className="size-4" /> Voir / imprimer la facture
            </LinkButton>
            <LinkButton href={isStaff ? "/facturation" : backHref(false, invoice.id)} variant="secondary" className="h-12 sm:h-11">
              <Receipt className="size-4" /> {isStaff ? "Facturation" : "Mes factures"}
            </LinkButton>
          </div>
        </div>
      </Card>
    </div>
  );
}
