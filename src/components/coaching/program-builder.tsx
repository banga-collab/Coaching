"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, CalendarRange, Copy, Dumbbell, Info, Plus, Save, Trash2, X } from "lucide-react";
import type { Program, ProgramDay } from "@/lib/types";
import { saveProgramAction } from "@/actions/coaching";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { EXERCISES } from "@/components/exercise-rows";
import { Card, CardHeader, Field, Input, LinkButton, Select, Textarea } from "@/components/ui";
import { cn } from "@/lib/utils";
import { PROGRAM_GOALS, PROGRAM_LEVELS } from "./program-constants";

type Ex = { key: string; name: string; sets: string; reps: string; load: string; rest: string; notes: string };
type Day = { key: string; title: string; focus: string; exercises: Ex[] };

let seq = 0;
const k = () => `k${Date.now().toString(36)}${(seq++).toString(36)}`;
const emptyEx = (): Ex => ({ key: k(), name: "", sets: "", reps: "", load: "", rest: "", notes: "" });
const emptyDay = (i: number): Day => ({ key: k(), title: `Jour ${String.fromCharCode(65 + (i % 26))}`, focus: "", exercises: [emptyEx()] });

function fromProgram(days: ProgramDay[] | undefined): Day[] {
  if (!days?.length) return [emptyDay(0)];
  return days.map((d) => ({
    key: k(),
    title: d.title ?? "",
    focus: d.focus ?? "",
    exercises: (d.exercises?.length ? d.exercises : [{ name: "" }]).map((e) => ({
      key: k(),
      name: e.name ?? "",
      sets: e.sets === null || e.sets === undefined ? "" : String(e.sets),
      reps: e.reps ?? "",
      load: e.load ?? "",
      rest: e.rest ?? "",
      notes: e.notes ?? "",
    })),
  }));
}

function move<T>(arr: T[], i: number, dir: -1 | 1) {
  const j = i + dir;
  if (j < 0 || j >= arr.length) return arr;
  const next = [...arr];
  [next[i], next[j]] = [next[j]!, next[i]!];
  return next;
}

const cell =
  "h-10 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink placeholder:text-slate-400 focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-50";
const iconBtn = "grid size-8 place-items-center rounded-lg text-slate-400 transition hover:bg-canvas hover:text-ink disabled:opacity-30 disabled:pointer-events-none";

