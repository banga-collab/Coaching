/**
 * Module d'export commun : Excel (.xlsx), PDF (page imprimable) et CSV, avec l'en-tête Moov'Up
 * (titre, qui a exporté, date à Agadir, filtres actifs).
 *
 *   return exportResponse({ format, title: "Clients", kind: "clients", user, filters, header, rows });
 */
import { NextResponse } from "next/server";
import { getSettings } from "@/lib/settings";
import { fileName, type Cell, type ExportFormat, type ExportMeta } from "./common";
import { buildCsv } from "./csv";
import { buildPrintHtml } from "./print";
import { buildXlsx, type SheetSpec } from "./xlsx";

export * from "./common";
export { buildCsv } from "./csv";
export { buildPrintHtml, headerHtml, printPage, tableHtml, type PrintTable } from "./print";
export { buildXlsx, type SheetSpec } from "./xlsx";

export const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** Logo de la salle (paramètres) ou logo par défaut */
export async function exportLogo() {
  const s = await getSettings();
  return s.logo_url || "/logo.png";
}

export function fileResponse(body: string | Uint8Array, type: string, name: string, inline = false) {
  const payload: BodyInit = typeof body === "string" ? body : new Blob([body as Uint8Array<ArrayBuffer>], { type });
  return new NextResponse(payload, {
    headers: {
      "Content-Type": type,
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${name}"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function exportResponse({
  format,
  title,
  kind,
  user,
  filters,
  header,
  rows,
  sheets,
}: {
  format: ExportFormat;
  title: string;
  kind: string;
  user: string;
  filters?: string[];
  header: string[];
  rows: Cell[][];
  /** Feuilles Excel supplémentaires (après la feuille principale) */
  sheets?: SheetSpec[];
}) {
  const date = new Date();
  const meta: ExportMeta = { title, user, date, filters };
  if (format === "xlsx") {
    const bytes = buildXlsx([{ name: title, header, rows }, ...(sheets ?? [])], meta);
    return fileResponse(bytes, XLSX_TYPE, fileName(kind, "xlsx", date));
  }
  if (format === "pdf") {
    const name = fileName(kind, "pdf", date).replace(/\.pdf$/, "");
    const html = buildPrintHtml({ docTitle: name, meta, logo: await exportLogo(), header, rows });
    return fileResponse(html, "text/html; charset=utf-8", `${name}.html`, true);
  }
  return fileResponse(buildCsv(meta, header, rows), "text/csv; charset=utf-8", fileName(kind, "csv", date));
}
