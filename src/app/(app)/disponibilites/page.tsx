import Link from "next/link";
import { AgendaTabs } from "@/components/planning/agenda-tabs";
import { CalendarOff, Clock, Plane, Plus, Trash2 } from "lucide-react";
import { isManager, requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { CoachAvailability, CoachTimeOff } from "@/lib/types";
import { WEEKDAYS, WEEKDAYS_SHORT, fmtMinutes, loadStaff, staffName, toMin } from "@/lib/planning";
import { cn, dayKey, fmtDate } from "@/lib/utils";
import { Avatar, Card, CardHeader, Empty, Field, Input, PageHeader } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { PlanForm } from "@/components/planning/plan-form";
import { SubmitButton } from "@/components/submit-button";
import { addAvailabilityAction, addTimeOffAction, deleteAvailabilityAction, deleteTimeOffAction } from "@/actions/planning";

export const metadata = { title: "Disponibilités" };

const AXIS_START = 6 * 60;
const AXIS_END = 23 * 60;
const pct = (m: number) => `${((Math.min(AXIS_END, Math.max(AXIS_START, m)) - AXIS_START) / (AXIS_END - AXIS_START)) * 100}%`;
const d = (date: string) => fmtDate(`${date}T12:00:00Z`, { weekday: "short", day: "numeric", month: "short" });

export default async function AvailabilityPage({ searchParams }: { searchParams: Promise<{ coach?: string }> }) {
  const { coach } = await searchParams;
  const me = await requireStaff();
  const manager = isManager(me.role);
  const supabase = await createClient();
  const staff = manager ? await loadStaff(supabase) : [];
  const coachId = manager && coach && staff.some((p) => p.id === coach) ? coach : me.id;
  const target = manager ? staff.find((p) => p.id === coachId) : me;
  const today = dayKey(new Date());

  const [{ data: aData }, { data: oData }, { data: allAv }] = await Promise.all([
    supabase.from("coach_availability").select("*").eq("coach_id", coachId).order("start_time"),
    supabase.from("coach_time_off").select("*").eq("coach_id", coachId).gte("ends_on", today).order("starts_on"),
    manager ? supabase.from("coach_availability").select("*") : Promise.resolve({ data: [] }),
  ]);
  const slots = (aData ?? []) as CoachAvailability[];
  const offs = (oData ?? []) as CoachTimeOff[];
  const weekly = slots.reduce((t, a) => t + toMin(a.end_time) - toMin(a.start_time), 0);
  const hoursOf = (id: string) => ((allAv ?? []) as CoachAvailability[]).filter((a) => a.coach_id === id).reduce((t, a) => t + toMin(a.end_time) - toMin(a.start_time), 0);
  const isMe = coachId === me.id;
  const hidden = manager ? <input type="hidden" name="coach_id" value={coachId} /> : null;

  return (
    <div className="mx-auto max-w-5xl">
      <AgendaTabs active="disponibilites" />
      <PageHeader
        title={isMe ? "Mes créneaux" : `Créneaux de ${staffName(target)}`}
        subtitle={`Disponibilités hebdomadaires et congés · ${fmtMinutes(weekly)} disponibles par semaine. Le planning n'affecte une séance que dans ces créneaux.`}
      />

      {manager && (
        <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
          {staff.map((p) => (
            <Link
              key={p.id}
              href={p.id === me.id ? "/disponibilites" : `/disponibilites?coach=${p.id}`}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-2xl border bg-white px-3 py-2 text-sm transition",
                p.id === coachId ? "border-brand-500 ring-2 ring-brand-100" : "border-line hover:border-slate-300",
              )}
            >
              <Avatar name={staffName(p)} size={28} />
              <span>
                <b className="block leading-tight">{staffName(p)}</b>
                <span className="text-xs text-muted">{fmtMinutes(hoursOf(p.id))} / sem.</span>
              </span>
            </Link>
          ))}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <Card className="overflow-hidden">
          <CardHeader title="Semaine type" subtitle="Heure d'Agadir · clique sur × pour retirer un créneau" icon={<Clock className="size-4" />} />
          <div className="px-5 pb-2">
            <div className="ms-14 flex justify-between text-[10px] font-semibold text-slate-400">
              {[6, 9, 12, 15, 18, 21].map((h) => (
                <span key={h}>{h}h</span>
              ))}
              <span>23h</span>
            </div>
          </div>
          <ul className="divide-y divide-line border-t border-line">
            {WEEKDAYS.map((label, i) => {
              const day = slots.filter((a) => a.weekday === i + 1).sort((x, y) => toMin(x.start_time) - toMin(y.start_time));
              return (
                <li key={label} className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <span className={cn("w-11 text-xs font-bold uppercase", day.length ? "text-ink" : "text-slate-400")}>{WEEKDAYS_SHORT[i]}</span>
                    <div className="relative h-7 flex-1 rounded-lg bg-slate-50 ring-1 ring-inset ring-line">
                      {day.map((a) => (
                        <span
                          key={a.id}
                          className="absolute inset-y-0.5 rounded-md bg-brand-500/85"
                          style={{ left: pct(toMin(a.start_time)), width: `calc(${pct(toMin(a.end_time))} - ${pct(toMin(a.start_time))})` }}
                          title={`${a.start_time.slice(0, 5)}–${a.end_time.slice(0, 5)}`}
                        />
                      ))}
                      {!day.length && <span className="absolute inset-0 grid place-items-center text-[11px] text-slate-400">Repos</span>}
                    </div>
                  </div>
                  {day.length > 0 && (
                    <div className="ms-14 mt-1.5 flex flex-wrap gap-1.5">
                      {day.map((a) => (
                        <form key={a.id} action={deleteAvailabilityAction} className="inline-flex items-center gap-1 rounded-full bg-brand-50 py-0.5 ps-2.5 pe-1 text-xs font-semibold text-brand-700 ring-1 ring-brand-100">
                          <input type="hidden" name="id" value={a.id} />
                          {a.start_time.slice(0, 5)}–{a.end_time.slice(0, 5)}
                          <button className="grid size-5 place-items-center rounded-full text-brand-400 hover:bg-white hover:text-red-600" aria-label="Retirer ce créneau">
                            ×
                          </button>
                        </form>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>

        <div className="space-y-5">
          <Card className="p-5">
            <p className="mb-3 flex items-center gap-2 font-display font-bold">
              <Plus className="size-4 text-accent-500" /> Ajouter un créneau
            </p>
            <ActionForm action={addAvailabilityAction} className="space-y-3">
              {hidden}
              <div>
                <span className="mb-1.5 block text-xs font-semibold text-slate-600">Jours</span>
                <div className="grid grid-cols-7 gap-1">
                  {WEEKDAYS_SHORT.map((w, i) => (
                    <label key={w} className="cursor-pointer">
                      <input type="checkbox" name="weekday" value={i + 1} defaultChecked={i < 5} className="peer sr-only" />
                      <span className="grid h-9 place-items-center rounded-lg border border-line text-[11px] font-bold text-slate-500 transition peer-checked:border-brand-500 peer-checked:bg-brand-500 peer-checked:text-white">
                        {w.slice(0, 2)}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="De">
                  <Input name="start_time" type="time" required defaultValue="09:00" step={900} />
                </Field>
                <Field label="À">
                  <Input name="end_time" type="time" required defaultValue="12:00" step={900} />
                </Field>
              </div>
              <SubmitButton variant="brand" className="w-full">
                Ajouter
              </SubmitButton>
              <p className="text-xs text-muted">Plusieurs créneaux par jour possibles (ex. 7h–12h puis 17h–20h).</p>
            </ActionForm>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader title="Congés et absences" subtitle={`À venir pour ${isMe ? "toi" : staffName(target)}`} icon={<Plane className="size-4" />} />
            {offs.length === 0 ? (
              <Empty icon={<CalendarOff className="size-6" />} title="Aucun congé prévu" />
            ) : (
              <ul className="divide-y divide-line border-y border-line">
                {offs.map((o) => (
                  <li key={o.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                    <span className="min-w-0 flex-1">
                      <b className="block">{o.starts_on === o.ends_on ? d(o.starts_on) : `${d(o.starts_on)} → ${d(o.ends_on)}`}</b>
                      {o.reason && <span className="block truncate text-xs text-muted">{o.reason}</span>}
                    </span>
                    <form action={deleteTimeOffAction}>
                      <input type="hidden" name="id" value={o.id} />
                      <button className="grid size-8 place-items-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600" aria-label="Supprimer ce congé">
                        <Trash2 className="size-4" />
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
            <PlanForm action={addTimeOffAction} className="space-y-3 p-5">
              {hidden}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Du *">
                  <Input name="starts_on" type="date" required min={today} />
                </Field>
                <Field label="Au (inclus)">
                  <Input name="ends_on" type="date" min={today} />
                </Field>
              </div>
              <Field label="Motif">
                <Input name="reason" placeholder="Congé, formation, maladie…" />
              </Field>
              <SubmitButton variant="secondary" className="w-full">
                Ajouter le congé
              </SubmitButton>
            </PlanForm>
          </Card>
          <p className="px-1 text-xs text-muted">Modifier les créneaux ne déplace pas les séances déjà prévues : un congé posé sur une séance existante est enregistré et signalé aux managers (admin, head coach) pour réaffectation. Deux congés ne peuvent pas se chevaucher.</p>
        </div>
      </div>
    </div>
  );
}
