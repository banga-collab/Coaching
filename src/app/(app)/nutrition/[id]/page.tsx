import Link from "next/link";
import { notFound } from "next/navigation";
import { Archive, ArchiveRestore, Copy, LayoutTemplate, Pencil, Trash2, Users } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Client, Food, MealPlan } from "@/lib/types";
import { fmtDate } from "@/lib/utils";
import { Avatar, Badge, Card, CardHeader, LinkButton, PageHeader } from "@/components/ui";
import { BackLink } from "@/components/back-link";
import { ConfirmButton } from "@/components/confirm-button";
import { SubmitButton } from "@/components/submit-button";
import { PlanMeals, PlanSummary } from "@/components/nutrition/plan-view";
import { AssignPlanForm } from "@/components/nutrition/assign-plan-form";
import { deletePlanAction, setPlanActiveAction } from "@/actions/nutrition";

export const metadata = { title: "Plan alimentaire" };

export default async function MealPlanPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  const supabase = await createClient();
  const [{ data }, { data: fData }, { data: cData }] = await Promise.all([
    supabase.from("meal_plans").select("*").eq("id", id).maybeSingle(),
    supabase.from("foods").select("*"),
    supabase.from("clients").select("id, full_name, status").order("full_name"),
  ]);
  const plan = data as MealPlan | null;
  if (!plan) notFound();
  const foods = (fData ?? []) as Food[];
  const clients = (cData ?? []) as Pick<Client, "id" | "full_name" | "status">[];
  const owner = plan.client_id ? clients.find((c) => c.id === plan.client_id) : null;
  const template = plan.client_id === null;
  const back = owner ? `/clients/${owner.id}?tab=nutrition` : "/nutrition";

  return (
    <>
      <PageHeader
        back={<BackLink href={owner ? back : "/nutrition"} label={owner ? owner.full_name : "Nutrition"} />}
        title={plan.name}
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-2">
            {template ? (
              <Badge tone="brand">
                <LayoutTemplate className="size-3" /> Modèle
              </Badge>
            ) : plan.active ? (
              <Badge tone="green" dot>
                Plan actif
              </Badge>
            ) : (
              <Badge tone="gray">Archivé</Badge>
            )}
            <span>Créé le {fmtDate(plan.created_at)}</span>
          </span>
        }
        actions={
          <>
            <LinkButton href={`/nutrition/nouveau?modele=${plan.id}`} variant="secondary">
              <Copy className="size-4" /> Dupliquer
            </LinkButton>
            <LinkButton href={`/nutrition/${plan.id}/modifier`}>
              <Pencil className="size-4" /> Modifier
            </LinkButton>
          </>
        }
      />

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-5">
          <PlanMeals plan={plan} foods={foods} />
        </div>
        <aside className="space-y-4 lg:sticky lg:top-6">
          <PlanSummary plan={plan} />

          <Card>
            <CardHeader
              title={template ? "Assigner à un client" : "Copier vers un autre client"}
              subtitle="Une copie devient le plan actif du client"
              icon={<Users className="size-4" />}
            />
            <div className="px-5 pb-5">
              <AssignPlanForm
                planId={plan.id}
                options={clients.filter((c) => c.status !== "termine" && c.id !== plan.client_id).map((c) => ({ id: c.id, label: c.full_name }))}
                placeholder="Choisir un client…"
              />
            </div>
          </Card>

          {owner && (
            <Card className="p-5">
              <Link href={back} className="flex items-center gap-3 rounded-xl transition hover:opacity-80">
                <Avatar name={owner.full_name} size={40} />
                <div className="min-w-0">
                  <p className="truncate font-semibold text-ink">{owner.full_name}</p>
                  <p className="text-xs text-muted">Voir le suivi nutrition du client</p>
                </div>
              </Link>
              <form action={setPlanActiveAction} className="mt-4">
                <input type="hidden" name="id" value={plan.id} />
                <input type="hidden" name="active" value={plan.active ? "0" : "1"} />
                <SubmitButton variant="secondary" className="w-full" pendingText="…">
                  {plan.active ? (
                    <>
                      <Archive className="size-4" /> Archiver ce plan
                    </>
                  ) : (
                    <>
                      <ArchiveRestore className="size-4" /> Réactiver ce plan
                    </>
                  )}
                </SubmitButton>
              </form>
            </Card>
          )}

          <form action={deletePlanAction}>
            <input type="hidden" name="id" value={plan.id} />
            <input type="hidden" name="back" value={back} />
            <ConfirmButton message={`Supprimer définitivement « ${plan.name} » ?`} className="w-full">
              <Trash2 className="size-4" /> Supprimer le plan
            </ConfirmButton>
          </form>
        </aside>
      </div>
    </>
  );
}
