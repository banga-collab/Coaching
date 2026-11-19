import Link from "next/link";
import { AgendaTabs } from "@/components/planning/agenda-tabs";
import { CalendarDays, CalendarPlus, CheckCircle2, ChevronLeft, ChevronRight, Hourglass, Percent, UsersRound } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ClassBooking, GroupClass, Profile } from "@/lib/types";
import { cn, dayKey, fmtDate } from "@/lib/utils";
import { normName } from "@/lib/video";
import { Card, Empty, Kpi, LinkButton, PageHeader, buttonClass } from "@/components/ui";
import { ClassCard } from "@/components/classes/class-card";
import { ListToolbar } from "@/components/list-toolbar";
import { Fold } from "@/components/fold";
import { CATEGORY_NAMES, addDayKey, cat, classDay, classStats, isDayKey, mondayOf, rangeIso, weekdayIndex } from "@/components/classes/categories";

export const metadata = { title: "Cours collectifs" };

const DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

type SP = { semaine?: string; jour?: string; cree?: string; q?: string; categorie?: string; coach?: string };

export default async function ClassesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const [{ semaine, jour, cree, q = "", categorie = "", coach = "" }] = await Promise.all([searchParams, requireStaff()]);
  const today = dayKey(new Date());
  const monday = mondayOf(isDayKey(semaine) ? semaine : today);
  const days = Array.from({ length: 7 }, (_, i) => addDayKey(monday, i));
  const inWeek = days.includes(today);
  const selIdx = jour !== undefined && /^[0-6]$/.test(jour) ? Number(jour) : inWeek ? weekdayIndex(today) : 0;

  const supabase = await createClient();
  const { from, to } = rangeIso(monday, 7);
  const [{ data: cData }, { data: pData }] = await Promise.all([
    supabase.from("group_classes").select("*").gte("starts_at", from).lt("starts_at", to).order("starts_at"),
    supabase.from("profiles").select("*").in("role", ["admin", "head_coach", "coach"]),
  ]);
  const classes = (cData ?? []) as GroupClass[];
  const ids = classes.map((c) => c.id);
  const { data: bData } = ids.length ? await supabase.from("class_bookings").select("*").in("class_id", ids) : { data: [] };
  const bookings = (bData ?? []) as ClassBooking[];
  const coachList = (pData ?? []) as Profile[];
  const coachName = new Map(coachList.map((p) => [p.id, p.full_name || p.email]));

  // Réservations regroupées par cours (évite de reparcourir toutes les réservations pour chaque cours)
  const bookingsBy = new Map<string, ClassBooking[]>();
  for (const b of bookings) {
    const list = bookingsBy.get(b.class_id);
    if (list) list.push(b);
    else bookingsBy.set(b.class_id, [b]);
  }
  const stats = new Map(classes.map((c) => [c.id, classStats(bookingsBy.get(c.id) ?? [], c.id)]));
  const statsOf = (id: string) => stats.get(id) ?? { taken: 0, waiting: 0 };

  // Indicateurs : toute la semaine
  const active = classes.filter((c) => !c.cancelled);
  const totalSpots = active.reduce((s, c) => s + c.capacity, 0);
  const taken = active.reduce((s, c) => s + statsOf(c.id).taken, 0);
  const waiting = active.reduce((s, c) => s + statsOf(c.id).waiting, 0);
  const fill = totalSpots ? Math.round((taken / totalSpots) * 100) : 0;

  // Recherche (insensible à la casse et aux accents) puis filtres
  const needle = normName(q);
  const searched = needle
    ? classes.filter((c) => normName([c.title, c.category, c.room, c.level, c.coach_id ? coachName.get(c.coach_id) : null].filter(Boolean).join(" ")).includes(needle))
    : classes;
  const countBy = (list: GroupClass[], key: (c: GroupClass) => string | null) => {
    const m = new Map<string, number>();
    for (const c of list) {
      const k = key(c);
      if (k) m.set(k, (m.get(k) ?? 0) + 1);
    }
    return m;
  };
  const catCount = countBy(coach ? searched.filter((c) => c.coach_id === coach) : searched, (c) => c.category);
  const coachCount = countBy(categorie ? searched.filter((c) => c.category === categorie) : searched, (c) => c.coach_id);
  const shown = searched.filter((c) => (!categorie || c.category === categorie) && (!coach || c.coach_id === coach));
  const categoryNames = [...new Set([...CATEGORY_NAMES, ...classes.map((c) => c.category)])];
  const filters = [
    { param: "categorie", label: "Catégorie", options: categoryNames.map((n) => ({ value: n, label: n, count: catCount.get(n) ?? 0 })) },
    ...(coachList.length > 1 ? [{ param: "coach", label: "Coach", options: coachList.map((p) => ({ value: p.id, label: p.full_name || p.email, count: coachCount.get(p.id) ?? 0 })) }] : []),
  ];

  const byDay = new Map<string, GroupClass[]>(days.map((d) => [d, []]));
  for (const c of shown) byDay.get(classDay(c))?.push(c);

  // Navigation en conservant recherche et filtres
  const weekHref = (m: string | null, j?: number) => {
    const p = new URLSearchParams();
    if (m) p.set("semaine", m);
    if (j !== undefined) p.set("jour", String(j));
    if (q) p.set("q", q);
    if (categorie) p.set("categorie", categorie);
    if (coach) p.set("coach", coach);
    const qs = p.toString();
    return qs ? `/cours?${qs}` : "/cours";
  };
  const label = `${fmtDate(days[0]!, { day: "numeric", month: "short" })} – ${fmtDate(days[6]!, { day: "numeric", month: "short", year: "numeric" })}`;

  return (
    <>
      <AgendaTabs active="cours" />
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

      <Fold id="cours-kpis">
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <Kpi label="Cours cette semaine" value={active.length} icon={<CalendarDays className="size-5" />} />
          <Kpi label="Places réservées" value={`${taken}/${totalSpots}`} icon={<UsersRound className="size-5" />} />
          <Kpi label="Taux de remplissage" value={`${fill} %`} tone="accent" icon={<Percent className="size-5" />} />
          <Kpi label="En liste d'attente" value={waiting} tone="accent" icon={<Hourglass className="size-5" />} />
        </div>
      </Fold>

      {/* Navigation semaine + recherche / filtres / export sur une ligne */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex h-10 shrink-0 items-center rounded-xl bg-white pe-3 ring-1 ring-line">
          <Link href={weekHref(addDayKey(monday, -7))} className="grid size-10 place-items-center text-muted hover:text-ink" aria-label="Semaine précédente">
            <ChevronLeft className="size-4 rtl:rotate-180" />
          </Link>
          <Link href={weekHref(addDayKey(monday, 7))} className="grid size-10 place-items-center text-muted hover:text-ink" aria-label="Semaine suivante">
            <ChevronRight className="size-4 rtl:rotate-180" />
          </Link>
          <p className="ms-1 whitespace-nowrap font-display text-sm font-bold capitalize text-ink">{label}</p>
        </div>
        {!inWeek && (
          <Link href={weekHref(null)} className={buttonClass("secondary", "h-10")}>
            Aujourd&apos;hui
          </Link>
        )}
        <ListToolbar
          className="mb-0! min-w-0 flex-1"
          placeholder="Cours, salle, coach…"
          filters={filters}
          exportKind="cours"
          exportParams={{ from: days[0]!, to: days[6]! }}
          right={
            <div className="hidden flex-wrap items-center gap-3 2xl:flex">
              {CATEGORY_NAMES.map((n) => (
                <span key={n} className="flex items-center gap-1.5 text-xs font-medium text-muted">
                  <span className={cn("size-2.5 rounded-full", cat(n).dot)} /> {n}
                </span>
              ))}
            </div>
          }
        />
      </div>

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
                <ClassCard key={c.id} c={c} stats={statsOf(c.id)} coach={c.coach_id ? coachName.get(c.coach_id) : null} />
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
                  <ClassCard key={c.id} c={c} stats={statsOf(c.id)} coach={c.coach_id ? coachName.get(c.coach_id) : null} />
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
