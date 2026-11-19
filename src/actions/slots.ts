"use server";

import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { busyHit, busyLabel, checkSlot, fromMin, loadPlanningData, shiftDate, toMin, weekdayOf } from "@/lib/planning";
import { agadirToIso, isoToAgadir } from "@/lib/utils";

export type DayState = "libre" | "presque" | "complet" | "conge" | "ferme" | "passe" | "inactif";
export interface DayInfo {
  state: DayState;
  /** Tous les horaires de début possibles dans les créneaux du coach (pas de 30 min), libres ou pris (avec la raison) */
  slots: { t: string; free: boolean; why?: string }[];
  /** Séances déjà prévues ce jour-là */
  booked: number;
  /** Cours collectifs du coach ce jour-là (« CrossFit WOD 07:00 ») */
  classes: string[];
}

/**
 * Créneaux d'un coach jour par jour, pour le sélecteur date + heure des formulaires de séance.
 * Les cours collectifs du coach, ses séances et les horaires proposés en attente comptent comme pris.
 * `from` = premier jour affiché (AAAA-MM-JJ), `days` = nombre de jours (max 62).
 */
export async function coachDaysAction(coachId: string, from: string, days: number, durationMin: number, excludeId?: string | null): Promise<Record<string, DayInfo>> {
  const me = await getProfile();
  if (me.role === "client" || !coachId || !/^\d{4}-\d{2}-\d{2}$/.test(from)) return {};
  const n = Math.min(Math.max(days, 1), 62);
  const duration = Math.min(Math.max(Math.round(durationMin) || 60, 15), 240);
  const supabase = await createClient();
  const data = await loadPlanningData(supabase, agadirToIso(from, "00:00"), agadirToIso(shiftDate(from, n), "00:00"), [coachId]);
  const inactive = data.inactive.includes(coachId);
  const now = isoToAgadir(new Date().toISOString());
  const nowMin = toMin(now.time);
  const out: Record<string, DayInfo> = {};
  for (let i = 0; i < n; i++) {
    const date = shiftDate(from, i);
    const booked = data.sessions.filter((s) => s.coach_id === coachId && s.id !== excludeId && isoToAgadir(s.starts_at).date === date).length;
    const classes = data.classes.filter((c) => c.coach_id === coachId && isoToAgadir(c.starts_at).date === date).map((c) => `${c.title} ${isoToAgadir(c.starts_at).time}`);
    const base = { booked, classes };
    if (inactive) {
      out[date] = { state: "inactif", slots: [], ...base };
      continue;
    }
    if (date < now.date) {
      out[date] = { state: "passe", slots: [], ...base };
      continue;
    }
    if (data.timeOff.some((t) => t.coach_id === coachId && t.starts_on <= date && t.ends_on >= date)) {
      out[date] = { state: "conge", slots: [], ...base };
      continue;
    }
    const wd = weekdayOf(date);
    const ranges = data.availability.filter((a) => a.coach_id === coachId && a.weekday === wd).sort((a, b) => toMin(a.start_time) - toMin(b.start_time));
    if (!ranges.length) {
      out[date] = { state: "ferme", slots: [], ...base };
      continue;
    }
    const slots: DayInfo["slots"] = [];
    for (const r of ranges) {
      for (let m = toMin(r.start_time); m + duration <= toMin(r.end_time); m += 30) {
        const t = fromMin(m);
        if (slots.some((s) => s.t === t)) continue;
        if (date === now.date && m <= nowMin) {
          slots.push({ t, free: false, why: "Horaire passé" });
          continue;
        }
        const startIso = agadirToIso(date, t);
        const free = checkSlot(data, { coachId, startIso, durationMin: duration, excludeId }).ok;
        if (free) slots.push({ t, free });
        else {
          const start = new Date(startIso).getTime();
          const hit = busyHit(data, coachId, start, start + duration * 60000, excludeId);
          slots.push({ t, free, why: hit ? busyLabel(hit) : "Déjà pris" });
        }
      }
    }
    slots.sort((a, b) => a.t.localeCompare(b.t));
    const free = slots.filter((s) => s.free).length;
    const state: DayState = !free ? "complet" : free <= Math.max(2, Math.round(slots.length * 0.3)) ? "presque" : "libre";
    out[date] = { state, slots, ...base };
  }
  return out;
}
