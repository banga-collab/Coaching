/**
 * Import des exports Android : Samsung Health (« Télécharger les données personnelles » →
 * dossier de fichiers CSV com.samsung.…), Health Connect via une appli d'export (CSV / JSON),
 * ou tout tableau simple (une ligne par jour : date, pas, sommeil, FC…).
 * Formats reconnus automatiquement d'après les noms de colonnes.
 */
import { DayAggregator, type SleepPhase } from "./aggregate";
import { entryText, listZip } from "./zip";
import type { DailyInput, HealthMetric, HealthSource } from "./types";

/* ---------------- CSV ---------------- */

export function parseCsv(text: string): string[][] {
  const first = text.slice(0, 2000).split(/\r?\n/)[0] ?? "";
  const sep = (first.match(/;/g)?.length ?? 0) > (first.match(/,/g)?.length ?? 0) ? ";" : first.includes("\t") && !first.includes(",") ? "\t" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (q) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else q = false;
      } else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === sep) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

/** "com.samsung.health.heart_rate.start_time" → "start_time" ; "Steps (count)" → "steps_count" */
function normHeader(h: string) {
  let s = h.trim().toLowerCase().replace(/^﻿/, "");
  if (s.startsWith("com.samsung")) s = s.slice(s.lastIndexOf(".") + 1);
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

const pad = (n: number) => String(n).padStart(2, "0");
const fmtLocal = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
const fmtUtc = (d: Date) => d.toISOString().slice(0, 16).replace("T", " ");

/** Décalage "UTC+0100" / "+01:00" → minutes */
function offsetMin(s: string | undefined) {
  const m = s?.match(/([+-])(\d{1,2}):?(\d{2})?/);
  if (!m) return null;
  return (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] ?? 0));
}

/**
 * Horodatage quelconque → "AAAA-MM-JJ HH:MM" en heure locale + millisecondes.
 * `utcDate` : la valeur est un jour à minuit UTC (résumés quotidiens Samsung « day_time »).
 */
export function readTime(raw: unknown, offset?: string, utcDate = false): { local: string; ms: number } | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const s = String(raw).trim();
  let ms: number;
  if (/^\d{9,13}(\.\d+)?$/.test(s)) {
    const n = Number(s);
    ms = n > 1e11 ? n : n * 1000;
    const d = new Date(ms);
    if (utcDate) return { local: fmtUtc(d), ms };
  } else {
    const fr = s.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})(?:[ T](\d{1,2}):(\d{2}))?/);
    if (fr) {
      const local = `${fr[3]}-${pad(+fr[2]!)}-${pad(+fr[1]!)} ${pad(+(fr[4] ?? 0))}:${fr[5] ?? "00"}`;
      return { local, ms: Date.parse(local.replace(" ", "T")) };
    }
    const iso = s.match(/^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2})(?::\d{2}(?:\.\d+)?)?)?\s*(Z|[+-]\d{2}:?\d{2})?$/);
    if (!iso) {
      const p = Date.parse(s);
      if (!Number.isFinite(p)) return null;
      return { local: fmtLocal(new Date(p)), ms: p };
    }
    if (!iso[2]) return { local: `${iso[1]} 00:00`, ms: Date.parse(`${iso[1]}T00:00:00Z`) };
    if (!iso[3] && offset === undefined) {
      // Heure locale sans fuseau : on la garde telle quelle
      const local = `${iso[1]} ${iso[2]}`;
      return { local, ms: Date.parse(`${iso[1]}T${iso[2]}:00Z`) };
    }
    ms = Date.parse(`${iso[1]}T${iso[2]}:00${iso[3] ? (iso[3] === "Z" ? "Z" : iso[3].replace(/(\d{2})(\d{2})$/, "$1:$2")) : "Z"}`);
  }
  if (!Number.isFinite(ms)) return null;
  const off = offsetMin(offset);
  if (off !== null) return { local: fmtUtc(new Date(ms + off * 60000)), ms };
  return { local: fmtLocal(new Date(ms)), ms };
}

const num = (v: unknown) => {
  if (typeof v === "number") return v;
  const s = String(v ?? "").replace(/[\s\u00a0\u202f]/g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) && s !== "" ? n : NaN;
};

