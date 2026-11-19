/**
 * Contrôle à distance des coachs (pensé pour Moov'Up Lady, où la direction n'entre pas).
 * Croise trois sources que la coach ne contrôle pas seule :
 *   - le pointage à la borne de l'accueil (code qui change toutes les 30 s) ;
 *   - la confirmation de chaque séance réalisée par la cliente ;
 *   - la note et le commentaire de la cliente.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Client, CoachPointage, Espace, Profile, Session, SessionFeedback } from "./types";
import { espaceOf } from "./espace";
import { BUSY_STATUSES, plannedEnd, staffName, todayAgadir } from "./planning";
import { agadirToIso, dayKey } from "./utils";

export type EspaceFilter = Espace | "tout";
export const LATE_MIN = 10; // tolérance avant de compter un retard
export const UNCONFIRMED_AFTER_H = 48;

type Tone = "green" | "amber" | "red" | "gray" | "brand";
export type TodaySession = { id: string; starts_at: string; type: string; status: Session["status"]; client: string };
export type TodayRow = { coach: Profile; sessions: TodaySession[]; arrival: string | null; departure: string | null; tone: Tone; label: string };
export type CoachStat = {
  coach: Profile;
  done: number;
  confirmed: number;
  contested: number;
  unconfirmed: number;
  noAccount: number;
  ratings: number;
  ratingAvg: number | null;
  daysWorked: number;
  daysOnTime: number;
  lateDays: number;
  noPointageDays: number;
};
export type ControlAlert = { level: "red" | "amber"; title: string; detail: string; at: string; coachId: string };
export type FeedbackRow = SessionFeedback & { coach: string; client: string; sessionAt: string | null; type: string | null };

export interface ControleData {
  espace: EspaceFilter;
  days: number;
  coaches: Profile[];
  today: TodayRow[];
  stats: CoachStat[];
  alerts: ControlAlert[];
  feedback: FeedbackRow[];
  totals: { done: number; confirmed: number; contested: number; unconfirmed: number; ratings: number; ratingAvg: number | null; daysWorked: number; daysOnTime: number; noPointage: number; noAccountClients: number; activeClients: number };
}

const minutes = (a: number, b: number) => Math.round((a - b) / 60000);
const ms = (iso: string) => new Date(iso).getTime();

export async function loadControle(supabase: SupabaseClient, espace: EspaceFilter, days: number, nowMs = Date.now()): Promise<ControleData> {
  const { data: pData } = await supabase.from("profiles").select("*").in("role", ["admin", "head_coach", "coach"]);
  const staff = ((pData ?? []) as Profile[]).filter((p) => p.active !== false);
  const today = todayAgadir(nowMs);
  const fromIso = agadirToIso(dayKey(new Date(nowMs - (days - 1) * 86400000)), "00:00");
  const endIso = new Date(ms(agadirToIso(today, "00:00")) + 86400000).toISOString();

  const inSpace = espace === "tout" ? staff : staff.filter((p) => espaceOf(p) === espace);
  const ids = inSpace.map((p) => p.id);
  const empty: ControleData = {
    espace,
    days,
    coaches: inSpace,
    today: [],
    stats: [],
    alerts: [],
    feedback: [],
    totals: { done: 0, confirmed: 0, contested: 0, unconfirmed: 0, ratings: 0, ratingAvg: null, daysWorked: 0, daysOnTime: 0, noPointage: 0, noAccountClients: 0, activeClients: 0 },
  };
  if (!ids.length) return empty;

  const [{ data: sData }, { data: ptData }, { data: fData }, { data: cData }] = await Promise.all([
    supabase.from("sessions").select("*").in("coach_id", ids).gte("starts_at", fromIso).lt("starts_at", endIso).order("starts_at"),
    supabase.from("coach_pointages").select("*").in("coach_id", ids).gte("at", fromIso).order("at"),
    supabase.from("session_feedback").select("*").in("coach_id", ids).gte("created_at", fromIso).order("created_at", { ascending: false }),
    supabase.from("clients").select("id, full_name, user_id, coach_id, status").in("coach_id", ids),
  ]);
  const sessions = ((sData ?? []) as Session[]).filter((s) => s.status !== "annulee" && s.status !== "refusee");
  const pointages = (ptData ?? []) as CoachPointage[];
  const feedback = (fData ?? []) as SessionFeedback[];
  const clients = (cData ?? []) as Pick<Client, "id" | "full_name" | "user_id" | "coach_id" | "status">[];
  const clientById = new Map(clients.map((c) => [c.id, c]));
  const fbBySession = new Map(feedback.map((f) => [f.session_id, f]));
  const sessionById = new Map(sessions.map((s) => [s.id, s]));
  const coachById = new Map(inSpace.map((p) => [p.id, p]));
  const nameOf = (id: string) => staffName(coachById.get(id));

  const alerts: ControlAlert[] = [];
  const stats: CoachStat[] = [];
  const todayRows: TodayRow[] = [];

  for (const coach of inSpace) {
    const mine = sessions.filter((s) => s.coach_id === coach.id);
    const myPts = pointages.filter((p) => p.coach_id === coach.id);
    const byDay = new Map<string, { s: Session[]; p: CoachPointage[] }>();
    for (const s of mine) {
      const k = dayKey(s.starts_at);
      if (!byDay.has(k)) byDay.set(k, { s: [], p: [] });
      byDay.get(k)!.s.push(s);
    }
    for (const p of myPts) {
      const k = dayKey(p.at);
      if (!byDay.has(k)) byDay.set(k, { s: [], p: [] });
      byDay.get(k)!.p.push(p);
    }

    const st: CoachStat = { coach, done: 0, confirmed: 0, contested: 0, unconfirmed: 0, noAccount: 0, ratings: 0, ratingAvg: null, daysWorked: 0, daysOnTime: 0, lateDays: 0, noPointageDays: 0 };
    let ratingSum = 0;

    for (const [k, d] of byDay) {
      const arrival = d.p.find((p) => p.kind === "arrivee")?.at ?? null;
      const departure = [...d.p].reverse().find((p) => p.kind === "depart")?.at ?? null;
      const started = d.s.filter((s) => ms(s.starts_at) <= nowMs);
      if (!started.length) continue;
      st.daysWorked++;
      const first = started[0]!;
      const done = started.filter((s) => s.status === "realisee");
      if (!arrival) {
        if (done.length) {
          st.noPointageDays++;
          alerts.push({
            level: "red",
            coachId: coach.id,
            at: first.starts_at,
            title: `${nameOf(coach.id)} : ${done.length} séance${done.length > 1 ? "s" : ""} « réalisée${done.length > 1 ? "s" : ""} » sans pointage`,
            detail: `Aucune arrivée pointée ce jour-là à la borne. À vérifier avec ${done.map((s) => clientById.get(s.client_id)?.full_name ?? "la cliente").join(", ")}.`,
          });
        }
        continue;
      }
      const late = minutes(ms(arrival), ms(first.starts_at));
      if (late > LATE_MIN) {
        st.lateDays++;
        alerts.push({ level: "amber", coachId: coach.id, at: arrival, title: `${nameOf(coach.id)} en retard de ${late} min`, detail: `Pointée à ${hhmm(arrival)} pour une 1re séance à ${hhmm(first.starts_at)}.` });
      } else st.daysOnTime++;
      const lastEnd = Math.max(...d.s.filter((s) => s.status !== "absent").map((s) => plannedEnd(s)), 0);
      if (departure && lastEnd && ms(departure) < lastEnd - LATE_MIN * 60000 && k !== today) {
        alerts.push({ level: "amber", coachId: coach.id, at: departure, title: `${nameOf(coach.id)} partie avant la fin`, detail: `Départ pointé à ${hhmm(departure)}, dernière séance prévue jusqu'à ${hhmm(new Date(lastEnd).toISOString())}.` });
      }
    }

    for (const s of mine.filter((x) => x.status === "realisee")) {
      st.done++;
      const f = fbBySession.get(s.id);
      const client = clientById.get(s.client_id);
      if (f) {
        if (f.happened) st.confirmed++;
        else st.contested++;
        if (f.rating) {
          st.ratings++;
          ratingSum += f.rating;
        }
      } else if (!client?.user_id) st.noAccount++;
      else if (nowMs - ms(s.starts_at) > UNCONFIRMED_AFTER_H * 3600000) st.unconfirmed++;
    }
    st.ratingAvg = st.ratings ? ratingSum / st.ratings : null;
    stats.push(st);

    // Aujourd'hui
    const todaySessions = mine.filter((s) => dayKey(s.starts_at) === today);
    const todayPts = myPts.filter((p) => dayKey(p.at) === today);
    const arrival = todayPts.find((p) => p.kind === "arrivee")?.at ?? null;
    const lastPt = todayPts.at(-1);
    const departure = lastPt?.kind === "depart" ? lastPt.at : null;
    const first = todaySessions[0];
    let tone: Tone = "gray";
    let label = "Pas de séance aujourd'hui";
    if (departure) {
      const left = todaySessions.filter((s) => BUSY_STATUSES.includes(s.status) && ms(s.starts_at) > ms(departure)).length;
      tone = left ? "red" : "gray";
      label = left ? `Partie à ${hhmm(departure)} · ${left} séance${left > 1 ? "s" : ""} restante${left > 1 ? "s" : ""}` : `Partie à ${hhmm(departure)}`;
    } else if (arrival) {
      const late = first ? minutes(ms(arrival), ms(first.starts_at)) : 0;
      tone = late > LATE_MIN ? "amber" : "green";
      label = late > LATE_MIN ? `Présente · arrivée avec ${late} min de retard` : `Présente depuis ${hhmm(arrival)}`;
    } else if (first) {
      const overdue = minutes(nowMs, ms(first.starts_at));
      if (overdue > LATE_MIN) {
        tone = "red";
        label = `Pas pointée · 1re séance à ${hhmm(first.starts_at)} (${overdue} min)`;
      } else {
        tone = "brand";
        label = `Attendue à ${hhmm(first.starts_at)}`;
      }
    }
    if (todaySessions.length || todayPts.length) {
      todayRows.push({
        coach,
        arrival,
        departure,
        tone,
        label,
        sessions: todaySessions.map((s) => ({ id: s.id, starts_at: s.starts_at, type: s.type, status: s.status, client: clientById.get(s.client_id)?.full_name ?? "Client" })),
      });
    }
  }

  // Avis des clientes
  const fbRows: FeedbackRow[] = feedback.map((f) => {
    const s = sessionById.get(f.session_id);
    return { ...f, coach: nameOf(f.coach_id), client: clientById.get(f.client_id)?.full_name ?? "Cliente", sessionAt: s?.starts_at ?? null, type: s?.type ?? null };
  });
  for (const f of fbRows) {
    if (!f.happened) {
      alerts.push({ level: "red", coachId: f.coach_id, at: f.sessionAt ?? f.created_at, title: `Séance contestée par ${f.client}`, detail: `${f.coach}${f.type ? ` · ${f.type}` : ""} : « n'a pas eu lieu »${f.comment ? ` — ${f.comment}` : ""}` });
    } else if (f.rating !== null && f.rating <= 2) {
      alerts.push({ level: "amber", coachId: f.coach_id, at: f.sessionAt ?? f.created_at, title: `Note ${f.rating}/5 de ${f.client}`, detail: `${f.coach}${f.type ? ` · ${f.type}` : ""}${f.comment ? ` — ${f.comment}` : ""}` });
    }
  }
  alerts.sort((a, b) => (a.level === b.level ? b.at.localeCompare(a.at) : a.level === "red" ? -1 : 1));

  const order: Record<Tone, number> = { red: 0, amber: 1, brand: 2, green: 3, gray: 4 };
  todayRows.sort((a, b) => order[a.tone] - order[b.tone] || (a.sessions[0]?.starts_at ?? "z").localeCompare(b.sessions[0]?.starts_at ?? "z"));
  stats.sort((a, b) => b.done - a.done);

  const sum = (f: (s: CoachStat) => number) => stats.reduce((n, s) => n + f(s), 0);
  const ratings = sum((s) => s.ratings);
  const ratingTotal = stats.reduce((n, s) => n + (s.ratingAvg ?? 0) * s.ratings, 0);
  const active = clients.filter((c) => c.status === "actif");
  return {
    espace,
    days,
    coaches: inSpace,
    today: todayRows,
    stats,
    alerts,
    feedback: fbRows,
    totals: {
      done: sum((s) => s.done),
      confirmed: sum((s) => s.confirmed),
      contested: sum((s) => s.contested),
      unconfirmed: sum((s) => s.unconfirmed),
      ratings,
      ratingAvg: ratings ? ratingTotal / ratings : null,
      daysWorked: sum((s) => s.daysWorked),
      daysOnTime: sum((s) => s.daysOnTime),
      noPointage: sum((s) => s.noPointageDays),
      noAccountClients: active.filter((c) => !c.user_id).length,
      activeClients: active.length,
    },
  };
}

function hhmm(iso: string) {
  return new Intl.DateTimeFormat("fr-FR", { timeZone: "Africa/Casablanca", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}
