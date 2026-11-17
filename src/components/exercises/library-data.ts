import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Exercise } from "@/lib/types";
import { normName } from "@/lib/video";

/** Bibliothèque d'exercices (mise en cache par requête). */
export const getExerciseLibrary = cache(async (): Promise<Exercise[]> => {
  try {
    const supabase = await createClient();
    const { data } = await supabase.from("exercises").select("*").order("name");
    return ((data ?? []) as Exercise[]).map((e) => ({ ...e, muscles: Array.isArray(e.muscles) ? e.muscles : [] }));
  } catch {
    return [];
  }
});

export function libraryIndex(list: Exercise[]) {
  return new Map(list.map((e) => [normName(e.name), e]));
}
