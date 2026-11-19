/** CSV « ; » avec BOM (ouvre correctement les accents dans Excel), précédé de l'en-tête Moov'Up. */
import { byLine, titleLine, type Cell, type ExportMeta } from "./common";

const nf = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2, useGrouping: false });

export function csvCell(v: Cell) {
  if (v === null || v === undefined) return "";
  const s = typeof v === "number" ? (Number.isFinite(v) ? nf.format(v) : "") : typeof v === "boolean" ? (v ? "Oui" : "Non") : String(v);
  return /[";\r\n]/.test(s) || (typeof v === "string" && /^[=+\-@]/.test(s)) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function buildCsv(meta: ExportMeta, header: string[], rows: Cell[][]) {
  const second = meta.filters?.length ? `${byLine(meta)} · Filtres : ${meta.filters.join(" · ")}` : byLine(meta);
  const lines = [[titleLine(meta)], [second], [], header, ...rows];
  return "\uFEFF" + lines.map((r) => r.map(csvCell).join(";")).join("\r\n") + "\r\n";
}
