/**
 * Agrégation par jour des mesures brutes (des milliers d'enregistrements par jour sur une montre)
 * en une valeur par jour et par métrique. Utilisé côté navigateur pendant l'import.
 *
 * Doublons : l'iPhone et la montre comptent souvent les mêmes pas. Pour les cumuls (pas, calories)
 * on garde, chaque jour, l'appareil qui donne le plus haut total (comme le fait Santé) ; pour le
 * sommeil, l'appareil qui a enregistré la nuit la plus complète.
 */
import type { DailyInput, HealthDetails, HealthMetric } from "./types";

type Avg = { sum: number; n: number; min: number; max: number };
type Night = { deep: number; light: number; rem: number; unspec: number; awake: number; inBed: number; first: string; last: string };
export type SleepPhase = "deep" | "light" | "rem" | "unspec" | "awake" | "in_bed";

export class DayAggregator {
  private sums = new Map<string, number>(); // jour|métrique|appareil
  private avgs = new Map<string, Avg>(); // jour|métrique
  private lasts = new Map<string, { t: string; v: number }>(); // jour|métrique
  private nights = new Map<string, Night>(); // jour|appareil
  records = 0;

  constructor(private since = "0000-00-00") {}

  /** Le jour est-il dans la période importée ? */
  keep(day: string) {
    return day >= this.since && /^\d{4}-\d{2}-\d{2}$/.test(day);
  }

  /** Cumul sur la journée (pas, calories actives par segments). */
  addSum(day: string, metric: HealthMetric, device: string, v: number) {
    if (!this.keep(day) || !Number.isFinite(v)) return;
    const k = `${day}|${metric}|${device}`;
    this.sums.set(k, (this.sums.get(k) ?? 0) + v);
    this.records++;
  }

  /** Total déjà calculé par jour (résumés quotidiens) : on garde le plus haut. */
  addMax(day: string, metric: HealthMetric, device: string, v: number) {
    if (!this.keep(day) || !Number.isFinite(v)) return;
    const k = `${day}|${metric}|${device}`;
    this.sums.set(k, Math.max(this.sums.get(k) ?? 0, v));
    this.records++;
  }

  /** Moyenne sur la journée (fréquence cardiaque). */
  addAvg(day: string, metric: HealthMetric, v: number) {
    if (!this.keep(day) || !Number.isFinite(v) || v <= 0) return;
    const k = `${day}|${metric}`;
    const a = this.avgs.get(k);
    if (a) {
      a.sum += v;
      a.n++;
      if (v < a.min) a.min = v;
      if (v > a.max) a.max = v;
    } else this.avgs.set(k, { sum: v, n: 1, min: v, max: v });
    this.records++;
  }

  /** Dernière valeur de la journée (poids, VO2max). `t` = horodatage comparable (texte trié). */
  addLast(day: string, metric: HealthMetric, v: number, t = "") {
    if (!this.keep(day) || !Number.isFinite(v) || v <= 0) return;
    const k = `${day}|${metric}`;
    const cur = this.lasts.get(k);
    if (!cur || t >= cur.t) this.lasts.set(k, { t, v });
    this.records++;
  }

  /**
   * Segment de sommeil. `wakeDay` = jour du réveil (une nuit du 3 au 4 compte pour le 4).
   * `start`/`end` au format "AAAA-MM-JJ HH:MM" (heure locale) pour l'heure de coucher / lever.
   */
  addSleep(wakeDay: string, device: string, phase: SleepPhase, minutes: number, start: string, end: string) {
    if (!this.keep(wakeDay) || !Number.isFinite(minutes) || minutes <= 0 || minutes > 1440) return;
    const k = `${wakeDay}|${device}`;
    let n = this.nights.get(k);
    if (!n) {
      n = { deep: 0, light: 0, rem: 0, unspec: 0, awake: 0, inBed: 0, first: start, last: end };
      this.nights.set(k, n);
    }
    if (phase === "in_bed") n.inBed += minutes;
    else if (phase === "awake") n.awake += minutes;
    else n[phase] += minutes;
    if (phase !== "awake") {
      if (start && start < n.first) n.first = start;
      if (end && end > n.last) n.last = end;
    }
    this.records++;
  }

  result(): DailyInput[] {
    const out: DailyInput[] = [];
    // Cumuls : meilleur appareil du jour
    const best = new Map<string, number>();
    for (const [k, v] of this.sums) {
      const i = k.lastIndexOf("|");
      const key = k.slice(0, i);
      if (v > (best.get(key) ?? -1)) best.set(key, v);
    }
    for (const [key, v] of best) {
      const [day, metric] = key.split("|") as [string, HealthMetric];
      out.push({ day, metric, value: Math.round(v) });
    }
    for (const [key, a] of this.avgs) {
      const [day, metric] = key.split("|") as [string, HealthMetric];
      const details: HealthDetails | null = a.n > 1 ? { min: Math.round(a.min), max: Math.round(a.max) } : null;
      out.push({ day, metric, value: Math.round((a.sum / a.n) * 10) / 10, details });
    }
    for (const [key, l] of this.lasts) {
      const [day, metric] = key.split("|") as [string, HealthMetric];
      out.push({ day, metric, value: Math.round(l.v * 10) / 10 });
    }
    // Sommeil : la nuit la plus complète parmi les appareils
    const nights = new Map<string, { total: number; n: Night }>();
    for (const [k, n] of this.nights) {
      const day = k.slice(0, 10);
      const phases = n.deep + n.light + n.rem;
      const total = phases > 0 ? phases : n.unspec > 0 ? n.unspec : n.inBed;
      if (total > (nights.get(day)?.total ?? 0)) nights.set(day, { total, n });
    }
    for (const [day, { total, n }] of nights) {
      if (total < 30) continue;
      const details: HealthDetails = {};
      if (n.deep + n.light + n.rem > 0) {
        details.deep = Math.round(n.deep);
        details.light = Math.round(n.light);
        details.rem = Math.round(n.rem);
      }
      if (n.awake) details.awake = Math.round(n.awake);
      if (n.inBed) details.in_bed = Math.round(n.inBed);
      if (n.first.length >= 16) details.bed = n.first.slice(11, 16);
      if (n.last.length >= 16) details.wake = n.last.slice(11, 16);
      out.push({ day, metric: "sleep", value: Math.round(total), details: Object.keys(details).length ? details : null });
    }
    return out.sort((a, b) => (a.day === b.day ? a.metric.localeCompare(b.metric) : a.day < b.day ? -1 : 1));
  }
}

/** Jour (AAAA-MM-JJ) n jours avant/après. */
export function shiftDay(day: string, n: number) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Durée en minutes entre deux dates (ms). */
export const minutesBetween = (a: number, b: number) => (b - a) / 60000;
