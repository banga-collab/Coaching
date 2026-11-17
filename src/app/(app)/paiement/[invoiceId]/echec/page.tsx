import { redirect } from "next/navigation";
import { MessageCircle, RotateCcw, XCircle } from "lucide-react";
import { Card, LinkButton } from "@/components/ui";
import { mad } from "@/components/business/format";
import { loadPaymentContext, backHref } from "@/components/payments/load";

export const metadata = { title: "Paiement non abouti" };

export default async function PaymentFailurePage({ params, searchParams }: { params: Promise<{ invoiceId: string }>; searchParams: Promise<{ raison?: string }> }) {
  const { invoiceId } = await params;
  const { raison } = await searchParams;
  const { invoice, isStaff } = await loadPaymentContext(invoiceId);
  if (invoice.status === "payee") redirect(`/paiement/${invoice.id}/succes`);
  const cancelled = raison === "annule";

  return (
    <div className="mx-auto grid min-h-[60vh] max-w-lg place-items-center">
      <Card className="w-full overflow-hidden text-center animate-fade-up">
        <div className="h-1.5 bg-gradient-to-r from-red-400 to-accent-500" />
        <div className="p-6 sm:p-8">
          <span className="mx-auto grid size-16 place-items-center rounded-full bg-red-50 text-red-500 ring-8 ring-red-50/60">
            <XCircle className="size-9" />
          </span>
          <h1 className="mt-5 font-display text-2xl font-extrabold tracking-tight text-ink">{cancelled ? "Paiement annulé" : "Paiement refusé"}</h1>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
            {cancelled
              ? `Le paiement de ${mad(invoice.amount_mad)} a été interrompu. Aucun montant n'a été débité.`
              : `La banque n'a pas accepté le paiement de ${mad(invoice.amount_mad)}. Aucun montant n'a été débité.`}
          </p>
          <ul className="mx-auto mt-5 max-w-sm space-y-1.5 rounded-2xl bg-canvas/70 p-4 text-left text-sm text-slate-600">
            <li>• Vérifie le numéro, la date d&apos;expiration et le code CVC.</li>
            <li>• Assure-toi que le paiement en ligne est activé sur ta carte.</li>
            <li>• Valide la demande 3-D Secure envoyée par ta banque.</li>
          </ul>
          <div className="mt-7 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <LinkButton href={`/paiement/${invoice.id}`} className="h-12 sm:h-11">
              <RotateCcw className="size-4" /> Réessayer
            </LinkButton>
            <LinkButton href={isStaff ? backHref(true, invoice.id) : "/moi/messages"} variant="secondary" className="h-12 sm:h-11">
              {isStaff ? (
                "Retour à la facture"
              ) : (
                <>
                  <MessageCircle className="size-4" /> Écrire à mon coach
                </>
              )}
            </LinkButton>
          </div>
        </div>
      </Card>
    </div>
  );
}
