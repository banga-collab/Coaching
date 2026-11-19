/** Annuaire des coachs : profil, charge, disponibilités et état « maintenant » (rubrique Coachs). */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CoachAvailability, CoachTimeOff, Profile, Session } from "./types";
import { BOOKED_STATUSES, BUSY_STATUSES, UPCOMING_STATUSES, WEEKDAYS_SHORT, localSlot, mondayOf, shiftDate, toMin, type ClassBlock } from "./planning";
import { agadirToIso, isoToAgadir } from "./utils";

export type CoachNow =
  | { kind: "en_seance"; label: string; until: string }
  | { kind: "en_cours_collectif"; label: string; until: string }
  | { kind: "libre"; label: string; until: string }
  | { kind: "conge"; label: string }
  | { kind: "hors"; label: string; next: string | null };

export interface CoachCard {
  profile: Profile;
  clients: number;
  week: { total: number; done: number; upcoming: number; minutes: number; classes: number };
  today: Session[];
  /** Cours collectifs du jour (occupent le coach) */
  todayClasses: ClassBlock[];
  availability: { weekday: number; label: string; slots: string[] }[];
  weeklyHours: number;
  timeOff: CoachTimeOff[];
  now: CoachNow;
}

export const ROLE_LABEL: Record<string, string> = { admin: "Admin", head_coach: "Head coach", coach: "Coach", client: "Adhérent" };

export async function loadCoachDirectory(supabase: SupabaseClient, onlyId?: string) {
  const today = isoToAgadir(new Date().toISOString()).date;
  const monday = mondayOf(today);
  const weekStart = agadirToIso(monday, "00:00");
  const weekEnd = agadirToIso(shiftDate(monday, 7), "00:00");
  let pq = supabase.from("profiles").select("*").in("role", ["admin", "head_coach", "coach"]).order("full_name");
  if (onlyId) pq = pq.eq("id", onlyId);
  const [{ data: pData }, { data: cData }, { data: sData }, avRes, offRes, clRes] = await Promise.all([
    pq,
    supabase.from("clients").select("id, coach_id, status"),
    supabase.from("sessions").select("*").gte("starts_at", weekStart).lt("starts_at", weekEnd),
    supabase.from("coach_availability").select("*"),
    supabase.from("coach_time_off").select("*").gte("ends_on", today),
    supabase.from("group_classes").select("id, title, coach_id, starts_at, duration_min, cancelled").gte("starts_at", weekStart).lt("starts_at", weekEnd).eq("cancelled", false),
  ]);
  const classes = clRes.error ? [] : ((clRes.data ?? []) as (ClassBlock & { cancelled?: boolean })[]).filter((c) => !c.cancelled);
  const profiles = ((pData ?? []) as Profile[]).filter((p) => p.active !== false);
  const clients = (cData ?? []) as { id: string; coach_id: string; status: string }[];
  const sessions = (sData ?? []) as Session[];
  const availability = ((avRes.data ?? []) as CoachAvailability[]) ?? [];
  const timeOff = ((offRes.data ?? []) as CoachTimeOff[]) ?? [];
  const nowIso = new Date().toISOString();
  const nowSlot = localSlot(nowIso);

  const cards: CoachCard[] = profiles.map((p) => {
    // Une seule définition : séances comptées (jamais refusées ni annulées)
    const mine = sessions.filter((s) => s.coach_id === p.id && BOOKED_STATUSES.includes(s.status));
    const myClasses = classes.filter((c) => c.coach_id === p.id);
    const todayClasses = myClasses.filter((c) => isoToAgadir(c.starts_at).date === today).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    const av = availability.filter((a) => a.coach_id === p.id);
    const byDay = [1, 2, 3, 4, 5, 6, 7].map((wd) => ({
      weekday: wd,
      label: WEEKDAYS_SHORT[wd - 1]!,
      slots: av
        .filter((a) => a.weekday === wd)
        .sort((a, b) => toMin(a.start_time) - toMin(b.start_time))
        .map((a) => `${a.start_time.slice(0, 5)}–${a.end_time.slice(0, 5)}`),
    }));
    const weeklyMin = av.reduce((n, a) => n + Math.max(0, toMin(a.end_time) - toMin(a.start_time)), 0);
    const off = timeOff.filter((o) => o.coach_id === p.id).sort((a, b) => a.starts_on.localeCompare(b.starts_on));
    const todayList = mine.filter((s) => isoToAgadir(s.starts_at).date === today).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    return {
      profile: p,
      clients: clients.filter((c) => c.coach_id === p.id && c.status !== "termine").length,
      week: {
        total: mine.length,
        done: mine.filter((s) => s.status === "realisee").length,
        upcoming: mine.filter((s) => UPCOMING_STATUSES.includes(s.status) && s.starts_at >= nowIso).length,
        minutes: mine.filter((s) => s.status !== "absent").reduce((n, s) => n + (s.duration_min ?? 60), 0) + myClasses.reduce((n, c) => n + (c.duration_min || 60), 0),
        classes: myClasses.length,
      },
      today: todayList,
      todayClasses,
      availability: byDay,
      weeklyHours: Math.round((weeklyMin / 60) * 10) / 10,
      timeOff: off,
      now: nowState(p.id, av, off, todayList, todayClasses, nowIso, nowSlot, today),
    };
  });
  return { cards, today, monday };
}

