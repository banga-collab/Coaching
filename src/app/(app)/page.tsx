import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, CalendarCheck, CalendarCheck2, CalendarDays, ChevronRight, ClipboardList, HeartPulse, ListChecks, MessageCircle, Plus, Receipt, TrendingUp, Users } from "lucide-react";
import { ShortcutTile, StatTile } from "@/components/stat-tile";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { healthAlerts, latestBy } from "@/lib/insights";
import type { Client, HealthCheck, Measurement, Session } from "@/lib/types";
import { addDays, dayKey, fmtDate, fmtTime, signed, startOfWeek } from "@/lib/utils";
import { Avatar, Badge, Card, CardHeader, Empty, LinkButton } from "@/components/ui";
import { WeeklyBars } from "@/components/charts";

export default async function Dashboard() {
  const profile = await getProfile();
  if (profile.role === "client") redirect("/moi");
  const supabase = await createClient();

  const now = new Date();
  const week0 = startOfWeek(now);
  const from = addDays(week0, -35);

  const [{ data: clientsData }, { data: sessData }, { data: healthData }, { data: measData }] = await Promise.all([
    supabase.from("clients").select("*").order("full_name"),
    supabase.from("sessions").select("*").gte("starts_at", from.toISOString()).lt("starts_at", addDays(week0, 7).toISOString()).order("starts_at"),
    supabase.from("health_checks").select("*").order("checked_on", { ascending: false }).limit(500),
    supabase.from("measurements").select("*").order("measured_on", { ascending: true }).limit(2000),
  ]);
  const clients = (clientsData ?? []) as Client[];
  const sessions = (sessData ?? []) as Session[];
  const health = (healthData ?? []) as HealthCheck[];
  const meas = (measData ?? []) as Measurement[];
  const byId = new Map(clients.map((c) => [c.id, c]));
  const active = clients.filter((c) => c.status === "actif");

  const todayKey = dayKey(now);
  const today = sessions.filter((s) => dayKey(s.starts_at) === todayKey && s.status !== "annulee");
  const thisWeek = sessions.filter((s) => new Date(s.starts_at) >= week0 && s.status !== "annulee");
  const lastWeek = sessions.filter((s) => new Date(s.starts_at) >= addDays(week0, -7) && new Date(s.starts_at) < week0 && s.status !== "annulee");

  const past = sessions.filter((s) => s.status === "realisee" || s.status === "absent");
  const attendance = past.length ? Math.round((past.filter((s) => s.status === "realisee").length / past.length) * 100) : null;

  const lastHealth = latestBy(health);
  const due = active.filter((c) => {
    const h = lastHealth.get(c.id);
    return !h || (now.getTime() - new Date(h.checked_on).getTime()) / 86400000 > 30;
  });
  const alerts = active
    .map((c) => ({ c, a: healthAlerts(lastHealth.get(c.id)) }))
    .filter((x) => x.a.length)
    .sort((x, y) => y.a.filter((a) => a.level === "high").length - x.a.filter((a) => a.level === "high").length);

  const weeks = Array.from({ length: 6 }, (_, i) => {
    const start = addDays(week0, (i - 5) * 7);
    const end = addDays(start, 7);
    return {
      label: i === 5 ? "Cette sem." : fmtDate(start, { day: "numeric", month: "short" }),
      value: sessions.filter((s) => s.status !== "annulee" && new Date(s.starts_at) >= start && new Date(s.starts_at) < end).length,
    };
  });

  // Meilleures progressions (poids perdu ou squat gagné)
  const progress = active
    .map((c) => {
      const m = meas.filter((x) => x.client_id === c.id);
      const sq = m.filter((x) => x.squat_kg != null);
      const w = m.filter((x) => x.weight_kg != null);
      const dSq = sq.length > 1 ? Number(sq.at(-1)!.squat_kg) - Number(sq[0]!.squat_kg) : 0;
      const dW = w.length > 1 ? Number(w.at(-1)!.weight_kg) - Number(w[0]!.weight_kg) : 0;
      return { c, dSq, dW };
    })
    .filter((p) => p.dSq > 0 || p.dW !== 0)
    .sort((a, b) => b.dSq - a.dSq || a.dW - b.dW)
    .slice(0, 5);

  const firstName = (profile.full_name || "Coach").split(" ")[0];
  const delta = thisWeek.length - lastWeek.length;

  // Séries hebdomadaires (6 semaines) pour les mini-courbes
  const weekRanges = Array.from({ length: 6 }, (_, i) => {
    const s = addDays(week0, (i - 5) * 7);
    return [s, addDays(s, 7)] as const;
  });
  const inWeek = (iso: string, [s, e]: readonly [Date, Date]) => new Date(iso) >= s && new Date(iso) < e;
  const attendanceSeries = weekRanges.map((r) => {
    const p = sessions.filter((s) => inWeek(s.starts_at, r) && (s.status === "realisee" || s.status === "absent"));
    return p.length ? Math.round((p.filter((s) => s.status === "realisee").length / p.length) * 100) : 100;
  });
  const activeSeries = weekRanges.map((r) => new Set(sessions.filter((s) => inWeek(s.starts_at, r) && s.status === "realisee").map((s) => s.client_id)).size);
  const healthSeries = weekRanges.map(([s, e]) => health.filter((h) => new Date(h.checked_on) >= s && new Date(h.checked_on) < e).length);
  const attDelta = attendanceSeries.length > 1 ? attendanceSeries.at(-1)! - attendanceSeries.at(-2)! : 0;

  // Raccourcis des modules
  const today0 = now.toISOString().slice(0, 10);
  const month0 = today0.slice(0, 8) + "01";
  const [{ count: tasksDue }, { count: unread }, { count: bookings }, { data: paidData }] = await Promise.all([
    supabase.from("tasks").select("id", { count: "exact", head: true }).eq("done", false).lte("due_date", today0),
    supabase.from("messages").select("id", { count: "exact", head: true }).eq("from_client", true).is("read_at", null),
    supabase.from("booking_requests").select("id", { count: "exact", head: true }).eq("status", "nouvelle"),
    supabase.from("invoices").select("amount_mad, paid_on").eq("status", "payee").gte("paid_on", month0),
  ]);
  const revenue = ((paidData ?? []) as { amount_mad: number }[]).reduce((s, i) => s + Number(i.amount_mad), 0);
  const nextSession = today.find((s) => new Date(s.starts_at) > now && s.status === "planifiee");
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone: "Africa/Casablanca" }).formatToParts(now).find((p) => p.type === "hour")?.value ?? 12);
  const hello = hour >= 5 && hour < 12 ? "Bonjour" : hour >= 12 && hour < 18 ? "Bon après-midi" : "Bonsoir";

  return (
    <>
      {/* Bandeau d'accueil */}
      <section className="relative mb-5 animate-fade-up overflow-hidden rounded-3xl bg-gradient-to-br from-brand-700 via-brand-600 to-brand-500 p-6 text-white shadow-pop sm:p-8">
        <svg className="pointer-events-none absolute inset-y-0 right-0 h-full w-2/3 opacity-60 [mask-image:linear-gradient(to_left,black,transparent)]" aria-hidden>
          {Array.from({ length: 34 }, (_, i) => (
            <rect key={i} x={`${(i * 37) % 100}%`} y={`${(i * 53) % 95}%`} width={6 + (i % 5) * 3} height={6 + (i % 5) * 3} fill={i % 5 === 0 ? "#ec8a45" : "rgba(255,255,255,.16)"} transform={`rotate(${(i * 13) % 30})`} />
          ))}
        </svg>
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium capitalize text-brand-100">{fmtDate(now, { weekday: "long", day: "numeric", month: "long" })}</p>
            <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
              {hello} {firstName} <span className="inline-block origin-[70%_70%] animate-[wave_1.6s_ease-in-out_1]">👋</span>
            </h1>
            <p className="mt-2 max-w-xl text-[15px] text-brand-50/90">
              {today.length ? (
                <>
                  <b className="text-white">
                    {today.length} séance{today.length > 1 ? "s" : ""}
                  </b>{" "}
                  au programme aujourd&apos;hui
                  {nextSession && (
                    <>
                      {" "}
                      · prochaine à <b className="text-accent-300">{fmtTime(nextSession.starts_at)}</b> avec {byId.get(nextSession.client_id)?.full_name.split(" ")[0]}
                    </>
                  )}
                </>
              ) : (
                <>Aucune séance aujourd&apos;hui : profites-en pour faire les bilans en retard.</>
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/seances/nouvelle" className="inline-flex h-11 items-center gap-2 rounded-xl bg-accent-500 px-5 text-sm font-semibold text-white shadow-lg shadow-black/10 transition hover:bg-accent-600">
              <Plus className="size-4" /> Nouvelle séance
            </Link>
            <Link href="/clients/nouveau" className="inline-flex h-11 items-center gap-2 rounded-xl bg-white/15 px-5 text-sm font-semibold text-white ring-1 ring-white/25 backdrop-blur transition hover:bg-white/25">
              <Users className="size-4" /> Nouveau client
            </Link>
          </div>
        </div>
      </section>

      {/* Tuiles de statistiques */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile href="/clients?statut=actif" tone="brand" icon={<Users className="size-5" />} label="Clients actifs" value={active.length} sub={`${clients.length} clients au total`} series={activeSeries} />
        <StatTile href="/seances" tone="accent" icon={<CalendarDays className="size-5" />} label="Séances cette semaine" value={thisWeek.length} sub="vs semaine passée" trend={delta} trendLabel={signed(delta)} series={weeks.map((w) => w.value)} />
        <StatTile tone="green" icon={<CalendarCheck2 className="size-5" />} label="Taux de présence" value={attendance === null ? "–" : `${attendance}%`} sub="sur 6 semaines" trend={attDelta} trendLabel={`${signed(attDelta)} pts`} series={attendanceSeries} />
        <StatTile href="/clients" tone="violet" icon={<ClipboardList className="size-5" />} label="Bilans à faire" value={due.length} sub={due.length ? "dernier bilan > 30 jours" : "tout est à jour"} trend={due.length ? -due.length : 0} trendLabel={due.length ? "à planifier" : "OK"} series={healthSeries} />
      </div>

      {/* Raccourcis */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <ShortcutTile href="/taches" icon={<ListChecks className="size-5" />} label="Tâches à faire" hint="aujourd'hui ou en retard" value={tasksDue ?? 0} hot={(tasksDue ?? 0) > 0} />
        <ShortcutTile href="/messages" icon={<MessageCircle className="size-5" />} label="Messages non lus" hint="de vos clients" value={unread ?? 0} hot={(unread ?? 0) > 0} />
        <ShortcutTile href="/reservations" icon={<CalendarCheck className="size-5" />} label="Réservations" hint="nouvelles demandes" value={bookings ?? 0} hot={(bookings ?? 0) > 0} />
        <ShortcutTile href="/facturation" icon={<Receipt className="size-5" />} label="Encaissé ce mois" hint="factures payées, en MAD" value={new Intl.NumberFormat("fr-FR", { notation: "compact" }).format(revenue)} />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader title="Séances du jour" icon={<CalendarDays className="size-4" />} action={<Badge>{today.length}</Badge>} />
          {today.length === 0 ? (
            <Empty icon={<CalendarDays className="size-6" />} title="Aucune séance aujourd'hui" text="Planifie une séance pour la voir apparaître ici." action={<LinkButton href="/seances/nouvelle" variant="secondary">Planifier</LinkButton>} />
          ) : (
            <ul className="divide-y divide-line px-2 pb-2">
              {today.map((s) => {
                const c = byId.get(s.client_id);
                if (!c) return null;
                return (
                  <li key={s.id}>
                    <Link href={`/seances/${s.id}`} className="flex items-center gap-4 rounded-xl px-3 py-3 transition hover:bg-canvas">
                      <span className="w-12 font-display text-sm font-bold text-brand-500">{fmtTime(s.starts_at)}</span>
                      <Avatar name={c.full_name} size={36} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{c.full_name}</span>
                        <span className="block truncate text-xs text-muted">{s.type}</span>
                      </span>
                      {s.status === "realisee" ? <Badge tone="green">Réalisée</Badge> : s.status === "absent" ? <Badge tone="red">Absent</Badge> : <Badge tone="gray">{s.duration_min} min</Badge>}
                      <ChevronRight className="size-4 text-slate-300" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Alertes santé" subtitle="D'après le dernier bilan" icon={<HeartPulse className="size-4" />} action={alerts.length ? <Badge tone="accent">{alerts.length}</Badge> : undefined} />
          {alerts.length === 0 ? (
            <Empty icon={<HeartPulse className="size-6" />} title="Rien à signaler" text="Les alertes apparaissent quand un bilan signale une douleur, une tension élevée ou un mauvais sommeil." />
          ) : (
            <ul className="space-y-2 px-5 pb-5">
              {alerts.slice(0, 6).map(({ c, a }) => (
                <li key={c.id}>
                  <Link href={`/clients/${c.id}?tab=sante`} className="flex gap-3 rounded-xl bg-accent-50/70 p-3 ring-1 ring-accent-100 transition hover:bg-accent-50">
                    <AlertTriangle className={a.some((x) => x.level === "high") ? "mt-0.5 size-4 shrink-0 text-accent-600" : "mt-0.5 size-4 shrink-0 text-amber-500"} />
                    <span className="text-sm">
                      <b className="text-ink">{c.full_name}</b>
                      <span className="block text-xs text-slate-600">{a.map((x) => x.text).join(" · ")}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader title="Séances par semaine" subtitle="6 dernières semaines" icon={<TrendingUp className="size-4" />} />
          <div className="px-3 pb-4">
            <WeeklyBars data={weeks} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Meilleures progressions" subtitle="Depuis la première mesure" icon={<TrendingUp className="size-4" />} />
          {progress.length === 0 ? (
            <Empty icon={<TrendingUp className="size-6" />} title="Pas encore de données" text="Ajoute au moins deux mesures à un client pour voir sa progression." />
          ) : (
            <ul className="divide-y divide-line px-2 pb-2">
              {progress.map(({ c, dSq, dW }) => (
                <li key={c.id}>
                  <Link href={`/clients/${c.id}`} className="flex items-center gap-3 rounded-xl px-3 py-3 transition hover:bg-canvas">
                    <Avatar name={c.full_name} size={36} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{c.full_name}</span>
                      <span className="block truncate text-xs text-muted">{c.goal ?? "—"}</span>
                    </span>
                    {dSq > 0 && <Badge tone="green">Squat {signed(dSq, "kg")}</Badge>}
                    {dW !== 0 && <Badge tone="brand">{signed(dW, "kg")}</Badge>}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
