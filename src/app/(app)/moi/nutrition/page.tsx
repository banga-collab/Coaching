import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, ChevronRight, ClipboardList, Hourglass, NotebookPen, ShoppingCart, UtensilsCrossed } from "lucide-react";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Client, Food, FoodLog, MealPlan } from "@/lib/types";
import { addDays, cn, dayKey, fmtDate, num } from "@/lib/utils";
import { Card, Empty, PageHeader } from "@/components/ui";
import { Ring } from "@/components/nutrition/macro-visuals";
import { FoodJournal } from "@/components/nutrition/food-journal";
import { WaterTracker } from "@/components/nutrition/water-tracker";
import { ShoppingList, type ShopItem } from "@/components/nutrition/shopping-list";
import { PlanMeals, PlanSummary } from "@/components/nutrition/plan-view";
import { MACRO_COLORS, WATER_MEAL, fmtQty, planTargets } from "@/components/nutrition/shared";

export const metadata = { title: "Ma nutrition" };

const VUES = [
  { key: "journal", label: "Journal", icon: NotebookPen },
  { key: "plan", label: "Mon plan", icon: ClipboardList },
  { key: "courses", label: "Courses", icon: ShoppingCart },
] as const;

export default async function MyNutritionPage({ searchParams }: { searchParams: Promise<{ date?: string; vue?: string }> }) {
  const me = await getProfile();
  if (me.role !== "client") redirect("/nutrition");
  const sp = await searchParams;
  const vue = VUES.some((v) => v.key === sp.vue) ? (sp.vue as (typeof VUES)[number]["key"]) : "journal";
  const today = dayKey(new Date());
  const date = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) && sp.date <= today ? sp.date : today;

  const supabase = await createClient();
  const { data: cData } = await supabase.from("clients").select("*").eq("user_id", me.id).maybeSingle();
  if (!cData) {
    return (
      <>
        <PageHeader title="Ma nutrition" />
        <Card>
          <Empty icon={<Hourglass className="size-6" />} title="Ton dossier n'est pas encore relié" text={`Demande à ton coach d'ajouter ton e-mail (${me.email}) à ta fiche.`} />
        </Card>
      </>
    );
  }
  const c = cData as Client;
  const [{ data: pData }, { data: fData }, { data: lData }] = await Promise.all([
    supabase.from("meal_plans").select("*").eq("client_id", c.id).eq("active", true).order("created_at", { ascending: false }).limit(1),
    supabase.from("foods").select("*").order("name"),
    supabase.from("food_logs").select("*").eq("client_id", c.id).eq("logged_on", date).order("created_at"),
  ]);
  const plan = ((pData ?? []) as MealPlan[])[0] ?? null;
  const foods = (fData ?? []) as Food[];
  const all = (lData ?? []) as FoodLog[];
  const logs = all.filter((l) => l.meal !== WATER_MEAL);
  const water = all.reduce((s, l) => s + (l.water_ml ?? 0), 0);
  const eaten = logs.reduce((t, l) => ({ kcal: t.kcal + Number(l.kcal), protein: t.protein + Number(l.protein), carbs: t.carbs + Number(l.carbs), fat: t.fat + Number(l.fat) }), { kcal: 0, protein: 0, carbs: 0, fat: 0 });
  const target = plan ? planTargets(plan) : { kcal: 2000, protein: 110, carbs: 230, fat: 65 };
  const left = Math.round(target.kcal - eaten.kcal);

  const d = new Date(`${date}T12:00:00Z`);
  const prev = dayKey(addDays(d, -1));
  const next = dayKey(addDays(d, 1));
  const isToday = date === today;
  const dateLabel = isToday ? "Aujourd'hui" : date === dayKey(addDays(new Date(`${today}T12:00:00Z`), -1)) ? "Hier" : fmtDate(d, { weekday: "long", day: "numeric", month: "long" });
  const href = (p: { date?: string; vue?: string }) => {
    const q = new URLSearchParams();
    const v = p.vue ?? vue;
    if (v !== "journal") q.set("vue", v);
    const dt = p.date ?? date;
    if (dt !== today) q.set("date", dt);
    const s = q.toString();
    return `/moi/nutrition${s ? `?${s}` : ""}`;
  };

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Ma nutrition 🥗" subtitle={plan ? `Plan : ${plan.name}` : "Note tes repas pour suivre tes apports"} />

      {/* Onglets */}
      <div className="mb-5 grid grid-cols-3 gap-1 rounded-2xl bg-white p-1 ring-1 ring-line">
        {VUES.map((v) => (
          <Link
            key={v.key}
            href={href({ vue: v.key })}
            aria-current={vue === v.key ? "page" : undefined}
            className={cn("flex min-h-11 items-center justify-center gap-1.5 rounded-xl text-sm font-semibold transition", vue === v.key ? "bg-brand-500 text-white shadow-sm" : "text-muted hover:text-ink")}
          >
            <v.icon className="size-4" /> {v.label}
          </Link>
        ))}
      </div>

      {vue === "journal" && (
        <div className="space-y-4">
          {/* Sélecteur de date */}
          <div className="flex items-center justify-between gap-2 rounded-2xl border border-line bg-white p-1.5 shadow-card">
            <Link href={href({ date: prev })} className="grid size-11 place-items-center rounded-xl text-muted transition hover:bg-canvas hover:text-ink" aria-label="Jour précédent">
              <ChevronLeft className="size-5" />
            </Link>
            <div className="text-center">
              <p className="font-display text-base font-bold capitalize text-ink">{dateLabel}</p>
              {!isToday && (
                <Link href={href({ date: today })} className="text-xs font-semibold text-brand-600 hover:underline">
                  Revenir à aujourd&apos;hui
                </Link>
              )}
              {isToday && <p className="text-xs text-muted">{fmtDate(d, { day: "numeric", month: "long" })}</p>}
            </div>
            {isToday ? (
              <span className="size-11" aria-hidden />
            ) : (
              <Link href={href({ date: next })} className="grid size-11 place-items-center rounded-xl text-muted transition hover:bg-canvas hover:text-ink" aria-label="Jour suivant">
                <ChevronRight className="size-5" />
              </Link>
            )}
          </div>

          {/* Anneaux */}
          <Card className="p-5">
            <div className="flex items-center gap-5">
              <Ring value={eaten.kcal} target={target.kcal} color={MACRO_COLORS.kcal} size={128} stroke={13} label="Calories" unit="kcal" big />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">{left >= 0 ? "Il te reste" : "Dépassement"}</p>
                <p className={cn("font-display text-3xl font-extrabold tracking-tight", left >= 0 ? "text-ink" : "text-red-600")}>
                  {num(Math.abs(left))} <span className="text-base font-semibold text-muted">kcal</span>
                </p>
                <p className="mt-1 text-xs text-muted">
                  {!plan
                    ? "Objectif indicatif : ton coach définira le tien."
                    : eaten.kcal === 0
                      ? "Commence par noter ton petit-déjeuner 👇"
                      : left >= 0
                        ? "Tu es sur la bonne voie, continue !"
                        : "Pas de panique, on équilibre demain 😉"}
                </p>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-2 border-t border-line pt-5">
              <Ring value={eaten.protein} target={target.protein} color={MACRO_COLORS.protein} size={84} stroke={8} label="Protéines" />
              <Ring value={eaten.carbs} target={target.carbs} color={MACRO_COLORS.carbs} size={84} stroke={8} label="Glucides" />
              <Ring value={eaten.fat} target={target.fat} color={MACRO_COLORS.fat} size={84} stroke={8} label="Lipides" />
            </div>
          </Card>

          <WaterTracker key={date} date={date} ml={water} />

          <FoodJournal date={date} logs={logs} foods={foods} planMeals={plan?.meals ?? []} />
        </div>
      )}

      {vue === "plan" &&
        (plan ? (
          <div className="space-y-4">
            <PlanSummary plan={plan} title="Mes objectifs du jour" />
            <PlanMeals plan={plan} foods={foods} compact />
          </div>
        ) : (
          <NoPlan />
        ))}

      {vue === "courses" && (plan ? <ShoppingList storageKey={`moovup-courses-${plan.id}`} items={shoppingItems(plan, foods)} planName={plan.name} /> : <NoPlan />)}
    </div>
  );
}

