import Link from "next/link";
import { AgendaTabs } from "@/components/planning/agenda-tabs";
import { sessionTypeOptions } from "@/lib/session-extras";
import { AlertTriangle, CalendarRange, ChevronLeft, ChevronRight, Clock, Plane, Users } from "lucide-react";
import { requireManager } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { CoachAvailability, CoachTimeOff, Session } from "@/lib/types";
import {
  WEEKDAYS_SHORT,
  firstName,
  fmtMinutes,
  freeCoachesIn,
  freeSlotsOfDay,
  isBooked,
  loadPlanningData,
  loadStaff,
  localSlot,
  mondayOf,
  shiftDate,
  staffName,
  toMin,
  weekdayOf,
  type ClassBlock,
  type PlanningData,
  type StaffMember,
} from "@/lib/planning";
import { SESSION_LABEL, agadirToIso, cn, dayKey, fmtDate, fmtTime } from "@/lib/utils";
import { Avatar, Badge, Card, CardHeader, Select } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { SESSION_BADGE, SESSION_DOT, SESSION_TONE } from "@/components/planning/status";
import { AssignForm } from "@/components/planning/assign-form";
import { PlanForm } from "@/components/planning/plan-form";
import { ToCloseBanner, loadForgotten } from "@/components/planning/to-close";
import { keepOriginalTimeAction, reassignSessionAction, validateProposalAction } from "@/actions/planning";

export const metadata = { title: "Planning de l'équipe" };

type SP = { jour?: string; vue?: string; client?: string; coach?: string; heure?: string };
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const PX_PER_MIN = 1;
const shortName = (full: string) => {
  const parts = full.trim().split(/\s+/);
  return parts.length < 2 ? full : `${parts[0]} ${parts.at(-1)!.charAt(0).toUpperCase()}.`;
};
const dLabel = (date: string, opts: Intl.DateTimeFormatOptions) => fmtDate(`${date}T12:00:00Z`, opts);
const hatch = { backgroundImage: "repeating-linear-gradient(135deg, rgba(148,163,184,.12) 0 6px, transparent 6px 12px)" };
const offHatch = { backgroundImage: "repeating-linear-gradient(135deg, rgba(239,68,68,.10) 0 8px, rgba(255,255,255,.6) 8px 16px)" };

