"use client";

import { useActionState, useState } from "react";
import { AlertCircle, CalendarCheck2, CalendarDays, Check, Clock, Dumbbell, Mail, MessageCircle, Phone, RotateCcw, User } from "lucide-react";
import { createBookingAction } from "@/actions/platform";
import type { BookingState } from "@/components/platform/types";
import type { BookingDay } from "@/components/platform/slots";
import { WEEKDAYS_SHORT } from "@/components/platform/slots";
import { waLink } from "@/lib/whatsapp";
import { cn, fmtDate, fmtTime } from "@/lib/utils";
import { Card, Field, Input, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

export function BookingForm({ types, days, brand, whatsapp, slot }: { types: string[]; days: BookingDay[]; brand: string; whatsapp: string | null; slot: number }) {
  const [state, action] = useActionState<BookingState, FormData>(createBookingAction, undefined);
  const [type, setType] = useState(types.length === 1 ? types[0]! : "");
  const firstOpen = days.find((d) => d.slots.length)?.key ?? null;
  const [dayKey, setDayKey] = useState<string | null>(firstOpen);
  const [iso, setIso] = useState("");
  const day = days.find((d) => d.key === dayKey) ?? null;

  if (state?.done) return <Success done={state.done} brand={brand} whatsapp={whatsapp} />;

  const longDate = (v: string) => fmtDate(v, { weekday: "long", day: "numeric", month: "long" });

  return (
    <form action={action} className="space-y-4 animate-fade-up">
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="wanted_at" value={iso} />

      {/* 1. Type */}
      <Card className="p-5 sm:p-6">
        <Step n={1} title="Type de rendez-vous" done={!!type} />
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {types.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              aria-pressed={type === t}
              className={cn(
                "flex items-center gap-3 rounded-xl border p-3.5 text-left text-sm font-semibold transition",
                type === t ? "border-brand-400 bg-brand-50 text-brand-700 ring-4 ring-brand-50" : "border-line bg-white text-ink hover:border-slate-300 hover:bg-canvas",
              )}
            >
              <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg", type === t ? "bg-brand-500 text-white" : "bg-accent-50 text-accent-600")}>
                <Dumbbell className="size-4" />
              </span>
              <span className="min-w-0">
                <span className="block">{t}</span>
                <span className="block text-xs font-medium text-muted">{slot} min</span>
              </span>
            </button>
          ))}
        </div>
      </Card>

      {/* 2. Date & heure */}
      <Card className="p-5 sm:p-6">
        <Step n={2} title="Date et heure" done={!!iso} />
        {days.every((d) => !d.slots.length) ? (
          <p className="mt-4 rounded-xl bg-canvas px-4 py-6 text-center text-sm text-muted">Aucun créneau disponible dans les 14 prochains jours. Contactez-nous sur WhatsApp.</p>
        ) : (
          <>
            <div className="-mx-1 mt-4 flex gap-2 overflow-x-auto px-1 pb-2" role="listbox" aria-label="Jour">
              {days.map((d) => {
                const date = new Date(`${d.key}T12:00:00Z`);
                const active = d.key === dayKey;
                const off = !d.slots.length;
                return (
                  <button
                    key={d.key}
                    type="button"
                    disabled={off}
                    role="option"
                    aria-selected={active}
                    onClick={() => {
                      setDayKey(d.key);
                      setIso("");
                    }}
                    className={cn(
                      "flex w-[68px] shrink-0 flex-col items-center rounded-2xl border py-2.5 transition",
                      active ? "border-brand-500 bg-brand-500 text-white shadow-sm shadow-brand-500/30" : "border-line bg-white text-ink hover:border-slate-300",
                      off && "cursor-not-allowed opacity-40",
                    )}
                  >
                    <span className={cn("text-[11px] font-semibold uppercase", active ? "text-brand-100" : "text-muted")}>{WEEKDAYS_SHORT[d.weekday]}</span>
                    <span className="font-display text-xl font-extrabold leading-tight">{date.getUTCDate()}</span>
                    <span className={cn("text-[10px] font-medium", active ? "text-brand-100" : "text-muted")}>{fmtDate(date, { month: "short", timeZone: "UTC" })}</span>
                  </button>
                );
              })}
            </div>
            {day && (
              <div className="mt-3">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold capitalize text-slate-600">
                  <CalendarDays className="size-3.5 text-accent-500" /> {fmtDate(`${day.key}T12:00:00Z`, { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })} · {day.slots.length} créneau{day.slots.length > 1 ? "x" : ""}
                </p>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                  {day.slots.map((s) => (
                    <button
                      key={s.iso}
                      type="button"
                      onClick={() => setIso(s.iso)}
                      aria-pressed={iso === s.iso}
                      className={cn(
                        "h-10 rounded-xl border text-sm font-semibold tabular-nums transition",
                        iso === s.iso ? "border-accent-500 bg-accent-500 text-white shadow-sm shadow-accent-500/30" : "border-line bg-white text-ink hover:border-accent-300 hover:bg-accent-50",
                      )}
                    >
                      {s.time}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      {/* 3. Coordonnées */}
      <Card className={cn("p-5 sm:p-6 transition", (!type || !iso) && "opacity-70")}>
        <Step n={3} title="Vos coordonnées" done={false} />
        {type && iso && (
          <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-brand-50 px-3.5 py-2.5 text-sm font-medium text-brand-700">
            <span className="inline-flex items-center gap-1.5">
              <Dumbbell className="size-4" /> {type}
            </span>
            <span className="inline-flex items-center gap-1.5 capitalize">
              <Clock className="size-4" /> {longDate(iso)} à {fmtTime(iso)}
            </span>
          </p>
        )}
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Nom complet *">
            <span className="relative block">
              <User className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <Input name="full_name" required minLength={2} maxLength={120} autoComplete="name" placeholder="Prénom Nom" className="pl-10" />
            </span>
          </Field>
          <Field label="Téléphone (WhatsApp) *">
            <span className="relative block">
              <Phone className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <Input name="phone" required type="tel" inputMode="tel" autoComplete="tel" placeholder="06 12 34 56 78" className="pl-10" />
            </span>
          </Field>
          <Field label="E-mail (facultatif)" className="sm:col-span-2">
            <span className="relative block">
              <Mail className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <Input name="email" type="email" autoComplete="email" placeholder="vous@exemple.com" className="pl-10" />
            </span>
          </Field>
          <Field label="Message (facultatif)" className="sm:col-span-2">
            <Textarea name="message" maxLength={1000} rows={3} placeholder="Votre objectif, vos disponibilités, une blessure à signaler…" />
          </Field>
        </div>

        {state?.error && (
          <p className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle className="mt-0.5 size-4 shrink-0" /> {state.error}
          </p>
        )}

        <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted">Vos informations servent uniquement à organiser votre rendez-vous.</p>
          {type && iso ? (
            <SubmitButton className="h-11 w-full sm:w-auto" pendingText="Envoi…">
              <CalendarCheck2 className="size-4" /> Demander ce rendez-vous
            </SubmitButton>
          ) : (
            <button type="button" disabled className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-200 px-4 text-sm font-semibold text-slate-500 sm:w-auto">
              {type ? "Choisissez un créneau" : "Choisissez un type de rendez-vous"}
            </button>
          )}
        </div>
      </Card>
    </form>
  );
}

function Step({ n, title, done }: { n: number; title: string; done: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span className={cn("grid size-7 place-items-center rounded-full text-xs font-bold", done ? "bg-emerald-500 text-white" : "bg-brand-500 text-white")}>
        {done ? <Check className="size-4" /> : n}
      </span>
      <h2 className="font-display text-base font-bold text-ink">{title}</h2>
    </div>
  );
}

function Success({ done, brand, whatsapp }: { done: { name: string; type: string; iso: string }; brand: string; whatsapp: string | null }) {
  const when = `${fmtDate(done.iso, { weekday: "long", day: "numeric", month: "long" })} à ${fmtTime(done.iso)}`;
  const wa = waLink(whatsapp, `Bonjour, je viens de demander un rendez-vous « ${done.type} » le ${when} au nom de ${done.name}.`);
  return (
    <Card className="overflow-hidden text-center animate-fade-up">
      <div className="bg-gradient-to-b from-emerald-50 to-white px-6 pb-2 pt-10">
        <span className="mx-auto grid size-16 place-items-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/30">
          <Check className="size-8" strokeWidth={3} />
        </span>
        <h2 className="mt-5 font-display text-2xl font-extrabold text-ink">Demande envoyée !</h2>
        <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted">
          Merci {done.name.split(" ")[0]}. Un coach du {brand} vous confirme le rendez-vous très vite par téléphone ou WhatsApp.
        </p>
      </div>
      <div className="px-6 pb-8">
        <dl className="mx-auto mt-6 max-w-sm divide-y divide-line rounded-2xl border border-line text-left text-sm">
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <dt className="text-muted">Rendez-vous</dt>
            <dd className="font-semibold text-ink">{done.type}</dd>
          </div>
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <dt className="text-muted">Date</dt>
            <dd className="text-right font-semibold capitalize text-ink">{when}</dd>
          </div>
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <dt className="text-muted">Statut</dt>
            <dd className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-100">
              <span className="size-1.5 rounded-full bg-current" /> En attente de confirmation
            </dd>
          </div>
        </dl>
        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          {wa && (
            <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#25D366] px-5 text-sm font-semibold text-white shadow-sm shadow-[#25D366]/25 transition hover:bg-[#1fb457]">
              <MessageCircle className="size-4" /> Nous écrire sur WhatsApp
            </a>
          )}
          <a href="/reserver" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-line bg-white px-5 text-sm font-semibold text-ink transition hover:bg-canvas">
            <RotateCcw className="size-4" /> Nouvelle demande
          </a>
        </div>
      </div>
    </Card>
  );
}
