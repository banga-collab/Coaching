import Link from "next/link";
import { Activity, CalendarCheck2, Coins, LineChart, UserCheck, UserPlus, Users, UsersRound } from "lucide-react";
import type { ReactNode } from "react";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PERIODS, loadCeo, parsePeriod } from "@/lib/ceo";
import { cn, fmtDate, fmtTime } from "@/lib/utils";
import { Badge } from "@/components/ui";
import { PrintButton } from "@/components/print-button";
import { Donut } from "@/components/analytics/charts";
import { ActivityChart } from "@/components/admin/ceo/activity-chart";
import { ClientsChart, CoachSalesChart, SalesChart } from "@/components/admin/ceo/trend-charts";
import { HBar, KpiTile, MoreLink, Panel, Section } from "@/components/admin/ceo/sections";
import { fmtInt, fmtMad } from "@/components/admin/ceo/format";

export const metadata = { title: "Vue CEO" };

/** Vue CEO : uniquement les chiffres (ventes, clients, séances) et les graphiques. */
const KPI_ORDER = ["valeur", "actifs", "nouveaux", "venus", "seances"] as const;
const KPI_ICONS: Record<string, ReactNode> = {
  valeur: <Coins className="size-4" />,
  actifs: <UserCheck className="size-4" />,
  nouveaux: <UserPlus className="size-4" />,
  venus: <Users className="size-4" />,
  seances: <CalendarCheck2 className="size-4" />,
};

