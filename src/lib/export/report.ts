/**
 * Rapports clients (un client, une sélection ou tous) sur une période :
 * chargement des données (requêtes groupées + Map, pas de O(n²)), page PDF imprimable et classeur Excel.
 */
import type { ClassBooking, Client, ClientStatus, GroupClass, HealthCheck, Measurement, Profile, Session } from "@/lib/types";
import { agadirToIso, dayKey, fmtDate, fmtTime, num, SESSION_LABEL, signed, STATUS_LABEL } from "@/lib/utils";
import { esc, type Cell, type ExportMeta } from "./common";
import { headerHtml, printPage, tableHtml } from "./print";
import { buildXlsx, type SheetSpec } from "./xlsx";
import { REPORT_SECTIONS, type ReportSection } from "./report-sections";
import { BUSY_STATUSES } from "@/lib/planning";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Db = { from: (table: string) => any };

const MAX = 20000;
const CHECK_LABEL: Record<HealthCheck["kind"], string> = { initial: "Initial", mensuel: "Mensuel", hebdo: "Hebdomadaire" };

export interface ReportParams {
  /** Identifiants des clients, ou "all" */
  clients: string[] | "all";
  /** Filtre de statut quand clients = "all" */
  statut?: ClientStatus | null;
  from: string;
  to: string;
  sections: ReportSection[];
}

interface Evolution {
  label: string;
  unit: string;
  first: number;
  firstDate: string;
  last: number;
  lastDate: string;
  delta: number;
}

export interface ClientReport {
  client: Client;
  coach: string | null;
  meas: Measurement[];
  evolution: Evolution[];
  checks: HealthCheck[];
  lastCheck: HealthCheck | null;
  sessions: Session[];
  checkins: number;
  classPresent: number;
  classAbsent: number;
  stats: { done: number; absent: number; cancelled: number; planned: number; rate: number | null };
}

export interface ReportData {
  params: ReportParams;
  reports: ClientReport[];
}

/* ---------- Dates ---------- */
const addDay = (key: string, k: number) => {
  const x = new Date(`${key}T12:00:00Z`);
  x.setUTCDate(x.getUTCDate() + k);
  return x.toISOString().slice(0, 10);
};
const isoStart = (day: string) => agadirToIso(day, "00:00");
const isoEnd = (day: string) => agadirToIso(addDay(day, 1), "00:00");
const dd = (v: string | null | undefined) => (v ? fmtDate(v.length === 10 ? `${v}T12:00:00Z` : v, { day: "2-digit", month: "2-digit", year: "numeric" }) : "");
const monthLabel = (key: string) => fmtDate(`${key}-15T12:00:00Z`, { month: "long", year: "numeric" });
const pct = (v: number | null) => (v === null ? "–" : `${v} %`);

function group<T extends { client_id: string }>(rows: T[], keep: Set<string> | null) {
  const m = new Map<string, T[]>();
  for (const r of rows) {
    if (keep && !keep.has(r.client_id)) continue;
    const arr = m.get(r.client_id);
    if (arr) arr.push(r);
    else m.set(r.client_id, [r]);
  }
  return m;
}

/** Requête sur une liste de clients : tout d'un coup si « tous », sinon par paquets de 200 identifiants */
async function byClients<T>(ids: string[] | null, build: () => any, col = "client_id"): Promise<T[]> {
  if (!ids) {
    const { data } = await build().limit(MAX);
    return (data ?? []) as T[];
  }
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await build().in(col, ids.slice(i, i + 200)).limit(MAX);
    out.push(...((data ?? []) as T[]));
  }
  return out;
}

const METRICS: [keyof Measurement, string, string][] = [
  ["weight_kg", "Poids", "kg"],
  ["body_fat", "Masse grasse", "%"],
  ["muscle_kg", "Masse musculaire", "kg"],
  ["waist_cm", "Tour de taille", "cm"],
  ["hips_cm", "Hanches", "cm"],
  ["squat_kg", "Squat", "kg"],
  ["bench_kg", "Développé couché", "kg"],
  ["deadlift_kg", "Soulevé de terre", "kg"],
];

