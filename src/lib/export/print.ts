/**
 * « PDF » : page HTML autonome et imprimable (A4), qui lance l'impression à l'ouverture.
 * L'utilisateur choisit « Enregistrer en PDF » dans la boîte d'impression du navigateur.
 * En-tête Moov'Up (logo, titre, exporté par, date, filtres), tableaux zébrés dont l'en-tête
 * se répète à chaque page (thead), pied de page avec numéros de page.
 */
import { BRAND, BRAND_COLOR, ACCENT_COLOR, byLine, cellText, esc, titleLine, type Cell, type ExportMeta } from "./common";

export interface PrintTable {
  title?: string;
  header: string[];
  rows: Cell[][];
  /** Texte si aucune ligne */
  empty?: string;
  /** Colonnes alignées à droite (sinon : détection des colonnes numériques) */
  right?: number[];
}

/** Tableau HTML échappé ; colonnes numériques alignées à droite. */
export function tableHtml(t: PrintTable) {
  const forced = t.right ? new Set(t.right) : null;
  const numeric = t.header.map((_, i) => {
    if (forced) return forced.has(i);
    let seen = false;
    for (const r of t.rows) {
      const v = r[i];
      if (v === null || v === undefined || v === "") continue;
      if (typeof v !== "number") return false;
      seen = true;
    }
    return seen;
  });
  const head = t.title ? `<h3 class="tt">${esc(t.title)}</h3>` : "";
  if (!t.rows.length) return `${head}<p class="empty">${esc(t.empty ?? "Aucune donnée pour ces critères.")}</p>`;
  const th = t.header.map((h, i) => `<th${numeric[i] ? ' class="n"' : ""}>${esc(h)}</th>`).join("");
  const body = t.rows
    .map((r) => `<tr>${t.header.map((_, i) => `<td${numeric[i] ? ' class="n"' : ""}>${esc(cellText(r[i]))}</td>`).join("")}</tr>`)
    .join("");
  return `${head}<table class="grid"><thead><tr>${th}</tr></thead><tbody>${body}</tbody></table>`;
}

/** Bloc d'en-tête Moov'Up (logo + titre + exporté par + filtres). */
export function headerHtml(meta: ExportMeta, logo: string, opts: { kicker?: string; heading?: string; lines?: string[] } = {}) {
  const filters = meta.filters?.length ? `<div class="chips">${meta.filters.map((f) => `<span>${esc(f)}</span>`).join("")}</div>` : "";
  const lines = (opts.lines ?? []).map((l) => `<p class="by">${esc(l)}</p>`).join("");
  return (
    `<header class="hd"><div class="hd-txt">` +
    `<p class="kicker">${esc(opts.kicker ?? BRAND)}</p>` +
    `<h1>${esc(opts.heading ?? titleLine(meta))}</h1>` +
    lines +
    `<p class="by">${esc(byLine(meta))}</p>${filters}</div>` +
    (logo ? `<img class="logo" src="${esc(logo)}" alt="${esc(BRAND)}">` : "") +
    `</header>`
  );
}

