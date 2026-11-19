import Link from "next/link";
import { CalendarClock, CheckCircle2, HeartPulse, Hourglass, MessageCircle, Play, UsersRound } from "lucide-react";
import { getT } from "@/lib/i18n";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Client, HealthCheck, Measurement, Profile, Session } from "@/lib/types";
import { UPCOMING_STATUSES, memberSessionLabel, plannedEnd, visibleToMember } from "@/lib/planning";
import { FileTabsNav, resolveTab, type FileTab } from "@/components/file-tabs";
import { cn, fmtDate, fmtTime } from "@/lib/utils";
import { Card, Empty, LinkButton, PageHeader } from "@/components/ui";
import { HealthView, ProgressView, SessionsView } from "@/components/client-views";
import { GoalsTab } from "@/components/modules/goals-tab";
import { AssessmentsTab } from "@/components/modules/assessments-tab";
import { DocumentsTab } from "@/components/modules/documents-tab";
import { ProgramTab } from "@/components/modules/program-tab";
import { PhotosTab } from "@/components/modules/photos-tab";
import { ConfirmSessions, type PendingSession } from "@/components/controle/confirm-sessions";

export const metadata = { title: "Ma progression" };

/** 5 onglets ; les anciennes valeurs de ?tab= (objectifs, photos, evaluations…) restent valides */
function memberTabs(tr: (k: string) => string): FileTab[] {
  return [
    { key: "progression", label: tr("moi.tab.progression"), subs: [{ key: "progression", label: tr("file.sub.progress") }, { key: "objectifs", label: tr("moi.tab.objectifs") }, { key: "photos", label: tr("moi.tab.photos") }] },
    { key: "seances", label: tr("moi.tab.seances") },
    { key: "programme", label: tr("moi.tab.programme") },
    { key: "sante", label: tr("file.tab.health"), aliases: ["evaluations"] },
    { key: "documents", label: tr("moi.tab.documents") },
  ];
}

