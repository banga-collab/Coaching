import { Activity, Clock, Dumbbell, Gauge, Smartphone, TrendingUp, Trophy, Weight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { WorkoutLog } from "@/lib/types";
import { fmtDate } from "@/lib/utils";
import { normName } from "@/lib/video";
import { Card, CardHeader, Empty, Kpi } from "@/components/ui";
import { TrendChart, ACCENT, BRAND } from "@/components/charts";
import { WorkoutLogList } from "@/components/workout/workout-history";
import { detectPRs, fmtDuration, fmtKg, logStats } from "@/components/workout/utils";

/** Vue coach : séances suivies en direct par l'adhérent depuis son téléphone. */
export async function WorkoutsTab({ clientId, canEdit }: { clientId: string; canEdit: boolean }) {
  void canEdit;
  const supabase = await createClient();
  const { data } = await supabase.from("workout_logs").select("*").eq("client_id", clientId).order("started_at", { ascending: false }).limit(200);
  const logs = ((data ?? []) as WorkoutLog[]).map((l) => ({ ...l, entries: Array.isArray(l.entries) ? l.entries : [] }));

  if (!logs.length) {
    return (
      <Card>
        <Empty
          icon={<Smartphone className="size-6" />}
          title="Aucune séance suivie pour l'instant"
          text="Quand l'adhérent lance une séance depuis son espace (« Ma séance »), ses séries, charges et ressentis apparaissent ici automatiquement."
        />
      </Card>
    );
  }

  const asc = [...logs].reverse();
  const { prs, best } = detectPRs(asc);
  const stats = asc.map((l) => ({ l, st: logStats(l) }));
  const chart = stats.slice(-20).map(({ l, st }) => ({
    label: fmtDate(l.started_at, { day: "numeric", month: "short" }),
    volume: st.volume,
    rpe: l.rpe,
  }));
  const durations = stats.map((s) => s.st.durationMin).filter((d): d is number => d !== null);
  const avgDuration = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null;
  const rpes = logs.map((l) => l.rpe).filter((r): r is number => r !== null);
  const avgRpe = rpes.length ? Math.round((rpes.reduce((a, b) => a + b, 0) / rpes.length) * 10) / 10 : null;
  const last30 = logs.filter((l) => Date.now() - new Date(l.started_at).getTime() < 30 * 86400000).length;
  const allPrs = asc.flatMap((l) => (prs.get(l.id) ?? []).map((p) => ({ ...p, date: l.started_at }))).reverse();
  const topLifts = [...best.entries()]
    .map(([k, v]) => ({ name: asc.flatMap((l) => l.entries).find((e) => normName(e.exercise) === k)?.exercise ?? k, load: v }))
    .sort((a, b) => b.load - a.load)
    .slice(0, 5);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Kpi label="Séances suivies" value={logs.length} icon={<Activity className="size-5" />} delta={`${last30} sur 30 jours`} />
        <Kpi label="Durée moyenne" value={fmtDuration(avgDuration)} tone="accent" icon={<Clock className="size-5" />} />
        <Kpi label="RPE moyen" value={avgRpe !== null ? `${String(avgRpe).replace(".", ",")}/10` : "–"} icon={<Gauge className="size-5" />} />
        <Kpi label="Records battus" value={allPrs.length} tone="accent" icon={<Trophy className="size-5" />} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <Card>
          <CardHeader title="Volume par séance" subtitle="Charge totale soulevée (reps × kg) et effort ressenti" icon={<TrendingUp className="size-4" />} />
          <div className="px-2 pb-4 sm:px-4">
            <TrendChart
              data={chart}
              height={240}
              series={[
                { key: "volume", label: "Volume", color: BRAND, unit: "kg" },
                { key: "rpe", label: "RPE", color: ACCENT, right: true, dashed: true },
              ]}
            />
          </div>
        </Card>
        <Card>
          <CardHeader title="Records" subtitle="Meilleures charges et derniers records" icon={<Trophy className="size-4" />} />
          <div className="px-5 pb-5">
            <ul className="space-y-2">
              {topLifts.map((t) => (
                <li key={t.name} className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2">
                  <Dumbbell className="size-4 shrink-0 text-brand-500" />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{t.name}</span>
                  <span className="shrink-0 font-display text-sm font-extrabold text-brand-600">{fmtKg(t.load)}</span>
                </li>
              ))}
              {!topLifts.length && <li className="text-sm text-muted">Pas encore de charge enregistrée.</li>}
            </ul>
            {allPrs.length > 0 && (
              <>
                <p className="mb-2 mt-4 text-[11px] font-bold uppercase tracking-wider text-slate-500">Derniers records</p>
                <ul className="space-y-2">
                  {allPrs.slice(0, 4).map((p, i) => (
                    <li key={i} className="flex items-center gap-3 rounded-xl border border-accent-100 bg-accent-50/60 px-3 py-2">
                      <Trophy className="size-4 shrink-0 text-accent-500" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-ink">{p.exercise}</span>
                        <span className="block text-[11px] text-muted">{fmtDate(p.date, { day: "numeric", month: "short" })} · avant {fmtKg(p.previous)}</span>
                      </span>
                      <span className="shrink-0 font-display text-sm font-extrabold text-accent-600">{fmtKg(p.load)}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <CardHeader
          title="Historique des séances"
          subtitle="Saisies par l'adhérent pendant sa séance · touche une ligne pour le détail"
          icon={<Weight className="size-4" />}
        />
        <WorkoutLogList logs={logs} />
      </Card>
    </div>
  );
}
