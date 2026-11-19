/** Tableau « Santé connectée » (coach et adhérent) : sommeil, pas, FC au repos, alertes. */
import Link from "next/link";
import { AlertTriangle, Flame, Footprints, HeartPulse, Moon, Scale, Trash2, Watch, Wind } from "lucide-react";
import { Badge, Card, CardHeader, Kpi } from "@/components/ui";
import { ConfirmButton } from "@/components/confirm-button";
import { cn, fmtDate, num, signed } from "@/lib/utils";
import { shiftDay } from "@/lib/health/aggregate";
import { healthAlerts, lastDays, latest, mean, rolling, series, sleepRegularity, toDaily, valuesIn, type Daily, type DayValue } from "@/lib/health/stats";
import { HEALTH_SOURCES, SOURCE_LABEL, fmtSleep, type HealthSample, type HealthSource } from "@/lib/health/types";
import { deleteHealthSourceAction } from "@/actions/health-data";
import { DayBars, StackBar, TrendLine } from "./charts";

export const PERIODS = [7, 30, 90] as const;
export type Period = (typeof PERIODS)[number];
export const parsePeriod = (v: string | undefined): Period => (v === "7" ? 7 : v === "90" ? 90 : 30);
/** Jours à charger : la période affichée + 5 semaines pour la ligne de base des alertes. */
export const daysToLoad = (p: Period) => Math.max(p, 35);

const STEP_GOAL = 8000;
const dayLabel = (d: string) => fmtDate(`${d}T12:00:00Z`, { day: "numeric", month: "short" });

