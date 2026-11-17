/**
 * Mode démo : une fausse base en mémoire qui imite le client Supabase
 * (from/select/eq/order/insert…) pour voir et tester l'interface sans base réelle.
 * Activé avec NEXT_PUBLIC_DEMO=1.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { seedExtra } from "./demo-extra";
import { seedV3 } from "./demo-v3";
import { agadirToIso } from "./utils";

export const DEMO = process.env.NEXT_PUBLIC_DEMO === "1";
export const DEMO_ADMIN = "00000000-0000-4000-8000-000000000001";
export const DEMO_CLIENT_USER = "00000000-0000-4000-8000-000000000002";
export const DEMO_COACH = "00000000-0000-4000-8000-000000000003";

/** Comptes de démonstration (données fictives, mode démo uniquement) */
export const DEMO_ACCOUNTS = [
  { email: "admin@moovup.ma", password: "moovup2026", userId: DEMO_ADMIN, label: "Administrateur", name: "Yassine Moov'Up", space: "Espace coach (accès complet)" },
  { email: "sara@moovup.ma", password: "coach2026", userId: DEMO_COACH, label: "Coach", name: "Sara El Idrissi", space: "Espace coach" },
  { email: "karim@example.com", password: "adherent2026", userId: DEMO_CLIENT_USER, label: "Adhérent", name: "Karim El Amrani", space: "Espace adhérent" },
];

type Row = Record<string, any>;
type DB = Record<string, Row[]>;

