"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Clock, Loader2, X } from "lucide-react";
import { coachDaysAction, type DayInfo, type DayState } from "@/actions/slots";
import { cn } from "@/lib/utils";

const DOW = ["Lu", "Ma", "Me", "Je", "Ve", "Sa", "Di"];
const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const parse = (s: string) => new Date(`${s}T12:00:00Z`);
const addDays = (s: string, n: number) => {
  const d = parse(s);
  d.setUTCDate(d.getUTCDate() + n);
  return ymd(d);
};
function gridStart(month: string) {
  const dow = (parse(`${month}-01`).getUTCDay() + 6) % 7;
  return addDays(`${month}-01`, -dow);
}
function nextMonth(month: string, n = 1) {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + n, 1, 12));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
}
function todayAgadir() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Casablanca", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
const longDate = (d: string) => new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(parse(d));
const fullDate = (d: string) => new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(parse(d));

/** Horaires proposés quand aucun coach n'est choisi */
const GENERIC = Array.from({ length: 33 }, (_, i) => `${pad(6 + Math.floor(i / 2))}:${i % 2 ? "30" : "00"}`);
const CLOSED: DayState[] = ["complet", "conge", "ferme", "passe", "inactif"];
type SlotItem = { t: string; free: boolean; why?: string };

/**
 * Sélecteur date + heure façon Airbnb / Booking : un champ qui ouvre un calendrier
 * (jours sans place barrés, nombre d'horaires libres sous chaque jour) et la grille des heures
 * du jour choisi (heures prises barrées). Envoie les champs « date » et « time » du formulaire.
 */
