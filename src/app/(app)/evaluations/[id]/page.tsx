import { notFound } from "next/navigation";
import { Trash2 } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { AssessmentTemplate } from "@/lib/types";
import { PageHeader } from "@/components/ui";
import { BackLink } from "@/components/back-link";
import { ConfirmButton } from "@/components/confirm-button";
import { TemplateBuilder } from "@/components/phase1/template-builder";
import { deleteTemplateAction } from "@/actions/phase1";

export const metadata = { title: "Modèle d'évaluation" };

export default async function EditTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireStaff();
  const supabase = await createClient();
  const [{ data }, { count }] = await Promise.all([
    supabase.from("assessment_templates").select("*").eq("id", id).maybeSingle(),
    supabase.from("assessments").select("*", { count: "exact", head: true }).eq("template_id", id),
  ]);
  if (!data) notFound();
  const t = data as AssessmentTemplate;
  const used = count ?? 0;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        back={<BackLink href="/evaluations" label="Évaluations" />}
        title={t.name}
        subtitle={
          used > 0
            ? `Utilisé ${used} fois. Les évaluations déjà passées gardent leur propre copie des champs.`
            : "Modifie les champs, l'ordre ou les options de ce modèle."
        }
        actions={
          <form action={deleteTemplateAction}>
            <input type="hidden" name="id" value={t.id} />
            <ConfirmButton
              message={
                used > 0
                  ? `Supprimer le modèle « ${t.name} » ? Les ${used} évaluation(s) déjà réalisée(s) restent dans les fiches clients.`
                  : `Supprimer le modèle « ${t.name} » ?`
              }
              className="h-9"
            >
              <Trash2 className="size-4" /> Supprimer
            </ConfirmButton>
          </form>
        }
      />
      <TemplateBuilder template={t} />
    </div>
  );
}