export function ProgramBuilder({ program }: { program?: Program }) {
  const [days, setDays] = useState<Day[]>(() => fromProgram(program?.days));
  const [info, setInfo] = useState({
    name: program?.name ?? "",
    goal: program?.goal ?? "",
    level: program?.level ?? "Intermédiaire",
    weeks: String(program?.weeks ?? 8),
    description: program?.description ?? "",
  });
  const bind = (key: keyof typeof info) => ({
    name: key,
    value: info[key],
    onChange: (e: { target: { value: string } }) => setInfo((s) => ({ ...s, [key]: e.target.value })),
  });

  const updateDay = (key: string, patch: Partial<Day>) => setDays((ds) => ds.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  const updateEx = (dayKey: string, exKey: string, patch: Partial<Ex>) =>
    setDays((ds) => ds.map((d) => (d.key === dayKey ? { ...d, exercises: d.exercises.map((e) => (e.key === exKey ? { ...e, ...patch } : e)) } : d)));
  const setExs = (dayKey: string, fn: (exs: Ex[]) => Ex[]) => setDays((ds) => ds.map((d) => (d.key === dayKey ? { ...d, exercises: fn(d.exercises) } : d)));

  const payload = JSON.stringify(
    days.map((d) => ({
      title: d.title,
      focus: d.focus,
      exercises: d.exercises.map((e) => ({ name: e.name, sets: e.sets, reps: e.reps, load: e.load, rest: e.rest, notes: e.notes })),
    })),
  );
  const exCount = days.reduce((a, d) => a + d.exercises.filter((e) => e.name.trim()).length, 0);

  return (
    <ActionForm action={saveProgramAction} className="space-y-6 pb-24">
      {program && <input type="hidden" name="id" value={program.id} />}
      <input type="hidden" name="days" value={payload} />
      <datalist id="program-exercises">
        {EXERCISES.map((e) => (
          <option key={e} value={e} />
        ))}
      </datalist>
      <datalist id="program-goals">
        {PROGRAM_GOALS.map((g) => (
          <option key={g} value={g} />
        ))}
      </datalist>

      {/* Infos */}
      <Card>
        <CardHeader title="Informations" subtitle="Ce que verront le coach et le membre" icon={<Info className="size-4" />} />
        <div className="grid gap-4 px-5 pb-5 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Nom du programme" className="sm:col-span-2">
            <Input {...bind("name")} required placeholder="Ex. Perte de poids – 8 semaines" />
          </Field>
          <Field label="Objectif">
            <Input {...bind("goal")} list="program-goals" placeholder="Perte de poids" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Niveau">
              <Select {...bind("level")}>
                {PROGRAM_LEVELS.map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </Select>
            </Field>
            <Field label="Semaines">
              <Input {...bind("weeks")} type="number" min={1} max={52} />
            </Field>
          </div>
          <Field label="Description" className="sm:col-span-2 lg:col-span-4">
            <Textarea {...bind("description")} rows={2} placeholder="Fréquence, intensité, consignes générales…" className="min-h-[72px]" />
          </Field>
        </div>
      </Card>

      {/* Jours */}
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold text-ink">Journées d&apos;entraînement</h2>
          <p className="text-sm text-muted">
            {days.length} jour{days.length > 1 ? "s" : ""} · {exCount} exercice{exCount > 1 ? "s" : ""}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {days.map((d, di) => (
          <Card key={d.key} className="overflow-hidden animate-fade-up">
            <div className="flex flex-col gap-3 border-b border-line bg-gradient-to-r from-brand-50/70 to-white px-4 py-3 sm:flex-row sm:items-center">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-500 font-display text-sm font-extrabold text-white">{di + 1}</span>
              <div className="grid flex-1 gap-2 sm:grid-cols-2">
                <input
                  value={d.title}
                  onChange={(e) => updateDay(d.key, { title: e.target.value })}
                  placeholder="Titre (ex. Jour A – Bas du corps)"
                  aria-label="Titre du jour"
                  className={cn(cell, "font-semibold")}
                />
                <input value={d.focus} onChange={(e) => updateDay(d.key, { focus: e.target.value })} placeholder="Focus (ex. Jambes, gainage)" aria-label="Focus" className={cell} />
              </div>
              <div className="flex items-center gap-0.5 self-end sm:self-auto">
                <button type="button" className={iconBtn} disabled={di === 0} onClick={() => setDays((ds) => move(ds, di, -1))} aria-label="Monter le jour" title="Monter">
                  <ArrowUp className="size-4" />
                </button>
                <button type="button" className={iconBtn} disabled={di === days.length - 1} onClick={() => setDays((ds) => move(ds, di, 1))} aria-label="Descendre le jour" title="Descendre">
                  <ArrowDown className="size-4" />
                </button>
                <button
                  type="button"
                  className={iconBtn}
                  onClick={() =>
                    setDays((ds) => {
                      const copy: Day = { ...d, key: k(), title: `${d.title} (copie)`, exercises: d.exercises.map((e) => ({ ...e, key: k() })) };
                      return [...ds.slice(0, di + 1), copy, ...ds.slice(di + 1)];
                    })
                  }
                  aria-label="Dupliquer le jour"
                  title="Dupliquer"
                >
                  <Copy className="size-4" />
                </button>
                <button
                  type="button"
                  className={cn(iconBtn, "hover:bg-red-50 hover:text-red-600")}
                  disabled={days.length === 1}
                  onClick={() => setDays((ds) => ds.filter((x) => x.key !== d.key))}
                  aria-label="Supprimer le jour"
                  title="Supprimer"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>

            <div className="p-4">
              <div className="hidden grid-cols-[2.2fr_.7fr_.9fr_.9fr_.9fr_1.6fr_104px] gap-2 px-1 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 lg:grid">
                <span>Exercice</span>
                <span>Séries</span>
                <span>Reps</span>
                <span>Charge</span>
                <span>Repos</span>
                <span>Notes</span>
                <span />
              </div>
              <div className="space-y-2">
                {d.exercises.map((e, ei) => (
                  <div key={e.key} className="grid grid-cols-6 gap-2 rounded-xl bg-canvas/70 p-2 lg:grid-cols-[2.2fr_.7fr_.9fr_.9fr_.9fr_1.6fr_104px] lg:bg-transparent lg:p-0">
                    <input
                      value={e.name}
                      onChange={(ev) => updateEx(d.key, e.key, { name: ev.target.value })}
                      list="program-exercises"
                      placeholder={`Exercice ${ei + 1}`}
                      aria-label="Exercice"
                      className={cn(cell, "col-span-6 font-medium lg:col-span-1")}
                    />
                    <input value={e.sets} onChange={(ev) => updateEx(d.key, e.key, { sets: ev.target.value })} inputMode="numeric" placeholder="Séries" aria-label="Séries" className={cn(cell, "col-span-2 lg:col-span-1")} />
                    <input value={e.reps} onChange={(ev) => updateEx(d.key, e.key, { reps: ev.target.value })} placeholder="Reps" aria-label="Répétitions" className={cn(cell, "col-span-2 lg:col-span-1")} />
                    <input value={e.load} onChange={(ev) => updateEx(d.key, e.key, { load: ev.target.value })} placeholder="kg / %" aria-label="Charge" className={cn(cell, "col-span-2 lg:col-span-1")} />
                    <input value={e.rest} onChange={(ev) => updateEx(d.key, e.key, { rest: ev.target.value })} placeholder="Repos" aria-label="Repos" className={cn(cell, "col-span-2 lg:col-span-1")} />
                    <input value={e.notes} onChange={(ev) => updateEx(d.key, e.key, { notes: ev.target.value })} placeholder="Tempo, consigne…" aria-label="Notes" className={cn(cell, "col-span-4 lg:col-span-1")} />
                    <div className="col-span-6 flex items-center justify-end gap-0.5 lg:col-span-1">
                      <button type="button" className={iconBtn} disabled={ei === 0} onClick={() => setExs(d.key, (xs) => move(xs, ei, -1))} aria-label="Monter l'exercice" title="Monter">
                        <ArrowUp className="size-4" />
                      </button>
                      <button type="button" className={iconBtn} disabled={ei === d.exercises.length - 1} onClick={() => setExs(d.key, (xs) => move(xs, ei, 1))} aria-label="Descendre l'exercice" title="Descendre">
                        <ArrowDown className="size-4" />
                      </button>
                      <button
                        type="button"
                        className={iconBtn}
                        onClick={() => setExs(d.key, (xs) => [...xs.slice(0, ei + 1), { ...e, key: k() }, ...xs.slice(ei + 1)])}
                        aria-label="Dupliquer l'exercice"
                        title="Dupliquer"
                      >
                        <Copy className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        className={cn(iconBtn, "hover:bg-red-50 hover:text-red-600")}
                        onClick={() => setExs(d.key, (xs) => (xs.length > 1 ? xs.filter((x) => x.key !== e.key) : [emptyEx()]))}
                        aria-label="Retirer l'exercice"
                        title="Retirer"
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setExs(d.key, (xs) => [...xs, emptyEx()])}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-semibold text-brand-500 transition hover:bg-brand-50"
              >
                <Plus className="size-4" /> Ajouter un exercice
              </button>
            </div>
          </Card>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setDays((ds) => [...ds, emptyDay(ds.length)])}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line bg-white/60 py-5 text-sm font-semibold text-muted transition hover:border-brand-300 hover:bg-brand-50/50 hover:text-brand-600"
      >
        <CalendarRange className="size-4" /> Ajouter une journée
      </button>

      {/* Barre d'enregistrement */}
      <div className="sticky bottom-20 z-10 lg:bottom-4">
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-white/95 px-4 py-3 shadow-pop backdrop-blur">
          <p className="hidden items-center gap-2 text-sm text-muted sm:flex">
            <Dumbbell className="size-4 text-accent-500" />
            {days.length} jour{days.length > 1 ? "s" : ""} · {exCount} exercice{exCount > 1 ? "s" : ""}
          </p>
          <div className="flex flex-1 justify-end gap-2">
            <LinkButton href={program ? `/programmes/${program.id}` : "/programmes"} variant="secondary">
              Annuler
            </LinkButton>
            <SubmitButton>
              <Save className="size-4" /> {program ? "Enregistrer" : "Créer le programme"}
            </SubmitButton>
          </div>
        </div>
      </div>
    </ActionForm>
  );
}