function evolution(meas: Measurement[]): Evolution[] {
  const out: Evolution[] = [];
  for (const [k, label, unit] of METRICS) {
    let first: Measurement | null = null;
    let last: Measurement | null = null;
    for (const m of meas) {
      if (m[k] === null || m[k] === undefined) continue;
      if (!first) first = m;
      last = m;
    }
    if (!first || !last) continue;
    const a = Number(first[k]);
    const b = Number(last[k]);
    out.push({ label, unit, first: a, firstDate: first.measured_on, last: b, lastDate: last.measured_on, delta: Math.round((b - a) * 10) / 10 });
  }
  return out;
}

export async function loadReport(supabase: Db, params: ReportParams): Promise<ReportData> {
  const want = new Set(params.sections);
  const all = params.clients === "all";

  // Clients
  let clients: Client[];
  if (all) {
    let q = supabase.from("clients").select("*");
    if (params.statut) q = q.eq("status", params.statut);
    const { data } = await q.order("full_name").limit(MAX);
    clients = (data ?? []) as Client[];
  } else {
    clients = await byClients<Client>(params.clients as string[], () => supabase.from("clients").select("*"), "id");
    clients.sort((a, b) => a.full_name.localeCompare(b.full_name, "fr"));
  }
  const ids = clients.map((c) => c.id);
  const keep = new Set(ids);
  const scope = all && !params.statut ? null : ids; // null = pas de filtre client dans les requêtes
  if (!ids.length) return { params, reports: [] };

  const start = isoStart(params.from);
  const end = isoEnd(params.to);
  const needSessions = want.has("seances") || want.has("presence");

  const [people, meas, checks, sessions, checkins, classes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, email")
      .then(({ data }: { data: unknown }) => new Map(((data ?? []) as Pick<Profile, "id" | "full_name" | "email">[]).map((p) => [p.id, p.full_name || p.email]))),
    want.has("progression")
      ? byClients<Measurement>(scope, () => supabase.from("measurements").select("*").gte("measured_on", params.from).lte("measured_on", params.to).order("measured_on"))
      : Promise.resolve([]),
    want.has("sante") ? byClients<HealthCheck>(scope, () => supabase.from("health_checks").select("*").lte("checked_on", params.to).order("checked_on")) : Promise.resolve([]),
    needSessions ? byClients<Session>(scope, () => supabase.from("sessions").select("*").gte("starts_at", start).lt("starts_at", end).order("starts_at")) : Promise.resolve([]),
    want.has("presence")
      ? byClients<{ client_id: string }>(scope, () => supabase.from("gym_checkins").select("client_id").gte("checked_at", start).lt("checked_at", end)).catch(() => [])
      : Promise.resolve([]),
    want.has("presence")
      ? Promise.resolve(supabase.from("group_classes").select("id").gte("starts_at", start).lt("starts_at", end).limit(MAX)).then(({ data }: { data: unknown }) => (data ?? []) as Pick<GroupClass, "id">[])
      : Promise.resolve([] as Pick<GroupClass, "id">[]),
  ]);

  // Réservations de cours collectifs de la période (par paquets d'identifiants de cours)
  const bookings: Pick<ClassBooking, "client_id" | "status">[] = [];
  const classIds = classes.map((c) => c.id);
  for (let i = 0; i < classIds.length; i += 200) {
    const { data } = await supabase.from("class_bookings").select("client_id, status").in("class_id", classIds.slice(i, i + 200)).limit(MAX);
    bookings.push(...((data ?? []) as Pick<ClassBooking, "client_id" | "status">[]));
  }

  const measBy = group(meas, keep);
  const checkBy = group(checks, keep);
  const sessBy = group(sessions, keep);
  const checkinN = new Map<string, number>();
  for (const c of checkins) if (keep.has(c.client_id)) checkinN.set(c.client_id, (checkinN.get(c.client_id) ?? 0) + 1);
  const classN = new Map<string, { present: number; absent: number }>();
  for (const b of bookings) {
    if (!keep.has(b.client_id) || (b.status !== "present" && b.status !== "absent")) continue;
    const s = classN.get(b.client_id) ?? { present: 0, absent: 0 };
    s[b.status]++;
    classN.set(b.client_id, s);
  }

  const reports = clients.map((client): ClientReport => {
    const m = measBy.get(client.id) ?? [];
    const allChecks = checkBy.get(client.id) ?? [];
    const s = sessBy.get(client.id) ?? [];
    let done = 0, absent = 0, cancelled = 0, planned = 0;
    for (const x of s) {
      if (x.status === "realisee") done++;
      else if (x.status === "absent") absent++;
      else if (x.status === "annulee") cancelled++;
      else if (BUSY_STATUSES.includes(x.status)) planned++;
    }
    const cl = classN.get(client.id);
    return {
      client,
      coach: people.get(client.coach_id) ?? null,
      meas: m,
      evolution: evolution(m),
      checks: allChecks.filter((h) => h.checked_on >= params.from),
      lastCheck: allChecks.at(-1) ?? null,
      sessions: s,
      checkins: checkinN.get(client.id) ?? 0,
      classPresent: cl?.present ?? 0,
      classAbsent: cl?.absent ?? 0,
      stats: { done, absent, cancelled, planned, rate: done + absent ? Math.round((done / (done + absent)) * 100) : null },
    };
  });
  return { params, reports };
}

