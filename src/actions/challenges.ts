"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { parseNum, str } from "@/lib/utils";
import { challengeStatus, computeLeaderboard, loadScoreData, todayKey, METRICS } from "@/lib/challenges";
import { syncBadges } from "@/lib/badges";
import type { Challenge, ChallengeEntry, Client } from "@/lib/types";
import type { FormState } from "@/components/action-form";

const fail = (error: string): FormState => ({ error });

async function staffOnly() {
  const me = await getProfile();
  return me.role === "client" ? null : me;
}

function revalidateAll(id?: string) {
  revalidatePath("/defis");
  revalidatePath("/moi/defis");
  if (id) revalidatePath(`/defis/${id}`);
}

/** Enregistre (crée ou met à jour) la valeur d'un participant. */
async function setEntry(supabase: SupabaseClient, challenge_id: string, client_id: string, value: number) {
  const { data } = await supabase.from("challenge_entries").select("*").eq("challenge_id", challenge_id).eq("client_id", client_id).maybeSingle();
  const updated_at = new Date().toISOString();
  if (data) return supabase.from("challenge_entries").update({ value, updated_at }).eq("id", (data as ChallengeEntry).id);
  return supabase.from("challenge_entries").insert({ challenge_id, client_id, value, updated_at });
}

/* ================= Défis (staff) ================= */
export async function saveChallengeAction(_: FormState, fd: FormData): Promise<FormState> {
  const me = await staffOnly();
  if (!me) return fail("Accès refusé.");
  const id = str(fd.get("id"));
  const metric = (str(fd.get("metric")) ?? "presences") as Challenge["metric"];
  if (!(metric in METRICS)) return fail("Métrique inconnue.");
  const row = {
    title: String(fd.get("title") ?? "").trim(),
    description: str(fd.get("description")),
    metric,
    unit: str(fd.get("unit")) ?? METRICS[metric].unit,
    goal_value: parseNum(fd.get("goal_value")),
    start_date: str(fd.get("start_date")),
    end_date: str(fd.get("end_date")),
    reward: str(fd.get("reward")),
    cover: str(fd.get("cover")) ?? "🏆",
  };
  if (!row.title) return fail("Le titre est obligatoire.");
  if (!row.start_date || !row.end_date) return fail("Les dates de début et de fin sont obligatoires.");
  if (row.end_date < row.start_date) return fail("La date de fin doit être après la date de début.");
  if (row.goal_value !== null && row.goal_value <= 0) return fail("L'objectif doit être positif.");

  const supabase = await createClient();
  let target = id;
  if (id) {
    const { error } = await supabase.from("challenges").update(row).eq("id", id);
    if (error) return fail(error.message);
  } else {
    const { data, error } = await supabase.from("challenges").insert({ ...row, created_by: me.id }).select("id").single();
    if (error) return fail(error.message);
    target = (data as { id: string }).id;
  }
  revalidateAll(target ?? undefined);
  redirect(`/defis/${target}`);
}

export async function deleteChallengeAction(fd: FormData) {
  if (!(await staffOnly())) return;
  const id = String(fd.get("id"));
  const supabase = await createClient();
  await supabase.from("challenge_entries").delete().eq("challenge_id", id);
  await supabase.from("challenges").delete().eq("id", id);
  revalidateAll();
  redirect("/defis");
}

/** Mise à jour manuelle d'un score (pas / personnalisé, ou ajout d'un participant). */
export async function setScoreAction(_: FormState, fd: FormData): Promise<FormState> {
  if (!(await staffOnly())) return fail("Accès refusé.");
  const challenge_id = String(fd.get("challenge_id"));
  const client_id = str(fd.get("client_id"));
  const value = parseNum(fd.get("value"));
  if (!client_id) return fail("Choisissez un membre.");
  if (value === null || value < 0) return fail("Valeur invalide.");
  const supabase = await createClient();
  const { error } = await setEntry(supabase, challenge_id, client_id, value);
  if (error) return fail(error.message);
  revalidateAll(challenge_id);
  return undefined;
}

export async function removeEntryAction(fd: FormData) {
  if (!(await staffOnly())) return;
  const challenge_id = String(fd.get("challenge_id"));
  const supabase = await createClient();
  await supabase.from("challenge_entries").delete().eq("id", String(fd.get("entry_id")));
  revalidateAll(challenge_id);
}

/** Enregistre les scores calculés (présences, squat) pour que tous les adhérents voient le même classement. */
async function persistScores(supabase: SupabaseClient, ch: Challenge) {
  const data = await loadScoreData(supabase, [ch]);
  const rows = computeLeaderboard(ch, data);
  if (METRICS[ch.metric].auto) {
    for (const r of rows) {
      const current = data.entries.find((e) => e.client_id === r.client_id);
      if (!current || Number(current.value) !== r.value) await setEntry(supabase, ch.id, r.client_id, r.value);
    }
  }
  return { rows, clients: data.clients };
}

