/** Calculs d'affichage : une valeur par jour, moyennes, régularité du sommeil, alertes simples. */
import { shiftDay } from "./aggregate";
import { SOURCE_PRIORITY, fmtSleep, type HealthDetails, type HealthMetric, type HealthSample, type HealthSource } from "./types";

export type DayValue = { day: string; value: number; source: HealthSource; details: HealthDetails | null };
export type Daily = Record<HealthMetric, Map<string, DayValue>>;

/** Une valeur par jour et par métrique (source préférée quand il y en a plusieurs). */
export function toDaily(samples: HealthSample[]): Daily {
  const out = { sleep: new Map(), steps: new Map(), hr_resting: new Map(), hr_avg: new Map(), active_kcal: new Map(), vo2max: new Map(), weight: new Map() } as Daily;
  const rank = (s: HealthSource) => SOURCE_PRIORITY.indexOf(s);
  for (const s of samples) {
    const m = out[s.metric];
    if (!m) continue;
    const cur = m.get(s.day);
    if (!cur || rank(s.source) < rank(cur.source)) m.set(s.day, { day: s.day, value: Number(s.value), source: s.source, details: s.details ?? null });
  }
  return out;
}

/** Les n derniers jours, du plus ancien au plus récent. */
export function lastDays(n: number, today: string) {
  return Array.from({ length: n }, (_, i) => shiftDay(today, i - n + 1));
}

export function series(map: Map<string, DayValue>, days: string[]) {
  return days.map((d) => map.get(d) ?? null);
}

export const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
export function sd(xs: number[]) {
  const m = mean(xs);
  if (m === null || xs.length < 2) return null;
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
}

export function valuesIn(map: Map<string, DayValue>, from: string, to: string) {
  const out: DayValue[] = [];
  for (const v of map.values()) if (v.day >= from && v.day <= to) out.push(v);
  return out.sort((a, b) => (a.day < b.day ? -1 : 1));
}

export function latest(map: Map<string, DayValue>) {
  let best: DayValue | null = null;
  for (const v of map.values()) if (!best || v.day > best.day) best = v;
  return best;
}

/** "23:40" → minutes depuis midi (pour ne pas couper la nuit à minuit) */
const fromNoon = (hm: string) => {
  const [h, m] = hm.split(":").map(Number);
  return (((h! - 12 + 24) % 24) * 60 + m!) % 1440;
};
const noonToHm = (v: number) => {
  const t = Math.round(v + 12 * 60) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
};

export type Regularity = { label: string; tone: "green" | "amber" | "red" | "gray"; detail: string; bed: string | null };

/** Régularité : écart-type de l'heure de coucher (si connue), sinon de la durée. */
export function sleepRegularity(nights: DayValue[]): Regularity {
  const beds = nights.map((n) => n.details?.bed).filter((b): b is string => !!b && /^\d{2}:\d{2}$/.test(b));
  if (beds.length >= 5) {
    const xs = beds.map(fromNoon);
    const s = sd(xs)!;
    const bed = noonToHm(mean(xs)!);
    const detail = `Coucher moyen ${bed} (± ${Math.round(s)} min)`;
    if (s <= 30) return { label: "Très régulier", tone: "green", detail, bed };
    if (s <= 75) return { label: "Assez régulier", tone: "amber", detail, bed };
    return { label: "Irrégulier", tone: "red", detail, bed };
  }
  const s = sd(nights.map((n) => n.value));
  if (s === null || nights.length < 5) return { label: "Pas assez de nuits", tone: "gray", detail: "Il faut au moins 5 nuits.", bed: null };
  const detail = `Durée variable de ± ${Math.round(s)} min d'une nuit à l'autre`;
  if (s <= 45) return { label: "Très régulier", tone: "green", detail, bed: null };
  if (s <= 90) return { label: "Assez régulier", tone: "amber", detail, bed: null };
  return { label: "Irrégulier", tone: "red", detail, bed: null };
}

export type HealthAlert = { key: string; tone: "red" | "amber"; title: string; text: string };

export const SHORT_SLEEP_MIN = 360; // 6 h
export const RHR_RISE_BPM = 5;

/**
 * Alertes simples :
 * - sommeil < 6 h sur les 3 dernières nuits enregistrées (dans les 5 derniers jours) ;
 * - FC au repos des 7 derniers jours ≥ 5 bpm au-dessus de la moyenne des 4 semaines précédentes.
 */
export function healthAlerts(daily: Daily, today: string): HealthAlert[] {
  const alerts: HealthAlert[] = [];
  const recentNights = valuesIn(daily.sleep, shiftDay(today, -4), today).slice(-3);
  if (recentNights.length === 3 && recentNights.every((n) => n.value < SHORT_SLEEP_MIN)) {
    const avg = mean(recentNights.map((n) => n.value))!;
    alerts.push({
      key: "sleep",
      tone: "red",
      title: "Sommeil insuffisant 3 nuits de suite",
      text: `Moyenne de ${fmtSleep(avg)} sur les 3 dernières nuits (moins de 6 h). Alléger l'intensité et parler récupération.`,
    });
  }
  const week = valuesIn(daily.hr_resting, shiftDay(today, -6), today).map((v) => v.value);
  const base = valuesIn(daily.hr_resting, shiftDay(today, -34), shiftDay(today, -7)).map((v) => v.value);
  if (week.length >= 3 && base.length >= 10) {
    const diff = mean(week)! - mean(base)!;
    if (diff >= RHR_RISE_BPM) {
      alerts.push({
        key: "rhr",
        tone: "amber",
        title: "Fréquence cardiaque au repos en hausse",
        text: `+${Math.round(diff)} bpm cette semaine par rapport aux 4 semaines précédentes (${Math.round(mean(base)!)} → ${Math.round(mean(week)!)} bpm). Possible fatigue, stress ou début de maladie.`,
      });
    }
  }
  return alerts;
}

/** Moyenne glissante sur `w` jours (ignore les jours vides). */
export function rolling(values: (number | null)[], w = 7) {
  return values.map((_, i) => {
    const win = values.slice(Math.max(0, i - w + 1), i + 1).filter((v): v is number => v !== null);
    return win.length ? mean(win)! : null;
  });
}
