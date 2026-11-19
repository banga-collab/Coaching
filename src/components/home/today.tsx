import Link from "next/link";
import {
  AlarmClock,
  AlertTriangle,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  CalendarPlus,
  Check,
  ChevronRight,
  Clock,
  HeartPulse,
  Hourglass,
  ListChecks,
  MessageCircle,
  Play,
  Repeat,
  Sparkles,
  Square,
  UserX,
  type LucideIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { isManager } from "@/lib/auth";
import { getT } from "@/lib/i18n";
import { loadNavBadges } from "@/lib/nav-badges";
import {
  COUNTED_STATUSES,
  EARLY_START_MIN,
  canFinish,
  canMarkAbsent,
  canStart,
  firstName,
  isForgotten,
  listFreeSlots,
  loadStaff,
  shiftDate,
  staffName,
  timeReached,
  todayAgadir,
} from "@/lib/planning";
import type { Client, Profile, Session } from "@/lib/types";
import { SESSION_LABEL, agadirToIso, cn, fmtDate, fmtTime } from "@/lib/utils";
import { endSessionAction, markSessionAction, quickAcceptAction, startSessionAction } from "@/actions/planning";
import { Avatar, Badge, Card, Empty, LinkButton } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { ConfirmButton } from "@/components/confirm-button";
import { SESSION_BADGE } from "@/components/planning/status";
import { ToCloseBanner, loadForgotten } from "@/components/planning/to-close";

type Alert = { id: string; icon: LucideIcon; tone: string; title: string; text?: string; href: string; cta: string };

/** Statuts montrés dans « Aujourd'hui » (jamais les refusées ni les annulées) */
const SHOWN: Session["status"][] = ["planifiee", "acceptee", "reportee", "en_cours", "realisee", "absent"];

/**
 * « Ma journée » : séances du jour avec gros boutons Démarrer / Terminer / Absent, séances à confirmer,
 * bandeau « À clôturer », créneaux libres du jour et alertes. Coach : ses données ; manager : alertes de toute la salle.
 */
export async function TodayBlock({ me, compact = false }: { me: Profile; compact?: boolean }) {
  const t = await getT();
  const supabase = await createClient();
  const manager = isManager(me.role);
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const today = todayAgadir(nowMs);
  const since21 = new Date(nowMs - 21 * 86400000).toISOString();
  const since30 = new Date(nowMs - 30 * 86400000).toISOString().slice(0, 10);

  let scopeQ = supabase.from("clients").select("id, full_name, coach_id, status, start_date").eq("status", "actif");
  if (!manager) scopeQ = scopeQ.eq("coach_id", me.id);

  const [{ data: dayData }, { data: pendData }, forgotten, { data: scopeData }, free, badges, staff] = await Promise.all([
    supabase.from("sessions").select("*").eq("coach_id", me.id).gte("starts_at", agadirToIso(today, "00:00")).lt("starts_at", agadirToIso(shiftDate(today, 1), "00:00")).order("starts_at"),
    supabase.from("sessions").select("*").eq("coach_id", me.id).eq("status", "planifiee").gte("starts_at", nowIso).order("starts_at").limit(6),
    loadForgotten(supabase, manager ? null : me.id, 10),
    scopeQ,
    listFreeSlots(supabase, me.id, today, 60).catch(() => [] as string[]),
    loadNavBadges(me.id, me.role),
    manager ? loadStaff(supabase) : Promise.resolve([]),
  ]);
  const mine = ((dayData ?? []) as Session[]).filter((s) => SHOWN.includes(s.status));
  const pending = (pendData ?? []) as Session[];
  const scope = (scopeData ?? []) as Pick<Client, "id" | "full_name" | "coach_id" | "status" | "start_date">[];
  const forgottenIds = new Set(forgotten.map((s) => s.id));
  const freeLater = free.filter((h) => new Date(agadirToIso(today, h)).getTime() > nowMs);

  // Noms des clients affichés (séances d'autres coachs incluses)
  const ids = [...new Set([...mine, ...pending, ...forgotten].map((s) => s.client_id))];
  const { data: nData } = ids.length ? await supabase.from("clients").select("id, full_name").in("id", ids) : { data: [] };
  const names = new Map(((nData ?? []) as Pick<Client, "id" | "full_name">[]).map((c) => [c.id, c.full_name]));
  for (const c of scope) names.set(c.id, c.full_name);
  const nameOf = (id: string) => names.get(id) ?? "Client";

  /* ---------- Alertes ---------- */
  // Manager : toute la salle (pas de longue liste d'identifiants) ; coach : ses clients
  const scopeIds = scope.map((c) => c.id);
  let recentQ = supabase.from("sessions").select("client_id, status, starts_at").gte("starts_at", since21).in("status", COUNTED_STATUSES);
  let assessQ = supabase.from("sport_assessments").select("client_id, risk_level, done_on");
  let hcQ = supabase.from("health_checks").select("client_id, checked_on").gte("checked_on", since30);
  if (!manager) {
    recentQ = recentQ.in("client_id", scopeIds);
    assessQ = assessQ.in("client_id", scopeIds);
    hcQ = hcQ.in("client_id", scopeIds);
  }
  const [{ data: recentData }, assessRes, { data: hcData }] = scopeIds.length
    ? await Promise.all([recentQ, assessQ.order("done_on", { ascending: false }), hcQ])
    : [{ data: [] }, { data: [], error: null }, { data: [] }];
  const seen = new Set(((recentData ?? []) as { client_id: string }[]).map((s) => s.client_id));
  const sleeping = scope.filter((c) => !seen.has(c.id) && (c.start_date ?? "") <= since21.slice(0, 10));
  const latestRisk = new Map<string, string>();
  if (!assessRes.error) for (const a of (assessRes.data ?? []) as { client_id: string; risk_level: string }[]) if (!latestRisk.has(a.client_id)) latestRisk.set(a.client_id, a.risk_level);
  const checked = new Set(((hcData ?? []) as { client_id: string }[]).map((h) => h.client_id));
  const risky = scope.filter((c) => latestRisk.get(c.id) === "rouge" && !checked.has(c.id));
  const listNames = (l: { full_name: string }[]) => l.slice(0, 3).map((c) => c.full_name).join(", ") + (l.length > 3 ? ` +${l.length - 3}` : "");

  const alerts: Alert[] = [];
  if (risky.length)
    alerts.push({
      id: "risk",
      icon: HeartPulse,
      tone: "bg-red-50 text-red-600",
      title: t(risky.length > 1 ? "today.alert.risk.many" : "today.alert.risk.one", { n: risky.length }),
      text: listNames(risky),
      href: `/clients/${risky[0]!.id}?tab=sante`,
      cta: t("today.alert.risk.cta"),
    });
  if (sleeping.length)
    alerts.push({
      id: "sleeping",
      icon: CalendarClock,
      tone: "bg-amber-50 text-amber-600",
      title: t(sleeping.length > 1 ? "today.alert.sleeping.many" : "today.alert.sleeping.one", { n: sleeping.length }),
      text: listNames(sleeping),
      href: `/seances/nouvelle?client=${sleeping[0]!.id}`,
      cta: t("today.alert.sleeping.cta"),
    });
  if (badges["/messages"])
    alerts.push({ id: "msg", icon: MessageCircle, tone: "bg-brand-50 text-brand-600", title: t("today.alert.messages", { n: badges["/messages"] }), href: "/messages", cta: t("today.alert.messages.cta") });
  if (badges["/taches"])
    alerts.push({ id: "tasks", icon: ListChecks, tone: "bg-accent-50 text-accent-600", title: t("today.alert.tasks", { n: badges["/taches"] }), href: "/taches", cta: t("today.alert.tasks.cta") });
  if (manager && badges["/planning"])
    alerts.push({ id: "handle", icon: Repeat, tone: "bg-violet-50 text-violet-600", title: t("today.alert.handle", { n: badges["/planning"] }), href: "/planning", cta: t("today.alert.handle.cta") });
  if (badges["/reservations"])
    alerts.push({ id: "booking", icon: CalendarCheck, tone: "bg-brand-50 text-brand-600", title: t("today.alert.bookings", { n: badges["/reservations"] }), href: "/reservations", cta: t("today.alert.bookings.cta") });

  /* ---------- En-tête ---------- */
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone: "Africa/Casablanca" }).formatToParts(new Date(nowMs)).find((p) => p.type === "hour")?.value ?? 12);
  const hello = t(hour >= 5 && hour < 12 ? "today.morning" : hour >= 12 && hour < 18 ? "today.afternoon" : "today.evening");
  const left = mine.filter((s) => ["planifiee", "acceptee", "reportee", "en_cours"].includes(s.status) && !forgottenIds.has(s.id));
  const next = left.find((s) => new Date(s.starts_at).getTime() + s.duration_min * 60000 > nowMs);

  return (
    <section aria-labelledby="today-title" className={cn(!compact && "pb-2")}>
      <header className="mb-5 flex animate-fade-up flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-50 px-3 py-1 text-xs font-bold capitalize text-accent-700 ring-1 ring-accent-100">
            <CalendarDays className="size-3.5" />
            {fmtDate(new Date(nowMs), { weekday: "long", day: "numeric", month: "long" })}
          </span>
          <h1 id="today-title" className="mt-3 font-display text-[28px] font-extrabold leading-tight tracking-tight text-ink sm:text-[36px]">
            {hello} <span className="bg-gradient-to-r from-brand-600 to-brand-400 bg-clip-text text-transparent">{firstName(me.full_name)}</span>
          </h1>
          <p className="mt-1 text-[15px] text-muted">
            {mine.length === 0
              ? t("today.summary.none")
              : t(mine.length > 1 ? "today.summary.many" : "today.summary.one", { n: mine.length })}
            {next && <> · {t("today.summary.next", { time: fmtTime(next.starts_at), name: firstName(nameOf(next.client_id)) })}</>}
          </p>
        </div>
        <LinkButton href="/seances/nouvelle" variant="primary" className="h-12 rounded-2xl px-5 text-base">
          <CalendarPlus className="size-5" /> {t("quick.session")}
        </LinkButton>
      </header>

      <ToCloseBanner sessions={forgotten} clientName={nameOf} coachName={manager ? (id) => staffName(staff.find((p) => p.id === id)) : undefined} />

      <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        {/* Séances du jour */}
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold">
              <CalendarDays className="size-5 text-brand-500" /> {t("today.sessions")}
            </h2>
            <Link href="/seances" className="text-sm font-semibold text-brand-600 hover:underline">
              {t("today.agenda")} →
            </Link>
          </div>
          {mine.length === 0 ? (
            <Empty
              icon={<CalendarDays className="size-6" />}
              title={t("today.empty.title")}
              text={t("today.empty.text")}
              action={
                <LinkButton href="/seances/nouvelle" className="h-12 px-5">
                  <CalendarPlus className="size-4" /> {t("today.empty.cta")}
                </LinkButton>
              }
            />
          ) : (
            <ul className="divide-y divide-line">
              {mine.map((s) => (
                <SessionRow key={s.id} s={s} name={nameOf(s.client_id)} forgotten={forgottenIds.has(s.id) || isForgotten(s, nowMs)} nowMs={nowMs} t={t} />
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-5">
          {/* À confirmer */}
          {pending.length > 0 && (
            <Card className="overflow-hidden border-amber-300">
              <div className="flex items-center justify-between gap-2 bg-amber-50 px-5 py-3">
                <h2 className="flex items-center gap-2 font-display font-bold text-amber-900">
                  <Hourglass className="size-4" /> {t("today.toConfirm")}
                  <span className="rounded-full bg-amber-500 px-2 py-0.5 text-xs text-white">{pending.length}</span>
                </h2>
                <Link href="/seances" className="text-xs font-semibold text-amber-800 hover:underline">
                  {t("today.seeAll")}
                </Link>
              </div>
              <ul className="divide-y divide-line">
                {pending.slice(0, 5).map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <span className="min-w-0 flex-1 text-sm">
                      <b className="block truncate">{nameOf(s.client_id)}</b>
                      <span className="text-xs text-muted">
                        {fmtDate(s.starts_at, { weekday: "short", day: "numeric", month: "short" })} · {fmtTime(s.starts_at)} · {s.type}
                      </span>
                    </span>
                    <div className="flex w-full gap-2 sm:w-auto">
                      <form action={quickAcceptAction} className="flex-1 sm:flex-none">
                        <input type="hidden" name="id" value={s.id} />
                        <SubmitButton variant="brand" className="h-11 w-full" pendingText="…">
                          <Check className="size-4" /> {t("today.accept")}
                        </SubmitButton>
                      </form>
                      <LinkButton href={`/seances/${s.id}`} variant="secondary" className="h-11 flex-1 sm:flex-none">
                        {t("today.refuseOrMove")}
                      </LinkButton>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {/* Alertes */}
          <Card className="overflow-hidden">
            <h2 className="flex items-center gap-2 border-b border-line px-5 py-4 font-display text-lg font-bold">
              <AlertTriangle className="size-5 text-accent-500" /> {t("today.alerts")}
            </h2>
            {alerts.length === 0 ? (
              <Empty icon={<Sparkles className="size-6" />} title={t("today.alerts.none")} text={t("today.alerts.noneText")} />
            ) : (
              <ul className="space-y-2 p-3">
                {alerts.slice(0, 5).map((a) => (
                  <li key={a.id}>
                    <Link href={a.href} className="group flex items-center gap-3 rounded-2xl border border-line p-3 transition hover:border-brand-200 hover:bg-canvas">
                      <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", a.tone)}>
                        <a.icon className="size-5" />
                      </span>
                      <span className="min-w-0 flex-1 text-sm">
                        <b className="block text-ink">{a.title}</b>
                        {a.text && <span className="block truncate text-xs text-slate-600">{a.text}</span>}
                        <span className="mt-0.5 block text-xs font-semibold text-brand-600">{a.cta} →</span>
                      </span>
                      <ChevronRight className="size-4 shrink-0 text-slate-300 group-hover:text-brand-500 rtl:-scale-x-100" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Créneaux libres aujourd'hui */}
          <Card className="p-5">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold">
              <Clock className="size-5 text-brand-500" /> {t("today.free")}
            </h2>
            {freeLater.length === 0 ? (
              <p className="mt-2 text-sm text-muted">
                {t("today.free.none")}{" "}
                <Link href="/disponibilites" className="font-semibold text-brand-600 hover:underline">
                  {t("today.free.manage")} →
                </Link>
              </p>
            ) : (
              <>
                <p className="mt-1 text-xs text-muted">{t("today.free.hint")}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {freeLater.slice(0, 10).map((h) => (
                    <Link
                      key={h}
                      href={`/seances/nouvelle?date=${today}&heure=${h}&coach=${me.id}`}
                      className="rounded-xl bg-emerald-50 px-3.5 py-2.5 text-sm font-bold tabular-nums text-emerald-700 ring-1 ring-emerald-100 transition hover:bg-emerald-100"
                    >
                      {h}
                    </Link>
                  ))}
                </div>
              </>
            )}
          </Card>
        </div>
      </div>
    </section>
  );
}

type Tr = (key: string, vars?: Record<string, string | number>) => string;

/** Une séance du jour : heure, client, statut et gros boutons (règles canStart / canFinish / canMarkAbsent) */
function SessionRow({ s, name, forgotten, nowMs, t }: { s: Session; name: string; forgotten: boolean; nowMs: number; t: Tr }) {
  const start = canStart(s, nowMs);
  const finish = canFinish(s);
  const absent = canMarkAbsent(s, nowMs) && !forgotten && s.status !== "en_cours";
  const waitStart = s.status === "acceptee" && !start && !timeReached(s, nowMs);
  const done = s.status === "realisee" || s.status === "absent";
  return (
    <li className={cn("p-4 sm:px-5", done && "bg-canvas/50")}>
      <Link href={`/seances/${s.id}`} className="group flex items-center gap-3">
        <span className={cn("w-14 shrink-0 font-display text-lg font-extrabold tabular-nums", s.status === "en_cours" ? "text-accent-600" : done ? "text-slate-400" : "text-brand-600")}>{fmtTime(s.starts_at)}</span>
        <Avatar name={name} size={44} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-bold text-ink group-hover:text-brand-600">{name}</span>
          <span className="block truncate text-xs text-muted">
            {s.type} · {s.duration_min} min
          </span>
        </span>
        {forgotten ? (
          <Badge tone="amber">
            <AlarmClock className="size-3" /> {t("today.toClose")}
          </Badge>
        ) : (
          <Badge tone={SESSION_BADGE[s.status]}>{SESSION_LABEL[s.status]}</Badge>
        )}
      </Link>
      {!forgotten && (start || finish || absent) && (
        <div className="mt-3 grid grid-cols-2 gap-2 sm:ps-[68px]">
          {start && (
            <form action={startSessionAction}>
              <input type="hidden" name="id" value={s.id} />
              <SubmitButton variant="primary" className="h-14 w-full rounded-2xl text-base" pendingText="…">
                <Play className="size-5 fill-current" /> {t("today.start")}
              </SubmitButton>
            </form>
          )}
          {finish && (
            <form action={endSessionAction} className="col-span-2">
              <input type="hidden" name="id" value={s.id} />
              <SubmitButton variant="brand" className="h-14 w-full rounded-2xl text-base" pendingText="…">
                <Square className="size-5 fill-current" /> {t("today.finish")}
              </SubmitButton>
            </form>
          )}
          {absent && (
            <form action={markSessionAction} className={cn(!start && "col-span-2")}>
              <input type="hidden" name="id" value={s.id} />
              <input type="hidden" name="status" value="absent" />
              <ConfirmButton message={t("today.absentConfirm", { name })} className="h-14 w-full rounded-2xl text-base">
                <UserX className="size-5" /> {t("today.absent")}
              </ConfirmButton>
            </form>
          )}
        </div>
      )}
      {!forgotten && waitStart && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted sm:ps-[68px]">
          <Hourglass className="size-3.5 text-accent-500" />
          {t("today.startFrom", { time: fmtTime(new Date(new Date(s.starts_at).getTime() - EARLY_START_MIN * 60000).toISOString()) })}
        </p>
      )}
      {!forgotten && s.status === "planifiee" && <p className="mt-2 text-xs font-semibold text-amber-700 sm:ps-[68px]">{t("today.waitingAnswer")}</p>}
    </li>
  );
}
