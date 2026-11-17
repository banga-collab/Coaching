import { redirect } from "next/navigation";
import { FlaskConical } from "lucide-react";
import { BackLink } from "@/components/back-link";
import { Card, PageHeader } from "@/components/ui";
import { mad } from "@/components/business/format";
import { canSimulate } from "@/lib/payments";
import { loadPaymentContext } from "@/components/payments/load";
import { InvoiceSummary } from "@/components/payments/invoice-summary";
import { SecureBadge } from "@/components/payments/marks";
import { DemoCheckout } from "@/components/payments/demo-checkout";

export const metadata = { title: "Paiement simulé" };

export default async function DemoCheckoutPage({ params }: { params: Promise<{ invoiceId: string }> }) {
  const { invoiceId } = await params;
  const { invoice, client, settings, mode, reason, me } = await loadPaymentContext(invoiceId);
  if (invoice.status === "payee") redirect(`/paiement/${invoice.id}/succes`);
  if (mode !== "demo" || invoice.status !== "envoyee" || !canSimulate(me.role)) redirect(`/paiement/${invoice.id}`);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader back={<BackLink href={`/paiement/${invoice.id}`} label="Retour" />} title="Paiement par carte" subtitle={`${settings.brand_name} · ${mad(invoice.amount_mad)}`} />

      <div className="mb-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 px-4 py-3.5 text-amber-900 animate-fade-up">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-700">
          <FlaskConical className="size-5" />
        </span>
        <div className="text-sm">
          <p className="font-display font-bold">Paiement simulé (mode démo)</p>
          <p className="mt-0.5 text-amber-800/90">{reason} Aucune donnée n&apos;est transmise à une banque : la facture sera simplement marquée comme payée.</p>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
        <div className="order-2 lg:order-1">
          <InvoiceSummary invoice={invoice} client={client} brand={settings.brand_name} />
        </div>
        <Card className="order-1 space-y-4 p-5 lg:order-2">
          <DemoCheckout invoiceId={invoice.id} amount={mad(invoice.amount_mad)} holder={(client?.full_name ?? "").toUpperCase()} />
          <SecureBadge mode="demo" />
        </Card>
      </div>
    </div>
  );
}
