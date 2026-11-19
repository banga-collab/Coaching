import Link from "next/link";
import { AgendaTabs } from "@/components/planning/agenda-tabs";
import { AlertTriangle, Check, ChevronLeft, ChevronRight, Play, Plus, Shapes, Square } from "lucide-react";
import { isManager, requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Client, Profile, Session, SessionStatus } from "@/lib/types";
import { normName } from "@/lib/video";
import { SESSION_LABEL, agadirToIso, cn, dayKey, fmtDate, fmtTime } from "@/lib/utils";
import { BOOKED_STATUSES, EARLY_START_MIN, canStart, isForgotten, mondayOf, shiftDate, staffName } from "@/lib/planning";
import { Card, LinkButton, PageHeader } from "@/components/ui";
import { ListToolbar } from "@/components/list-toolbar";
import { SubmitButton } from "@/components/submit-button";
import { SESSION_TONE } from "@/components/planning/status";
import { ToCloseBanner, loadForgotten } from "@/components/planning/to-close";
import { endSessionAction, quickAcceptAction, startSessionAction } from "@/actions/planning";

export const metadata = { title: "Séances" };

const tone = SESSION_TONE;
const STATUSES = Object.keys(SESSION_LABEL) as SessionStatus[];

/** « Prénom N. » (nom complet en infobulle) */
function shortName(full: string) {
  const parts = full.trim().split(/\s+/);
  if (parts.length < 2) return full;
  return `${parts[0]} ${parts.at(-1)!.charAt(0).toUpperCase()}.`;
}

type SP = { semaine?: string; q?: string; statut?: string; coach?: string };

