import Link from "next/link";
import { AlertTriangle, CalendarCheck, CalendarCheck2, CalendarDays, ChevronRight, ClipboardList, Dumbbell, Flame, HeartPulse, ListChecks, MessageCircle, TrendingUp, Trophy, Users } from "lucide-react";
import { SolidTile } from "@/components/stat-tile";
import { createClient } from "@/lib/supabase/server";
import { healthAlerts, latestBy } from "@/lib/insights";
import { BUSY_STATUSES } from "@/lib/planning";
import type { Client, HealthCheck, Measurement, Session } from "@/lib/types";
import { addDays, dayKey, fmtDate, fmtTime, signed, startOfWeek } from "@/lib/utils";
import { Avatar, Badge, Card, CardHeader, Empty, LinkButton } from "@/components/ui";
import { WeeklyBars } from "@/components/charts";

/**
 * Tableau de bord de pilotage (admin) : indicateurs de la salle, raccourcis, séances du jour de toute l'équipe,
 * alertes santé et progressions. Affiché sous le bloc « Ma journée ».
 */
export async function ManagementDashboard() {
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

  // Séances comptées : prévues (BUSY_STATUSES, comme le planning) + réalisées / absences. Ni annulées ni refusées.
  const counted = (s: Session) => BUSY_STATUSES.includes(s.status) || s.status === "realisee" || s.status === "absent";
  const todayKey = dayKey(now);
  const today = sessions.filter((s) => dayKey(s.starts_at) === todayKey && counted(s));
  const thisWeek = sessions.filter((s) => new Date(s.starts_at) >= week0 && counted(s));
  const lastWeek = sessions.filter((s) => new Date(s.starts_at) >= addDays(week0, -7) && new Date(s.starts_at) < week0 && counted(s));
  const upcomingWeek = thisWeek.filter((s) => new Date(s.starts_at) > now && BUSY_STATUSES.includes(s.status)).length;

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
      value: sessions.filter((s) => counted(s) && new Date(s.starts_at) >= start && new Date(s.starts_at) < end).length,
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
  const [{ count: tasksDue }, { count: unread }, { count: bookings }] = await Promise.all([
    supabase.from("tasks").select("id", { count: "exact", head: true }).eq("done", false).lte("due_date", today0),
    supabase.from("messages").select("id", { count: "exact", head: true }).eq("from_client", true).is("read_at", null),
    supabase.from("booking_requests").select("id", { count: "exact", head: true }).eq("status", "nouvelle"),
  ]);
  const nextSession = today.find((s) => new Date(s.starts_at) > now && (s.status === "planifiee" || s.status === "acceptee"));
  return (
    <>
      <h2 className="mb-4 mt-10 flex items-center gap-2 font-display text-xl font-extrabold tracking-tight text-ink">
        <TrendingUp className="size-5 text-accent-500" /> Pilotage de la salle
      </h2>

      {/* Tuiles pleine couleur */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SolidTile href="/clients?statut=actif" tone="brand" icon={<Users />} watermark={<Users />} label="Clients actifs" value={active.length} sub={`${clients.length} clients au total`} series={activeSeries} />
        <SolidTile href="/seances" tone="accent" icon={<CalendarDays />} watermark={<Dumbbell />} label="Séances" value={thisWeek.length} sub="cette semaine" trendLabel={`${signed(delta)} vs sem. passée`} trendUp={delta === 0 ? null : delta > 0} series={weeks.map((w) => w.value)} />
        <SolidTile tone="brand" icon={<CalendarCheck2 />} watermark={<Flame />} label="Présence" value={attendance === null ? "–" : `${attendance}%`} sub="sur 6 semaines" trendLabel={`${signed(attDelta)} pts`} trendUp={attDelta === 0 ? null : attDelta > 0} series={attendanceSeries} />
        <SolidTile href="/clients" tone="accent" icon={<ClipboardList />} watermark={<HeartPulse />} label="Bilans à faire" value={due.length} sub={due.length ? "dernier bilan > 30 jours" : "tout est à jour 👌"} series={healthSeries} />
      </div>

      {/* Raccourcis */}
      <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          { href: "/taches", icon: ListChecks, label: "Tâches", hint: "à faire aujourd'hui", value: tasksDue ?? 0, color: "text-brand-600 bg-brand-50" },
          { href: "/messages", icon: MessageCircle, label: "Messages", hint: "non lus", value: unread ?? 0, color: "text-accent-600 bg-accent-50" },
          { href: "/reservations", icon: CalendarCheck, label: "Réservations", hint: "nouvelles demandes", value: bookings ?? 0, color: "text-brand-600 bg-brand-50" },
          { href: "/seances", icon: CalendarDays, label: "À venir", hint: "séances cette semaine", value: upcomingWeek, color: "text-accent-600 bg-accent-50" },
        ].map((q) => (
          <Link key={q.href} href={q.href} className="group flex items-center gap-3 rounded-2xl border border-line bg-white p-3 shadow-card transition hover:-translate-y-0.5 hover:shadow-pop sm:p-4">
            <span className={`grid size-11 shrink-0 place-items-center rounded-xl ${q.color}`}>
              <q.icon className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-display text-lg font-extrabold leading-tight text-ink sm:text-xl">{q.value}</span>
              <span className="block truncate text-xs text-muted">
                <b className="font-semibold text-slate-600">{q.label}</b> · {q.hint}
              </span>
            </span>
            <ChevronRight className="hidden size-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-brand-500 sm:block" />
          </Link>
        ))}
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[1.55fr_1fr]">
        {/* Séances du jour : frise */}
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between bg-gradient-to-r from-brand-600 to-brand-500 px-5 py-4 text-white">
            <div className="flex items-center gap-2.5">
              <span className="grid size-9 place-items-center rounded-xl bg-white/20">
                <CalendarDays className="size-[18px]" />
              </span>
              <div>
                <h3 className="font-display text-[15px] font-bold">Séances du jour · toute l&apos;équipe</h3>
                <p className="text-xs text-white/75">{today.length} au planning</p>
              </div>
            </div>
            <Link href="/seances" className="rounded-xl bg-white/15 px-3 py-1.5 text-xs font-bold ring-1 ring-white/25 transition hover:bg-white/25">
              Planning →
            </Link>
          </div>
          {today.length === 0 ? (
            <Empty icon={<CalendarDays className="size-6" />} title="Aucune séance aujourd'hui" text="Planifie une séance pour la voir apparaître ici." action={<LinkButton href="/seances/nouvelle" variant="secondary">Planifier</LinkButton>} />
          ) : (
            <ol className="relative px-5 py-4">
              <span className="absolute bottom-6 left-[88px] top-6 w-0.5 rounded bg-line" aria-hidden />
              {today.map((s) => {
                const c = byId.get(s.client_id);
                if (!c) return null;
                const done = s.status === "realisee";
                const isNext = nextSession?.id === s.id;
                return (
                  <li key={s.id} className="relative">
                    <Link href={`/seances/${s.id}`} className="group flex items-center gap-4 rounded-2xl py-2.5 pr-2 transition hover:bg-canvas">
                      <span className={`w-14 text-right font-display text-sm font-extrabold ${isNext ? "text-accent-600" : "text-brand-600"}`}>{fmtTime(s.starts_at)}</span>
                      <span className={`relative z-10 grid size-5 shrink-0 place-items-center rounded-full ring-4 ring-white ${done ? "bg-emerald-500" : isNext ? "bg-accent-500" : "bg-brand-500"}`}>
                        {isNext && <span className="absolute inset-0 animate-ping rounded-full bg-accent-400 opacity-60" />}
                      </span>
                      <Avatar name={c.full_name} size={40} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold text-ink">{c.full_name}</span>
                        <span className="block truncate text-xs text-muted">
                          {s.type} · {s.duration_min} min
                        </span>
                      </span>
                      {done ? <Badge tone="green">Réalisée</Badge> : s.status === "absent" ? <Badge tone="red">Absent</Badge> : isNext ? <Badge tone="accent">Prochaine</Badge> : <Badge tone="brand">Planifiée</Badge>}
                    </Link>
                  </li>
                );
              })}
            </ol>
          )}
        </Card>

        {/* Alertes santé */}
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between bg-gradient-to-r from-accent-500 to-accent-400 px-5 py-4 text-white">
            <div className="flex items-center gap-2.5">
              <span className="grid size-9 place-items-center rounded-xl bg-white/20">
                <HeartPulse className="size-[18px]" />
              </span>
              <div>
                <h3 className="font-display text-[15px] font-bold">Alertes santé</h3>
                <p className="text-xs text-white/80">D&apos;après le dernier bilan</p>
              </div>
            </div>
            <span className="grid size-8 place-items-center rounded-full bg-white font-display text-sm font-extrabold text-accent-600">{alerts.length}</span>
          </div>
          {alerts.length === 0 ? (
            <Empty icon={<HeartPulse className="size-6" />} title="Rien à signaler" text="Les alertes apparaissent quand un bilan signale une douleur, une tension élevée ou un mauvais sommeil." />
          ) : (
            <ul className="space-y-2 p-4">
              {alerts.slice(0, 5).map(({ c, a }) => {
                const high = a.some((x) => x.level === "high");
                return (
                  <li key={c.id}>
                    <Link href={`/clients/${c.id}?tab=sante`} className="flex items-center gap-3 rounded-2xl border border-line p-3 transition hover:border-accent-200 hover:bg-accent-50/50">
                      <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${high ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-600"}`}>
                        <AlertTriangle className="size-[18px]" />
                      </span>
                      <span className="min-w-0 flex-1 text-sm">
                        <b className="block truncate text-ink">{c.full_name}</b>
                        <span className="block truncate text-xs text-slate-600">{a.map((x) => x.text).join(" · ")}</span>
                      </span>
                      <ChevronRight className="size-4 shrink-0 text-slate-300" />
                    </Link>
                  </li>
                );
              })}
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
        <Card className="overflow-hidden">
          <CardHeader title="Meilleures progressions" subtitle="Depuis la première mesure" icon={<Trophy className="size-4" />} />
          {progress.length === 0 ? (
            <Empty icon={<TrendingUp className="size-6" />} title="Pas encore de données" text="Ajoute au moins deux mesures à un client pour voir sa progression." />
          ) : (
            <ol className="space-y-1 px-3 pb-3">
              {progress.map(({ c, dSq, dW }, i) => (
                <li key={c.id}>
                  <Link href={`/clients/${c.id}`} className="flex items-center gap-3 rounded-2xl px-2 py-2.5 transition hover:bg-canvas">
                    <span className={`grid size-8 shrink-0 place-items-center rounded-full font-display text-sm font-extrabold ${i === 0 ? "bg-accent-500 text-white" : i === 1 ? "bg-brand-500 text-white" : i === 2 ? "bg-brand-100 text-brand-700" : "bg-canvas text-slate-500"}`}>{i + 1}</span>
                    <Avatar name={c.full_name} size={38} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold">{c.full_name}</span>
                      <span className="block truncate text-xs text-muted">{c.goal ?? "—"}</span>
                    </span>
                    {dSq > 0 && <Badge tone="green">Squat {signed(dSq, "kg")}</Badge>}
                    {dW !== 0 && <Badge tone={dW < 0 ? "brand" : "accent"}>{signed(dW, "kg")}</Badge>}
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>
    </>
  );
}
