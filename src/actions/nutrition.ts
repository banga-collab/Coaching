"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { parseNum, str } from "@/lib/utils";
import type { FormState } from "@/components/action-form";
import type { Food, MealPlan } from "@/lib/types";
import { FOOD_CATEGORIES, WATER_MEAL, cleanMeals, round1 } from "@/components/nutrition/shared";

function fail(msg: string): FormState {
  return { error: msg };
}

async function staff() {
  const me = await getProfile();
  return me.role === "client" ? null : me;
}

/** Fiche client de l'adhérent connecté */
async function myClientId() {
  const me = await getProfile();
  const supabase = await createClient();
  const { data } = await supabase.from("clients").select("id").eq("user_id", me.id).maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

function revalidateNutrition(clientId?: string | null) {
  revalidatePath("/nutrition", "layout");
  revalidatePath("/moi/nutrition");
  if (clientId) revalidatePath(`/clients/${clientId}`);
}

const isDate = (s: string | null): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

/* ================= Aliments ================= */
export async function saveFoodAction(_: FormState, fd: FormData): Promise<FormState> {
  if (!(await staff())) return fail("Accès refusé.");
  const id = str(fd.get("id"));
  const name = str(fd.get("name"));
  if (!name) return fail("Donne un nom à l'aliment.");
  const kcal = parseNum(fd.get("kcal"));
  if (kcal === null || kcal < 0 || kcal > 5000) return fail("Indique les calories de la portion (0 à 5 000 kcal).");
  const grams = parseNum(fd.get("grams")) ?? 100;
  if (grams <= 0 || grams > 5000) return fail("Le poids de la portion doit être compris entre 1 et 5 000 g.");
  const macro = (k: string) => Math.max(0, round1(parseNum(fd.get(k)) ?? 0));
  const category = str(fd.get("category")) ?? "Autre";
  const row = {
    name: name.slice(0, 120),
    category: FOOD_CATEGORIES.includes(category) ? category : "Autre",
    portion: str(fd.get("portion"))?.slice(0, 80) ?? null,
    grams,
    kcal: round1(kcal),
    protein: macro("protein"),
    carbs: macro("carbs"),
    fat: macro("fat"),
    moroccan: fd.get("moroccan") === "on" || category === "Plats marocains",
  };
  const supabase = await createClient();
  const { error } = id ? await supabase.from("foods").update(row).eq("id", id) : await supabase.from("foods").insert(row);
  if (error) return fail(error.message);
  revalidatePath("/nutrition", "layout");
  revalidatePath("/moi/nutrition");
  redirect(`/nutrition?vue=aliments&ok=${id ? "maj" : "ajout"}`);
}

export async function deleteFoodAction(fd: FormData) {
  if (!(await staff())) return;
  const supabase = await createClient();
  await supabase.from("foods").delete().eq("id", String(fd.get("id")));
  revalidatePath("/nutrition", "layout");
  redirect("/nutrition?vue=aliments");
}

/* ================= Plans alimentaires ================= */
async function deactivateOthers(clientId: string, keepId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("meal_plans").select("id").eq("client_id", clientId).eq("active", true);
  const others = ((data ?? []) as { id: string }[]).filter((p) => p.id !== keepId).map((p) => p.id);
  if (others.length) await supabase.from("meal_plans").update({ active: false }).in("id", others);
}

export async function saveMealPlanAction(_: FormState, fd: FormData): Promise<FormState> {
  const me = await staff();
  if (!me) return fail("Accès refusé.");
  const id = str(fd.get("id"));
  const name = str(fd.get("name"));
  if (!name) return fail("Donne un nom au plan.");
  let meals;
  try {
    meals = cleanMeals(JSON.parse(String(fd.get("meals") ?? "[]")));
  } catch {
    return fail("Format des repas invalide.");
  }
  if (!meals.some((m) => m.items.length)) return fail("Ajoute au moins un aliment à un repas.");
  const int = (k: string) => {
    const v = parseNum(fd.get(k));
    return v === null || v < 0 ? null : Math.round(v);
  };
  const target_kcal = int("target_kcal");
  if (target_kcal !== null && (target_kcal < 800 || target_kcal > 6000)) return fail("L'objectif calorique doit être compris entre 800 et 6 000 kcal.");
  const client_id = str(fd.get("client_id"));
  const row = {
    name: name.slice(0, 120),
    goal: str(fd.get("goal"))?.slice(0, 60) ?? null,
    target_kcal,
    protein_g: int("protein_g"),
    carbs_g: int("carbs_g"),
    fat_g: int("fat_g"),
    notes: str(fd.get("notes"))?.slice(0, 2000) ?? null,
    meals,
    client_id,
  };
  const supabase = await createClient();
  let planId = id;
  if (id) {
    const { error } = await supabase.from("meal_plans").update(row).eq("id", id);
    if (error) return fail(error.message);
  } else {
    const { data, error } = await supabase.from("meal_plans").insert({ ...row, active: true, created_by: me.id }).select("id").single();
    if (error || !data) return fail(error?.message ?? "Impossible de créer le plan.");
    planId = (data as { id: string }).id;
  }
  if (client_id && planId) {
    await supabase.from("meal_plans").update({ active: true }).eq("id", planId);
    await deactivateOthers(client_id, planId);
  }
  revalidateNutrition(client_id);
  redirect(client_id ? `/clients/${client_id}?tab=nutrition` : `/nutrition/${planId}`);
}

/** Copie un plan (souvent un modèle) vers un client et l'active */
export async function duplicatePlanAction(_: FormState, fd: FormData): Promise<FormState> {
  const me = await staff();
  if (!me) return fail("Accès refusé.");
  const planId = str(fd.get("plan_id"));
  const clientId = str(fd.get("client_id"));
  if (!planId) return fail("Choisis un plan à copier.");
  if (!clientId) return fail("Choisis le client qui recevra ce plan.");
  const supabase = await createClient();
  const { data } = await supabase.from("meal_plans").select("*").eq("id", planId).maybeSingle();
  const p = data as MealPlan | null;
  if (!p) return fail("Plan introuvable.");
  const name = p.client_id === null ? p.name.replace(/^Modèle\s*[–-]\s*/i, "") : `${p.name} (copie)`;
  const { data: ins, error } = await supabase
    .from("meal_plans")
    .insert({
      client_id: clientId,
      name,
      goal: p.goal,
      target_kcal: p.target_kcal,
      protein_g: p.protein_g,
      carbs_g: p.carbs_g,
      fat_g: p.fat_g,
      meals: p.meals,
      notes: p.notes,
      active: true,
      created_by: me.id,
    })
    .select("id")
    .single();
  if (error || !ins) return fail(error?.message ?? "Impossible d'assigner ce plan.");
  await deactivateOthers(clientId, (ins as { id: string }).id);
  revalidateNutrition(clientId);
  redirect(`/clients/${clientId}?tab=nutrition`);
}

export async function setPlanActiveAction(fd: FormData) {
  if (!(await staff())) return;
  const id = String(fd.get("id"));
  const active = fd.get("active") === "1";
  const supabase = await createClient();
  const { data } = await supabase.from("meal_plans").select("client_id").eq("id", id).maybeSingle();
  const clientId = (data as { client_id: string | null } | null)?.client_id ?? null;
  await supabase.from("meal_plans").update({ active }).eq("id", id);
  if (active && clientId) await deactivateOthers(clientId, id);
  revalidateNutrition(clientId);
}

export async function deletePlanAction(fd: FormData) {
  if (!(await staff())) return;
  const id = String(fd.get("id"));
  const supabase = await createClient();
  const { data } = await supabase.from("meal_plans").select("client_id").eq("id", id).maybeSingle();
  const clientId = (data as { client_id: string | null } | null)?.client_id ?? null;
  await supabase.from("meal_plans").delete().eq("id", id);
  revalidateNutrition(clientId);
  const back = String(fd.get("back") ?? "");
  redirect(back.startsWith("/") && !back.startsWith("//") ? back : "/nutrition");
}

/* ================= Journal alimentaire (adhérent) ================= */
export async function addFoodLogAction(input: { date: string; meal: string; foodId: string; qty: number }): Promise<{ error?: string }> {
  const clientId = await myClientId();
  if (!clientId) return { error: "Ton dossier n'est pas encore relié." };
  if (!isDate(input.date)) return { error: "Date invalide." };
  const qty = Number(input.qty);
  if (!Number.isFinite(qty) || qty <= 0 || qty > 20) return { error: "Portion invalide." };
  const meal = String(input.meal || "").trim().slice(0, 40) || "Déjeuner";
  const supabase = await createClient();
  const { data } = await supabase.from("foods").select("*").eq("id", input.foodId).maybeSingle();
  const food = data as Food | null;
  if (!food) return { error: "Aliment introuvable." };
  const { error } = await supabase.from("food_logs").insert({
    client_id: clientId,
    logged_on: input.date,
    meal,
    food_name: food.name,
    qty,
    kcal: round1(food.kcal * qty),
    protein: round1(food.protein * qty),
    carbs: round1(food.carbs * qty),
    fat: round1(food.fat * qty),
    water_ml: null,
  });
  if (error) return { error: error.message };
  revalidateNutrition(clientId);
  return {};
}

export async function deleteFoodLogAction(id: string): Promise<{ error?: string }> {
  const clientId = await myClientId();
  if (!clientId) return { error: "Accès refusé." };
  const supabase = await createClient();
  const { error } = await supabase.from("food_logs").delete().eq("id", id).eq("client_id", clientId);
  if (error) return { error: error.message };
  revalidateNutrition(clientId);
  return {};
}

/** Eau : une ligne « Eau » par jour dont on ajuste water_ml */
export async function addWaterAction(date: string, delta: number): Promise<{ error?: string }> {
  const clientId = await myClientId();
  if (!clientId) return { error: "Accès refusé." };
  if (!isDate(date)) return { error: "Date invalide." };
  const step = Math.max(-1000, Math.min(1000, Math.round(delta)));
  const supabase = await createClient();
  const { data } = await supabase.from("food_logs").select("*").eq("client_id", clientId).eq("logged_on", date).eq("meal", WATER_MEAL);
  const rows = (data ?? []) as { id: string; water_ml: number | null }[];
  const total = rows.reduce((s, r) => s + (r.water_ml ?? 0), 0);
  const next = Math.max(0, Math.min(8000, total + step));
  const [first, ...rest] = rows;
  let error: { message: string } | null = null;
  if (first) {
    ({ error } = await supabase.from("food_logs").update({ water_ml: next }).eq("id", first.id));
    if (rest.length) await supabase.from("food_logs").delete().in("id", rest.map((r) => r.id));
  } else if (next > 0) {
    ({ error } = await supabase.from("food_logs").insert({
      client_id: clientId,
      logged_on: date,
      meal: WATER_MEAL,
      food_name: WATER_MEAL,
      qty: 1,
      kcal: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      water_ml: next,
    }));
  }
  if (error) return { error: error.message };
  revalidateNutrition(clientId);
  return {};
}
