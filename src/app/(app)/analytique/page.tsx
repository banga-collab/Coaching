import Link from "next/link";
import {
  Activity,
  BarChart3,
  CalendarCheck2,
  CalendarDays,
  Clock,
  Crown,
  Download,
  FileSpreadsheet,
  HeartPulse,
  PieChart as PieIcon,
  Ruler,
  Scale,
  Target,
  TrendingUp,
  UserCheck,
  Users,
  Wallet,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth";
import type { Client, Goal, Invoice, Measurement, Profile, Session } from "@/lib/types";
import { cn, dayKey, fmtDate, signed } from "@/lib/utils";
import { Avatar, Badge, Card, CardHeader, Empty, Input, Kpi, PageHeader } from "@/components/ui";
import { ActiveClientsLine, Donut, RevenueArea, StackedSessions } from "@/components/analytics/charts";

const PERIODS = [3, 6, 12] as const;
const mad = (v: number) => `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Math.round(v))} MAD`;
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : null);

const tzParts = new Intl.DateTimeFormat("en-US", { timeZone: "Africa/Casablanca", weekday: "short", hour: "numeric", hourCycle: "h23" });
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAY_FR = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
const SLOTS = [6, 8, 10, 12, 14, 16, 18, 20];

function monthsAgo(d: Date, n: number) {
  const x = new Date(d);
  x.setMonth(x.getMonth() - n);
  return x;
}

