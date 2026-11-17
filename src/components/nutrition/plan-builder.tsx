"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Calculator, Clock, Info, LayoutTemplate, Minus, Plus, Save, Search, Sparkles, Target, Trash2, User, UtensilsCrossed, X } from "lucide-react";
import type { Food, MealPlan } from "@/lib/types";
import { saveMealPlanAction } from "@/actions/nutrition";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { Card, CardHeader, Field, Input, LinkButton, Select, Textarea } from "@/components/ui";
import { cn, num } from "@/lib/utils";
import { Ring } from "./macro-visuals";
import { ACTIVITY_LEVELS, CALC_GOALS, MACRO_COLORS, PLAN_GOALS, calcTargets, fmtQty, macroSplit, round1, type CalcGoal, type Totals } from "./shared";

export type BuilderClient = { id: string; name: string; sex: "H" | "F" | null; age: number | null; height: number | null; weight: number | null };

type Base = { kcal: number; protein: number; carbs: number; fat: number };
type Item = { key: string; food_id: string | null; name: string; qty: number; base: Base };
type MealS = { key: string; name: string; time: string; items: Item[] };

let seq = 0;
const k = () => `m${Date.now().toString(36)}${(seq++).toString(36)}`;
const DEFAULT_MEALS: [string, string][] = [
  ["Petit-déjeuner", "07:30"],
  ["Déjeuner", "13:00"],
  ["Collation", "16:30"],
  ["Dîner", "20:30"],
];

function initMeals(plan: MealPlan | null | undefined, foods: Map<string, Food>): MealS[] {
  if (!plan?.meals?.length) return DEFAULT_MEALS.map(([name, time]) => ({ key: k(), name, time, items: [] }));
  return plan.meals.map((m) => ({
    key: k(),
    name: m.name,
    time: m.time ?? "",
    items: m.items.map((i) => {
      const f = i.food_id ? foods.get(i.food_id) : undefined;
      const q = i.qty || 1;
      return {
        key: k(),
        food_id: i.food_id ?? null,
        name: i.name,
        qty: q,
        base: f ? { kcal: f.kcal, protein: f.protein, carbs: f.carbs, fat: f.fat } : { kcal: i.kcal / q, protein: i.protein / q, carbs: i.carbs / q, fat: i.fat / q },
      };
    }),
  }));
}

const itemTotals = (i: Item): Totals => ({ kcal: i.base.kcal * i.qty, protein: i.base.protein * i.qty, carbs: i.base.carbs * i.qty, fat: i.base.fat * i.qty });
const sum = (items: Item[]): Totals =>
  items.reduce<Totals>((t, i) => {
    const x = itemTotals(i);
    return { kcal: t.kcal + x.kcal, protein: t.protein + x.protein, carbs: t.carbs + x.carbs, fat: t.fat + x.fat };
  }, { kcal: 0, protein: 0, carbs: 0, fat: 0 });

const iconBtn = "grid size-9 place-items-center rounded-lg text-slate-400 transition hover:bg-canvas hover:text-ink disabled:pointer-events-none disabled:opacity-30";

