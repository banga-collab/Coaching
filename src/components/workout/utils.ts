import type { ProgramExercise, WorkoutEntry, WorkoutLog, WorkoutSet } from "@/lib/types";
import { normName } from "@/lib/video";

export const DEFAULT_REST = 90;

/** "90 s", "2 min", "1'30", "1 min 30", "1:30" → secondes */
export function parseRest(raw: string | null | undefined): number {
  if (!raw) return DEFAULT_REST;
  const s = raw.toLowerCase().replace(",", ".").trim();
  let m = s.match(/^(\d+)\s*[:']\s*(\d{1,2})/);
  if (m) return clampRest(Number(m[1]) * 60 + Number(m[2]));
  m = s.match(/(\d+(?:\.\d+)?)\s*(?:min|mn|m)\b\s*(\d+)?/);
  if (m) return clampRest(Math.round(Number(m[1]) * 60 + Number(m[2] ?? 0)));
  m = s.match(/(\d+)/);
  if (m) return clampRest(Number(m[1]));
  return DEFAULT_REST;
}
const clampRest = (n: number) => (Number.isFinite(n) && n > 0 ? Math.min(600, Math.max(10, n)) : DEFAULT_REST);

export function targetOf(e: Pick<ProgramExercise, "sets" | "reps">): string | null {
  if (!e.sets && !e.reps) return null;
  return `${e.sets ?? "?"} × ${e.reps ?? "?"}`;
}

/** Nombre de répétitions numérique (les "45 s" ne comptent pas dans le volume). */
export function repsNum(r: WorkoutSet["reps"]): number {
  if (typeof r === "number") return r;
  if (!r) return 0;
  const s = String(r).trim();
  if (/s(ec)?$|min/i.test(s)) return 0;
  const n = Number(s.replace(",", ".").match(/\d+(?:\.\d+)?/)?.[0] ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export function entryVolume(e: WorkoutEntry) {
  return e.sets.filter((s) => s.done).reduce((a, s) => a + repsNum(s.reps) * (Number(s.load) || 0), 0);
}

export function logStats(log: Pick<WorkoutLog, "entries" | "started_at" | "finished_at">) {
  const entries = Array.isArray(log.entries) ? log.entries : [];
  const total = entries.reduce((a, e) => a + (e.sets?.length ?? 0), 0);
  const done = entries.reduce((a, e) => a + (e.sets?.filter((s) => s.done).length ?? 0), 0);
  const volume = Math.round(entries.reduce((a, e) => a + entryVolume({ ...e, sets: e.sets ?? [] }), 0));
  const durationMin = log.finished_at ? Math.max(0, Math.round((new Date(log.finished_at).getTime() - new Date(log.started_at).getTime()) / 60000)) : null;
  return { total, done, volume, durationMin, exercises: entries.length };
}

export function maxLoad(e: WorkoutEntry): number {
  return (e.sets ?? []).filter((s) => s.done).reduce((a, s) => Math.max(a, Number(s.load) || 0), 0);
}

/** Records : pour chaque séance (ordre chronologique), exercices dont la charge dépasse tout l'historique précédent. */
export function detectPRs(logsAsc: Pick<WorkoutLog, "id" | "entries">[]) {
  const best = new Map<string, number>();
  const prs = new Map<string, { exercise: string; load: number; previous: number }[]>();
  for (const log of logsAsc) {
    const found: { exercise: string; load: number; previous: number }[] = [];
    for (const e of Array.isArray(log.entries) ? log.entries : []) {
      const k = normName(e.exercise);
      const load = maxLoad(e);
      const prev = best.get(k);
      if (load > 0 && prev !== undefined && load > prev) found.push({ exercise: e.exercise, load, previous: prev });
      if (load > 0) best.set(k, Math.max(prev ?? 0, load));
    }
    prs.set(log.id, found);
  }
  return { prs, best };
}

export function fmtDuration(min: number | null | undefined) {
  if (min === null || min === undefined) return "–";
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")}`;
}

export function fmtClock(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}` : `${m}:${String(r).padStart(2, "0")}`;
}

const kg = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });
export const fmtKg = (n: number) => `${kg.format(n)} kg`;

/** Meilleure série faite d'un exercice : "8 × 80 kg" */
export function bestSetLabel(e: WorkoutEntry): string | null {
  const done = (e.sets ?? []).filter((s) => s.done);
  if (!done.length) return null;
  const top = done.reduce((a, s) => ((Number(s.load) || 0) > (Number(a.load) || 0) ? s : a), done[0]!);
  const reps = top.reps ?? "?";
  return top.load ? `${reps} × ${kg.format(Number(top.load))} kg` : `${reps}${typeof reps === "number" ? " reps" : ""}`;
}