export default async function SessionsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const { semaine, q = "", statut = "", coach = "" } = sp;
  const me = await requireStaff();
  // Head coach et admin voient toutes les séances ; un coach seulement les siennes
  const isAdmin = isManager(me.role);
  const offset = Number(semaine ?? 0) || 0;
  // Semaine calculée à l'heure d'Agadir (indépendante du fuseau du serveur)
  const todayKey = dayKey(new Date());
  const monday = shiftDate(mondayOf(todayKey), offset * 7);
  const dayKeys = Array.from({ length: 7 }, (_, i) => shiftDate(monday, i));
  const days = dayKeys.map((k) => `${k}T12:00:00Z`);
  const supabase = await createClient();
  let weekQ = supabase.from("sessions").select("*").gte("starts_at", agadirToIso(monday, "00:00")).lt("starts_at", agadirToIso(shiftDate(monday, 7), "00:00"));
  if (!isAdmin) weekQ = weekQ.eq("coach_id", me.id);
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const [{ data: sData }, { data: cData }, { data: pData }, { data: pendData }, { data: todayData }, { count: toHandle }, forgotten] = await Promise.all([
    weekQ.order("starts_at"),
    supabase.from("clients").select("id, full_name"),
    isAdmin ? supabase.from("profiles").select("id, full_name, email").in("role", ["admin", "head_coach", "coach"]) : Promise.resolve({ data: [] }),
    // Séances qui attendent ma réponse
    supabase.from("sessions").select("*").eq("coach_id", me.id).eq("status", "planifiee").gte("starts_at", nowIso).order("starts_at"),
    // Mes séances d'aujourd'hui (boutons Démarrer / Terminer)
    supabase.from("sessions").select("*").eq("coach_id", me.id).in("status", ["acceptee", "en_cours"]).gte("starts_at", agadirToIso(todayKey, "00:00")).lt("starts_at", agadirToIso(shiftDate(todayKey, 1), "00:00")).order("starts_at"),
    // Refus et reports à traiter (managers)
    isAdmin
      ? supabase.from("sessions").select("id", { count: "exact", head: true }).in("status", ["refusee", "reportee"]).gte("starts_at", nowIso)
      : Promise.resolve({ count: 0 }),
    // Séances oubliées (heure passée, jamais démarrées / terminées)
    loadForgotten(supabase, isAdmin ? null : me.id),
  ]);
  const sessions = (sData ?? []) as Session[];
  const pending = (pendData ?? []) as Session[];
  const forgottenIds = new Set(forgotten.map((s) => s.id));
  // Aujourd'hui : séances acceptées pas encore oubliées, et séances en cours
  const mineToday = ((todayData ?? []) as Session[]).filter((s) => !forgottenIds.has(s.id) && !isForgotten(s, nowMs));
  const names = new Map(((cData ?? []) as Pick<Client, "id" | "full_name">[]).map((c) => [c.id, c.full_name]));
  const coachList = (pData ?? []) as Pick<Profile, "id" | "full_name" | "email">[];

  // Séances de la semaine, regroupées par jour
  const inWeek = sessions.filter((s) => dayKeys.includes(dayKey(s.starts_at)));
  const needle = normName(q);
  const searched = needle ? inWeek.filter((s) => normName(`${names.get(s.client_id) ?? ""} ${s.type}`).includes(needle)) : inWeek;
  const byCoach = isAdmin && coach ? searched.filter((s) => s.coach_id === coach) : searched;
  const visible = statut ? byCoach.filter((s) => s.status === statut) : byCoach;
  const byDay = new Map<string, Session[]>(dayKeys.map((k) => [k, []]));
  for (const s of visible) byDay.get(dayKey(s.starts_at))?.push(s);
  const done = visible.filter((s) => s.status === "realisee").length;
  // Une seule définition : séances réservées (jamais les refusées ni les annulées)
  const booked = visible.filter((s) => BOOKED_STATUSES.includes(s.status)).length;

  const statusCount = new Map<string, number>();
  for (const s of byCoach) statusCount.set(s.status, (statusCount.get(s.status) ?? 0) + 1);
  const coachCount = new Map<string, number>();
  for (const s of searched) coachCount.set(s.coach_id, (coachCount.get(s.coach_id) ?? 0) + 1);
  const filters = [
    { param: "statut", label: "Statut", options: STATUSES.map((s) => ({ value: s, label: SESSION_LABEL[s], count: statusCount.get(s) ?? 0 })) },
    ...(isAdmin && coachList.length > 1
      ? [{ param: "coach", label: "Coach", options: coachList.map((p) => ({ value: p.id, label: p.full_name || p.email, count: coachCount.get(p.id) ?? 0 })) }]
      : []),
  ];

  // Navigation semaine en conservant recherche et filtres
  const weekHref = (o: number) => {
    const p = new URLSearchParams();
    if (o) p.set("semaine", String(o));
    if (q) p.set("q", q);
    if (statut) p.set("statut", statut);
    if (coach) p.set("coach", coach);
    const qs = p.toString();
    return qs ? `/seances?${qs}` : "/seances";
  };

  return (
    <>
      <AgendaTabs active="seances" />
      <PageHeader
        title="Séances"
        subtitle={`Semaine du ${fmtDate(days[0]!, { day: "numeric", month: "long" })} · ${booked} séance${booked > 1 ? "s" : ""}, ${done} réalisée${done > 1 ? "s" : ""}`}
        actions={
          <>
            <LinkButton href="/seances/types" variant="secondary">
              <Shapes className="size-4" /> Types de séance
            </LinkButton>
            <LinkButton href="/seances/nouvelle">
              <Plus className="size-4" /> Nouvelle séance
            </LinkButton>
          </>
        }
      />

      <ToCloseBanner
        sessions={forgotten}
        clientName={(id) => names.get(id) ?? "Client"}
        coachName={isAdmin ? (id) => staffName(coachList.find((p) => p.id === id)) : undefined}
      />

      {pending.length > 0 && (
        <Card className="mb-4 overflow-hidden border-amber-300">
          <div className="flex items-center justify-between gap-3 bg-amber-50 px-4 py-2.5">
            <p className="font-display font-bold text-amber-900">
              À confirmer <span className="ms-1 rounded-full bg-amber-400 px-2 py-0.5 text-xs text-white">{pending.length}</span>
            </p>
            <p className="hidden text-xs text-amber-800 sm:block">Séances qu&apos;on t&apos;a affectées : accepte, refuse ou propose un autre horaire.</p>
          </div>
          <ul className="divide-y divide-line">
            {pending.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                <span className="min-w-0 flex-1 text-sm">
                  <b className="block truncate">{names.get(s.client_id) ?? "Client"}</b>
                  <span className="text-xs text-muted">
                    {fmtDate(s.starts_at, { weekday: "short", day: "numeric", month: "short" })} · {fmtTime(s.starts_at)} · {s.duration_min} min · {s.type}
                  </span>
                </span>
                <form action={quickAcceptAction}>
                  <input type="hidden" name="id" value={s.id} />
                  <SubmitButton variant="brand" className="h-9" pendingText="…">
                    <Check className="size-4" /> Accepter
                  </SubmitButton>
                </form>
                <LinkButton href={`/seances/${s.id}`} variant="secondary" className="h-9">
                  Refuser / Reporter
                </LinkButton>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {isAdmin && (toHandle ?? 0) > 0 && (
        <Link href="/planning" className="mb-4 flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 py-2.5 text-sm font-semibold text-violet-900 transition hover:bg-violet-100">
          <AlertTriangle className="size-4" /> {toHandle} refus / report{(toHandle ?? 0) > 1 ? "s" : ""} à traiter dans le planning de l&apos;équipe →
        </Link>
      )}

      {mineToday.length > 0 && (
        <div className="mb-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {mineToday.map((s) => (
            <Card key={s.id} className={cn("flex items-center gap-3 border-s-4 p-3", s.status === "en_cours" ? "border-s-orange-500" : "border-s-brand-500")}>
              <Link href={`/seances/${s.id}`} className="min-w-0 flex-1 text-sm">
                <span className="block text-xs font-semibold uppercase tracking-wide text-muted">Aujourd&apos;hui · {fmtTime(s.starts_at)}</span>
                <b className="block truncate">{names.get(s.client_id) ?? "Client"}</b>
                <span className="block truncate text-xs text-muted">{s.status === "en_cours" ? `En cours depuis ${fmtTime(s.started_at ?? s.starts_at)}` : s.type}</span>
              </Link>
              {s.status === "en_cours" || canStart(s, nowMs) ? (
                <form action={s.status === "en_cours" ? endSessionAction : startSessionAction}>
                  <input type="hidden" name="id" value={s.id} />
                  {s.status === "en_cours" ? (
                    <SubmitButton variant="brand" className="h-11" pendingText="…">
                      <Square className="size-4 fill-current" /> Terminer
                    </SubmitButton>
                  ) : (
                    <SubmitButton variant="primary" className="h-11" pendingText="…">
                      <Play className="size-4 fill-current" /> Démarrer
                    </SubmitButton>
                  )}
                </form>
              ) : (
                <span className="shrink-0 rounded-lg bg-slate-50 px-2 py-1 text-center text-[11px] font-semibold text-muted" title="Démarrage possible 30 min avant l'heure prévue">
                  Démarrage
                  <br />à {fmtTime(new Date(new Date(s.starts_at).getTime() - EARLY_START_MIN * 60000).toISOString())}
                </span>
              )}
            </Card>
          ))}
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex h-10 shrink-0 items-center rounded-xl bg-white ring-1 ring-line">
          <Link href={weekHref(offset - 1)} className="grid size-10 place-items-center text-muted hover:text-ink" aria-label="Semaine précédente">
            <ChevronLeft className="size-4 rtl:rotate-180" />
          </Link>
          <Link href={weekHref(0)} className={cn("px-2 text-sm font-semibold", offset === 0 ? "text-brand-600" : "text-muted hover:text-ink")}>
            Cette semaine
          </Link>
          <Link href={weekHref(offset + 1)} className="grid size-10 place-items-center text-muted hover:text-ink" aria-label="Semaine suivante">
            <ChevronRight className="size-4 rtl:rotate-180" />
          </Link>
        </div>
        <ListToolbar
          className="mb-0! min-w-0 flex-1"
          placeholder="Client ou type de séance…"
          filters={filters}
          exportKind="seances"
          exportParams={{ from: dayKeys[0]!, to: dayKeys[6]! }}
        />
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {days.map((d, i) => {
          const k = dayKeys[i]!;
          const list = byDay.get(k) ?? [];
          const isToday = k === todayKey;
          return (
            <Card key={k} className={cn("flex min-h-40 min-w-0 flex-col p-2.5", isToday && "ring-2 ring-accent-400")}>
              <div className="mb-1.5 flex items-baseline justify-between px-1">
                <span className={cn("text-xs font-semibold uppercase tracking-wider", isToday ? "text-accent-600" : "text-muted")}>{fmtDate(d, { weekday: "short" })}</span>
                <span className={cn("font-display text-lg font-extrabold", isToday ? "text-accent-500" : "text-ink")}>{fmtDate(d, { day: "numeric" })}</span>
              </div>
              <div className="flex-1 space-y-1">
                {list.map((s) => {
                  const full = names.get(s.client_id) ?? "Client";
                  return (
                    <Link
                      key={s.id}
                      href={`/seances/${s.id}`}
                      title={`${fmtTime(s.starts_at)} · ${full} · ${s.type} (${SESSION_LABEL[s.status]})`}
                      className={cn("block rounded-lg border-s-[3px] px-2 py-1.5 text-xs leading-snug transition hover:brightness-95", tone[s.status])}
                    >
                      <span className="flex flex-wrap items-baseline gap-x-1.5">
                        <span className="tabular-nums opacity-70">{fmtTime(s.starts_at)}</span>
                        <b className="break-words">{shortName(full)}</b>
                      </span>
                      <span className="line-clamp-1 opacity-80">{s.type}</span>
                    </Link>
                  );
                })}
              </div>
              <Link href={`/seances/nouvelle?date=${k}`} className="mt-1.5 flex items-center justify-center gap-1 rounded-lg py-1 text-xs font-semibold text-slate-400 transition hover:bg-canvas hover:text-brand-500">
                <Plus className="size-3.5" /> Ajouter
              </Link>
            </Card>
          );
        })}
      </div>
    </>
  );
}
