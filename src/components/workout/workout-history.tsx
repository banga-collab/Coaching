import { CalendarDays, ChevronDown, Clock, Dumbbell, Flame, History, Trophy, Weight } from "lucide-react";
import type { WorkoutLog } from "@/lib/types";
import { cn, fmtDate, fmtTime } from "@/lib/utils";
import { Card, CardHeader, Empty } from "@/components/ui";
import { bestSetLabel, detectPRs, entryVolume, fmtDuration, fmtKg, logStats } from "./utils";

const rpeTone = (r: number) => (r <= 4 ? "bg-emerald-50 text-emerald-700" : r <= 7 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700");

/** Liste dépliable de séances (adhérent et coach). `logs` : du plus récent au plus ancien. */
export function WorkoutLogList({ logs, limit }: { logs: WorkoutLog[]; limit?: number }) {
  const { prs } = detectPRs([...logs].reverse());
  const shown = limit ? logs.slice(0, limit) : logs;
  return (
    <ul className="divide-y divide-line">
      {shown.map((l) => {
        const st = logStats(l);
        const pr = prs.get(l.id) ?? [];
        return (
          <li key={l.id}>
            <details className="group">
              <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3.5 transition hover:bg-canvas/60 sm:px-5 [&::-webkit-details-marker]:hidden">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-center leading-none text-brand-600">
                  <span>
                    <span className="block font-display text-base font-extrabold">{fmtDate(l.started_at, { day: "numeric" })}</span>
                    <span className="block text-[10px] font-semibold uppercase">{fmtDate(l.started_at, { month: "short" }).replace(".", "")}</span>
                  </span>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 truncate font-semibold text-ink">
                    <span className="truncate">{l.day_title || "Séance"}</span>
                    {pr.length > 0 && (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-accent-50 px-2 py-0.5 text-[11px] font-bold text-accent-700">
                        <Trophy className="size-3" /> {pr.length} record{pr.length > 1 ? "s" : ""}
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
                    <span className="inline-flex items-center gap-1"><Clock className="size-3" /> {fmtDuration(st.durationMin)}</span>
                    <span className="inline-flex items-center gap-1"><Weight className="size-3" /> {fmtKg(st.volume)}</span>
                    <span className="inline-flex items-center gap-1"><Dumbbell className="size-3" /> {st.done}/{st.total} séries</span>
                  </p>
                </div>
                {l.rpe && <span className={cn("hidden shrink-0 rounded-lg px-2 py-1 text-xs font-bold sm:inline", rpeTone(l.rpe))}>RPE {l.rpe}</span>}
                <ChevronDown className="size-4 shrink-0 text-muted transition group-open:rotate-180" />
              </summary>
              <div className="space-y-2 bg-slate-50/60 px-4 pb-4 pt-1 sm:px-5">
                <p className="pt-2 text-xs text-muted">
                  {fmtDate(l.started_at, { weekday: "long", day: "numeric", month: "long" })} · {fmtTime(l.started_at)}
                  {l.rpe ? <span className="sm:hidden"> · RPE {l.rpe}/10</span> : null}
                </p>
                {l.entries.map((e, i) => {
                  const isPr = pr.some((p) => p.exercise === e.exercise);
                  return (
                    <div key={i} className="rounded-xl border border-line bg-white p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-ink">
                          <span className="truncate">{e.exercise}</span>
                          {isPr && <Trophy className="size-3.5 shrink-0 text-accent-500" />}
                        </p>
                        <span className="shrink-0 text-xs text-muted">{e.target ? `Objectif ${e.target}` : bestSetLabel(e)}</span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {(e.sets ?? []).map((s, j) => (
                          <span
                            key={j}
                            className={cn(
                              "rounded-lg px-2 py-1 text-xs font-semibold tabular-nums",
                              s.done ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-100" : "bg-slate-100 text-slate-400 line-through",
                            )}
                          >
                            {s.reps ?? "–"}
                            {s.load ? ` × ${s.load} kg` : ""}
                          </span>
                        ))}
                      </div>
                      {entryVolume(e) > 0 && <p className="mt-1.5 text-[11px] text-muted">Volume {fmtKg(Math.round(entryVolume(e)))}</p>}
                    </div>
                  );
                })}
                {l.notes && <p className="rounded-xl bg-white p-3 text-sm italic text-slate-600 ring-1 ring-line">« {l.notes} »</p>}
              </div>
            </details>
          </li>
        );
      })}
    </ul>
  );
}

/** Bloc "dernière séance" + historique pour l'écran d'accueil adhérent. */
export function WorkoutHistory({ logs }: { logs: WorkoutLog[] }) {
  const lastLog = logs[0];
  const st = lastLog ? logStats(lastLog) : null;
  const weekAgo = Date.now() - 7 * 86400000;
  const thisWeek = logs.filter((l) => new Date(l.started_at).getTime() >= weekAgo).length;
  const totalVolume = logs.reduce((a, l) => a + logStats(l).volume, 0);

  return (
    <div className="space-y-5">
      {lastLog && st && (
        <div className="grid grid-cols-3 gap-2.5">
          {[
            { icon: <Flame className="size-4" />, label: "Cette semaine", value: `${thisWeek} séance${thisWeek > 1 ? "s" : ""}` },
            { icon: <CalendarDays className="size-4" />, label: "Au total", value: `${logs.length}` },
            { icon: <Weight className="size-4" />, label: "Volume cumulé", value: totalVolume >= 10000 ? `${Math.round(totalVolume / 1000)} t` : fmtKg(totalVolume) },
          ].map((k) => (
            <Card key={k.label} className="p-3.5">
              <span className="text-accent-500">{k.icon}</span>
              <p className="mt-1.5 font-display text-lg font-extrabold leading-none text-ink">{k.value}</p>
              <p className="mt-1 text-[11px] font-medium text-muted">{k.label}</p>
            </Card>
          ))}
        </div>
      )}
      <Card className="overflow-hidden">
        <CardHeader
          title="Mes séances"
          subtitle={lastLog && st ? `Dernière : ${lastLog.day_title || "Séance"} · ${fmtDate(lastLog.started_at, { weekday: "long", day: "numeric", month: "short" })} · ${fmtDuration(st.durationMin)}` : undefined}
          icon={<History className="size-4" />}
        />
        {logs.length === 0 ? (
          <Empty icon={<Dumbbell className="size-6" />} title="Aucune séance pour l'instant" text="Lance ta première séance : tes séries, tes charges et tes records apparaîtront ici." />
        ) : (
          <WorkoutLogList logs={logs} limit={30} />
        )}
      </Card>
    </div>
  );
}