export async function refreshScoresAction(fd: FormData) {
  if (!(await staffOnly())) return;
  const id = String(fd.get("id"));
  const supabase = await createClient();
  const { data } = await supabase.from("challenges").select("*").eq("id", id).maybeSingle();
  if (data) await persistScores(supabase, data as Challenge);
  revalidateAll(id);
}

/** Clôture le défi (si en cours) et annonce le gagnant aux participants ayant un compte. */
export async function closeChallengeAction(fd: FormData) {
  if (!(await staffOnly())) return;
  const id = String(fd.get("id"));
  const supabase = await createClient();
  const { data } = await supabase.from("challenges").select("*").eq("id", id).maybeSingle();
  if (!data) return;
  const ch = data as Challenge;
  const { rows, clients } = await persistScores(supabase, ch);

  if (challengeStatus(ch) !== "termine") {
    // Fin au jour d'hier → le défi passe immédiatement dans « Terminés »
    const y = new Date(`${todayKey()}T12:00:00Z`);
    y.setUTCDate(y.getUTCDate() - 1);
    const yesterday = y.toISOString().slice(0, 10);
    await supabase
      .from("challenges")
      .update({ end_date: yesterday, start_date: ch.start_date > yesterday ? yesterday : ch.start_date })
      .eq("id", id);
  }

  const byId = new Map(clients.map((c) => [c.id, c] as [string, Client]));
  const winners = rows.filter((r) => r.rank === 1 && r.value > 0);
  const winnerNames = winners.map((w) => (byId.get(w.client_id)?.full_name ?? w.name).split(" ")[0]).join(" & ");
  const unit = ch.unit ?? METRICS[ch.metric].unit;
  for (const r of rows) {
    const c = byId.get(r.client_id);
    if (!c?.user_id) continue;
    const won = winners.some((w) => w.client_id === r.client_id);
    await supabase.from("notifications").insert({
      user_id: c.user_id,
      title: won ? `🏆 Bravo, tu remportes « ${ch.title} » !` : `${ch.cover ?? "🏆"} Défi « ${ch.title} » terminé`,
      body: won
        ? `Tu termines 1er avec ${r.value} ${unit}.${ch.reward ? ` Ta récompense : ${ch.reward}.` : ""}`
        : `${winnerNames ? `Victoire de ${winnerNames}. ` : ""}Tu termines ${r.rank}e avec ${r.value} ${unit}. Bravo pour ta participation !`,
      link: "/moi/defis",
      kind: "info",
      read: false,
    });
  }
  for (const w of winners) await syncBadges(supabase, w.client_id);
  revalidateAll(id);
  redirect(`/defis/${id}?annonce=1`);
}

/** Recalcule les badges de tous les clients actifs. */
export async function syncAllBadgesAction() {
  if (!(await staffOnly())) return;
  const supabase = await createClient();
  const { data } = await supabase.from("clients").select("*").neq("status", "termine");
  for (const c of (data ?? []) as Client[]) await syncBadges(supabase, c.id);
  revalidateAll();
  redirect("/defis?badges=ok#badges");
}

/* ================= Espace adhérent ================= */
export async function addStepsAction(_: FormState, fd: FormData): Promise<FormState> {
  const me = await getProfile();
  const supabase = await createClient();
  const { data: c } = await supabase.from("clients").select("*").eq("user_id", me.id).maybeSingle();
  if (!c) return fail("Ton dossier n'est pas encore relié.");
  const challenge_id = String(fd.get("challenge_id"));
  const steps = parseNum(fd.get("steps"));
  if (steps === null || steps <= 0) return fail("Indique un nombre de pas valide.");
  if (steps > 80000) return fail("Waouh ! Plus de 80 000 pas en un jour ? Vérifie ta saisie 😉");
  const { data: ch } = await supabase.from("challenges").select("*").eq("id", challenge_id).maybeSingle();
  if (!ch) return fail("Défi introuvable.");
  const challenge = ch as Challenge;
  if (challenge.metric !== "pas") return fail("Ce défi ne se joue pas en nombre de pas.");
  if (challengeStatus(challenge) !== "en_cours") return fail("Ce défi n'est pas en cours.");
  const client = c as Client;
  const { data: e } = await supabase.from("challenge_entries").select("*").eq("challenge_id", challenge_id).eq("client_id", client.id).maybeSingle();
  const total = (e ? Number((e as ChallengeEntry).value) : 0) + Math.round(steps);
  const { error } = await setEntry(supabase, challenge_id, client.id, total);
  if (error) return fail(error.message);
  revalidateAll(challenge_id);
  return undefined;
}
