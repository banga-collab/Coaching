import Link from "next/link";
import { CheckCircle2, HeartPulse, Hourglass } from "lucide-react";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Client, HealthCheck, Measurement, Session } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Card, Empty, LinkButton, PageHeader } from "@/components/ui";
import { HealthView, ProgressView, SessionsView } from "@/components/client-views";
import { GoalsTab } from "@/components/modules/goals-tab";
import { AssessmentsTab } from "@/components/modules/assessments-tab";
import { DocumentsTab } from "@/components/modules/documents-tab";
import { ProgramTab } from "@/components/modules/program-tab";
import { InvoicesTab } from "@/components/modules/invoices-tab";

export const metadata = { title: "Ma progression" };

const TABS = [
  { key: "progression", label: "Progression" },
  { key: "objectifs", label: "Objectifs" },
  { key: "programme", label: "Programme" },
  { key: "seances", label: "Mes séances" },
  { key: "evaluations", label: "Évaluations" },
  { key: "sante", label: "Santé" },
  { key: "documents", label: "Documents" },
  { key: "factures", label: "Factures" },
];

export default async function MePage({ searchParams }: { searchParams: Promise<{ tab?: string; checkin?: string }> }) {
  const { tab = "progression", checkin } = await searchParams;
  const me = await getProfile();
  const supabase = await createClient();
  const { data: cData } = await supabase.from("clients").select("*").eq("user_id", me.id).maybeSingle();

  if (!cData) {
    return (
      <>
        <PageHeader title={`Bienvenue ${(me.full_name || "").split(" ")[0]} 👋`} />
        <Card>
          <Empty
            icon={<Hourglass className="size-6" />}
            title="Ton dossier n'est pas encore relié"
            text={`Demande à ton coach d'ajouter ton e-mail (${me.email}) à ta fiche. Ton suivi apparaîtra ici automatiquement.`}
          />
        </Card>
      </>
    );
  }
  const c = cData as Client;
  const [{ data: m }, { data: h }, { data: s }] = await Promise.all([
    supabase.from("measurements").select("*").eq("client_id", c.id).order("measured_on"),
    supabase.from("health_checks").select("*").eq("client_id", c.id).order("checked_on"),
    supabase.from("sessions").select("*").eq("client_id", c.id).order("starts_at", { ascending: false }).limit(100),
  ]);
  const meas = (m ?? []) as Measurement[];
  const checks = (h ?? []) as HealthCheck[];
  const lastWeight = [...meas].reverse().find((x) => x.weight_kg !== null)?.weight_kg ?? null;
  const lastCheck = checks.at(-1);
  const daysSince = lastCheck ? Math.floor((Date.now() - new Date(lastCheck.checked_on).getTime()) / 86400000) : null;

  return (
    <>
      <PageHeader
        title={`Salut ${c.full_name.split(" ")[0]} 💪`}
        subtitle={c.goal ? `Objectif : ${c.goal}` : "Ton suivi Moov'Up"}
        actions={
          <LinkButton href="/moi/checkin">
            <HeartPulse className="size-4" /> Mon check-in
          </LinkButton>
        }
      />
      {checkin === "ok" && (
        <p className="mb-5 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 animate-fade-up">
          <CheckCircle2 className="size-4" /> Merci ! Ton check-in a bien été envoyé à ton coach.
        </p>
      )}
      {checkin !== "ok" && (daysSince === null || daysSince >= 7) && (
        <Link href="/moi/checkin" className="mb-5 flex items-center gap-3 rounded-2xl bg-gradient-to-r from-accent-500 to-accent-400 p-4 text-white shadow-sm transition hover:brightness-105">
          <HeartPulse className="size-6 shrink-0" />
          <span>
            <b className="block">C&apos;est l&apos;heure de ton check-in de la semaine</b>
            <span className="text-sm text-white/90">2 minutes pour dire à ton coach comment tu te sens.</span>
          </span>
        </Link>
      )}
      <nav className="mb-5 flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map((t) => (
          <Link key={t.key} href={`/moi?tab=${t.key}`} scroll={false} className={cn("-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold transition", tab === t.key ? "border-accent-500 text-brand-600" : "border-transparent text-muted hover:text-ink")}>
            {t.label}
          </Link>
        ))}
      </nav>
      <div className="animate-fade-up">
        {tab === "progression" && <ProgressView rows={meas} clientId={c.id} canEdit={false} lossGoal={!/masse|prise/i.test(c.goal ?? "")} />}
        {tab === "seances" && <SessionsView sessions={(s ?? []) as Session[]} clientId={c.id} canEdit={false} />}
        {tab === "objectifs" && <GoalsTab clientId={c.id} canEdit={false} />}
        {tab === "programme" && <ProgramTab clientId={c.id} canEdit={false} />}
        {tab === "evaluations" && <AssessmentsTab clientId={c.id} canEdit={false} />}
        {tab === "documents" && <DocumentsTab clientId={c.id} canEdit={false} />}
        {tab === "factures" && <InvoicesTab clientId={c.id} canEdit={false} />}
        {tab === "sante" && <HealthView checks={checks} heightCm={c.height_cm} lastWeight={lastWeight} clientId={c.id} canEdit={false} />}
      </div>
    </>
  );
}
