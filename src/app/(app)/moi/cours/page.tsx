import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarCheck, CalendarDays, Hourglass, Info } from "lucide-react";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ClassBooking, Client, GroupClass, Profile } from "@/lib/types";
import { cn, dayKey, fmtDate } from "@/lib/utils";
import { Card, Empty, PageHeader } from "@/components/ui";
import { MemberClassCard } from "@/components/classes/member-class-card";
import { addDayKey, classDay, classStats, rangeIso } from "@/components/classes/categories";

export const metadata = { title: "Cours collectifs" };

export default async function MyClassesPage({ searchParams }: { searchParams: Promise<{ jour?: string }> }) {
  const { jour } = await searchParams;
  const me = await getProfile();
  if (me.role !== "client") redirect("/cours");
  const supabase = await createClient();
  const { data: cData } = await supabase.from("clients").select("*").eq("user_id", me.id).maybeSingle();
  if (!cData) {
    return (
      <>
        <PageHeader title="Cours collectifs" />
        <Card>
          <Empty icon={<CalendarDays className="size-6" />} title="Ton dossier n'est pas encore relié" text="Demande à ton coach de relier ton compte pour réserver tes cours." />
        </Card>
      </>
    );
  }
  const client = cData as Client;
  const today = dayKey(new Date());
  const days = Array.from({ length: 7 }, (_, i) => addDayKey(today, i));
  const sel = jour && days.includes(jour) ? jour : today;
  const { from, to } = rangeIso(today, 7);

  const [{ data: clsData }, { data: myData }] = await Promise.all([
    supabase.from("group_classes").select("*").gte("starts_at", from).lt("starts_at", to).order("starts_at"),
    supabase.from("class_bookings").select("*").eq("client_id", client.id),
  ]);
  const classes = (clsData ?? []) as GroupClass[];
  const myBookings = (myData ?? []) as ClassBooking[];

  // Mes réservations à venir (au-delà de la fenêtre de 7 jours aussi)
  const activeMine = myBookings.filter((b) => b.status === "inscrit" || b.status === "attente");
  const extraIds = activeMine.map((b) => b.class_id).filter((id) => !classes.some((c) => c.id === id));
  const { data: extraData } = extraIds.length ? await supabase.from("group_classes").select("*").in("id", extraIds) : { data: [] };
  const allClasses = [...classes, ...((extraData ?? []) as GroupClass[])];
  const classIds = allClasses.map((c) => c.id);
  const coachIds = [...new Set(allClasses.map((c) => c.coach_id).filter(Boolean))] as string[];

  const [{ data: bData }, { data: pData }] = await Promise.all([
    classIds.length ? supabase.from("class_bookings").select("*").in("class_id", classIds).order("created_at") : Promise.resolve({ data: [] }),
    coachIds.length ? supabase.from("profiles").select("*").in("id", coachIds) : Promise.resolve({ data: [] }),
  ]);
  const bookings = (bData ?? []) as ClassBooking[];
  const coachName = new Map(((pData ?? []) as Profile[]).map((p) => [p.id, p.full_name]));
  const mineFor = (id: string) => myBookings.find((b) => b.class_id === id && b.status !== "annule") ?? null;
  const positionFor = (id: string) => {
    const q = bookings.filter((b) => b.class_id === id && b.status === "attente");
    const i = q.findIndex((b) => b.client_id === client.id);
    return i >= 0 ? i + 1 : null;
  };

  const now = Date.now();
  const upcoming = allClasses
    .filter((c) => !c.cancelled || mineFor(c.id))
    .filter((c) => {
      const m = mineFor(c.id);
      return m && (m.status === "inscrit" || m.status === "attente") && new Date(c.starts_at).getTime() + c.duration_min * 60000 > now;
    })
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const dayList = classes.filter((c) => classDay(c) === sel);
  const countFor = (d: string) => classes.filter((c) => classDay(c) === d && !c.cancelled).length;

  const card = (c: GroupClass, showDate?: boolean) => (
    <MemberClassCard
      key={c.id}
      c={c}
      stats={classStats(bookings, c.id)}
      mine={mineFor(c.id)}
      position={positionFor(c.id)}
      coach={c.coach_id ? coachName.get(c.coach_id) ?? null : null}
      showDate={showDate}
    />
  );

  return (
    <>
      <PageHeader title="Cours collectifs" subtitle={`Réserve ta place, ${client.full_name.split(" ")[0]} ! CrossFit, HIIT, yoga…`} />

      {upcoming.length > 0 && (
        <section className="mb-6 animate-fade-up">
          <h2 className="mb-3 flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wider text-brand-600">
            <CalendarCheck className="size-4 text-accent-500" /> Mes réservations
            <span className="rounded-full bg-brand-500 px-2 text-xs text-white">{upcoming.length}</span>
          </h2>
          <div className="grid gap-3 md:grid-cols-2">{upcoming.map((c) => card(c, true))}</div>
        </section>
      )}

      {/* Sélecteur de jour */}
      <nav className="sticky top-14 z-10 -mx-4 mb-4 bg-canvas/95 px-4 py-2 backdrop-blur sm:static sm:mx-0 sm:bg-transparent sm:px-0 sm:py-0" aria-label="Choisir un jour">
        <div className="grid grid-cols-7 gap-1.5">
          {days.map((d, i) => {
            const active = d === sel;
            const n = countFor(d);
            return (
              <Link
                key={d}
                href={`/moi/cours?jour=${d}`}
                scroll={false}
                className={cn(
                  "flex min-h-[64px] flex-col items-center justify-center rounded-2xl border text-center transition active:scale-95",
                  active ? "border-accent-500 bg-accent-500 text-white shadow-sm shadow-accent-500/30" : "border-line bg-white text-ink hover:bg-canvas",
                )}
              >
                <span className={cn("text-[11px] font-semibold uppercase", active ? "text-white/85" : "text-muted")}>
                  {i === 0 ? "Auj." : fmtDate(`${d}T12:00:00Z`, { weekday: "short" }).replace(".", "")}
                </span>
                <span className="font-display text-lg font-extrabold leading-tight">{Number(d.slice(8))}</span>
                <span className={cn("mt-0.5 size-1.5 rounded-full", n ? (active ? "bg-white" : "bg-brand-500") : "bg-transparent")} />
              </Link>
            );
          })}
        </div>
      </nav>

      <h2 className="mb-3 font-display text-lg font-bold capitalize text-ink">{sel === today ? "Aujourd'hui" : fmtDate(`${sel}T12:00:00Z`, { weekday: "long", day: "numeric", month: "long" })}</h2>
      {dayList.length ? (
        <div className="grid gap-3 md:grid-cols-2 animate-fade-up">{dayList.map((c) => card(c))}</div>
      ) : (
        <Card>
          <Empty icon={<CalendarDays className="size-6" />} title="Pas de cours ce jour-là" text="Jette un œil aux autres jours de la semaine 👆" />
        </Card>
      )}

      <p className="mt-6 flex items-start gap-2 rounded-xl bg-brand-50 px-4 py-3 text-xs text-brand-700">
        <Info className="mt-0.5 size-4 shrink-0" />
        <span>
          Annulation gratuite jusqu&apos;à 2 h avant le cours. Si le cours est complet, rejoins la liste d&apos;attente : tu seras prévenu{" "}
          <Hourglass className="inline size-3" /> dès qu&apos;une place se libère.
        </span>
      </p>
    </>
  );
}
