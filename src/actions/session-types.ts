"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProfile, isManager } from "@/lib/auth";
import { loadSessionTypes, readPrice } from "@/lib/session-extras";
import { parseNum, str } from "@/lib/utils";
import type { FormState } from "@/components/action-form";

async function managerOnly() {
  const me = await getProfile();
  if (!isManager(me.role)) throw new Error("Réservé à l'admin et au head coach.");
  return me;
}

function refresh() {
  revalidatePath("/seances/types");
  revalidatePath("/seances/nouvelle");
  revalidatePath("/planning");
}

/** La liste par défaut n'existe qu'en code : on la copie en base avant la première modification. */
async function materialize() {
  const supabase = await createClient();
  const list = await loadSessionTypes(supabase, true);
  const defaults = list.filter((t) => t.id.startsWith("default-"));
  if (defaults.length) await supabase.from("session_types").insert(defaults.map((t) => ({ name: t.name, active: true, position: t.position, duration_min: null, color: null })));
  return supabase;
}

export async function addSessionTypeAction(_: FormState, fd: FormData): Promise<FormState> {
  await managerOnly();
  const name = str(fd.get("name"))?.replace(/\s+/g, " ").trim().slice(0, 80);
  if (!name) return { error: "Indique le nom du type de séance." };
  const supabase = await materialize();
  const list = await loadSessionTypes(supabase, true);
  if (list.some((t) => t.name.toLowerCase() === name.toLowerCase())) return { error: `« ${name} » existe déjà.` };
  const d = parseNum(fd.get("duration_min"));
  const price = readPrice(fd.get("price_mad"));
  if ("error" in price) return { error: price.error };
  const { error } = await supabase
    .from("session_types")
    .insert({ name, active: true, position: list.length, duration_min: d ? Math.round(d) : null, color: str(fd.get("color")), ...(price.price !== null ? { price_mad: price.price } : {}) });
  if (error) return { error: error.message };
  refresh();
  return undefined;
}

/** Prix indicatif par défaut d'un type (DH, vide = aucun) : pré-remplit le champ « Prix » des formulaires de séance */
export async function setSessionTypePriceAction(_: FormState, fd: FormData): Promise<FormState> {
  await managerOnly();
  const price = readPrice(fd.get("price_mad"));
  if ("error" in price) return { error: price.error };
  const supabase = await materialize();
  const name = str(fd.get("name"));
  const list = await loadSessionTypes(supabase, true);
  const t = list.find((x) => x.name === name);
  if (!t) return { error: "Type introuvable." };
  const { error } = await supabase.from("session_types").update({ price_mad: price.price }).eq("id", t.id);
  if (error) return { error: error.message.includes("price_mad") ? "Colonne « price_mad » absente : exécute supabase/v5-planning-2.sql." : error.message };
  refresh();
  return undefined;
}

export async function toggleSessionTypeAction(fd: FormData) {
  await managerOnly();
  const supabase = await materialize();
  const name = str(fd.get("name"));
  const list = await loadSessionTypes(supabase, true);
  const t = list.find((x) => x.name === name);
  if (t) await supabase.from("session_types").update({ active: !t.active }).eq("id", t.id);
  refresh();
}

export async function deleteSessionTypeAction(fd: FormData) {
  await managerOnly();
  const supabase = await materialize();
  const name = str(fd.get("name"));
  const list = await loadSessionTypes(supabase, true);
  const t = list.find((x) => x.name === name);
  if (t) await supabase.from("session_types").delete().eq("id", t.id);
  refresh();
}

export async function moveSessionTypeAction(fd: FormData) {
  await managerOnly();
  const supabase = await materialize();
  const name = str(fd.get("name"));
  const dir = str(fd.get("dir")) === "up" ? -1 : 1;
  const list = await loadSessionTypes(supabase, true);
  const i = list.findIndex((x) => x.name === name);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return;
  const order = [...list];
  [order[i], order[j]] = [order[j]!, order[i]!];
  await Promise.all(order.map((t, pos) => (t.position === pos ? null : supabase.from("session_types").update({ position: pos }).eq("id", t.id))));
  refresh();
}