export default async function PlanningPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  await requireManager();
  const today = dayKey(new Date());
  const jour = sp.jour && DATE.test(sp.jour) ? sp.jour : today;
  const vue = sp.vue === "semaine" ? "semaine" : "jour";
  const from = vue === "semaine" ? mondayOf(jour) : jour;
  const days = vue === "semaine" ? Array.from({ length: 7 }, (_, i) => shiftDate(from, i)) : [jour];
  const fromIso = agadirToIso(from, "00:00");
  const toIso = agadirToIso(shiftDate(from, days.length), "00:00");

  const supabase = await createClient();
  const types = await sessionTypeOptions(supabase);
  const nowIso = new Date().toISOString();
  const [staff, { data: sData }, { data: cData }, { data: tData }, { data: rData }, forgotten] = await Promise.all([
    loadStaff(supabase),
    supabase.from("sessions").select("*").gte("starts_at", fromIso).lt("starts_at", toIso).order("starts_at"),
    supabase.from("clients").select("id, full_name, coach_id, status").order("full_name"),
    supabase.from("sessions").select("*").in("status", ["planifiee", "refusee", "reportee"]).gte("starts_at", nowIso).order("starts_at").limit(40),
    // Reports dont l'horaire initial est passé mais l'horaire proposé encore à venir
    supabase.from("sessions").select("*").eq("status", "reportee").gte("proposed_at", nowIso).lt("starts_at", nowIso),
    loadForgotten(supabase, null),
  ]);
  const sessions = ((sData ?? []) as Session[]).filter((s) => s.status !== "annulee");
  const clients = (cData ?? []) as { id: string; full_name: string; coach_id: string; status: string }[];
  const names = new Map(clients.map((c) => [c.id, c.full_name]));
  const todo = [...((tData ?? []) as Session[]), ...((rData ?? []) as Session[])];
  const staffIds = new Set(staff.map((p) => p.id));
  const columns: StaffMember[] = [...staff];
  // Séances d'un coach désactivé : on garde une colonne pour ne rien cacher
  for (const s of sessions) if (!staffIds.has(s.coach_id) && !columns.some((p) => p.id === s.coach_id)) columns.push({ id: s.coach_id, full_name: "Coach inactif", email: "", role: "coach" });

  // Données des créneaux : période affichée + séances à traiter
  const lastTodo = todo.reduce((m, s) => (s.starts_at > m ? s.starts_at : m), toIso);
  const firstTodo = todo.reduce((m, s) => (s.starts_at < m ? s.starts_at : m), fromIso);
  const data: PlanningData = await loadPlanningData(supabase, firstTodo, lastTodo);
  const offOn = (coachId: string, date: string) => data.timeOff.find((t) => t.coach_id === coachId && t.starts_on <= date && t.ends_on >= date) ?? null;
  const avOn = (coachId: string, date: string) => data.availability.filter((a) => a.coach_id === coachId && a.weekday === weekdayOf(date)).sort((x, y) => toMin(x.start_time) - toMin(y.start_time));
  const availMin = (coachId: string) => days.reduce((t, d) => (offOn(coachId, d) ? t : t + avOn(coachId, d).reduce((u, a) => u + toMin(a.end_time) - toMin(a.start_time), 0)), 0);
  // Une seule définition des séances comptées (jamais les refusées ni les annulées)
  const counted = (s: Session) => isBooked(s);
  // Cours collectifs (occupent le coach) des jours affichés
  const classesOn = (coachId: string, date: string) => data.classes.filter((c) => c.coach_id === coachId && dayKey(c.starts_at) === date);
  const load = (coachId: string) => {
    const list = sessions.filter((s) => s.coach_id === coachId && counted(s));
    const cls = days.flatMap((d) => classesOn(coachId, d));
    return {
      n: list.length,
      min: list.reduce((t, s) => t + s.duration_min, 0) + cls.reduce((t, c) => t + c.duration_min, 0),
      waiting: list.filter((s) => s.status === "planifiee").length,
      classes: cls.length,
    };
  };

  // Axe horaire (vue jour) : élargi aux créneaux et séances du jour
  let axisStart = 7 * 60;
  let axisEnd = 21 * 60;
  if (vue === "jour") {
    for (const p of columns) for (const a of avOn(p.id, jour)) { axisStart = Math.min(axisStart, toMin(a.start_time)); axisEnd = Math.max(axisEnd, toMin(a.end_time)); }
    for (const s of sessions) { const m = localSlot(s.starts_at).min; axisStart = Math.min(axisStart, m); axisEnd = Math.max(axisEnd, m + s.duration_min); }
    for (const c of data.classes) if (dayKey(c.starts_at) === jour) { const m = localSlot(c.starts_at).min; axisStart = Math.min(axisStart, m); axisEnd = Math.max(axisEnd, m + c.duration_min); }
    axisStart = Math.max(0, Math.floor(axisStart / 60) * 60);
    axisEnd = Math.min(24 * 60, Math.ceil(axisEnd / 60) * 60);
  }
  const hours = Array.from({ length: (axisEnd - axisStart) / 60 }, (_, i) => axisStart / 60 + i);
  const top = (m: number) => (m - axisStart) * PX_PER_MIN;

  const href = (o: Partial<SP>) => {
    const p = new URLSearchParams();
    const next = { jour, vue, ...o };
    if (next.jour && next.jour !== today) p.set("jour", next.jour);
    if (next.vue === "semaine") p.set("vue", "semaine");
    if (next.coach) p.set("coach", next.coach);
    if (next.heure) p.set("heure", next.heure);
    if (next.client) p.set("client", next.client);
    const qs = p.toString();
    return qs ? `/planning?${qs}` : "/planning";
  };
  const step = vue === "semaine" ? 7 : 1;
  const title =
    vue === "semaine"
      ? `Semaine du ${dLabel(from, { day: "numeric", month: "long" })}`
      : dLabel(jour, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const total = sessions.filter(counted).length;
  const waiting = sessions.filter((s) => s.status === "planifiee").length;

  // Coachs libres pour chaque séance à traiter (même horaire)
  const freeFor = (s: Session) => new Set(freeCoachesIn(data, staff, s.starts_at, s.duration_min, s.id).map((p) => p.id));

  return (
    <>
      <AgendaTabs active="planning" />
      <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink sm:text-[28px]">Planning de l&apos;équipe</h1>
          <p className="mt-1 text-sm text-muted">
            <span className="capitalize">{title}</span> · {total} séance{total > 1 ? "s" : ""}
            {waiting ? ` · ${waiting} en attente de réponse` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex h-10 items-center rounded-xl bg-white ring-1 ring-line">
            <Link href={href({ jour: shiftDate(jour, -step) })} className="grid size-10 place-items-center text-muted hover:text-ink" aria-label="Précédent">
              <ChevronLeft className="size-4" />
            </Link>
            <Link href={href({ jour: today })} className={cn("px-2 text-sm font-semibold", (vue === "jour" ? jour === today : mondayOf(today) === from) ? "text-brand-600" : "text-muted hover:text-ink")}>
              Aujourd&apos;hui
            </Link>
            <Link href={href({ jour: shiftDate(jour, step) })} className="grid size-10 place-items-center text-muted hover:text-ink" aria-label="Suivant">
              <ChevronRight className="size-4" />
            </Link>
          </div>
          <div className="flex h-10 items-center rounded-xl bg-white p-1 ring-1 ring-line">
            {(["jour", "semaine"] as const).map((v) => (
              <Link key={v} href={href({ vue: v })} className={cn("rounded-lg px-3 py-1.5 text-sm font-semibold capitalize", vue === v ? "bg-brand-500 text-white" : "text-muted hover:text-ink")}>
                {v}
              </Link>
            ))}
          </div>
          <form action="/planning" className="flex h-10 items-center gap-1 rounded-xl bg-white px-2 ring-1 ring-line">
            {vue === "semaine" && <input type="hidden" name="vue" value="semaine" />}
            <input type="date" name="jour" defaultValue={jour} className="h-8 bg-transparent text-sm outline-none" aria-label="Aller à la date" />
            <button className="rounded-lg px-2 py-1 text-xs font-bold text-brand-600 hover:bg-brand-50">OK</button>
          </form>
        </div>
      </header>

      <ToCloseBanner
        sessions={forgotten}
        clientName={(id) => names.get(id) ?? "Client"}
        coachName={(id) => firstName(staffName(columns.find((p) => p.id === id)))}
      />

      {/* Légende */}
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-3 rounded-sm bg-white ring-1 ring-brand-200" /> Disponible
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-3 rounded-sm ring-1 ring-line" style={hatch} /> Hors créneaux
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-3 rounded-sm ring-1 ring-red-200" style={offHatch} /> Congé
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-3 rounded-sm border-s-[3px] border-indigo-500 bg-indigo-50" /> Cours collectif
        </span>
        {(["planifiee", "acceptee", "reportee", "en_cours", "realisee", "refusee", "absent"] as const).map((st) => (
          <span key={st} className="inline-flex items-center gap-1.5">
            <span className={cn("size-2.5 rounded-full", SESSION_DOT[st])} /> {SESSION_LABEL[st]}
          </span>
        ))}
      </div>

      <div className="grid gap-5 2xl:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-5">
          {vue === "jour" ? (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <div className="flex min-w-max">
                  {/* Axe horaire */}
                  <div className="sticky left-0 z-20 w-14 shrink-0 border-e border-line bg-white">
                    <div className="h-[104px] border-b border-line" />
                    <div className="relative" style={{ height: (axisEnd - axisStart) * PX_PER_MIN }}>
                      {hours.map((h) => (
                        <span key={h} className="absolute end-2 -translate-y-1/2 text-[11px] font-semibold tabular-nums text-slate-400" style={{ top: top(h * 60) }}>
                          {String(h).padStart(2, "0")}:00
                        </span>
                      ))}
                    </div>
                  </div>
                  {columns.map((p) => {
                    const off = offOn(p.id, jour);
                    const av = avOn(p.id, jour);
                    const l = load(p.id);
                    const avail = availMin(p.id);
                    const ratio = avail ? Math.min(100, Math.round((l.min / avail) * 100)) : 0;
                    const list = sessions.filter((s) => s.coach_id === p.id && dayKey(s.starts_at) === jour);
                    const proposals = sessions.concat(todo).filter((s, i, arr) => arr.findIndex((x) => x.id === s.id) === i && s.coach_id === p.id && s.status === "reportee" && s.proposed_at && dayKey(s.proposed_at) === jour);
                    const freeStarts = off ? [] : freeSlotsOfDay(data, p.id, jour, 60, 60).filter((t) => jour > today || agadirToIso(jour, t) > nowIso).slice(0, 6);
                    return (
                      <div key={p.id} className="w-48 shrink-0 border-e border-line last:border-e-0">
                        <div className="h-[104px] border-b border-line px-2.5 py-2">
                          <Link href={`/disponibilites?coach=${p.id}`} className="flex items-center gap-2" title="Voir ses créneaux">
                            <Avatar name={staffName(p)} size={28} />
                            <span className="min-w-0">
                              <b className="block truncate text-sm leading-tight">{staffName(p)}</b>
                              <span className="block text-[11px] text-muted">
                                {l.n} séance{l.n > 1 ? "s" : ""}
                                {l.classes ? ` · ${l.classes} cours` : ""} · {fmtMinutes(l.min)}
                                {l.waiting ? ` · ${l.waiting} en attente` : ""}
                              </span>
                            </span>
                          </Link>
                          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100" title={`Charge : ${ratio}% des créneaux`}>
                            <span className={cn("block h-full rounded-full", ratio > 85 ? "bg-red-500" : ratio > 60 ? "bg-accent-500" : "bg-emerald-500")} style={{ width: `${ratio}%` }} />
                          </div>
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {off ? (
                              <span className="text-[11px] font-semibold text-red-600">En congé</span>
                            ) : freeStarts.length ? (
                              freeStarts.map((t) => (
                                <Link key={t} href={`${href({ coach: p.id, heure: t })}#affecter`} className="rounded bg-emerald-50 px-1 text-[10px] font-bold tabular-nums text-emerald-700 ring-1 ring-emerald-100 hover:bg-emerald-100" title="Affecter une séance à ce créneau">
                                  {t}
                                </Link>
                              ))
                            ) : (
                              <span className="text-[11px] text-slate-400">{av.length ? "Complet" : "Pas de créneau"}</span>
                            )}
                          </div>
                        </div>
                        <div className="relative" style={{ height: (axisEnd - axisStart) * PX_PER_MIN, ...hatch }}>
                          {hours.map((h) => (
                            <span key={h} className="absolute inset-x-0 border-t border-slate-100" style={{ top: top(h * 60) }} />
                          ))}
                          {av.map((a) => (
                            <Link
                              key={a.id}
                              href={`${href({ coach: p.id, heure: a.start_time.slice(0, 5) })}#affecter`}
                              className="absolute inset-x-1 rounded-md border border-dashed border-brand-200 bg-white/95 transition hover:bg-brand-50/60"
                              style={{ top: top(toMin(a.start_time)), height: (toMin(a.end_time) - toMin(a.start_time)) * PX_PER_MIN }}
                              title={`Disponible ${a.start_time.slice(0, 5)}–${a.end_time.slice(0, 5)}`}
                            >
                              <span className="absolute end-1 top-0.5 text-[9px] font-semibold text-brand-300">{a.start_time.slice(0, 5)}</span>
                            </Link>
                          ))}
                          {off && (
                            <div className="absolute inset-0 z-[5] grid place-items-center p-2 text-center" style={offHatch}>
                              <span className="rounded-lg bg-white/90 px-2 py-1 text-xs font-semibold text-red-700 shadow-sm">
                                <Plane className="mx-auto mb-0.5 size-4" />
                                Congé{off.reason ? ` : ${off.reason}` : ""}
                              </span>
                            </div>
                          )}
                          {classesOn(p.id, jour).map((c) => (
                            <ClassBlockLink key={`c-${c.id}`} c={c} style={{ top: top(localSlot(c.starts_at).min) + 1, height: Math.max(24, c.duration_min * PX_PER_MIN - 2) }} />
                          ))}
                          {proposals.map((s) => (
                            <Link
                              key={`p-${s.id}`}
                              href={`/seances/${s.id}`}
                              className="absolute inset-x-2 z-[6] rounded-md border-2 border-dashed border-violet-400 bg-violet-50/70 px-1.5 py-0.5 text-[10px] font-semibold text-violet-800"
                              style={{ top: top(localSlot(s.proposed_at!).min), height: Math.max(22, s.duration_min * PX_PER_MIN) }}
                              title="Nouvel horaire proposé (à valider)"
                            >
                              Proposé : {fmtTime(s.proposed_at!)} · {shortName(names.get(s.client_id) ?? "Client")}
                            </Link>
                          ))}
                          {list.map((s) => {
                            const m = localSlot(s.starts_at).min;
                            return (
                              <Link
                                key={s.id}
                                href={`/seances/${s.id}`}
                                className={cn("absolute inset-x-1.5 z-10 overflow-hidden rounded-md border-s-[3px] px-1.5 py-1 text-[11px] leading-tight shadow-sm transition hover:z-20 hover:brightness-95", SESSION_TONE[s.status])}
                                style={{ top: top(m) + 1, height: Math.max(24, s.duration_min * PX_PER_MIN - 2) }}
                                title={`${fmtTime(s.starts_at)} · ${names.get(s.client_id) ?? "Client"} · ${s.type} (${SESSION_LABEL[s.status]})`}
                              >
                                <span className="flex items-baseline gap-1">
                                  <span className="tabular-nums opacity-70">{fmtTime(s.starts_at)}</span>
                                  <b className="truncate">{shortName(names.get(s.client_id) ?? "Client")}</b>
                                </span>
                                {s.duration_min >= 40 && <span className="block truncate opacity-80">{s.type}</span>}
                                {s.duration_min >= 55 && <span className="block truncate text-[10px] font-semibold opacity-70">{SESSION_LABEL[s.status]}</span>}
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Card>
          ) : (
            <WeekView columns={columns} days={days} today={today} sessions={sessions} names={names} offOn={offOn} avOn={avOn} classesOn={classesOn} load={load} availMin={availMin} href={href} />
          )}

          {/* Réponses à traiter */}
          <Card className="overflow-hidden">
            <CardHeader title="Suivi des affectations" subtitle="Séances à venir en attente, refusées ou avec un nouvel horaire proposé" icon={<AlertTriangle className="size-4" />} />
            {todo.length === 0 ? (
              <p className="border-t border-line px-5 py-6 text-center text-sm text-muted">Tout est confirmé. 👌</p>
            ) : (
              <ul className="divide-y divide-line border-t border-line">
                {todo.map((s) => {
                  const coach = columns.find((p) => p.id === s.coach_id);
                  const free = s.status === "planifiee" ? null : freeFor(s);
                  return (
                    <li key={s.id} className="grid gap-3 px-5 py-3 lg:grid-cols-[1fr_auto] lg:items-center">
                      <div className="min-w-0 text-sm">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link href={`/seances/${s.id}`} className="font-semibold hover:text-brand-600">
                            {names.get(s.client_id) ?? "Client"}
                          </Link>
                          <Badge tone={SESSION_BADGE[s.status]}>{SESSION_LABEL[s.status]}</Badge>
                        </div>
                        <p className="text-xs text-muted">
                          {fmtDate(s.starts_at, { weekday: "short", day: "numeric", month: "short" })} · {fmtTime(s.starts_at)} · {s.duration_min} min · {firstName(staffName(coach))}
                        </p>
                        {s.status === "reportee" && s.proposed_at && (
                          <p className="mt-0.5 text-xs text-violet-800">
                            Proposé : <b>{fmtDate(s.proposed_at, { weekday: "short", day: "numeric", month: "short" })} à {fmtTime(s.proposed_at)}</b>
                            {s.response_note ? ` · « ${s.response_note} »` : ""}
                          </p>
                        )}
                        {s.status === "refusee" && s.response_note && <p className="mt-0.5 text-xs text-red-700">Motif : {s.response_note}</p>}
                      </div>
                      {free && (
                        <div className="flex flex-wrap items-start gap-2">
                          {s.status === "reportee" && !!s.proposed_at && s.proposed_at > nowIso && (
                            <PlanForm action={validateProposalAction}>
                              <input type="hidden" name="id" value={s.id} />
                              <SubmitButton variant="brand" className="h-9" pendingText="…">
                                Valider le nouvel horaire
                              </SubmitButton>
                            </PlanForm>
                          )}
                          {s.status === "reportee" && s.starts_at > nowIso && (
                            <PlanForm action={keepOriginalTimeAction}>
                              <input type="hidden" name="id" value={s.id} />
                              <SubmitButton variant="secondary" className="h-9" pendingText="…">
                                Garder l&apos;horaire initial
                              </SubmitButton>
                            </PlanForm>
                          )}
                          <PlanForm action={reassignSessionAction} className="flex items-start gap-2">
                            <input type="hidden" name="id" value={s.id} />
                            <Select name="coach_id" required defaultValue="" className="h-9 w-48 text-xs">
                              <option value="" disabled>
                                Réaffecter à…
                              </option>
                              {staff
                                .filter((p) => p.id !== s.coach_id)
                                .map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {free.has(p.id) ? "✓ " : "✗ "}
                                    {staffName(p)}
                                  </option>
                                ))}
                            </Select>
                            <SubmitButton variant="secondary" className="h-9" pendingText="…">
                              OK
                            </SubmitButton>
                          </PlanForm>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          <AssignForm
            clients={clients.filter((c) => c.status !== "termine")}
            staff={staff}
            types={types.names}
            prices={types.prices}
            defaults={{ client: sp.client, coach: sp.coach, date: jour < today ? today : jour, time: sp.heure && /^\d{2}:\d{2}$/.test(sp.heure) ? sp.heure : undefined }}
          />
          <Card className="p-5 text-xs text-muted">
            <p className="mb-1 flex items-center gap-1.5 font-semibold text-ink">
              <Clock className="size-3.5" /> Astuce
            </p>
            Clique sur une heure verte (créneau libre) ou sur une zone disponible du planning pour pré-remplir le coach et l&apos;heure. Les créneaux se gèrent dans{" "}
            <Link href="/disponibilites" className="font-semibold text-brand-600">
              Disponibilités
            </Link>
            .
          </Card>
        </div>
      </div>
    </>
  );
}

/* ---------- Vue semaine : une ligne par coach, une colonne par jour ---------- */
function WeekView({
  columns,
  days,
  today,
  sessions,
  names,
  offOn,
  avOn,
  classesOn,
  load,
  availMin,
  href,
}: {
  columns: StaffMember[];
  days: string[];
  today: string;
  sessions: Session[];
  names: Map<string, string>;
  offOn: (coachId: string, date: string) => CoachTimeOff | null;
  avOn: (coachId: string, date: string) => CoachAvailability[];
  classesOn: (coachId: string, date: string) => ClassBlock[];
  load: (coachId: string) => { n: number; min: number; waiting: number; classes: number };
  availMin: (coachId: string) => number;
  href: (o: Partial<SP>) => string;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] table-fixed border-collapse text-xs">
          <thead>
            <tr className="border-b border-line bg-slate-50/60">
              <th className="w-44 px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <CalendarRange className="me-1 inline size-3.5" /> Coach
              </th>
              {days.map((d, i) => (
                <th key={d} className={cn("px-2 py-2 text-left", d === today && "bg-accent-50")}>
                  <Link href={href({ vue: "jour", jour: d })} className="block hover:text-brand-600">
                    <span className={cn("text-[11px] font-semibold uppercase", d === today ? "text-accent-600" : "text-slate-500")}>{WEEKDAYS_SHORT[i]}</span>{" "}
                    <b className="font-display text-sm">{dLabel(d, { day: "numeric" })}</b>
                  </Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {columns.map((p) => {
              const l = load(p.id);
              const avail = availMin(p.id);
              const ratio = avail ? Math.min(100, Math.round((l.min / avail) * 100)) : 0;
              return (
                <tr key={p.id} className="align-top">
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <Avatar name={staffName(p)} size={26} />
                      <b className="truncate text-sm">{staffName(p)}</b>
                    </div>
                    <p className="mt-1 text-[11px] text-muted">
                      {l.n} séance{l.n > 1 ? "s" : ""}
                      {l.classes ? ` · ${l.classes} cours` : ""} · {fmtMinutes(l.min)} / {fmtMinutes(avail)}
                    </p>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <span className={cn("block h-full rounded-full", ratio > 85 ? "bg-red-500" : ratio > 60 ? "bg-accent-500" : "bg-emerald-500")} style={{ width: `${ratio}%` }} />
                    </div>
                    {l.waiting > 0 && <p className="mt-1 text-[11px] font-semibold text-amber-700">{l.waiting} en attente</p>}
                  </td>
                  {days.map((d) => {
                    const off = offOn(p.id, d);
                    const av = avOn(p.id, d);
                    const list = sessions.filter((s) => s.coach_id === p.id && dayKey(s.starts_at) === d);
                    const cls = classesOn(p.id, d);
                    return (
                      <td key={d} className={cn("border-s border-line px-1.5 py-1.5", d === today && "bg-accent-50/40")} style={off ? offHatch : av.length ? undefined : hatch}>
                        {off ? (
                          <p className="mb-1 rounded bg-white/90 px-1 text-[10px] font-semibold text-red-700">Congé{off.reason ? ` · ${off.reason}` : ""}</p>
                        ) : av.length ? (
                          <p className="mb-1 truncate text-[10px] font-semibold text-brand-400" title="Créneaux disponibles">
                            {av.map((a) => `${a.start_time.slice(0, 5)}–${a.end_time.slice(0, 5)}`).join(" · ")}
                          </p>
                        ) : (
                          <p className="mb-1 text-[10px] text-slate-400">Repos</p>
                        )}
                        <div className="space-y-1">
                          {cls.map((c) => (
                            <Link
                              key={`c-${c.id}`}
                              href={`/cours/${c.id}`}
                              className="block truncate rounded border-s-[3px] border-indigo-500 bg-indigo-50 px-1.5 py-1 leading-tight text-indigo-800 hover:brightness-95"
                              title={`Cours collectif « ${c.title} » · ${fmtTime(c.starts_at)} · ${c.duration_min} min`}
                            >
                              <span className="tabular-nums opacity-70">{fmtTime(c.starts_at)}</span> <b>{c.title}</b>
                            </Link>
                          ))}
                          {list.map((s) => (
                            <Link
                              key={s.id}
                              href={`/seances/${s.id}`}
                              className={cn("block truncate rounded border-s-[3px] px-1.5 py-1 leading-tight hover:brightness-95", SESSION_TONE[s.status])}
                              title={`${fmtTime(s.starts_at)} · ${names.get(s.client_id) ?? "Client"} · ${s.type} (${SESSION_LABEL[s.status]})`}
                            >
                              <span className="tabular-nums opacity-70">{fmtTime(s.starts_at)}</span> <b>{shortName(names.get(s.client_id) ?? "Client")}</b>
                            </Link>
                          ))}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* ---------- Bloc « cours collectif » dans la vue jour ---------- */
function ClassBlockLink({ c, style }: { c: ClassBlock; style: React.CSSProperties }) {
  return (
    <Link
      href={`/cours/${c.id}`}
      className="absolute inset-x-1.5 z-10 overflow-hidden rounded-md border-s-[3px] border-indigo-500 bg-indigo-50 px-1.5 py-1 text-[11px] leading-tight text-indigo-800 shadow-sm transition hover:z-20 hover:brightness-95"
      style={style}
      title={`Cours collectif « ${c.title} » · ${fmtTime(c.starts_at)} · ${c.duration_min} min : le coach est occupé`}
    >
      <span className="flex items-baseline gap-1">
        <span className="tabular-nums opacity-70">{fmtTime(c.starts_at)}</span>
        <b className="truncate">{c.title}</b>
      </span>
      {c.duration_min >= 40 && (
        <span className="flex items-center gap-1 truncate text-[10px] font-semibold opacity-80">
          <Users className="size-3" /> Cours collectif
        </span>
      )}
    </Link>
  );
}
