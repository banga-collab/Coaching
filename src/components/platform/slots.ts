/** Créneaux de réservation (fuseau Africa/Casablanca). Utilisable côté serveur et client. */
import type { Settings } from "@/lib/types";

const TZ = "Africa/Casablanca";

/** Décalage (minutes) du fuseau d'Agadir par rapport à UTC à un instant donné. */
function tzOffset(at: Date) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
      .formatToParts(at)
      .map((x) => [x.type, x.value]),
  );
  const local = Date.UTC(+p.year!, +p.month! - 1, +p.day!, +p.hour!, +p.minute!);
  return Math.round((local - Math.floor(at.getTime() / 60000) * 60000) / 60000);
}

/** "2026-11-20" + "18:00" (heure d'Agadir) → ISO UTC */
export function zonedIso(dateKey: string, hhmm: string) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const [h, mi] = hhmm.split(":").map(Number);
  const guess = Date.UTC(y!, m! - 1, d!, h!, mi!);
  const off = tzOffset(new Date(guess));
  return new Date(guess - off * 60000).toISOString();
}

export function localDayKey(d: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
}

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};
const toHhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

export type Slot = { time: string; iso: string };
export type BookingDay = { key: string; weekday: number; slots: Slot[] };

/** Jours ouverts des 14 prochains jours avec leurs créneaux libres. */
export function buildDays(hours: Settings["booking_hours"], busy: { start: string; minutes: number }[], now = new Date(), span = 14): BookingDay[] {
  const step = Math.max(15, Number(hours.slot) || 60);
  const startMin = toMin(hours.start || "08:00");
  const endMin = toMin(hours.end || "20:00");
  const ranges = busy.map((b) => {
    const s = new Date(b.start).getTime();
    return [s, s + (b.minutes || 60) * 60000] as const;
  });
  const out: BookingDay[] = [];
  for (let i = 0; i < span; i++) {
    const key = localDayKey(new Date(now.getTime() + i * 86400000));
    const weekday = new Date(`${key}T12:00:00Z`).getUTCDay();
    if (!hours.days?.includes(weekday)) continue;
    const slots: Slot[] = [];
    for (let t = startMin; t + step <= endMin; t += step) {
      const time = toHhmm(t);
      const iso = zonedIso(key, time);
      const s = new Date(iso).getTime();
      if (s <= now.getTime()) continue;
      const e = s + step * 60000;
      if (ranges.some(([bs, be]) => s < be && e > bs)) continue;
      slots.push({ time, iso });
    }
    out.push({ key, weekday, slots });
  }
  return out;
}

export const WEEKDAYS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
export const WEEKDAYS_SHORT = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
