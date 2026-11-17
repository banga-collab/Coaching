import type { SupabaseClient } from "@supabase/supabase-js";
import type { Challenge, ChallengeEntry, Client, GymCheckin, Measurement } from "./types";
import { dayKey } from "./utils";

/* ---------- Métriques ---------- */
export const METRICS: Record<Challenge["metric"], { label: string; unit: string; hint: string; auto: boolean }> = {
  presences: { label: "Présences à la salle", unit: "passages", hint: "Calculé automatiquement à partir des passages (QR / manuel).", auto: true },
  squat_kg: { label: "Squat (1RM)", unit: "kg", hint: "Meilleur squat mesuré par un coach pendant la période.", auto: true },
  pas: { label: "Nombre de pas", unit: "pas", hint: "Saisi par les adhérents dans leur espace (ou par le coach).", auto: false },
  custom: { label: "Personnalisé", unit: "pts", hint: "Score saisi manuellement par le coach.", auto: false },
};

export const COVERS = ["🔥", "🏋️", "👟", "💪", "🏆", "⚡", "🎯", "🥇", "🚴", "🧘", "🏃", "❤️"];

export type ChallengeStatus = "a_venir" | "en_cours" | "termine";

export function todayKey() {
  return dayKey(new Date());
}

export function challengeStatus(c: Pick<Challenge, "start_date" | "end_date">, today = todayKey()): ChallengeStatus {
  if (today < c.start_date) return "a_venir";
  if (today > c.end_date) return "termine";
  return "en_cours";
}

/** Nombre de jours entre deux clés AAAA-MM-JJ */
export function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86400000);
}

export function countdownLabel(c: Pick<Challenge, "start_date" | "end_date">, today = todayKey()) {
  const st = challengeStatus(c, today);
  if (st === "a_venir") {
    const d = daysBetween(today, c.start_date);
    return d <= 1 ? "Commence demain" : `Commence dans ${d} jours`;
  }
  if (st === "en_cours") {
    const d = daysBetween(today, c.end_date);
    return d === 0 ? "Dernier jour !" : d === 1 ? "Plus que 1 jour" : `Plus que ${d} jours`;
  }
  return "Terminé";
}

/** Prénom + initiale du nom ("Salma Bennani" → "Salma B.") */
export function privacyName(full: string | null | undefined) {
  const parts = (full ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "Membre";
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1]![0]!.toUpperCase()}.` : parts[0]!;
}

/* ---------- Classement ---------- */
export interface LeaderRow {
  client_id: string;
  name: string;
  value: number;
  rank: number;
  entryId: string | null;
  linked: boolean; // compte adhérent relié
}

/** Classement avec ex æquo (1, 2, 2, 4…) — tri décroissant. */
export function rankRows<T extends { value: number; name: string }>(rows: T[]): (T & { rank: number })[] {
  const sorted = [...rows].sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, "fr"));
  let prev: number | null = null;
  let rank = 0;
  return sorted.map((r, i) => {
    if (prev === null || r.value !== prev) rank = i + 1;
    prev = r.value;
    return { ...r, rank };
  });
}

export interface ScoreData {
  clients: Client[];
  checkins: Pick<GymCheckin, "client_id" | "checked_at">[];
  measurements: Pick<Measurement, "client_id" | "measured_on" | "squat_kg">[];
  entries: ChallengeEntry[];
}

/** Charge en une fois tout ce qu'il faut pour calculer les scores de plusieurs défis. */
export async function loadScoreData(supabase: SupabaseClient, challenges: Challenge[]): Promise<ScoreData> {
  if (!challenges.length) return { clients: [], checkins: [], measurements: [], entries: [] };
  const ids = challenges.map((c) => c.id);
  const minStart = challenges.reduce((m, c) => (c.start_date < m ? c.start_date : m), challenges[0]!.start_date);
  const needPresence = challenges.some((c) => c.metric === "presences");
  const needSquat = challenges.some((c) => c.metric === "squat_kg");
  const [{ data: cl }, { data: en }, ck, ms] = await Promise.all([
    supabase.from("clients").select("*"),
    supabase.from("challenge_entries").select("*").in("challenge_id", ids),
    needPresence
      ? supabase.from("gym_checkins").select("client_id, checked_at").gte("checked_at", new Date(Date.parse(`${minStart}T00:00:00Z`) - 86400000).toISOString())
      : Promise.resolve({ data: [] }),
    needSquat ? supabase.from("measurements").select("client_id, measured_on, squat_kg").not("squat_kg", "is", null).order("measured_on") : Promise.resolve({ data: [] }),
  ]);
  return {
    clients: (cl ?? []) as Client[],
    entries: (en ?? []) as ChallengeEntry[],
    checkins: (ck.data ?? []) as ScoreData["checkins"],
    measurements: (ms.data ?? []) as ScoreData["measurements"],
  };
}

/** Scores en direct d'un défi, fusionnés avec les saisies (challenge_entries). */
export function computeLeaderboard(ch: Challenge, data: ScoreData): LeaderRow[] {
  const byId = new Map(data.clients.map((c) => [c.id, c]));
  const entries = data.entries.filter((e) => e.challenge_id === ch.id);
  const values = new Map<string, number>();
  const entryIds = new Map<string, string>();
  for (const e of entries) {
    values.set(e.client_id, Number(e.value) || 0);
    entryIds.set(e.client_id, e.id);
  }

  if (ch.metric === "presences") {
    const counts = new Map<string, number>();
    for (const g of data.checkins) {
      const k = dayKey(g.checked_at);
      if (k < ch.start_date || k > ch.end_date) continue;
      counts.set(g.client_id, (counts.get(g.client_id) ?? 0) + 1);
    }
    for (const [cid, n] of counts) values.set(cid, Math.max(n, values.get(cid) ?? 0));
  } else if (ch.metric === "squat_kg") {
    const inRange = new Map<string, number>();
    const latest = new Map<string, number>();
    for (const m of data.measurements) {
      if (m.squat_kg === null || m.squat_kg === undefined) continue;
      const v = Number(m.squat_kg);
      if (m.measured_on <= ch.end_date) latest.set(m.client_id, v);
      if (m.measured_on >= ch.start_date && m.measured_on <= ch.end_date) inRange.set(m.client_id, Math.max(v, inRange.get(m.client_id) ?? 0));
    }
    for (const [cid, v] of inRange) values.set(cid, Math.max(v, values.get(cid) ?? 0));
    // Repli : dernière mesure connue pour les inscrits sans mesure dans la période
    for (const cid of entryIds.keys()) {
      if (!inRange.has(cid) && latest.has(cid)) values.set(cid, Math.max(latest.get(cid)!, values.get(cid) ?? 0));
    }
  }

  const rows = [...values.entries()]
    .filter(([cid]) => byId.has(cid) || entryIds.has(cid))
    .map(([cid, value]) => {
      const c = byId.get(cid);
      return { client_id: cid, name: c?.full_name ?? "Membre", value, entryId: entryIds.get(cid) ?? null, linked: !!c?.user_id };
    });
  return rankRows(rows);
}

export function progressPct(value: number, goal: number | null) {
  if (!goal || goal <= 0) return null;
  return Math.max(0, Math.min(100, Math.round((value / goal) * 100)));
}
