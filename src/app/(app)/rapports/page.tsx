import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import { ReportBuilder, type ReportClient } from "@/components/reports/report-builder";

export const metadata = { title: "Rapports clients" };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ client?: string; clients?: string }> }) {
  const [sp] = await Promise.all([searchParams, requireStaff()]);
  const supabase = await createClient();
  const { data } = await supabase.from("clients").select("id, full_name, status, goal").order("full_name").limit(5000);
  const clients = (data ?? []) as ReportClient[];
  const preselected = [sp.client, sp.clients]
    .filter(Boolean)
    .join(",")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    <>
      <PageHeader
        title="Rapports clients"
        subtitle="Progression, santé, séances et présence sur une période — en PDF ou Excel, avec l'en-tête Moov'Up."
      />
      <ReportBuilder clients={clients} preselected={preselected} />
    </>
  );
}
