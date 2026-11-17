import Link from "next/link";
import { CalendarDays, CalendarPlus, CheckCircle2, ChevronLeft, ChevronRight, Hourglass, Percent, UsersRound } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ClassBooking, GroupClass, Profile } from "@/lib/types";
import { cn, dayKey, fmtDate } from "@/lib/utils";
import { Card, Empty, Kpi, LinkButton, PageHeader, buttonClass } from "@/components/ui";
import { ClassCard } from "@/components/classes/class-card";
import { CATEGORY_NAMES, addDayKey, cat, classDay, classStats, isDayKey, mondayOf, rangeIso, weekdayIndex } from "@/components/classes/categories";

export const metadata = { title: "Cours collectifs" };

const DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

export default async function ClassesPage({ searchParams }: { searchParams: Promise<{ semaine?: string; jour?: string; cree?: string }> }) {
  const [{ semaine, jour, cree }] = await Promise.all([searchParams, requireStaff()]);
  const today = dayKey(new Date());
  const monday = mondayOf(isDayKey(semaine) ? semaine : today);
  const days = Array.from({ length: 7 }, (_, i) => addDayKey(monday, i));
  const inWeek = days.includes(today);
  const selIdx = jour !== undefined && /^[0-6]$/.test(jour) ? Number(jour) : inWeek ? weekdayIndex(today) : 0;

  const supabase = await createClient();
  const { from, to } = rangeIso(monday, 7);
  const [{ data: cData }, { data: pData }] = await Promise.all([
    supabase.from("group_classes").select("*").gte("starts_at", from).lt("starts_at", to).order("starts_at"),
    supabase.from("profiles").select("*").in("role", ["admin", "coach"]),
  ]);
  const classes = (cData ?? []) as GroupClass[];
  const ids = classes.map((c) => c.id);
  const { data: bData } = ids.length ? await supabase.from("class_bookings").select("*").in("class_id", ids) : { data: [] };
  const bookings = (bData ?? []) as ClassBooking[];
  const coachName = new Map(((pData ?? []) as Profile[]).map((p) => [p.id, p.full_name || p.email]));

  const byDay = new Map<string, GroupClass[]>(days.map((d) => [d, []]));
  for (const c of classes) byDay.get(classDay(c))?.push(c);

  const active = classes.filter((c) => !c.cancelled);
  const totalSpots = active.reduce((s, c) => s + c.capacity, 0);
  const taken = active.reduce((s, c) => s + classStats(bookings, c.id).taken, 0);
  const waiting = active.reduce((s, c) => s + classStats(bookings, c.id).waiting, 0);
  const fill = totalSpots ? Math.round((taken / totalSpots) * 100) : 0;

  const weekHref = (m: string, j?: number) => `/cours?semaine=${m}${j !== undefined ? `&jour=${j}` : ""}`;
  const label = `${fmtDate(days[0]!, { day: "numeric", month: "short" })} – ${fmtDate(days[6]!, { day: "numeric", month: "short", year: "numeric" })}`;

  return (
    <>
      <PageHeader
        title="Cours collectifs"
        subtitle="Planning de la semaine, réservations et listes d'attente."
        actions={
          <LinkButton href={`/cours/nouveau?date=${inWeek ? today : monday}`}>
            <CalendarPlus className="size-4" /> Nouveau cours
          </LinkButton>
        }
      />

      {cree && (
        <p className="mb-5 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 animate-fade-up">
          <CheckCircle2 className="size-4" /> {Number(cree) > 1 ? `${cree} cours ont été ajoutés au planning.` : "Le cours a été ajouté au planning."}
        </p>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Kpi label="Cours cette semaine" value={active.length} icon={<CalendarDays className="size-5" />} />
        <Kpi label="Places réservées" value={`${taken}/${totalSpots}`} icon={<UsersRound className="size-5" />} />
        <Kpi label="Taux de remplissage" value={`${fill} %`} tone="accent" icon={<Percent className="size-5" />} />
        <Kpi label="En liste d'attente" value={waiting} tone="accent" icon={<Hourglass className="size-5" />} />
      </div>

      {/* Navigation semaine */}
      <Card className="mb-4 flex flex-wrap items-center justify-between gap-3 p-3">
        <div className="flex items-center gap-1">
          <Link href={weekHref(addDayKey(monday, -7))} className={buttonClass("ghost", "size-10 px-0")} aria-label="Semaine précédente">
            <ChevronLeft className="size-5" />
          </Link>
          <Link href={weekHref(addDayKey(monday, 7))} className={buttonClass("ghost", "size-10 px-0")} aria-label="Semaine suivante">
            <ChevronRight className="size-5" />
          </Link>
          <p className="ml-1 font-display text-[15px] font-bold capitalize text-ink">{label}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden flex-wrap items-center gap-3 xl:flex">
            {CATEGORY_NAMES.map((n) => (
              <span key={n} className="flex items-center gap-1.5 text-xs font-medium text-muted">
                <span className={cn("size-2.5 rounded-full", cat(n).dot)} /> {n}
              </span>
            ))}
          </div>
          {!inWeek && (
            <Link href="/cours" className={buttonClass("secondary", "h-9")}>
              Aujourd&apos;hui
            </Link>
          )}
        </div>
      </Card>

      {/* Mobile : onglets jours */}
      <div className="lg:hidden">
        <nav className="-mx-1 mb-4 grid grid-cols-7 gap-1">
          {days.map((d, i) => {
            const n = byDay.get(d)!.filter((c) => !c.cancelled).length;
            return (
              <Link
                key={d}
                href={weekHref(monday, i)}
                scroll={false}
                className={cn(
                  "flex min-h-[60px] flex-col items-center justify-center rounded-xl border text-center transition",
                  i === selIdx ? "border-brand-500 bg-brand-500 text-white shadow-sm" : "border-line bg-white text-ink hover:bg-canvas",
                )}
              >
                <span className={cn("text-[11px] font-semibold uppercase", i === selIdx ? "text-white/80" : "text-muted")}>{DAYS[i]}</span>
                <span className="font-display text-lg font-extrabold leading-none">{Number(d.slice(8))}</span>
                <span className={cn("mt-1 size-1.5 rounded-full", n ? (i === selIdx ? "bg-white" : "bg-accent-500") : "bg-transparent")} />
              </Link>
            );
          })}
        </nav>
        {(() => {
          const list = byDay.get(days[selIdx]!)!;
          return list.length ? (
            <div className="grid gap-3 sm:grid-cols-2 animate-fade-up">
              {list.map((c) => (
                <ClassCard key={c.id} c={c} stats={classStats(bookings, c.id)} coach={c.coach_id ? coachName.get(c.coach_id) : null} />
              ))}
            </div>
          ) : (
            <Card>
              <Empty
                icon={<CalendarDays className="size-6" />}
                title="Aucun cours ce jour-là"
                text="Ajoutez un créneau pour que les adhérents puissent réserver."
                action={
                  <LinkButton href={`/cours/nouveau?date=${days[selIdx]}`} variant="secondary">
                    <CalendarPlus className="size-4" /> Ajouter un cours
                  </LinkButton>
                }
              />
            </Card>
          );
        })()}
      </div>

      {/* Desktop : colonnes lundi → dimanche */}
      <div className="hidden gap-3 lg:grid lg:grid-cols-7 animate-fade-up">
        {days.map((d, i) => {
          const list = byDay.get(d)!;
          const isToday = d === today;
          return (
            <div key={d} className={cn("flex min-h-[320px] flex-col rounded-2xl border p-2", isToday ? "border-brand-200 bg-brand-50/50" : "border-line bg-canvas/60")}>
              <div className="mb-2 flex items-baseline justify-between px-1.5 pt-1">
                <span className={cn("text-xs font-bold uppercase tracking-wide", isToday ? "text-brand-600" : "text-muted")}>{DAYS[i]}</span>
                <span className={cn("grid size-7 place-items-center rounded-full font-display text-sm font-extrabold", isToday ? "bg-brand-500 text-white" : "text-ink")}>
                  {Number(d.slice(8))}
                </span>
              </div>
              <div className="flex flex-1 flex-col gap-2">
                {list.map((c) => (
                  <ClassCard key={c.id} c={c} stats={classStats(bookings, c.id)} coach={c.coach_id ? coachName.get(c.coach_id) : null} />
                ))}
                <Link
                  href={`/cours/nouveau?date=${d}`}
                  className="mt-auto flex h-9 items-center justify-center gap-1 rounded-xl border border-dashed border-slate-300 text-xs font-semibold text-muted opacity-70 transition hover:border-brand-400 hover:text-brand-600 hover:opacity-100"
                >
                  <CalendarPlus className="size-3.5" /> Ajouter
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
