import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarPlus, FileText, HeartPulse, Link2, Mail, Pencil, Phone, Ruler, Target, Trash2 } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Client, HealthCheck, Measurement, Session } from "@/lib/types";
import { STATUS_LABEL, age, cn, fmtDate, num } from "@/lib/utils";
import { Avatar, Badge, Card, CardHeader, LinkButton } from "@/components/ui";
import { BackLink } from "@/components/back-link";
import { HealthView, ProgressView, SessionsView } from "@/components/client-views";
import { deleteClientAction } from "../../actions";
import { ConfirmButton } from "@/components/confirm-button";
import { GoalsTab } from "@/components/modules/goals-tab";
import { AssessmentsTab } from "@/components/modules/assessments-tab";
import { DocumentsTab } from "@/components/modules/documents-tab";
import { ProgramTab } from "@/components/modules/program-tab";
import { InvoicesTab } from "@/components/modules/invoices-tab";
import { WhatsAppButton } from "@/components/modules/whatsapp-button";
import { AiSummaryButton } from "@/components/modules/ai-summary";

const TABS = [
  { key: "progression", label: "Progression" },
  { key: "objectifs", label: "Objectifs" },
  { key: "seances", label: "Séances" },
  { key: "programme", label: "Programme" },
  { key: "evaluations", label: "Évaluations" },
  { key: "sante", label: "Santé" },
  { key: "documents", label: "Documents" },
  { key: "factures", label: "Factures" },
  { key: "infos", label: "Infos" },
];

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("clients").select("full_name").eq("id", id).single();
  return { title: data?.full_name ?? "Client" };
}

