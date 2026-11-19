import { Clock3, LogIn, LogOut, ShieldCheck } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ESPACE_LABEL, espaceOf } from "@/lib/espace";
import { todayAgadir } from "@/lib/planning";
import type { CoachPointage, Session } from "@/lib/types";
import { agadirToIso, fmtDate, fmtTime } from "@/lib/utils";
import { Badge, Card, PageHeader } from "@/components/ui";
import { PointageForm } from "@/components/controle/pointage-form";

export const metadata = { title: "Pointage" };

/** Pointage d'arrivée / de départ avec le code de la borne de l'accueil */
export default async function PointagePage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const [me, { c }] = await Promise.all([requireStaff(), searchParams]);
  const supabase = await createClient();
  const dayStart = agadirToIso(todayAgadir(), "00:00");
  const dayEnd = new Date(new Date(dayStart).getTime() + 86400000).toISOString();
  const [{ data: pData }, { data: sData }] = await Promise.all([
    supabase.from("coach_pointages").select("*").eq("coach_id", me.id).gte("at", dayStart).order("at"),
    supabase.from("sessions").select("id, starts_at, duration_min, status, type").eq("coach_id", me.id).gte("starts_at", dayStart).lt("starts_at", dayEnd).order("starts_at"),
  ]);
  const today = (pData ?? []) as CoachPointage[];
  const sessions = ((sData ?? []) as Pick<Session, "id" | "starts_at" | "duration_min" | "status" | "type">[]).filter((s) => s.status !== "annulee" && s.status !== "refusee");
  const last = today.at(-1);
  const nextKind = last?.kind === "arrivee" ? "depart" : "arrivee";
  const scanned = c && /^\d{6}$/.test(c) ? c : undefined;
  const espace = espaceOf(me);

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader
        title="Pointage"
        subtitle={`${fmtDate(new Date(), { weekday: "long", day: "numeric", month: "long" })} · ${ESPACE_LABEL[espace]}`}
      />

      <PointageForm nextKind={nextKind} scanned={scanned} />

      <Card className="mt-5 p-5">
        <h2 className="flex items-center gap-2 font-display text-base font-bold text-ink">
          <Clock3 className="size-4 text-brand-600" /> Aujourd&apos;hui
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl bg-canvas p-3">
            <p className="text-xs text-muted">1re séance</p>
            <p className="mt-0.5 text-lg font-bold text-ink">{sessions[0] ? fmtTime(sessions[0].starts_at) : "—"}</p>
            <p className="text-xs text-muted">{sessions.length} séance{sessions.length > 1 ? "s" : ""} prévue{sessions.length > 1 ? "s" : ""}</p>
          </div>
          <div className="rounded-xl bg-canvas p-3">
            <p className="text-xs text-muted">Statut</p>
            <p className="mt-0.5 text-lg font-bold text-ink">{!last ? "Pas pointé(e)" : last.kind === "arrivee" ? "Présent(e)" : "Parti(e)"}</p>
            <p className="text-xs text-muted">{last ? `depuis ${fmtTime(last.at)}` : "Pointez en arrivant"}</p>
          </div>
        </div>
        {today.length > 0 && (
          <ul className="mt-4 divide-y divide-line border-t border-line">
            {today.map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-2.5 text-sm">
                {p.kind === "arrivee" ? <LogIn className="size-4 text-emerald-600" /> : <LogOut className="size-4 text-slate-500" />}
                <span className="font-semibold text-ink">{p.kind === "arrivee" ? "Arrivée" : "Départ"}</span>
                <span className="tabular-nums text-muted">{fmtTime(p.at)}</span>
                <span className="ms-auto">
                  <Badge tone={p.espace === "lady" ? "accent" : "brand"}>{ESPACE_LABEL[p.espace]}</Badge>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <p className="mt-5 flex items-start gap-2 text-xs text-muted">
        <ShieldCheck className="mt-0.5 size-4 shrink-0" />
        Le code de l&apos;écran de l&apos;accueil change toutes les 30 secondes : le pointage prouve votre présence dans la salle. Pointez en arrivant et en partant.
      </p>
    </div>
  );
}