function deltaText(cur: number, prev: number, suffix = "vs période précédente") {
  if (!prev) return cur ? `Nouveau ${suffix.replace("vs ", "sur la ")}` : "Aucune donnée précédente";
  const p = Math.round(((cur - prev) / prev) * 100);
  return `${p > 0 ? "+" : p < 0 ? "−" : "±"}${Math.abs(p)} % ${suffix}`;
}

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const me = await requireStaff();
  const { p } = await searchParams;
  const months = (PERIODS as readonly number[]).includes(Number(p)) ? Number(p) : 6;
  const supabase = await createClient();

  const now = new Date();
  const from = monthsAgo(now, months);
  const prevFrom = monthsAgo(now, months * 2);

  const [{ data: cData }, { data: sData }, { data: iData }, { data: pData }, { data: gData }, { data: mData }] = await Promise.all([
    supabase.from("clients").select("*").order("full_name"),
    supabase.from("sessions").select("*").gte("starts_at", prevFrom.toISOString()).order("starts_at").limit(10000),
    supabase.from("invoices").select("*").order("issued_on").limit(10000),
    supabase.from("profiles").select("*").in("role", ["coach", "admin"]).order("full_name"),
    supabase.from("goals").select("*").limit(5000),
    supabase.from("measurements").select("*").order("measured_on", { ascending: true }).limit(10000),
  ]);
  const clients = (cData ?? []) as Client[];
  const sessions = (sData ?? []) as Session[];
  const invoices = (iData ?? []) as Invoice[];
  const goals = (gData ?? []) as Goal[];
  const meas = (mData ?? []) as Measurement[];
  let coaches = (pData ?? []) as Profile[];
  if (me.role === "coach") coaches = coaches.filter((c) => c.id === me.id);
  if (me.role === "coach" && !coaches.length) coaches = [me];

  const clientById = new Map(clients.map((c) => [c.id, c]));
  const active = clients.filter((c) => c.status === "actif");

  /* ---------- Périodes ---------- */
  const inRange = (iso: string, a: Date, b: Date) => {
    const t = new Date(iso).getTime();
    return t >= a.getTime() && t < b.getTime();
  };
  const paid = invoices.filter((i) => i.status === "payee");
  const paidDate = (i: Invoice) => i.paid_on ?? i.issued_on;
  const paidCur = paid.filter((i) => inRange(paidDate(i), from, now));
  const paidPrev = paid.filter((i) => inRange(paidDate(i), prevFrom, from));
  const revenue = paidCur.reduce((a, i) => a + Number(i.amount_mad), 0);
  const revenuePrev = paidPrev.reduce((a, i) => a + Number(i.amount_mad), 0);
  const basket = paidCur.length ? revenue / paidCur.length : 0;

  const sCur = sessions.filter((s) => inRange(s.starts_at, from, now));
  const sPrev = sessions.filter((s) => inRange(s.starts_at, prevFrom, from));
  const done = sCur.filter((s) => s.status === "realisee");
  const absent = sCur.filter((s) => s.status === "absent");
  const donePrev = sPrev.filter((s) => s.status === "realisee").length;
  const attendance = pct(done.length, done.length + absent.length);
  const attendancePrev = pct(donePrev, donePrev + sPrev.filter((s) => s.status === "absent").length);

  const d30 = new Date(now.getTime() - 30 * 86400000);
  const recentIds = new Set(sessions.filter((s) => s.status === "realisee" && inRange(s.starts_at, d30, now)).map((s) => s.client_id));
  const retained = active.filter((c) => recentIds.has(c.id)).length;
  const retention = pct(retained, active.length);

  /* ---------- Séries mensuelles ---------- */
  const monthList = Array.from({ length: months }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = fmtDate(d, months === 12 ? { month: "short", year: "2-digit" } : { month: "short" });
    return { key, label: label.charAt(0).toUpperCase() + label.slice(1) };
  });
  const monthOf = (iso: string) => dayKey(iso).slice(0, 7);
  const revenueByMonth = monthList.map((m) => ({
    label: m.label,
    value: paid.filter((i) => paidDate(i).slice(0, 7) === m.key).reduce((a, i) => a + Number(i.amount_mad), 0),
  }));
  const sessionsByMonth = monthList.map((m) => {
    const ms = sessions.filter((s) => monthOf(s.starts_at) === m.key);
    return {
      label: m.label,
      realisee: ms.filter((s) => s.status === "realisee").length,
      planifiee: ms.filter((s) => s.status === "planifiee").length,
      absent: ms.filter((s) => s.status === "absent").length,
      annulee: ms.filter((s) => s.status === "annulee").length,
    };
  });
  const activeByMonth = monthList.map((m) => ({
    label: m.label,
    value: new Set(sessions.filter((s) => s.status === "realisee" && monthOf(s.starts_at) === m.key).map((s) => s.client_id)).size,
  }));

  /* ---------- Types de séance ---------- */
  const typeCount = new Map<string, number>();
  sCur.filter((s) => s.status !== "annulee").forEach((s) => typeCount.set(s.type, (typeCount.get(s.type) ?? 0) + 1));
  const sorted = [...typeCount.entries()].sort((a, b) => b[1] - a[1]);
  const byType = sorted.slice(0, 6).map(([label, value]) => ({ label, value }));
  const rest = sorted.slice(6).reduce((a, [, v]) => a + v, 0);
  if (rest) byType.push({ label: "Autres", value: rest });

  /* ---------- Heatmap jour × créneau ---------- */
  const grid = WEEKDAYS.map(() => SLOTS.map(() => 0));
  sCur
    .filter((s) => s.status === "realisee" || s.status === "absent")
    .forEach((s) => {
      const parts = tzParts.formatToParts(new Date(s.starts_at));
      const wd = WEEKDAYS.indexOf(parts.find((x) => x.type === "weekday")?.value ?? "");
      const h = Number(parts.find((x) => x.type === "hour")?.value ?? -1);
      const slot = SLOTS.findIndex((st) => h >= st && h < st + 2);
      if (wd >= 0 && slot >= 0) grid[wd]![slot]!++;
    });
  const gridMax = Math.max(1, ...grid.flat());
  let peak = { wd: -1, slot: -1, v: 0 };
  grid.forEach((row, wd) =>
    row.forEach((v, slot) => {
      if (v > peak.v) peak = { wd, slot, v };
    }),
  );

  /* ---------- Coachs ---------- */
  const coachRows = coaches
    .map((c) => {
      const cl = clients.filter((x) => x.coach_id === c.id);
      const ids = new Set(cl.map((x) => x.id));
      const cs = sCur.filter((s) => s.coach_id === c.id);
      const r = cs.filter((s) => s.status === "realisee").length;
      const a = cs.filter((s) => s.status === "absent").length;
      const rev = paidCur.filter((i) => ids.has(i.client_id)).reduce((acc, i) => acc + Number(i.amount_mad), 0);
      return { c, clients: cl.filter((x) => x.status === "actif").length, total: cl.length, sessions: r, attendance: pct(r, r + a), revenue: rev };
    })
    .sort((a, b) => b.revenue - a.revenue || b.sessions - a.sessions);

  /* ---------- LTV ---------- */
  const ltv = new Map<string, { total: number; count: number }>();
  paid.forEach((i) => {
    const e = ltv.get(i.client_id) ?? { total: 0, count: 0 };
    e.total += Number(i.amount_mad);
    e.count++;
    ltv.set(i.client_id, e);
  });
  const topClients = [...ltv.entries()]
    .map(([id, v]) => ({ c: clientById.get(id), ...v }))
    .filter((x): x is { c: Client; total: number; count: number } => !!x.c)
    .sort((a, b) => b.total - a.total)
    .slice(0, 6);
  const topMax = topClients[0]?.total ?? 1;

  /* ---------- Objectifs & poids ---------- */
  const myGoals = goals.filter((g) => clientById.has(g.client_id));
  const gReached = myGoals.filter((g) => g.status === "atteint").length;
  const gOngoing = myGoals.filter((g) => g.status === "en_cours").length;
  const gDropped = myGoals.filter((g) => g.status === "abandonne").length;
  const lossIds = new Set([
    ...clients.filter((c) => /perte de poids|perdre|mincir|minceur|maigrir/i.test(c.goal ?? "")).map((c) => c.id),
    ...myGoals.filter((g) => g.metric === "weight_kg" && g.start_value != null && g.target_value != null && g.target_value < g.start_value).map((g) => g.client_id),
  ]);
  const weightDeltas = [...lossIds]
    .map((id) => {
      const w = meas.filter((m) => m.client_id === id && m.weight_kg != null);
      return w.length > 1 ? Number(w.at(-1)!.weight_kg) - Number(w[0]!.weight_kg) : null;
    })
    .filter((x): x is number => x !== null);
  const avgWeight = weightDeltas.length ? weightDeltas.reduce((a, b) => a + b, 0) / weightDeltas.length : null;

  const revDelta = revenue - revenuePrev;
  const attDelta = attendance !== null && attendancePrev !== null ? attendance - attendancePrev : null;
  const periodLabel = `${months} derniers mois`;
  const today = dayKey(now);

  return (
    <>
      <PageHeader
        title="Analytique"
        subtitle={`${me.role === "admin" ? "Toute la salle" : "Tes clients"} · du ${fmtDate(from)} au ${fmtDate(now)}`}
        actions={
          <div className="flex gap-1 rounded-xl bg-white p-1 ring-1 ring-line">
            {PERIODS.map((m) => (
              <Link
                key={m}
                href={{ pathname: "/analytique", query: { p: m } }}
                className={cn("rounded-lg px-3 py-1.5 text-sm font-semibold transition", months === m ? "bg-brand-500 text-white shadow-sm" : "text-muted hover:text-ink")}
              >
                {m} mois
              </Link>
            ))}
          </div>
        }
      />

      {/* KPI */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 2xl:grid-cols-6">
        <Kpi label="CA encaissé" value={mad(revenue)} delta={deltaText(revenue, revenuePrev)} positive={revenuePrev ? revDelta >= 0 : undefined} icon={<Wallet className="size-[18px]" />} />
        <Kpi tone="accent" label="Clients actifs" value={active.length} delta={`${clients.length} au total`} icon={<Users className="size-[18px]" />} />
        <Kpi
          label="Taux de présence"
          value={attendance === null ? "–" : `${attendance} %`}
          delta={attDelta === null ? "réalisées / (réalisées + absences)" : `${signed(attDelta, "pts")} vs période préc.`}
          positive={attDelta === null ? undefined : attDelta >= 0}
          icon={<CalendarCheck2 className="size-[18px]" />}
        />
        <Kpi tone="accent" label="Séances réalisées" value={done.length} delta={deltaText(done.length, donePrev)} positive={donePrev ? done.length >= donePrev : undefined} icon={<Activity className="size-[18px]" />} />
        <Kpi label="Panier moyen" value={paidCur.length ? mad(basket) : "–"} delta={`${paidCur.length} facture${paidCur.length > 1 ? "s" : ""} payée${paidCur.length > 1 ? "s" : ""}`} icon={<TrendingUp className="size-[18px]" />} />
        <Kpi tone="accent" label="Taux de rétention" value={retention === null ? "–" : `${retention} %`} delta={`${retained}/${active.length} venus ces 30 j`} positive={retention === null ? undefined : retention >= 70} icon={<UserCheck className="size-[18px]" />} />
      </div>

      {/* Revenus + séances */}
      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader title="Chiffre d'affaires encaissé" subtitle={`Par mois · ${periodLabel}`} icon={<Wallet className="size-4" />} action={<Badge tone="brand">{mad(revenueByMonth.reduce((a, m) => a + m.value, 0))}</Badge>} />
          <div className="px-3 pb-4">
            {revenueByMonth.some((m) => m.value) ? <RevenueArea data={revenueByMonth} /> : <Empty icon={<Wallet className="size-6" />} title="Aucun encaissement" text="Les factures marquées payées apparaîtront ici." />}
          </div>
        </Card>
        <Card>
          <CardHeader title="Séances par mois" subtitle="Par statut" icon={<CalendarDays className="size-4" />} />
          <div className="px-3 pb-4">
            {sessionsByMonth.some((m) => m.realisee + m.planifiee + m.absent + m.annulee) ? (
              <StackedSessions data={sessionsByMonth} />
            ) : (
              <Empty icon={<CalendarDays className="size-6" />} title="Aucune séance" text="Planifie des séances pour suivre l'activité mois par mois." />
            )}
          </div>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_1.15fr]">
        <Card>
          <CardHeader title="Clients actifs dans le temps" subtitle="Au moins une séance réalisée dans le mois" icon={<Users className="size-4" />} />
          <div className="px-3 pb-4">
            <ActiveClientsLine data={activeByMonth} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Séances par type" subtitle={periodLabel} icon={<PieIcon className="size-4" />} />
          <div className="px-5 pb-5">
            {byType.length ? <Donut data={byType} centerLabel="séances" /> : <Empty icon={<PieIcon className="size-6" />} title="Pas encore de séances" text="La répartition par type s'affichera dès les premières séances." />}
          </div>
        </Card>
      </div>

      {/* Heatmap */}
      <Card className="mt-5">
        <CardHeader
          title="Fréquentation par jour et créneau"
          subtitle="Séances réalisées ou manquées, heure d'Agadir"
          icon={<Clock className="size-4" />}
          action={peak.v ? <Badge tone="accent">Pic : {WEEKDAY_FR[peak.wd]} {SLOTS[peak.slot]}h–{SLOTS[peak.slot]! + 2}h</Badge> : undefined}
        />
        <div className="overflow-x-auto px-5 pb-5">
          <div className="min-w-[560px]">
            <div className="grid grid-cols-[44px_repeat(8,minmax(0,1fr))] gap-1.5">
              <span />
              {SLOTS.map((s) => (
                <span key={s} className="pb-1 text-center text-[11px] font-semibold text-muted">
                  {s}h–{s + 2}h
                </span>
              ))}
              {grid.map((row, wd) => (
                <div key={wd} className="contents">
                  <span className="flex items-center text-xs font-semibold text-slate-600">{WEEKDAY_FR[wd]}</span>
                  {row.map((v, si) => {
                    const a = v ? 0.12 + 0.88 * (v / gridMax) : 0;
                    return (
                      <span
                        key={si}
                        title={`${WEEKDAY_FR[wd]} ${SLOTS[si]}h–${SLOTS[si]! + 2}h : ${v} séance(s)`}
                        className={cn("grid h-10 place-items-center rounded-lg text-xs font-bold transition hover:ring-2 hover:ring-brand-200", v ? (a > 0.55 ? "text-white" : "text-brand-700") : "bg-slate-50 text-slate-300")}
                        style={v ? { background: `rgba(26,109,142,${a.toFixed(2)})` } : undefined}
                      >
                        {v || "·"}
                      </span>
                    );
                  })}
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-end gap-2 text-[11px] text-muted">
              Moins
              {[0.12, 0.34, 0.56, 0.78, 1].map((a) => (
                <span key={a} className="size-3.5 rounded" style={{ background: `rgba(26,109,142,${a})` }} />
              ))}
              Plus
            </div>
          </div>
        </div>
      </Card>

      {/* Coachs + top clients */}
      <div className="mt-5 grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <Card className="overflow-hidden">
          <CardHeader title="Performance par coach" subtitle={periodLabel} icon={<BarChart3 className="size-4" />} />
          {coachRows.length === 0 ? (
            <Empty icon={<Users className="size-6" />} title="Aucun coach" text="Ajoute des coachs depuis la page Équipe." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="border-y border-line bg-slate-50/60 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <th className="px-5 py-3">Coach</th>
                    <th className="px-4 py-3 text-right">Clients actifs</th>
                    <th className="px-4 py-3 text-right">Séances</th>
                    <th className="px-4 py-3">Présence</th>
                    <th className="px-5 py-3 text-right">CA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {coachRows.map((r) => (
                    <tr key={r.c.id} className="transition hover:bg-canvas/70">
                      <td className="px-5 py-3">
                        <span className="flex items-center gap-3">
                          <Avatar name={r.c.full_name || r.c.email} size={34} />
                          <span className="min-w-0">
                            <span className="block truncate font-semibold text-ink">{r.c.full_name || r.c.email}</span>
                            <span className="block text-xs text-muted">{r.c.role === "admin" ? "Admin" : "Coach"} · {r.total} client{r.total > 1 ? "s" : ""}</span>
                          </span>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">{r.clients}</td>
                      <td className="px-4 py-3 text-right font-semibold">{r.sessions}</td>
                      <td className="px-4 py-3">
                        {r.attendance === null ? (
                          <span className="text-muted">–</span>
                        ) : (
                          <span className="flex items-center gap-2">
                            <span className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
                              <span className={cn("block h-full rounded-full", r.attendance >= 80 ? "bg-emerald-500" : r.attendance >= 60 ? "bg-amber-400" : "bg-red-400")} style={{ width: `${r.attendance}%` }} />
                            </span>
                            <span className="text-xs font-semibold text-slate-600">{r.attendance} %</span>
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right font-display font-bold text-brand-600">{mad(r.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="Meilleurs clients" subtitle="Valeur vie client (factures payées)" icon={<Crown className="size-4" />} />
          {topClients.length === 0 ? (
            <Empty icon={<Crown className="size-6" />} title="Pas encore de revenus" text="Le classement apparaîtra après les premières factures payées." />
          ) : (
            <ul className="space-y-1 px-2 pb-3">
              {topClients.map((t, i) => (
                <li key={t.c.id}>
                  <Link href={`/clients/${t.c.id}`} className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-canvas">
                    <span className={cn("grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-bold", i === 0 ? "bg-accent-500 text-white" : "bg-slate-100 text-slate-500")}>{i + 1}</span>
                    <Avatar name={t.c.full_name} size={34} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-sm font-semibold">{t.c.full_name}</span>
                        <b className="shrink-0 font-display text-sm text-brand-600">{mad(t.total)}</b>
                      </span>
                      <span className="mt-1 flex items-center gap-2">
                        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                          <span className="block h-full rounded-full bg-brand-400" style={{ width: `${(t.total / topMax) * 100}%` }} />
                        </span>
                        <span className="text-[11px] text-muted">{t.count} fact.</span>
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Objectifs + poids */}
      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <Card>
          <CardHeader title="Objectifs" subtitle="Tous les objectifs suivis" icon={<Target className="size-4" />} />
          <div className="px-5 pb-5">
            <div className="flex items-end gap-3">
              <p className="font-display text-4xl font-extrabold text-emerald-600">{gReached}</p>
              <p className="pb-1.5 text-sm text-muted">objectif{gReached > 1 ? "s" : ""} atteint{gReached > 1 ? "s" : ""} sur {myGoals.length}</p>
            </div>
            <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-slate-100">
              {myGoals.length > 0 && (
                <>
                  <span className="bg-emerald-500" style={{ width: `${(gReached / myGoals.length) * 100}%` }} />
                  <span className="bg-brand-400" style={{ width: `${(gOngoing / myGoals.length) * 100}%` }} />
                  <span className="bg-slate-300" style={{ width: `${(gDropped / myGoals.length) * 100}%` }} />
                </>
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge tone="green" dot>{gReached} atteints</Badge>
              <Badge tone="brand" dot>{gOngoing} en cours</Badge>
              <Badge tone="gray" dot>{gDropped} abandonnés</Badge>
            </div>
          </div>
        </Card>
        <Card>
          <CardHeader title="Évolution du poids" subtitle="Clients avec un objectif de perte de poids" icon={<Scale className="size-4" />} />
          <div className="px-5 pb-5">
            {avgWeight === null ? (
              <p className="rounded-xl bg-canvas px-4 py-6 text-center text-sm text-muted">Pas assez de mesures (au moins deux pesées par client).</p>
            ) : (
              <>
                <div className="flex items-end gap-3">
                  <p className={cn("font-display text-4xl font-extrabold", avgWeight <= 0 ? "text-emerald-600" : "text-accent-600")}>{signed(Math.round(avgWeight * 10) / 10, "kg")}</p>
                  <p className="pb-1.5 text-sm text-muted">en moyenne depuis la 1re mesure</p>
                </div>
                <p className="mt-3 flex items-center gap-2 text-sm text-slate-600">
                  <Ruler className="size-4 text-brand-500" />
                  Calculé sur {weightDeltas.length} client{weightDeltas.length > 1 ? "s" : ""} · {weightDeltas.filter((d) => d < 0).length} en baisse
                </p>
              </>
            )}
          </div>
        </Card>
      </div>

      {/* Exports */}
      <Card className="mt-5">
        <CardHeader title="Rapports & exports" subtitle="Fichiers CSV compatibles Excel (séparateur « ; »)" icon={<FileSpreadsheet className="size-4" />} />
        <form method="get" action="/api/export/clients" className="px-5 pb-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:max-w-md">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-slate-600">Du (optionnel)</span>
              <Input type="date" name="from" max={today} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-slate-600">Au (optionnel)</span>
              <Input type="date" name="to" max={today} />
            </label>
          </div>
          <p className="mt-2 text-xs text-muted">Sans dates, tout l&apos;historique est exporté. Pour les clients, la période porte sur la date de début.</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {[
              { kind: "clients", label: "Clients", icon: Users },
              { kind: "seances", label: "Séances", icon: CalendarDays },
              { kind: "mesures", label: "Mesures", icon: Ruler },
              { kind: "bilans", label: "Bilans de santé", icon: HeartPulse },
              { kind: "factures", label: "Factures", icon: Wallet },
            ].map((k) => (
              <button
                key={k.kind}
                type="submit"
                formAction={`/api/export/${k.kind}`}
                className="group flex items-center gap-3 rounded-xl border border-line bg-white px-3.5 py-3 text-left text-sm font-semibold text-ink transition hover:border-brand-200 hover:bg-brand-50/50"
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-500 group-hover:bg-brand-500 group-hover:text-white">
                  <k.icon className="size-4" />
                </span>
                <span className="flex-1">{k.label}</span>
                <Download className="size-4 text-slate-300 group-hover:text-brand-500" />
              </button>
            ))}
          </div>
        </form>
      </Card>
    </>
  );
}
