import Link from "next/link";
import { CalendarClock, CalendarRange, CheckCircle2, Dumbbell, ExternalLink, History, Pause, Play, Square, Target, Trash2, UserPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { ClientProgram, Program } from "@/lib/types";
import { cn, dayKey, fmtDate } from "@/lib/utils";
import { Badge, Card, CardHeader, Empty, Field, Input, LinkButton, Select } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { ProgramDayCard } from "@/components/coaching/program-day-card";
import { levelTone, programWeek } from "@/components/coaching/program-constants";
import { assignProgramAction, removeClientProgramAction, setClientProgramStatusAction } from "@/actions/coaching";

const smallBtn =
  "inline-flex h-9 items-center gap-1.5 rounded-xl border border-line bg-white px-3 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-canvas hover:text-ink";

export async function ProgramTab({ clientId, canEdit }: { clientId: string; canEdit: boolean }) {
  const supabase = await createClient();
  const { data: cpData } = await supabase.from("client_programs").select("*").eq("client_id", clientId).order("start_date", { ascending: false });
  const links = (cpData ?? []) as ClientProgram[];
  const ids = [...new Set(links.map((l) => l.program_id))];

  const [{ data: pData }, { data: libData }] = await Promise.all([
    ids.length ? supabase.from("programs").select("*").in("id", ids) : Promise.resolve({ data: [] }),
    canEdit ? supabase.from("programs").select("*").order("name") : Promise.resolve({ data: [] }),
  ]);
  const programs = new Map(((pData ?? []) as Program[]).map((p) => [p.id, p]));
  const library = (libData ?? []) as Program[];
  const today = dayKey(new Date());

  const current = links.filter((l) => l.status !== "termine" && programs.has(l.program_id));
  const past = links.filter((l) => l.status === "termine" && programs.has(l.program_id));

  const assignForm = canEdit ? (
    <Card className="no-print">
      <CardHeader
        title={current.length ? "Assigner un autre programme" : "Assigner un programme"}
        subtitle="Choisis dans la bibliothèque de programmes"
        icon={<UserPlus className="size-4" />}
        action={
          <Link href="/programmes/nouveau" className="text-xs font-semibold text-brand-600 hover:underline">
            Créer un programme
          </Link>
        }
      />
      {library.length === 0 ? (
        <p className="px-5 pb-5 text-sm text-muted">
          La bibliothèque est vide.{" "}
          <Link href="/programmes/nouveau" className="font-semibold text-brand-600 hover:underline">
            Crée un premier programme
          </Link>
          .
        </p>
      ) : (
        <ActionForm action={assignProgramAction} className="grid gap-3 px-5 pb-5 sm:grid-cols-[minmax(0,1fr)_170px_auto] sm:items-end">
          <input type="hidden" name="client_id" value={clientId} />
          <input type="hidden" name="back" value={`/clients/${clientId}?tab=programme`} />
          <Field label="Programme">
            <Select name="program_id" required defaultValue="">
              <option value="" disabled>
                Choisir…
              </option>
              {library.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.weeks} sem.
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Début">
            <Input type="date" name="start_date" defaultValue={today} required />
          </Field>
          <SubmitButton variant="brand" pendingText="…">
            <UserPlus className="size-4" /> Assigner
          </SubmitButton>
          {current.length > 0 && (
            <label className="flex items-center gap-2 text-sm text-slate-600 sm:col-span-3">
              <input type="checkbox" name="replace" defaultChecked className="size-4 accent-brand-500" />
              Remplacer le programme en cours (il sera marqué comme terminé)
            </label>
          )}
        </ActionForm>
      )}
    </Card>
  ) : null;

  if (!current.length) {
    return (
      <div className="space-y-6">
        <Card>
          <Empty
            icon={<Dumbbell className="size-6" />}
            title={canEdit ? "Aucun programme en cours" : "Pas encore de programme"}
            text={
              canEdit
                ? "Assigne un programme d'entraînement pour que le client retrouve ses séances dans son espace."
                : "Ton coach va bientôt te préparer un programme sur mesure. Tu le retrouveras ici."
            }
            action={
              canEdit && library.length === 0 ? (
                <LinkButton href="/programmes/nouveau">Créer un programme</LinkButton>
              ) : !canEdit ? (
                <LinkButton href="/moi/messages" variant="secondary">
                  Écrire à mon coach
                </LinkButton>
              ) : undefined
            }
          />
        </Card>
        {assignForm}
        <PastList past={past} programs={programs} canEdit={canEdit} clientId={clientId} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {current.map((l) => {
        const p = programs.get(l.program_id)!;
        const days = Array.isArray(p.days) ? p.days : [];
        const w = programWeek(l.start_date, p.weeks, today);
        const end = new Date(Date.parse(l.start_date) + p.weeks * 7 * 86400000);
        return (
          <section key={l.id} className="space-y-4">
            <Card className="relative overflow-hidden">
              <div className="relative bg-gradient-to-br from-brand-500 via-brand-600 to-brand-800 px-5 py-5 text-white sm:px-6">
                <Dumbbell className="absolute -right-6 -bottom-10 size-40 rotate-[-20deg] text-white/10" />
                <div className="relative flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wider text-white/70">{canEdit ? "Programme en cours" : "Ton programme"}</p>
                    <h3 className="mt-1 font-display text-xl font-extrabold leading-tight sm:text-2xl">{p.name}</h3>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                      {p.goal && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-0.5 font-semibold ring-1 ring-inset ring-white/20">
                          <Target className="size-3" /> {p.goal}
                        </span>
                      )}
                      {p.level && <span className="rounded-full bg-accent-500 px-2.5 py-0.5 font-semibold">{p.level}</span>}
                      {l.status === "pause" && <span className="rounded-full bg-amber-400 px-2.5 py-0.5 font-semibold text-amber-950">En pause</span>}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-display text-3xl font-extrabold leading-none">
                      {w.upcoming ? "J-" + w.daysLeft : w.finished ? <CheckCircle2 className="ml-auto size-8" /> : w.week}
                      {!w.upcoming && !w.finished && <span className="text-base font-semibold text-white/70"> / {w.total}</span>}
                    </p>
                    <p className="mt-1 text-xs text-white/70">{w.upcoming ? "avant le début" : w.finished ? "Programme terminé" : "semaine en cours"}</p>
                  </div>
                </div>
                <div className="relative mt-5">
                  <div className="flex justify-between text-xs text-white/75">
                    <span>
                      {w.upcoming ? "Commence le" : "Début"} {fmtDate(l.start_date, { day: "numeric", month: "short" })}
                    </span>
                    <span>Fin prévue {fmtDate(end, { day: "numeric", month: "short" })}</span>
                  </div>
                  <div className="mt-1.5 flex gap-1">
                    {Array.from({ length: p.weeks }, (_, i) => (
                      <span
                        key={i}
                        className={cn(
                          "h-2 flex-1 rounded-full",
                          w.finished || (!w.upcoming && i < w.week - 1) ? "bg-white" : !w.upcoming && i === w.week - 1 ? "bg-accent-400" : "bg-white/20",
                        )}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
                <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-slate-600">
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarRange className="size-4 text-brand-500" /> {days.length} séance{days.length > 1 ? "s" : ""} / semaine
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarClock className="size-4 text-brand-500" /> {p.weeks} semaines
                  </span>
                  <Badge tone={levelTone(p.level)}>{p.level ?? "—"}</Badge>
                </div>
                {canEdit && (
                  <div className="no-print flex flex-wrap items-center gap-2">
                    <Link href={`/programmes/${p.id}`} className={smallBtn}>
                      <ExternalLink className="size-3.5" /> Ouvrir
                    </Link>
                    <form action={setClientProgramStatusAction}>
                      <input type="hidden" name="id" value={l.id} />
                      <input type="hidden" name="client_id" value={clientId} />
                      <input type="hidden" name="status" value={l.status === "pause" ? "actif" : "pause"} />
                      <button className={smallBtn}>
                        {l.status === "pause" ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}
                        {l.status === "pause" ? "Reprendre" : "Pause"}
                      </button>
                    </form>
                    <form action={setClientProgramStatusAction}>
                      <input type="hidden" name="id" value={l.id} />
                      <input type="hidden" name="client_id" value={clientId} />
                      <input type="hidden" name="status" value="termine" />
                      <button className={cn(smallBtn, "hover:border-red-200 hover:bg-red-50 hover:text-red-600")}>
                        <Square className="size-3.5" /> Arrêter
                      </button>
                    </form>
                  </div>
                )}
              </div>
              {p.description && <p className="border-t border-line px-5 py-3.5 text-sm text-muted">{p.description}</p>}
            </Card>

            {!canEdit && !w.upcoming && !w.finished && (
              <p className="flex items-center gap-2 rounded-xl bg-accent-50 px-4 py-3 text-sm text-accent-700">
                <Dumbbell className="size-4 shrink-0" />
                Semaine {w.week} : enchaîne les {days.length} séance{days.length > 1 ? "s" : ""} ci-dessous et note tes charges pour progresser.
              </p>
            )}

            <div className="grid gap-4 xl:grid-cols-2">
              {days.map((d, i) => (
                <ProgramDayCard key={i} day={d} index={i} />
              ))}
            </div>
          </section>
        );
      })}

      {assignForm}
      <PastList past={past} programs={programs} canEdit={canEdit} clientId={clientId} />
    </div>
  );
}

function PastList({ past, programs, canEdit, clientId }: { past: ClientProgram[]; programs: Map<string, Program>; canEdit?: boolean; clientId?: string }) {
  if (!past.length) return null;
  return (
    <Card>
      <CardHeader title="Programmes précédents" icon={<History className="size-4" />} />
      <ul className="divide-y divide-line border-t border-line">
        {past.map((l) => {
          const p = programs.get(l.program_id)!;
          return (
            <li key={l.id} className="flex items-center gap-3 px-5 py-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-500">
                <CheckCircle2 className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">{p.name}</p>
                <p className="text-xs text-muted">
                  Commencé le {fmtDate(l.start_date)} · {p.weeks} semaines
                </p>
              </div>
              {canEdit && clientId && (
                <div className="no-print flex items-center gap-1">
                  <form action={setClientProgramStatusAction}>
                    <input type="hidden" name="id" value={l.id} />
                    <input type="hidden" name="client_id" value={clientId} />
                    <input type="hidden" name="status" value="actif" />
                    <button className={smallBtn} title="Réactiver">
                      <Play className="size-3.5" /> <span className="hidden sm:inline">Réactiver</span>
                    </button>
                  </form>
                  <form action={removeClientProgramAction}>
                    <input type="hidden" name="id" value={l.id} />
                    <input type="hidden" name="client_id" value={clientId} />
                    <button className="grid size-9 place-items-center rounded-xl text-slate-400 transition hover:bg-red-50 hover:text-red-600" aria-label="Retirer de l'historique" title="Retirer de l'historique">
                      <Trash2 className="size-4" />
                    </button>
                  </form>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
