/** Affichage d'un plan alimentaire (repas + synthèse) — composant serveur sans état. */
import { Clock, Flame, Salad, UtensilsCrossed } from "lucide-react";
import type { Food, MealPlan } from "@/lib/types";
import { num } from "@/lib/utils";
import { Badge, Card, CardHeader } from "@/components/ui";
import { MacroDonut, TargetBar } from "./macro-visuals";
import { MACRO_COLORS, fmtQty, mealTotals, planTargets, planTotals } from "./shared";

export function PlanMeals({ plan, foods, compact }: { plan: MealPlan; foods?: Food[]; compact?: boolean }) {
  const byId = new Map((foods ?? []).map((f) => [f.id, f]));
  const meals = plan.meals ?? [];
  if (!meals.length) {
    return <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">Aucun repas dans ce plan.</p>;
  }
  return (
    <div className="space-y-3">
      {meals.map((m, i) => {
        const t = mealTotals(m);
        return (
          <div key={`${m.name}-${i}`} className="overflow-hidden rounded-2xl border border-line bg-white">
            <div className="flex items-center justify-between gap-3 bg-canvas/70 px-4 py-2.5">
              <div className="flex min-w-0 items-center gap-2">
                <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-white text-accent-500 ring-1 ring-line">
                  <UtensilsCrossed className="size-3.5" />
                </span>
                <p className="truncate font-display text-sm font-bold text-ink">{m.name}</p>
                {m.time && (
                  <span className="inline-flex items-center gap-1 text-xs text-muted">
                    <Clock className="size-3" /> {m.time.replace(":", "h")}
                  </span>
                )}
              </div>
              <p className="shrink-0 text-xs text-muted">
                <b className="text-ink">{num(Math.round(t.kcal))}</b> kcal
              </p>
            </div>
            <ul className="divide-y divide-line/70">
              {m.items.map((it, j) => {
                const f = it.food_id ? byId.get(it.food_id) : undefined;
                return (
                  <li key={j} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                    <span className="grid h-6 min-w-9 place-items-center rounded-md bg-brand-50 px-1.5 text-[11px] font-bold text-brand-600">×{fmtQty(it.qty)}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-ink">
                        {it.name} {f?.moroccan && <span className="ml-1 align-middle text-[10px] font-bold uppercase tracking-wide text-accent-600">MA</span>}
                      </p>
                      {!compact && f?.portion && <p className="text-xs text-muted">{f.portion}</p>}
                    </div>
                    <div className="shrink-0 text-right text-xs">
                      <p className="font-semibold text-ink">{num(Math.round(it.kcal))} kcal</p>
                      {!compact && (
                        <p className="text-muted">
                          P {num(Math.round(it.protein))} · G {num(Math.round(it.carbs))} · L {num(Math.round(it.fat))}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

export function PlanSummary({ plan, title = "Synthèse du plan" }: { plan: MealPlan; title?: string }) {
  const totals = planTotals(plan.meals);
  const targets = planTargets(plan);
  return (
    <Card>
      <CardHeader title={title} subtitle={plan.goal ?? undefined} icon={<Flame className="size-4" />} action={plan.goal ? <Badge tone="accent">{plan.goal}</Badge> : undefined} />
      <div className="px-5 pb-5">
        <MacroDonut totals={totals} />
        <div className="mt-5 space-y-3">
          <TargetBar label="Calories" value={totals.kcal} target={targets.kcal} unit="kcal" color={MACRO_COLORS.kcal} />
          <TargetBar label="Protéines" value={totals.protein} target={targets.protein} unit="g" color={MACRO_COLORS.protein} />
          <TargetBar label="Glucides" value={totals.carbs} target={targets.carbs} unit="g" color={MACRO_COLORS.carbs} />
          <TargetBar label="Lipides" value={totals.fat} target={targets.fat} unit="g" color={MACRO_COLORS.fat} />
        </div>
        {plan.notes && (
          <p className="mt-5 flex gap-2 rounded-xl bg-brand-50/70 px-3.5 py-3 text-sm text-brand-800">
            <Salad className="mt-0.5 size-4 shrink-0 text-brand-500" />
            <span className="whitespace-pre-line">{plan.notes}</span>
          </p>
        )}
      </div>
    </Card>
  );
}
