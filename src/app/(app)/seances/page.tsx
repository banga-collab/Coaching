import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Client, Session } from "@/lib/types";
import { addDays, cn, dayKey, fmtDate, fmtTime, startOfWeek } from "@/lib/utils";
import { Card, LinkButton, PageHeader } from "@/components/ui";

export const metadata = { title: "Séances" };

const tone = {
  planifiee: "bg-brand-50 border-brand-500 text-brand-800",
  realisee: "bg-emerald-50 border-emerald-500 text-emerald-800",
  absent: "bg-red-50 border-red-400 text-red-800",
  annulee: "bg-slate-50 border-slate-300 text-slate-500 line-through",
};

export default async function SessionsPage({ searchParams }: { searchParams: Promise<{ semaine?: string }> }) {
  const { semaine } = await searchParams;
  await requireStaff();
  const offset = Number(semaine ?? 0) || 0;
  const week0 = addDays(startOfWeek(new Date()), offset * 7);
  const end = addDays(week0, 7);
  const supabase = await createClient();
  const [{ data: sData }, { data: cData }] = await Promise.all([
    supabase.from("sessions").select("*").gte("starts_at", addDays(week0, -1).toISOString()).lt("starts_at", addDays(end, 1).toISOString()).order("starts_at"),
    supabase.from("clients").select("id, full_name"),
  ]);
  const sessions = (sData ?? []) as Session[];
  const names = new Map(((cData ?? []) as Pick<Client, "id" | "full_name">[]).map((c) => [c.id, c.full_name]));
  const days = Array.from({ length: 7 }, (_, i) => addDays(week0, i));
  const todayKey = dayKey(new Date());
  const visible = sessions.filter((s) => days.some((d) => dayKey(s.starts_at) === dayKey(d)));
  const done = visible.filter((s) => s.status === "realisee").length;

  return (
    <>
      <PageHeader
        title="Séances"
        subtitle={`Semaine du ${fmtDate(week0, { day: "numeric", month: "long" })} · ${visible.length} séance${visible.length > 1 ? "s" : ""}, ${done} réalisée${done > 1 ? "s" : ""}`}
        actions={
          <>
            <div className="flex items-center rounded-xl bg-white ring-1 ring-line">
              <Link href={`/seances?semaine=${offset - 1}`} className="grid size-10 place-items-center text-muted hover:text-ink" aria-label="Semaine précédente">
                <ChevronLeft className="size-4" />
              </Link>
              <Link href="/seances" className={cn("px-2 text-sm font-semibold", offset === 0 ? "text-brand-600" : "text-muted hover:text-ink")}>
                Cette semaine
              </Link>
              <Link href={`/seances?semaine=${offset + 1}`} className="grid size-10 place-items-center text-muted hover:text-ink" aria-label="Semaine suivante">
                <ChevronRight className="size-4" />
              </Link>
            </div>
            <LinkButton href="/seances/nouvelle">
              <Plus className="size-4" /> Nouvelle séance
            </LinkButton>
          </>
        }
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {days.map((d) => {
          const k = dayKey(d);
          const list = sessions.filter((s) => dayKey(s.starts_at) === k);
          const isToday = k === todayKey;
          return (
            <Card key={k} className={cn("flex min-h-44 flex-col p-3", isToday && "ring-2 ring-accent-400")}>
              <div className="mb-2 flex items-baseline justify-between px-1">
                <span className={cn("text-xs font-semibold uppercase tracking-wider", isToday ? "text-accent-600" : "text-muted")}>{fmtDate(d, { weekday: "short" })}</span>
                <span className={cn("font-display text-lg font-extrabold", isToday ? "text-accent-500" : "text-ink")}>{fmtDate(d, { day: "numeric" })}</span>
              </div>
              <div className="flex-1 space-y-1.5">
                {list.map((s) => (
                  <Link key={s.id} href={`/seances/${s.id}`} className={cn("block rounded-lg border-l-[3px] px-2.5 py-2 text-xs transition hover:brightness-95", tone[s.status])}>
                    <b className="block">
                      {fmtTime(s.starts_at)} · {(names.get(s.client_id) ?? "Client").split(" ")[0]}
                    </b>
                    <span className="line-clamp-1 opacity-80">{s.type}</span>
                  </Link>
                ))}
              </div>
              <Link href={`/seances/nouvelle?date=${k}`} className="mt-2 flex items-center justify-center gap-1 rounded-lg py-1.5 text-xs font-semibold text-slate-400 transition hover:bg-canvas hover:text-brand-500">
                <Plus className="size-3.5" /> Ajouter
              </Link>
            </Card>
          );
        })}
      </div>
    </>
  );
}
