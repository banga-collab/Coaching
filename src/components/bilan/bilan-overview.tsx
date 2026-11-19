import Link from "next/link";
import { ClipboardCheck, Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { RiskLevel, SportAssessment } from "@/lib/types-bilan";
import { cn, fmtDate } from "@/lib/utils";
import { Avatar, Card, CardHeader } from "@/components/ui";
import { RiskBadge } from "./bilan-view";

const ORDER: Record<RiskLevel, number> = { rouge: 0, orange: 1, vert: 2 };

/** Vue d'ensemble des bilans sportifs (page Évaluations) : répartition des risques, à valider, sans bilan. */
export async function BilanOverview() {
  const supabase = await createClient();
  const [{ data: bData, error }, { data: cData }] = await Promise.all([
    supabase.from("sport_assessments").select("id, client_id, done_on, status, risk_level, risk_flags, created_at").order("done_on", { ascending: false }).limit(1000),
    supabase.from("clients").select("id, full_name, status"),
  ]);
  if (error) return null; // migration v5-bilan.sql non appliquée
  const clients = (cData ?? []) as { id: string; full_name: string; status: string }[];
  const latest = new Map<string, Pick<SportAssessment, "id" | "client_id" | "done_on" | "status" | "risk_level" | "risk_flags">>();
  for (const b of (bData ?? []) as SportAssessment[]) if (!latest.has(b.client_id)) latest.set(b.client_id, b);
  const names = new Map(clients.map((c) => [c.id, c.full_name]));
  const rows = [...latest.values()].filter((b) => names.has(b.client_id));
  const count = (l: RiskLevel) => rows.filter((b) => b.risk_level === l).length;
  const pending = rows.filter((b) => b.status === "a_valider").length;
  const missing = clients.filter((c) => c.status === "actif" && !latest.has(c.id));
  const watch = rows
    .filter((b) => b.risk_level !== "vert" || b.status === "a_valider")
    .sort((a, b) => ORDER[a.risk_level] - ORDER[b.risk_level] || b.done_on.localeCompare(a.done_on))
    .slice(0, 6);

  const tiles: [string, number, string][] = [
    ["Rouge", count("rouge"), "text-red-600"],
    ["Orange", count("orange"), "text-accent-500"],
    ["Vert", count("vert"), "text-emerald-600"],
    ["À valider", pending, "text-amber-600"],
  ];

  return (
    <Card className="mb-6 overflow-hidden animate-fade-up">
      <CardHeader
        title="Bilans sportifs & médicaux"
        subtitle="Dernier bilan de chaque client : niveau de risque calculé (PAR-Q, antécédents, tabac…)"
        icon={<ClipboardCheck className="size-4" />}
      />
      <div className="grid grid-cols-2 gap-3 px-5 sm:grid-cols-4">
        {tiles.map(([label, n, cls]) => (
          <div key={label} className="rounded-xl border border-line bg-canvas/50 px-4 py-3">
            <p className="text-xs font-medium text-muted">{label}</p>
            <p className={cn("font-display text-2xl font-extrabold", cls)}>{n}</p>
          </div>
        ))}
      </div>
      {watch.length > 0 && (
        <ul className="mt-4 divide-y divide-line border-t border-line">
          {watch.map((b) => {
            const name = names.get(b.client_id) ?? "Client";
            return (
              <li key={b.id}>
                <Link href={`/clients/${b.client_id}/bilan-sportif`} className="flex items-center gap-3 px-5 py-2.5 transition hover:bg-canvas/60">
                  <Avatar name={name} size={32} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{name}</p>
                    <p className="truncate text-xs text-muted">{(b.risk_flags ?? []).slice(0, 2).join(" · ") || fmtDate(b.done_on)}</p>
                  </div>
                  {b.status === "a_valider" && <Clock className="size-4 text-amber-500" aria-label="À valider" />}
                  <RiskBadge level={b.risk_level} size="sm" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {missing.length > 0 && (
        <div className="border-t border-line px-5 py-3 text-sm text-muted">
          <span className="font-semibold text-ink">Sans bilan sportif : </span>
          {missing.slice(0, 6).map((c, i) => (
            <span key={c.id}>
              {i > 0 && ", "}
              <Link href={`/clients/${c.id}/bilan-sportif/nouveau`} className="font-medium text-brand-600 hover:underline">
                {c.full_name}
              </Link>
            </span>
          ))}
          {missing.length > 6 && ` et ${missing.length - 6} autre(s)`}
        </div>
      )}
      {watch.length === 0 && missing.length === 0 && <div className="pb-5" />}
    </Card>
  );
}
