import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarRange, ChevronRight, Copy, Dumbbell, Layers, Pencil, Target, Trash2, UserPlus, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth";
import type { Client, ClientProgram, Program } from "@/lib/types";
import { dayKey, fmtDate } from "@/lib/utils";
import { Avatar, Badge, Card, CardHeader, Empty, Field, Input, LinkButton, PageHeader, Select } from "@/components/ui";
import { BackLink } from "@/components/back-link";
import { PrintButton } from "@/components/print-button";
import { ConfirmButton } from "@/components/confirm-button";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { ProgramDayCard } from "@/components/coaching/program-day-card";
import { programWeek } from "@/components/coaching/program-constants";
import { assignProgramAction, deleteProgramAction, duplicateProgramAction } from "@/actions/coaching";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("programs").select("name").eq("id", id).maybeSingle();
  return { title: (data?.name as string | undefined) ?? "Programme" };
}

const STATUS: Record<ClientProgram["status"], { label: string; tone: "green" | "amber" | "gray" }> = {
  actif: { label: "En cours", tone: "green" },
  pause: { label: "En pause", tone: "amber" },
  termine: { label: "Terminé", tone: "gray" },
};

export default async function ProgramPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: pData }, { data: cpData }, { data: cData }] = await Promise.all([
    supabase.from("programs").select("*").eq("id", id).maybeSingle(),
    supabase.from("client_programs").select("*").eq("program_id", id).order("start_date", { ascending: false }),
    supabase.from("clients").select("*").order("full_name"),
  ]);
  if (!pData) notFound();
  const p = pData as Program;
  const days = Array.isArray(p.days) ? p.days : [];
  const exCount = days.reduce((a, d) => a + (d.exercises?.length ?? 0), 0);
  const clients = (cData ?? []) as Client[];
  const byId = new Map(clients.map((c) => [c.id, c]));
  const links = ((cpData ?? []) as ClientProgram[]).filter((l) => byId.has(l.client_id));
  const current = links.filter((l) => l.status !== "termine");
  const past = links.filter((l) => l.status === "termine");
  const today = dayKey(new Date());

  const stats = [
    { icon: CalendarRange, label: "Durée", value: `${p.weeks} semaine${p.weeks > 1 ? "s" : ""}` },
    { icon: Dumbbell, label: "Séances / semaine", value: String(days.length) },
    { icon: Layers, label: "Exercices", value: String(exCount) },
    { icon: Users, label: "Clients actifs", value: String(new Set(current.map((l) => l.client_id)).size) },
  ];

  return (
    <>
      <PageHeader
        back={<BackLink href="/programmes" label="Programmes" />}
        title={p.name}
        subtitle={p.created_at ? `Créé le ${fmtDate(p.created_at)}` : undefined}
        actions={
          <div className="no-print flex flex-wrap items-center gap-2">
            <LinkButton href={`/programmes/${p.id}/modifier`} variant="secondary">
              <Pencil className="size-4" /> Modifier
            </LinkButton>
            <form action={duplicateProgramAction}>
              <input type="hidden" name="id" value={p.id} />
              <SubmitButton variant="secondary" pendingText="Copie…">
                <Copy className="size-4" /> Dupliquer
              </SubmitButton>
            </form>
            <PrintButton />
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          {/* En-tête du programme */}
          <Card className="relative overflow-hidden">
            <div className="relative bg-gradient-to-br from-brand-500 via-brand-600 to-brand-800 px-6 py-6 text-white">
              <Dumbbell className="absolute -right-6 -bottom-10 size-44 rotate-[-20deg] text-white/10" />
              <div className="relative flex flex-wrap items-center gap-2">
                {p.goal && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ring-white/20">
                    <Target className="size-3" /> {p.goal}
                  </span>
                )}
                {p.level && (
                  <span className="rounded-full bg-accent-500 px-2.5 py-0.5 text-xs font-semibold shadow-sm">{p.level}</span>
                )}
              </div>
              {p.description ? (
                <p className="relative mt-3 max-w-2xl text-sm leading-relaxed text-white/85">{p.description}</p>
              ) : (
                <p className="relative mt-3 text-sm text-white/60">Pas de description.</p>
              )}
            </div>
            <div className="grid grid-cols-2 divide-line sm:grid-cols-4 sm:divide-x">
              {stats.map((s) => (
                <div key={s.label} className="flex items-center gap-3 px-5 py-4">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-500">
                    <s.icon className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-display text-lg font-extrabold leading-tight text-ink">{s.value}</p>
                    <p className="truncate text-xs text-muted">{s.label}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Journées */}
          {days.length === 0 ? (
            <Card>
              <Empty
                icon={<CalendarRange className="size-6" />}
                title="Aucune journée"
                text="Ce programme ne contient pas encore de séance."
                action={<LinkButton href={`/programmes/${p.id}/modifier`}>Ajouter des journées</LinkButton>}
              />
            </Card>
          ) : (
            <div className="grid gap-4 xl:grid-cols-2 print:grid-cols-1">
              {days.map((d, i) => (
                <ProgramDayCard key={i} day={d} index={i} />
              ))}
            </div>
          )}
        </div>

        {/* Colonne latérale */}
        <aside className="no-print space-y-6">
          <Card>
            <CardHeader title="Assigner à un client" subtitle="Le membre le verra dans son espace" icon={<UserPlus className="size-4" />} />
            <ActionForm action={assignProgramAction} className="space-y-4 px-5 pb-5">
              <input type="hidden" name="program_id" value={p.id} />
              <input type="hidden" name="back" value={`/programmes/${p.id}`} />
              <Field label="Client">
                <Select name="client_id" required defaultValue="">
                  <option value="" disabled>
                    Choisir un client…
                  </option>
                  {clients
                    .filter((c) => c.status !== "termine")
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.full_name}
                      </option>
                    ))}
                </Select>
              </Field>
              <Field label="Date de début">
                <Input type="date" name="start_date" defaultValue={today} required />
              </Field>
              <label className="flex items-start gap-2.5 rounded-xl bg-canvas px-3 py-2.5 text-sm text-slate-600">
                <input type="checkbox" name="replace" defaultChecked className="mt-0.5 size-4 accent-brand-500" />
                <span>Terminer le programme en cours du client</span>
              </label>
              <SubmitButton variant="brand" className="w-full" pendingText="Assignation…">
                <UserPlus className="size-4" /> Assigner
              </SubmitButton>
            </ActionForm>
          </Card>

          <Card>
            <CardHeader title="Clients assignés" subtitle={`${current.length} en cours${past.length ? ` · ${past.length} terminé(s)` : ""}`} icon={<Users className="size-4" />} />
            {links.length === 0 ? (
              <p className="px-5 pb-6 text-sm text-muted">Personne ne suit encore ce programme.</p>
            ) : (
              <ul className="divide-y divide-line border-t border-line">
                {[...current, ...past].map((l) => {
                  const c = byId.get(l.client_id)!;
                  const w = programWeek(l.start_date, p.weeks, today);
                  return (
                    <li key={l.id}>
                      <Link href={`/clients/${c.id}?tab=programme`} className="group flex items-center gap-3 px-5 py-3 transition hover:bg-canvas/70">
                        <Avatar name={c.full_name} size={36} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-ink group-hover:text-brand-600">{c.full_name}</p>
                          <p className="truncate text-xs text-muted">
                            {l.status === "termine"
                              ? `Commencé le ${fmtDate(l.start_date)}`
                              : w.upcoming
                                ? `Commence le ${fmtDate(l.start_date, { day: "numeric", month: "short" })}`
                                : w.finished
                                  ? "Durée écoulée"
                                  : `Semaine ${w.week} / ${w.total}`}
                          </p>
                          {l.status !== "termine" && !w.upcoming && (
                            <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-slate-100">
                              <span className="block h-full rounded-full bg-accent-500" style={{ width: `${w.pct}%` }} />
                            </span>
                          )}
                        </div>
                        <Badge tone={STATUS[l.status].tone}>{STATUS[l.status].label}</Badge>
                        <ChevronRight className="size-4 shrink-0 text-slate-300 group-hover:text-brand-500" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card className="p-5">
            <p className="text-sm font-semibold text-ink">Zone sensible</p>
            <p className="mt-1 text-xs text-muted">La suppression retire aussi le programme de tous les clients qui le suivent.</p>
            <form action={deleteProgramAction} className="mt-3">
              <input type="hidden" name="id" value={p.id} />
              <ConfirmButton message={`Supprimer définitivement « ${p.name} » ? Cette action est irréversible.`} className="w-full">
                <Trash2 className="size-4" /> Supprimer le programme
              </ConfirmButton>
            </form>
          </Card>
        </aside>
      </div>
    </>
  );
}
