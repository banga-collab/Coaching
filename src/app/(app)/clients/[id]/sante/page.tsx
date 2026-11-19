import { notFound } from "next/navigation";
import { CheckCircle2, Watch } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadHealth, lastSyncs, todayKey } from "@/lib/health/server";
import { Card, Empty, PageHeader } from "@/components/ui";
import { BackLink } from "@/components/back-link";
import { HealthDashboard, PeriodSwitch, SourcesCard, daysToLoad, parsePeriod } from "@/components/health-data/dashboard";
import { HealthImporter } from "@/components/health-data/importer";
import { ManualHealthForm } from "@/components/health-data/manual-form";

export const metadata = { title: "Santé connectée" };

export default async function ClientHealthPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ p?: string; saisie?: string; suppr?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  await requireStaff();
  const supabase = await createClient();
  const period = parsePeriod(sp.p);
  const [{ data: c }, samples, syncs] = await Promise.all([
    supabase.from("clients").select("id,full_name,user_id").eq("id", id).maybeSingle(),
    loadHealth(supabase, id, daysToLoad(period)),
    lastSyncs(supabase, id),
  ]);
  if (!c) notFound();
  const today = todayKey();
  const base = `/clients/${id}/sante`;
  const first = (c.full_name as string).split(" ")[0];

  return (
    <>
      <PageHeader
        back={<BackLink href={`/clients/${id}`} label={c.full_name} />}
        title="Santé connectée"
        subtitle={`Données de la montre de ${first} : sommeil, pas, fréquence cardiaque`}
        actions={<PeriodSwitch basePath={base} period={period} />}
      />
      {(sp.saisie === "ok" || sp.suppr === "ok") && (
        <p className="mb-5 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          <CheckCircle2 className="size-4" /> {sp.saisie === "ok" ? "Valeurs enregistrées." : "Données effacées."}
        </p>
      )}

      {samples.length ? (
        <HealthDashboard samples={samples} period={period} today={today} />
      ) : (
        <Card className="mb-5">
          <Empty
            icon={<Watch className="size-6" />}
            title="Aucune donnée de montre"
            text={
              c.user_id
                ? `${first} peut importer l'export de sa montre depuis son espace (Ma santé connectée), ou vous pouvez le faire ci-dessous avec le fichier qu'il vous envoie.`
                : `Importez ci-dessous le fichier d'export de la montre de ${first} (Apple Santé, Samsung Health, Health Connect).`
            }
          />
        </Card>
      )}

      <div className="mt-5 grid gap-5 lg:grid-cols-2 [&>*]:min-w-0">
        <HealthImporter clientId={id} />
        <div className="space-y-5">
          <SourcesCard samples={samples} syncs={syncs} clientId={id} back={base} canDelete />
          <details className="group">
            <summary className="cursor-pointer list-none rounded-xl border border-line bg-white px-4 py-3 text-sm font-semibold text-ink hover:bg-canvas">Saisir des valeurs à la main</summary>
            <div className="mt-3">
              <ManualHealthForm clientId={id} back={base} today={today} title="Saisie manuelle" subtitle="Valeurs données par l'adhérent (sommeil, pas, FC au repos, poids)." />
            </div>
          </details>
        </div>
      </div>
    </>
  );
}
