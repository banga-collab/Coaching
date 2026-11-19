import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { CheckCircle2, Watch } from "lucide-react";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadHealth, lastSyncs, todayKey } from "@/lib/health/server";
import { Card, Empty, PageHeader } from "@/components/ui";
import { BackLink } from "@/components/back-link";
import { HealthDashboard, PeriodSwitch, SourcesCard, daysToLoad, parsePeriod } from "@/components/health-data/dashboard";
import { HealthImporter } from "@/components/health-data/importer";
import { ManualHealthForm } from "@/components/health-data/manual-form";
import { HealthTokenCard, type TokenRow } from "@/components/health-data/token-card";

export const metadata = { title: "Ma santé connectée" };

export default async function MyHealthPage({ searchParams }: { searchParams: Promise<{ p?: string; saisie?: string; suppr?: string }> }) {
  const sp = await searchParams;
  const me = await getProfile();
  const supabase = await createClient();
  const { data: c } = await supabase.from("clients").select("id,full_name").eq("user_id", me.id).maybeSingle();
  if (!c) redirect("/moi");
  const period = parsePeriod(sp.p);
  const [samples, syncs, { data: tData }, h] = await Promise.all([
    loadHealth(supabase, c.id, daysToLoad(period)),
    lastSyncs(supabase, c.id),
    supabase.from("health_tokens").select("id,label,created_at,last_used_at").eq("client_id", c.id).order("created_at", { ascending: false }),
    headers(),
  ]);
  const today = todayKey();
  const base = "/moi/sante";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const endpoint = `${host ? `${proto}://${host}` : ""}/api/health/sync`;

  return (
    <>
      <PageHeader
        back={<BackLink href="/moi" label="Ma progression" />}
        title="Ma santé connectée"
        subtitle="Sommeil, pas et fréquence cardiaque de ta montre, partagés avec ton coach"
        actions={<PeriodSwitch basePath={base} period={period} />}
      />
      {(sp.saisie === "ok" || sp.suppr === "ok") && (
        <p className="mb-5 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          <CheckCircle2 className="size-4" /> {sp.saisie === "ok" ? "C'est noté ! Ton coach le verra." : "Données effacées."}
        </p>
      )}

      <div className="mb-5">
        <ManualHealthForm clientId={c.id} back={base} today={today} />
      </div>

      {samples.length ? (
        <HealthDashboard samples={samples} period={period} today={today} />
      ) : (
        <Card>
          <Empty icon={<Watch className="size-6" />} title="Pas encore de données" text="Importe l'export de ta montre ci-dessous, ou note ta nuit et tes pas avec la saisie rapide." />
        </Card>
      )}

      <div className="mt-5 grid gap-5 lg:grid-cols-2 [&>*]:min-w-0">
        <HealthImporter clientId={c.id} />
        <div className="space-y-5">
          <HealthTokenCard clientId={c.id} tokens={(tData ?? []) as TokenRow[]} endpoint={endpoint} />
          <SourcesCard samples={samples} syncs={syncs} clientId={c.id} back={base} canDelete />
        </div>
      </div>
    </>
  );
}