export default async function CeoPage({ searchParams }: { searchParams: Promise<{ periode?: string }> }) {
  const [, sp] = await Promise.all([requireAdmin(), searchParams]);
  const key = parsePeriod(sp.periode);
  const supabase = await createClient();
  const d = await loadCeo(supabase, key);
  const { period, activity, coaches } = d;
  const kpis = KPI_ORDER.map((k) => d.kpis.find((x) => x.key === k)).filter((k): k is NonNullable<typeof k> => !!k);
  const year = activity.sales.reduce((a, r) => ({ ventes: a.ventes + r.ventes, seances: a.seances + r.seances, nouveaux: a.nouveaux + r.nouveaux }), { ventes: 0, seances: 0, nouveaux: 0 });
  const typeTotal = activity.salesTypes.reduce((n, t) => n + t.value, 0);
  const typeMax = activity.salesTypes[0]?.value ?? 0;
  const coachSales = [...coaches].sort((a, b) => b.value - a.value).map((c) => ({ name: c.name, value: c.value, done: c.done }));

  return (
    <div className="ceo-print">
      <style>{`@media print {
        main { padding: 0 !important; }
        .ceo-print a { text-decoration: none; }
        .ceo-print .shadow-card, .ceo-print .shadow-pop { box-shadow: none !important; }
      }`}</style>

      {/* En-tête + période */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-accent-600">Vue CEO · Moov&apos;Up Coaching</p>
          <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight text-ink sm:text-[28px]">{period.cur.label}</h1>
          <p className="mt-1 text-sm text-muted">
            Ventes, clients et séances · comparaison {period.compareLabel} · mis à jour le {fmtDate(d.generatedAt, { day: "numeric", month: "long" })} à {fmtTime(d.generatedAt)}
          </p>
        </div>
        <div className="no-print flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <nav className="flex flex-1 rounded-xl border border-line bg-white p-1 text-sm font-semibold shadow-card sm:flex-none" aria-label="Période">
            {PERIODS.map((p) => (
              <Link
                key={p.key}
                href={p.key === "mois" ? "/admin" : `/admin?periode=${p.key}`}
                aria-current={p.key === key ? "page" : undefined}
                className={cn("flex-1 whitespace-nowrap rounded-lg px-3 py-1.5 text-center transition sm:flex-none", p.key === key ? "bg-brand-500 text-white" : "text-muted hover:bg-canvas hover:text-ink")}
              >
                {p.short}
              </Link>
            ))}
          </nav>
          <PrintButton />
        </div>
      </div>

      {/* Chiffres clés */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {kpis.map((k) => (
          <KpiTile key={k.key} k={k} icon={KPI_ICONS[k.key]} compare={period.compareLabel} />
        ))}
      </div>
      <p className="mt-2 text-[11px] text-muted">
        Flèches : évolution {period.compareLabel} ({period.prev.label}). Ventes = prix des séances réalisées, pas de caisse ni d&apos;encaissement.
      </p>

      {/* Ventes */}
      <Section title="Ventes" subtitle="Chiffre des séances réalisées" icon={<Coins className="size-4" />}>
        <div className="grid gap-4 lg:grid-cols-[1.65fr_1fr]">
          <Panel title="Chiffre des ventes sur 12 mois" subtitle={`${fmtMad(year.ventes)} · ${fmtInt(year.seances)} séances réalisées`}>
            <div className="px-3 pb-4 sm:px-5">
              <SalesChart data={activity.sales} />
            </div>
          </Panel>
          <Panel title="Ventes par type de séance" subtitle={period.cur.label} action={<MoreLink href="/seances/types">Types</MoreLink>}>
            <div className="space-y-1 px-5 pb-5">
              {activity.salesTypes.length ? (
                activity.salesTypes.slice(0, 7).map((t) => (
                  <HBar key={t.label} label={t.label} value={t.value} max={typeMax} right={fmtMad(t.value)} tone="bg-accent-500" sub={`${typeTotal ? Math.round((t.value / typeTotal) * 100) : 0} % des ventes`} />
                ))
              ) : (
                <p className="text-sm text-muted">Aucune vente sur la période.</p>
              )}
            </div>
          </Panel>
        </div>
        <div className="mt-4">
          <Panel title="Ventes par coach" subtitle={`${period.cur.label} · séances réalisées`} action={<MoreLink href="/coachs">Coachs</MoreLink>}>
            <div className="px-3 pb-4 sm:px-5">{coachSales.length ? <CoachSalesChart data={coachSales} /> : <p className="text-sm text-muted">Aucun coach actif.</p>}</div>
          </Panel>
        </div>
      </Section>

      {/* Clients */}
      <Section title="Clients" subtitle="Clients venus et nouveaux clients" icon={<UsersRound className="size-4" />} action={<MoreLink href="/clients">Tous les clients</MoreLink>}>
        <Panel title="Clients par mois" subtitle={`${fmtInt(year.nouveaux)} nouveaux clients sur 12 mois`} action={<Badge tone="brand">12 mois</Badge>}>
          <div className="px-3 pb-4 sm:px-5">
            <ClientsChart data={activity.sales} />
          </div>
        </Panel>
      </Section>

      {/* Séances */}
      <Section title="Séances" subtitle="Volume et types de séances" icon={<Activity className="size-4" />}>
        <div className="grid gap-4 lg:grid-cols-[1.65fr_1fr]">
          <Panel title="Séances sur 12 mois" subtitle="Réalisées, absences et annulations / refus">
            <div className="px-3 pb-4 sm:px-5">
              <ActivityChart months={activity.months} weeks={activity.weeks} />
            </div>
          </Panel>
          <Panel title="Types de séance" subtitle={`Séances réalisées · ${period.cur.label}`}>
            <div className="px-5 pb-5">
              {activity.types.length ? <Donut data={activity.types} centerLabel="réalisées" /> : <p className="text-sm text-muted">Aucune séance réalisée sur la période.</p>}
            </div>
          </Panel>
        </div>
      </Section>

      <p className="mt-8 flex items-center gap-2 text-[11px] text-muted">
        <LineChart className="size-3.5" />
        Le détail (clients à risque, coachs, réclamations) reste accessible dans l&apos;application : Clients, Coachs, Réclamations.
      </p>
    </div>
  );
}
