/** Fonctions serveur de la santé connectée (lecture, validation, enregistrement, jetons). */
import { createHash, randomBytes } from "node:crypto";
import { createClient as createSupabase, type SupabaseClient } from "@supabase/supabase-js";
import { DEMO, DEMO_ADMIN, demoClient } from "@/lib/demo";
import { dayKey } from "@/lib/utils";
import type { Profile } from "@/lib/types";
import { shiftDay } from "./aggregate";
import { ensureHealthDemo } from "./demo";
import { sampleId } from "./ids";
import { METRIC_META, isMetric, type DailyInput, type HealthDetails, type HealthMetric, type HealthSample, type HealthSource } from "./types";

export const todayKey = () => dayKey(new Date());

/** Charge les données des `days` derniers jours (par groupes de métriques : limite de 1000 lignes par requête). */
export async function loadHealth(supabase: SupabaseClient, clientId: string, days: number): Promise<HealthSample[]> {
  if (DEMO) ensureHealthDemo();
  const since = shiftDay(todayKey(), -days + 1);
  const groups: HealthMetric[][] = [["sleep", "steps"], ["hr_resting", "hr_avg"], ["active_kcal", "vo2max", "weight"]];
  const res = await Promise.all(
    groups.map((g) =>
      supabase
        .from("health_samples")
        .select("id,client_id,day,metric,value,unit,source,details,created_at,created_by")
        .eq("client_id", clientId)
        .in("metric", g)
        .gte("day", since)
        .order("day")
        .limit(1000),
    ),
  );
  return res.flatMap((r) => (r.data ?? []) as HealthSample[]);
}

/** Dernière synchronisation par source (pour l'affichage). */
export async function lastSyncs(supabase: SupabaseClient, clientId: string) {
  const { data } = await supabase.from("health_samples").select("source,created_at").eq("client_id", clientId).order("created_at", { ascending: false }).limit(200);
  const out: Partial<Record<HealthSource, string>> = {};
  for (const r of (data ?? []) as { source: HealthSource; created_at: string }[]) if (!out[r.source]) out[r.source] = r.created_at;
  return out;
}

const HM = /^\d{2}:\d{2}$/;
function cleanDetails(d: unknown, metric: HealthMetric): HealthDetails | null {
  if (!d || typeof d !== "object") return null;
  const src = d as Record<string, unknown>;
  const out: HealthDetails = {};
  const n = (k: keyof HealthDetails, max: number) => {
    const v = Number(src[k]);
    if (src[k] !== undefined && src[k] !== null && Number.isFinite(v) && v >= 0 && v <= max) (out as Record<string, number>)[k] = Math.round(v);
  };
  if (metric === "sleep") {
    (["deep", "light", "rem", "awake", "in_bed"] as const).forEach((k) => n(k, 1440));
    if (typeof src.bed === "string" && HM.test(src.bed)) out.bed = src.bed;
    if (typeof src.wake === "string" && HM.test(src.wake)) out.wake = src.wake;
  } else if (metric === "hr_avg" || metric === "hr_resting") {
    n("min", 250);
    n("max", 250);
  }
  if (typeof src.device === "string") out.device = src.device.slice(0, 60);
  return Object.keys(out).length ? out : null;
}

/** Valide et normalise des valeurs journalières (fichier, saisie, API). Renvoie aussi le nombre de rejets. */
export function sanitizeInputs(raw: unknown[]): { rows: DailyInput[]; rejected: number } {
  const today = todayKey();
  const max = shiftDay(today, 1);
  const min = shiftDay(today, -3660);
  const rows: DailyInput[] = [];
  let rejected = 0;
  for (const r of raw) {
    if (!r || typeof r !== "object") {
      rejected++;
      continue;
    }
    const o = r as Record<string, unknown>;
    const day = String(o.day ?? o.date ?? "").slice(0, 10);
    const metric = o.metric ?? o.type;
    const value = Number(o.value);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day > max || day < min || !isMetric(metric) || !Number.isFinite(value)) {
      rejected++;
      continue;
    }
    const meta = METRIC_META[metric];
    if (value < meta.min || value > meta.max) {
      rejected++;
      continue;
    }
    rows.push({ day, metric, value: metric === "steps" || metric === "active_kcal" || metric === "sleep" ? Math.round(value) : Math.round(value * 10) / 10, details: cleanDetails(o.details, metric) });
  }
  return { rows, rejected };
}

/** Enregistre (remplace) des valeurs journalières pour un client et une source. */
export async function saveSamples(supabase: SupabaseClient, clientId: string, source: HealthSource, inputs: DailyInput[], userId: string | null) {
  if (DEMO) ensureHealthDemo();
  const now = new Date().toISOString();
  // Dédoublonnage dans le lot (dernière valeur gagnante)
  const byId = new Map<string, Record<string, unknown>>();
  for (const i of inputs) {
    const id = sampleId(clientId, i.day, i.metric, source);
    byId.set(id, { id, client_id: clientId, day: i.day, metric: i.metric, value: i.value, unit: METRIC_META[i.metric].unit, source, details: i.details ?? null, created_by: userId, created_at: now, updated_at: now });
  }
  const rows = [...byId.values()];
  for (let k = 0; k < rows.length; k += 500) {
    const { error } = await supabase.from("health_samples").upsert(rows.slice(k, k + 500), { onConflict: "id" });
    if (error) throw new Error(error.message);
  }
  return rows.length;
}

/** Peut-on lire / écrire la santé de ce client ? (l'équipe, ou l'adhérent lui-même ; la RLS affine en production) */
export async function canAccessClient(supabase: SupabaseClient, me: Profile, clientId: string) {
  const { data } = await supabase.from("clients").select("id,coach_id,user_id").eq("id", clientId).maybeSingle();
  const c = data as { coach_id: string; user_id: string | null } | null;
  if (!c) return false;
  return me.role !== "client" || c.user_id === me.id;
}

/* ---------- Jetons personnels (application mobile) ---------- */

export const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");
export const newToken = () => `mvh_${randomBytes(24).toString("base64url")}`;

/** Client Supabase sans session (clé service) pour l'API mobile ; démo : base en mémoire. */
export function healthServiceClient(): SupabaseClient | null {
  if (DEMO) return demoClient(DEMO_ADMIN) as SupabaseClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createSupabase(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