// Identifiants stables : les mêmes liens restent valides après un rechargement
let seq = 100;
const uid = () => `00000000-0000-4000-9000-${String(++seq).padStart(12, "0")}`;
const day = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};
const at = (offset: number, hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return agadirToIso(d.toISOString().slice(0, 10), `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
};

function seed(): DB {
  seq = 100;
  const coach2 = "00000000-0000-4000-8000-000000000003";
  const profiles = [
    { id: DEMO_ADMIN, full_name: "Yassine Moov'Up", email: "admin@moovup.ma", role: "admin", created_at: day(-200) },
    { id: coach2, full_name: "Sara El Idrissi", email: "sara@moovup.ma", role: "coach", created_at: day(-150) },
    { id: DEMO_CLIENT_USER, full_name: "Karim El Amrani", email: "karim@example.com", role: "client", created_at: day(-160) },
    { id: uid(), full_name: "Hamza Berrada", email: "hamza@example.com", role: "client", created_at: day(-3) },
  ];

  const people: [string, string, "H" | "F", number, string, string, "actif" | "pause" | "termine", string, number][] = [
    ["Karim El Amrani", "karim@example.com", "H", 34, "Perte de poids", "3x/semaine", "actif", DEMO_ADMIN, 178],
    ["Salma Bennani", "salma@example.com", "F", 28, "Tonification", "2x/semaine", "actif", DEMO_ADMIN, 165],
    ["Youssef Ait Lahcen", "youssef@example.com", "H", 41, "Prise de masse", "4x/semaine", "actif", DEMO_ADMIN, 180],
    ["Nadia Ouhammou", "nadia@example.com", "F", 52, "Santé & mobilité", "2x/semaine", "actif", coach2, 160],
    ["Omar Tazi", "omar@example.com", "H", 23, "Performance sportive", "3x/semaine", "pause", DEMO_ADMIN, 182],
    ["Imane Chraibi", "imane@example.com", "F", 31, "Remise en forme", "2x/semaine", "actif", coach2, 168],
    ["Mehdi Alaoui", "mehdi@example.com", "H", 38, "Perte de poids", "3x/semaine", "actif", DEMO_ADMIN, 175],
    ["Leila Benjelloun", "leila@example.com", "F", 45, "Rééducation / reprise", "2x/semaine", "termine", coach2, 163],
  ];

  const clients: Row[] = people.map(([full_name, email, sex, age, goal, frequency, status, coach_id, height_cm], i) => ({
    id: uid(),
    coach_id,
    user_id: i === 0 ? DEMO_CLIENT_USER : null,
    full_name,
    email,
    phone: `06 ${String(10 + i * 7).padStart(2, "0")} ${String(30 + i * 3)} ${String(40 + i * 5)} ${String(11 + i * 9).slice(0, 2)}`,
    birth_date: `${new Date().getFullYear() - age}-0${(i % 9) + 1}-1${i % 9}`,
    sex,
    height_cm,
    goal,
    frequency,
    status,
    start_date: day(-180 + i * 12),
    notes: i === 0 ? "Disponible tôt le matin. Ancien footballeur, genou droit fragile." : null,
    created_at: day(-180 + i * 12),
  }));

  // Mesures : 7 relevés (un par mois) avec une tendance par objectif
  const measurements: Row[] = [];
  const trends = [
    { w: 95, dw: -1.5, f: 29, df: -1, sq: 80, dsq: 5, b: 60, db: 2.5, wa: 104, dwa: -2 },
    { w: 64, dw: -0.5, f: 27, df: -0.7, sq: 40, dsq: 3.5, b: 25, db: 1.5, wa: 75, dwa: -1 },
    { w: 72, dw: 0.8, f: 15, df: 0.2, sq: 100, dsq: 5, b: 80, db: 2.5, wa: 82, dwa: 0.3 },
    { w: 80, dw: -0.7, f: 35, df: -0.5, sq: 20, dsq: 2.5, b: 15, db: 1, wa: 97, dwa: -1.2 },
    { w: 70, dw: 0.2, f: 12, df: -0.1, sq: 90, dsq: 3, b: 60, db: 1.5, wa: 78, dwa: 0 },
    { w: 72, dw: -0.9, f: 32, df: -0.6, sq: 25, dsq: 3, b: 15, db: 1.5, wa: 88, dwa: -1.5 },
    { w: 101, dw: -1.8, f: 31, df: -0.9, sq: 70, dsq: 4, b: 55, db: 2.5, wa: 110, dwa: -2.2 },
    { w: 66, dw: -0.3, f: 30, df: -0.3, sq: 20, dsq: 2.5, b: 15, db: 1, wa: 82, dwa: -0.6 },
  ];
  clients.forEach((c, ci) => {
    const t = trends[ci]!;
    const n = ci === 5 ? 3 : 7;
    for (let k = 0; k < n; k++) {
      const wobble = ((k * 7 + ci) % 3) * 0.2 - 0.2;
      measurements.push({
        id: uid(),
        client_id: c.id,
        measured_on: day(-30 * (n - 1 - k) - 2),
        weight_kg: +(t.w + t.dw * k + wobble).toFixed(1),
        body_fat: +(t.f + t.df * k).toFixed(1),
        muscle_kg: null,
        waist_cm: +(t.wa + t.dwa * k).toFixed(1),
        hips_cm: +(t.wa + 10 + t.dwa * 0.6 * k).toFixed(1),
        chest_cm: null,
        arm_cm: +(32 + (t.dsq > 4 ? 0.3 : 0.1) * k).toFixed(1),
        thigh_cm: null,
        squat_kg: t.sq + t.dsq * k,
        bench_kg: t.b + t.db * k,
        deadlift_kg: t.sq + 20 + t.dsq * 1.2 * k,
        notes: null,
        created_at: day(-30 * (n - 1 - k)),
      });
    }
  });

  // Bilans de santé
  const health_checks: Row[] = [];
  const latest = [
    { sleep: 6, energy: 7, stress: 6, pain: ["Genoux"], sys: 132, dia: 84, hr: 68 },
    { sleep: 8, energy: 8, stress: 3, pain: [], sys: 112, dia: 72, hr: 61 },
    { sleep: 7, energy: 8, stress: 4, pain: [], sys: 121, dia: 79, hr: 57 },
    { sleep: 4, energy: 5, stress: 8, pain: ["Bas du dos"], sys: 144, dia: 92, hr: 76 },
    { sleep: 7, energy: 6, stress: 5, pain: ["Chevilles"], sys: 118, dia: 74, hr: 54 },
    { sleep: 4, energy: 5, stress: 6, pain: [], sys: 110, dia: 70, hr: 72 },
    { sleep: 6, energy: 6, stress: 7, pain: [], sys: 128, dia: 82, hr: 70 },
    { sleep: 7, energy: 7, stress: 4, pain: [], sys: 120, dia: 78, hr: 66 },
  ];
  clients.forEach((c, ci) => {
    const L = latest[ci]!;
    const n = ci === 6 ? 2 : 6;
    for (let k = 0; k < n; k++) {
      const back = n - 1 - k;
      const isLast = k === n - 1;
      health_checks.push({
        id: uid(),
        client_id: c.id,
        created_by: c.coach_id,
        kind: k === 0 ? "initial" : k % 2 ? "mensuel" : "hebdo",
        checked_on: day(-30 * back - (ci === 6 ? 40 : 1)),
        systolic: L.sys + back * 2,
        diastolic: L.dia + back,
        resting_hr: L.hr + back,
        sleep: Math.max(1, Math.min(10, L.sleep - (back > 2 ? 1 : 0))),
        energy: Math.max(1, Math.min(10, L.energy - (back > 3 ? 2 : back > 1 ? 1 : 0))),
        stress: Math.max(1, Math.min(10, L.stress + (back > 3 ? 1 : 0))),
        motivation: 8 - (back % 2),
        nutrition: 6 + (k % 3),
        recovery: 7 - (back % 2),
        pain_zones: isLast ? L.pain : k === 1 && ci === 0 ? ["Genoux", "Bas du dos"] : [],
        conditions: k === 0 ? (ci === 3 ? "Hypertension légère, arthrose lombaire" : ci === 0 ? "Aucune" : null) : null,
        medications: k === 0 ? (ci === 3 ? "Amlodipine 5 mg" : "Aucun") : null,
        injuries: k === 0 ? (ci === 0 ? "Entorse genou droit (2019)" : ci === 4 ? "Entorse cheville gauche (2024)" : null) : null,
        parq_positive: k === 0 ? ci === 3 : null,
        notes: isLast && ci === 0 ? "Bonne dynamique, surveiller le genou sur les fentes." : isLast && ci === 3 ? "Fatiguée, travail stressant. Séances plus douces cette semaine." : null,
        consent: true,
        created_at: day(-30 * back),
      });
    }
  });

  // Séances : 6 semaines passées + semaine en cours + semaine prochaine
  const sessions: Row[] = [];
  const session_exercises: Row[] = [];
  const plans: Record<number, [number, string, string][]> = {
    0: [[0, "07:00", "Musculation – Bas du corps"], [2, "07:00", "Cardio / HIIT"], [4, "07:00", "Musculation – Full body"]],
    1: [[1, "19:00", "Circuit training"], [3, "19:00", "Musculation – Haut du corps"]],
    2: [[0, "18:00", "Musculation – Haut du corps"], [1, "18:30", "Musculation – Bas du corps"], [3, "18:00", "Musculation – Full body"], [5, "10:00", "Préparation physique"]],
    3: [[0, "09:30", "Mobilité & gainage"], [3, "09:30", "Renforcement doux"]],
    4: [[1, "17:00", "Préparation physique"], [4, "17:00", "Cardio / HIIT"]],
    5: [[1, "08:00", "Renforcement doux"], [4, "08:00", "Circuit training"]],
    6: [[0, "12:30", "Cardio / HIIT"], [2, "12:30", "Musculation – Full body"], [4, "12:30", "Circuit training"]],
  };
  const exLib: Record<string, [string, number, string, number][]> = {
    "Musculation – Bas du corps": [["Squat barre", 4, "8", 1], ["Fentes haltères", 3, "12", 0.2], ["Leg curl", 3, "12", 0.4], ["Hip thrust", 3, "10", 1.1]],
    "Musculation – Haut du corps": [["Développé couché", 4, "8", 1], ["Rowing barre", 4, "10", 0.8], ["Développé militaire", 3, "10", 0.55], ["Tractions", 3, "6", 0]],
    "Musculation – Full body": [["Soulevé de terre", 4, "5", 1.2], ["Développé incliné haltères", 3, "10", 0.35], ["Tirage vertical", 3, "12", 0.7], ["Gainage planche", 3, "45s", 0]],
    "Cardio / HIIT": [["Rameur", 6, "250m", 0], ["Kettlebell swing", 5, "15", 0.2], ["Burpees", 5, "10", 0]],
    "Circuit training": [["Kettlebell swing", 4, "15", 0.2], ["Pompes", 4, "12", 0], ["Fentes haltères", 4, "10", 0.15], ["Corde à sauter", 4, "60s", 0]],
  };
  const now = new Date();
  const monday = (now.getDay() + 6) % 7;
  clients.forEach((c, ci) => {
    if (c.status === "termine") return;
    const plan = plans[ci] ?? [];
    for (let w = -6; w <= 1; w++) {
      if (c.status === "pause" && w > -3) continue;
      for (const [d, time, type] of plan) {
        const offset = w * 7 + d - monday;
        const startsAt = at(offset, time);
        const past = new Date(startsAt) < now;
        const absent = past && (ci * 7 + w * 3 + d) % 9 === 0;
        const id = uid();
        const sq = measurements.filter((m) => m.client_id === c.id).at(-1)?.squat_kg ?? 50;
        sessions.push({
          id,
          client_id: c.id,
          coach_id: c.coach_id,
          starts_at: startsAt,
          duration_min: type.includes("Mobilité") || type.includes("doux") ? 45 : 60,
          type,
          status: past ? (absent ? "absent" : "realisee") : "planifiee",
          rpe: past && !absent ? 6 + ((ci + d + w + 12) % 4) : null,
          notes: past && !absent && (ci + d) % 4 === 0 ? "Bonne séance, technique propre. Charges en hausse." : null,
          created_at: startsAt,
        });
        (exLib[type] ?? []).forEach(([name, sets, reps, ratio], p) =>
          session_exercises.push({ id: uid(), session_id: id, position: p, name, sets, reps, load_kg: ratio ? Math.round((sq * ratio * 0.75) / 2.5) * 2.5 : null, rpe: past ? 7 + (p % 2) : null }),
        );
      }
    }
  });

  const base: DB = { profiles, clients, measurements, health_checks, sessions, session_exercises };
  const withExtra: DB = { ...base, ...seedExtra(base, uid) };
  return { ...withExtra, ...seedV3(withExtra, uid) };
}

const g = globalThis as unknown as { __moovupDemoV7?: DB };
export function demoDb(): DB {
  if (!g.__moovupDemoV7) g.__moovupDemoV7 = seed();
  return g.__moovupDemoV7;
}

/* ---------- Faux constructeur de requêtes ---------- */
type Filter = (r: Row) => boolean;

class Query implements PromiseLike<any> {
  private filters: Filter[] = [];
  private sorts: [string, boolean][] = [];
  private max?: number;
  private mode: "select" | "insert" | "update" | "delete" = "select";
  private payload: Row | Row[] | null = null;
  private one: "single" | "maybe" | null = null;
  private head = false;
  private wantRows = false;

  constructor(private table: string) {}

  select(_cols?: string, opts?: { count?: string; head?: boolean }) {
    if (this.mode !== "select") this.wantRows = true;
    if (opts?.head) this.head = true;
    return this;
  }
  insert(v: Row | Row[]) { this.mode = "insert"; this.payload = v; return this; }
  update(v: Row) { this.mode = "update"; this.payload = v; return this; }
  delete() { this.mode = "delete"; return this; }
  eq(k: string, v: any) { this.filters.push((r) => r[k] === v); return this; }
  neq(k: string, v: any) { this.filters.push((r) => r[k] !== v); return this; }
  in(k: string, v: any[]) { this.filters.push((r) => v.includes(r[k])); return this; }
  gte(k: string, v: any) { this.filters.push((r) => r[k] >= v); return this; }
  lt(k: string, v: any) { this.filters.push((r) => r[k] < v); return this; }
  lte(k: string, v: any) { this.filters.push((r) => r[k] <= v); return this; }
  gt(k: string, v: any) { this.filters.push((r) => r[k] > v); return this; }
  ilike(k: string, pat: string) { const n = pat.replace(/%/g, '').toLowerCase(); this.filters.push((r) => String(r[k] ?? '').toLowerCase().includes(n)); return this; }
  is(k: string, v: null | boolean) { this.filters.push((r) => (v === null ? r[k] === null || r[k] === undefined : r[k] === v)); return this; }
  not(k: string, ...rest: [string, null]) { void rest; this.filters.push((r) => r[k] !== null && r[k] !== undefined); return this; }
  upsert(v: Row | Row[]) {
    const db = demoDb(); const tbl = (db[this.table] ??= []);
    const rows = Array.isArray(v) ? v : [v];
    const fresh = rows.filter((r) => { const ex = tbl.find((x) => x.id === r.id); if (ex) { Object.assign(ex, r); return false; } return true; });
    this.mode = 'insert'; this.payload = fresh; return this;
  }
  or(expr: string) {
    const parts = expr.split(",").map((p) => {
      const [k, , pat] = p.split(".");
      const needle = (pat ?? "").replace(/%/g, "").toLowerCase();
      return (r: Row) => String(r[k!] ?? "").toLowerCase().includes(needle);
    });
    this.filters.push((r) => parts.some((f) => f(r)));
    return this;
  }
  order(k: string, opts?: { ascending?: boolean }) { this.sorts.push([k, opts?.ascending !== false]); return this; }
  limit(n: number) { this.max = n; return this; }
  single() { this.one = "single"; return this; }
  maybeSingle() { this.one = "maybe"; return this; }

  private run() {
    const db = demoDb();
    const tbl = (db[this.table] ??= []);
    const match = (r: Row) => this.filters.every((f) => f(r));

    if (this.mode === "insert") {
      const rows = (Array.isArray(this.payload) ? this.payload : [this.payload!]).map((r) => ({
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
        ...(this.table === "clients" ? { user_id: null, status: "actif" } : {}),
        ...(this.table === "health_checks" ? { pain_zones: [] } : {}),
        ...r,
      }));
      tbl.push(...rows);
      return this.shape(rows);
    }
    if (this.mode === "update") {
      const rows = tbl.filter(match);
      rows.forEach((r) => Object.assign(r, this.payload));
      return this.shape(rows);
    }
    if (this.mode === "delete") {
      const keep = tbl.filter((r) => !match(r));
      const removed = tbl.length - keep.length;
      db[this.table] = keep;
      if (this.table === "clients") {
        const ids = new Set(tbl.filter(match).map((r) => r.id));
        for (const t of ["sessions", "measurements", "health_checks"]) db[t] = db[t]!.filter((r) => !ids.has(r.client_id));
      }
      return { data: null, error: null, count: removed };
    }
    let rows = tbl.filter(match).map((r) => ({ ...r }));
    for (const [k, asc] of [...this.sorts].reverse()) {
      rows.sort((a, b) => (a[k] === b[k] ? 0 : (a[k] ?? "") > (b[k] ?? "") ? (asc ? 1 : -1) : asc ? -1 : 1));
    }
    if (this.head) return { data: null, error: null, count: rows.length };
    if (this.max !== undefined) rows = rows.slice(0, this.max);
    return this.shape(rows);
  }

  private shape(rows: Row[]) {
    if (this.mode !== "select" && !this.wantRows && !this.one) return { data: null, error: null };
    if (this.one) {
      if (!rows.length) return { data: null, error: this.one === "single" ? { message: "Introuvable", code: "PGRST116" } : null };
      return { data: rows[0], error: null };
    }
    return { data: rows, error: null, count: rows.length };
  }

  then<A = any, B = never>(ok?: ((v: any) => A | PromiseLike<A>) | null, ko?: ((e: any) => B | PromiseLike<B>) | null) {
    try {
      return Promise.resolve(this.run()).then(ok, ko);
    } catch (e) {
      return Promise.reject(e).then(ok, ko);
    }
  }
}

export function demoClient(userId: string | null) {
  return {
    from: (table: string) => new Query(table),
    auth: {
      getUser: async () => ({ data: { user: userId ? { id: userId, email: "demo@moovup.ma" } : null }, error: null }),
      signOut: async () => ({ error: null }),
      signInWithPassword: async () => ({ error: null }),
      signUp: async () => ({ data: { session: {} }, error: null }),
      exchangeCodeForSession: async () => ({ error: null }),
      verifyOtp: async () => ({ error: null }),
    },
  } as any;
}
