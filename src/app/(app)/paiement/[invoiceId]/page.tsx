import Link from "next/link";
import { AlertTriangle, CheckCircle2, CreditCard, FlaskConical, Info, Store } from "lucide-react";
import { BackLink } from "@/components/back-link";
import { Card, LinkButton, PageHeader } from "@/components/ui";
import { mad } from "@/components/business/format";
import { fmtDate } from "@/lib/utils";
import { canSimulate } from "@/lib/payments";
import { loadPaymentContext, backHref } from "@/components/payments/load";
import { InvoiceSummary } from "@/components/payments/invoice-summary";
import { CardMarks, ProviderName, SecureBadge } from "@/components/payments/marks";
import { PayForm } from "@/components/payments/pay-form";

export const metadata = { title: "Paiement en ligne" };

export default async function PaymentPage({ params }: { params: Promise<{ invoiceId: string }> }) {
  const { invoiceId } = await params;
  const { invoice, client, isStaff, settings, mode, reason, me } = await loadPaymentContext(invoiceId);
  const back = backHref(isStaff, invoice.id);
  const first = (client?.full_name ?? me.full_name ?? "").split(" ")[0];

  const blocked =
    invoice.status === "payee"
      ? "paid"
      : invoice.status === "annulee"
        ? "cancelled"
        : invoice.status === "brouillon"
          ? "draft"
          : mode === "off"
            ? "off"
            : mode === "demo" && !canSimulate(me.role)
              ? "unavailable"
              : null;

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        back={<BackLink href={back} label={isStaff ? "Retour à la facture" : "Mes factures"} />}
        title="Paiement en ligne"
        subtitle={isStaff ? `Régler la facture ${invoice.number} par carte bancaire.` : `Règle ta facture en quelques secondes, ${first} 💳`}
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <div className="space-y-4">
          <InvoiceSummary invoice={invoice} client={client} brand={settings.brand_name} />
          <Card className="p-5">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Moyens de paiement acceptés</p>
            <CardMarks provider={mode} />
            <p className="mt-3 text-xs leading-relaxed text-muted">
              {mode === "cmi"
                ? "Cartes bancaires marocaines (CMI) et cartes internationales Visa / Mastercard, avec authentification 3-D Secure."
                : mode === "stripe"
                  ? "Cartes Visa, Mastercard et American Express, marocaines ou internationales, avec authentification 3-D Secure."
                  : "Démonstration du parcours de paiement : utilisez la carte de test 4242 4242 4242 4242."}
            </p>
          </Card>
        </div>

        <Card className="p-5 lg:sticky lg:top-6">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Prestataire</p>
            <ProviderName mode={mode} />
          </div>
          <div className="my-4 rounded-2xl bg-canvas/70 px-4 py-4 text-center">
            <p className="text-xs font-medium text-muted">Montant total</p>
            <p className="font-display text-3xl font-extrabold tracking-tight text-ink tabular-nums">{mad(invoice.amount_mad)}</p>
            <p className="mt-0.5 text-[11px] text-muted">Dirham marocain (MAD) · TTC</p>
          </div>

          {blocked === "paid" ? (
            <div className="space-y-3 text-center">
              <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-emerald-50 text-emerald-600">
                <CheckCircle2 className="size-6" />
              </span>
              <p className="font-display font-bold text-ink">Facture déjà réglée</p>
              <p className="text-sm text-muted">
                {invoice.paid_on ? `Payée le ${fmtDate(invoice.paid_on, { day: "numeric", month: "long" })}` : "Payée"}
                {invoice.method ? ` · ${invoice.method}` : ""}
              </p>
              <LinkButton href={`/facturation/${invoice.id}`} variant="secondary" className="h-11 w-full">
                Voir la facture
              </LinkButton>
            </div>
          ) : blocked ? (
            <div className="space-y-3">
              <p className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {blocked === "off" || blocked === "unavailable" ? <Store className="mt-0.5 size-4 shrink-0" /> : <AlertTriangle className="mt-0.5 size-4 shrink-0" />}
                <span>
                  {blocked === "cancelled" && "Cette facture a été annulée : aucun paiement n'est attendu."}
                  {blocked === "draft" && "Cette facture est encore un brouillon. Marquez-la comme envoyée pour permettre le paiement en ligne."}
                  {(blocked === "off" || blocked === "unavailable") &&
                    (isStaff
                      ? "Le paiement en ligne n'est pas activé. Configurez un prestataire dans Paramètres."
                      : "Le paiement en ligne n'est pas encore disponible. Tu peux régler ta facture à l'accueil de la salle.")}
                </span>
              </p>
              {isStaff && (blocked === "off" || blocked === "unavailable") && me.role === "admin" && (
                <LinkButton href="/parametres#paiement-en-ligne" variant="secondary" className="h-11 w-full">
                  Ouvrir les paramètres
                </LinkButton>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {mode === "demo" && (
                <p className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-xs leading-relaxed text-amber-800">
                  <FlaskConical className="mt-0.5 size-4 shrink-0" />
                  <span>
                    <b className="font-semibold">Paiement simulé (mode démo).</b> {reason}
                  </span>
                </p>
              )}
              <PayForm invoiceId={invoice.id} label={`Payer ${mad(invoice.amount_mad)}`} />
              <SecureBadge mode={mode} />
              {isStaff && (
                <p className="flex items-start gap-2 text-xs text-muted">
                  <Info className="mt-0.5 size-3.5 shrink-0" />
                  Astuce : partagez le lien de cette page avec le client pour qu&apos;il paie depuis son espace membre.
                </p>
              )}
            </div>
          )}

          <p className="mt-4 flex items-center justify-center gap-1.5 border-t border-line pt-4 text-[11px] text-muted">
            <CreditCard className="size-3.5" /> Besoin d&apos;aide ?{" "}
            {settings.phone ? (
              <a href={`tel:${settings.phone.replace(/\s/g, "")}`} className="font-semibold text-brand-600 hover:underline">
                {settings.phone}
              </a>
            ) : (
              <Link href={isStaff ? "/facturation" : "/moi/messages"} className="font-semibold text-brand-600 hover:underline">
                Contacter la salle
              </Link>
            )}
          </p>
        </Card>
      </div>
    </div>
  );
}
