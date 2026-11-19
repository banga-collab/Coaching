"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { parseNum } from "@/lib/utils";
import type { FormState } from "@/components/action-form";
import { canAccessClient, hashToken, newToken, sanitizeInputs, saveSamples, todayKey } from "@/lib/health/server";
import { isSource, type DailyInput, type HealthSource } from "@/lib/health/types";

/** Pages à rafraîchir après un changement. */
function refresh(clientId: string) {
  revalidatePath(`/clients/${clientId}/sante`);
  revalidatePath("/moi/sante");
}

/** Chemin de retour sûr (formulaires) */
function backPath(v: FormDataEntryValue | null, clientId: string) {
  const s = String(v ?? "");
  return s.startsWith("/moi/sante") || s.startsWith(`/clients/${clientId}/sante`) ? s.split("?")[0]! : "/moi/sante";
}

async function guard(clientId: string) {
  if (!clientId) return null;
  const me = await getProfile();
  const supabase = await createClient();
  return (await canAccessClient(supabase, me, clientId)) ? { me, supabase } : null;
}

export type BatchResult = { ok: true; saved: number; rejected: number } | { ok: false; error: string };

/** Lot de valeurs journalières issues d'un fichier (appelé plusieurs fois par import, sans rafraîchir la page). */
export async function importHealthBatchAction(clientId: string, source: HealthSource, rows: DailyInput[]): Promise<BatchResult> {
  if (!isSource(source) || source === "manuel") return { ok: false, error: "Source inconnue." };
  if (!Array.isArray(rows) || rows.length > 1000) return { ok: false, error: "Lot trop volumineux." };
  const ctx = await guard(clientId);
  if (!ctx) return { ok: false, error: "Accès refusé." };
  const { rows: clean, rejected } = sanitizeInputs(rows);
  try {
    const saved = await saveSamples(ctx.supabase, clientId, source, clean, ctx.me.id);
    return { ok: true, saved, rejected };
  } catch (e) {
    return { ok: false, error: `Enregistrement impossible : ${(e as Error).message}` };
  }
}

/** Fin d'import : rafraîchit les pages concernées. */
export async function finishHealthImportAction(clientId: string) {
  const ctx = await guard(clientId);
  if (ctx) refresh(clientId);
}

/** "7h30", "7:30", "7,5" (heures) ou "450" (minutes) → minutes */
function parseSleep(v: FormDataEntryValue | null): number | null {
  const s = String(v ?? "").trim().toLowerCase();
  if (!s) return null;
  const m = s.match(/^(\d{1,2})\s*[h:]\s*(\d{1,2})?\s*(min)?$/);
  if (m) return Number(m[1]) * 60 + Number(m[2] ?? 0);
  const n = parseNum(s);
  if (n === null) return NaN;
  return n > 24 ? n : n * 60;
}

/** Saisie manuelle rapide (sommeil, pas, FC repos, poids). */
export async function addManualHealthAction(_: FormState, fd: FormData): Promise<FormState> {
  const clientId = String(fd.get("client_id") ?? "");
  const ctx = await guard(clientId);
  if (!ctx) return { error: "Accès refusé." };
  const day = String(fd.get("day") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day > todayKey()) return { error: "Choisis une date valide (pas dans le futur)." };

  const rows: DailyInput[] = [];
  const sleep = parseSleep(fd.get("sleep"));
  if (sleep !== null) {
    if (!Number.isFinite(sleep) || sleep < 30 || sleep > 960) return { error: "Sommeil : indique une durée comme 7h30 ou 7,5 (entre 30 min et 16 h)." };
    rows.push({ day, metric: "sleep", value: Math.round(sleep) });
  }
  const steps = parseNum(fd.get("steps"));
  if (steps !== null) {
    if (steps < 0 || steps > 100000) return { error: "Pas : nombre entre 0 et 100 000." };
    rows.push({ day, metric: "steps", value: Math.round(steps) });
  }
  const hr = parseNum(fd.get("hr_resting"));
  if (hr !== null) {
    if (hr < 25 || hr > 140) return { error: "FC au repos : entre 25 et 140 bpm (mesurée au réveil)." };
    rows.push({ day, metric: "hr_resting", value: Math.round(hr) });
  }
  const weight = parseNum(fd.get("weight"));
  if (weight !== null) {
    if (weight < 20 || weight > 350) return { error: "Poids : entre 20 et 350 kg." };
    rows.push({ day, metric: "weight", value: Math.round(weight * 10) / 10 });
  }
  if (!rows.length) return { error: "Remplis au moins une valeur." };
  try {
    await saveSamples(ctx.supabase, clientId, "manuel", rows, ctx.me.id);
  } catch (e) {
    return { error: `Enregistrement impossible : ${(e as Error).message}` };
  }
  refresh(clientId);
  redirect(`${backPath(fd.get("back"), clientId)}?saisie=ok`);
}

/** Supprime toutes les données d'une source (ex. « effacer l'import Samsung »). */
export async function deleteHealthSourceAction(fd: FormData) {
  const clientId = String(fd.get("client_id") ?? "");
  const source = String(fd.get("source") ?? "");
  const ctx = await guard(clientId);
  if (!ctx || !isSource(source)) return;
  await ctx.supabase.from("health_samples").delete().eq("client_id", clientId).eq("source", source);
  refresh(clientId);
  redirect(`${backPath(fd.get("back"), clientId)}?suppr=ok`);
}

/* ---------- Jetons personnels pour l'application mobile ---------- */

export type TokenResult = { ok: true; token: string } | { ok: false; error: string };

/** Crée un jeton (affiché une seule fois ; seule son empreinte est stockée). */
export async function createHealthTokenAction(clientId: string, label: string): Promise<TokenResult> {
  const ctx = await guard(clientId);
  if (!ctx) return { ok: false, error: "Accès refusé." };
  const { count } = await ctx.supabase.from("health_tokens").select("id", { count: "exact", head: true }).eq("client_id", clientId);
  if ((count ?? 0) >= 5) return { ok: false, error: "5 appareils maximum : révoque un ancien jeton d'abord." };
  const token = newToken();
  const { error } = await ctx.supabase.from("health_tokens").insert({
    client_id: clientId,
    created_by: ctx.me.id,
    token_hash: hashToken(token),
    label: (label || "Téléphone").trim().slice(0, 40),
    last_used_at: null,
  });
  if (error) return { ok: false, error: `Création impossible : ${error.message}` };
  refresh(clientId);
  return { ok: true, token };
}

export async function revokeHealthTokenAction(fd: FormData) {
  const clientId = String(fd.get("client_id") ?? "");
  const id = String(fd.get("id") ?? "");
  const ctx = await guard(clientId);
  if (!ctx || !id) return;
  await ctx.supabase.from("health_tokens").delete().eq("id", id).eq("client_id", clientId);
  refresh(clientId);
}
