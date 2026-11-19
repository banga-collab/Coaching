import { NextResponse, type NextRequest } from "next/server";
import { hashToken, healthServiceClient, sanitizeInputs, saveSamples } from "@/lib/health/server";
import { isSource, type HealthSource } from "@/lib/health/types";

export const dynamic = "force-dynamic";

/**
 * Synchronisation automatique depuis l'application mobile (Health Connect sur Android, HealthKit sur iOS).
 *
 * Authentification : `Authorization: Bearer <jeton personnel>` (créé par l'adhérent dans /moi/sante).
 * POST corps JSON :
 *   { "source": "health_connect" | "apple_health" | "samsung_health",
 *     "samples": [ { "date": "2026-11-17", "type": "steps", "value": 8421 },
 *                  { "date": "2026-11-17", "type": "sleep", "value": 432, "details": { "deep": 80, "rem": 95, "light": 230, "awake": 27, "bed": "23:12", "wake": "06:51" } } ] }
 *   types : sleep (minutes), steps, hr_resting (bpm), hr_avg (bpm), active_kcal, vo2max (mL/kg/min), weight (kg)
 *   Une valeur par jour et par type ; renvoyer un jour remplace l'ancienne valeur (idempotent).
 * GET : vérifie le jeton (test de connexion depuis l'application).
 */

const MAX_BODY = 1_000_000;
const MAX_SAMPLES = 2000;

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

async function authenticate(req: NextRequest) {
  const db = healthServiceClient();
  if (!db) return { error: json({ ok: false, error: "Synchronisation indisponible : SUPABASE_SERVICE_ROLE_KEY n'est pas configurée sur le serveur." }, 501) };
  const m = (req.headers.get("authorization") ?? "").match(/^Bearer\s+(mvh_[A-Za-z0-9_-]{20,})$/);
  if (!m) return { error: json({ ok: false, error: "Jeton manquant ou mal formé (en-tête Authorization: Bearer mvh_…)." }, 401) };
  const { data } = await db.from("health_tokens").select("id,client_id,last_used_at").eq("token_hash", hashToken(m[1]!)).maybeSingle();
  const tok = data as { id: string; client_id: string; last_used_at: string | null } | null;
  if (!tok) return { error: json({ ok: false, error: "Jeton invalide ou révoqué." }, 401) };
  return { db, tok };
}

export async function GET(req: NextRequest) {
  const a = await authenticate(req);
  if ("error" in a) return a.error;
  return json({ ok: true, last_sync: a.tok.last_used_at, types: ["sleep", "steps", "hr_resting", "hr_avg", "active_kcal", "vo2max", "weight"] });
}

export async function POST(req: NextRequest) {
  const a = await authenticate(req);
  if ("error" in a) return a.error;
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > MAX_BODY) return json({ ok: false, error: "Corps trop volumineux (1 Mo max) : envoyez par lots." }, 413);

  let body: unknown;
  try {
    const text = await req.text();
    if (text.length > MAX_BODY) return json({ ok: false, error: "Corps trop volumineux (1 Mo max) : envoyez par lots." }, 413);
    body = JSON.parse(text);
  } catch {
    return json({ ok: false, error: "JSON invalide." }, 400);
  }
  const b = (body ?? {}) as { source?: unknown; samples?: unknown };
  const source: HealthSource = isSource(b.source) && b.source !== "manuel" ? b.source : "health_connect";
  if (!Array.isArray(b.samples)) return json({ ok: false, error: "Champ « samples » manquant (tableau)." }, 400);
  if (b.samples.length > MAX_SAMPLES) return json({ ok: false, error: `${MAX_SAMPLES} valeurs maximum par envoi.` }, 413);

  const { rows, rejected } = sanitizeInputs(b.samples);
  try {
    const saved = rows.length ? await saveSamples(a.db, a.tok.client_id, source, rows, null) : 0;
    await a.db.from("health_tokens").update({ last_used_at: new Date().toISOString() }).eq("id", a.tok.id);
    return json({ ok: true, received: b.samples.length, saved, rejected });
  } catch (e) {
    return json({ ok: false, error: (e as Error).message }, 500);
  }
}
