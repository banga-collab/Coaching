import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { MealPlan } from "@/lib/types";
import { PageHeader } from "@/components/ui";
import { BackLink } from "@/components/back-link";
import { PlanBuilder } from "@/components/nutrition/plan-builder";
import { loadBuilderData } from "@/components/nutrition/loaders";

export const metadata = { title: "Nouveau plan alimentaire" };

export default async function NewMealPlanPage({ searchParams }: { searchParams: Promise<{ client?: string; modele?: string }> }) {
  await requireStaff();
  const { client, modele } = await searchParams;
  const supabase = await createClient();
  const [{ foods, clients }, { data: src }] = await Promise.all([
    loadBuilderData(),
    modele ? supabase.from("meal_plans").select("*").eq("id", modele).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const source = (src ?? null) as MealPlan | null;
  const target = clients.find((c) => c.id === client) ?? null;
  return (
    <>
      <PageHeader
        back={<BackLink href={target ? `/clients/${target.id}?tab=nutrition` : "/nutrition"} label={target ? target.name : "Nutrition"} />}
        title={target ? `Nouveau plan pour ${target.name.split(" ")[0]}` : "Nouveau plan alimentaire"}
        subtitle={
          source
            ? `À partir de « ${source.name} » : ajuste les portions puis enregistre.`
            : "Calcule les besoins, compose les repas depuis la bibliothèque (plats marocains inclus) et suis les totaux en direct."
        }
      />
      <PlanBuilder foods={foods} clients={clients} source={source} defaultClientId={target?.id ?? null} />
    </>
  );
}
