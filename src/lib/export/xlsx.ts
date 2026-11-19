/**
 * Génération d'un vrai classeur Excel (.xlsx, Office Open XML) sans dépendance.
 * Chaque feuille commence par l'en-tête Moov'Up : titre, « Exporté par … le … », filtres,
 * ligne vide, puis l'en-tête de colonnes (gras, figé, filtre automatique) et les données.
 */
import { BRAND, byLine, type Cell, type ExportMeta } from "./common";
import { zip } from "./zip";

export interface SheetSpec {
  /** Nom de l'onglet (31 caractères max.) */
  name: string;
  /** Titre affiché en tête (défaut : meta.title) */
  title?: string;
  header: string[];
  rows: Cell[][];
}

// Index des styles (cellXfs)
const S_HEADER = 1;
const S_TITLE = 2;
const S_META = 3;

const NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const NS_R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

function xml(s: string) {
  return s
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g, "")
    .replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

export function colName(i: number) {
  let s = "";
  let n = i + 1;
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function strCell(ref: string, v: string, style = 0) {
  const t = xml(v.length > 32000 ? `${v.slice(0, 32000)}…` : v);
  return `<c r="${ref}" t="inlineStr"${style ? ` s="${style}"` : ""}><is><t xml:space="preserve">${t}</t></is></c>`;
}

function cell(ref: string, v: Cell, style = 0) {
  if (v === null || v === undefined || v === "") return "";
  if (typeof v === "number") return Number.isFinite(v) ? `<c r="${ref}"${style ? ` s="${style}"` : ""}><v>${v}</v></c>` : "";
  if (typeof v === "boolean") return strCell(ref, v ? "Oui" : "Non", style);
  return strCell(ref, String(v), style);
}

function safeSheetName(name: string, used: Set<string>) {
  const base = (name.replace(/[[\]:*?/\\]/g, " ").replace(/\s+/g, " ").trim() || "Feuille").slice(0, 31);
  let n = base;
  for (let i = 2; used.has(n.toLowerCase()); i++) n = `${base.slice(0, 28)} ${i}`;
  used.add(n.toLowerCase());
  return n;
}

function sheetXml(sheet: SheetSpec, meta: ExportMeta) {
  const cols = Math.max(1, sheet.header.length);
  const lines: string[] = [];
  const top: [string, number][] = [[`${BRAND} — ${sheet.title ?? meta.title}`, S_TITLE], [byLine(meta), S_META]];
  if (meta.filters?.length) top.push([`Filtres : ${meta.filters.join(" · ")}`, S_META]);

  let r = 0;
  for (const [text, style] of top) {
    r++;
    lines.push(`<row r="${r}"${style === S_TITLE ? ' ht="22" customHeight="1"' : ""}>${strCell(`A${r}`, text, style)}</row>`);
  }
  r++; // ligne vide
  r++;
  const headerRow = r;
  lines.push(`<row r="${r}" ht="20" customHeight="1">${sheet.header.map((h, i) => strCell(`${colName(i)}${r}`, h, S_HEADER)).join("")}</row>`);
  for (const row of sheet.rows) {
    r++;
    let cells = "";
    for (let i = 0; i < row.length; i++) cells += cell(`${colName(i)}${r}`, row[i]);
    lines.push(`<row r="${r}">${cells}</row>`);
  }
  const lastRow = Math.max(r, headerRow);
  const lastCol = colName(cols - 1);

  // Largeurs : longueur max. (en-tête + 300 premières lignes), bornée
  const widths = sheet.header.map((h, i) => {
    let w = h.length + 2;
    for (const row of sheet.rows.slice(0, 300)) {
      const v = row[i];
      const len = v === null || v === undefined ? 0 : typeof v === "number" ? String(v).length + 1 : typeof v === "boolean" ? 3 : String(v).length;
      if (len > w) w = len;
    }
    return Math.max(8, Math.min(48, w + 2));
  });

  return {
    headerRow,
    lastRow,
    lastCol,
    xml:
      XML +
      `<worksheet xmlns="${NS}" xmlns:r="${NS_R}">` +
      `<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>` +
      `<dimension ref="A1:${lastCol}${lastRow}"/>` +
      `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${headerRow}" topLeftCell="A${headerRow + 1}" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A${headerRow + 1}" sqref="A${headerRow + 1}"/></sheetView></sheetViews>` +
      `<sheetFormatPr defaultRowHeight="15"/>` +
      `<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols>` +
      `<sheetData>${lines.join("")}</sheetData>` +
      `<autoFilter ref="A${headerRow}:${lastCol}${lastRow}"/>` +
      `<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/>` +
      `<pageSetup paperSize="9" orientation="${cols > 7 ? "landscape" : "portrait"}" fitToWidth="1" fitToHeight="0"/>` +
      `</worksheet>`,
  };
}

const STYLES =
  XML +
  `<styleSheet xmlns="${NS}">` +
  `<fonts count="4">` +
  `<font><sz val="11"/><color rgb="FF0F172A"/><name val="Calibri"/><family val="2"/></font>` +
  `<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/></font>` +
  `<font><b/><sz val="14"/><color rgb="FF1A6D8E"/><name val="Calibri"/><family val="2"/></font>` +
  `<font><i/><sz val="10"/><color rgb="FF64748B"/><name val="Calibri"/><family val="2"/></font>` +
  `</fonts>` +
  `<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>` +
  `<fill><patternFill patternType="solid"><fgColor rgb="FF1A6D8E"/><bgColor indexed="64"/></patternFill></fill></fills>` +
  `<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>` +
  `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
  `<cellXfs count="4">` +
  `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>` +
  `<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center"/></xf>` +
  `<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>` +
  `<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>` +
  `</cellXfs>` +
  `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>` +
  `</styleSheet>`;

/** Construit le fichier .xlsx (octets) à partir d'une ou plusieurs feuilles. */
export function buildXlsx(sheets: SheetSpec[], meta: ExportMeta): Uint8Array {
  const used = new Set<string>();
  const list = (sheets.length ? sheets : [{ name: meta.title, header: [], rows: [] }]).map((s) => ({ ...s, name: safeSheetName(s.name, used) }));
  const built = list.map((s) => sheetXml(s, meta));
  const quote = (n: string) => `'${n.replace(/'/g, "''")}'`;
  const defined = list
    .map((s, i) => {
      const b = built[i]!;
      return (
        `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">${xml(quote(s.name))}!$A$${b.headerRow}:$${b.lastCol}$${b.lastRow}</definedName>` +
        `<definedName name="_xlnm.Print_Titles" localSheetId="${i}">${xml(quote(s.name))}!$${b.headerRow}:$${b.headerRow}</definedName>`
      );
    })
    .join("");

  const when = meta.date ?? new Date();
  const iso = when.toISOString().replace(/\.\d{3}Z$/, "Z");
  const files = [
    {
      name: "[Content_Types].xml",
      data:
        XML +
        `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
        `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
        `<Default Extension="xml" ContentType="application/xml"/>` +
        `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
        list.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("") +
        `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
        `<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>` +
        `</Types>`,
    },
    {
      name: "_rels/.rels",
      data:
        XML +
        `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        `<Relationship Id="rId1" Type="${NS_R}/officeDocument" Target="xl/workbook.xml"/>` +
        `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>` +
        `</Relationships>`,
    },
    {
      name: "docProps/core.xml",
      data:
        XML +
        `<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">` +
        `<dc:title>${xml(`${BRAND} — ${meta.title}`)}</dc:title><dc:creator>${xml(meta.user || BRAND)}</dc:creator>` +
        `<dcterms:created xsi:type="dcterms:W3CDTF">${iso}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${iso}</dcterms:modified>` +
        `</cp:coreProperties>`,
    },
    {
      name: "xl/workbook.xml",
      data:
        XML +
        `<workbook xmlns="${NS}" xmlns:r="${NS_R}"><bookViews><workbookView/></bookViews><sheets>` +
        list.map((s, i) => `<sheet name="${xml(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("") +
        `</sheets><definedNames>${defined}</definedNames></workbook>`,
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      data:
        XML +
        `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        list.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${NS_R}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("") +
        `<Relationship Id="rId${list.length + 1}" Type="${NS_R}/styles" Target="styles.xml"/>` +
        `</Relationships>`,
    },
    { name: "xl/styles.xml", data: STYLES },
    ...built.map((b, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: b.xml })),
  ];
  return zip(files, when);
}