export default async function MePage({ searchParams }: { searchParams: Promise<{ tab?: string; checkin?: string }> }) {
  const { tab: rawTab, checkin } = await searchParams;
  const [me, tr] = await Promise.all([getProfile(), getT()]);
  const supabase = await createClient();
  const { data: cData } = await supabase.from("clients").select("*").eq("user_id", me.id).maybeSingle();

  if (!cData) {
    return (
      <>
        <PageHeader title={tr("moi.welcome", { name: (me.full_name || "").split(" ")[0] ?? "" })} />
        <Card>
          <Empty
            icon={<Hourglass className="size-6" />}
            title={tr("moi.notLinked")}
            text={tr("moi.notLinkedText", { email: me.email })}
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
  const tabs = memberTabs(tr);
  const { main, sub } = resolveTab(tabs, rawTab);
  const tab = main.key === "sante" ? "sante" : sub;

  // Ma prochaine séance (ou celle en cours) : statut dit simplement
  const nowMs = Date.now();
  const nextSession = ((s ?? []) as Session[])
    .filter((x) => visibleToMember(x) && (x.status === "en_cours" || (UPCOMING_STATUSES.includes(x.status) && plannedEnd(x) > nowMs)))
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0];
  const { data: coachData } = await supabase.from("profiles").select("full_name").eq("id", c.coach_id).maybeSingle();
  const coachName = ((coachData as Pick<Profile, "full_name"> | null)?.full_name ?? "").split(" ")[0] || null;

  // Séances réalisées des 14 derniers jours à confirmer (contrôle à distance des coachs)
  const recentDone = ((s ?? []) as Session[]).filter((x) => x.status === "realisee" && nowMs - new Date(x.starts_at).getTime() < 14 * 86400000);
  let pending: PendingSession[] = [];
  if (recentDone.length) {
    const [{ data: fb }, { data: coaches }] = await Promise.all([
      supabase.from("session_feedback").select("session_id").eq("client_id", c.id),
      supabase.from("profiles").select("id, full_name").in("id", [...new Set(recentDone.map((x) => x.coach_id))]),
    ]);
    const answered = new Set(((fb ?? []) as { session_id: string }[]).map((f) => f.session_id));
    const names = new Map(((coaches ?? []) as Pick<Profile, "id" | "full_name">[]).map((p) => [p.id, (p.full_name || "").split(" ")[0] || "ton coach"]));
    pending = recentDone
      .filter((x) => !answered.has(x.id))
      .slice(0, 3)
      .map((x) => ({ id: x.id, type: x.type, coach: names.get(x.coach_id) ?? "ton coach", when: `${fmtDate(x.starts_at, { weekday: "long", day: "numeric", month: "long" })} à ${fmtTime(x.starts_at)}` }));
  }

  return (
    <>
      <PageHeader title={tr("moi.hi", { name: c.full_name.split(" ")[0] ?? "" })} subtitle={c.goal ? tr("moi.goal", { goal: c.goal }) : tr("moi.followUp")} />
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
      <ConfirmSessions sessions={pending} />
      <NextSessionCard session={nextSession ?? null} coach={coachName} tr={tr} />

      {/* Raccourcis */}
      <div className="mb-2 grid grid-cols-3 gap-2.5">
        {[
          { href: "/moi/seance", icon: Play, label: tr("moi.quick.start"), tone: "bg-accent-500 text-white shadow-lg shadow-accent-500/25 hover:bg-accent-600" },
          { href: "/moi/messages", icon: MessageCircle, label: tr("moi.quick.message"), tone: "bg-white text-ink border border-line hover:bg-canvas" },
          { href: "/moi/checkin", icon: HeartPulse, label: tr("nav.moi.checkin"), tone: "bg-white text-ink border border-line hover:bg-canvas" },
        ].map((q) => (
          <Link key={q.href} href={q.href} className={cn("flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-2xl px-2 py-3 text-center text-sm font-bold transition", q.tone)}>
            <q.icon className="size-6" />
            <span className="leading-tight">{q.label}</span>
          </Link>
        ))}
      </div>

      <FileTabsNav tabs={tabs} main={main} sub={sub} base="/moi" />
      <div className="animate-fade-up">
        {tab === "progression" && <ProgressView rows={meas} clientId={c.id} canEdit={false} lossGoal={!/masse|prise/i.test(c.goal ?? "")} />}
        {tab === "seances" && <SessionsView sessions={(s ?? []) as Session[]} clientId={c.id} canEdit={false} />}
        {tab === "objectifs" && <GoalsTab clientId={c.id} canEdit={false} />}
        {tab === "programme" && <ProgramTab clientId={c.id} canEdit={false} />}
        {tab === "photos" && <PhotosTab clientId={c.id} canEdit={false} />}
        {tab === "documents" && <DocumentsTab clientId={c.id} canEdit={false} />}
        {tab === "sante" && (
          <div className="space-y-6">
            <LinkButton href="/moi/bilan" variant="secondary">
              {tr("nav.moi.bilan")} →
            </LinkButton>
            <HealthView checks={checks} heightCm={c.height_cm} lastWeight={lastWeight} clientId={c.id} canEdit={false} />
            <section>
              <h2 className="mb-3 font-display text-lg font-bold">{tr("moi.tab.evaluations")}</h2>
              <AssessmentsTab clientId={c.id} canEdit={false} />
            </section>
          </div>
        )}
      </div>
    </>
  );
}

type Tr = (key: string, vars?: Record<string, string | number>) => string;

/** « Ma prochaine séance » avec son statut en mots simples */
function NextSessionCard({ session, coach, tr }: { session: Session | null; coach: string | null; tr: Tr }) {
  if (!session) {
    return (
      <Card className="mb-4 flex flex-wrap items-center gap-4 p-5">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-500">
          <CalendarClock className="size-6" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display font-bold">{tr("moi.next.none")}</p>
          <p className="text-sm text-muted">{tr("moi.next.noneText")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <LinkButton href="/moi/messages" variant="secondary">
            <MessageCircle className="size-4" /> {tr("moi.next.ask")}
          </LinkButton>
          <LinkButton href="/moi/cours">
            <UsersRound className="size-4" /> {tr("moi.next.classes")}
          </LinkButton>
        </div>
      </Card>
    );
  }
  const label = memberSessionLabel(session);
  const tone =
    session.status === "en_cours" ? "bg-orange-50 text-orange-700 ring-orange-100" : session.status === "acceptee" ? "bg-emerald-50 text-emerald-700 ring-emerald-100" : "bg-amber-50 text-amber-700 ring-amber-100";
  const explain = session.status === "en_cours" ? tr("moi.next.live") : session.status === "acceptee" ? tr("moi.next.confirmed") : tr("moi.next.waiting");
  return (
    <Card className="mb-4 overflow-hidden">
      <div className="flex flex-wrap items-center gap-4 bg-gradient-to-r from-brand-600 to-brand-500 p-5 text-white">
        <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-white/15 text-center font-display font-extrabold leading-none">
          <span>
            <span className="block text-xl">{fmtDate(session.starts_at, { day: "numeric" })}</span>
            <span className="block text-[11px] uppercase">{fmtDate(session.starts_at, { month: "short" })}</span>
          </span>
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-white/75">{tr("moi.next.title")}</p>
          <p className="font-display text-xl font-extrabold capitalize">
            {fmtDate(session.starts_at, { weekday: "long" })} · {fmtTime(session.starts_at)}
          </p>
          <p className="truncate text-sm text-white/85">
            {session.type} · {session.duration_min} min{coach ? ` · ${tr("moi.next.with", { name: coach })}` : ""}
          </p>
        </div>
      </div>
      <p className="flex flex-wrap items-center gap-2 px-5 py-3 text-sm">
        <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-bold ring-1", tone)}>{label}</span>
        <span className="text-muted">{explain}</span>
      </p>
    </Card>
  );
}
