/**
 * Vue CEO (espace admin) : tout le pilotage de l'activité de coaching en un seul chargement parallèle.
 *
 * Règle métier : cette application n'a AUCUNE notion d'argent (paiements, packs, factures… vivent dans le CRM général).
 * Le seul chiffre « monétaire » est la VALEUR INDICATIVE des séances réalisées (somme des prix indicatifs price_mad).
 *
 * Compatible base réelle et base de démo : requêtes simples (pas de jointure, pas de rpc), jointures faites en JS,
 * chaque table peut être vide ou absente (lecture défensive).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BookingRequest, ClassBooking, CoachAvailability, CoachTimeOff, Goal, GroupClass, Profile, RiskLevel, Session, SportAssessment, Task } from "./types";
import type { ReclamationStatus } from "./reclamations";
import { BOOKED_STATUSES, BUSY_STATUSES, UPCOMING_STATUSES, WEEKDAYS_SHORT, isForgotten, mondayOf, shiftDate, staffName, toMin, todayAgadir } from "./planning";
import { loadSessionTypes } from "./session-extras";
import { agadirOffsetMin, agadirToIso } from "./utils";

/* =====================================================================
   Période
   ===================================================================== */
export type PeriodKey = "mois" | "trimestre" | "annee" | "30j";
export const PERIODS: { key: PeriodKey; label: string; short: string }[] = [
  { key: "mois", label: "Ce mois-ci", short: "Mois" },
  { key: "trimestre", label: "Ce trimestre", short: "Trimestre" },
  { key: "annee", label: "Cette année", short: "Année" },
  { key: "30j", label: "30 derniers jours", short: "30 jours" },
];
export const parsePeriod = (v: string | undefined | null): PeriodKey => (PERIODS.some((p) => p.key === v) ? (v as PeriodKey) : "mois");

export interface Range {
  /** ISO inclus */
  start: string;
  /** ISO exclu */
  end: string;
  /** AAAA-MM-JJ (Agadir) du début */
  startDate: string;
  label: string;
}
export interface Period {
  key: PeriodKey;
  cur: Range;
  prev: Range;
  /** « vs octobre 2026 (même durée) » */
  compareLabel: string;
}

const DAY = 86400000;
const monthName = (date: string, opts: Intl.DateTimeFormatOptions = { month: "long", year: "numeric" }) =>
  new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", ...opts }).format(new Date(`${date}T12:00:00Z`));
/** Premier jour du mois (décalage en mois) d'une date AAAA-MM-JJ */
function monthStart(date: string, offset = 0) {
  const y = Number(date.slice(0, 4));
  const m = Number(date.slice(5, 7)) - 1;
  return new Date(Date.UTC(y, m + offset, 1)).toISOString().slice(0, 10);
}
const isoDay = (date: string) => agadirToIso(date, "00:00");
const ms = (iso: string | null | undefined) => (iso ? new Date(iso).getTime() : NaN);

export function buildPeriod(key: PeriodKey, nowMs = Date.now()): Period {
  const today = todayAgadir(nowMs);
  const nowIso = new Date(nowMs).toISOString();
  let curStartDate: string;
  let prevStartDate: string;
  let curLabel: string;
  let prevLabel: string;
  if (key === "30j") {
    const start = nowMs - 30 * DAY;
    const prevStart = nowMs - 60 * DAY;
    const s = new Date(start).toISOString();
    return {
      key,
      cur: { start: s, end: nowIso, startDate: todayAgadir(start), label: "30 derniers jours" },
      prev: { start: new Date(prevStart).toISOString(), end: s, startDate: todayAgadir(prevStart), label: "30 jours précédents" },
      compareLabel: "vs les 30 jours précédents",
    };
  }
  if (key === "mois") {
    curStartDate = monthStart(today);
    prevStartDate = monthStart(today, -1);
    curLabel = monthName(curStartDate);
    prevLabel = monthName(prevStartDate);
  } else if (key === "trimestre") {
    const m = Number(today.slice(5, 7)) - 1;
    const back = m % 3;
    curStartDate = monthStart(today, -back);
    prevStartDate = monthStart(today, -back - 3);
    const q = (d: string) => `T${Math.floor((Number(d.slice(5, 7)) - 1) / 3) + 1} ${d.slice(0, 4)}`;
    curLabel = q(curStartDate);
    prevLabel = q(prevStartDate);
  } else {
    curStartDate = `${today.slice(0, 4)}-01-01`;
    prevStartDate = `${Number(today.slice(0, 4)) - 1}-01-01`;
    curLabel = `Année ${today.slice(0, 4)}`;
    prevLabel = prevStartDate.slice(0, 4);
  }
  const curStart = isoDay(curStartDate);
  const prevStart = isoDay(prevStartDate);
  // Même durée écoulée sur la période précédente (comparaison équitable « à date »)
  const elapsed = nowMs - ms(curStart);
  const prevEnd = new Date(Math.min(ms(prevStart) + elapsed, ms(curStart))).toISOString();
  return {
    key,
    cur: { start: curStart, end: nowIso, startDate: curStartDate, label: curLabel },
    prev: { start: prevStart, end: prevEnd, startDate: prevStartDate, label: prevLabel },
    compareLabel: `vs ${prevLabel} à date`,
  };
}

/* =====================================================================
   Heure locale (Agadir) rapide : décalage mis en cache par heure UTC
   ===================================================================== */
const offsetCache = new Map<number, number>();
function offsetAt(t: number) {
  const bucket = Math.floor(t / 3600000);
  let o = offsetCache.get(bucket);
  if (o === undefined) {
    o = agadirOffsetMin(new Date(bucket * 3600000));
    offsetCache.set(bucket, o);
  }
  return o;
}
/** ISO → date locale, heure, jour de semaine (1 = lundi) */
function local(iso: string) {
  const t = ms(iso);
  const d = new Date(t + offsetAt(t) * 60000);
  const date = d.toISOString().slice(0, 10);
  return { date, hour: d.getUTCHours(), weekday: ((d.getUTCDay() + 6) % 7) + 1 };
}
/** Date locale + "HH:MM" → ms UTC */
function localToMs(date: string, min: number) {
  const naive = Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10))) + min * 60000;
  return naive - offsetAt(naive) * 60000;
}

