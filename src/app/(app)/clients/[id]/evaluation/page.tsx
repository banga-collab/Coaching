import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, ClipboardList, NotebookPen, Plus } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Assessment, AssessmentTemplate } from "@/lib/types";
import { fmtDate } from "@/lib/utils";
import { Badge, Card, Empty, Field, Input, LinkButton, PageHeader, SectionTitle, Textarea } from "@/components/ui";
import { BackLink } from "@/components/back-link";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { AssessmentFieldInput } from "@/components/phase1/field-input";
import { formatAnswer } from "@/components/phase1/shared";
import { createAssessmentAction } from "@/actions/phase1";

export const metadata = { title: "Nouvelle évaluation" };

export default async function RunAssessmentPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ modele?: string }> }) {
  const [{ id }, { modele }] = await Promise.all([params, searchParams]);
  await requireStaff();
  const supabase = await createClient();
  const { data: c } = await supabase.from("clients").select("id, full_name").eq("id", id).single();
  if (!c) notFound();
  const back = <BackLink href={`/clients/${id}?tab=evaluations`} label={c.full_name} />;

  /* ---------- Choix du modèle ---------- */
  if (!modele) {
    const [{ data: tData }, { data: aData }] = await Promise.all([
      supabase.from("assessment_templates").select("*").order("name"),
      supabase.from("assessments").select("*").eq("client_id", id).order("done_on", { ascending: false }),
    ]);
    const templates = (tData ?? []) as AssessmentTemplate[];
    const lastByTpl = new Map<string, string>();
    for (const a of (aData ?? []) as Assessment[]) if (a.template_id && !lastByTpl.has(a.template_id)) lastByTpl.set(a.template_id, a.done_on);

    return (
      <div className="mx-auto max-w-4xl">
        <PageHeader back={back} title="Nouvelle évaluation" subtitle={`Choisis le modèle à faire passer à ${c.full_name}.`} />
        {templates.length === 0 ? (
          <Card>
            <Empty
              icon={<ClipboardList className="size-6" />}
              title="Aucun modèle disponible"
              text="Crée d'abord un modèle d'évaluation (tests, bilan postural, questionnaire…)."
              action={
                <LinkButton href="/evaluations/nouveau">
                  <Plus className="size-4" /> Créer un modèle
                </LinkButton>
              }
            />
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 animate-fade-up">
            {templates.map((t) => (
              <Link
                key={t.id}
                href={`/clients/${id}/evaluation?modele=${t.id}`}
                className="group flex items-center gap-4 rounded-2xl border border-line bg-white p-4 shadow-card transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-pop"
              >
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-500">
                  <ClipboardList className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-sm font-bold text-ink">{t.name}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {t.fields.length} champ{t.fields.length > 1 ? "s" : ""}
                    {lastByTpl.has(t.id) ? ` · dernière fois le ${fmtDate(lastByTpl.get(t.id)!)}` : " · jamais passé"}
                  </p>
                </div>
                {t.category && (
                  <span className="hidden sm:block">
                    <Badge tone="gray">{t.category}</Badge>
                  </span>
                )}
                <ArrowRight className="size-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-brand-500" />
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }

  /* ---------- Formulaire ---------- */
  const [{ data: tpl }, { data: prevData }] = await Promise.all([
    supabase.from("assessment_templates").select("*").eq("id", modele).maybeSingle(),
    supabase.from("assessments").select("*").eq("client_id", id).eq("template_id", modele).order("done_on", { ascending: false }).limit(1),
  ]);
  if (!tpl) notFound();
  const t = tpl as AssessmentTemplate;
  const prev = (prevData?.[0] ?? null) as Assessment | null;
  const prevFor = (fid: string) => {
    if (!prev) return undefined;
    const f = prev.fields.find((x) => x.id === fid) ?? t.fields.find((x) => x.id === fid);
    const v = prev.answers[fid];
    if (!f || v === null || v === undefined || f.type === "text") return undefined;
    return formatAnswer(f, v);
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        back={back}
        title={t.name}
        subtitle={
          <>
            Évaluation de <b className="text-ink">{c.full_name}</b>
            {prev ? ` · précédente le ${fmtDate(prev.done_on)}` : " · première évaluation"}
          </>
        }
        actions={
          <LinkButton href={`/clients/${id}/evaluation`} variant="secondary" className="h-9">
            Changer de modèle
          </LinkButton>
        }
      />
      <ActionForm action={createAssessmentAction}>
        <input type="hidden" name="client_id" value={id} />
        <input type="hidden" name="template_id" value={t.id} />
        <Card className="p-5 sm:p-7">
          {t.description && <p className="mb-5 rounded-xl bg-canvas px-4 py-3 text-sm text-slate-600">{t.description}</p>}
          <Field label="Date" className="sm:max-w-xs">
            <Input name="done_on" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
          </Field>
          <SectionTitle icon={<ClipboardList className="size-4" />}>Résultats</SectionTitle>
          <div className="space-y-3">
            {t.fields.map((f, i) => (
              <AssessmentFieldInput key={f.id} field={f} name={`a_${f.id}`} index={i} previous={prevFor(f.id)} />
            ))}
          </div>
          <SectionTitle icon={<NotebookPen className="size-4" />}>Synthèse</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
            <Field label="Score global (optionnel)" hint={prev?.score !== null && prev?.score !== undefined ? `Précédent : ${prev.score}` : "Ex. note sur 10 ou sur 100"}>
              <Input name="score" inputMode="decimal" placeholder="—" />
            </Field>
            <Field label="Notes du coach">
              <Textarea name="notes" placeholder="Points forts, axes de travail, conditions du test…" />
            </Field>
          </div>
        </Card>
        <div className="sticky bottom-20 z-10 mt-5 flex justify-end gap-2 lg:bottom-4">
          <LinkButton href={`/clients/${id}?tab=evaluations`} variant="secondary">
            Annuler
          </LinkButton>
          <SubmitButton>Enregistrer l&apos;évaluation</SubmitButton>
        </div>
      </ActionForm>
    </div>
  );
}