export function PlanBuilder({
  foods,
  clients,
  plan,
  source,
  defaultClientId,
}: {
  foods: Food[];
  clients: BuilderClient[];
  plan?: MealPlan | null;
  source?: MealPlan | null;
  defaultClientId?: string | null;
}) {
  const foodMap = useMemo(() => new Map(foods.map((f) => [f.id, f])), [foods]);
  const start = plan ?? source ?? null;
  const [meals, setMeals] = useState<MealS[]>(() => initMeals(start, foodMap));
  const [info, setInfo] = useState({
    name: plan?.name ?? (source ? source.name.replace(/^Modèle\s*[–-]\s*/i, "") : ""),
    goal: start?.goal ?? "",
    notes: start?.notes ?? "",
    clientId: plan ? (plan.client_id ?? "") : (defaultClientId ?? ""),
  });
  const [targets, setTargets] = useState({
    kcal: start?.target_kcal ? String(start.target_kcal) : "",
    protein: start?.protein_g ? String(start.protein_g) : "",
    carbs: start?.carbs_g ? String(start.carbs_g) : "",
    fat: start?.fat_g ? String(start.fat_g) : "",
  });

  const client = clients.find((c) => c.id === info.clientId) ?? null;
  const [calc, setCalc] = useState(() => calcFromClient(client));
  const [calcOpen, setCalcOpen] = useState(!start);

  function calcFromClient(c: BuilderClient | null) {
    return {
      sex: (c?.sex ?? "H") as "H" | "F",
      age: c?.age ? String(c.age) : "30",
      weight: c?.weight ? String(c.weight) : "75",
      height: c?.height ? String(c.height) : "172",
      activity: "1.55",
      goal: "perte" as CalcGoal,
    };
  }

  const n = (s: string) => Number(String(s).replace(",", ".")) || 0;
  const result = calcTargets({ sex: calc.sex, age: n(calc.age), weight: n(calc.weight), height: n(calc.height), activity: n(calc.activity), goal: calc.goal });
  const calcValid = n(calc.age) >= 14 && n(calc.weight) >= 30 && n(calc.height) >= 120;

  const day = sum(meals.flatMap((m) => m.items));
  const tgt: Totals = { kcal: n(targets.kcal) || Math.round(day.kcal), protein: n(targets.protein) || Math.round(day.protein), carbs: n(targets.carbs) || Math.round(day.carbs), fat: n(targets.fat) || Math.round(day.fat) };
  const macroKcal = n(targets.protein) * 4 + n(targets.carbs) * 4 + n(targets.fat) * 9;
  const itemsCount = meals.reduce((s, m) => s + m.items.length, 0);

  const updateMeal = (key: string, patch: Partial<MealS>) => setMeals((ms) => ms.map((m) => (m.key === key ? { ...m, ...patch } : m)));
  const setItems = (key: string, fn: (items: Item[]) => Item[]) => setMeals((ms) => ms.map((m) => (m.key === key ? { ...m, items: fn(m.items) } : m)));
  const moveMeal = (i: number, dir: -1 | 1) =>
    setMeals((ms) => {
      const j = i + dir;
      if (j < 0 || j >= ms.length) return ms;
      const next = [...ms];
      [next[i], next[j]] = [next[j]!, next[i]!];
      return next;
    });

  function applyCalc() {
    setTargets({ kcal: String(result.kcal), protein: String(result.protein), carbs: String(result.carbs), fat: String(result.fat) });
    const g = CALC_GOALS.find((x) => x.key === calc.goal);
    if (g && !info.goal) setInfo((s) => ({ ...s, goal: g.plan }));
    if (!info.name) setInfo((s) => ({ ...s, name: `${g?.label ?? "Plan"} – ${num(result.kcal)} kcal` }));
  }

  const payload = JSON.stringify(
    meals.map((m) => ({
      name: m.name,
      time: m.time || null,
      items: m.items.map((i) => {
        const t = itemTotals(i);
        return { food_id: i.food_id, name: i.name, qty: i.qty, kcal: round1(t.kcal), protein: round1(t.protein), carbs: round1(t.carbs), fat: round1(t.fat) };
      }),
    })),
  );

  const cancelHref = plan ? `/nutrition/${plan.id}` : info.clientId ? `/clients/${info.clientId}?tab=nutrition` : "/nutrition";

  return (
    <ActionForm action={saveMealPlanAction} className="pb-24">
      {plan && <input type="hidden" name="id" value={plan.id} />}
      <input type="hidden" name="meals" value={payload} />
      <datalist id="plan-goals">
        {PLAN_GOALS.map((g) => (
          <option key={g} value={g} />
        ))}
      </datalist>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-5">
          {/* Infos */}
          <Card>
            <CardHeader title="Informations" subtitle="Nom, objectif et destinataire du plan" icon={<Info className="size-4" />} />
            <div className="grid gap-4 px-5 pb-5 sm:grid-cols-2">
              <Field label="Nom du plan" className="sm:col-span-2">
                <Input name="name" required value={info.name} onChange={(e) => setInfo((s) => ({ ...s, name: e.target.value }))} placeholder="Ex. Sèche progressive – 1 900 kcal" />
              </Field>
              <Field label="Objectif">
                <Input name="goal" list="plan-goals" value={info.goal} onChange={(e) => setInfo((s) => ({ ...s, goal: e.target.value }))} placeholder="Perte de poids" />
              </Field>
              <Field label="Enregistrer pour" hint={info.clientId ? "Le plan devient le plan actif du client." : "Le modèle reste dans la bibliothèque, réutilisable."}>
                <Select
                  name="client_id"
                  value={info.clientId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setInfo((s) => ({ ...s, clientId: id }));
                    const c = clients.find((x) => x.id === id);
                    if (c) setCalc((s) => ({ ...calcFromClient(c), activity: s.activity, goal: s.goal }));
                  }}
                >
                  <option value="">Modèle (bibliothèque)</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Conseils & consignes" className="sm:col-span-2">
                <Textarea
                  name="notes"
                  rows={2}
                  className="min-h-[72px]"
                  value={info.notes}
                  onChange={(e) => setInfo((s) => ({ ...s, notes: e.target.value }))}
                  placeholder="Hydratation, thé sans sucre, huile d'olive avec modération, Ramadan…"
                />
              </Field>
            </div>
          </Card>

          {/* Calculateur */}
          <Card className="overflow-hidden">
            <button type="button" onClick={() => setCalcOpen((o) => !o)} className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition hover:bg-canvas/50" aria-expanded={calcOpen}>
              <span className="flex items-center gap-2.5">
                <span className="grid size-8 place-items-center rounded-lg bg-accent-50 text-accent-500">
                  <Calculator className="size-4" />
                </span>
                <span>
                  <span className="block font-display text-[15px] font-bold text-ink">Calculateur de besoins</span>
                  <span className="block text-xs text-muted">Mifflin-St Jeor · dépense totale ± objectif · protéines en g/kg</span>
                </span>
              </span>
              <span className="text-xs font-semibold text-brand-600">{calcOpen ? "Masquer" : "Ouvrir"}</span>
            </button>
            {calcOpen && (
              <div className="border-t border-line px-5 py-5">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                  <Field label="Sexe">
                    <div className="grid h-11 grid-cols-2 gap-1 rounded-xl bg-canvas p-1">
                      {(["H", "F"] as const).map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setCalc((c) => ({ ...c, sex: s }))}
                          className={cn("rounded-lg text-sm font-semibold transition", calc.sex === s ? "bg-white text-brand-600 shadow-sm" : "text-muted hover:text-ink")}
                          aria-pressed={calc.sex === s}
                        >
                          {s === "H" ? "Homme" : "Femme"}
                        </button>
                      ))}
                    </div>
                  </Field>
                  <Field label="Âge">
                    <Input type="number" min={14} max={99} value={calc.age} onChange={(e) => setCalc((c) => ({ ...c, age: e.target.value }))} />
                  </Field>
                  <Field label="Poids (kg)">
                    <Input inputMode="decimal" value={calc.weight} onChange={(e) => setCalc((c) => ({ ...c, weight: e.target.value }))} />
                  </Field>
                  <Field label="Taille (cm)">
                    <Input type="number" min={120} max={230} value={calc.height} onChange={(e) => setCalc((c) => ({ ...c, height: e.target.value }))} />
                  </Field>
                  <Field label="Activité" className="col-span-2">
                    <Select value={calc.activity} onChange={(e) => setCalc((c) => ({ ...c, activity: e.target.value }))}>
                      {ACTIVITY_LEVELS.map((a) => (
                        <option key={a.key} value={a.key}>
                          {a.label} – {a.hint}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-1 rounded-xl bg-canvas p-1">
                  {CALC_GOALS.map((g) => (
                    <button
                      key={g.key}
                      type="button"
                      onClick={() => setCalc((c) => ({ ...c, goal: g.key }))}
                      aria-pressed={calc.goal === g.key}
                      className={cn("min-h-10 rounded-lg px-2 text-xs font-semibold transition sm:text-sm", calc.goal === g.key ? "bg-white text-accent-600 shadow-sm" : "text-muted hover:text-ink")}
                    >
                      {g.label} <span className="hidden font-normal text-slate-400 sm:inline">{g.adjust ? `${g.adjust > 0 ? "+" : "−"}${Math.abs(g.adjust * 100)} %` : ""}</span>
                    </button>
                  ))}
                </div>
                {calcValid ? (
                  <div className="mt-4 flex flex-col gap-4 rounded-2xl bg-gradient-to-br from-brand-50 to-white p-4 ring-1 ring-brand-100 sm:flex-row sm:items-center">
                    <div className="grid flex-1 grid-cols-3 gap-3 text-center sm:grid-cols-6">
                      <Stat label="Métabolisme" value={num(result.bmr)} unit="kcal" />
                      <Stat label="Dépense" value={num(result.tdee)} unit="kcal" />
                      <Stat label="Cible" value={num(result.kcal)} unit="kcal" strong />
                      <Stat label="Protéines" value={String(result.protein)} unit="g" color={MACRO_COLORS.protein} />
                      <Stat label="Glucides" value={String(result.carbs)} unit="g" color={MACRO_COLORS.carbs} />
                      <Stat label="Lipides" value={String(result.fat)} unit="g" color={MACRO_COLORS.fat} />
                    </div>
                    <button type="button" onClick={applyCalc} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-accent-500 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-accent-600 active:scale-[.98]">
                      <Sparkles className="size-4" /> Appliquer
                    </button>
                  </div>
                ) : (
                  <p className="mt-4 rounded-xl bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">Renseigne un âge, un poids et une taille réalistes pour obtenir une estimation.</p>
                )}
              </div>
            )}
          </Card>

          {/* Cibles */}
          <Card>
            <CardHeader title="Objectifs journaliers" subtitle="Laisse vide pour utiliser le total du plan" icon={<Target className="size-4" />} />
            <div className="grid grid-cols-2 gap-3 px-5 pb-4 sm:grid-cols-4">
              <Field label="Calories (kcal)">
                <Input name="target_kcal" type="number" min={800} max={6000} value={targets.kcal} onChange={(e) => setTargets((t) => ({ ...t, kcal: e.target.value }))} placeholder="1900" />
              </Field>
              <Field label="Protéines (g)">
                <Input name="protein_g" type="number" min={0} value={targets.protein} onChange={(e) => setTargets((t) => ({ ...t, protein: e.target.value }))} placeholder="140" />
              </Field>
              <Field label="Glucides (g)">
                <Input name="carbs_g" type="number" min={0} value={targets.carbs} onChange={(e) => setTargets((t) => ({ ...t, carbs: e.target.value }))} placeholder="190" />
              </Field>
              <Field label="Lipides (g)">
                <Input name="fat_g" type="number" min={0} value={targets.fat} onChange={(e) => setTargets((t) => ({ ...t, fat: e.target.value }))} placeholder="60" />
              </Field>
            </div>
            {macroKcal > 0 && n(targets.kcal) > 0 && (
              <p className={cn("mx-5 mb-5 rounded-xl px-3.5 py-2.5 text-xs", Math.abs(macroKcal - n(targets.kcal)) > n(targets.kcal) * 0.08 ? "bg-amber-50 text-amber-800" : "bg-canvas text-muted")}>
                Les macros cibles représentent <b>{num(Math.round(macroKcal))} kcal</b> pour un objectif de {num(n(targets.kcal))} kcal
                {(() => {
                  const s = macroSplit({ protein: n(targets.protein), carbs: n(targets.carbs), fat: n(targets.fat) });
                  return ` · P ${s.protein} % / G ${s.carbs} % / L ${s.fat} %`;
                })()}
              </p>
            )}
          </Card>

          {/* Repas */}
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-bold text-ink">Repas de la journée</h2>
              <p className="text-sm text-muted">
                {meals.length} repas · {itemsCount} aliment{itemsCount > 1 ? "s" : ""} · {num(Math.round(day.kcal))} kcal
              </p>
            </div>
          </div>

          {meals.map((m, mi) => {
            const t = sum(m.items);
            return (
              <Card key={m.key} className="overflow-hidden">
                <div className="flex flex-wrap items-center gap-2 border-b border-line bg-canvas/60 px-4 py-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white text-accent-500 ring-1 ring-line">
                    <UtensilsCrossed className="size-4" />
                  </span>
                  <input
                    value={m.name}
                    onChange={(e) => updateMeal(m.key, { name: e.target.value })}
                    aria-label="Nom du repas"
                    className="h-10 min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 font-display text-[15px] font-bold text-ink transition hover:border-line focus:border-brand-400 focus:bg-white focus:outline-none"
                  />
                  <label className="relative">
                    <Clock className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
                    <input
                      type="time"
                      value={m.time}
                      onChange={(e) => updateMeal(m.key, { time: e.target.value })}
                      aria-label="Heure du repas"
                      className="h-10 w-[112px] rounded-lg border border-line bg-white pl-8 pr-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-50"
                    />
                  </label>
                  <div className="flex items-center">
                    <button type="button" className={iconBtn} onClick={() => moveMeal(mi, -1)} disabled={mi === 0} aria-label="Monter le repas">
                      <ArrowUp className="size-4" />
                    </button>
                    <button type="button" className={iconBtn} onClick={() => moveMeal(mi, 1)} disabled={mi === meals.length - 1} aria-label="Descendre le repas">
                      <ArrowDown className="size-4" />
                    </button>
                    <button
                      type="button"
                      className={cn(iconBtn, "hover:bg-red-50 hover:text-red-600")}
                      onClick={() => setMeals((ms) => ms.filter((x) => x.key !== m.key))}
                      disabled={meals.length === 1}
                      aria-label="Supprimer le repas"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>

                {m.items.length > 0 ? (
                  <ul className="divide-y divide-line/70">
                    {m.items.map((it) => {
                      const x = itemTotals(it);
                      const f = it.food_id ? foodMap.get(it.food_id) : undefined;
                      return (
                        <li key={it.key} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
                          <div className="min-w-0 flex-1 basis-40">
                            <p className="truncate text-sm font-semibold text-ink">
                              {it.name} {f?.moroccan && <span className="ml-1 rounded bg-accent-50 px-1 py-0.5 align-middle text-[10px] font-bold uppercase text-accent-700">Maroc</span>}
                            </p>
                            <p className="text-xs text-muted">
                              {f?.portion ? `${f.portion} · ` : ""}P {num(Math.round(x.protein))} · G {num(Math.round(x.carbs))} · L {num(Math.round(x.fat))}
                            </p>
                          </div>
                          <Stepper value={it.qty} onChange={(q) => setItems(m.key, (items) => items.map((y) => (y.key === it.key ? { ...y, qty: q } : y)))} />
                          <p className="w-20 text-right text-sm font-bold text-ink">{num(Math.round(x.kcal))} kcal</p>
                          <button type="button" onClick={() => setItems(m.key, (items) => items.filter((y) => y.key !== it.key))} className={cn(iconBtn, "hover:bg-red-50 hover:text-red-600")} aria-label={`Retirer ${it.name}`}>
                            <X className="size-4" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="px-4 py-4 text-sm text-muted">Aucun aliment pour l&apos;instant : recherche dans la bibliothèque ci-dessous.</p>
                )}

                <div className="border-t border-line bg-white px-4 py-3">
                  <FoodPicker
                    foods={foods}
                    onPick={(f) => setItems(m.key, (items) => [...items, { key: k(), food_id: f.id, name: f.name, qty: 1, base: { kcal: f.kcal, protein: f.protein, carbs: f.carbs, fat: f.fat } }])}
                  />
                  {m.items.length > 0 && (
                    <p className="mt-2.5 flex flex-wrap gap-x-3 text-xs text-muted">
                      <span>
                        Total repas : <b className="text-ink">{num(Math.round(t.kcal))} kcal</b>
                      </span>
                      <span>P {num(Math.round(t.protein))} g</span>
                      <span>G {num(Math.round(t.carbs))} g</span>
                      <span>L {num(Math.round(t.fat))} g</span>
                      {tgt.kcal > 0 && <span className="text-slate-400">· {Math.round((t.kcal / tgt.kcal) * 100)} % de la journée</span>}
                    </p>
                  )}
                </div>
              </Card>
            );
          })}

          <button
            type="button"
            onClick={() => setMeals((ms) => [...ms, { key: k(), name: `Repas ${ms.length + 1}`, time: "", items: [] }])}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line bg-white/60 py-5 text-sm font-semibold text-muted transition hover:border-brand-300 hover:bg-brand-50/50 hover:text-brand-600"
          >
            <Plus className="size-4" /> Ajouter un repas
          </button>
        </div>

        {/* Synthèse */}
        <aside className="space-y-4 lg:sticky lg:top-6">
          <Card className="p-5">
            <p className="mb-4 font-display text-[15px] font-bold text-ink">Total de la journée</p>
            <div className="flex justify-center">
              <Ring value={day.kcal} target={tgt.kcal} color={MACRO_COLORS.kcal} size={150} stroke={14} label="Calories" unit="kcal" big />
            </div>
            <div className="mt-5 grid grid-cols-3 gap-2">
              <Ring value={day.protein} target={tgt.protein} color={MACRO_COLORS.protein} size={78} stroke={8} label="Protéines" />
              <Ring value={day.carbs} target={tgt.carbs} color={MACRO_COLORS.carbs} size={78} stroke={8} label="Glucides" />
              <Ring value={day.fat} target={tgt.fat} color={MACRO_COLORS.fat} size={78} stroke={8} label="Lipides" />
            </div>
            {tgt.kcal > 0 && day.kcal > 0 && (
              <p
                className={cn(
                  "mt-5 rounded-xl px-3.5 py-2.5 text-center text-xs font-semibold",
                  Math.abs(day.kcal - tgt.kcal) <= tgt.kcal * 0.05 ? "bg-emerald-50 text-emerald-700" : day.kcal > tgt.kcal ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800",
                )}
              >
                {Math.abs(day.kcal - tgt.kcal) <= tgt.kcal * 0.05
                  ? "Le plan correspond à l'objectif ✓"
                  : day.kcal > tgt.kcal
                    ? `${num(Math.round(day.kcal - tgt.kcal))} kcal au-dessus de l'objectif`
                    : `Encore ${num(Math.round(tgt.kcal - day.kcal))} kcal pour atteindre l'objectif`}
              </p>
            )}
          </Card>
          <Card className="p-5">
            <p className="mb-3 font-display text-sm font-bold text-ink">Répartition par repas</p>
            <ul className="space-y-2.5">
              {meals.map((m) => {
                const t = sum(m.items).kcal;
                const p = day.kcal ? (t / day.kcal) * 100 : 0;
                return (
                  <li key={m.key}>
                    <div className="mb-1 flex justify-between gap-2 text-xs">
                      <span className="truncate font-medium text-slate-600">{m.name || "Repas"}</span>
                      <span className="shrink-0 text-muted">{num(Math.round(t))} kcal</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-brand-500 transition-all duration-500" style={{ width: `${p}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        </aside>
      </div>

      {/* Barre d'enregistrement */}
      <div className="sticky bottom-20 z-10 mt-6 lg:bottom-4">
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-white/95 px-4 py-3 shadow-pop backdrop-blur">
          <div className="hidden min-w-0 items-center gap-2 text-sm text-muted sm:flex">
            {info.clientId ? <User className="size-4 shrink-0 text-accent-500" /> : <LayoutTemplate className="size-4 shrink-0 text-brand-500" />}
            <span className="truncate">
              {client ? `Pour ${client.name}` : "Modèle"} · <b className="text-ink">{num(Math.round(day.kcal))}</b> / {num(tgt.kcal)} kcal
            </span>
          </div>
          <div className="flex flex-1 justify-end gap-2">
            <LinkButton href={cancelHref} variant="secondary">
              Annuler
            </LinkButton>
            <SubmitButton>
              <Save className="size-4" /> {plan ? "Enregistrer" : info.clientId ? "Assigner au client" : "Enregistrer le modèle"}
            </SubmitButton>
          </div>
        </div>
      </div>
    </ActionForm>
  );
}

function Stat({ label, value, unit, strong, color }: { label: string; value: string; unit: string; strong?: boolean; color?: string }) {
  return (
    <div>
      <p className="text-[11px] text-muted">{label}</p>
      <p className={cn("font-display font-extrabold", strong ? "text-lg text-accent-600" : "text-base text-ink")} style={color ? { color } : undefined}>
        {value}
        <span className="ml-0.5 text-[10px] font-semibold text-muted">{unit}</span>
      </p>
    </div>
  );
}

function Stepper({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const step = (d: number) => onChange(Math.max(0.25, Math.min(20, round1(Math.round((value + d) * 4) / 4))));
  return (
    <div className="flex h-9 items-center rounded-lg border border-line bg-white" role="group" aria-label="Nombre de portions">
      <button type="button" onClick={() => step(value <= 1 ? -0.25 : -0.5)} className="grid h-full w-8 place-items-center text-slate-500 transition hover:text-ink disabled:opacity-30" disabled={value <= 0.25} aria-label="Moins">
        <Minus className="size-3.5" />
      </button>
      <span className="min-w-11 text-center text-sm font-bold text-ink" aria-live="polite">
        ×{fmtQty(value)}
      </span>
      <button type="button" onClick={() => step(value < 1 ? 0.25 : 0.5)} className="grid h-full w-8 place-items-center text-slate-500 transition hover:text-ink" aria-label="Plus">
        <Plus className="size-3.5" />
      </button>
    </div>
  );
}

function FoodPicker({ foods, onPick }: { foods: Food[]; onPick: (f: Food) => void }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [moroccan, setMoroccan] = useState(false);
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const needle = norm(q.trim());
  const results = foods.filter((f) => (!moroccan || f.moroccan) && (!needle || norm(`${f.name} ${f.category}`).includes(needle))).slice(0, 8);

  return (
    <div className="relative">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (results[0]) {
                  onPick(results[0]);
                  setQ("");
                }
              }
              if (e.key === "Escape") setOpen(false);
            }}
            placeholder="Ajouter un aliment (ex. harira, poulet, msemen)…"
            aria-label="Rechercher un aliment"
            className="h-10 w-full rounded-xl border border-line bg-canvas/50 pl-9 pr-3 text-sm placeholder:text-slate-400 focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-50"
          />
        </div>
        <button
          type="button"
          onClick={() => setMoroccan((v) => !v)}
          aria-pressed={moroccan}
          className={cn("h-10 shrink-0 rounded-xl border px-3 text-xs font-semibold transition", moroccan ? "border-accent-200 bg-accent-50 text-accent-700" : "border-line text-muted hover:text-ink")}
        >
          Plats marocains
        </button>
      </div>
      {open && (
        <ul className="absolute inset-x-0 top-full z-20 mt-1.5 max-h-72 overflow-auto rounded-xl border border-line bg-white p-1 shadow-pop">
          {results.length === 0 && <li className="px-3 py-3 text-sm text-muted">Aucun aliment trouvé. Ajoute-le dans la bibliothèque « Aliments ».</li>}
          {results.map((f) => (
            <li key={f.id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onPick(f);
                  setQ("");
                  setOpen(false);
                }}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition hover:bg-brand-50"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{f.name}</p>
                  <p className="truncate text-xs text-muted">
                    {f.portion ?? `${f.grams} g`} · {f.category}
                  </p>
                </div>
                {f.moroccan && <span className="shrink-0 rounded-full bg-accent-50 px-2 py-0.5 text-[10px] font-bold text-accent-700">Maroc</span>}
                <span className="shrink-0 text-xs font-bold text-ink">{num(f.kcal)} kcal</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