/* =====================================================================
   Lecture défensive
   ===================================================================== */
type Res = { data: unknown; error: unknown };
type Paged = PromiseLike<Res> & { range?: (from: number, to: number) => PromiseLike<Res> };

async function rows<T>(q: PromiseLike<Res>): Promise<T[]> {
  try {
    const { data, error } = await q;
    if (error) return [];
    return (Array.isArray(data) ? data : []) as T[];
  } catch {
    return [];
  }
}
/** Lit toutes les lignes (pages de 1000 sur la vraie base ; une seule requête en démo). */
async function allRows<T>(make: () => Paged, maxPages = 25): Promise<T[]> {
  const PAGE = 1000;
  try {
    const first = make();
    if (typeof first.range !== "function") return rows<T>(first);
    const out: T[] = [];
    for (let p = 0; p < maxPages; p++) {
      const q = p === 0 ? first : make();
      const { data, error } = await q.range!(p * PAGE, p * PAGE + PAGE - 1);
      if (error) return out;
      const list = (Array.isArray(data) ? data : []) as T[];
      out.push(...list);
      if (list.length < PAGE) break;
    }
    return out;
  } catch {
    return [];
  }
}

/* =====================================================================
   Types exposés
   ===================================================================== */
/** created_at existe en base (non déclaré dans le type Session) */
type S = Pick<Session, "id" | "client_id" | "coach_id" | "starts_at" | "duration_min" | "type" | "status" | "price_mad" | "assigned_by" | "responded_at" | "started_at"> & { created_at: string };
type C = { id: string; full_name: string; coach_id: string | null; status: string; start_date: string | null; created_at: string; goal: string | null };
type Cls = Pick<GroupClass, "id" | "title" | "category" | "coach_id" | "starts_at" | "duration_min" | "capacity" | "cancelled">;
type Book = Pick<ClassBooking, "id" | "class_id" | "status">;
type Req = Pick<BookingRequest, "id" | "status" | "created_at" | "wanted_at">;
type Rec = { id: string; created_at: string; status: ReclamationStatus; category: string };
type Ass = Pick<SportAssessment, "id" | "client_id" | "created_by" | "done_on" | "status" | "risk_level" | "created_at">;
type G = Pick<Goal, "id" | "client_id" | "title" | "status" | "created_at">;
type T = Pick<Task, "id" | "title" | "due_date" | "done" | "assigned_to" | "priority">;
type M = { id: string; client_id: string; created_at: string };

export type KpiFormat = "int" | "pct" | "hours" | "dh" | "delay";
export interface CeoKpi {
  key: string;
  label: string;
  value: number | null;
  prev: number | null;
  format: KpiFormat;
  /** Sens souhaité : la flèche est verte si l'évolution va dans ce sens */
  better: "up" | "down";
  href: string;
  sub?: string;
  hint?: string;
  /** Afficher l'évolution en points (taux) plutôt qu'en % */
  points?: boolean;
  /** Pas de comparaison possible (photo à l'instant t) */
  snapshot?: boolean;
}

export interface CoachRow {
  id: string;
  name: string;
  role: string;
  done: number;
  prevDone: number;
  hours: number;
  occupancy: number | null;
  next7: number | null;
  absences: number;
  absenceRate: number | null;
  refusals: number;
  responseH: number | null;
  activeClients: number;
  assessments: number;
  value: number;
  best?: boolean;
  watch?: string;
}

export interface RiskClient {
  id: string;
  name: string;
  coach: string;
  reasons: { label: string; tone: "red" | "amber" | "gray" }[];
  daysSince: number | null;
  hasUpcoming: boolean;
  score: number;
}

export type AlertLevel = "critique" | "attention" | "info";
export interface CeoAlert {
  level: AlertLevel;
  text: string;
  detail?: string;
  href: string;
}

export interface CeoData {
  period: Period;
  generatedAt: string;
  kpis: CeoKpi[];
  activity: {
    months: { label: string; realisee: number; absent: number; annulee: number }[];
    weeks: { label: string; realisee: number; absent: number; annulee: number }[];
    types: { label: string; value: number }[];
    /** 12 mois : chiffre des ventes (prix des séances réalisées), séances, clients venus, nouveaux clients */
    sales: { label: string; ventes: number; seances: number; clients: number; nouveaux: number }[];
    /** Ventes de la période par type de séance (DH) */
    salesTypes: { label: string; value: number }[];
    heat: { grid: number[][]; hours: number[]; days: string[]; max: number; peak: string | null; total: number };
    classes: { count: number; booked: number; capacity: number; fill: number | null; prevFill: number | null; waitlist: number; byCategory: { label: string; fill: number; count: number; booked: number; capacity: number }[] };
  };
  clients: {
    funnel: { label: string; value: number; hint: string; href: string }[];
    atRisk: RiskClient[];
    atRiskTotal: number;
    noSession21: number;
    top: { id: string; name: string; coach: string; done: number; absent: number }[];
    goals: { reached: number; inProgress: number; abandoned: number; rate: number | null; recent: { id: string; clientId: string; client: string; title: string }[] };
  };
  coaches: CoachRow[];
  quality: {
    risk: Record<RiskLevel, number>;
    toValidate: number;
    assessmentsPeriod: number;
    complaintsOpen: number;
    complaintsOld: number;
    complaintsPeriod: number;
    bookingsPending: number;
    bookingsExpired: number;
    toClose: { id: string; client: string; coach: string; starts_at: string; status: string }[];
    toCloseTotal: number;
    tasksOverdue: number;
    tasksOverdueHigh: number;
    unread: number;
    unreadClients: number;
    unreadOldest: { clientId: string; client: string; created_at: string } | null;
    awaitingCoach: number;
  };
  alerts: CeoAlert[];
}

