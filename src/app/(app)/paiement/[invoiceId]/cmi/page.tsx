import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Loader2, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui";
import { mad } from "@/components/business/format";
import { appBaseUrl, buildCmiFields, cmiGateway } from "@/lib/payments";
import { loadPaymentContext } from "@/components/payments/load";
import { CardMarks } from "@/components/payments/marks";
import { CmiRedirect } from "@/components/payments/cmi-redirect";

export const metadata = { title: "Redirection vers le CMI" };
export const dynamic = "force-dynamic";

export default async function CmiPage({ params }: { params: Promise<{ invoiceId: string }> }) {
  const { invoiceId } = await params;
  const { invoice, client, mode, me } = await loadPaymentContext(invoiceId);
  if (invoice.status === "payee") redirect(`/paiement/${invoice.id}/succes`);
  if (mode !== "cmi" || invoice.status !== "envoyee") redirect(`/paiement/${invoice.id}`);

  const fields = buildCmiFields({ invoice, client, baseUrl: appBaseUrl(await headers()), email: client?.email ?? me.email });

  return (
    <div className="mx-auto grid min-h-[60vh] max-w-md place-items-center">
      <Card className="w-full p-6 text-center animate-fade-up">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-brand-50 text-brand-500">
          <ShieldCheck className="size-7" />
        </span>
        <h1 className="mt-4 font-display text-xl font-extrabold text-ink">Redirection sécurisée</h1>
        <p className="mt-1 text-sm text-muted">
          Vers la page de paiement du Centre Monétique Interbancaire pour régler <b className="text-ink">{mad(invoice.amount_mad)}</b>.
        </p>
        <p className="mt-4 inline-flex items-center gap-2 text-sm text-muted">
          <Loader2 className="size-4 animate-spin" /> Ouverture du CMI…
        </p>
        <div className="mt-5">
          <CmiRedirect gateway={cmiGateway()} fields={fields} />
        </div>
        <CardMarks provider="cmi" className="mt-5 justify-center" />
      </Card>
    </div>
  );
}
