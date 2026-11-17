import { Dumbbell } from "lucide-react";
import type { ProgramDay } from "@/lib/types";
import { Card } from "@/components/ui";

/** Carte d'une journée de programme (lecture seule, imprimable). */
export function ProgramDayCard({ day, index, compact }: { day: ProgramDay; index: number; compact?: boolean }) {
  return (
    <Card className="overflow-hidden break-inside-avoid">
      <div className="flex items-center gap-3 border-b border-line bg-gradient-to-r from-brand-50/80 to-white px-4 py-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-500 font-display text-sm font-extrabold text-white">{index + 1}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-[15px] font-bold text-ink">{day.title}</p>
          {day.focus && <p className="truncate text-xs text-muted">{day.focus}</p>}
        </div>
        <span className="shrink-0 rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold text-brand-600 ring-1 ring-brand-100">
          {day.exercises.length} exo{day.exercises.length > 1 ? "s" : ""}
        </span>
      </div>
      {day.exercises.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-muted">Aucun exercice.</p>
      ) : (
        <>
          {/* Tableau */}
          <table className={compact ? "hidden" : "hidden w-full text-sm sm:table print:table"}>
            <thead>
              <tr className="border-b border-line bg-slate-50/60 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="px-4 py-2.5">Exercice</th>
                <th className="px-3 py-2.5 text-center">Séries</th>
                <th className="px-3 py-2.5 text-center">Reps</th>
                <th className="px-3 py-2.5 text-center">Charge</th>
                <th className="px-3 py-2.5 text-center">Repos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {day.exercises.map((e, i) => (
                <tr key={i} className="align-top transition hover:bg-canvas/60">
                  <td className="px-4 py-2.5">
                    <span className="font-semibold text-ink">{e.name}</span>
                    {e.notes && <span className="mt-0.5 block text-xs text-muted">{e.notes}</span>}
                  </td>
                  <td className="px-3 py-2.5 text-center font-semibold text-brand-600">{e.sets ?? "–"}</td>
                  <td className="px-3 py-2.5 text-center">{e.reps ?? "–"}</td>
                  <td className="px-3 py-2.5 text-center">{e.load ?? "–"}</td>
                  <td className="px-3 py-2.5 text-center text-slate-600">{e.rest ?? "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {/* Liste (mobile / compacte) */}
          <ul className={compact ? "divide-y divide-line" : "divide-y divide-line sm:hidden print:hidden"}>
            {day.exercises.map((e, i) => (
              <li key={i} className="flex items-start gap-3 px-4 py-3">
                <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-accent-50 text-accent-600">
                  <Dumbbell className="size-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-ink">{e.name}</p>
                  <p className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
                    {(e.sets || e.reps) && (
                      <span className="font-semibold text-brand-600">
                        {e.sets ?? "?"} × {e.reps ?? "?"}
                      </span>
                    )}
                    {e.load && <span>Charge {e.load}</span>}
                    {e.rest && <span>Repos {e.rest}</span>}
                  </p>
                  {e.notes && <p className="mt-1 text-xs italic text-slate-500">{e.notes}</p>}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}
