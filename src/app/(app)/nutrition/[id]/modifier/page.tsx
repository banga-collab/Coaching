import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { MealPlan } from "@/lib/types";
import { PageHeader } from "@/components/ui";
import { BackLink } from "@/components/back-link";
import { PlanBuilder } from "@/components/nutrition/plan-builder";
import { loadBuilderData } from "@/components/nutrition/loaders";

export const metadata = { title: "Modifier le plan alimentaire" };

export default async function EditMealPlanPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  const supabase = await createClient();
  const [{ data }, { foods, clients }] = await Promise.all([supabase.from("meal_plans").select("*").eq("id", id).maybeSingle(), loadBuilderData()]);
  const plan = data as MealPlan | null;
  if (!plan) notFound();
  if (plan.client_id && !clients.some((c) => c.id === plan.client_id)) {
    const { data: c } = await supabase.from("clients").select("id, full_name").eq("id", plan.client_id).maybeSingle();
    if (c) clients.unshift({ id: c.id as string, name: c.full_name as string, sex: null, age: null, height: null, weight: null });
  }
  return (
    <>
      <PageHeader back={<BackLink href={`/nutrition/${plan.id}`} label={plan.name} />} title="Modifier le plan" subtitle="Ajuste les cibles, les repas et les portions." />
      <PlanBuilder foods={foods} clients={clients} plan={plan} />
    </>
  );
}
