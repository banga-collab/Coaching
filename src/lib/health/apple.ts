/**
 * Import Apple Santé : fichier « export.zip » (ou « exportation.zip ») produit par
 * iPhone › Santé › photo de profil › Exporter toutes les données de santé.
 * Le XML peut peser plusieurs Go : il est lu en flux, morceau par morceau, sans jamais
 * être chargé entièrement en mémoire. Seules les balises <Record> utiles sont analysées.
 */
import { DayAggregator, type SleepPhase } from "./aggregate";
import { entryStream, listZip } from "./zip";
import type { DailyInput, HealthMetric } from "./types";

type Kind = { metric: HealthMetric; mode: "sum" | "avg" | "last" } | { metric: "sleep"; mode: "sleep" };

const TYPES: Record<string, Kind> = {
  HKQuantityTypeIdentifierStepCount: { metric: "steps", mode: "sum" },
  HKQuantityTypeIdentifierActiveEnergyBurned: { metric: "active_kcal", mode: "sum" },
  HKQuantityTypeIdentifierHeartRate: { metric: "hr_avg", mode: "avg" },
  HKQuantityTypeIdentifierRestingHeartRate: { metric: "hr_resting", mode: "avg" },
  HKQuantityTypeIdentifierVO2Max: { metric: "vo2max", mode: "last" },
  HKQuantityTypeIdentifierBodyMass: { metric: "weight", mode: "last" },
  HKCategoryTypeIdentifierSleepAnalysis: { metric: "sleep", mode: "sleep" },
};

const SLEEP: Record<string, SleepPhase> = {
  HKCategoryValueSleepAnalysisInBed: "in_bed",
  HKCategoryValueSleepAnalysisAsleep: "unspec",
  HKCategoryValueSleepAnalysisAsleepUnspecified: "unspec",
  HKCategoryValueSleepAnalysisAsleepCore: "light",
  HKCategoryValueSleepAnalysisAsleepDeep: "deep",
  HKCategoryValueSleepAnalysisAsleepREM: "rem",
  HKCategoryValueSleepAnalysisAwake: "awake",
};

function attr(s: string, name: string) {
  const i = s.indexOf(` ${name}="`);
  if (i < 0) return "";
  const from = i + name.length + 3;
  return s.slice(from, s.indexOf('"', from));
}

/** "2024-05-01 07:12:33 +0100" → millisecondes */
function appleTime(s: string) {
  const iso = s.length >= 25 ? `${s.slice(0, 10)}T${s.slice(11, 19)}${s.slice(20, 23)}:${s.slice(23, 25)}` : s.replace(" ", "T");
  return Date.parse(iso);
}

function handleRecord(a: string, agg: DayAggregator) {
  const t0 = a.indexOf(' type="');
  if (t0 < 0) return;
  const type = a.slice(t0 + 7, a.indexOf('"', t0 + 7));
  const kind = TYPES[type];
  if (!kind) return;
  const start = attr(a, "startDate");
  const day = start.slice(0, 10);
  if (kind.mode !== "sleep" && !agg.keep(day)) return;
  const device = attr(a, "sourceName") || "?";
  const raw = attr(a, "value");

  if (kind.mode === "sleep") {
    const end = attr(a, "endDate");
    const wakeDay = end.slice(0, 10);
    if (!agg.keep(wakeDay)) return;
    const phase = SLEEP[raw];
    if (!phase) return;
    const min = (appleTime(end) - appleTime(start)) / 60000;
    agg.addSleep(wakeDay, device, phase, min, start.slice(0, 16), end.slice(0, 16));
    return;
  }

  let v = Number(raw);
  if (!Number.isFinite(v)) return;
  const unit = attr(a, "unit");
  if (kind.metric === "active_kcal" && unit === "kJ") v /= 4.184;
  if (kind.metric === "weight") {
    if (unit === "lb") v *= 0.45359237;
    else if (unit === "g") v /= 1000;
    else if (unit === "st") v *= 6.35029;
  }
  if (kind.mode === "sum") agg.addSum(day, kind.metric, device, v);
  else if (kind.mode === "avg") agg.addAvg(day, kind.metric, v);
  else agg.addLast(day, kind.metric, v, start);
}

export type ImportProgress = (done: number, total: number) => void;

/** Analyse un export Apple Santé (.zip ou .xml) et renvoie une valeur par jour et par métrique. */
export async function parseAppleHealth(file: File, opts: { since: string; onProgress?: ImportProgress; signal?: AbortSignal }) {
  const agg = new DayAggregator(opts.since);
  let stream: ReadableStream<Uint8Array>;
  let total = file.size;
  const progress = opts.onProgress ?? (() => {});

  if (/\.zip$/i.test(file.name)) {
    const entries = await listZip(file);
    const xml = entries
      .filter((e) => /\.xml$/i.test(e.name) && !/cda/i.test(e.name) && !e.name.startsWith("__MACOSX"))
      .sort((a, b) => b.size - a.size)[0];
    if (!xml) throw new Error("Aucun fichier export.xml dans cette archive. Vérifiez qu'il s'agit bien de l'export Apple Santé.");
    total = xml.compSize;
    stream = await entryStream(file, xml, (n) => progress(n, total));
  } else {
    let read = 0;
    stream = (file.stream() as ReadableStream<Uint8Array>).pipeThrough(
      new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, ctrl) {
          read += chunk.byteLength;
          progress(read, total);
          ctrl.enqueue(chunk);
        },
      }),
    );
  }

  const reader = stream.pipeThrough(new TextDecoderStream() as unknown as TransformStream<Uint8Array, string>).getReader();
  let carry = "";
  let sawHealth = false;
  for (;;) {
    if (opts.signal?.aborted) {
      await reader.cancel();
      throw new Error("Import annulé.");
    }
    const { value, done } = await reader.read();
    if (done) break;
    let text = carry + value;
    // Coupe au dernier « < » si la balise n'est pas complète
    let cut = text.lastIndexOf("<");
    if (cut < 0 || text.indexOf(">", cut) !== -1) cut = text.length;
    carry = text.slice(cut);
    text = text.slice(0, cut);
    if (!sawHealth && text.includes("<HealthData")) sawHealth = true;
    let i = text.indexOf("<Record ");
    while (i !== -1) {
      const end = text.indexOf(">", i);
      if (end === -1) break;
      handleRecord(text.slice(i + 7, end), agg);
      i = text.indexOf("<Record ", end);
    }
  }
  if (!sawHealth) throw new Error("Ce fichier ne ressemble pas à un export Apple Santé (balise <HealthData> absente).");
  progress(total, total);
  return { samples: agg.result() as DailyInput[], records: agg.records };
}
