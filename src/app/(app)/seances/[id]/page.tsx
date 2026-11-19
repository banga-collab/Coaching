import Link from "next/link";
import { notFound } from "next/navigation";
import { Clock, Dumbbell, Pencil, Timer, Trash2, UserX } from "lucide-react";
import { isManager, requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Client, Session, SessionExercise } from "@/lib/types";
import { BUSY_STATUSES, canFinish, canMarkAbsent, fmtMinutes, freeCoachesIn, isForgotten, loadPlanningData, loadStaff, realDuration, staffName } from "@/lib/planning";
import { fmtDh } from "@/lib/session-extras";
import { SESSION_LABEL, fmtDate, fmtTime, num } from "@/lib/utils";
import { Avatar, Badge, Card, CardHeader, Empty, LinkButton, PageHeader } from "@/components/ui";
import { BackLink } from "@/components/back-link";
import { ConfirmButton } from "@/components/confirm-button";
import { SESSION_BADGE } from "@/components/planning/status";
import { ForgottenPanel, ManagerPanel, RespondPanel, RunButtons, StatusTimeline } from "@/components/planning/session-panels";
import { deletePlanningSessionAction, markSessionAction } from "@/actions/planning";

export const metadata = { title: "Séance" };

export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireStaff();
  const manager = isManager(me.role);
  const supabase = await createClient();
  const [{ data: sData }, { data: exData }, staff] = await Promise.all([
    supabase.from("sessions").select("*").eq("id", id).maybeSingle(),
    supabase.from("session_exercises").select("*").eq("session_id", id).order("position"),
    loadStaff(supabase),
  ]);
  if (!sData) notFound();
  const s = sData as Session & { created_at?: string | null };
  // Un coach ne voit que ses séances ; head coach et admin voient tout
  if (!manager && s.coach_id !== me.id) notFound();
  const ex = (exData ?? []) as SessionExercise[];
  const { data: cData } = await supabase.from("clients").select("id, full_name, goal").eq("id", s.client_id).maybeSingle();
  const c = (cData as Pick<Client, "id" | "full_name" | "goal"> | null) ?? { id: s.client_id, full_name: "Client", goal: null };
  const volume = ex.reduce((t, e) => t + (e.sets ?? 0) * (Number.parseInt(e.reps ?? "") || 0) * Number(e.load_kg ?? 0), 0);

  const names = new Map(staff.map((p) => [p.id, staffName(p)]));
  for (const pid of [s.coach_id, s.assigned_by].filter((x): x is string => !!x && !names.has(x))) {
    const { data } = await supabase.from("profiles").select("id, full_name, email").eq("id", pid).maybeSingle();
    if (data) names.set(pid, staffName(data as { full_name: string; email: string }));
  }
  const isMine = s.coach_id === me.id;
  const canRun = isMine || manager;
  const nowMs = Date.now();
  const forgotten = isForgotten(s, nowMs);
  const showManager =
    manager &&
    ["planifiee", "refusee", "reportee", "acceptee"].includes(s.status) &&
    (new Date(s.starts_at).getTime() + s.duration_min * 60000 > nowMs || (s.status === "reportee" && !!s.proposed_at && new Date(s.proposed_at).getTime() > nowMs));
  const price = s.price_mad !== null && s.price_mad !== undefined ? Number(s.price_mad) : null;
  // « Marquer comme » : Absent dès 30 min avant, Annulée tant que la séance n'est pas close
  const markable = canRun && !forgotten && (canMarkAbsent(s, nowMs) || [...BUSY_STATUSES, "refusee"].includes(s.status));
  let free = new Set<string>();
  if (showManager) {
    const end = new Date(new Date(s.starts_at).getTime() + s.duration_min * 60000).toISOString();
    const data = await loadPlanningData(supabase, s.starts_at, end);
    free = new Set(freeCoachesIn(data, staff, s.starts_at, s.duration_min, s.id).map((p) => p.id));
  }
  const dur = realDuration(s);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        back={<BackLink href="/seances" label="Séances" />}
        title={price !== null ? `${s.type} · ${fmtDh(price)}` : s.type}
        subtitle={`${fmtDate(s.starts_at, { weekday: "long", day: "numeric", month: "long" })} · ${fmtTime(s.starts_at)} · ${s.duration_min} min · ${names.get(s.coach_id) ?? "Coach"}`}
        actions={
          canRun ? (
            <LinkButton href={`/seances/${id}/modifier`} variant="secondary">
              <Pencil className="size-4" /> Modifier
            </LinkButton>
          ) : undefined
        }
      />

      <div className="grid gap-5 md:grid-cols-[1fr_300px]">
        <div className="space-y-5">
          {canRun && forgotten && <ForgottenPanel s={s} />}
          {canRun && !forgotten && (s.status === "acceptee" || canFinish(s)) && <RunButtons s={s} />}
          {dur !== null && s.status !== "en_cours" && (
            <Card className="flex items-center gap-4 p-4">
              <span className="grid size-11 place-items-center rounded-xl bg-emerald-50 text-emerald-600">
                <Timer className="size-5" />
              </span>
              <span className="text-sm">
                <b className="block font-display text-lg">{fmtMinutes(dur)}</b>
                <span className="text-muted">
                  durée réelle · de {fmtTime(s.started_at!)} à {s.ended_at ? fmtTime(s.ended_at) : "…"} (prévu {s.duration_min} min)
                </span>
              </span>
            </Card>
          )}
          <Card className="overflow-hidden">
            <CardHeader title="Exercices" subtitle={volume ? `Volume total : ${num(volume)} kg` : undefined} icon={<Dumbbell className="size-4" />} />
            {ex.length === 0 ? (
              <Empty icon={<Dumbbell className="size-6" />} title="Aucun exercice" text="Ajoute les exercices en modifiant la séance." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-y border-line bg-slate-50/60 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      <th className="px-5 py-2.5">Exercice</th>
                      <th className="px-3 py-2.5 text-center">Séries</th>
                      <th className="px-3 py-2.5 text-center">Reps</th>
                      <th className="px-3 py-2.5 text-right">Charge</th>
                      <th className="px-5 py-2.5 text-right">RPE</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {ex.map((e) => (
                      <tr key={e.id}>
                        <td className="px-5 py-3 font-medium">{e.name}</td>
                        <td className="px-3 py-3 text-center tabular-nums">{e.sets ?? "–"}</td>
                        <td className="px-3 py-3 text-center tabular-nums">{e.reps ?? "–"}</td>
                        <td className="px-3 py-3 text-right tabular-nums">{e.load_kg !== null ? num(e.load_kg, "kg") : "–"}</td>
                        <td className="px-5 py-3 text-right tabular-nums">{e.rpe ?? "–"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {s.notes && <p className="m-5 whitespace-pre-line rounded-xl bg-canvas p-4 text-sm text-slate-700">{s.notes}</p>}
          </Card>
          <StatusTimeline s={s} names={names} />
        </div>

        <div className="space-y-5">
          <Card className="p-5">
            <Link href={`/clients/${c.id}?tab=seances`} className="flex items-center gap-3">
              <Avatar name={c.full_name} size={44} />
              <span>
                <span className="block font-semibold hover:text-brand-600">{c.full_name}</span>
                <span className="block text-xs text-muted">{c.goal ?? "—"}</span>
              </span>
            </Link>
            <div className="mt-4 flex items-center justify-between border-t border-line pt-4 text-sm">
              <span className="text-muted">Statut</span>
              <Badge tone={SESSION_BADGE[s.status]}>{SESSION_LABEL[s.status]}</Badge>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-muted">Coach</span>
              <b>{names.get(s.coach_id) ?? "—"}</b>
            </div>
            {s.assigned_by && s.assigned_by !== s.coach_id && (
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-muted">Affectée par</span>
                <span>{names.get(s.assigned_by) ?? "—"}</span>
              </div>
            )}
            {s.status === "reportee" && s.proposed_at && (
              <div className="mt-2 rounded-xl bg-violet-50 px-3 py-2 text-xs text-violet-900">
                Nouvel horaire proposé : <b>{fmtDate(s.proposed_at, { weekday: "short", day: "numeric", month: "short" })} à {fmtTime(s.proposed_at)}</b>
              </div>
            )}
            {s.status === "refusee" && s.response_note && <div className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-800">Motif : {s.response_note}</div>}
            {price !== null && (
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-muted">Prix indicatif</span>
                <b>{fmtDh(price)}</b>
              </div>
            )}
            {s.rpe && (
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-muted">RPE global</span>
                <b>{s.rpe}/10</b>
              </div>
            )}
          </Card>

          {isMine && s.status === "planifiee" && !forgotten && <RespondPanel s={s} />}
          {showManager && <ManagerPanel s={s} staff={staff} free={free} />}

          {markable && (
            <Card className="space-y-2 p-5">
              <p className="mb-1 text-sm font-semibold">Marquer comme</p>
              {(
                [
                  ["absent", "Client absent", UserX],
                  ["annulee", "Annulée", Clock],
                ] as const
              )
                .filter(([st]) => (st === "absent" ? canMarkAbsent(s, nowMs) : true))
                .map(([st, label, I]) => (
                <form key={st} action={markSessionAction}>
                  <input type="hidden" name="id" value={s.id} />
                  <input type="hidden" name="status" value={st} />
                  <button className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-line bg-white text-sm font-semibold transition hover:bg-canvas">
                    <I className="size-4" /> {label}
                  </button>
                </form>
              ))}
            </Card>
          )}
          {manager && (
            <form action={deletePlanningSessionAction}>
              <input type="hidden" name="id" value={s.id} />
              <ConfirmButton message="Supprimer cette séance ?" className="w-full">
                <Trash2 className="size-4" /> Supprimer
              </ConfirmButton>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
