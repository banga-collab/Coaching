/**
 * Planning de l'équipe : disponibilités des coachs, congés, cours collectifs et créneaux libres.
 * Toutes les heures sont celles d'Agadir (Africa/Casablanca).
 * Fonctionne avec la vraie base Supabase et avec la base de démo (requêtes simples, jointures en JS).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CoachAvailability, CoachTimeOff, Profile, Session, SessionStatus, Settings } from "./types";
import { SESSION_LABEL, agadirToIso, fmtDate, fmtTime, isoToAgadir } from "./utils";
import { buildDays, type BookingDay } from "@/components/platform/slots";

/* =====================================================================
   Statuts : une seule définition pour tous les compteurs
   ===================================================================== */
/** Statuts qui occupent le créneau du coach (en attente, acceptée, report proposé, en cours) */
export const BUSY_STATUSES: SessionStatus[] = ["planifiee", "acceptee", "reportee", "en_cours"];
/** Séances « à venir » réservées (pas encore commencées). Une séance refusée n'en fait PAS partie. */
export const UPCOMING_STATUSES: SessionStatus[] = ["planifiee", "acceptee", "reportee"];
/** Séances qui comptent dans la charge du coach : à venir, en cours, réalisées, absences (jamais refusée / annulée) */
export const BOOKED_STATUSES: SessionStatus[] = [...BUSY_STATUSES, "realisee", "absent"];
/** Alias (tableau de bord, analytique, rapports) : séances comptées = BUSY_STATUSES + réalisées + absences */
export const COUNTED_STATUSES = BOOKED_STATUSES;
/** Statuts finaux (séance close) */
export const CLOSED_STATUSES: SessionStatus[] = ["realisee", "absent", "annulee"];
export const isBusy = (s: Pick<Session, "status">) => BUSY_STATUSES.includes(s.status);
export const isUpcoming = (s: Pick<Session, "status">) => UPCOMING_STATUSES.includes(s.status);
export const isBooked = (s: Pick<Session, "status">) => BOOKED_STATUSES.includes(s.status);

export const WEEKDAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
export const WEEKDAYS_SHORT = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

export type StaffMember = Pick<Profile, "id" | "full_name" | "email" | "role">;

/* ---------- Petits outils horaires ---------- */
/** "HH:MM" → minutes depuis minuit */
export function toMin(hhmm: string) {
  const [h, m] = hhmm.slice(0, 5).split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}
