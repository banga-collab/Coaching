import Link from "next/link";
import { Clock, Hourglass, MapPin, Users } from "lucide-react";
import type { GroupClass } from "@/lib/types";
import { cn, fmtTime } from "@/lib/utils";
import { cat, type ClassStats } from "./categories";

export function OccupancyBar({ taken, capacity, className }: { taken: number; capacity: number; className?: string }) {
  const pct = capacity ? Math.min(100, Math.round((taken / capacity) * 100)) : 0;
  return (
    <div className={cn("h-1.5 overflow-hidden rounded-full bg-slate-100", className)}>
      <div className={cn("h-full rounded-full transition-all", pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-amber-500" : "bg-emerald-500")} style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Carte compacte d'un cours (planning staff) */
export function ClassCard({ c, stats, coach }: { c: GroupClass; stats: ClassStats; coach?: string | null }) {
  const st = cat(c.category);
  const full = stats.taken >= c.capacity;
  const past = new Date(c.starts_at).getTime() + c.duration_min * 60000 < Date.now();
  return (
    <Link
      href={`/cours/${c.id}`}
      className={cn(
        "group block rounded-xl border border-line border-l-4 bg-white p-3 shadow-card transition hover:-translate-y-0.5 hover:shadow-pop",
        st.border,
        (c.cancelled || past) && "opacity-60",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={cn("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-bold", st.soft)}>
          {st.emoji} {c.category}
        </span>
        <span className="flex items-center gap-1 text-xs font-semibold text-ink">
          <Clock className="size-3 text-muted" />
          {fmtTime(c.starts_at)}
        </span>
      </div>
      <p className={cn("mt-2 font-display text-sm font-bold leading-tight text-ink group-hover:text-brand-600", c.cancelled && "line-through")}>{c.title}</p>
      {coach && <p className="mt-0.5 truncate text-xs text-muted">avec {coach.split(" ")[0]}</p>}
      {c.cancelled ? (
        <p className="mt-2 text-xs font-bold uppercase tracking-wide text-red-600">Annulé</p>
      ) : (
        <>
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className={cn("flex items-center gap-1 font-semibold", full ? "text-red-600" : "text-slate-600")}>
              <Users className="size-3" /> {stats.taken}/{c.capacity}
            </span>
            {stats.waiting > 0 && (
              <span className="flex items-center gap-1 font-semibold text-amber-600">
                <Hourglass className="size-3" /> +{stats.waiting}
              </span>
            )}
          </div>
          <OccupancyBar taken={stats.taken} capacity={c.capacity} className="mt-1.5" />
        </>
      )}
      {c.room && (
        <p className="mt-2 flex items-center gap-1 truncate text-[11px] text-muted">
          <MapPin className="size-3 shrink-0" /> {c.room} · {c.duration_min} min
        </p>
      )}
    </Link>
  );
}
