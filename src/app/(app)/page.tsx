import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, CalendarCheck2, CalendarDays, ChevronRight, ClipboardList, HeartPulse, Plus, TrendingUp, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { healthAlerts, latestBy } from "@/lib/insights";
import type { Client, HealthCheck, Measurement, Session } from "@/lib/types";
import { addDays, dayKey, fmtDate, fmtTime, signed, startOfWeek } from "@/lib/utils";
import { Avatar, Badge, Card, CardHeader, Empty, Kpi, LinkButton, PageHeader } from "@/components/ui";
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

  return (
    <>
      <PageHeader
        title={
          <>
            Bonjour {firstName} <span className="inline-block origin-[70%_70%] animate-[wave_1.6s_ease-in-out_1]">👋</span>
          </>
        }
        subtitle={`${fmtDate(now, { weekday: "long", day: "numeric", month: "long" })} · ${today.length} séance${today.length > 1 ? "s" : ""} aujourd'hui`}
        actions={
          <>
            <LinkButton href="/clients/nouveau">
              <Plus className="size-4" /> Nouveau client
            </LinkButton>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Kpi label="Clients actifs" value={active.length} delta={`${clients.length} au total`} icon={<Users className="size-[18px]" />} />
        <Kpi tone="accent" label="Séances cette semaine" value={thisWeek.length} delta={`${signed(delta)} vs semaine passée`} positive={delta >= 0} icon={<CalendarDays className="size-[18px]" />} />
        <Kpi label="Taux de présence" value={attendance === null ? "–" : `${attendance}%`} delta="sur 6 semaines" icon={<CalendarCheck2 className="size-[18px]" />} />
        <Kpi tone="accent" label="Bilans à faire" value={due.length} delta={due.length ? "plus de 30 jours" : "tout est à jour"} positive={due.length === 0} icon={<ClipboardList className="size-[18px]" />} />
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
