import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarCheck2, CalendarClock, UsersRound } from "lucide-react";
import { listActiveCoaches, requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";
import { fmtDate, fmtTime } from "@/lib/utils";
import { Avatar, Badge, Card, PageHeader } from "@/components/ui";
import { CoachForm } from "@/components/admin/coach-form";
import { ROLE_LABEL, ROLE_TONE, monthRange } from "@/components/admin/data";
import { handoverCount, handoverSummary, loadHandover } from "../handover-data";
import { DeactivateForm } from "../deactivate-form";

export const metadata = { title: "Fiche coach" };

const STATUS: Record<string, string> = { planifiee: "à confirmer", acceptee: "acceptée", reportee: "report proposé" };

export default async function AdminCoachPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireAdmin();
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
  const coach = data as Profile | null;
  if (!coach) notFound();

  const month = monthRange(0);
  const isStaff = coach.role !== "client";
  const [{ count: done }, handover, team, { data: fData }] = await Promise.all([
    supabase.from("sessions").select("id", { count: "exact", head: true }).eq("coach_id", id).eq("status", "realisee").gte("starts_at", month.start).lt("starts_at", month.end),
    loadHandover(supabase, id),
    listActiveCoaches(supabase),
    supabase.from("clients").select("full_name").eq("user_id", id),
  ]);
  const isSelf = coach.id === me.id;
  const others = team.filter((p) => p.id !== id).map((p) => ({ id: p.id, label: `${p.full_name || p.email} · ${ROLE_LABEL[p.role] ?? p.role}` }));
  const pending = handoverCount(handover);
  const linkedFile = ((fData ?? []) as { full_name: string }[]).map((f) => f.full_name).join(", ") || null;

  return (
    <>
      <PageHeader
        back={
          <Link href="/admin/coachs" className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-brand-500">
            <ArrowLeft className="size-4 rtl:-scale-x-100" /> Coachs
          </Link>
        }
        title={
          <span className="flex flex-wrap items-center gap-3">
            <Avatar name={coach.full_name || coach.email} size={44} />
            {coach.full_name || coach.email}
            <Badge tone={ROLE_TONE[coach.role] ?? "gray"}>{ROLE_LABEL[coach.role] ?? coach.role}</Badge>
            {coach.active === false && <Badge tone="red">Désactivé</Badge>}
          </span>
        }
        subtitle={coach.email}
      />
      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <Card className="p-5">
          <h3 className="mb-4 font-display text-[15px] font-bold">Profil, rôle et spécialités</h3>
          <CoachForm coach={coach} isSelf={isSelf} handover={{ summary: handoverSummary(handover), coaches: others }} linkedFile={linkedFile} />
        </Card>
        <div className="space-y-5">
          <Card className="grid grid-cols-2 divide-x divide-line">
            <div className="p-5">
              <UsersRound className="size-4 text-brand-500" />
              <p className="mt-2 font-display text-2xl font-extrabold">{handover.clients.length}</p>
              <p className="text-xs text-muted">clients suivis</p>
            </div>
            <div className="p-5">
              <CalendarCheck2 className="size-4 text-[#e8782a]" />
              <p className="mt-2 font-display text-2xl font-extrabold">{done ?? 0}</p>
              <p className="text-xs text-muted">séances réalisées ({month.label})</p>
            </div>
          </Card>

          {pending > 0 && (
            <Card className="p-5">
              <h3 className="font-display text-[15px] font-bold">À transférer s&apos;il quitte l&apos;équipe</h3>
              <p className="mt-1 text-xs text-muted">{handoverSummary(handover)}</p>
              {handover.clients.length > 0 && (
                <ul className="mt-3 space-y-1 text-sm">
                  {handover.clients.map((c) => (
                    <li key={c.id} className="flex items-center gap-2">
                      <UsersRound className="size-3.5 shrink-0 text-brand-500" />
                      <Link href={`/clients/${c.id}`} className="truncate hover:text-brand-500">
                        {c.full_name}
                      </Link>
                      {c.status === "pause" && <Badge tone="amber">En pause</Badge>}
                    </li>
                  ))}
                </ul>
              )}
              {handover.sessions.length > 0 && (
                <ul className="mt-3 space-y-1 text-sm">
                  {handover.sessions.map((s) => (
                    <li key={s.id} className="flex items-center gap-2">
                      <CalendarClock className="size-3.5 shrink-0 text-[#e8782a]" />
                      <Link href={`/seances/${s.id}`} className="truncate hover:text-brand-500">
                        {fmtDate(s.starts_at, { weekday: "short", day: "numeric", month: "short" })} {fmtTime(s.starts_at)} · {handover.clientNames.get(s.client_id) ?? "Client"}
                      </Link>
                      <span className="text-xs text-muted">{STATUS[s.status] ?? s.status}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}

          {!isSelf && isStaff && (
            <Card className="p-5" id="desactiver">
              <h3 className="font-display text-[15px] font-bold">{coach.active === false ? "Réactiver le compte" : "Désactiver le compte"}</h3>
              <p className="mt-1 text-sm text-muted">
                {coach.active === false
                  ? "Le coach retrouvera son accès et ses droits."
                  : pending > 0
                    ? "Pour un coach qui quitte l'équipe : choisis d'abord à qui confier ses clients actifs et ses séances à venir. Son historique est conservé."
                    : "Pour un coach qui quitte l'équipe : son historique (séances, clients archivés) est conservé."}
              </p>
              <DeactivateForm id={coach.id} active={coach.active !== false} needsTransfer={pending > 0} coaches={others} />
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
