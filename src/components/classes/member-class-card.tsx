import { CalendarCheck, Clock, Gauge, Hourglass, MapPin, UserRound, X } from "lucide-react";
import type { ClassBooking, GroupClass } from "@/lib/types";
import { cn, fmtDate, fmtTime } from "@/lib/utils";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { bookClassAction, cancelMyBookingAction } from "@/actions/classes";
import { cat, type ClassStats } from "./categories";

const LIMIT_MS = 2 * 3600 * 1000;

/** Carte d'un cours côté adhérent (réserver / liste d'attente / annuler) */
export function MemberClassCard({
  c,
  stats,
  mine,
  position,
  coach,
  showDate,
}: {
  c: GroupClass;
  stats: ClassStats;
  mine: ClassBooking | null;
  position: number | null;
  coach: string | null;
  showDate?: boolean;
}) {
  const st = cat(c.category);
  const start = new Date(c.starts_at).getTime();
  const now = Date.now();
  const started = start <= now;
  const left = Math.max(0, c.capacity - stats.taken);
  const booked = mine?.status === "inscrit" || mine?.status === "present";
  const waiting = mine?.status === "attente";
  const canCancel = waiting || (booked && mine?.status === "inscrit" && start - now >= LIMIT_MS);

  return (
    <article
      className={cn(
        "relative overflow-hidden rounded-2xl border bg-white shadow-card transition",
        booked ? "border-emerald-200 ring-1 ring-emerald-100" : waiting ? "border-amber-200" : "border-line",
        (c.cancelled || started) && "opacity-70",
      )}
    >
      <span className="absolute inset-y-0 left-0 w-1.5" style={{ background: st.hex }} />
      <div className="flex gap-4 p-4 pl-5">
        <div className="w-14 shrink-0 text-center">
          <p className="font-display text-xl font-extrabold leading-none text-ink">{fmtTime(c.starts_at)}</p>
          <p className="mt-1 text-[11px] font-semibold text-muted">{c.duration_min} min</p>
          {showDate && <p className="mt-1 text-[11px] font-bold capitalize text-brand-600">{fmtDate(c.starts_at, { weekday: "short", day: "numeric" })}</p>}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={cn("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-bold", st.soft)}>
              {st.emoji} {c.category}
            </span>
            {booked && (
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[11px] font-bold text-emerald-700">
                <CalendarCheck className="size-3" /> Réservé
              </span>
            )}
            {waiting && (
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] font-bold text-amber-700">
                <Hourglass className="size-3" /> {position ? `${position}${position === 1 ? "er" : "e"} en attente` : "En attente"}
              </span>
            )}
          </div>
          <h3 className={cn("mt-1.5 font-display text-base font-bold leading-snug text-ink", c.cancelled && "line-through")}>{c.title}</h3>
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
            {coach && (
              <span className="flex items-center gap-1">
                <UserRound className="size-3.5" /> {coach.split(" ")[0]}
              </span>
            )}
            {c.level && (
              <span className="flex items-center gap-1">
                <Gauge className="size-3.5" /> {c.level}
              </span>
            )}
            {c.room && (
              <span className="flex items-center gap-1">
                <MapPin className="size-3.5" /> {c.room}
              </span>
            )}
          </div>
          {c.description && <p className="mt-2 line-clamp-2 text-xs text-slate-500">{c.description}</p>}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-line bg-canvas/50 px-4 py-3 pl-5">
        <p className="text-sm font-semibold">
          {c.cancelled ? (
            <span className="text-red-600">Cours annulé</span>
          ) : started ? (
            <span className="text-muted">Cours commencé</span>
          ) : left === 0 ? (
            <span className="text-red-600">Complet{stats.waiting ? ` · ${stats.waiting} en attente` : ""}</span>
          ) : left <= 3 ? (
            <span className="text-accent-600">🔥 Plus que {left} place{left > 1 ? "s" : ""} !</span>
          ) : (
            <span className="text-emerald-700">
              {left} places libres <span className="font-normal text-muted">/ {c.capacity}</span>
            </span>
          )}
        </p>
        {!c.cancelled && !started && (
          <div className="shrink-0">
            {booked || waiting ? (
              canCancel ? (
                <ActionForm action={cancelMyBookingAction} className="flex flex-col items-end">
                  <input type="hidden" name="class_id" value={c.id} />
                  <SubmitButton variant="secondary" className="h-11 min-w-[112px]" pendingText="…">
                    <X className="size-4" /> {waiting ? "Quitter" : "Annuler"}
                  </SubmitButton>
                </ActionForm>
              ) : (
                <span className="flex items-center gap-1 text-xs text-muted">
                  <Clock className="size-3.5" /> Annulation fermée
                </span>
              )
            ) : (
              <ActionForm action={bookClassAction} className="flex flex-col items-end">
                <input type="hidden" name="class_id" value={c.id} />
                <SubmitButton variant={left ? "primary" : "secondary"} className="h-11 min-w-[112px]" pendingText="…">
                  {left ? "Réserver" : "Rejoindre l'attente"}
                </SubmitButton>
              </ActionForm>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