const CSS = `
*{box-sizing:border-box}
html,body{margin:0;background:#f1f5f9;color:#0f172a;font:12px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.bar{position:sticky;top:0;z-index:5;display:flex;gap:8px;align-items:center;justify-content:space-between;padding:10px 16px;background:#0f172a;color:#fff;font-size:13px}
.bar button{border:0;border-radius:8px;padding:8px 14px;font:600 13px system-ui,sans-serif;cursor:pointer;background:${ACCENT_COLOR};color:#fff}
.bar button.ghost{background:transparent;color:#cbd5e1;border:1px solid #334155}
.page{max-width:1100px;margin:16px auto;padding:28px 32px;background:#fff;border-radius:12px;box-shadow:0 1px 3px rgba(15,23,42,.08)}
.hd{display:flex;justify-content:space-between;align-items:flex-start;gap:24px;padding-bottom:14px;margin-bottom:16px;border-bottom:3px solid ${ACCENT_COLOR}}
.hd h1{margin:2px 0 4px;font-size:20px;line-height:1.2;color:${BRAND_COLOR}}
.kicker{margin:0;font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:${ACCENT_COLOR}}
.by{margin:1px 0;color:#64748b;font-size:11px}
.logo{width:150px;height:auto;flex-shrink:0;object-fit:contain}
.chips{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px}
.chips span{border:1px solid #cbd5e1;border-radius:999px;padding:1px 8px;font-size:10px;color:#334155;background:#f8fafc}
h2{font-size:15px;color:${BRAND_COLOR};margin:18px 0 8px}
.tt{font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:${BRAND_COLOR};margin:16px 0 6px}
table.grid{width:100%;border-collapse:collapse;font-size:10.5px}
table.grid th{background:${BRAND_COLOR};color:#fff;text-align:left;font-weight:600;padding:5px 6px;border:1px solid ${BRAND_COLOR}}
table.grid td{padding:4px 6px;border:1px solid #e2e8f0;vertical-align:top;word-break:break-word}
table.grid tbody tr:nth-child(even) td{background:#f1f5f9}
table.grid .n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
thead{display:table-header-group}
tr{break-inside:avoid;page-break-inside:avoid}
.empty{color:#64748b;font-style:italic;margin:6px 0}
.count{margin:10px 0 0;color:#64748b;font-size:10px}
.ft{margin-top:18px;padding-top:8px;border-top:1px solid #e2e8f0;color:#94a3b8;font-size:9.5px;display:flex;justify-content:space-between;gap:12px}
.break{break-before:page;page-break-before:always}
@media print{
  html,body{background:#fff}
  .bar{display:none}
  .page{max-width:none;margin:0;padding:0;border-radius:0;box-shadow:none}
}
`;

/**
 * Page complète. `docTitle` devient le nom proposé par « Enregistrer en PDF ».
 * `body` est du HTML déjà échappé (utiliser tableHtml / headerHtml / esc).
 */
export function printPage({ docTitle, meta, body, landscape = false, extraCss = "" }: { docTitle: string; meta: ExportMeta; body: string; landscape?: boolean; extraCss?: string }) {
  const footer = `${BRAND} — ${meta.title}`;
  const page =
    `@page{size:A4 ${landscape ? "landscape" : "portrait"};margin:12mm 10mm 14mm;` +
    `@bottom-left{content:${JSON.stringify(footer)};font:9px system-ui,sans-serif;color:#94a3b8}` +
    `@bottom-right{content:"Page " counter(page) " / " counter(pages);font:9px system-ui,sans-serif;color:#94a3b8}}`;
  return (
    `<!doctype html><html lang="fr"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<meta name="robots" content="noindex">` +
    `<title>${esc(docTitle)}</title>` +
    `<style>${page}${CSS}${extraCss}</style></head><body>` +
    `<div class="bar"><span>${esc(footer)}</span><span>` +
    `<button type="button" class="ghost" onclick="window.close()">Fermer</button> ` +
    `<button type="button" onclick="window.print()">Imprimer / Enregistrer en PDF</button></span></div>` +
    `<main class="page">${body}` +
    `<footer class="ft"><span>${esc(footer)}</span><span>${esc(byLine(meta))}</span></footer></main>` +
    `<script>window.addEventListener("load",function(){setTimeout(function(){window.print()},350)})</script>` +
    `</body></html>`
  );
}

/** Export tabulaire simple : en-tête + un tableau. */
export function buildPrintHtml({ docTitle, meta, logo, header, rows }: { docTitle: string; meta: ExportMeta; logo: string; header: string[]; rows: Cell[][] }) {
  const body =
    headerHtml(meta, logo) +
    tableHtml({ header, rows }) +
    `<p class="count">${rows.length} ligne${rows.length > 1 ? "s" : ""}</p>`;
  return printPage({ docTitle, meta, body, landscape: header.length > 7 });
}