/** minutes depuis minuit → "HH:MM" */
export function fromMin(min: number) {
  const m = Math.max(0, Math.round(min));
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}
/** Jour de la semaine (1 = lundi … 7 = dimanche) d'une date AAAA-MM-JJ */
export function weekdayOf(date: string) {
  const d = new Date(`${date}T12:00:00Z`).getUTCDay();
  return ((d + 6) % 7) + 1;
}
/** Position d'une date ISO à Agadir : date, minutes depuis minuit, jour de semaine */
export function localSlot(iso: string) {
  const { date, time } = isoToAgadir(iso);
  return { date, time, min: toMin(time), weekday: weekdayOf(date) };
}
/** Ajoute n jours à une date AAAA-MM-JJ */
export function shiftDate(date: string, n: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
/** Lundi de la semaine d'une date AAAA-MM-JJ */
export function mondayOf(date: string) {
  return shiftDate(date, 1 - weekdayOf(date));
}
/** Aujourd'hui à Agadir (AAAA-MM-JJ), indépendant du fuseau du serveur */
export const todayAgadir = (now = Date.now()) => isoToAgadir(new Date(now).toISOString()).date;
export const firstName = (full: string | null | undefined) => (full ?? "").trim().split(/\s+/)[0] || "Coach";
export const staffName = (p: Pick<Profile, "full_name" | "email"> | undefined | null) => (p ? p.full_name || p.email : "—");

/* =====================================================================
   Règles horaires d'une séance (démarrer, absent, terminer, oubli)
   ===================================================================== */
/** On peut démarrer / marquer absent à partir de 30 min avant l'heure prévue */
export const EARLY_START_MIN = 30;
/** Une séance terminée très tard est plafonnée à début + durée + 60 min */
export const LATE_END_MIN = 60;

const msOf = (iso: string | null | undefined) => (iso ? new Date(iso).getTime() : NaN);
/** Fin prévue (ms) */
export const plannedEnd = (s: Pick<Session, "starts_at" | "duration_min">) => msOf(s.starts_at) + (s.duration_min || 60) * 60000;

/** L'heure permet-elle d'agir sur la séance (démarrer, absent) ? À partir de 30 min avant, jamais pour un jour futur. */
export function timeReached(s: Pick<Session, "starts_at">, now = Date.now()) {
  return isoToAgadir(s.starts_at).date <= todayAgadir(now) && now >= msOf(s.starts_at) - EARLY_START_MIN * 60000;
}
/** « Séance démarrée » : seulement une séance acceptée, de 30 min avant jusqu'à 1 h après la fin prévue (ensuite : « À clôturer ») */
export function canStart(s: Pick<Session, "status" | "starts_at" | "duration_min">, now = Date.now()) {
  return s.status === "acceptee" && timeReached(s, now) && now <= plannedEnd(s) + LATE_END_MIN * 60000;
}
/** « Absent » : séance encore ouverte et heure atteinte */
export function canMarkAbsent(s: Pick<Session, "status" | "starts_at">, now = Date.now()) {
  return BUSY_STATUSES.includes(s.status) && timeReached(s, now);
}
/** « Séance terminée » : seulement depuis « en cours » */
export const canFinish = (s: Pick<Session, "status">) => s.status === "en_cours";

/** Heure de fin enregistrée : maintenant, plafonnée à (début réel ou prévu, le plus tard des deux) + durée + 60 min */
export function cappedEndIso(s: Pick<Session, "starts_at" | "duration_min" | "started_at">, now = Date.now()) {
  const started = msOf(s.started_at);
  const begin = Number.isFinite(started) ? Math.max(started, msOf(s.starts_at)) : msOf(s.starts_at);
  const cap = begin + ((s.duration_min || 60) + LATE_END_MIN) * 60000;
  const floor = Number.isFinite(started) ? started : msOf(s.starts_at);
  return new Date(Math.max(floor, Math.min(now, cap))).toISOString();
}

/**
 * Séance oubliée (« À clôturer ») : encore ouverte alors que son heure est passée.
 * - en attente / acceptée / report proposé : la fin prévue est passée ;
 * - en cours : jamais terminée, 1 h après la fin prévue.
 */
export function isForgotten(s: Pick<Session, "status" | "starts_at" | "duration_min" | "started_at">, now = Date.now()) {
  if (s.status === "en_cours") {
    const started = msOf(s.started_at);
    const end = Math.max(plannedEnd(s), Number.isFinite(started) ? started + (s.duration_min || 60) * 60000 : 0);
    return now > end + LATE_END_MIN * 60000;
  }
  return UPCOMING_STATUSES.includes(s.status) && now > plannedEnd(s);
}

/**
 * Statuts proposés dans le formulaire de séance (suites logiques uniquement).
 * "a_venir" = (re)programmer : en attente du coach, ou acceptée si c'est sa propre séance.
 * - « Acceptée » : seulement le coach de la séance (le manager affecte, le coach accepte) ;
 * - « Terminée » : seulement si l'heure de début est passée ;
 * - « Absent » : à partir de 30 min avant ;
 * - « Refusée » / « Report proposé » / « En cours » : uniquement via les boutons dédiés (réponse du coach, démarrer).
 */
export function allowedStatuses(prev: SessionStatus | null, o: { isCoach: boolean; started: boolean; reached: boolean }): (SessionStatus | "a_venir")[] {
  const out: (SessionStatus | "a_venir")[] = [];
  const add = (...l: (SessionStatus | "a_venir")[]) => l.forEach((x) => !out.includes(x) && out.push(x));
  if (!prev) {
    add("a_venir");
    if (o.started) add("realisee");
    if (o.reached) add("absent");
    add("annulee");
    return out;
  }
  add(prev);
  if (prev === "planifiee" && o.isCoach) add("acceptee");
  if (prev === "refusee" || prev === "annulee") add("a_venir");
  if (prev !== "refusee" && prev !== "reportee") {
    if (o.started) add("realisee");
    if (o.reached) add("absent");
  }
  add("annulee");
  return out;
}

/* =====================================================================
   Données
   ===================================================================== */
/** Occurrence de cours collectif (table group_classes) : occupe le créneau de son coach */
export interface ClassBlock {
  id: string;
  title: string;
  coach_id: string | null;
  starts_at: string;
  duration_min: number;
}

export interface PlanningData {
  availability: CoachAvailability[];
  timeOff: CoachTimeOff[];
  /** Séances qui occupent un créneau (statuts BUSY_STATUSES), y compris celles dont l'horaire proposé tombe dans la période */
  sessions: Session[];
  /** Cours collectifs non annulés */
  classes: ClassBlock[];
  /** Coachs désactivés (profiles.active = false) */
  inactive: string[];
}

/** Coachs (admin, head coach, coach) actifs : à utiliser pour toutes les listes de choix de coach */
export async function loadStaff(supabase: SupabaseClient): Promise<StaffMember[]> {
  const { data } = await supabase.from("profiles").select("id, full_name, email, role, active").in("role", ["admin", "head_coach", "coach"]).order("full_name");
  return ((data ?? []) as (StaffMember & { active?: boolean | null })[]).filter((p) => p.active !== false).map(({ id, full_name, email, role }) => ({ id, full_name, email, role }));
}

/** Disponibilités, congés, séances occupées et cours collectifs entre deux dates ISO (bornes élargies d'un jour). */
export async function loadPlanningData(supabase: SupabaseClient, fromIso: string, toIso: string, coachIds?: string[]): Promise<PlanningData> {
  const from = new Date(new Date(fromIso).getTime() - 86400000).toISOString();
  const to = new Date(new Date(toIso).getTime() + 86400000).toISOString();
  let av = supabase.from("coach_availability").select("*");
  let off = supabase.from("coach_time_off").select("*").gte("ends_on", from.slice(0, 10)).lte("starts_on", to.slice(0, 10));
  let ss = supabase.from("sessions").select("*").gte("starts_at", from).lt("starts_at", to).in("status", BUSY_STATUSES);
  // Horaire proposé (report en attente) : le créneau est « réservé » pour le coach jusqu'à la décision
  let held = supabase.from("sessions").select("*").eq("status", "reportee").gte("proposed_at", from).lt("proposed_at", to);
  let cl = supabase.from("group_classes").select("id, title, coach_id, starts_at, duration_min, cancelled").gte("starts_at", from).lt("starts_at", to).eq("cancelled", false);
  if (coachIds?.length) {
    av = av.in("coach_id", coachIds);
    off = off.in("coach_id", coachIds);
    ss = ss.in("coach_id", coachIds);
    held = held.in("coach_id", coachIds);
    cl = cl.in("coach_id", coachIds);
  }
  const [{ data: a }, { data: o }, { data: s }, { data: h }, classesRes, { data: ina }] = await Promise.all([
    av.order("start_time"),
    off.order("starts_on"),
    ss.order("starts_at"),
    held,
    cl.order("starts_at"),
    supabase.from("profiles").select("id, active").in("role", ["admin", "head_coach", "coach"]).eq("active", false),
  ]);
  const sessions = (s ?? []) as Session[];
  for (const x of (h ?? []) as Session[]) if (!sessions.some((y) => y.id === x.id)) sessions.push(x);
  const classes = classesRes.error ? [] : ((classesRes.data ?? []) as (ClassBlock & { cancelled?: boolean })[]).filter((c) => !c.cancelled && !!c.coach_id);
  return {
    availability: (a ?? []) as CoachAvailability[],
    timeOff: (o ?? []) as CoachTimeOff[],
    sessions,
    classes: classes.map(({ id, title, coach_id, starts_at, duration_min }) => ({ id, title, coach_id, starts_at, duration_min: duration_min || 60 })),
    inactive: ((ina ?? []) as { id: string }[]).map((p) => p.id),
  };
}

/* =====================================================================
   Vérification d'un créneau
   ===================================================================== */
export type SlotReason = "hors_dispo" | "conge" | "conflit" | "cours" | "invalide" | "inactif" | "passe";
export type SlotCheck = { ok: true } | { ok: false; reason: SlotReason; message: string; conflict?: Session; classBlock?: ClassBlock };

export interface SlotQuery {
  coachId: string;
  startIso: string;
  durationMin: number;
  /** Séance à ignorer (celle qu'on modifie) */
  excludeId?: string | null;
  /** Cours collectif à ignorer (celui qu'on modifie) */
  excludeClassId?: string | null;
}

/** Ce qui occupe le coach entre start et end (ms) : séance, horaire proposé réservé ou cours collectif */
export type BusyHit = { kind: "seance"; session: Session } | { kind: "propose"; session: Session } | { kind: "cours"; cls: ClassBlock };

export function busyHit(data: PlanningData, coachId: string, start: number, end: number, excludeId?: string | null, excludeClassId?: string | null): BusyHit | null {
  const cls = data.classes.find((c) => {
    if (c.coach_id !== coachId || c.id === excludeClassId) return false;
    const a = msOf(c.starts_at);
    return a < end && start < a + c.duration_min * 60000;
  });
  if (cls) return { kind: "cours", cls };
  for (const s of data.sessions) {
    if (s.coach_id !== coachId || s.id === excludeId || !isBusy(s)) continue;
    const a = msOf(s.starts_at);
    if (a < end && start < a + s.duration_min * 60000) return { kind: "seance", session: s };
    if (s.status === "reportee" && s.proposed_at) {
      const p = msOf(s.proposed_at);
      if (p < end && start < p + s.duration_min * 60000) return { kind: "propose", session: s };
    }
  }
  return null;
}

/** Libellé court de ce qui occupe un créneau (infobulle du sélecteur d'heure) */
export function busyLabel(hit: BusyHit) {
  if (hit.kind === "cours") return `Cours collectif ${hit.cls.title} de ${fmtTime(hit.cls.starts_at)}`;
  if (hit.kind === "propose") return `Horaire proposé (report en attente) de ${fmtTime(hit.session.proposed_at!)}`;
  return `Séance de ${fmtTime(hit.session.starts_at)}`;
}

/**
 * Un créneau est libre pour un coach s'il est actif, hors congé, dans une de ses disponibilités,
 * sans cours collectif et sans chevauchement avec ses séances en attente / acceptées / reportées / en cours
 * (l'horaire proposé d'un report en attente compte aussi comme pris).
 */
export function checkSlot(
  data: PlanningData,
  q: SlotQuery,
  names: { coach?: string; client?: (clientId: string) => string | undefined } = {},
): SlotCheck {
  const who = names.coach ?? "Le coach";
  const of = names.coach ? `de ${names.coach}` : "du coach";
  const start = msOf(q.startIso);
  if (!Number.isFinite(start) || !(q.durationMin > 0)) return { ok: false, reason: "invalide", message: "Date, heure ou durée invalide." };
  if (data.inactive.includes(q.coachId)) return { ok: false, reason: "inactif", message: "Ce coach est désactivé." };
  const end = start + q.durationMin * 60000;
  const loc = localSlot(q.startIso);
  const endMin = loc.min + q.durationMin;

  // 1. Congé
  const off = data.timeOff.find((t) => t.coach_id === q.coachId && t.starts_on <= loc.date && t.ends_on >= loc.date);
  if (off) {
    const range = off.starts_on === off.ends_on ? `le ${fmtDate(`${off.starts_on}T12:00:00Z`, { day: "numeric", month: "long" })}` : `du ${fmtDate(`${off.starts_on}T12:00:00Z`, { day: "numeric", month: "short" })} au ${fmtDate(`${off.ends_on}T12:00:00Z`, { day: "numeric", month: "short" })}`;
    return { ok: false, reason: "conge", message: `${who} est en congé ${range}${off.reason ? ` (${off.reason})` : ""}.` };
  }

  // 2. Disponibilités
  const mine = data.availability.filter((a) => a.coach_id === q.coachId);
  if (!mine.length) return { ok: false, reason: "hors_dispo", message: `${who} n'a déclaré aucune disponibilité (page « Mes créneaux »).` };
  const today = mine.filter((a) => a.weekday === loc.weekday).sort((x, y) => toMin(x.start_time) - toMin(y.start_time));
  const inside = endMin <= 24 * 60 && today.some((a) => toMin(a.start_time) <= loc.min && toMin(a.end_time) >= endMin);
  if (!inside) {
    const day = WEEKDAYS[loc.weekday - 1]!.toLowerCase();
    const slots = today.map((a) => `${a.start_time.slice(0, 5)}–${a.end_time.slice(0, 5)}`).join(", ");
    return {
      ok: false,
      reason: "hors_dispo",
      message: `Hors disponibilités : ${loc.time}–${fromMin(endMin)} n'est pas dans les créneaux ${of} le ${day}${slots ? ` (${slots})` : " (aucun créneau ce jour-là)"}.`,
    };
  }

  // 3. Cours collectif, séance ou horaire proposé qui chevauche
  const hit = busyHit(data, q.coachId, start, end, q.excludeId, q.excludeClassId);
  if (hit?.kind === "cours") {
    const c = hit.cls;
    return { ok: false, reason: "cours", classBlock: c, message: `Cours collectif « ${c.title} » de ${fmtTime(c.starts_at)} (${c.duration_min} min) : le créneau ${of} est déjà pris.` };
  }
  if (hit) {
    const conflict = hit.session;
    const client = names.client?.(conflict.client_id);
    if (hit.kind === "propose") {
      return {
        ok: false,
        reason: "conflit",
        conflict,
        message: `Créneau réservé : ${fmtTime(conflict.proposed_at!)} est l'horaire proposé pour la séance${client ? ` de ${client}` : ""} (report en attente de validation) : le créneau ${of} est déjà pris.`,
      };
    }
    return {
      ok: false,
      reason: "conflit",
      conflict,
      message: `Conflit avec la séance de ${fmtTime(conflict.starts_at)}${client ? ` de ${client}` : ""} (${conflict.duration_min} min, ${SESSION_LABEL[conflict.status].toLowerCase()}) : le créneau ${of} est déjà pris.`,
    };
  }
  return { ok: true };
}

/** Coachs libres pour une date/heure et une durée */
export function freeCoachesIn(data: PlanningData, staff: StaffMember[], startIso: string, durationMin: number, excludeId?: string | null) {
  return staff.filter((p) => checkSlot(data, { coachId: p.id, startIso, durationMin, excludeId }).ok);
}

/** Heures de début libres ("HH:MM") d'un coach pour un jour donné */
export function freeSlotsOfDay(data: PlanningData, coachId: string, date: string, durationMin = 60, stepMin = 30, excludeId?: string | null) {
  const wd = weekdayOf(date);
  const out: string[] = [];
  for (const a of data.availability.filter((x) => x.coach_id === coachId && x.weekday === wd).sort((x, y) => toMin(x.start_time) - toMin(y.start_time))) {
    for (let m = toMin(a.start_time); m + durationMin <= toMin(a.end_time); m += stepMin) {
      const t = fromMin(m);
      if (!out.includes(t) && checkSlot(data, { coachId, startIso: agadirToIso(date, t), durationMin, excludeId }).ok) out.push(t);
    }
  }
  return out.sort();
}

/* ---------- Versions « tout-en-un » pour les Server Actions ---------- */
async function clientNames(supabase: SupabaseClient, ids: string[]) {
  if (!ids.length) return new Map<string, string>();
  const { data } = await supabase.from("clients").select("id, full_name").in("id", ids);
  return new Map(((data ?? []) as { id: string; full_name: string }[]).map((c) => [c.id, c.full_name]));
}

/**
 * Vérifie qu'un créneau est libre et prépare un message clair + les coachs libres à proposer.
 * Refuse aussi un créneau déjà passé (aucune séance « occupée » ne peut être créée ou déplacée dans le passé)
 * et un coach désactivé.
 */
export async function verifySlot(supabase: SupabaseClient, q: SlotQuery) {
  const end = new Date(msOf(q.startIso) + q.durationMin * 60000).toISOString();
  const [data, staff] = await Promise.all([loadPlanningData(supabase, q.startIso, end), loadStaff(supabase)]);
  const coach = staff.find((p) => p.id === q.coachId);
  const names = await clientNames(supabase, [...new Set(data.sessions.map((s) => s.client_id))]);
  let check: SlotCheck = checkSlot(data, q, { coach: coach ? firstName(staffName(coach)) : undefined, client: (id) => names.get(id) });
  if (check.ok && msOf(q.startIso) < Date.now()) check = { ok: false, reason: "passe", message: `Cet horaire (${fmtDate(q.startIso, { weekday: "short", day: "numeric", month: "short" })} à ${fmtTime(q.startIso)}) est déjà passé.` };
  if (check.ok && !coach) check = { ok: false, reason: data.inactive.includes(q.coachId) ? "inactif" : "invalide", message: data.inactive.includes(q.coachId) ? "Ce coach est désactivé." : "Coach introuvable." };
  const free = check.ok || check.reason === "passe" || check.reason === "invalide" ? [] : freeCoachesIn(data, staff, q.startIso, q.durationMin, q.excludeId).filter((p) => p.id !== q.coachId);
  return { check, free: free.map((p) => ({ id: p.id, name: staffName(p) })), coach };
}

/** Coachs libres (avec leur nom) à une date/heure donnée */
export async function listFreeCoaches(supabase: SupabaseClient, startIso: string, durationMin: number, excludeId?: string | null) {
  const end = new Date(msOf(startIso) + durationMin * 60000).toISOString();
  const [data, staff] = await Promise.all([loadPlanningData(supabase, startIso, end), loadStaff(supabase)]);
  return freeCoachesIn(data, staff, startIso, durationMin, excludeId);
}

/** Créneaux libres d'un coach pour un jour (AAAA-MM-JJ) */
export async function listFreeSlots(supabase: SupabaseClient, coachId: string, date: string, durationMin = 60, excludeId?: string | null) {
  const data = await loadPlanningData(supabase, agadirToIso(date, "00:00"), agadirToIso(shiftDate(date, 1), "00:00"), [coachId]);
  return freeSlotsOfDay(data, coachId, date, durationMin, 30, excludeId);
}

/* =====================================================================
   Réservation en ligne (page publique /reserver)
   ===================================================================== */
/**
 * Jours et horaires proposés au public : horaires d'ouverture (paramètres) où AU MOINS un coach est libre
 * (disponibilités, congés, séances, cours collectifs), moins les demandes en ligne encore en attente.
 * Le client Supabase doit pouvoir lire le planning : passer le client « service » côté serveur
 * (un visiteur anonyme ne lit ni les séances ni les disponibilités sous RLS).
 * Si le planning est illisible (aucun coach lu), on retombe sur les horaires d'ouverture seuls.
 */
export async function publicBookingDays(supabase: SupabaseClient, hours: Settings["booking_hours"], now = new Date()): Promise<BookingDay[]> {
  const base = buildDays(hours, [], now);
  if (!base.some((d) => d.slots.length)) return base;
  const step = Math.max(15, Number(hours.slot) || 60);
  const fromIso = now.toISOString();
  const toIso = new Date(now.getTime() + 16 * 86400000).toISOString();
  const [data, staff, reqRes] = await Promise.all([
    loadPlanningData(supabase, fromIso, toIso),
    loadStaff(supabase),
    supabase.from("booking_requests").select("wanted_at, status").eq("status", "nouvelle").gte("wanted_at", new Date(now.getTime() - step * 60000).toISOString()),
  ]);
  if (!staff.length) return base;
  const pending = ((reqRes.data ?? []) as { wanted_at: string }[]).map((r) => msOf(r.wanted_at)).filter(Number.isFinite);
  return base.map((d) => ({
    ...d,
    slots: d.slots.filter((sl) => {
      const s = msOf(sl.iso);
      const e = s + step * 60000;
      const taken = pending.filter((p) => p < e && s < p + step * 60000).length;
      return freeCoachesIn(data, staff, sl.iso, step).length > taken;
    }),
  }));
}

/* =====================================================================
   Libellés côté adhérent
   ===================================================================== */
/** La séance doit-elle être montrée à l'adhérent ? (une séance refusée attend une réaffectation interne : cachée) */
export const visibleToMember = (s: Pick<Session, "status">) => s.status !== "refusee";

/** Statut d'une séance dit simplement à l'adhérent */
export function memberSessionLabel(s: Pick<Session, "status" | "proposed_at" | "starts_at" | "duration_min">, now = Date.now()) {
  const past = now > plannedEnd(s);
  switch (s.status) {
    case "planifiee":
    case "reportee": // le nouvel horaire n'est annoncé qu'une fois validé par le head coach
      return past ? "Non effectuée" : "En attente de confirmation";
    case "acceptee":
      return past ? "Non effectuée" : "Confirmée";
    case "refusee":
      return past ? "Non effectuée" : "En cours de réorganisation";
    case "en_cours":
      return "En cours";
    case "realisee":
      return "Réalisée";
    default:
      return SESSION_LABEL[s.status];
  }
}

/** Durée réelle (minutes) d'une séance démarrée / terminée */
export function realDuration(s: Pick<Session, "started_at" | "ended_at">, now = Date.now()) {
  if (!s.started_at) return null;
  const end = s.ended_at ? new Date(s.ended_at).getTime() : now;
  return Math.max(0, Math.round((end - new Date(s.started_at).getTime()) / 60000));
}
export function fmtMinutes(min: number) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h`;
}
