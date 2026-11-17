"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import type { Client, WorkoutEntry } from "@/lib/types";

export type SaveWorkoutInput = {
  programId: string | null;
  dayTitle: string;
  startedAt: string;
  entries: { exercise: string; target?: string | null; sets: { reps: string; load: string; done: boolean }[] }[];
  rpe: number | null;
  notes: string | null;
};

export type SaveWorkoutResult = { ok: true; id: string } | { ok: false; error: string };

const clip = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

function cleanEntries(raw: SaveWorkoutInput["entries"]): WorkoutEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 40).flatMap((e) => {
    const exercise = clip(e?.exercise, 120);
    if (!exercise) return [];
    const sets = (Array.isArray(e.sets) ? e.sets : []).slice(0, 30).map((s) => {
      const repsTxt = clip(String(s?.reps ?? ""), 20);
      const repsN = Number(repsTxt.replace(",", "."));
      const loadN = Number(clip(String(s?.load ?? ""), 12).replace(",", "."));
      return {
        reps: repsTxt === "" ? null : Number.isFinite(repsN) && /^\d+([.,]\d+)?$/.test(repsTxt) ? repsN : repsTxt,
        load: Number.isFinite(loadN) && loadN > 0 ? Math.min(1000, Math.round(loadN * 4) / 4) : null,
        done: !!s?.done,
      };
    });
    return [{ exercise, target: clip(e.target ?? "", 40) || null, sets }];
  });
}

/** Enregistre une séance réalisée par l'adhérent (suivi en direct). */
export async function saveWorkoutAction(input: SaveWorkoutInput): Promise<SaveWorkoutResult> {
  const me = await getProfile();
  const supabase = await createClient();
  const { data: cData } = await supabase.from("clients").select("*").eq("user_id", me.id).maybeSingle();
  if (!cData) return { ok: false, error: "Ton dossier n'est pas relié à ton compte." };
  const client = cData as Client;

  const entries = cleanEntries(input?.entries);
  if (!entries.some((e) => e.sets.some((s) => s.done))) return { ok: false, error: "Valide au moins une série avant de terminer ta séance." };

  const now = new Date();
  let started = new Date(input.startedAt);
  if (Number.isNaN(started.getTime()) || started > now || now.getTime() - started.getTime() > 12 * 3600_000) started = new Date(now.getTime() - 3600_000);
  const rpe = input.rpe && Number.isInteger(input.rpe) && input.rpe >= 1 && input.rpe <= 10 ? input.rpe : null;
  const dayTitle = clip(input.dayTitle, 120) || "Séance libre";
  const notes = clip(input.notes ?? "", 1000) || null;

  let programId: string | null = null;
  if (input.programId) {
    const { data: link } = await supabase.from("client_programs").select("id").eq("client_id", client.id).eq("program_id", input.programId).maybeSingle();
    if (link) programId = input.programId;
  }

  const { data, error } = await supabase
    .from("workout_logs")
    .insert({
      client_id: client.id,
      program_id: programId,
      day_title: dayTitle,
      started_at: started.toISOString(),
      finished_at: now.toISOString(),
      entries,
      rpe,
      notes,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: "Impossible d'enregistrer ta séance : " + (error?.message ?? "erreur inconnue") };

  // Compte aussi la séance dans les présences du coach (peut échouer sous RLS en mode réel : on ignore).
  try {
    await supabase.from("sessions").insert({
      client_id: client.id,
      coach_id: client.coach_id,
      starts_at: started.toISOString(),
      duration_min: Math.max(1, Math.round((now.getTime() - started.getTime()) / 60000)),
      type: dayTitle,
      status: "realisee",
      rpe,
      notes: notes ? `Séance en autonomie — ${notes}` : "Séance en autonomie (suivi en direct)",
    });
  } catch {
    /* ignoré */
  }

  revalidatePath("/moi/seance");
  revalidatePath(`/clients/${client.id}`);
  return { ok: true, id: (data as { id: string }).id };
}
