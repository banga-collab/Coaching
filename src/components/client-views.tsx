import Link from "next/link";
import { Activity, Dumbbell, HeartPulse, Ruler, Scale, Stethoscope, Trash2 } from "lucide-react";
import type { HealthCheck, Measurement, Session } from "@/lib/types";
import { healthAlerts } from "@/lib/insights";
import { SESSION_LABEL, cn, fmtDate, fmtTime, num, signed } from "@/lib/utils";
import { BUSY_STATUSES, isForgotten, memberSessionLabel, plannedEnd, visibleToMember } from "@/lib/planning";
import { fmtDh } from "@/lib/session-extras";
import { Badge, Card, CardHeader, Empty, Kpi, LinkButton } from "./ui";
import { ACCENT, BRAND, GRAY, TrendChart } from "./charts";
import { deleteMeasurementAction } from "@/app/(app)/actions";

const short = (d: string) => fmtDate(d, { day: "numeric", month: "short" });

function series<T>(rows: T[], get: (r: T) => number | null | undefined) {
  const vals = rows.map(get).filter((v): v is number => v !== null && v !== undefined).map(Number);
  return { first: vals[0], last: vals.at(-1), delta: vals.length > 1 ? vals.at(-1)! - vals[0]! : null };
}

/* ======================= Progression ======================= */
export function ProgressView({ rows, clientId, canEdit, lossGoal = true }: { rows: Measurement[]; clientId: string; canEdit: boolean; lossGoal?: boolean }) {
  if (!rows.length) {
    return (
      <Card>
        <Empty
          icon={<Scale className="size-6" />}
          title="Aucune mesure"
          text="Ajoute une première mesure (poids, masse grasse, tours, force) pour suivre la progression."
          action={canEdit ? <LinkButton href={`/clients/${clientId}/mesure`}>Ajouter une mesure</LinkButton> : undefined}
        />
      </Card>
    );
  }
  const w = series(rows, (r) => r.weight_kg);
  const f = series(rows, (r) => r.body_fat);
  const sq = series(rows, (r) => r.squat_kg);
  const wa = series(rows, (r) => r.waist_cm);
  const good = (d: number | null, lowerIsBetter: boolean) => (d === null || d === 0 ? undefined : lowerIsBetter ? d < 0 : d > 0);

  const data = rows.map((r) => ({
    label: short(r.measured_on),
    weight: r.weight_kg,
    fat: r.body_fat,
    squat: r.squat_kg,
    bench: r.bench_kg,
    deadlift: r.deadlift_kg,
    waist: r.waist_cm,
    hips: r.hips_cm,
    arm: r.arm_cm,
  }));
  const hasStrength = rows.some((r) => r.squat_kg || r.bench_kg || r.deadlift_kg);
  const hasTours = rows.some((r) => r.waist_cm || r.hips_cm || r.arm_cm);

  const cols: [keyof Measurement, string][] = [
    ["weight_kg", "Poids"],
    ["body_fat", "MG %"],
    ["muscle_kg", "Muscle"],
    ["waist_cm", "Taille"],
    ["hips_cm", "Hanches"],
    ["chest_cm", "Poitrine"],
    ["arm_cm", "Bras"],
    ["thigh_cm", "Cuisse"],
    ["squat_kg", "Squat"],
    ["bench_kg", "DC"],
    ["deadlift_kg", "SDT"],
  ];
  const usedCols = cols.filter(([k]) => rows.some((r) => r[k] !== null));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Kpi label="Poids" value={num(w.last, "kg")} delta={w.delta !== null ? `${signed(w.delta, "kg")} depuis le début` : "1 mesure"} positive={good(w.delta, lossGoal)} icon={<Scale className="size-[18px]" />} />
        <Kpi tone="accent" label="Masse grasse" value={f.last !== undefined ? `${num(f.last)} %` : "–"} delta={f.delta !== null ? `${signed(f.delta, "pts")}` : undefined} positive={good(f.delta, true)} icon={<Activity className="size-[18px]" />} />
        <Kpi label="Squat (1RM)" value={num(sq.last, "kg")} delta={sq.delta !== null ? signed(sq.delta, "kg") : undefined} positive={good(sq.delta, false)} icon={<Dumbbell className="size-[18px]" />} />
        <Kpi tone="accent" label="Tour de taille" value={num(wa.last, "cm")} delta={wa.delta !== null ? signed(wa.delta, "cm") : undefined} positive={good(wa.delta, true)} icon={<Ruler className="size-[18px]" />} />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader title="Poids & masse grasse" icon={<Scale className="size-4" />} />
          <div className="px-3 pb-4">
            <TrendChart
              data={data}
              series={[
                { key: "weight", label: "Poids", unit: "kg", color: BRAND },
                { key: "fat", label: "Masse grasse", unit: "%", color: ACCENT, right: true },
              ]}
            />
          </div>
        </Card>
        {hasStrength ? (
          <Card>
            <CardHeader title="Force (1RM estimé)" icon={<Dumbbell className="size-4" />} />
            <div className="px-3 pb-4">
              <TrendChart
                data={data}
                series={[
                  { key: "squat", label: "Squat", unit: "kg", color: BRAND },
                  { key: "bench", label: "Développé couché", unit: "kg", color: ACCENT },
                  { key: "deadlift", label: "Soulevé de terre", unit: "kg", color: GRAY, dashed: true },
                ]}
              />
            </div>
          </Card>
        ) : hasTours ? (
          <Card>
            <CardHeader title="Mensurations" icon={<Ruler className="size-4" />} />
            <div className="px-3 pb-4">
              <TrendChart
                data={data}
                series={[
                  { key: "waist", label: "Taille", unit: "cm", color: BRAND },
                  { key: "hips", label: "Hanches", unit: "cm", color: ACCENT },
                ]}
              />
            </div>
          </Card>
        ) : null}
      </div>

      <Card className="overflow-hidden">
        <CardHeader title="Historique des mesures" subtitle={`${rows.length} relevé${rows.length > 1 ? "s" : ""}`} icon={<Ruler className="size-4" />} />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-y border-line bg-slate-50/60 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="px-5 py-2.5">Date</th>
                {usedCols.map(([, l]) => (
                  <th key={l} className="px-3 py-2.5 text-right">
                    {l}
                  </th>
                ))}
                {canEdit && <th className="no-print w-10" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {[...rows].reverse().map((r) => (
                <tr key={r.id} className="group hover:bg-canvas/60">
                  <td className="px-5 py-2.5 font-medium whitespace-nowrap">{fmtDate(r.measured_on)}</td>
                  {usedCols.map(([k]) => (
                    <td key={k} className="px-3 py-2.5 text-right tabular-nums text-slate-700">
                      {num(r[k] as number | null)}
                    </td>
                  ))}
                  {canEdit && (
                    <td className="no-print pr-3">
                      <form action={deleteMeasurementAction}>
                        <input type="hidden" name="id" value={r.id} />
                        <input type="hidden" name="client_id" value={clientId} />
                        <button className="grid size-8 place-items-center rounded-lg text-slate-300 opacity-0 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100" aria-label="Supprimer">
                          <Trash2 className="size-4" />
                        </button>
                      </form>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ======================= Santé ======================= */
function ScoreBar({ label, value, invert }: { label: string; value: number | null; invert?: boolean }) {
  if (value === null) return null;
  const bad = invert ? value >= 7 : value <= 4;
  const mid = invert ? value >= 5 : value <= 6;
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="w-28 shrink-0 text-sm text-muted">{label}</span>
      <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
        <span className={cn("block h-full rounded-full transition-all", bad ? "bg-red-500" : mid ? "bg-accent-400" : "bg-brand-500")} style={{ width: `${value * 10}%` }} />
      </span>
      <b className="w-10 text-right text-sm tabular-nums">{value}/10</b>
    </div>
  );
}

export function HealthView({ checks, heightCm, lastWeight, clientId, canEdit }: { checks: HealthCheck[]; heightCm: number | null; lastWeight: number | null; clientId: string; canEdit: boolean }) {
  if (!checks.length) {
    return (
      <Card>
        <Empty
          icon={<HeartPulse className="size-6" />}
          title="Aucun bilan de santé"
          text="Commence par un bilan initial : antécédents, blessures, tension, sommeil, stress…"
          action={canEdit ? <LinkButton href={`/clients/${clientId}/bilan?type=initial`}>Faire le bilan initial</LinkButton> : undefined}
        />
      </Card>
    );
  }
  const sorted = [...checks].sort((a, b) => a.checked_on.localeCompare(b.checked_on));
  const last = sorted.at(-1)!;
  const intake = [...sorted].reverse().find((c) => c.kind === "initial");
  const alerts = healthAlerts(last);
  const bmi = heightCm && lastWeight ? lastWeight / (heightCm / 100) ** 2 : null;
  const kindLabel = { initial: "Bilan initial", mensuel: "Bilan mensuel", hebdo: "Check-in" } as const;

  return (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader title="Dernier bilan" subtitle={`${kindLabel[last.kind]} · ${fmtDate(last.checked_on)}`} icon={<HeartPulse className="size-4" />} />
          <div className="px-5 pb-5">
            <div className="grid grid-cols-3 gap-3">
              {[
                ["Tension", last.systolic && last.diastolic ? `${last.systolic}/${last.diastolic}` : "–", last.systolic && last.systolic >= 140],
                ["FC repos", last.resting_hr ? `${last.resting_hr} bpm` : "–", false],
                ["IMC", bmi ? num(bmi) : "–", bmi !== null && (bmi >= 30 || bmi < 18.5)],
              ].map(([l, v, warn]) => (
                <div key={l as string} className={cn("rounded-xl p-3", warn ? "bg-red-50 ring-1 ring-red-100" : "bg-canvas")}>
                  <p className="text-xs text-muted">{l}</p>
                  <p className={cn("mt-0.5 font-display text-lg font-bold", warn ? "text-red-600" : "text-ink")}>{v}</p>
                </div>
              ))}
            </div>
            <div className="mt-4">
              <ScoreBar label="Sommeil" value={last.sleep} />
              <ScoreBar label="Énergie" value={last.energy} />
              <ScoreBar label="Stress" value={last.stress} invert />
              <ScoreBar label="Motivation" value={last.motivation} />
              <ScoreBar label="Alimentation" value={last.nutrition} />
              <ScoreBar label="Récupération" value={last.recovery} />
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-slate-600">Douleurs :</span>
              {last.pain_zones.length ? last.pain_zones.map((z) => <Badge key={z} tone="red">{z}</Badge>) : <Badge tone="green">Aucune</Badge>}
            </div>
            {alerts.length > 0 && (
              <div className="mt-4 rounded-xl bg-accent-50 p-3 text-sm text-accent-700 ring-1 ring-accent-100">
                <b>À surveiller :</b> {alerts.map((a) => a.text).join(" · ")}
              </div>
            )}
            {last.notes && <p className="mt-4 rounded-xl bg-canvas p-3 text-sm text-slate-700">“{last.notes}”</p>}
          </div>
        </Card>

        <Card>
          <CardHeader title="Dossier de santé" subtitle={intake ? `Bilan initial du ${fmtDate(intake.checked_on)}` : "Pas encore de bilan initial"} icon={<Stethoscope className="size-4" />} />
          <dl className="divide-y divide-line px-5 pb-3 text-sm">
            {[
              ["Antécédents / pathologies", intake?.conditions],
              ["Médicaments", intake?.medications],
              ["Blessures passées", intake?.injuries],
              ["Questionnaire PAR-Q", intake?.parq_positive === null || intake?.parq_positive === undefined ? null : intake.parq_positive ? "Au moins une réponse « oui » → avis médical conseillé" : "Toutes les réponses « non »"],
              ["Consentement données de santé", last.consent ? `Recueilli le ${fmtDate(last.checked_on)}` : null],
            ].map(([k, v]) => (
              <div key={k as string} className="py-3">
                <dt className="text-xs text-muted">{k}</dt>
                <dd className={cn("mt-0.5 font-medium", !v && "text-slate-400", typeof v === "string" && v.includes("avis médical") && "text-accent-700")}>{v || "Non renseigné"}</dd>
              </div>
            ))}
          </dl>
          {canEdit && !intake && (
            <div className="px-5 pb-5">
              <LinkButton href={`/clients/${clientId}/bilan?type=initial`} variant="secondary" className="w-full">
                Faire le bilan initial
              </LinkButton>
            </div>
          )}
        </Card>
      </div>

      {sorted.length > 1 && (
        <Card>
          <CardHeader title="Évolution du bien-être" subtitle={`${sorted.length} bilans`} icon={<Activity className="size-4" />} />
          <div className="px-3 pb-4">
            <TrendChart
              domain={[0, 10]}
              data={sorted.map((c) => ({ label: short(c.checked_on), sleep: c.sleep, energy: c.energy, stress: c.stress }))}
              series={[
                { key: "sleep", label: "Sommeil", color: BRAND },
                { key: "energy", label: "Énergie", color: ACCENT },
                { key: "stress", label: "Stress", color: GRAY, dashed: true },
              ]}
            />
          </div>
        </Card>
      )}

      <Card className="overflow-hidden">
        <CardHeader title="Tous les bilans" icon={<HeartPulse className="size-4" />} />
        <ul className="divide-y divide-line border-t border-line">
          {[...sorted].reverse().map((c) => {
            const a = healthAlerts(c);
            return (
              <li key={c.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                <span className="w-28 font-medium">{fmtDate(c.checked_on)}</span>
                <Badge tone={c.kind === "initial" ? "brand" : c.kind === "hebdo" ? "gray" : "accent"}>{kindLabel[c.kind]}</Badge>
                <span className="flex-1 text-muted">
                  {[c.sleep && `Sommeil ${c.sleep}`, c.energy && `Énergie ${c.energy}`, c.stress && `Stress ${c.stress}`].filter(Boolean).join(" · ")}
                </span>
                {a.length ? <Badge tone="red">{a.length} alerte{a.length > 1 ? "s" : ""}</Badge> : <Badge tone="green">RAS</Badge>}
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}

/* ======================= Séances ======================= */
/**
 * Séances d'un client. Côté staff (canEdit) : statut exact, prix indicatif par séance et « valeur » des séances réalisées
 * (information seulement : aucun paiement, aucun solde). Côté adhérent : libellés simples, sans prix ;
 * les séances refusées (en réaffectation interne) sont masquées et une séance passée jamais faite s'affiche « Non effectuée ».
 */
export function SessionsView({ sessions: all, clientId, canEdit }: { sessions: Session[]; clientId: string; canEdit: boolean }) {
  const now = Date.now();
  const sessions = canEdit ? all : all.filter(visibleToMember);
  // À venir : séances ouvertes dont la fin prévue n'est pas passée (une refusée reste visible côté staff, à réaffecter)
  const upcoming = sessions.filter((s) => plannedEnd(s) >= now && [...BUSY_STATUSES, "refusee"].includes(s.status)).reverse();
  const past = sessions.filter((s) => !upcoming.includes(s));
  const price = (s: Session) => (s.price_mad !== null && s.price_mad !== undefined ? Number(s.price_mad) : null);
  const doneList = past.filter((s) => s.status === "realisee");
  const value = doneList.reduce((t, s) => t + (price(s) ?? 0), 0);
  const done = past.filter((s) => s.status === "realisee").length;
  const counted = past.filter((s) => s.status === "realisee" || s.status === "absent").length;
  const rpes = past.filter((s) => s.rpe).map((s) => s.rpe!);

  const Row = ({ s }: { s: Session }) => {
    const inner = (
      <>
        <span className="w-14 text-center">
          <span className="block font-display text-lg font-bold leading-none text-brand-500">{fmtDate(s.starts_at, { day: "2-digit" })}</span>
          <span className="block text-[11px] font-semibold uppercase text-muted">{fmtDate(s.starts_at, { month: "short" })}</span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">
            {s.type}
            {canEdit && price(s) !== null ? <span className="font-normal text-muted"> · {fmtDh(price(s)!)}</span> : null}
          </span>
          <span className="block truncate text-xs text-muted">
            {fmtTime(s.starts_at)} · {s.duration_min} min{s.rpe ? ` · RPE ${s.rpe}` : ""}
            {s.notes ? ` · ${s.notes}` : ""}
          </span>
        </span>
        {canEdit ? (
          <Badge tone={isForgotten(s, now) ? "amber" : s.status === "realisee" ? "green" : s.status === "absent" || s.status === "refusee" ? "red" : s.status === "annulee" ? "gray" : s.status === "planifiee" || s.status === "reportee" ? "amber" : "brand"}>
            {isForgotten(s, now) ? `${SESSION_LABEL[s.status]} · à clôturer` : SESSION_LABEL[s.status]}
          </Badge>
        ) : (
          <Badge tone={memberTone(memberSessionLabel(s, now), s.status)}>{memberSessionLabel(s, now)}</Badge>
        )}
      </>
    );
    return canEdit ? (
      <Link href={`/seances/${s.id}`} className="flex items-center gap-4 px-5 py-3 transition hover:bg-canvas">
        {inner}
      </Link>
    ) : (
      <div className="flex items-center gap-4 px-5 py-3">{inner}</div>
    );
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-4">
        <Kpi label="Séances réalisées" value={done} delta={canEdit && value > 0 ? `valeur ${fmtDh(value)}` : undefined} />
        <Kpi tone="accent" label="Assiduité" value={counted ? `${Math.round((done / counted) * 100)}%` : "–"} />
        <Kpi label="RPE moyen" value={rpes.length ? num(rpes.reduce((a, b) => a + b, 0) / rpes.length) : "–"} />
      </div>
      <Card className="overflow-hidden">
        <CardHeader
          title="À venir"
          icon={<Activity className="size-4" />}
          action={canEdit ? <LinkButton href={`/seances/nouvelle?client=${clientId}`} variant="secondary" className="h-9">Planifier</LinkButton> : undefined}
        />
        {upcoming.length ? (
          <div className="divide-y divide-line border-t border-line">
            {upcoming.map((s) => (
              <Row key={s.id} s={s} />
            ))}
          </div>
        ) : (
          <p className="border-t border-line px-5 py-6 text-center text-sm text-muted">Aucune séance planifiée.</p>
        )}
      </Card>
      <Card className="overflow-hidden">
        <CardHeader
          title="Historique"
          subtitle={canEdit && done ? `${done} séance${done > 1 ? "s" : ""} réalisée${done > 1 ? "s" : ""}${value > 0 ? ` · valeur ${fmtDh(value)} (prix indicatifs)` : ""}` : undefined}
          icon={<Dumbbell className="size-4" />}
        />
        {past.length ? (
          <div className="divide-y divide-line border-t border-line">
            {past.map((s) => (
              <Row key={s.id} s={s} />
            ))}
          </div>
        ) : (
          <p className="border-t border-line px-5 py-6 text-center text-sm text-muted">Pas encore de séance passée.</p>
        )}
      </Card>
    </div>
  );
}

/** Couleur du badge côté adhérent */
function memberTone(label: string, status: Session["status"]): "green" | "red" | "gray" | "amber" | "brand" {
  if (label === "Non effectuée") return "gray";
  if (status === "realisee") return "green";
  if (status === "absent") return "red";
  if (status === "annulee") return "gray";
  if (status === "acceptee" || status === "en_cours") return "brand";
  return "amber";
}