/* =====================================================================
   Chargement + calculs
   ===================================================================== */
const pct = (a: number, b: number) => (b > 0 ? (a / b) * 100 : null);
const round1 = (n: number) => Math.round(n * 10) / 10;
const inR = (iso: string | null | undefined, r: { start: string; end: string }) => !!iso && iso >= r.start && iso < r.end;
const sessionValue = (s: S, prices: Map<string, number>) => {
  const v = s.price_mad ?? prices.get(s.type) ?? 0;
  return Number.isFinite(Number(v)) ? Number(v) : 0;
};

export async function loadCeo(supabase: SupabaseClient, key: PeriodKey, nowMs = Date.now()): Promise<CeoData> {
  const period = buildPeriod(key, nowMs);
  const nowIso = new Date(nowMs).toISOString();
  const today = todayAgadir(nowMs);
  const histStartDate = monthStart(today, -11);
  // Historique : 12 mois glissants, période précédente et fenêtre de rétention (30 j avant la fin de la période précédente)
  const histStart = [isoDay(histStartDate), new Date(ms(period.prev.start) - 31 * DAY).toISOString(), new Date(nowMs - 120 * DAY).toISOString()].sort()[0]!;
  const futureEnd = new Date(nowMs + 8 * DAY).toISOString();

  const [profiles, clients, sessions, avail, timeOff, classes, bookings, requests, complaints, assessments, goals, tasks, unreadMsgs, types] = await Promise.all([
    rows<Profile>(supabase.from("profiles").select("id, full_name, email, role, active, created_at").in("role", ["admin", "head_coach", "coach"])),
    allRows<C>(() => supabase.from("clients").select("id, full_name, coach_id, status, start_date, created_at, goal").order("created_at")),
    allRows<S>(() =>
      supabase
        .from("sessions")
        .select("id, client_id, coach_id, starts_at, duration_min, type, status, price_mad, assigned_by, responded_at, created_at, started_at")
        .gte("starts_at", histStart)
        .lt("starts_at", futureEnd)
        .order("starts_at"),
    ),
    rows<CoachAvailability>(supabase.from("coach_availability").select("*")),
    rows<CoachTimeOff>(supabase.from("coach_time_off").select("*").gte("ends_on", period.prev.startDate)),
    allRows<Cls>(() => supabase.from("group_classes").select("id, title, category, coach_id, starts_at, duration_min, capacity, cancelled").gte("starts_at", histStart).lt("starts_at", futureEnd).order("starts_at")),
    allRows<Book>(() => supabase.from("class_bookings").select("id, class_id, status").gte("created_at", new Date(ms(histStart) - 60 * DAY).toISOString()).order("created_at")),
    allRows<Req>(() => supabase.from("booking_requests").select("id, status, created_at, wanted_at").order("created_at")),
    allRows<Rec>(() => supabase.from("reclamations").select("id, created_at, status, category").order("created_at")),
    allRows<Ass>(() => supabase.from("sport_assessments").select("id, client_id, created_by, done_on, status, risk_level, created_at").order("done_on", { ascending: false })),
    allRows<G>(() => supabase.from("goals").select("id, client_id, title, status, created_at").order("created_at", { ascending: false })),
    allRows<T>(() => supabase.from("tasks").select("id, title, due_date, done, assigned_to, priority").eq("done", false).order("due_date")),
    allRows<M>(() => supabase.from("messages").select("id, client_id, created_at").eq("from_client", true).is("read_at", null).order("created_at")),
    loadSessionTypes(supabase, true).catch(() => []),
  ]);

  const prices = new Map(types.filter((t) => t.price_mad !== null && t.price_mad !== undefined).map((t) => [t.name, Number(t.price_mad)]));
  const clientById = new Map(clients.map((c) => [c.id, c]));
  const profileById = new Map(profiles.map((p) => [p.id, p]));
  const clientName = (id: string) => clientById.get(id)?.full_name ?? "Client";
  const coachName = (id: string | null | undefined) => (id ? staffName(profileById.get(id)) : "—");
  const { cur, prev } = period;

  const inCur = sessions.filter((s) => inR(s.starts_at, cur));
  const inPrev = sessions.filter((s) => inR(s.starts_at, prev));
  const by = (list: S[], st: Session["status"]) => list.filter((s) => s.status === st);

  /* ---------- Disponibilités (minutes par coach sur un intervalle, congés déduits) ---------- */
  const availBy = new Map<string, CoachAvailability[]>();
  for (const a of avail) availBy.set(a.coach_id, [...(availBy.get(a.coach_id) ?? []), a]);
  const offBy = new Map<string, CoachTimeOff[]>();
  for (const o of timeOff) offBy.set(o.coach_id, [...(offBy.get(o.coach_id) ?? []), o]);
  function availableMin(coachId: string, startIso: string, endIso: string) {
    const av = availBy.get(coachId);
    if (!av?.length) return 0;
    const off = offBy.get(coachId) ?? [];
    const a = ms(startIso);
    const b = ms(endIso);
    let total = 0;
    let date = local(startIso).date;
    const last = local(endIso).date;
    for (let guard = 0; date <= last && guard < 800; guard++, date = shiftDate(date, 1)) {
      if (off.some((o) => o.starts_on <= date && o.ends_on >= date)) continue;
      const wd = ((new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7) + 1;
      for (const slot of av) {
        if (slot.weekday !== wd) continue;
        const s = Math.max(a, localToMs(date, toMin(slot.start_time)));
        const e = Math.min(b, localToMs(date, toMin(slot.end_time)));
        if (e > s) total += (e - s) / 60000;
      }
    }
    return total;
  }
  const liveClasses = classes.filter((c) => !c.cancelled);
  function bookedMin(coachId: string | null, r: { start: string; end: string }, statuses: Session["status"][]) {
    const ss = sessions.filter((s) => (coachId === null || s.coach_id === coachId) && inR(s.starts_at, r) && statuses.includes(s.status));
    const cl = liveClasses.filter((c) => (coachId === null || c.coach_id === coachId) && inR(c.starts_at, r));
    return ss.reduce((n, s) => n + (s.duration_min || 60), 0) + cl.reduce((n, c) => n + (c.duration_min || 60), 0);
  }

  /* ---------- Coachs concernés ---------- */
  const activeStaff = profiles.filter((p) => p.active !== false);
  const coachIds = new Set<string>(activeStaff.filter((p) => p.role === "coach" || p.role === "head_coach").map((p) => p.id));
  // Un admin qui coache (séances, créneaux ou clients) apparaît aussi
  for (const p of activeStaff) {
    if (p.role !== "admin") continue;
    if (inCur.some((s) => s.coach_id === p.id) || availBy.has(p.id) || clients.some((c) => c.coach_id === p.id && c.status === "actif")) coachIds.add(p.id);
  }
  const coachList = activeStaff.filter((p) => coachIds.has(p.id));

  const next7 = { start: nowIso, end: new Date(nowMs + 7 * DAY).toISOString() };
  function occupancy(r: { start: string; end: string }) {
    let booked = 0;
    let available = 0;
    for (const p of coachList) {
      const av = availableMin(p.id, r.start, r.end);
      if (!av) continue;
      available += av;
      booked += bookedMin(p.id, r, BOOKED_STATUSES);
    }
    return pct(booked, available);
  }

  /* ---------- Délai de réponse des coachs ---------- */
  function responseHours(list: S[]) {
    const v = list
      .filter((s) => s.responded_at && s.assigned_by && s.assigned_by !== s.coach_id)
      .map((s) => (ms(s.responded_at) - ms(s.created_at)) / 3600000)
      .filter((h) => Number.isFinite(h) && h >= 0 && h < 24 * 60);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  }
  const createdCur = sessions.filter((s) => inR(s.created_at, cur));
  const createdPrev = sessions.filter((s) => inR(s.created_at, prev));

  /* ---------- Rétention à 3 mois ---------- */
  const startIso = (c: C) => (c.start_date ? isoDay(c.start_date.slice(0, 10)) : c.created_at);
  function retention(endIso: string) {
    const end = ms(endIso);
    const cohort = clients.filter((c) => {
      const s = ms(startIso(c));
      return Number.isFinite(s) && s <= end - 90 * DAY && s > end - 365 * DAY;
    });
    const win = { start: new Date(end - 30 * DAY).toISOString(), end: endIso };
    const seen = new Set(sessions.filter((s) => s.status === "realisee" && inR(s.starts_at, win)).map((s) => s.client_id));
    const kept = cohort.filter((c) => seen.has(c.id)).length;
    return { rate: pct(kept, cohort.length), kept, cohort: cohort.length };
  }

  /* ---------- KPI ---------- */
  const doneCur = by(inCur, "realisee");
  const donePrev = by(inPrev, "realisee");
  const absCur = by(inCur, "absent").length;
  const absPrev = by(inPrev, "absent").length;
  const cancelCur = inCur.filter((s) => s.status === "annulee" || s.status === "refusee").length;
  const cancelPrev = inPrev.filter((s) => s.status === "annulee" || s.status === "refusee").length;
  const hours = (l: S[]) => round1(l.reduce((n, s) => n + (s.duration_min || 60), 0) / 60);
  const value = (l: S[]) => Math.round(l.reduce((n, s) => n + sessionValue(s, prices), 0));
  const activeClients = clients.filter((c) => c.status === "actif");
  const paused = clients.filter((c) => c.status === "pause").length;
  const lost = clients.filter((c) => c.status === "termine").length;
  const seenCur = new Set(doneCur.map((s) => s.client_id)).size;
  const seenPrev = new Set(donePrev.map((s) => s.client_id)).size;
  const newCur = clients.filter((c) => inR(startIso(c), cur)).length;
  const newPrev = clients.filter((c) => inR(startIso(c), prev)).length;
  const retCur = retention(cur.end);
  const retPrev = retention(prev.end);
  const occCur = occupancy(cur);
  const occPrev = occupancy(prev);
  const respCur = responseHours(createdCur);
  const respPrev = responseHours(createdPrev);

  const kpis: CeoKpi[] = [
    {
      key: "actifs",
      label: "Clients actifs",
      value: activeClients.length,
      prev: null,
      format: "int",
      better: "up",
      href: "/clients?statut=actif",
      snapshot: true,
      sub: `${seenCur} venus sur la période (${seenPrev} avant) · ${paused} en pause`,
    },
    { key: "nouveaux", label: "Nouveaux clients", value: newCur, prev: newPrev, format: "int", better: "up", href: "/clients", sub: "Date de début du suivi" },
    { key: "venus", label: "Clients venus", value: seenCur, prev: seenPrev, format: "int", better: "up", href: "/clients?statut=actif", sub: "Au moins une séance réalisée sur la période" },
    {
      key: "retention",
      label: "Rétention à 3 mois",
      value: retCur.rate,
      prev: retPrev.rate,
      format: "pct",
      better: "up",
      points: true,
      href: "/analytique",
      sub: `${retCur.kept}/${retCur.cohort} encore suivis · ${lost} perdu${lost > 1 ? "s" : ""}`,
      hint: "Clients inscrits depuis 3 à 12 mois ayant fait au moins une séance sur les 30 derniers jours de la période. « Perdus » = statut terminé.",
    },
    { key: "seances", label: "Séances réalisées", value: doneCur.length, prev: donePrev.length, format: "int", better: "up", href: "/seances?statut=realisee", sub: `${by(inCur, "absent").length} absence${absCur > 1 ? "s" : ""} · ${cancelCur} annulée${cancelCur > 1 ? "s" : ""}/refusée${cancelCur > 1 ? "s" : ""}` },
    { key: "heures", label: "Heures de coaching", value: hours(doneCur), prev: hours(donePrev), format: "hours", better: "up", href: "/seances?statut=realisee", sub: "Durée prévue des séances réalisées" },
    {
      key: "remplissage",
      label: "Remplissage des coachs",
      value: occCur,
      prev: occPrev,
      format: "pct",
      better: "up",
      points: true,
      href: "/planning",
      sub: "Heures réservées / heures disponibles",
      hint: "Séances comptées (à venir, en cours, réalisées, absences) + cours collectifs, rapportées aux créneaux déclarés dans Disponibilités, congés déduits.",
    },
    { key: "absence", label: "Taux d'absence", value: pct(absCur, absCur + doneCur.length), prev: pct(absPrev, absPrev + donePrev.length), format: "pct", better: "down", points: true, href: "/seances?statut=absent", sub: `${absCur} absence${absCur > 1 ? "s" : ""} / ${absCur + doneCur.length} séances passées` },
    { key: "annulation", label: "Annulations / refus", value: pct(cancelCur, inCur.length), prev: pct(cancelPrev, inPrev.length), format: "pct", better: "down", points: true, href: "/seances?statut=annulee", sub: `${cancelCur} sur ${inCur.length} séances prévues` },
    {
      key: "reponse",
      label: "Délai de réponse coachs",
      value: respCur,
      prev: respPrev,
      format: "delay",
      better: "down",
      href: "/planning",
      sub: "Affectation → acceptation / refus",
      hint: "Moyenne (réponse du coach − création) des séances affectées par un manager à un autre coach.",
    },
    {
      key: "valeur",
      label: "Chiffre des ventes",
      value: value(doneCur),
      prev: value(donePrev),
      format: "dh",
      better: "up",
      href: "/seances?statut=realisee",
      sub: "Somme des prix des séances réalisées",
      hint: "Prix de chaque séance réalisée (sinon prix par défaut de son type). Pas de caisse : aucun encaissement n'est suivi ici.",
    },
  ];

  /* ---------- Activité : 12 mois / 52 semaines ---------- */
  const months = Array.from({ length: 12 }, (_, i) => monthStart(today, i - 11));
  const monthIdx = new Map(months.map((m, i) => [m.slice(0, 7), i]));
  const monthRows = months.map((m) => ({ label: monthName(m, { month: "short", year: "2-digit" }).replace(".", ""), realisee: 0, absent: 0, annulee: 0 }));
  const firstMonday = shiftDate(mondayOf(today), -51 * 7);
  const weeks = Array.from({ length: 52 }, (_, i) => shiftDate(firstMonday, i * 7));
  const weekIdx = new Map(weeks.map((w, i) => [w, i]));
  const weekRows = weeks.map((w) => ({ label: monthName(w, { day: "numeric", month: "short" }), realisee: 0, absent: 0, annulee: 0 }));
  const HOURS = Array.from({ length: 16 }, (_, i) => i + 6);
  const grid = Array.from({ length: 7 }, () => HOURS.map(() => 0));
  for (const s of sessions) {
    if (s.starts_at >= nowIso && s.status !== "annulee" && s.status !== "refusee") continue;
    const k = s.status === "realisee" ? "realisee" : s.status === "absent" ? "absent" : s.status === "annulee" || s.status === "refusee" ? "annulee" : null;
    const l = local(s.starts_at);
    if (k) {
      const mi = monthIdx.get(l.date.slice(0, 7));
      if (mi !== undefined) monthRows[mi]![k]++;
      const wi = weekIdx.get(shiftDate(l.date, 1 - l.weekday));
      if (wi !== undefined) weekRows[wi]![k]++;
    }
    if ((s.status === "realisee" || s.status === "absent") && inR(s.starts_at, cur)) {
      const hi = HOURS.indexOf(l.hour);
      if (hi >= 0) grid[l.weekday - 1]![hi]!++;
    }
  }
  const heatMax = Math.max(0, ...grid.flat());
  let peak: string | null = null;
  if (heatMax > 0) {
    grid.forEach((row, d) => row.forEach((v, h) => v === heatMax && !peak && (peak = `${WEEKDAYS_SHORT[d]} ${HOURS[h]}h–${HOURS[h]! + 1}h`)));
  }

  const typeCount = new Map<string, number>();
  for (const s of doneCur) typeCount.set(s.type || "Séance", (typeCount.get(s.type || "Séance") ?? 0) + 1);
  const sortedTypes = [...typeCount.entries()].sort((a, b) => b[1] - a[1]);
  const typesMix = sortedTypes.slice(0, 6).map(([label, v]) => ({ label, value: v }));
  const otherTypes = sortedTypes.slice(6).reduce((n, [, v]) => n + v, 0);
  if (otherTypes) typesMix.push({ label: "Autres", value: otherTypes });

  /* ---------- Ventes et clients : 12 mois ---------- */
  const salesRows = monthRows.map((m) => ({ label: m.label, ventes: 0, seances: 0, clients: 0, nouveaux: 0 }));
  const seenByMonth = months.map(() => new Set<string>());
  for (const s of sessions) {
    if (s.status !== "realisee") continue;
    const mi = monthIdx.get(local(s.starts_at).date.slice(0, 7));
    if (mi === undefined) continue;
    salesRows[mi]!.ventes += sessionValue(s, prices);
    salesRows[mi]!.seances++;
    seenByMonth[mi]!.add(s.client_id);
  }
  seenByMonth.forEach((set, i) => (salesRows[i]!.clients = set.size));
  for (const c of clients) {
    const st = startIso(c);
    if (!st) continue;
    const mi = monthIdx.get(local(st).date.slice(0, 7));
    if (mi !== undefined) salesRows[mi]!.nouveaux++;
  }
  for (const r of salesRows) r.ventes = Math.round(r.ventes);
  const salesByType = new Map<string, number>();
  for (const s of doneCur) salesByType.set(s.type || "Séance", (salesByType.get(s.type || "Séance") ?? 0) + sessionValue(s, prices));
  const salesTypes = [...salesByType.entries()]
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([label, v]) => ({ label, value: Math.round(v) }));

  /* ---------- Cours collectifs ---------- */
  const bookByClass = new Map<string, { booked: number; wait: number }>();
  for (const b of bookings) {
    const x = bookByClass.get(b.class_id) ?? { booked: 0, wait: 0 };
    if (b.status === "inscrit" || b.status === "present" || b.status === "absent") x.booked++;
    if (b.status === "attente") x.wait++;
    bookByClass.set(b.class_id, x);
  }
  function classStats(r: { start: string; end: string }) {
    const list = liveClasses.filter((c) => inR(c.starts_at, r) && (c.capacity ?? 0) > 0);
    let booked = 0;
    let capacity = 0;
    let wait = 0;
    const cat = new Map<string, { count: number; booked: number; capacity: number }>();
    for (const c of list) {
      const b = bookByClass.get(c.id) ?? { booked: 0, wait: 0 };
      const bk = Math.min(b.booked, c.capacity);
      booked += bk;
      capacity += c.capacity;
      wait += b.wait;
      const key = c.category || "Autre";
      const x = cat.get(key) ?? { count: 0, booked: 0, capacity: 0 };
      x.count++;
      x.booked += bk;
      x.capacity += c.capacity;
      cat.set(key, x);
    }
    return { list, booked, capacity, wait, cat };
  }
  const clsCur = classStats({ start: cur.start, end: nowIso });
  const clsPrev = classStats(prev);

  /* ---------- Clients : entonnoir ---------- */
  const reqCur = requests.filter((r) => inR(r.created_at, cur));
  const funnel = [
    { label: "Demandes de réservation", value: reqCur.length, hint: `reçues sur la période · ${reqCur.filter((r) => r.status === "confirmee").length} confirmées`, href: "/reservations" },
    { label: "Nouveaux clients", value: newCur, hint: "ont commencé leur suivi sur la période", href: "/clients" },
    { label: "Clients actifs", value: activeClients.length, hint: "aujourd'hui", href: "/clients?statut=actif" },
    { label: "En pause", value: paused, hint: "aujourd'hui", href: "/clients?statut=pause" },
    { label: "Terminés", value: lost, hint: "suivi arrêté (clients perdus)", href: "/clients?statut=termine" },
  ];

  /* ---------- Clients à risque ---------- */
  const lastSeen = new Map<string, string>();
  const upcoming = new Set<string>();
  const abs60 = new Map<string, number>();
  const since60 = new Date(nowMs - 60 * DAY).toISOString();
  for (const s of sessions) {
    if (s.starts_at < nowIso && (s.status === "realisee" || s.status === "en_cours")) {
      if ((lastSeen.get(s.client_id) ?? "") < s.starts_at) lastSeen.set(s.client_id, s.starts_at);
    }
    if (s.starts_at >= nowIso && UPCOMING_STATUSES.includes(s.status)) upcoming.add(s.client_id);
    if (s.status === "absent" && s.starts_at >= since60 && s.starts_at < nowIso) abs60.set(s.client_id, (abs60.get(s.client_id) ?? 0) + 1);
  }
  const latestRisk = new Map<string, Ass>();
  for (const a of assessments) {
    const cur0 = latestRisk.get(a.client_id);
    if (!cur0 || a.done_on > cur0.done_on) latestRisk.set(a.client_id, a);
  }
  const atRiskAll: RiskClient[] = [];
  let noSession21 = 0;
  for (const c of activeClients) {
    const reasons: RiskClient["reasons"] = [];
    let score = 0;
    const last = lastSeen.get(c.id);
    const startedLongAgo = ms(startIso(c)) <= nowMs - 21 * DAY;
    const days = last ? Math.floor((nowMs - ms(last)) / DAY) : null;
    if ((days === null && startedLongAgo) || (days !== null && days >= 21)) {
      noSession21++;
      reasons.push({ label: days === null ? "Aucune séance depuis 12 mois" : `Sans séance depuis ${days} j`, tone: days === null || days >= 45 ? "red" : "amber" });
      score += days === null || days >= 45 ? 3 : 2;
      if (upcoming.has(c.id)) score -= 1;
    }
    const risk = latestRisk.get(c.id);
    if (risk?.risk_level === "rouge") {
      reasons.push({ label: "Bilan sportif rouge", tone: "red" });
      score += 3;
    }
    const a = abs60.get(c.id) ?? 0;
    if (a >= 3) {
      reasons.push({ label: `${a} absences en 60 j`, tone: "amber" });
      score += 2;
    }
    if (reasons.length) atRiskAll.push({ id: c.id, name: c.full_name, coach: coachName(c.coach_id), reasons, daysSince: days, hasUpcoming: upcoming.has(c.id), score });
  }
  atRiskAll.sort((a, b) => b.score - a.score || (b.daysSince ?? 999) - (a.daysSince ?? 999));

  /* ---------- Clients les plus assidus ---------- */
  const perClient = new Map<string, { done: number; absent: number }>();
  for (const s of inCur) {
    if (s.status !== "realisee" && s.status !== "absent") continue;
    const x = perClient.get(s.client_id) ?? { done: 0, absent: 0 };
    if (s.status === "realisee") x.done++;
    else x.absent++;
    perClient.set(s.client_id, x);
  }
  const top = [...perClient.entries()]
    .filter(([, v]) => v.done > 0)
    .sort((a, b) => b[1].done - a[1].done || a[1].absent - b[1].absent)
    .slice(0, 10)
    .map(([id, v]) => ({ id, name: clientName(id), coach: coachName(clientById.get(id)?.coach_id), ...v }));

  /* ---------- Objectifs ---------- */
  const reached = goals.filter((g) => g.status === "atteint");
  const inProgress = goals.filter((g) => g.status === "en_cours").length;
  const abandoned = goals.filter((g) => g.status === "abandonne").length;

  /* ---------- Coachs ---------- */
  const coaches: CoachRow[] = coachList.map((p) => {
    const mine = inCur.filter((s) => s.coach_id === p.id);
    const done = mine.filter((s) => s.status === "realisee");
    const absences = mine.filter((s) => s.status === "absent").length;
    const av = availableMin(p.id, cur.start, cur.end);
    const av7 = availableMin(p.id, next7.start, next7.end);
    return {
      id: p.id,
      name: staffName(p),
      role: p.role,
      done: done.length,
      prevDone: inPrev.filter((s) => s.coach_id === p.id && s.status === "realisee").length,
      hours: hours(done),
      occupancy: av ? pct(bookedMin(p.id, cur, BOOKED_STATUSES), av) : null,
      next7: av7 ? pct(bookedMin(p.id, next7, BUSY_STATUSES), av7) : null,
      absences,
      absenceRate: pct(absences, absences + done.length),
      refusals: mine.filter((s) => s.status === "refusee").length,
      responseH: responseHours(createdCur.filter((s) => s.coach_id === p.id)),
      activeClients: activeClients.filter((c) => c.coach_id === p.id).length,
      assessments: assessments.filter((a) => a.created_by === p.id && inR(isoDay(a.done_on.slice(0, 10)), cur)).length,
      value: value(done),
    };
  });
  if (coaches.length >= 2) {
    const best = [...coaches].sort((a, b) => b.done - a.done || b.hours - a.hours)[0];
    if (best && best.done > 0) best.best = true;
    const others = coaches.filter((c) => !c.best);
    const highAbs = [...others].filter((c) => (c.absenceRate ?? 0) >= 20 && c.absences >= 2).sort((a, b) => (b.absenceRate ?? 0) - (a.absenceRate ?? 0))[0];
    const lowOcc = [...others].filter((c) => c.occupancy !== null && c.occupancy < 35).sort((a, b) => (a.occupancy ?? 0) - (b.occupancy ?? 0))[0];
    if (highAbs) highAbs.watch = `Absences élevées (${Math.round(highAbs.absenceRate ?? 0)} %)`;
    else if (lowOcc) lowOcc.watch = `Remplissage faible (${Math.round(lowOcc.occupancy ?? 0)} %)`;
  }
  coaches.sort((a, b) => b.done - a.done || b.hours - a.hours);

  /* ---------- Qualité & opérations ---------- */
  const risk: Record<RiskLevel, number> = { vert: 0, orange: 0, rouge: 0 };
  for (const a of latestRisk.values()) if (a.risk_level in risk) risk[a.risk_level]++;
  const openRec = complaints.filter((r) => r.status !== "resolue");
  const oldRec = openRec.filter((r) => ms(r.created_at) < nowMs - 7 * DAY);
  const pendingReq = requests.filter((r) => r.status === "nouvelle");
  const expiredReq = pendingReq.filter((r) => ms(r.wanted_at) < nowMs);
  const forgotten = sessions
    .filter((s) => s.starts_at >= since60 && s.starts_at < nowIso && BUSY_STATUSES.includes(s.status))
    .filter((s) => isForgotten({ status: s.status, starts_at: s.starts_at, duration_min: s.duration_min, started_at: s.started_at ?? null }, nowMs))
    .sort((a, b) => b.starts_at.localeCompare(a.starts_at));
  const overdue = tasks.filter((t) => !t.done && t.due_date && t.due_date < today);
  const unreadClients = new Set(unreadMsgs.map((m) => m.client_id));
  const oldestMsg = unreadMsgs[0];
  const awaitingCoach = sessions.filter((s) => s.status === "planifiee" && s.starts_at >= nowIso).length;

  const quality: CeoData["quality"] = {
    risk,
    toValidate: assessments.filter((a) => a.status === "a_valider").length,
    assessmentsPeriod: assessments.filter((a) => inR(isoDay(a.done_on.slice(0, 10)), cur)).length,
    complaintsOpen: openRec.length,
    complaintsOld: oldRec.length,
    complaintsPeriod: complaints.filter((r) => inR(r.created_at, cur)).length,
    bookingsPending: pendingReq.length - expiredReq.length,
    bookingsExpired: expiredReq.length,
    toClose: forgotten.slice(0, 5).map((s) => ({ id: s.id, client: clientName(s.client_id), coach: coachName(s.coach_id), starts_at: s.starts_at, status: s.status })),
    toCloseTotal: forgotten.length,
    tasksOverdue: overdue.length,
    tasksOverdueHigh: overdue.filter((t) => t.priority === "haute").length,
    unread: unreadMsgs.length,
    unreadClients: unreadClients.size,
    unreadOldest: oldestMsg ? { clientId: oldestMsg.client_id, client: clientName(oldestMsg.client_id), created_at: oldestMsg.created_at } : null,
    awaitingCoach,
  };

  /* ---------- Alertes CEO ---------- */
  const alerts: CeoAlert[] = [];
  const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n > 1 ? many : one}`;
  for (const c of coaches) {
    if (c.next7 !== null && c.next7 >= 90) alerts.push({ level: "attention", text: `${c.name} rempli à ${Math.round(c.next7)} % sur les 7 prochains jours`, detail: "Risque de surcharge : répartir de nouveaux clients sur un autre coach.", href: `/coachs/${c.id}` });
  }
  if (noSession21) alerts.push({ level: noSession21 >= 3 ? "critique" : "attention", text: `${plural(noSession21, "client actif")} sans séance depuis 21 jours`, detail: "À relancer avant qu'ils ne décrochent.", href: "#clients-a-risque" });
  if (risk.rouge) alerts.push({ level: "attention", text: `${plural(risk.rouge, "client")} en risque rouge (bilan sportif)`, detail: "Vérifier les précautions et le certificat médical.", href: "/evaluations" });
  if (quality.complaintsOld) alerts.push({ level: "critique", text: `${plural(quality.complaintsOld, "réclamation ouverte", "réclamations ouvertes")} depuis plus de 7 jours`, href: "/reclamations?statut=nouvelle" });
  else if (quality.complaintsOpen) alerts.push({ level: "info", text: `${plural(quality.complaintsOpen, "réclamation ouverte", "réclamations ouvertes")}`, href: "/reclamations" });
  const doneKpi = kpis.find((k) => k.key === "seances")!;
  if (doneKpi.prev && doneKpi.value !== null) {
    const d = ((doneKpi.value - doneKpi.prev) / doneKpi.prev) * 100;
    if (d <= -10) alerts.push({ level: d <= -25 ? "critique" : "attention", text: `Séances réalisées ${Math.round(d)} % ${period.compareLabel}`, detail: `${doneKpi.value} contre ${doneKpi.prev}.`, href: "/analytique" });
  }
  const absKpi = kpis.find((k) => k.key === "absence")!;
  if (absKpi.value !== null && absKpi.value >= 15) alerts.push({ level: "attention", text: `Taux d'absence à ${Math.round(absKpi.value)} %`, detail: absKpi.prev !== null ? `${Math.round(absKpi.prev)} % sur la période précédente.` : undefined, href: "/seances?statut=absent" });
  if (forgotten.length) alerts.push({ level: forgotten.length >= 5 ? "attention" : "info", text: `${plural(forgotten.length, "séance")} à clôturer`, detail: "Séances passées jamais démarrées ou jamais terminées.", href: "/seances" });
  if (quality.bookingsPending) alerts.push({ level: "attention", text: `${plural(quality.bookingsPending, "demande")} de réservation à traiter`, href: "/reservations?statut=nouvelle" });
  if (awaitingCoach) alerts.push({ level: "info", text: `${plural(awaitingCoach, "séance")} en attente de réponse d'un coach`, href: "/planning" });
  if (respCur !== null && respCur > 24) alerts.push({ level: "attention", text: `Délai moyen de réponse des coachs : ${Math.round(respCur)} h`, href: "/planning" });
  if (quality.tasksOverdue) alerts.push({ level: quality.tasksOverdueHigh ? "attention" : "info", text: `${plural(quality.tasksOverdue, "tâche")} en retard`, detail: quality.tasksOverdueHigh ? `dont ${quality.tasksOverdueHigh} haute priorité` : undefined, href: "/taches?vue=all" });
  if (quality.unread) alerts.push({ level: "info", text: `${plural(quality.unread, "message client non lu", "messages clients non lus")}`, detail: `${plural(quality.unreadClients, "conversation")}`, href: quality.unreadOldest ? `/messages?client=${quality.unreadOldest.clientId}` : "/messages" });
  if (quality.toValidate) alerts.push({ level: "info", text: `${plural(quality.toValidate, "bilan sportif")} à valider`, href: "/evaluations" });
  const idle = coaches.filter((c) => c.next7 !== null && c.next7 < 25);
  if (idle.length === 1) alerts.push({ level: "info", text: `${idle[0]!.name} rempli à ${Math.round(idle[0]!.next7 ?? 0)} % sur les 7 prochains jours`, detail: "Capacité disponible pour de nouveaux clients.", href: `/coachs/${idle[0]!.id}` });
  else if (idle.length > 1)
    alerts.push({
      level: "info",
      text: `${idle.length} coachs remplis à moins de 25 % sur les 7 prochains jours`,
      detail: idle.map((c) => `${c.name.split(" ")[0]} ${Math.round(c.next7 ?? 0)} %`).join(" · "),
      href: "/planning",
    });
  const rank: Record<AlertLevel, number> = { critique: 0, attention: 1, info: 2 };
  alerts.sort((a, b) => rank[a.level] - rank[b.level]);

  return {
    period,
    generatedAt: nowIso,
    kpis,
    activity: {
      months: monthRows,
      weeks: weekRows,
      types: typesMix,
      sales: salesRows,
      salesTypes,
      heat: { grid, hours: HOURS, days: WEEKDAYS_SHORT, max: heatMax, peak, total: grid.flat().reduce((a, b) => a + b, 0) },
      classes: {
        count: clsCur.list.length,
        booked: clsCur.booked,
        capacity: clsCur.capacity,
        fill: pct(clsCur.booked, clsCur.capacity),
        prevFill: pct(clsPrev.booked, clsPrev.capacity),
        waitlist: clsCur.wait,
        byCategory: [...clsCur.cat.entries()]
          .map(([label, x]) => ({ label, count: x.count, booked: x.booked, capacity: x.capacity, fill: pct(x.booked, x.capacity) ?? 0 }))
          .sort((a, b) => b.fill - a.fill),
      },
    },
    clients: {
      funnel,
      atRisk: atRiskAll.slice(0, 12),
      atRiskTotal: atRiskAll.length,
      noSession21,
      top,
      goals: {
        reached: reached.length,
        inProgress,
        abandoned,
        rate: pct(reached.length, reached.length + inProgress + abandoned),
        recent: reached.slice(0, 5).map((g) => ({ id: g.id, clientId: g.client_id, client: clientName(g.client_id), title: g.title })),
      },
    },
    coaches,
    quality,
    alerts,
  };
}
