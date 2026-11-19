/** Sections des rapports clients (partagé entre la page /rapports et la route /api/rapport). */
export const REPORT_SECTIONS = [
  { key: "progression", label: "Progression & mesures", hint: "Poids, masse grasse, tour de taille, charges" },
  { key: "sante", label: "Bilans de santé", hint: "Dernier bilan, tension, sommeil, douleurs" },
  { key: "seances", label: "Séances", hint: "Liste détaillée des séances" },
  { key: "presence", label: "Présence", hint: "Taux de présence, passages salle, cours" },
] as const;

export type ReportSection = (typeof REPORT_SECTIONS)[number]["key"];
export const REPORT_SECTION_KEYS = REPORT_SECTIONS.map((s) => s.key) as ReportSection[];

export function parseSections(v: string | null | undefined): ReportSection[] {
  if (!v) return REPORT_SECTION_KEYS;
  const wanted = new Set(v.split(","));
  const list = REPORT_SECTION_KEYS.filter((k) => wanted.has(k));
  return list.length ? list : REPORT_SECTION_KEYS;
}
