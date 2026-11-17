import Link from "next/link";
import { Apple, BarChart3, Beef, ChevronRight, Droplets, Flame, History, LayoutTemplate, NotebookPen, Pencil, Plus, UtensilsCrossed } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { Food, FoodLog, MealPlan } from "@/lib/types";
import { addDays, cn, dayKey, fmtDate, num } from "@/lib/utils";
import { Badge, Card, CardHeader, Empty, LinkButton } from "@/components/ui";
import { PlanMeals, PlanSummary } from "@/components/nutrition/plan-view";
import { KcalChart } from "@/components/nutrition/kcal-chart";
import { AssignPlanForm } from "@/components/nutrition/assign-plan-form";
import { WATER_MEAL, planTargets } from "@/components/nutrition/shared";

export async function NutritionTab({ clientId, canEdit }: { clientId: string; canEdit: boolean }) {
  const supabase = await createClient();
  const today = dayKey(new Date());
  const days = Array.from({ length: 7 }, (_, i) => dayKey(addDays(new Date(), i - 6)));
  const [{ data: pData }, { data: lData }, { data: fData }, { data: tData }] = await Promise.all([
    supabase.from("meal_plans").select("*").eq("client_id", clientId).order("created_at", { ascending: false }),
    supabase.from("food_logs").select("*").eq("client_id", clientId).gte("logged_on", days[0]!).lte("logged_on", today),
    supabase.from("foods").select("*"),
    canEdit ? supabase.from("meal_plans").select("*").is("client_id", null).order("name") : Promise.resolve({ data: [] }),
  ]);
  const plans = (pData ?? []) as MealPlan[];
  const logs = (lData ?? []) as FoodLog[];
  const foods = (fData ?? []) as Food[];
  const templates = (tData ?? []) as MealPlan[];
  const plan = plans.find((p) => p.active) ?? null;
  const history = plans.filter((p) => p.id !== plan?.id);
  const targets = plan ? planTargets(plan) : null;

  const perDay = days.map((d) => {
    const rows = logs.filter((l) => l.logged_on === d);
    const food = rows.filter((l) => l.meal !== WATER_MEAL);
    return {
      key: d,
      label: fmtDate(`${d}T12:00:00Z`, { weekday: "short", day: "numeric" }),
      kcal: Math.round(food.reduce((s, l) => s + Number(l.kcal), 0)),
      protein: Math.round(food.reduce((s, l) => s + Number(l.protein), 0)),
      water: rows.reduce((s, l) => s + (l.water_ml ?? 0), 0),
      entries: food.length,
    };
  });
  const logged = perDay.filter((d) => d.entries > 0);
  const avgKcal = logged.length ? Math.round(logged.reduce((s, d) => s + d.kcal, 0) / logged.length) : null;
  const avgProt = logged.length ? Math.round(logged.reduce((s, d) => s + d.protein, 0) / logged.length) : null;
  const waterDays = perDay.filter((d) => d.water > 0);
  const avgWater = waterDays.length ? Math.round(waterDays.reduce((s, d) => s + d.water, 0) / waterDays.length) : null;

  const actions = canEdit ? (
    <div className="flex flex-wrap gap-2">
      {plan && (
        <LinkButton href={`/nutrition/${plan.id}/modifier`} variant="secondary" className="h-9">
          <Pencil className="size-4" /> Modifier
        </LinkButton>
      )}
      <LinkButton href={`/nutrition/nouveau?client=${clientId}`} className="h-9">
        <Plus className="size-4" /> {plan ? "Nouveau plan" : "Créer un plan"}
      </LinkButton>
    </div>
  ) : null;

  const journal = (
    <Card>
      <CardHeader
        title="Journal alimentaire · 7 derniers jours"
        subtitle={logged.length ? `${logged.length} jour${logged.length > 1 ? "s" : ""} renseigné${logged.length > 1 ? "s" : ""} sur 7` : "Aucun repas noté cette semaine"}
        icon={<NotebookPen className="size-4" />}
      />
      <div className="grid grid-cols-3 gap-2 px-5 pb-2">
        <MiniStat icon={<Flame className="size-4" />} label="Moyenne / jour" value={avgKcal !== null ? `${num(avgKcal)} kcal` : "–"} sub={targets && avgKcal !== null ? `${Math.round((avgKcal / targets.kcal) * 100)} % de l'objectif` : undefined} tone="accent" />
        <MiniStat icon={<Beef className="size-4" />} label="Protéines moy." value={avgProt !== null ? `${avgProt} g` : "–"} sub={targets ? `objectif ${targets.protein} g` : undefined} />
        <MiniStat icon={<Droplets className="size-4" />} label="Eau moy." value={avgWater !== null ? `${num(avgWater / 1000)} L` : "–"} sub="objectif 2 L" tone="sky" />
      </div>
      <div className="px-3 pb-4 pt-2">
        {logged.length ? (
          <KcalChart data={perDay} target={targets?.kcal ?? 0} />
        ) : (
          <Empty icon={<BarChart3 className="size-6" />} title="Pas encore de journal" text={canEdit ? "Le client peut noter ses repas depuis son espace « Nutrition ». Les données apparaîtront ici." : "Note tes repas dans « Nutrition » pour suivre tes apports."} />
        )}
      </div>
      {logged.length > 0 && (
        <ul className="grid grid-cols-7 border-t border-line text-center text-[11px]">
          {perDay.map((d) => (
            <li key={d.key} className={cn("py-2.5", d.key === today && "bg-brand-50/60")}>
              <p className="font-semibold capitalize text-slate-600">{d.label.split(" ")[0]}</p>
              <p className={cn("mt-0.5", d.entries ? "text-ink" : "text-slate-300")}>{d.entries ? `${d.entries} alim.` : "–"}</p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );

  if (!plan) {
    return (
      <div className="space-y-5">
        <Card>
          <Empty
            icon={<UtensilsCrossed className="size-6" />}
            title={canEdit ? "Aucun plan alimentaire actif" : "Pas encore de plan alimentaire"}
            text={
              canEdit
                ? "Compose un plan sur mesure avec le calculateur de besoins, ou pars d'un modèle (rééquilibrage marocain, sèche, prise de masse…)."
                : "Ton coach prépare ton plan alimentaire. Il apparaîtra ici dès qu'il sera prêt."
            }
            action={actions ?? undefined}
          />
          {canEdit && templates.length > 0 && (
            <div className="mx-auto max-w-lg px-5 pb-8">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                <LayoutTemplate className="size-3.5" /> Ou assigner un modèle existant
              </p>
              <AssignPlanForm clientId={clientId} options={templates.map((t) => ({ id: t.id, label: `${t.name}${t.target_kcal ? ` · ${num(t.target_kcal)} kcal` : ""}` }))} placeholder="Choisir un modèle…" />
            </div>
          )}
        </Card>
        {journal}
        {canEdit && history.length > 0 && <History_ plans={history} />}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-lg font-bold text-ink">{plan.name}</h3>
            <Badge tone="green" dot>
              Actif
            </Badge>
          </div>
          <p className="text-sm text-muted">
            {plan.meals.length} repas · objectif {num(targets!.kcal)} kcal · depuis le {fmtDate(plan.created_at)}
          </p>
        </div>
        {actions}
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-5">
          {journal}
          <Card>
            <CardHeader title="Repas du plan" subtitle="Portions et apports par repas" icon={<Apple className="size-4" />} />
            <div className="px-5 pb-5">
              <PlanMeals plan={plan} foods={foods} />
            </div>
          </Card>
        </div>
        <aside className="space-y-4 lg:sticky lg:top-6">
          <PlanSummary plan={plan} title="Macros du plan" />
          {canEdit && templates.length > 0 && (
            <Card className="p-5">
              <p className="mb-1 font-display text-sm font-bold text-ink">Remplacer par un modèle</p>
              <p className="mb-3 text-xs text-muted">Le plan actuel sera archivé.</p>
              <AssignPlanForm clientId={clientId} options={templates.map((t) => ({ id: t.id, label: t.name }))} placeholder="Choisir un modèle…" />
            </Card>
          )}
          {canEdit && history.length > 0 && <History_ plans={history} />}
        </aside>
      </div>
    </div>
  );
}

function History_({ plans }: { plans: MealPlan[] }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Historique des plans" icon={<History className="size-4" />} />
      <ul className="divide-y divide-line border-t border-line">
        {plans.map((p) => (
          <li key={p.id}>
            <Link href={`/nutrition/${p.id}`} className="flex items-center gap-3 px-5 py-3 text-sm transition hover:bg-canvas/60">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-ink">{p.name}</p>
                <p className="text-xs text-muted">
                  {fmtDate(p.created_at)} · {p.target_kcal ? `${num(p.target_kcal)} kcal` : "sans cible"}
                </p>
              </div>
              <ChevronRight className="size-4 text-slate-300" />
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function MiniStat({ icon, label, value, sub, tone = "brand" }: { icon: React.ReactNode; label: string; value: string; sub?: string; tone?: "brand" | "accent" | "sky" }) {
  return (
    <div className="rounded-xl border border-line p-3">
      <span className={cn("grid size-7 place-items-center rounded-lg", tone === "accent" ? "bg-accent-50 text-accent-500" : tone === "sky" ? "bg-sky-50 text-sky-600" : "bg-brand-50 text-brand-500")}>{icon}</span>
      <p className="mt-2 font-display text-[15px] font-extrabold leading-tight text-ink">{value}</p>
      <p className="text-[11px] text-muted">{label}</p>
      {sub && <p className="mt-0.5 text-[10px] text-slate-400">{sub}</p>}
    </div>
  );
}
