import Link from "next/link";
import { ArrowRight, CalendarDays, ClipboardList, History, ListChecks, Plus, Users } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Assessment, AssessmentTemplate, Client } from "@/lib/types";
import { fmtDate, num } from "@/lib/utils";
import { Avatar, Badge, Card, CardHeader, Empty, Kpi, LinkButton, PageHeader } from "@/components/ui";
import { BilanOverview } from "@/components/bilan/bilan-overview";

export const metadata = { title: "Évaluations" };

const CAT_TONE: Record<string, "brand" | "accent" | "green" | "amber" | "gray"> = {
  Performance: "accent",
  Posture: "brand",
  Nutrition: "green",
  Mobilité: "amber",
  Santé: "green",
};

export default async function EvaluationsPage() {
  await requireStaff();
  const supabase = await createClient();
  const [{ data: tData }, { data: aData }, { data: cData }] = await Promise.all([
    supabase.from("assessment_templates").select("*").order("created_at", { ascending: false }),
    supabase.from("assessments").select("*").order("done_on", { ascending: false }).limit(500),
    supabase.from("clients").select("id, full_name"),
  ]);
  const templates = (tData ?? []) as AssessmentTemplate[];
  const assessments = (aData ?? []) as Assessment[];
  const names = new Map(((cData ?? []) as Pick<Client, "id" | "full_name">[]).map((c) => [c.id, c.full_name]));

  const usage = new Map<string, { count: number; last: string | null }>();
  for (const a of assessments) {
    if (!a.template_id) continue;
    const u = usage.get(a.template_id) ?? { count: 0, last: null };
    u.count++;
    if (!u.last || a.done_on > u.last) u.last = a.done_on;
    usage.set(a.template_id, u);
  }
  const monthAgo = new Date();
  monthAgo.setDate(monthAgo.getDate() - 30);
  const last30 = assessments.filter((a) => new Date(a.done_on) >= monthAgo).length;
  const evaluated = new Set(assessments.map((a) => a.client_id)).size;
  const recent = assessments.slice(0, 8);

  return (
    <>
      <PageHeader
        title="Évaluations"
        subtitle="Crée tes propres bilans et tests, puis fais-les passer à tes clients pour suivre leur évolution."
        actions={
          <LinkButton href="/evaluations/nouveau">
            <Plus className="size-4" /> Nouveau modèle
          </LinkButton>
        }
      />

      <BilanOverview />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3 animate-fade-up">
        <Kpi label="Modèles" value={templates.length} icon={<ListChecks className="size-[18px]" />} />
        <Kpi tone="accent" label="Évaluations (30 j)" value={last30} icon={<CalendarDays className="size-[18px]" />} />
        <div className="col-span-2 lg:col-span-1">
          <Kpi label="Clients évalués" value={evaluated} icon={<Users className="size-[18px]" />} />
        </div>
      </div>

      {templates.length === 0 ? (
        <Card>
          <Empty
            icon={<ClipboardList className="size-6" />}
            title="Aucun modèle d'évaluation"
            text="Construis ton premier bilan : tests physiques, bilan postural, questionnaire nutrition… avec les champs dont tu as besoin."
            action={
              <LinkButton href="/evaluations/nouveau">
                <Plus className="size-4" /> Créer un modèle
              </LinkButton>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 animate-fade-up">
          {templates.map((t) => {
            const u = usage.get(t.id);
            return (
              <Link
                key={t.id}
                href={`/evaluations/${t.id}`}
                className="group relative flex flex-col overflow-hidden rounded-2xl border border-line bg-white p-5 shadow-card transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-pop"
              >
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 to-brand-300 opacity-0 transition group-hover:opacity-100" />
                <div className="flex items-start justify-between gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-500">
                    <ClipboardList className="size-5" />
                  </span>
                  {t.category && <Badge tone={CAT_TONE[t.category] ?? "gray"}>{t.category}</Badge>}
                </div>
                <h3 className="mt-4 font-display text-[15px] font-bold text-ink">{t.name}</h3>
                <p className="mt-1 line-clamp-2 min-h-10 text-sm text-muted">{t.description || "Aucune description."}</p>
                <div className="mt-4 flex items-center gap-4 border-t border-line pt-3 text-xs text-muted">
                  <span className="inline-flex items-center gap-1">
                    <ListChecks className="size-3.5" /> {t.fields.length} champ{t.fields.length > 1 ? "s" : ""}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <History className="size-3.5" /> {u?.count ?? 0} utilisation{(u?.count ?? 0) > 1 ? "s" : ""}
                  </span>
                  <ArrowRight className="ml-auto size-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-brand-500" />
                </div>
                {u?.last && <p className="mt-1.5 text-[11px] text-slate-400">Dernière : {fmtDate(u.last)}</p>}
              </Link>
            );
          })}
          <Link
            href="/evaluations/nouveau"
            className="flex min-h-[200px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-line text-sm font-semibold text-muted transition hover:border-brand-300 hover:bg-brand-50/40 hover:text-brand-600"
          >
            <span className="mb-2 grid size-10 place-items-center rounded-xl bg-white shadow-card">
              <Plus className="size-5" />
            </span>
            Nouveau modèle
          </Link>
        </div>
      )}

      <Card className="mt-6 overflow-hidden animate-fade-up">
        <CardHeader title="Évaluations récentes" subtitle="Toutes les évaluations passées par tes clients" icon={<History className="size-4" />} />
        {recent.length === 0 ? (
          <p className="px-5 pb-6 text-sm text-muted">Aucune évaluation pour le moment. Ouvre une fiche client, onglet « Évaluations », pour en faire passer une.</p>
        ) : (
          <ul className="divide-y divide-line border-t border-line">
            {recent.map((a) => {
              const name = names.get(a.client_id) ?? "Client";
              return (
                <li key={a.id}>
                  <Link href={`/clients/${a.client_id}?tab=evaluations`} className="flex items-center gap-3 px-5 py-3 transition hover:bg-canvas/60">
                    <Avatar name={name} size={36} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink">{name}</p>
                      <p className="truncate text-xs text-muted">{a.template_name}</p>
                    </div>
                    {a.score !== null && (
                      <span className="hidden rounded-lg bg-brand-50 px-2 py-1 text-xs font-bold text-brand-600 sm:inline">Score {num(a.score)}</span>
                    )}
                    <span className="whitespace-nowrap text-xs text-muted">{fmtDate(a.done_on, { day: "numeric", month: "short" })}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}