function nowState(
  coachId: string,
  av: CoachAvailability[],
  off: CoachTimeOff[],
  todayList: Session[],
  todayClasses: ClassBlock[],
  nowIso: string,
  nowSlot: ReturnType<typeof localSlot>,
  today: string,
): CoachNow {
  void coachId;
  const o = off.find((x) => x.starts_on <= today && x.ends_on >= today);
  if (o) return { kind: "conge", label: o.reason ? `En congé (${o.reason})` : "En congé" };
  const running = todayList.find((s) => {
    const end = new Date(new Date(s.starts_at).getTime() + (s.duration_min ?? 60) * 60000).toISOString();
    return BUSY_STATUSES.includes(s.status) && s.starts_at <= nowIso && end > nowIso;
  });
  if (running) {
    const end = localSlot(new Date(new Date(running.starts_at).getTime() + (running.duration_min ?? 60) * 60000).toISOString()).time;
    return { kind: "en_seance", label: "En séance", until: end };
  }
  const endOf = (c: ClassBlock) => new Date(new Date(c.starts_at).getTime() + (c.duration_min || 60) * 60000).toISOString();
  const cls = todayClasses.find((c) => c.starts_at <= nowIso && endOf(c) > nowIso);
  if (cls) return { kind: "en_cours_collectif", label: `Cours collectif ${cls.title}`, until: localSlot(endOf(cls)).time };
  const slot = av.find((a) => a.weekday === nowSlot.weekday && toMin(a.start_time) <= nowSlot.min && toMin(a.end_time) > nowSlot.min);
  if (slot) {
    const nextBusy = [...todayList.filter((s) => BUSY_STATUSES.includes(s.status)), ...todayClasses]
      .filter((x) => x.starts_at > nowIso && localSlot(x.starts_at).min < toMin(slot.end_time))
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0];
    return { kind: "libre", label: "Libre maintenant", until: nextBusy ? localSlot(nextBusy.starts_at).time : slot.end_time.slice(0, 5) };
  }
  // Prochain créneau (aujourd'hui plus tard, sinon les jours suivants)
  for (let d = 0; d < 7; d++) {
    const wd = ((nowSlot.weekday - 1 + d) % 7) + 1;
    const next = av
      .filter((a) => a.weekday === wd && (d > 0 || toMin(a.start_time) > nowSlot.min))
      .sort((a, b) => toMin(a.start_time) - toMin(b.start_time))[0];
    if (next) return { kind: "hors", label: "Hors créneaux", next: `${d === 0 ? "aujourd'hui" : d === 1 ? "demain" : WEEKDAYS_SHORT[wd - 1]} ${next.start_time.slice(0, 5)}` };
  }
  return { kind: "hors", label: "Aucun créneau déclaré", next: null };
}