function NoPlan() {
  return (
    <Card>
      <Empty
        icon={<UtensilsCrossed className="size-6" />}
        title="Ton plan arrive bientôt"
        text="Ton coach prépare ton plan alimentaire personnalisé. En attendant, tu peux déjà noter tes repas dans le journal."
      />
    </Card>
  );
}

/** Agrège les aliments du plan × 7 jours, par catégorie */
function shoppingItems(plan: MealPlan, foods: Food[]): ShopItem[] {
  const byId = new Map(foods.map((f) => [f.id, f]));
  const byName = new Map(foods.map((f) => [f.name, f]));
  const acc = new Map<string, { name: string; category: string; portions: number; grams: number | null; portion: string | null }>();
  for (const m of plan.meals ?? []) {
    for (const it of m.items) {
      const f = (it.food_id ? byId.get(it.food_id) : undefined) ?? byName.get(it.name);
      const key = f?.id ?? it.name;
      const cur = acc.get(key) ?? { name: f?.name ?? it.name, category: f?.category ?? "Autre", portions: 0, grams: f ? Number(f.grams) : null, portion: f?.portion ?? null };
      cur.portions += Number(it.qty) * 7;
      acc.set(key, cur);
    }
  }
  const order = ["Protéines", "Plats marocains", "Légumes", "Fruits", "Féculents", "Légumineuses", "Produits laitiers", "Oléagineux", "Matières grasses", "Boissons", "Compléments", "Autre"];
  return [...acc.entries()]
    .map(([key, v]) => {
      const totalG = v.grams ? v.grams * v.portions : null;
      const amount = totalG ? (totalG >= 1000 ? `${num(Math.round(totalG / 100) / 10)} kg` : `${num(Math.round(totalG / 10) * 10)} g`) : `${fmtQty(v.portions)} portions`;
      const detail = `${fmtQty(Math.round(v.portions * 10) / 10)} portion${v.portions > 1 ? "s" : ""}${v.portion ? ` de ${v.portion}` : ""}`;
      return { key, name: v.name, category: v.category === "Plats marocains" ? "Plats marocains (ingrédients)" : v.category, amount, detail, rank: order.indexOf(v.category) };
    })
    .sort((a, b) => (a.rank === -1 ? 99 : a.rank) - (b.rank === -1 ? 99 : b.rank) || a.name.localeCompare(b.name, "fr"))
    .map((x) => ({ key: x.key, name: x.name, category: x.category, amount: x.amount, detail: x.detail }));
}
