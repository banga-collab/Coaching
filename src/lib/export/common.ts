/** Types et utilitaires partagés par les exports (Excel, PDF imprimable, CSV). */

export type Cell = string | number | boolean | null | undefined;
export type ExportFormat = "xlsx" | "pdf" | "csv";

/** Métadonnées affichées en tête de chaque export */
export interface ExportMeta {
  /** Titre lisible, ex. « Clients » (affiché « Moov'Up — Clients ») */
  title: string;
  /** Nom de la personne qui exporte */
  user: string;
  /** Date de l'export (par défaut : maintenant) */
  date?: Date;
  /** Filtres actifs, ex. ["Période : du 01/10/2026 au 31/10/2026", "Statut : Actif"] */
  filters?: string[];
}

export const BRAND = "Moov'Up";
export const BRAND_COLOR = "#1a6d8e";
export const ACCENT_COLOR = "#e8782a";

export function parseFormat(v: string | null | undefined): ExportFormat {
  return v === "xlsx" || v === "pdf" ? v : "csv";
}

/** « 18/11/2026 à 14:05 » (heure d'Agadir) */
export function stamp(d: Date = new Date()) {
  const date = new Intl.DateTimeFormat("fr-FR", { timeZone: "Africa/Casablanca", day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
  const time = new Intl.DateTimeFormat("fr-FR", { timeZone: "Africa/Casablanca", hour: "2-digit", minute: "2-digit" }).format(d);
  return `${date} à ${time}`;
}

export function titleLine(meta: ExportMeta) {
  return `${BRAND} — ${meta.title}`;
}

export function byLine(meta: ExportMeta) {
  return `Exporté par ${meta.user || "—"} le ${stamp(meta.date)}`;
}

/** Minuscules sans accents (recherche insensible à la casse et aux accents) */
export function fold(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/** Garde les lignes dont au moins une cellule contient `q` (insensible casse / accents). */
export function filterRows<T extends Cell[]>(rows: T[], q: string | null | undefined): T[] {
  const needle = fold((q ?? "").trim());
  if (!needle) return rows;
  return rows.filter((r) => fold(r.map((c) => (c === null || c === undefined ? "" : String(c))).join("\u0001")).includes(needle));
}

const nfText = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });
/** Valeur affichable (PDF) */
export function cellText(v: Cell) {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return Number.isFinite(v) ? nfText.format(v) : "";
  if (typeof v === "boolean") return v ? "Oui" : "Non";
  return String(v);
}

/** Échappement HTML / XML */
export function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Nom de fichier `moovup-<kind>-<AAAA-MM-JJ>.<ext>` */
export function fileName(kind: string, ext: string, d: Date = new Date()) {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Casablanca" }).format(d);
  const safe = kind.replace(/[^a-z0-9-]+/gi, "-").toLowerCase();
  return `moovup-${safe}-${day}.${ext}`;
}