export default async function ClientPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const [{ id }, { tab = "progression" }] = await Promise.all([params, searchParams]);
  await requireStaff();
  const supabase = await createClient();

  const [{ data: cData }, { data: mData }, { data: hData }, { data: sData }] = await Promise.all([
    supabase.from("clients").select("*").eq("id", id).single(),
    supabase.from("measurements").select("*").eq("client_id", id).order("measured_on"),
    supabase.from("health_checks").select("*").eq("client_id", id).order("checked_on"),
    supabase.from("sessions").select("*").eq("client_id", id).order("starts_at", { ascending: false }).limit(200),
  ]);
  if (!cData) notFound();
  const c = cData as Client;
  const meas = (mData ?? []) as Measurement[];
  const checks = (hData ?? []) as HealthCheck[];
  const sessions = (sData ?? []) as Session[];
  const years = age(c.birth_date);
  const lastWeight = [...meas].reverse().find((m) => m.weight_kg !== null)?.weight_kg ?? null;
  const lossGoal = !/masse|prise/i.test(c.goal ?? "");

  return (
    <>
      <BackLink href="/clients" label="Clients" />

      <Card className="relative overflow-hidden animate-fade-up">
        <div className="relative h-24 overflow-hidden bg-gradient-to-r from-brand-700 via-brand-500 to-brand-400">
          <svg className="absolute inset-y-0 right-0 h-full w-1/2 opacity-70" aria-hidden>
            {Array.from({ length: 18 }, (_, i) => (
              <rect key={i} x={`${(i * 41) % 100}%`} y={`${(i * 29) % 90}%`} width={6 + (i % 4) * 3} height={6 + (i % 4) * 3} fill={i % 4 === 0 ? "#ec8a45" : "rgba(255,255,255,.22)"} transform={`rotate(${(i * 11) % 25})`} />
            ))}
          </svg>
        </div>
        <div className="relative -mt-12 flex flex-col gap-4 px-5 pb-5 sm:flex-row sm:flex-wrap sm:items-start sm:px-6">
          <Avatar name={c.full_name} size={96} className="ring-4 ring-white shadow-pop" />
          <div className="min-w-0 flex-1 sm:pt-[60px]">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl font-extrabold tracking-tight">{c.full_name}</h1>
              <Badge dot tone={c.status === "actif" ? "green" : c.status === "pause" ? "amber" : "gray"}>{STATUS_LABEL[c.status]}</Badge>
              {c.user_id && (
                <Badge tone="brand">
                  <Link2 className="size-3" /> Compte relié
                </Badge>
              )}
            </div>
            <p className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
              {years && <span>{years} ans</span>}
              {c.goal && (
                <span className="inline-flex items-center gap-1">
                  <Target className="size-3.5 text-accent-500" /> {c.goal}
                </span>
              )}
              {c.frequency && <span>{c.frequency}</span>}
              <span>Depuis le {fmtDate(c.start_date)}</span>
            </p>
          </div>
          <div className="no-print flex flex-wrap gap-2 sm:w-full sm:pl-[112px] 2xl:w-auto 2xl:pl-0 2xl:pt-[60px]">
            <AiSummaryButton clientId={id} />
            <WhatsAppButton phone={c.phone} name={c.full_name} compact />
            <LinkButton href={`/clients/${id}/mesure`} variant="secondary" className="h-9">
              <Ruler className="size-4" /> Mesure
            </LinkButton>
            <LinkButton href={`/clients/${id}/bilan`} variant="secondary" className="h-9">
              <HeartPulse className="size-4" /> Bilan
            </LinkButton>
            <LinkButton href={`/seances/nouvelle?client=${id}`} variant="secondary" className="h-9">
              <CalendarPlus className="size-4" /> Séance
            </LinkButton>
            <LinkButton href={`/clients/${id}/rapport`} variant="brand" className="h-9">
              <FileText className="size-4" /> Rapport
            </LinkButton>
          </div>
        </div>
      </Card>

      <nav className="no-print my-5 flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/clients/${id}?tab=${t.key}`}
            scroll={false}
            className={cn(
              "-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold transition",
              tab === t.key ? "border-accent-500 text-brand-600" : "border-transparent text-muted hover:text-ink",
            )}
          >
            {t.label}
            {t.key === "seances" && sessions.length > 0 && <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 text-xs text-slate-500">{sessions.length}</span>}
          </Link>
        ))}
      </nav>

      <div className="animate-fade-up">
        {tab === "progression" && <ProgressView rows={meas} clientId={id} canEdit lossGoal={lossGoal} />}
        {tab === "seances" && <SessionsView sessions={sessions} clientId={id} canEdit />}
        {tab === "objectifs" && <GoalsTab clientId={id} canEdit />}
        {tab === "programme" && <ProgramTab clientId={id} canEdit />}
        {tab === "evaluations" && <AssessmentsTab clientId={id} canEdit />}
        {tab === "documents" && <DocumentsTab clientId={id} canEdit />}
        {tab === "factures" && <InvoicesTab clientId={id} canEdit />}
        {tab === "sante" && <HealthView checks={checks} heightCm={c.height_cm} lastWeight={lastWeight} clientId={id} canEdit />}
        {tab === "infos" && (
          <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
            <Card>
              <CardHeader title="Informations" action={<LinkButton href={`/clients/${id}/modifier`} variant="secondary" className="h-9"><Pencil className="size-4" /> Modifier</LinkButton>} />
              <dl className="grid gap-x-6 px-5 pb-5 sm:grid-cols-2">
                {[
                  ["E-mail", c.email, Mail],
                  ["Téléphone", c.phone, Phone],
                  ["Date de naissance", c.birth_date ? `${fmtDate(c.birth_date)}${years ? ` (${years} ans)` : ""}` : null],
                  ["Sexe", c.sex === "H" ? "Homme" : c.sex === "F" ? "Femme" : null],
                  ["Taille", c.height_cm ? num(c.height_cm, "cm") : null],
                  ["Objectif", c.goal],
                  ["Fréquence", c.frequency],
                  ["Début du suivi", fmtDate(c.start_date)],
                ].map(([k, v]) => (
                  <div key={k as string} className="border-b border-line py-3">
                    <dt className="text-xs text-muted">{k as string}</dt>
                    <dd className={cn("mt-0.5 text-sm font-medium", !v && "text-slate-400")}>{(v as string) || "—"}</dd>
                  </div>
                ))}
              </dl>
              {c.notes && <p className="mx-5 mb-5 whitespace-pre-line rounded-xl bg-canvas p-4 text-sm text-slate-700">{c.notes}</p>}
            </Card>
            <div className="space-y-5">
              <Card className="p-5">
                <h3 className="font-display font-bold">Espace adhérent</h3>
                {c.user_id ? (
                  <p className="mt-2 text-sm text-muted">Le client a un compte relié. Il voit sa progression, ses séances et peut remplir ses check-ins.</p>
                ) : c.email ? (
                  <p className="mt-2 text-sm text-muted">
                    Invite le client à créer son compte sur l&apos;application avec l&apos;e-mail <b className="text-ink">{c.email}</b>. Son dossier sera relié automatiquement.
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-muted">Ajoute l&apos;e-mail du client pour qu&apos;il puisse créer son compte et suivre sa progression.</p>
                )}
              </Card>
              <Card className="border-red-100 p-5">
                <h3 className="font-display font-bold text-red-700">Zone sensible</h3>
                <p className="mt-2 text-sm text-muted">Supprimer le client efface aussi ses séances, mesures et bilans. Action définitive.</p>
                <form action={deleteClientAction} className="mt-4">
                  <input type="hidden" name="id" value={c.id} />
                  <ConfirmButton message={`Supprimer définitivement ${c.full_name} et tout son historique ?`}>
                    <Trash2 className="size-4" /> Supprimer le client
                  </ConfirmButton>
                </form>
              </Card>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
