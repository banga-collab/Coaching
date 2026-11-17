"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { str } from "@/lib/utils";
import { EXERCISE_CATEGORIES, EXERCISE_LEVELS, normName, parseVideo } from "@/lib/video";
import type { FormState } from "@/components/action-form";
import type { Exercise } from "@/lib/types";

const fail = (error: string): FormState => ({ error });

async function staff() {
  const me = await getProfile();
  if (me.role === "client") throw new Error("Accès refusé.");
  return me;
}

function revalidateAll() {
  revalidatePath("/exercices");
  revalidatePath("/programmes", "layout");
  revalidatePath("/moi/seance");
}

/** Création / modification d'un exercice de la vidéothèque. */
export async function saveExerciseAction(_: FormState, fd: FormData): Promise<FormState> {
  await staff();
  const id = str(fd.get("id"));
  const name = str(fd.get("name"))?.slice(0, 120);
  if (!name) return fail("Le nom de l'exercice est obligatoire.");

  const categoryRaw = str(fd.get("category")) ?? "Musculation";
  const category = EXERCISE_CATEGORIES.includes(categoryRaw) ? categoryRaw : categoryRaw.slice(0, 40);
  const levelRaw = str(fd.get("level"));
  const level = levelRaw && EXERCISE_LEVELS.includes(levelRaw) ? levelRaw : "Tous niveaux";
  const muscles = [...new Set(fd.getAll("muscles").map((m) => String(m).trim().slice(0, 40)).filter(Boolean))].slice(0, 12);
  const video_url = str(fd.get("video_url"))?.slice(0, 500) ?? null;
  if (video_url && !parseVideo(video_url)) return fail("Lien vidéo non reconnu : utilise un lien YouTube, Vimeo ou un fichier .mp4.");

  const supabase = await createClient();
  // Unicité du nom (insensible à la casse et aux accents)
  const { data: all } = await supabase.from("exercises").select("id, name");
  const dup = ((all ?? []) as Pick<Exercise, "id" | "name">[]).find((e) => normName(e.name) === normName(name) && e.id !== id);
  if (dup) return fail(`Un exercice « ${dup.name} » existe déjà dans la vidéothèque.`);

  const row = {
    name,
    category,
    muscles,
    equipment: str(fd.get("equipment"))?.slice(0, 80) ?? null,
    level,
    video_url,
    instructions: str(fd.get("instructions"))?.slice(0, 3000) ?? null,
    tips: str(fd.get("tips"))?.slice(0, 2000) ?? null,
  };

  if (id) {
    const { error } = await supabase.from("exercises").update(row).eq("id", id);
    if (error) return fail("Impossible d'enregistrer l'exercice : " + error.message);
  } else {
    const { error } = await supabase.from("exercises").insert(row);
    if (error) return fail("Impossible de créer l'exercice : " + error.message);
  }
  revalidateAll();
  redirect(`/exercices?ok=${id ? "maj" : "ajout"}`);
}

export async function deleteExerciseAction(fd: FormData): Promise<void> {
  await staff();
  const id = str(fd.get("id"));
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("exercises").delete().eq("id", id);
  revalidateAll();
  redirect("/exercices?ok=suppr");
}
