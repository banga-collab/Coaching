import { requireStaff } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { BackLink } from "@/components/back-link";
import { TemplateBuilder } from "@/components/phase1/template-builder";

export const metadata = { title: "Nouveau modèle d'évaluation" };

export default async function NewTemplatePage() {
  await requireStaff();
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        back={<BackLink href="/evaluations" label="Évaluations" />}
        title="Nouveau modèle"
        subtitle="Ajoute les champs à mesurer ou observer. L'aperçu montre le formulaire tel qu'il sera rempli."
      />
      <TemplateBuilder />
    </div>
  );
}
