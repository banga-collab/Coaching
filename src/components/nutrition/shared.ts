/** Constantes et calculs partagés du module Nutrition (utilisables côté serveur et client). */
import type { Food, Meal, MealItem, MealPlan } from "@/lib/types";

export const MACRO_COLORS = { kcal: "#e8782a", protein: "#1a6d8e", carbs: "#f2a93b", fat: "#14a38b" } as const;
export const MACRO_LABELS = { protein: "Protéines", carbs: "Glucides", fat: "Lipides" } as const;

export const FOOD_CATEGORIES = [
  "Plats marocains",
  "Protéines",
  "Féculents",
  "Légumineuses",
  "Légumes",
  "Fruits",
  "Produits laitiers",
  "Oléagineux",
  "Matières grasses",
  "Boissons",
  "Compléments",
  "Autre",
];

export const JOURNAL_MEALS = ["Petit-déjeuner", "Déjeuner", "Collation", "Dîner"];
export const PLAN_GOALS = ["Perte de poids", "Maintien", "Prise de masse", "Santé", "Performance"];
export const WATER_MEAL = "Eau";
export const WATER_GOAL_ML = 2000;
export const WATER_STEP_ML = 250;

export type Totals = { kcal: number; protein: number; carbs: number; fat: number };
export const ZERO: Totals = { kcal: 0, protein: 0, carbs: 0, fat: 0 };

export function addTotals(a: Totals, b: Partial<Totals>): Totals {
  return {
    kcal: a.kcal + Number(b.kcal ?? 0),
    protein: a.protein + Number(b.protein ?? 0),
    carbs: a.carbs + Number(b.carbs ?? 0),
    fat: a.fat + Number(b.fat ?? 0),
  };
}

export function mealTotals(meal: Pick<Meal, "items">): Totals {
  return (meal.items ?? []).reduce<Totals>((t, i) => addTotals(t, i), ZERO);
}

export function planTotals(meals: Meal[] | null | undefined): Totals {
  return (meals ?? []).reduce<Totals>((t, m) => addTotals(t, mealTotals(m)), ZERO);
}

/** Répartition énergétique (en %) des macros : protéines 4, glucides 4, lipides 9 kcal/g */
export function macroSplit(t: Pick<Totals, "protein" | "carbs" | "fat">) {
  const p = t.protein * 4;
  const c = t.carbs * 4;
  const f = t.fat * 9;
  const sum = p + c + f;
  if (!sum) return { protein: 0, carbs: 0, fat: 0 };
  return { protein: Math.round((p / sum) * 100), carbs: Math.round((c / sum) * 100), fat: Math.max(0, 100 - Math.round((p / sum) * 100) - Math.round((c / sum) * 100)) };
}

/** Cibles du plan, ou à défaut ce que contient le plan */
export function planTargets(plan: Pick<MealPlan, "target_kcal" | "protein_g" | "carbs_g" | "fat_g" | "meals">): Totals {
  const t = planTotals(plan.meals);
  return {
    kcal: plan.target_kcal ?? Math.round(t.kcal),
    protein: plan.protein_g ?? Math.round(t.protein),
    carbs: plan.carbs_g ?? Math.round(t.carbs),
    fat: plan.fat_g ?? Math.round(t.fat),
  };
}

export function itemFromFood(food: Food, qty = 1): MealItem {
  return {
    food_id: food.id,
    name: food.name,
    qty,
    kcal: round1(food.kcal * qty),
    protein: round1(food.protein * qty),
    carbs: round1(food.carbs * qty),
    fat: round1(food.fat * qty),
  };
}

export function round1(n: number) {
  return Math.round(n * 10) / 10;
}

export function fmtQty(q: number) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(q);
}

export function pct(value: number, target: number) {
  if (!target) return 0;
  return Math.round((value / target) * 100);
}

/* ---------- Calculateur (Mifflin-St Jeor) ---------- */
export const ACTIVITY_LEVELS = [
  { key: "1.2", label: "Sédentaire", hint: "Peu ou pas d'exercice" },
  { key: "1.375", label: "Légèrement actif", hint: "1 à 3 séances / semaine" },
  { key: "1.55", label: "Modérément actif", hint: "3 à 5 séances / semaine" },
  { key: "1.725", label: "Très actif", hint: "6 à 7 séances / semaine" },
  { key: "1.9", label: "Extrêmement actif", hint: "Travail physique + entraînement" },
] as const;

export const CALC_GOALS = [
  { key: "perte", label: "Perte de poids", adjust: -0.2, proteinPerKg: 2.0, plan: "Perte de poids" },
  { key: "maintien", label: "Maintien", adjust: 0, proteinPerKg: 1.6, plan: "Maintien" },
  { key: "prise", label: "Prise de masse", adjust: 0.12, proteinPerKg: 1.8, plan: "Prise de masse" },
] as const;
export type CalcGoal = (typeof CALC_GOALS)[number]["key"];

export type CalcInput = { sex: "H" | "F"; age: number; weight: number; height: number; activity: number; goal: CalcGoal };

export function calcTargets(i: CalcInput) {
  const bmr = 10 * i.weight + 6.25 * i.height - 5 * i.age + (i.sex === "H" ? 5 : -161);
  const tdee = bmr * i.activity;
  const g = CALC_GOALS.find((x) => x.key === i.goal) ?? CALC_GOALS[1];
  const kcal = Math.round((tdee * (1 + g.adjust)) / 10) * 10;
  const protein = Math.round(i.weight * g.proteinPerKg);
  const fat = Math.round(Math.max(i.weight * 0.8, (kcal * 0.25) / 9));
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  return { bmr: Math.round(bmr), tdee: Math.round(tdee), kcal, protein, carbs, fat };
}

/** Sanitize les repas envoyés par le formulaire */
export function cleanMeals(raw: unknown): Meal[] {
  if (!Array.isArray(raw)) return [];
  const n = (v: unknown) => {
    const x = Number(v);
    return Number.isFinite(x) && x >= 0 ? round1(x) : 0;
  };
  return (raw as Record<string, unknown>[])
    .slice(0, 12)
    .map((m) => ({
      name: String(m?.name ?? "").trim().slice(0, 60) || "Repas",
      time: /^\d{2}:\d{2}$/.test(String(m?.time ?? "")) ? String(m.time) : null,
      items: (Array.isArray(m?.items) ? (m.items as Record<string, unknown>[]) : [])
        .slice(0, 40)
        .map((i) => ({
          food_id: i?.food_id ? String(i.food_id) : null,
          name: String(i?.name ?? "").trim().slice(0, 120),
          qty: Math.min(50, Math.max(0.1, n(i?.qty) || 1)),
          kcal: n(i?.kcal),
          protein: n(i?.protein),
          carbs: n(i?.carbs),
          fat: n(i?.fat),
        }))
        .filter((i) => i.name),
    }));
}