/* ---------- Libellés communs ---------- */
export function reportMeta(data: ReportData, user: string, statutLabel?: string): ExportMeta {
  const { params, reports } = data;
  const filters = [`Période : du ${dd(params.from)} au ${dd(params.to)}`];
  if (params.clients === "all") filters.push(statutLabel ? `Tous les clients (${statutLabel.toLowerCase()})` : "Tous les clients");
  else if (reports.length === 1) filters.push(`Client : ${reports[0]!.client.full_name}`);
  else filters.push(`Sélection : ${reports.length} clients`);
  if (params.sections.length < REPORT_SECTIONS.length) filters.push(`Sections : ${REPORT_SECTIONS.filter((s) => params.sections.includes(s.key)).map((s) => s.label).join(", ")}`);
  return {
    title: reports.length === 1 ? `Rapport client — ${reports[0]!.client.full_name}` : "Rapports clients",
    user,
    date: new Date(),
    filters,
  };
}

/* ---------- PDF (page imprimable) ---------- */
const EXTRA_CSS = `
.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:4px 0 6px}
.kpi{border:1px solid #e2e8f0;border-radius:10px;padding:8px 10px;background:#f8fafc;break-inside:avoid}
.kpi b{display:block;font-size:17px;line-height:1.2;color:#1a6d8e;font-variant-numeric:tabular-nums}
.kpi span{font-size:10px;color:#64748b}
.kpi.accent b{color:#e8782a}
.dl{display:grid;grid-template-columns:repeat(3,1fr);gap:4px 16px;margin:4px 0 8px;font-size:11px}
.dl div{border-bottom:1px dashed #e2e8f0;padding:3px 0;display:flex;justify-content:space-between;gap:8px}
.dl dt{color:#64748b}
.dl dd{margin:0;font-weight:600;text-align:right}
.note{margin:6px 0;padding:6px 10px;border-left:3px solid #e8782a;background:#fff7ed;font-size:11px}
.up{color:#047857}.down{color:#b91c1c}
section.client h2{border-bottom:1px solid #e2e8f0;padding-bottom:3px}
.totals{margin:6px 0 0;text-align:right;font-weight:600;font-size:11px}
`;

function kpis(items: [string, string, boolean?][]) {
  return `<div class="kpis">${items.map(([label, value, accent]) => `<div class="kpi${accent ? " accent" : ""}"><b>${esc(value)}</b><span>${esc(label)}</span></div>`).join("")}</div>`;
}

