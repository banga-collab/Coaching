import type { ClientStatus, SessionStatus } from "./types";

export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]!.toUpperCase())
      .join("") || "?"
  );
}

const nf = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });
export function num(v: number | null | undefined, unit = "") {
  if (v === null || v === undefined) return "–";
  return `${nf.format(Number(v))}${unit ? ` ${unit}` : ""}`;
}

export function signed(v: number, unit = "") {
  const s = v > 0 ? "+" : v < 0 ? "−" : "±";
  return `${s}${nf.format(Math.abs(v))}${unit ? ` ${unit}` : ""}`;
}

export function age(birth: string | null) {
  if (!birth) return null;
  const b = new Date(birth);
  const n = new Date();
  let a = n.getFullYear() - b.getFullYear();
  if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) a--;
  return a;
}

export function fmtDate(d: string | Date, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) {
  return new Intl.DateTimeFormat("fr-FR", { timeZone: "Africa/Casablanca", ...opts }).format(new Date(d));
}

export function fmtTime(d: string | Date) {
  return new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Casablanca" }).format(new Date(d));
}

/** Clé AAAA-MM-JJ d'une date dans le fuseau d'Agadir */
export function dayKey(d: string | Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Casablanca" }).format(new Date(d));
}

export function startOfWeek(d = new Date()) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // lundi = 0
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - day);
  return x;
}

export function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export const STATUS_LABEL: Record<ClientStatus, string> = { actif: "Actif", pause: "En pause", termine: "Terminé" };
export const SESSION_LABEL: Record<SessionStatus, string> = {
  planifiee: "En attente du coach",
  acceptee: "Acceptée",
  refusee: "Refusée",
  reportee: "Report proposé",
  en_cours: "En cours",
  realisee: "Terminée",
  absent: "Absent",
  annulee: "Annulée",
};

export const SESSION_TYPES = [
  "Musculation – Haut du corps",
  "Musculation – Bas du corps",
  "Musculation – Full body",
  "Cardio / HIIT",
  "Circuit training",
  "Mobilité & gainage",
  "Renforcement doux",
  "Préparation physique",
  "Évaluation / tests",
];

export const PAIN_ZONES = ["Nuque", "Épaules", "Coudes", "Poignets", "Haut du dos", "Bas du dos", "Hanches", "Genoux", "Chevilles"];

/** Parse un nombre saisi en français ("72,5") */
export function parseNum(v: FormDataEntryValue | null): number | null {
  if (v === null) return null;
  const s = String(v).trim().replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function str(v: FormDataEntryValue | null): string | null {
  const s = v === null ? "" : String(v).trim();
  return s ? s : null;
}

/** Décalage (en minutes) du fuseau d'Agadir à une date donnée (gère les changements d'heure, Ramadan…). */
export function agadirOffsetMin(d: Date = new Date()) {
  const part = new Intl.DateTimeFormat("en-US", { timeZone: "Africa/Casablanca", timeZoneName: "longOffset" })
    .formatToParts(d)
    .find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  const m = part.match(/GMT([+-])(\d{2}):?(\d{2})?/);
  if (!m) return 0;
  return (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] ?? 0));
}

/** "2026-11-17" + "18:00" saisis à Agadir → ISO UTC */
export function agadirToIso(date: string, time: string) {
  const naive = new Date(`${date}T${time || "09:00"}:00Z`);
  return new Date(naive.getTime() - agadirOffsetMin(naive) * 60000).toISOString();
}

/** ISO UTC → { date, time } à Agadir (pour pré-remplir les formulaires) */
export function isoToAgadir(iso: string) {
  const d = new Date(iso);
  const local = new Date(d.getTime() + agadirOffsetMin(d) * 60000);
  return { date: local.toISOString().slice(0, 10), time: local.toISOString().slice(11, 16) };
}