export function SlotCalendar({
  defaultDate,
  defaultTime,
  coachId: fixedCoach,
  excludeId,
}: {
  defaultDate: string;
  defaultTime?: string;
  /** Coach imposé (sinon on lit le champ « coach_id » du formulaire) */
  coachId?: string;
  /** Séance modifiée : son propre créneau compte comme libre */
  excludeId?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const today = todayAgadir();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState(defaultTime ?? "");
  const [month, setMonth] = useState(defaultDate.slice(0, 7));
  const [coach, setCoach] = useState(fixedCoach ?? "");
  const [duration, setDuration] = useState(60);
  const [days, setDays] = useState<Record<string, DayInfo>>({});
  const [pending, start] = useTransition();

  // Suit le coach et la durée choisis dans le formulaire
  useEffect(() => {
    const form = box.current?.closest("form");
    if (!form) return;
    const read = () => {
      if (!fixedCoach) setCoach(form.querySelector<HTMLSelectElement>('[name="coach_id"]')?.value ?? "");
      const d = Number(form.querySelector<HTMLInputElement>('[name="duration_min"]')?.value);
      setDuration(Number.isFinite(d) && d >= 15 ? d : 60);
    };
    read();
    form.addEventListener("change", read);
    form.addEventListener("input", read);
    return () => {
      form.removeEventListener("change", read);
      form.removeEventListener("input", read);
    };
  }, [fixedCoach]);

  // Charge 2 mois (le mois affiché et le suivant)
  const load = useCallback(() => {
    if (!coach) return setDays({});
    start(async () => setDays(await coachDaysAction(coach, gridStart(month), 70, duration, excludeId ?? null)));
  }, [coach, month, duration, excludeId]);
  useEffect(() => {
    const t = setTimeout(load, 120);
    return () => clearTimeout(t);
  }, [load]);

  // Fermeture : clic à l'extérieur ou Échap
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const info = coach ? days[date] : undefined;
  const nowHm = new Intl.DateTimeFormat("fr-FR", { timeZone: "Africa/Casablanca", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date());
  const slots: SlotItem[] = coach ? (info?.slots ?? []) : GENERIC.map((t) => ({ t, free: !(date === today && t <= nowHm) }));
  const timeTaken = !!time && !!coach && !!info && !info.slots.some((s) => s.t === time && s.free);
  const groups: [string, SlotItem[]][] = [
    ["Matin", slots.filter((s) => s.t < "12:00")],
    ["Après-midi", slots.filter((s) => s.t >= "12:00" && s.t < "17:00")],
    ["Soir", slots.filter((s) => s.t >= "17:00")],
  ];

  const pickDay = (d: string) => {
    setDate(d);
    // L'heure choisie n'est plus libre ce jour-là : on la vide
    const di = coach ? days[d] : undefined;
    if (di && time && !di.slots.some((s) => s.t === time && s.free)) setTime("");
  };

  const month2 = nextMonth(month);

  return (
    <div ref={box} className="relative">
      <input type="hidden" name="date" value={date} readOnly />
      <input type="hidden" name="time" value={time} readOnly />

      {/* Champ façon barre de recherche Booking */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "grid w-full grid-cols-[1.25fr_1fr] overflow-hidden rounded-xl border bg-white text-left shadow-sm transition hover:shadow-md",
          open ? "border-brand-600 ring-1 ring-brand-600" : "border-line",
        )}
      >
        <span className="flex items-center gap-2.5 border-r border-line px-3.5 py-2.5">
          <CalendarDays className="size-4 shrink-0 text-accent-500" />
          <span className="min-w-0">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-muted">Date</span>
            <span className="block truncate text-sm font-semibold capitalize text-ink">{longDate(date)}</span>
          </span>
        </span>
        <span className="flex items-center gap-2.5 px-3.5 py-2.5">
          <Clock className="size-4 shrink-0 text-accent-500" />
          <span className="min-w-0">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-muted">Heure</span>
            <span className={cn("block truncate text-sm font-semibold", time ? (timeTaken ? "text-red-600" : "text-ink") : "text-muted")}>{time || "Choisir"}</span>
          </span>
        </span>
      </button>
      {timeTaken && !open && <p className="mt-1 text-xs font-semibold text-red-600">Cet horaire n&apos;est pas libre pour ce coach.</p>}

      {open && (
        <div className="absolute left-0 right-0 z-40 mt-2 rounded-2xl border border-line bg-white p-4 shadow-2xl sm:left-auto sm:right-auto sm:w-[min(640px,calc(100vw-2rem))] lg:w-[640px]">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-bold text-ink">
              {coach ? "Disponibilités du coach" : "Choisis un coach pour voir ses disponibilités"}
              {pending && <Loader2 className="ml-2 inline size-3.5 animate-spin text-muted" />}
            </p>
            <button type="button" onClick={() => setOpen(false)} className="rounded-full p-1.5 text-muted hover:bg-slate-100" aria-label="Fermer">
              <X className="size-4" />
            </button>
          </div>

          <div className="grid gap-5 sm:grid-cols-[1fr_230px]">
            {/* Calendrier */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <button
                  type="button"
                  disabled={month <= today.slice(0, 7)}
                  onClick={() => setMonth(nextMonth(month, -1))}
                  className="grid size-8 place-items-center rounded-full text-ink hover:bg-slate-100 disabled:opacity-25"
                  aria-label="Mois précédent"
                >
                  <ChevronLeft className="size-4" />
                </button>
                <p className="text-sm font-bold capitalize text-ink">
                  {MONTHS[Number(month.slice(5)) - 1]} {month.slice(0, 4)}
                </p>
                <button type="button" onClick={() => setMonth(month2)} className="grid size-8 place-items-center rounded-full text-ink hover:bg-slate-100" aria-label="Mois suivant">
                  <ChevronRight className="size-4" />
                </button>
              </div>
              <div className="grid grid-cols-7 gap-y-1 text-center">
                {DOW.map((d) => (
                  <span key={d} className="pb-1 text-[11px] font-semibold text-muted">
                    {d}
                  </span>
                ))}
                {Array.from({ length: 42 }, (_, i) => addDays(gridStart(month), i)).map((d) => {
                  if (d.slice(0, 7) !== month) return <span key={d} />;
                  const di = coach ? days[d] : undefined;
                  const past = d < today;
                  const closed = past || (!!di && CLOSED.includes(di.state));
                  const sel = d === date;
                  const freeCount = di?.slots.filter((s) => s.free).length ?? 0;
                  return (
                    <button
                      key={d}
                      type="button"
                      disabled={closed}
                      onClick={() => pickDay(d)}
                      title={
                        di
                          ? di.state === "inactif"
                            ? "Coach désactivé"
                            : di.state === "conge"
                              ? "Congé"
                              : di.state === "ferme"
                                ? "Pas de créneau"
                                : `${di.state === "complet" ? "Complet" : `${freeCount} horaires libres`}${di.classes.length ? ` · cours : ${di.classes.join(", ")}` : ""}`
                          : undefined
                      }
                      className="group flex flex-col items-center py-0.5 disabled:cursor-not-allowed"
                    >
                      <span
                        className={cn(
                          "grid size-9 place-items-center rounded-full text-sm transition",
                          sel ? "bg-brand-600 font-bold text-white" : closed ? "text-slate-300 line-through" : "font-semibold text-ink group-hover:ring-1 group-hover:ring-brand-600",
                          d === today && !sel && "underline decoration-accent-500 decoration-2 underline-offset-4",
                        )}
                      >
                        {Number(d.slice(8))}
                      </span>
                      <span
                        className={cn(
                          "h-3 text-[9px] font-bold leading-3",
                          !di || closed ? "text-transparent" : di.state === "presque" ? "text-amber-600" : "text-emerald-600",
                        )}
                      >
                        {di && !closed ? (di.state === "presque" ? `${freeCount} dern.` : `${freeCount} libres`) : di?.state === "conge" ? "congé" : "·"}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 border-t border-line pt-2 text-[11px] text-muted">
                <span className="flex items-center gap-1">
                  <b className="text-emerald-600">4 libres</b> places
                </span>
                <span className="flex items-center gap-1">
                  <b className="text-amber-600">2 dern.</b> presque complet
                </span>
                <span className="flex items-center gap-1">
                  <span className="text-slate-300 line-through">12</span> complet / congé / fermé
                </span>
              </div>
            </div>

            {/* Heures du jour */}
            <div className="sm:border-l sm:border-line sm:pl-5">
              <p className="mb-2 text-sm font-bold capitalize text-ink">{fullDate(date)}</p>
              {coach && !info ? (
                <p className="text-xs text-muted">Chargement…</p>
              ) : slots.length === 0 ? (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                  {info?.state === "inactif"
                    ? "Ce coach est désactivé."
                    : info?.state === "conge"
                      ? "Le coach est en congé ce jour-là."
                      : info?.state === "ferme"
                        ? "Pas de créneau ce jour-là."
                        : "Aucun horaire."}
                </p>
              ) : (
                <div className="max-h-[300px] space-y-3 overflow-y-auto pr-1">
                  {groups
                    .filter(([, list]) => list.length)
                    .map(([label, list]) => (
                      <div key={label}>
                        <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted">{label}</p>
                        <div className="grid grid-cols-3 gap-1.5">
                          {list.map((s) => (
                            <button
                              key={s.t}
                              type="button"
                              disabled={!s.free}
                              onClick={() => {
                                setTime(s.t);
                                setOpen(false);
                              }}
                              title={s.free ? "Libre" : (s.why ?? "Déjà pris")}
                              className={cn(
                                "rounded-lg border py-1.5 text-xs font-semibold transition",
                                s.t === time && s.free
                                  ? "border-brand-600 bg-brand-600 text-white"
                                  : s.free
                                    ? "border-line bg-white text-ink hover:border-brand-600"
                                    : "cursor-not-allowed border-transparent bg-slate-50 text-slate-300 line-through",
                              )}
                            >
                              {s.t}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                </div>
              )}
              {coach && info && info.classes.length > 0 && (
                <p className="mt-3 rounded-lg bg-indigo-50 px-2.5 py-1.5 text-[11px] font-semibold text-indigo-800">
                  Cours collectif{info.classes.length > 1 ? "s" : ""} : {info.classes.join(" · ")}
                </p>
              )}
              {coach && info && info.booked > 0 && (
                <p className="mt-3 text-[11px] text-muted">
                  {info.booked} séance{info.booked > 1 ? "s" : ""} déjà prévue{info.booked > 1 ? "s" : ""} ce jour-là · durée {duration} min
                </p>
              )}
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
            <button
              type="button"
              onClick={() => {
                setDate(today < defaultDate ? defaultDate : today);
                setMonth(today.slice(0, 7));
                setTime("");
              }}
              className="text-sm font-semibold text-ink underline underline-offset-2"
            >
              Effacer
            </button>
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
              Valider
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
