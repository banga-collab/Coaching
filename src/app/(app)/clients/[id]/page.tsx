import Link from "next/link";
import { notFound } from "next/navigation";
import { Archive, CalendarPlus, ClipboardCheck, ClipboardList, FileText, HeartPulse, Link2, Mail, MessageCircle, Pencil, Phone, Ruler, Target, Watch } from "lucide-react";
import { isManager, requireStaff } from "@/lib/auth";
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
import { WhatsAppButton } from "@/components/modules/whatsapp-button";
import { AiSummaryButton } from "@/components/modules/ai-summary";
import { NutritionTab } from "@/components/modules/nutrition-tab";
import { PhotosTab } from "@/components/modules/photos-tab";
import { WorkoutsTab } from "@/components/modules/workouts-tab";
import { BilanCard } from "@/components/bilan/bilan-card";
import { FileTabsNav, resolveTab, type FileTab } from "@/components/file-tabs";
import { getT } from "@/lib/i18n";

/**
 * 5 onglets au plus. Les anciennes valeurs de ?tab= (progression, objectifs, photos, entrainements, nutrition,
 * evaluations, documents, infos…) restent valides : elles ouvrent l'onglet qui les regroupe.
 */
function clientTabs(t: (k: string) => string, sessions: number): FileTab[] {
  return [
    { key: "apercu", label: t("file.tab.overview"), subs: [{ key: "progression", label: t("file.sub.progress") }, { key: "objectifs", label: t("file.sub.goals") }, { key: "photos", label: t("file.sub.photos") }] },
    { key: "seances", label: t("file.tab.sessions"), count: sessions, subs: [{ key: "seances", label: t("file.sub.sessions") }, { key: "entrainements", label: t("file.sub.workouts") }] },
    { key: "programme", label: t("file.tab.program"), subs: [{ key: "programme", label: t("file.sub.program") }, { key: "nutrition", label: t("file.sub.nutrition") }] },
    { key: "sante", label: t("file.tab.health"), aliases: ["evaluations", "bilan", "mesures"] },
    { key: "dossier", label: t("file.tab.file"), subs: [{ key: "infos", label: t("file.sub.info") }, { key: "documents", label: t("file.sub.documents") }] },
  ];
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("clients").select("full_name").eq("id", id).single();
  return { title: data?.full_name ?? "Client" };
}

export default async function ClientPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const [{ id }, { tab: rawTab }] = await Promise.all([params, searchParams]);
  const [me, t] = await Promise.all([requireStaff(), getT()]);
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
  const tabs = clientTabs(t, sessions.length);
  const { main, sub } = resolveTab(tabs, rawTab);
  const tab = main.key === "sante" ? "sante" : sub;

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
            <LinkButton href={`/messages?client=${id}`} variant="secondary" className="h-9">
              <MessageCircle className="size-4" /> {t("file.message")}
            </LinkButton>
            <LinkButton href={`/clients/${id}/rapport`} variant="secondary" className="h-9">
              <FileText className="size-4" /> {t("file.report")}
            </LinkButton>
            <LinkButton href={`/seances/nouvelle?client=${id}`} variant="brand" className="h-9">
              <CalendarPlus className="size-4" /> {t("quick.session")}
            </LinkButton>
          </div>
        </div>
      </Card>

      <FileTabsNav tabs={tabs} main={main} sub={sub} base={`/clients/${id}`} />

      <div className="animate-fade-up">
        {tab === "progression" && <ProgressView rows={meas} clientId={id} canEdit lossGoal={lossGoal} />}
        {tab === "seances" && <SessionsView sessions={sessions} clientId={id} canEdit />}
        {tab === "objectifs" && <GoalsTab clientId={id} canEdit />}
        {tab === "programme" && <ProgramTab clientId={id} canEdit />}
        {tab === "documents" && <DocumentsTab clientId={id} canEdit />}
        {tab === "nutrition" && <NutritionTab clientId={id} canEdit />}
        {tab === "photos" && <PhotosTab clientId={id} canEdit />}
        {tab === "entrainements" && <WorkoutsTab clientId={id} canEdit />}
        {tab === "sante" && (
          <div className="space-y-6">
            {/* Points d'entrée : tout ce qui touche à la santé et aux bilans, au même endroit */}
            <div className="no-print grid grid-cols-2 gap-2.5 lg:grid-cols-5">
              {[
                { href: `/clients/${id}/bilan-sportif/nouveau`, icon: ClipboardCheck, label: t("file.health.sport") },
                { href: `/clients/${id}/bilan`, icon: HeartPulse, label: t("file.health.check") },
                { href: `/clients/${id}/mesure`, icon: Ruler, label: t("file.health.measure") },
                { href: `/clients/${id}/evaluation`, icon: ClipboardList, label: t("file.health.eval") },
                { href: `/clients/${id}/sante`, icon: Watch, label: t("file.health.connected") },
              ].map((e) => (
                <Link key={e.href} href={e.href} className="flex min-h-14 items-center gap-2.5 rounded-2xl border border-line bg-white px-3.5 py-3 text-sm font-semibold text-ink shadow-card transition hover:border-brand-200 hover:bg-brand-50/40">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-500">
                    <e.icon className="size-[18px]" />
                  </span>
                  <span className="min-w-0 leading-tight">{e.label}</span>
                </Link>
              ))}
            </div>
            <section>
              <h2 className="mb-2 font-display text-lg font-bold">{t("file.health.sportTitle")}</h2>
              <BilanCard clientId={id} sex={c.sex} ageYears={years} />
            </section>
            <section>
              <h2 className="mb-3 font-display text-lg font-bold">{t("file.health.checksTitle")}</h2>
              <HealthView checks={checks} heightCm={c.height_cm} lastWeight={lastWeight} clientId={id} canEdit />
            </section>
            <section id="evaluations" className="scroll-mt-20">
              <h2 className="mb-3 font-display text-lg font-bold">{t("file.health.evalTitle")}</h2>
              <AssessmentsTab clientId={id} canEdit />
            </section>
          </div>
        )}
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
              {c.status !== "termine" && (isManager(me.role) || c.coach_id === me.id) && (
                <Card className="border-red-100 p-5">
                  <h3 className="font-display font-bold text-red-700">Fin du suivi</h3>
                  <p className="mt-2 text-sm text-muted">Archiver le client le passe en statut Terminé. Ses séances, mesures et bilans sont conservés.</p>
                  <form action={deleteClientAction} className="mt-4">
                    <input type="hidden" name="id" value={c.id} />
                    <ConfirmButton message="Archiver ce client ? Il passe en statut Terminé, son historique est conservé.">
                      <Archive className="size-4" /> Archiver le client
                    </ConfirmButton>
                  </form>
                </Card>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
