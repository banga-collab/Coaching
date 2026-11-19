import Link from "next/link";
import { AlarmClock } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Session } from "@/lib/types";
import { BUSY_STATUSES, isForgotten } from "@/lib/planning";
import { SESSION_LABEL, fmtDate, fmtTime } from "@/lib/utils";
import { Badge, Card } from "@/components/ui";
import { SESSION_BADGE } from "./status";
import { CloseActions } from "./session-panels";

/**
 * Séances oubliées : encore « en attente / acceptée / report proposé » après leur heure,
 * ou restées « en cours ». Un coach voit les siennes, un manager celles de toute l'équipe.
 */
export async function loadForgotten(supabase: SupabaseClient, coachId: string | null, limit = 30) {
  const now = Date.now();
  // On ne regarde que les 60 derniers jours (au-delà, la séance se corrige depuis sa fiche)
  let q = supabase
    .from("sessions")
    .select("*")
    .in("status", BUSY_STATUSES)
    .gte("starts_at", new Date(now - 60 * 86400000).toISOString())
    .lt("starts_at", new Date(now).toISOString())
    .order("starts_at", { ascending: false });
  if (coachId) q = q.eq("coach_id", coachId);
  const { data } = await q;
  return ((data ?? []) as Session[]).filter((s) => isForgotten(s, now)).slice(0, limit);
}

/** Bandeau « À clôturer » avec actions rapides (Terminée / Absent / Annulée) */
export function ToCloseBanner({ sessions, clientName, coachName }: { sessions: Session[]; clientName: (id: string) => string; coachName?: (id: string) => string | null }) {
  if (!sessions.length) return null;
  return (
    <Card className="mb-4 overflow-hidden border-amber-300">
      <div className="flex flex-wrap items-center justify-between gap-2 bg-amber-50 px-4 py-2.5">
        <p className="flex items-center gap-2 font-display font-bold text-amber-900">
          <AlarmClock className="size-4" /> À clôturer
          <span className="rounded-full bg-amber-500 px-2 py-0.5 text-xs text-white">{sessions.length}</span>
        </p>
        <p className="text-xs text-amber-800">Séances passées jamais démarrées ou jamais terminées : indique ce qui s&apos;est passé.</p>
      </div>
      <ul className="divide-y divide-line">
        {sessions.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
            <Link href={`/seances/${s.id}`} className="min-w-0 flex-1 text-sm hover:text-brand-600">
              <b className="block truncate">{clientName(s.client_id)}</b>
              <span className="text-xs text-muted">
                {fmtDate(s.starts_at, { weekday: "short", day: "numeric", month: "short" })} · {fmtTime(s.starts_at)} · {s.duration_min} min · {s.type}
                {coachName?.(s.coach_id) ? ` · ${coachName(s.coach_id)}` : ""}
              </span>
            </Link>
            <Badge tone={SESSION_BADGE[s.status]}>{SESSION_LABEL[s.status]}</Badge>
            <CloseActions s={s} compact />
          </li>
        ))}
      </ul>
    </Card>
  );
}
