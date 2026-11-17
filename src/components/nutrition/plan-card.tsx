import Link from "next/link";
import { ChevronRight, LayoutTemplate, UtensilsCrossed } from "lucide-react";
import type { MealPlan } from "@/lib/types";
import { cn, num } from "@/lib/utils";
import { Avatar, Badge, Card } from "@/components/ui";
import { MacroSplitBar } from "./macro-visuals";
import { planTargets, planTotals } from "./shared";

export function PlanCard({ plan, clientName }: { plan: MealPlan; clientName?: string | null }) {
  const totals = planTotals(plan.meals);
  const targets = planTargets(plan);
  const items = (plan.meals ?? []).reduce((s, m) => s + m.items.length, 0);
  const template = plan.client_id === null;
  return (
    <Link href={`/nutrition/${plan.id}`} className="group block focus-visible:outline-none">
      <Card className="relative h-full overflow-hidden p-5 transition duration-200 group-hover:-translate-y-0.5 group-hover:shadow-pop group-focus-visible:ring-4 group-focus-visible:ring-brand-100">
        <div className={cn("absolute inset-x-0 top-0 h-1", template ? "bg-brand-500" : "bg-accent-500")} />
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              {template ? (
                <Badge tone="brand">
                  <LayoutTemplate className="size-3" /> Modèle
                </Badge>
              ) : plan.active ? (
                <Badge tone="green" dot>
                  Actif
                </Badge>
              ) : (
                <Badge tone="gray">Archivé</Badge>
              )}
              {plan.goal && <Badge tone="accent">{plan.goal}</Badge>}
            </div>
            <h3 className="font-display text-[15px] font-bold leading-snug text-ink group-hover:text-brand-600">{plan.name}</h3>
          </div>
          <ChevronRight className="mt-1 size-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-brand-500" />
        </div>

        <div className="mt-4 flex items-end justify-between gap-3">
          <div>
            <p className="font-display text-2xl font-extrabold tracking-tight text-ink">
              {num(targets.kcal)} <span className="text-sm font-semibold text-muted">kcal</span>
            </p>
            <p className="text-xs text-muted">
              Plan : {num(Math.round(totals.kcal))} kcal · P {targets.protein} g · G {targets.carbs} g · L {targets.fat} g
            </p>
          </div>
        </div>
        <MacroSplitBar totals={totals} showLegend={false} className="mt-3" />

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-3 text-xs text-muted">
          <span className="inline-flex items-center gap-1.5">
            <UtensilsCrossed className="size-3.5" /> {plan.meals?.length ?? 0} repas · {items} aliment{items > 1 ? "s" : ""}
          </span>
          {clientName && (
            <span className="inline-flex min-w-0 items-center gap-1.5 font-medium text-ink">
              <Avatar name={clientName} size={20} />
              <span className="truncate">{clientName}</span>
            </span>
          )}
        </div>
      </Card>
    </Link>
  );
}