/* Colonnes reconnues (noms normalisés) */
const DATE_COLS = ["day_time", "date", "day", "jour", "start_time", "starttime", "start_date", "startdate", "start", "time", "timestamp", "datetime", "date_time", "create_time"];
const COLS: Record<Exclude<HealthMetric, "sleep">, string[]> = {
  steps: ["steps", "step_count", "stepcount", "total_steps", "pas", "nombre_de_pas", "steps_count", "count_steps"],
  hr_resting: ["resting_heart_rate", "resting_hr", "rhr", "fc_repos", "resting_bpm", "restingheartrate", "heart_rate_resting"],
  hr_avg: ["heart_rate", "heartrate", "avg_heart_rate", "average_heart_rate", "heart_rate_avg", "hr", "hr_avg", "bpm", "fc", "fc_moyenne", "beats_per_minute", "beatsperminute"],
  active_kcal: ["active_calorie", "active_calories", "active_kcal", "active_energy", "active_energy_burned", "calories_actives", "activecaloriesburned", "active_calories_burned"],
  vo2max: ["vo2max", "vo2_max", "vo2", "vo2_max_ml_kg_min"],
  weight: ["weight", "weight_kg", "poids", "body_mass", "bodymass", "masse"],
};
const SLEEP_COLS = ["sleep", "sleep_minutes", "sleep_min", "sleep_duration", "sleep_hours", "sleep_h", "sommeil", "total_sleep", "asleep", "sleep_time", "duree_sommeil"];

/** Nom de type libre ("StepsRecord", "resting heart rate", "sommeil") → métrique */
export function metricFromName(name: string): HealthMetric | null {
  const s = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!s) return null;
  if (/sleep|sommeil/.test(s)) return "sleep";
  if (/resting|repos|^rhr/.test(s)) return "hr_resting";
  if (/vo2/.test(s)) return "vo2max";
  if (/heartrate|^hr$|^bpm|^fc|frequencecardiaque|^heart$/.test(s)) return "hr_avg";
  if (/activecalor|activeenergy|activekcal|caloriesactives/.test(s)) return "active_kcal";
  if (/weight|bodymass|poids/.test(s)) return "weight";
  if (/step|^pas$|nombredepas/.test(s)) return "steps";
  return null;
}

/** Valeur de sommeil : minutes si la colonne le dit ou si > 24, sinon heures ; accepte "7:30" / "7h30". */
function sleepMinutes(raw: unknown, header = "") {
  const s = String(raw ?? "").trim();
  const hm = s.match(/^(\d{1,2})\s*[h:]\s*(\d{1,2})?\s*(?:min)?$/i);
  if (hm) return Number(hm[1]) * 60 + Number(hm[2] ?? 0);
  const n = num(s);
  if (!Number.isFinite(n)) return NaN;
  if (/min/.test(header)) return n;
  if (/hour|heure|_h$/.test(header)) return n * 60;
  if (/ms$|millis/.test(header)) return n / 60000;
  return n > 24 ? n : n * 60;
}

/* Phases de sommeil : codes Samsung (40001…) et Health Connect (1…7) */
const SAMSUNG_STAGE: Record<string, SleepPhase> = { "40001": "awake", "40002": "light", "40003": "deep", "40004": "rem" };
const HC_STAGE: Record<string, SleepPhase> = { "1": "awake", "2": "unspec", "3": "awake", "4": "light", "5": "deep", "6": "rem", "7": "awake" };
function stagePhase(v: unknown): SleepPhase | null {
  const s = String(v ?? "").trim().toLowerCase();
  if (SAMSUNG_STAGE[s]) return SAMSUNG_STAGE[s]!;
  if (HC_STAGE[s]) return HC_STAGE[s]!;
  if (/deep|profond/.test(s)) return "deep";
  if (/rem|paradox/.test(s)) return "rem";
  if (/light|core|leger/.test(s)) return "light";
  if (/awake|eveil|out_of_bed|wake/.test(s)) return "awake";
  if (/sleep|asleep|sommeil/.test(s)) return "unspec";
  return null;
}

