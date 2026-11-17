import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Client, Package } from "@/lib/types";
import { addDays, dayKey } from "@/lib/utils";
import { PageHeader } from "@/components/ui";
import { BackLink } from "@/components/back-link";
import { InvoiceForm } from "@/components/business/invoice-form";

export const metadata = { title: "Nouvelle facture" };

export default async function NewInvoicePage({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  await requireStaff();
  const { client } = await searchParams;
  const supabase = await createClient();
  const [{ data: cData }, { data: pData }] = await Promise.all([
    supabase.from("clients").select("*").order("full_name"),
    supabase.from("packages").select("*").eq("active", true).order("price_mad"),
  ]);
  const clients = ((cData ?? []) as Client[]).map((c) => ({ id: c.id, full_name: c.full_name }));
  const packages = (pData ?? []) as Package[];
  const preset = client && clients.some((c) => c.id === client) ? client : undefined;

  return (
    <>
      <PageHeader
        back={<BackLink href={preset ? `/clients/${preset}?tab=factures` : "/facturation"} label={preset ? "Retour au client" : "Facturation"} />}
        title="Nouvelle facture"
        subtitle="Le numéro est attribué automatiquement (MU-année-NNNN)."
      />
      <InvoiceForm clients={clients} packages={packages} defaultClient={preset} today={dayKey(new Date())} defaultDue={dayKey(addDays(new Date(), 7))} />
    </>
  );
}
