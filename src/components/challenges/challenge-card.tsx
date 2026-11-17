import Link from "next/link";
import { CalendarRange, Gift, Timer, Users } from "lucide-react";
import type { Challenge } from "@/lib/types";
import { METRICS, challengeStatus, countdownLabel, type LeaderRow } from "@/lib/challenges";
import { cn, fmtDate, num } from "@/lib/utils";
import { Avatar, Badge } from "@/components/ui";
import { RankMedal } from "./progress-ring";

const COVER_BG: Record<string, string> = {
  en_cours: "from-accent-500 via-accent-400 to-amber-300",
  a_venir: "from-brand-600 via-brand-500 to-sky-400",
  termine: "from-slate-500 via-slate-400 to-slate-300",
};

export function ChallengeCard({ ch, rows }: { ch: Challenge; rows: LeaderRow[] }) {
  const st = challengeStatus(ch);
  const unit = ch.unit ?? METRICS[ch.metric].unit;
  const top = rows.slice(0, 3);
  const reached = ch.goal_value ? rows.filter((r) => r.value >= ch.goal_value!).length : null;
  return (
    <Link href={`/defis/${ch.id}`} className="group block overflow-hidden rounded-2xl border border-line bg-white shadow-card transition hover:-translate-y-0.5 hover:shadow-pop">
      <div className={cn("relative h-28 bg-gradient-to-br p-4", COVER_BG[st])}>
        <span className="absolute -bottom-6 right-4 select-none text-[88px] leading-none drop-shadow-lg transition group-hover:scale-110 group-hover:-rotate-6">{ch.cover ?? "🏆"}</span>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-white/25 px-2.5 py-1 text-xs font-bold text-white backdrop-blur">
            <Timer className="size-3.5" /> {countdownLabel(ch)}
          </span>
        </div>
        <p className="mt-3 max-w-[70%] text-xs font-semibold uppercase tracking-wider text-white/85">{METRICS[ch.metric].label}</p>
      </div>
      <div className="p-4">
        <h3 className="font-display text-base font-bold text-ink group-hover:text-brand-600">{ch.title}</h3>
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
          <span className="flex items-center gap-1">
            <CalendarRange className="size-3.5" />
            {fmtDate(`${ch.start_date}T12:00:00Z`, { day: "numeric", month: "short" })} → {fmtDate(`${ch.end_date}T12:00:00Z`, { day: "numeric", month: "short" })}
          </span>
          <span className="flex items-center gap-1">
            <Users className="size-3.5" /> {rows.length} participant{rows.length > 1 ? "s" : ""}
          </span>
          {ch.goal_value ? <span>Objectif {num(ch.goal_value, unit)}</span> : null}
        </div>
        {ch.reward && (
          <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-accent-700">
            <Gift className="size-3.5" /> {ch.reward}
          </p>
        )}

        {top.length > 0 && st !== "a_venir" ? (
          <ul className="mt-4 space-y-2 border-t border-line pt-3">
            {top.map((r) => (
              <li key={r.client_id} className="flex items-center gap-2.5">
                <RankMedal rank={r.rank} size={24} />
                <Avatar name={r.name} size={28} />
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{r.name}</span>
                <span className="text-sm font-bold text-brand-600">{num(r.value)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 border-t border-line pt-3 text-xs text-muted">{st === "a_venir" ? "Le classement s'ouvrira au lancement du défi." : "Aucun score pour l'instant."}</p>
        )}
        {reached !== null && reached > 0 && (
          <div className="mt-3">
            <Badge tone="green">
              {reached} objectif{reached > 1 ? "s" : ""} atteint{reached > 1 ? "s" : ""}
            </Badge>
          </div>
        )}
      </div>
    </Link>
  );
}