/** Un fichier CSV → données ajoutées à l'agrégateur. Renvoie true si quelque chose a été reconnu. */
function ingestCsv(name: string, text: string, agg: DayAggregator): boolean {
  let rows = parseCsv(text);
  // Samsung : 1re ligne = métadonnées "com.samsung.shealth.xxx,6313005,3"
  if (rows[0]?.[0]?.trim().toLowerCase().startsWith("com.samsung") && (rows[0]?.length ?? 0) <= 4) rows = rows.slice(1);
  if (rows.length < 2) return false;
  const headers = rows[0]!.map(normHeader);
  const col = (names: string[]) => {
    for (const n of names) {
      const i = headers.indexOf(n);
      if (i >= 0) return i;
    }
    return -1;
  };
  const file = name.toLowerCase();
  const offCol = col(["time_offset", "timezone", "zone_offset", "offset"]);
  const devCol = col(["deviceuuid", "device", "source", "source_name", "pkg_name", "datauuid_device"]);
  const startCol = col(["start_time", "starttime", "start_date", "startdate", "start", "debut"]);
  const endCol = col(["end_time", "endtime", "end_date", "enddate", "end", "fin"]);
  const stageCol = col(["stage", "sleep_stage", "phase"]);
  const dayCol = col(DATE_COLS);
  const body = rows.slice(1);
  const off = (r: string[]) => (offCol >= 0 ? r[offCol] : undefined);
  const dev = (r: string[]) => (devCol >= 0 ? r[devCol] || "?" : "?");
  let found = false;

  // 1. Phases de sommeil (Samsung sleep_stage, Health Connect stages)
  if (stageCol >= 0 && startCol >= 0 && endCol >= 0) {
    for (const r of body) {
      const a = readTime(r[startCol], off(r));
      const b = readTime(r[endCol], off(r));
      const phase = stagePhase(r[stageCol]);
      if (!a || !b || !phase) continue;
      agg.addSleep(b.local.slice(0, 10), dev(r), phase, (b.ms - a.ms) / 60000, a.local, b.local);
      found = true;
    }
    return found;
  }

  // 2. Sessions de sommeil (début / fin)
  if (/sleep|sommeil/.test(file) && startCol >= 0 && endCol >= 0) {
    for (const r of body) {
      const a = readTime(r[startCol], off(r));
      const b = readTime(r[endCol], off(r));
      if (!a || !b) continue;
      agg.addSleep(b.local.slice(0, 10), dev(r), "unspec", (b.ms - a.ms) / 60000, a.local, b.local);
      found = true;
    }
    return found;
  }

  if (dayCol < 0) return false;
  const dailyFile = headers[dayCol] === "day_time" || headers[dayCol] === "date" || headers[dayCol] === "day" || headers[dayCol] === "jour";

  // 3. Format « long » : une colonne type + une colonne valeur
  const typeCol = col(["type", "metric", "data_type", "datatype", "record_type", "recordtype", "mesure", "categorie"]);
  const valCol = col(["value", "valeur", "qty", "quantity", "amount", "count", "val"]);
  if (typeCol >= 0 && valCol >= 0) {
    for (const r of body) {
      const metric = metricFromName(r[typeCol] ?? "");
      const t = readTime(r[dayCol], off(r), headers[dayCol] === "day_time");
      if (!metric || !t) continue;
      const day = t.local.slice(0, 10);
      if (metric === "sleep") {
        const m = sleepMinutes(r[valCol], headers[valCol]);
        if (Number.isFinite(m)) agg.addSleep(day, dev(r), "unspec", m, "", "");
      } else addValue(agg, metric, day, num(r[valCol]), dev(r), t.local, dailyFile);
      found = true;
    }
    return found;
  }

  // 4. Format « large » : une colonne par métrique (Samsung pedometer_day_summary, heart_rate, weight…)
  const metricCols: [HealthMetric, number][] = [];
  for (const m of Object.keys(COLS) as Exclude<HealthMetric, "sleep">[]) {
    const i = col(COLS[m]);
    if (i >= 0 && i !== dayCol) metricCols.push([m, i]);
  }
  // Samsung step_daily_trend : colonne "count"
  if (/step/.test(file) && !metricCols.some(([m]) => m === "steps")) {
    const i = col(["count"]);
    if (i >= 0) metricCols.push(["steps", i]);
  }
  let sleepCol = col(SLEEP_COLS);
  if (sleepCol < 0) sleepCol = headers.findIndex((h) => /^(sleep|sommeil)(_(h|hours?|heures?|min|minutes?|duration|duree|total|time))+$/.test(h));
  if (!metricCols.length && sleepCol < 0) return false;
  for (const r of body) {
    const t = readTime(r[dayCol], off(r), headers[dayCol] === "day_time");
    if (!t) continue;
    const day = t.local.slice(0, 10);
    for (const [m, i] of metricCols) {
      const v = num(r[i]);
      if (Number.isFinite(v) && v > 0) {
        addValue(agg, m, day, v, dev(r), t.local, dailyFile);
        found = true;
      }
    }
    if (sleepCol >= 0) {
      const m = sleepMinutes(r[sleepCol], headers[sleepCol]);
      if (Number.isFinite(m) && m > 0) {
        agg.addSleep(day, dev(r), "unspec", m, "", "");
        found = true;
      }
    }
  }
  return found;
}

