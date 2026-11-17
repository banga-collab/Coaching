import { createClient } from "@/lib/supabase/server";
import type { Client, Food, Measurement } from "@/lib/types";
import { age } from "@/lib/utils";
import type { BuilderClient } from "./plan-builder";

/** Données nécessaires au constructeur de plan : aliments + clients (avec infos pour le calculateur) */
export async function loadBuilderData() {
  const supabase = await createClient();
  const [{ data: fData }, { data: cData }, { data: mData }] = await Promise.all([
    supabase.from("foods").select("*").order("name"),
    supabase.from("clients").select("*").neq("status", "termine").order("full_name"),
    supabase.from("measurements").select("client_id, weight_kg, measured_on").not("weight_kg", "is", null).order("measured_on"),
  ]);
  const lastWeight = new Map<string, number>();
  ((mData ?? []) as Pick<Measurement, "client_id" | "weight_kg">[]).forEach((m) => {
    if (m.weight_kg !== null) lastWeight.set(m.client_id, Number(m.weight_kg));
  });
  const clients: BuilderClient[] = ((cData ?? []) as Client[]).map((c) => ({
    id: c.id,
    name: c.full_name,
    sex: c.sex,
    age: age(c.birth_date),
    height: c.height_cm,
    weight: lastWeight.get(c.id) ?? null,
  }));
  return { foods: (fData ?? []) as Food[], clients };
}
