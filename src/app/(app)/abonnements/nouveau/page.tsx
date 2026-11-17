import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Client, Package } from "@/lib/types";
import { todayKey } from "@/lib/memberships";
import { PageHeader } from "@/components/ui";
import { BackLink } from "@/components/back-link";
import { MembershipForm } from "@/components/memberships/membership-form";

export const metadata = { title: "Nouvel abonnement" };

export default async function NewMembershipPage({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  await requireStaff();
  const { client } = await searchParams;
  const supabase = await createClient();
  const [{ data: cData }, { data: pData }] = await Promise.all([
    supabase.from("clients").select("*").order("full_name"),
    supabase.from("packages").select("*").eq("active", true).order("price_mad"),
  ]);
  const clients = ((cData ?? []) as Client[]).filter((c) => c.status !== "termine" || c.id === client).map((c) => ({ id: c.id, full_name: c.full_name }));
  const packages = (pData ?? []) as Package[];
  const preset = client && clients.some((c) => c.id === client) ? client : undefined;

  return (
    <>
      <PageHeader
        back={<BackLink href={preset ? `/clients/${preset}?tab=abonnement` : "/abonnements"} label={preset ? "Retour à la fiche" : "Abonnements"} />}
        title="Nouvel abonnement"
        subtitle="Choisissez une formule : durée, séances et prix sont pré-remplis et restent modifiables."
      />
      <MembershipForm clients={clients} packages={packages} defaultClient={preset} today={todayKey()} back={preset ? `/clients/${preset}?tab=abonnement` : undefined} />
    </>
  );
}