function addValue(agg: DayAggregator, metric: HealthMetric, day: string, v: number, device: string, t: string, daily: boolean) {
  if (!Number.isFinite(v)) return;
  if (metric === "steps" || metric === "active_kcal") {
    if (daily) agg.addMax(day, metric, device, v);
    else agg.addSum(day, metric, device, v);
  } else if (metric === "hr_avg" || metric === "hr_resting") agg.addAvg(day, metric, v);
  else if (metric === "weight" || metric === "vo2max") agg.addLast(day, metric, v, t);
}

/* ---------------- JSON (Health Connect & co) ---------------- */

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const pick = (o: Obj, ...keys: string[]) => {
  for (const k of keys) if (o[k] !== undefined && o[k] !== null) return o[k];
  return undefined;
};

function jsonValue(o: Obj, metric: HealthMetric): number {
  const energy = pick(o, "energy", "activeCalories", "calories");
  const weight = o.weight;
  switch (metric) {
    case "steps":
      return num(pick(o, "count", "steps", "stepCount", "value"));
    case "hr_avg":
    case "hr_resting":
      return num(pick(o, "beatsPerMinute", "bpm", "heartRate", "value", "avg"));
    case "active_kcal":
      if (isObj(energy)) {
        const k = pick(energy, "inKilocalories", "kilocalories", "kcal");
        if (k !== undefined) return num(k);
        const c = pick(energy, "inCalories", "calories");
        if (c !== undefined) return num(c) / 1000;
      }
      return num(pick(o, "kcal", "kilocalories", "energy", "calories", "value"));
    case "vo2max":
      return num(pick(o, "vo2MillilitersPerMinuteKilogram", "vo2max", "value"));
    case "weight":
      if (isObj(weight)) {
        const kg = pick(weight, "inKilograms", "kilograms", "kg");
        if (kg !== undefined) return num(kg);
        const g = pick(weight, "inGrams", "grams");
        if (g !== undefined) return num(g) / 1000;
      }
      return num(pick(o, "weight", "kg", "value"));
    default:
      return NaN;
  }
}