function clientSection(r: ClientReport, meta: ExportMeta, logo: string, params: ReportParams, first: boolean) {
  const want = new Set(params.sections);
  const c = r.client;
  const st = r.stats;
  const info = [c.goal ? `Objectif : ${c.goal}` : null, r.coach ? `Coach : ${r.coach}` : null, `Statut : ${STATUS_LABEL[c.status] ?? c.status}`, `Suivi depuis le ${dd(c.start_date)}`]
    .filter(Boolean)
    .join(" · ");
  let h = `<section class="client${first ? "" : " break"}">`;
  h += headerHtml({ ...meta, filters: [] }, logo, {
    kicker: `Rapport client · du ${dd(params.from)} au ${dd(params.to)}`,
    heading: c.full_name,
    lines: [info],
  });

  // Synthèse
  const tiles: [string, string, boolean?][] = [];
  if (want.has("presence") || want.has("seances")) {
    tiles.push(["Séances réalisées", String(st.done)], ["Absences", String(st.absent), true], ["Taux de présence", pct(st.rate)]);
  }
  if (want.has("presence")) tiles.push(["Passages à la salle", String(r.checkins), true], ["Cours collectifs suivis", String(r.classPresent)]);
  if (want.has("progression")) {
    const w = r.evolution.find((e) => e.label === "Poids");
    tiles.push(["Évolution du poids", w ? signed(w.delta, "kg") : "–", true]);
  }
  if (want.has("sante")) tiles.push(["Dernier bilan", r.lastCheck ? dd(r.lastCheck.checked_on) : "–"]);
  if (tiles.length) h += `<h2>Synthèse</h2>${kpis(tiles)}`;

  if (want.has("progression")) {
    h += `<h2>Progression & mesures</h2>`;
    h += tableHtml({
      header: ["Mesure", "Début", "Fin", "Écart"],
      right: [1, 2, 3],
      rows: r.evolution.map((e) => [e.label, `${num(e.first, e.unit)} (${dd(e.firstDate)})`, `${num(e.last, e.unit)} (${dd(e.lastDate)})`, signed(e.delta, e.unit)]),
      empty: "Aucune mesure relevée sur la période.",
    });
    if (r.meas.length > 1) {
      h += tableHtml({
        title: "Relevés",
        header: ["Date", "Poids (kg)", "MG (%)", "Muscle (kg)", "Taille (cm)", "Hanches (cm)", "Squat (kg)", "DC (kg)", "SDT (kg)"],
        rows: r.meas.map((m) => [dd(m.measured_on), nv(m.weight_kg), nv(m.body_fat), nv(m.muscle_kg), nv(m.waist_cm), nv(m.hips_cm), nv(m.squat_kg), nv(m.bench_kg), nv(m.deadlift_kg)]),
      });
    }
  }

  if (want.has("sante")) {
    h += `<h2>Bilans de santé</h2>`;
    const l = r.lastCheck;
    if (l) {
      const item = (k: string, v: string) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`;
      h += `<p class="by">Dernier bilan : ${esc(dd(l.checked_on))} (${esc(CHECK_LABEL[l.kind] ?? l.kind)})${l.checked_on < params.from ? " — antérieur à la période" : ""}</p>`;
      h += `<dl class="dl">${[
        item("Tension", l.systolic && l.diastolic ? `${l.systolic}/${l.diastolic} mmHg` : "–"),
        item("FC repos", l.resting_hr ? `${l.resting_hr} bpm` : "–"),
        item("Sommeil", l.sleep !== null ? `${l.sleep}/10` : "–"),
        item("Énergie", l.energy !== null ? `${l.energy}/10` : "–"),
        item("Stress", l.stress !== null ? `${l.stress}/10` : "–"),
        item("Motivation", l.motivation !== null ? `${l.motivation}/10` : "–"),
        item("Récupération", l.recovery !== null ? `${l.recovery}/10` : "–"),
        item("Nutrition", l.nutrition !== null ? `${l.nutrition}/10` : "–"),
        item("Douleurs", (l.pain_zones ?? []).join(", ") || "Aucune"),
      ].join("")}</dl>`;
      if (l.notes) h += `<p class="note">${esc(l.notes)}</p>`;
    }
    h += tableHtml({
      title: "Bilans de la période",
      header: ["Date", "Type", "Tension", "FC", "Sommeil", "Énergie", "Stress", "Motivation", "Douleurs"],
      rows: r.checks.map((x) => [dd(x.checked_on), CHECK_LABEL[x.kind] ?? x.kind, x.systolic && x.diastolic ? `${x.systolic}/${x.diastolic}` : "", nv(x.resting_hr), nv(x.sleep), nv(x.energy), nv(x.stress), nv(x.motivation), (x.pain_zones ?? []).join(", ")]),
      empty: "Aucun bilan sur la période.",
    });
  }

  if (want.has("presence")) {
    h += `<h2>Présence</h2>`;
    const months = new Map<string, { done: number; absent: number; cancelled: number }>();
    for (const s of r.sessions) {
      const k = dayKey(s.starts_at).slice(0, 7);
      const v = months.get(k) ?? { done: 0, absent: 0, cancelled: 0 };
      if (s.status === "realisee") v.done++;
      else if (s.status === "absent") v.absent++;
      else if (s.status === "annulee") v.cancelled++;
      months.set(k, v);
    }
    h += `<p class="by">Séances : ${st.done} réalisée(s), ${st.absent} absence(s), ${st.cancelled} annulée(s), ${st.planned} à venir · Passages à la salle : ${r.checkins} · Cours collectifs : ${r.classPresent} présent(s), ${r.classAbsent} absence(s)</p>`;
    h += tableHtml({
      header: ["Mois", "Réalisées", "Absences", "Annulées", "Taux de présence"],
      right: [1, 2, 3, 4],
      rows: [...months.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [monthLabel(k), v.done, v.absent, v.cancelled, pct(v.done + v.absent ? Math.round((v.done / (v.done + v.absent)) * 100) : null)]),
      empty: "Aucune séance sur la période.",
    });
  }

  if (want.has("seances")) {
    h += `<h2>Séances</h2>`;
    h += tableHtml({
      header: ["Date", "Heure", "Type", "Durée", "Statut", "RPE", "Notes"],
      rows: r.sessions.map((s) => [dd(s.starts_at), fmtTime(s.starts_at), s.type, `${s.duration_min} min`, SESSION_LABEL[s.status] ?? s.status, nv(s.rpe), s.notes]),
      empty: "Aucune séance sur la période.",
    });
  }

  return h + `</section>`;
}

const nv = (v: number | null | undefined): Cell => (v === null || v === undefined ? null : Number(v));

export function reportHtml(data: ReportData, meta: ExportMeta, logo: string, docTitle: string) {
  const { reports, params } = data;
  let body = "";
  if (!reports.length) {
    body = headerHtml(meta, logo) + `<p class="empty">Aucun client ne correspond à la sélection.</p>`;
  } else if (reports.length > 1) {
    // Page de garde : vue d'ensemble
    const want = new Set(params.sections);
    const header = ["Client", "Statut"];
    const pick = (r: ClientReport): Cell[] => {
      const row: Cell[] = [r.client.full_name, STATUS_LABEL[r.client.status] ?? r.client.status];
      if (want.has("presence") || want.has("seances")) row.push(r.stats.done, r.stats.absent, pct(r.stats.rate));
      if (want.has("progression")) {
        const w = r.evolution.find((e) => e.label === "Poids");
        row.push(w ? signed(w.delta, "kg") : "–");
      }
      return row;
    };
    if (want.has("presence") || want.has("seances")) header.push("Réalisées", "Absences", "Présence");
    if (want.has("progression")) header.push("Poids (écart)");
    body = headerHtml(meta, logo) + `<h2>Vue d'ensemble</h2>` + tableHtml({ header, rows: reports.map(pick), right: header.map((_, i) => i).filter((i) => i >= 2) });
    body += reports.map((r) => clientSection(r, meta, logo, params, false)).join("");
  } else {
    body = clientSection(reports[0]!, meta, logo, params, true);
  }
  return printPage({ docTitle, meta, body, extraCss: EXTRA_CSS });
}

/* ---------- Excel ---------- */
export function reportXlsx(data: ReportData, meta: ExportMeta) {
  const { reports, params } = data;
  const want = new Set(params.sections);
  const header = ["Client", "Statut", "Coach", "Objectif"];
  if (want.has("presence") || want.has("seances")) header.push("Séances réalisées", "Absences", "Annulées", "À venir", "Taux de présence (%)");
  if (want.has("presence")) header.push("Passages à la salle", "Cours collectifs (présent)", "Cours collectifs (absent)");
  const evoCols: [string, string][] = [
    ["Poids", "kg"],
    ["Masse grasse", "%"],
    ["Tour de taille", "cm"],
    ["Squat", "kg"],
    ["Développé couché", "kg"],
    ["Soulevé de terre", "kg"],
  ];
  if (want.has("progression")) for (const [l, u] of evoCols) header.push(`${l} début (${u})`, `${l} fin (${u})`, `${l} écart (${u})`);
  if (want.has("sante")) header.push("Bilans (période)", "Dernier bilan", "Tension", "Sommeil /10", "Énergie /10", "Stress /10", "Douleurs");

  const rows: Cell[][] = reports.map((r) => {
    const row: Cell[] = [r.client.full_name, STATUS_LABEL[r.client.status] ?? r.client.status, r.coach, r.client.goal];
    const st = r.stats;
    if (want.has("presence") || want.has("seances")) row.push(st.done, st.absent, st.cancelled, st.planned, st.rate);
    if (want.has("presence")) row.push(r.checkins, r.classPresent, r.classAbsent);
    if (want.has("progression")) {
      const evo = new Map(r.evolution.map((e) => [e.label, e]));
      for (const [l] of evoCols) {
        const e = evo.get(l);
        row.push(e?.first ?? null, e?.last ?? null, e ? e.delta : null);
      }
    }
    if (want.has("sante")) {
      const l = r.lastCheck;
      row.push(r.checks.length, l ? dd(l.checked_on) : null, l?.systolic && l.diastolic ? `${l.systolic}/${l.diastolic}` : null, nv(l?.sleep), nv(l?.energy), nv(l?.stress), l ? (l.pain_zones ?? []).join(", ") : null);
    }
    return row;
  });

  const sheets: SheetSpec[] = [{ name: "Synthèse", title: `${meta.title} — synthèse`, header, rows }];
  if (want.has("progression")) {
    sheets.push({
      name: "Mesures",
      title: "Mesures",
      header: ["Client", "Date", "Poids (kg)", "Masse grasse (%)", "Masse musculaire (kg)", "Tour de taille (cm)", "Hanches (cm)", "Squat (kg)", "Développé couché (kg)", "Soulevé de terre (kg)"],
      rows: reports.flatMap((r) => r.meas.map((m) => [r.client.full_name, dd(m.measured_on), nv(m.weight_kg), nv(m.body_fat), nv(m.muscle_kg), nv(m.waist_cm), nv(m.hips_cm), nv(m.squat_kg), nv(m.bench_kg), nv(m.deadlift_kg)])),
    });
  }
  if (want.has("sante")) {
    sheets.push({
      name: "Bilans",
      title: "Bilans de santé",
      header: ["Client", "Date", "Type", "Tension sys.", "Tension dia.", "FC repos", "Sommeil /10", "Énergie /10", "Stress /10", "Motivation /10", "Douleurs", "Notes"],
      rows: reports.flatMap((r) =>
        r.checks.map((x) => [r.client.full_name, dd(x.checked_on), CHECK_LABEL[x.kind] ?? x.kind, nv(x.systolic), nv(x.diastolic), nv(x.resting_hr), nv(x.sleep), nv(x.energy), nv(x.stress), nv(x.motivation), (x.pain_zones ?? []).join(", "), x.notes]),
      ),
    });
  }
  if (want.has("seances")) {
    sheets.push({
      name: "Séances",
      title: "Séances",
      header: ["Client", "Date", "Heure", "Type", "Durée (min)", "Statut", "RPE", "Notes"],
      rows: reports.flatMap((r) => r.sessions.map((s) => [r.client.full_name, dd(s.starts_at), fmtTime(s.starts_at), s.type, s.duration_min, SESSION_LABEL[s.status] ?? s.status, nv(s.rpe), s.notes])),
    });
  }
  return buildXlsx(sheets, meta);
}

