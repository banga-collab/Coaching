/**
 * Données de démonstration « montre » pour Karim (90 jours, Apple Watch + quelques saisies) :
 * ajoutées une seule fois à la base en mémoire de la démo, sans toucher à `lib/demo.ts`.
 * Histoire : progression régulière (FC repos 68 → 62 bpm, VO2max en hausse, poids en baisse)
 * puis une semaine chargée : 4 nuits courtes et FC repos qui remonte → les deux alertes s'affichent.
 */
import { DEMO_CLIENT_USER, demoDb } from "@/lib/demo";
import { dayKey } from "@/lib/utils";
import { shiftDay } from "./aggregate";
import { sampleId } from "./ids";
import type { HealthDetails, HealthMetric, HealthSource } from "./types";
import { METRIC_META } from "./types";

const g = globalThis as unknown as { __moovupHealthSeeded?: WeakSet<object> };

function rng(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hm = (min: number) => {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

export function ensureHealthDemo() {
  const db = demoDb();
  const seeded = (g.__moovupHealthSeeded ??= new WeakSet());
  if (seeded.has(db)) return;
  seeded.add(db);
  const karim = (db.clients ?? []).find((c) => c.user_id === DEMO_CLIENT_USER);
  if (!karim) return;
  const rows: Record<string, unknown>[] = [];
  const rand = rng(20261118);
  const noise = (amp: number) => (rand() * 2 - 1) * amp;
  const today = dayKey(new Date());
  const push = (day: string, metric: HealthMetric, value: number, source: HealthSource = "apple_health", details: HealthDetails | null = null) =>
    rows.push({
      id: sampleId(karim.id, day, metric, source),
      client_id: karim.id,
      day,
      metric,
      value,
      unit: METRIC_META[metric].unit,
      source,
      details: source === "apple_health" ? { ...(details ?? {}), device: "Apple Watch de Karim" } : details,
      created_by: DEMO_CLIENT_USER,
      created_at: `${today}T06:30:00.000Z`,
    });

  for (let i = 0; i < 90; i++) {
    const day = shiftDay(today, i - 89);
    const wd = new Date(`${day}T12:00:00Z`).getUTCDay(); // 0 = dimanche
    const weekend = wd === 0 || wd === 6;
    const sessionDay = wd === 1 || wd === 3 || wd === 5;
    const tired = i >= 86; // 4 dernières nuits / jours
    const forgot = i === 40 || i === 41 || i === 42; // montre oubliée sur le chargeur
    const isToday = i === 89;

    // Sommeil (nuit qui se termine ce jour-là)
    let total = tired ? 315 + rand() * 35 : weekend ? 470 + noise(30) : 425 + noise(28);
    if (!tired && rand() < 0.05) total = 345 + rand() * 20;
    const awake = 12 + rand() * 18;
    const wake = (weekend ? 7 * 60 + 45 : 6 * 60) + noise(14);
    const bed = wake - total - awake;
    if (forgot) {
      if (i !== 41) push(day, "sleep", Math.round(total), "manuel");
    } else {
      const deep = total * (0.14 + rand() * 0.05);
      const rem = total * (0.2 + rand() * 0.04);
      push(day, "sleep", Math.round(total), "apple_health", {
        deep: Math.round(deep),
        rem: Math.round(rem),
        light: Math.round(total - deep - rem),
        awake: Math.round(awake),
        in_bed: Math.round(total + awake + 8),
        bed: hm(bed),
        wake: hm(wake),
      });
    }

    // FC au repos : 68 → 62 bpm, puis +6 bpm la dernière semaine (fatigue)
    const rhr = 68 - (6 * Math.min(i, 82)) / 82 + noise(1.3) + (i >= 83 ? 6.5 + rand() * 1.5 : 0);
    if (!forgot) push(day, "hr_resting", Math.round(rhr));

    if (isToday) continue; // journée en cours : pas encore de totaux
    // Pas : plus actif les jours de séance, progression de 10 % sur 3 mois
    const prog = 1 + (0.1 * i) / 89;
    const steps = (sessionDay ? 11200 : wd === 0 ? 5200 : weekend ? 8200 : 7300) * prog + noise(1400) - (tired ? 1500 : 0);
    if (forgot) {
      if (i === 40) push(day, "steps", Math.round(steps / 100) * 100, "manuel");
    } else {
      push(day, "steps", Math.round(steps));
      push(day, "hr_avg", Math.round(rhr + 16 + noise(3) + (sessionDay ? 6 : 0)), "apple_health", { min: Math.round(rhr - 6), max: sessionDay ? 168 + Math.round(noise(8)) : 128 + Math.round(noise(10)) });
      push(day, "active_kcal", Math.round(steps * 0.034 + (sessionDay ? 330 : 40) + noise(40)));
    }
    if (wd === 2 && !forgot) push(day, "vo2max", Math.round((37.6 + (3.6 * i) / 89 + noise(0.4)) * 10) / 10);
    if ((wd === 1 || wd === 4 || wd === 6) && !forgot) push(day, "weight", Math.round((89.4 - (3.4 * i) / 89 + noise(0.35)) * 10) / 10);
  }
  (db.health_samples ??= []).push(...rows);
}