function ingestJsonNode(node: unknown, hint: string, agg: DayAggregator, depth = 0): boolean {
  if (depth > 8) return false;
  if (Array.isArray(node)) {
    let f = false;
    for (const el of node) f = ingestJsonNode(el, hint, agg, depth + 1) || f;
    return f;
  }
  if (!isObj(node)) return false;
  const typeName = String(pick(node, "recordType", "record_type", "dataType", "data_type", "type", "metric") ?? hint);
  const metric = metricFromName(typeName);
  const zone = pick(node, "startZoneOffset", "zoneOffset", "time_offset", "zone_offset") as string | undefined;
  const startRaw = pick(node, "startTime", "start_time", "start", "startDate", "time", "date", "day", "timestamp");
  const t = readTime(isObj(startRaw) ? pick(startRaw, "epochMillis", "value") : startRaw, typeof zone === "string" ? zone : undefined);
  if (metric && t) {
    const day = t.local.slice(0, 10);
    const device = String(pick(node, "device", "dataOrigin", "source", "packageName") ?? "?").slice(0, 60);
    if (metric === "sleep") {
      const endRaw = pick(node, "endTime", "end_time", "end", "endDate");
      const e = readTime(endRaw, typeof zone === "string" ? zone : undefined);
      const stages = pick(node, "stages", "sleepStages");
      if (Array.isArray(stages) && stages.length) {
        for (const s of stages) {
          if (!isObj(s)) continue;
          const a = readTime(pick(s, "startTime", "start_time", "start"));
          const b = readTime(pick(s, "endTime", "end_time", "end"));
          const ph = stagePhase(pick(s, "stage", "type", "phase"));
          if (a && b && ph) agg.addSleep((e ?? b).local.slice(0, 10), device, ph, (b.ms - a.ms) / 60000, a.local, b.local);
        }
        return true;
      }
      if (e) {
        agg.addSleep(e.local.slice(0, 10), device, "unspec", (e.ms - t.ms) / 60000, t.local, e.local);
        return true;
      }
      const m = sleepMinutes(pick(node, "minutes", "duration", "value"), "min");
      if (Number.isFinite(m)) agg.addSleep(day, device, "unspec", m, "", "");
      return Number.isFinite(m);
    }
    const samples = node.samples;
    if (Array.isArray(samples) && (metric === "hr_avg" || metric === "hr_resting")) {
      for (const s of samples) {
        if (!isObj(s)) continue;
        const st = readTime(pick(s, "time", "startTime", "timestamp"), typeof zone === "string" ? zone : undefined) ?? t;
        agg.addAvg(st.local.slice(0, 10), metric, jsonValue(s, metric));
      }
      return true;
    }
    const v = jsonValue(node, metric);
    if (Number.isFinite(v)) {
      addValue(agg, metric, day, v, device, t.local, !/\d{2}:\d{2}/.test(String(startRaw)));
      return true;
    }
  }
  let f = false;
  for (const [k, v] of Object.entries(node)) if (typeof v === "object" && v !== null) f = ingestJsonNode(v, k, agg, depth + 1) || f;
  return f;
}

/* ---------------- Point d'entrée ---------------- */

export type TabularResult = { samples: DailyInput[]; records: number; source: HealthSource; recognized: string[]; ignored: string[] };

/** Fichiers CSV / JSON (ou ZIP qui en contient) → valeurs journalières. */
export async function parseTabularFiles(files: File[], opts: { since: string; onProgress?: (done: number, total: number) => void }): Promise<TabularResult> {
  const agg = new DayAggregator(opts.since);
  const recognized: string[] = [];
  const ignored: string[] = [];
  let samsung = false;
  const units: { name: string; text: () => Promise<string> }[] = [];
  for (const f of files) {
    if (/\.zip$/i.test(f.name)) {
      const entries = await listZip(f);
      if (entries.some((e) => /\.db$/i.test(e.name)) && !entries.some((e) => /\.(csv|json)$/i.test(e.name))) {
        throw new Error(
          "Cette archive Health Connect contient une base de données (.db) qui ne peut pas être lue dans le navigateur. Exportez plutôt vos données en CSV avec une application d'export, ou utilisez l'application mobile Moov'Up.",
        );
      }
      for (const e of entries) {
        if (/\.(csv|json)$/i.test(e.name) && !e.name.startsWith("__MACOSX")) units.push({ name: e.name, text: () => entryText(f, e) });
      }
    } else units.push({ name: f.name, text: () => f.text() });
  }
  let done = 0;
  for (const u of units) {
    const base = u.name.split("/").pop() ?? u.name;
    if (/samsung|shealth/i.test(base)) samsung = true;
    // Fichiers Samsung sans intérêt ici (amis, réglages, badges…) : ignorés sans les lire
    if (/samsung|shealth/i.test(base) && !/pedometer|step|heart_rate|sleep|weight|calories_burned|vo2/i.test(base)) {
      ignored.push(base);
    } else {
      const text = await u.text();
      let ok = false;
      if (/\.json$/i.test(base)) {
        try {
          ok = ingestJsonNode(JSON.parse(text), base.replace(/\.json$/i, ""), agg);
        } catch {
          ok = false;
        }
      } else ok = ingestCsv(base, text, agg);
      (ok ? recognized : ignored).push(base);
    }
    done++;
    opts.onProgress?.(done, units.length);
  }
  return { samples: agg.result(), records: agg.records, source: samsung ? "samsung_health" : "health_connect", recognized, ignored };
}
