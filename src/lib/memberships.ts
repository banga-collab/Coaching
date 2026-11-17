/** Abonnements & accès salle : calculs purs (statut, jours restants, séances restantes…). */
import type { Membership } from "./types";
import { dayKey } from "./utils";

export type MembershipState = "actif" | "bientot" | "expire" | "epuise" | "suspendu" | "annule" | "a_venir";

export const MEMBERSHIP_STATE: Record<MembershipState, { label: string; tone: "green" | "amber" | "red" | "gray" | "brand" }> = {
  actif: { label: "Actif", tone: "green" },
  bientot: { label: "Expire bientôt", tone: "amber" },
  expire: { label: "Expiré", tone: "red" },
  epuise: { label: "Séances épuisées", tone: "red" },
  suspendu: { label: "Suspendu", tone: "gray" },
  annule: { label: "Annulé", tone: "gray" },
  a_venir: { label: "À venir", tone: "brand" },
};

/** Nombre de jours avant l'alerte d'expiration */
export const EXPIRY_ALERT_DAYS = 7;
/** Délai minimal entre deux passages enregistrés (anti double scan) */
export const CHECKIN_COOLDOWN_MIN = 120;

export function todayKey() {
  return dayKey(new Date());
}

const utc = (key: string) => Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, Number(key.slice(8, 10)));

/** Différence en jours entre deux dates AAAA-MM-JJ (b − a) */
export function diffDays(a: string, b: string) {
  return Math.round((utc(b) - utc(a)) / 86400000);
}

/** AAAA-MM-JJ + n jours */
export function addDaysKey(key: string, n: number) {
  return new Date(utc(key) + n * 86400000).toISOString().slice(0, 10);
}

/** Jours restants jusqu'à la date de fin (0 = dernier jour, négatif = expiré) */
export function daysLeft(m: Pick<Membership, "end_date">, today = todayKey()) {
  return diffDays(today, m.end_date);
}

/** Séances restantes (null = accès illimité) */
export function sessionsLeft(m: Pick<Membership, "sessions_total" | "sessions_used">) {
  if (m.sessions_total === null || m.sessions_total === undefined) return null;
  return Math.max(0, m.sessions_total - (m.sessions_used ?? 0));
}

export function durationDays(m: Pick<Membership, "start_date" | "end_date">) {
  return Math.max(1, diffDays(m.start_date, m.end_date));
}

/** Part du temps écoulé (0–100) */
export function timeProgress(m: Pick<Membership, "start_date" | "end_date">, today = todayKey()) {
  const pct = (diffDays(m.start_date, today) / durationDays(m)) * 100;
  return Math.max(0, Math.min(100, Math.round(pct)));
}

/** Part des séances consommées (0–100), null si illimité */
export function sessionsProgress(m: Pick<Membership, "sessions_total" | "sessions_used">) {
  if (!m.sessions_total) return null;
  return Math.max(0, Math.min(100, Math.round(((m.sessions_used ?? 0) / m.sessions_total) * 100)));
}

export function membershipState(m: Membership, today = todayKey()): MembershipState {
  if (m.status === "annule") return "annule";
  if (m.status === "suspendu") return "suspendu";
  const left = daysLeft(m, today);
  if (left < 0) return "expire";
  if (m.start_date > today) return "a_venir";
  if (sessionsLeft(m) === 0) return "epuise";
  if (left <= EXPIRY_ALERT_DAYS) return "bientot";
  return "actif";
}

/** L'abonnement « de référence » d'un client : celui en cours, sinon le prochain, sinon le plus récent. */
export function currentMembership(list: Membership[], today = todayKey()): Membership | null {
  if (!list.length) return null;
  const live = list.filter((m) => m.status !== "annule");
  const pool = live.length ? live : list;
  const running = pool
    .filter((m) => m.start_date <= today && m.end_date >= today)
    .sort((a, b) => (a.status === b.status ? b.end_date.localeCompare(a.end_date) : a.status === "actif" ? -1 : 1));
  if (running[0]) return running[0];
  const upcoming = pool.filter((m) => m.start_date > today).sort((a, b) => a.start_date.localeCompare(b.start_date));
  if (upcoming[0]) return upcoming[0];
  return [...pool].sort((a, b) => b.end_date.localeCompare(a.end_date))[0] ?? null;
}

/** Le passage est-il autorisé avec cet abonnement ? */
export function accessCheck(m: Membership | null, today = todayKey()): { ok: true } | { ok: false; title: string; reason: string } {
  if (!m) return { ok: false, title: "Aucun abonnement", reason: "Aucun abonnement n'est enregistré pour ce membre." };
  const st = membershipState(m, today);
  switch (st) {
    case "annule":
      return { ok: false, title: "Abonnement annulé", reason: `« ${m.name} » a été annulé.` };
    case "suspendu":
      return { ok: false, title: "Abonnement suspendu", reason: `« ${m.name} » est actuellement suspendu.` };
    case "expire":
      return { ok: false, title: "Abonnement expiré", reason: `« ${m.name} » a expiré il y a ${-daysLeft(m, today)} jour${-daysLeft(m, today) > 1 ? "s" : ""}.` };
    case "a_venir":
      return { ok: false, title: "Abonnement pas encore actif", reason: `« ${m.name} » commence le ${frDay(m.start_date)}.` };
    case "epuise":
      return { ok: false, title: "Séances épuisées", reason: `Les ${m.sessions_total} séances de « ${m.name} » ont toutes été utilisées.` };
    default:
      return { ok: true };
  }
}

/** Revenu mensuel estimé d'un abonnement (prix ramené à 30 jours) */
export function monthlyValue(m: Membership) {
  if (!m.price_mad) return 0;
  return (Number(m.price_mad) * 30) / Math.max(30, durationDays(m));
}

export function frDay(key: string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" }) {
  return new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", ...opts }).format(new Date(`${key}T12:00:00Z`));
}

/** "J-3", "Dernier jour", "Expiré depuis 4 j" */
export function daysLeftLabel(left: number) {
  if (left < 0) return `Expiré depuis ${-left} j`;
  if (left === 0) return "Dernier jour";
  return `${left} jour${left > 1 ? "s" : ""}`;
}

/** Ton du badge « jours restants » */
export function daysTone(left: number): "red" | "amber" | "green" {
  if (left < 0) return "red";
  if (left <= EXPIRY_ALERT_DAYS) return "amber";
  return "green";
}

/** Normalise un code d'accès saisi ou scanné */
export function normalizeCode(v: string) {
  return v.trim().toUpperCase().replace(/\s+/g, "");
}
