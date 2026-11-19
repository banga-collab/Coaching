import type { Notification } from "@/lib/types";
import { dayKey, fmtDate, fmtTime } from "@/lib/utils";

/** "à l'instant", "il y a 5 min", "il y a 3 h", "hier", "il y a 4 j", sinon date */
export function relTime(iso: string, now = Date.now()) {
  const diff = Math.max(0, now - new Date(iso).getTime());
  const min = Math.floor(diff / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24 && dayKey(iso) === dayKey(new Date(now))) return `il y a ${h} h`;
  const d = Math.round((new Date(dayKey(new Date(now))).getTime() - new Date(dayKey(iso)).getTime()) / 86400000);
  if (d <= 1) return "hier";
  if (d < 7) return `il y a ${d} j`;
  return fmtDate(iso, { day: "numeric", month: "short" });
}

/** Heure si aujourd'hui, "Hier", jour de semaine si < 7 j, sinon date courte */
export function shortStamp(iso: string, now = Date.now()) {
  const d = Math.round((new Date(dayKey(new Date(now))).getTime() - new Date(dayKey(iso)).getTime()) / 86400000);
  if (d <= 0) return fmtTime(iso);
  if (d === 1) return "Hier";
  if (d < 7) return fmtDate(iso, { weekday: "short" });
  return fmtDate(iso, { day: "2-digit", month: "2-digit" });
}

export function dayLabel(key: string, now = Date.now()) {
  const d = Math.round((new Date(dayKey(new Date(now))).getTime() - new Date(key).getTime()) / 86400000);
  if (d === 0) return "Aujourd'hui";
  if (d === 1) return "Hier";
  return fmtDate(`${key}T12:00:00`, { weekday: "long", day: "numeric", month: "long" });
}

export type NotifKind = Notification["kind"];