export function PeriodSwitch({ basePath, period }: { basePath: string; period: Period }) {
  return (
    <div className="inline-flex rounded-xl border border-line bg-white p-1" role="tablist" aria-label="Période">
      {PERIODS.map((p) => (
        <Link
          key={p}
          href={`${basePath}?p=${p}`}
          scroll={false}
          role="tab"
          aria-selected={p === period}
          className={cn("rounded-lg px-3 py-1.5 text-sm font-semibold transition", p === period ? "bg-brand-500 text-white" : "text-muted hover:text-ink")}
        >
          {p} j
        </Link>
      ))}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-0.5 font-display text-lg font-bold tabular-nums text-ink">{value}</p>
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function HealthAlerts({ daily, today }: { daily: Daily; today: string }) {
  const alerts = healthAlerts(daily, today);
  if (!alerts.length) return null;
  return (
    <div className="mb-5 grid gap-3 md:grid-cols-2">
      {alerts.map((a) => (
        <div key={a.key} role="alert" className={cn("flex gap-3 rounded-2xl border p-4", a.tone === "red" ? "border-red-200 bg-red-50 text-red-800" : "border-amber-200 bg-amber-50 text-amber-900")}>
          <AlertTriangle className="mt-0.5 size-5 shrink-0" />
          <div>
            <p className="font-semibold">{a.title}</p>
            <p className="mt-0.5 text-sm opacity-90">{a.text}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function HealthDashboard({ samples, period, today }: { samples: HealthSample[]; period: Period; today: string }) {
  const daily = toDaily(samples);
  const days = lastDays(period, today);
  const from = days[0]!;
  const nights = valuesIn(daily.sleep, from, today);
  const steps = valuesIn(daily.steps, from, shiftDay(today, -1)).filter((v) => v.value > 0);
  const stepsAll = valuesIn(daily.steps, from, today);
  const rhr = valuesIn(daily.hr_resting, from, today);
  const rhrBase = valuesIn(daily.hr_resting, shiftDay(today, -34), shiftDay(today, -7)).map((v) => v.value);
  const rhrWeek = valuesIn(daily.hr_resting, shiftDay(today, -6), today).map((v) => v.value);
  const vo2 = latest(daily.vo2max);
  const weight = latest(daily.weight);
  const weightFirst = valuesIn(daily.weight, from, today)[0];

  const sleepAvg = mean(nights.map((n) => n.value));
  const stepsAvg = mean(steps.map((s) => s.value));
  const rhrLast = latest(daily.hr_resting);
  const rhrDelta = rhrWeek.length && rhrBase.length ? mean(rhrWeek)! - mean(rhrBase)! : null;
  const kcalAvg = mean(valuesIn(daily.active_kcal, from, shiftDay(today, -1)).map((v) => v.value));
  const hrAvg = mean(valuesIn(daily.hr_avg, from, today).map((v) => v.value));

  return (
    <div className="space-y-5">
      <HealthAlerts daily={daily} today={today} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 [&>*]:min-w-0">
        <Kpi label="Sommeil moyen" value={fmtSleep(sleepAvg)} delta={`${nights.length} nuit${nights.length > 1 ? "s" : ""} sur ${period} j`} icon={<Moon className="size-5" />} />
        <Kpi label="Pas par jour" value={stepsAvg === null ? "–" : num(Math.round(stepsAvg))} delta={`Objectif ${num(STEP_GOAL)}`} positive={stepsAvg === null ? undefined : stepsAvg >= STEP_GOAL} tone="accent" icon={<Footprints className="size-5" />} />
        <Kpi
          label="FC au repos"
          value={rhrLast ? `${Math.round(rhrLast.value)} bpm` : "–"}
          delta={rhrDelta === null ? "Tendance : pas assez de données" : `${signed(Math.round(rhrDelta), "bpm")} vs 4 semaines`}
          positive={rhrDelta === null || Math.abs(rhrDelta) < 2 ? undefined : rhrDelta < 0}
          icon={<HeartPulse className="size-5" />}
        />
        {vo2 ? (
          <Kpi label="VO2max" value={num(vo2.value)} delta={`mL/kg/min · ${dayLabel(vo2.day)}`} tone="accent" icon={<Wind className="size-5" />} />
        ) : (
          <Kpi label="Calories actives" value={kcalAvg === null ? "–" : num(Math.round(kcalAvg))} delta="kcal par jour" tone="accent" icon={<Flame className="size-5" />} />
        )}
      </div>

      <div className="grid gap-5 xl:grid-cols-2 [&>*]:min-w-0">
        <SleepCard days={days} daily={daily} nights={nights} sleepAvg={sleepAvg} />
        <Card>
          <CardHeader title="Pas" subtitle={`Par jour · objectif ${num(STEP_GOAL)}`} icon={<Footprints className="size-4" />} />
          <div className="px-5 pb-5">
            {stepsAll.length ? (
              <>
                <DayBars
                  label="Pas par jour"
                  days={days}
                  values={series(daily.steps, days).map((v) => v?.value ?? null)}
                  max={Math.max(STEP_GOAL * 1.5, ...stepsAll.map((s) => s.value))}
                  goal={STEP_GOAL}
                  goalLabel={num(STEP_GOAL)}
                  barClass={(v) => (v >= STEP_GOAL ? "bg-accent-500" : "bg-accent-200")}
                  format={(v) => `${num(v)} pas`}
                />
                <div className="mt-4 grid grid-cols-3 gap-3 border-t border-line pt-4">
                  <Stat label="Moyenne" value={stepsAvg === null ? "–" : num(Math.round(stepsAvg))} />
                  <Stat label="Meilleur jour" value={num(Math.max(...steps.map((s) => s.value), 0))} />
                  <Stat label={`Jours ≥ ${num(STEP_GOAL)}`} value={`${steps.filter((s) => s.value >= STEP_GOAL).length}/${steps.length}`} />
                </div>
              </>
            ) : (
              <NoData />
            )}
          </div>
        </Card>
        <Card>
          <CardHeader title="Fréquence cardiaque au repos" subtitle="Valeur du jour et moyenne sur 7 jours" icon={<HeartPulse className="size-4" />} />
          <div className="px-5 pb-5">
            {rhr.length ? (
              <>
                <TrendLine
                  label="FC au repos"
                  unit="bpm"
                  days={days}
                  values={series(daily.hr_resting, days).map((v) => v?.value ?? null)}
                  smooth={rolling(
                    series(daily.hr_resting, days).map((v) => v?.value ?? null),
                    7,
                  )}
                />
                <div className="mt-4 grid grid-cols-3 gap-3 border-t border-line pt-4">
                  <Stat label="Dernière" value={rhrLast ? `${Math.round(rhrLast.value)} bpm` : "–"} hint={rhrLast ? dayLabel(rhrLast.day) : undefined} />
                  <Stat label="Moyenne" value={`${Math.round(mean(rhr.map((r) => r.value))!)} bpm`} />
                  <Stat
                    label="Tendance"
                    value={rhrDelta === null ? "–" : signed(Math.round(rhrDelta), "bpm")}
                    hint={rhrDelta === null ? "il faut 5 semaines" : rhrDelta >= 5 ? "en hausse : fatigue ?" : rhrDelta <= -2 ? "en baisse : bonne forme" : "stable"}
                  />
                </div>
              </>
            ) : (
              <NoData />
            )}
          </div>
        </Card>
        <Card>
          <CardHeader title="Autres mesures" subtitle={`Sur ${period} jours`} icon={<Watch className="size-4" />} />
          <div className="grid grid-cols-2 gap-4 px-5 pb-5 sm:grid-cols-4 xl:grid-cols-2 2xl:grid-cols-4">
            <Stat label="FC moyenne" value={hrAvg === null ? "–" : `${Math.round(hrAvg)} bpm`} hint="sur la journée" />
            <Stat label="Calories actives" value={kcalAvg === null ? "–" : num(Math.round(kcalAvg))} hint="kcal / jour" />
            <Stat label="VO2max" value={vo2 ? num(vo2.value) : "–"} hint={vo2 ? `mL/kg/min · ${dayLabel(vo2.day)}` : "montre requise"} />
            <Stat
              label="Poids"
              value={weight ? `${num(weight.value)} kg` : "–"}
              hint={weight ? (weightFirst && weightFirst.day !== weight.day ? `${signed(Math.round((weight.value - weightFirst.value) * 10) / 10, "kg")} sur la période` : dayLabel(weight.day)) : "balance connectée"}
            />
          </div>
          <p className="flex items-center gap-1.5 border-t border-line px-5 py-3 text-xs text-muted">
            <Scale className="size-3.5" /> Les mesures du coach (poids, tours) restent dans l&apos;onglet Progression.
          </p>
        </Card>
      </div>
    </div>
  );
}

function SleepCard({ days, daily, nights, sleepAvg }: { days: string[]; daily: Daily; nights: DayValue[]; sleepAvg: number | null }) {
  const reg = sleepRegularity(nights);
  const withPhases = nights.filter((n) => n.details && (n.details.deep ?? 0) + (n.details.rem ?? 0) > 0);
  const phase = (k: "deep" | "light" | "rem" | "awake") => mean(withPhases.map((n) => n.details?.[k] ?? 0)) ?? 0;
  const short = nights.filter((n) => n.value < 360).length;
  return (
    <Card>
      <CardHeader title="Sommeil" subtitle="Durée par nuit (jour du réveil) · objectif 7 h" icon={<Moon className="size-4" />} />
      <div className="px-5 pb-5">
        {nights.length ? (
          <>
            <DayBars
              label="Sommeil par nuit"
              days={days}
              values={series(daily.sleep, days).map((v) => v?.value ?? null)}
              max={Math.max(600, ...nights.map((n) => n.value))}
              goal={420}
              goalLabel="7 h"
              barClass={(v) => (v < 360 ? "bg-red-400" : v < 420 ? "bg-amber-400" : "bg-brand-500")}
              format={(v) => fmtSleep(v)}
            />
            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-4 sm:grid-cols-3">
              <Stat label="Moyenne" value={fmtSleep(sleepAvg)} />
              <Stat label="Nuits < 6 h" value={`${short}/${nights.length}`} />
              <div className="col-span-2 min-w-0 sm:col-span-1">
                <p className="text-xs text-muted">Régularité</p>
                <div className="mt-1">
                  <Badge tone={reg.tone}>{reg.label}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted">{reg.detail}</p>
              </div>
            </div>
            {withPhases.length > 0 && (
              <div className="mt-4">
                <p className="mb-2 text-xs font-semibold text-slate-600">Phases moyennes ({withPhases.length} nuits avec détail)</p>
                <StackBar
                  parts={[
                    { label: "Profond", value: phase("deep"), className: "bg-brand-700" },
                    { label: "Léger", value: phase("light"), className: "bg-brand-300" },
                    { label: "Paradoxal", value: phase("rem"), className: "bg-accent-400" },
                    { label: "Éveillé", value: phase("awake"), className: "bg-slate-300" },
                  ]}
                />
              </div>
            )}
          </>
        ) : (
          <NoData />
        )}
      </div>
    </Card>
  );
}

function NoData() {
  return <p className="rounded-xl bg-canvas px-4 py-8 text-center text-sm text-muted">Aucune donnée sur cette période.</p>;
}

/** Sources reçues, date de dernière synchro et suppression par source. */
export function SourcesCard({ samples, syncs, clientId, back, canDelete }: { samples: HealthSample[]; syncs: Partial<Record<HealthSource, string>>; clientId: string; back: string; canDelete: boolean }) {
  const counts = new Map<HealthSource, Set<string>>();
  for (const s of samples) {
    if (!counts.has(s.source)) counts.set(s.source, new Set());
    counts.get(s.source)!.add(s.day);
  }
  const list = HEALTH_SOURCES.filter((s) => syncs[s] || counts.has(s));
  return (
    <Card>
      <CardHeader title="Sources des données" subtitle="Une valeur par jour : la saisie manuelle passe avant la montre" icon={<Watch className="size-4" />} />
      {list.length ? (
        <ul className="divide-y divide-line border-t border-line">
          {list.map((s) => (
            <li key={s} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink">{SOURCE_LABEL[s]}</p>
                <p className="text-xs text-muted">
                  {counts.get(s)?.size ?? 0} jour(s) récents
                  {syncs[s] && <> · dernier envoi le {fmtDate(syncs[s]!, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</>}
                </p>
              </div>
              {canDelete && (
                <form action={deleteHealthSourceAction}>
                  <input type="hidden" name="client_id" value={clientId} />
                  <input type="hidden" name="source" value={s} />
                  <input type="hidden" name="back" value={back} />
                  <ConfirmButton message={`Effacer toutes les données « ${SOURCE_LABEL[s]} » ? Elles pourront être réimportées.`} className="h-8 px-3 text-xs">
                    <Trash2 className="size-3.5" /> Effacer
                  </ConfirmButton>
                </form>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-5 pb-5 text-sm text-muted">Aucune donnée reçue pour l&apos;instant.</p>
      )}
    </Card>
  );
}
