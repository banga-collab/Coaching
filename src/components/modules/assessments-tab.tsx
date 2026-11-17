import { ArrowDownRight, ArrowUpRight, ChevronDown, ClipboardList, LineChart, Minus, Plus, RotateCcw, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { Assessment, AssessmentField } from "@/lib/types";
import { cn, fmtDate, num, signed } from "@/lib/utils";
import { Badge, Card, CardHeader, Empty, LinkButton } from "@/components/ui";
import { ACCENT, BRAND, TrendChart } from "@/components/charts";
import { ConfirmIcon } from "@/components/phase1/confirm-icon";
import { formatAnswer, isNumericField } from "@/components/phase1/shared";
import { deleteAssessmentAction } from "@/actions/phase1";

const short = (d: string) => fmtDate(d, { day: "numeric", month: "short" });

type Group = { key: string; templateId: string | null; name: string; items: Assessment[]; fields: AssessmentField[] };

function groupAssessments(rows: Assessment[]): Group[] {
  const map = new Map<string, Group>();
  for (const a of rows) {
    const key = a.template_id ?? `name:${a.template_name}`;
    const g = map.get(key) ?? { key, templateId: a.template_id, name: a.template_name, items: [], fields: [] };
    g.items.push(a);
    map.set(key, g);
  }
  for (const g of map.values()) {
    // Champs : ceux de la plus récente, puis ceux qui n'existent plus mais ont été remplis avant
    const seen = new Set<string>();
    for (const a of [...g.items].reverse()) {
      for (const f of a.fields ?? []) {
        if (!seen.has(f.id)) {
          seen.add(f.id);
          g.fields.push(f);
        }
      }
    }
    g.name = g.items.at(-1)!.template_name;
  }
  return [...map.values()].sort((a, b) => (a.items.at(-1)!.done_on < b.items.at(-1)!.done_on ? 1 : -1));
}

const numVal = (v: unknown) => (v === null || v === undefined || v === "" || typeof v === "boolean" ? null : Number.isFinite(Number(v)) ? Number(v) : null);

export async function AssessmentsTab({ clientId, canEdit }: { clientId: string; canEdit: boolean }) {
  const supabase = await createClient();
  const { data } = await supabase.from("assessments").select("*").eq("client_id", clientId).order("done_on");
  const rows = ((data ?? []) as Assessment[]).sort((a, b) => (a.done_on === b.done_on ? (a.created_at < b.created_at ? -1 : 1) : a.done_on < b.done_on ? -1 : 1));
  const groups = groupAssessments(rows);

  if (!groups.length) {
    return (
      <Card>
        <Empty
          icon={<ClipboardList className="size-6" />}
          title="Aucune évaluation"
          text={
            canEdit
              ? "Fais passer un premier bilan (tests physiques, posture, nutrition…) pour suivre l'évolution dans le temps."
              : "Ton coach n'a pas encore réalisé d'évaluation. Tes résultats et ta progression apparaîtront ici."
          }
          action={
            canEdit ? (
              <LinkButton href={`/clients/${clientId}/evaluation`}>
                <Plus className="size-4" /> Nouvelle évaluation
              </LinkButton>
            ) : undefined
          }
        />
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {rows.length} évaluation{rows.length > 1 ? "s" : ""} · {groups.length} modèle{groups.length > 1 ? "s" : ""}
          {!canEdit && " — compare tes résultats d'un bilan à l'autre."}
        </p>
        {canEdit && (
          <LinkButton href={`/clients/${clientId}/evaluation`} className="h-9">
            <Plus className="size-4" /> Nouvelle évaluation
          </LinkButton>
        )}
      </div>

      {groups.map((g) => {
        const latest = g.items.at(-1)!;
        const first = g.items[0]!;
        const multi = g.items.length >= 2;
        const trendFields = g.fields
          .filter(isNumericField)
          .map((f) => ({ f, pts: g.items.filter((a) => numVal(a.answers[f.id]) !== null) }))
          .filter((x) => x.pts.length >= 2);

        return (
          <Card key={g.key} className="overflow-hidden">
            <CardHeader
              title={g.name}
              subtitle={`${g.items.length} passage${g.items.length > 1 ? "s" : ""} · dernier le ${fmtDate(latest.done_on)}`}
              icon={<ClipboardList className="size-4" />}
              action={
                canEdit && g.templateId ? (
                  <LinkButton href={`/clients/${clientId}/evaluation?modele=${g.templateId}`} variant="secondary" className="h-9 shrink-0">
                    <RotateCcw className="size-4" /> <span className="hidden sm:inline">Refaire</span>
                  </LinkButton>
                ) : undefined
              }
            />

            {/* ---------- Comparaison première / dernière ---------- */}
            {multi && trendFields.length > 0 && (
              <div className="px-5 pb-5">
                <div className="overflow-x-auto rounded-xl border border-line">
                  <table className="w-full min-w-[480px] text-sm">
                    <thead>
                      <tr className="bg-slate-50/70 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        <th className="px-4 py-2.5">Mesure</th>
                        <th className="px-3 py-2.5 text-right">{short(first.done_on)}</th>
                        <th className="px-3 py-2.5 text-right">{short(latest.done_on)}</th>
                        <th className="px-4 py-2.5 text-right">Évolution</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {trendFields.map(({ f, pts }) => {
                        const a = numVal(pts[0]!.answers[f.id])!;
                        const b = numVal(pts.at(-1)!.answers[f.id])!;
                        const d = b - a;
                        const pct = a !== 0 ? Math.round((d / Math.abs(a)) * 100) : null;
                        const unit = f.type === "scale" ? "" : (f.unit ?? "");
                        return (
                          <tr key={f.id} className="hover:bg-canvas/50">
                            <td className="px-4 py-2.5 font-medium text-slate-700">{f.label}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums text-muted">{formatAnswer(f, a)}</td>
                            <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-ink">{formatAnswer(f, b)}</td>
                            <td className="px-4 py-2.5 text-right">
                              <span
                                className={cn(
                                  "inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-bold tabular-nums",
                                  d > 0 ? "bg-brand-50 text-brand-600" : d < 0 ? "bg-accent-50 text-accent-700" : "bg-slate-50 text-slate-500",
                                )}
                              >
                                {d > 0 ? <ArrowUpRight className="size-3.5" /> : d < 0 ? <ArrowDownRight className="size-3.5" /> : <Minus className="size-3.5" />}
                                {signed(d, unit)}
                                {pct !== null && d !== 0 && <span className="font-medium opacity-70">({pct > 0 ? "+" : ""}{pct} %)</span>}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {trendFields.slice(0, 6).map(({ f, pts }, i) => (
                    <div key={f.id} className="rounded-xl border border-line p-3 pb-1">
                      <p className="flex items-center gap-1.5 px-1 text-xs font-semibold text-slate-600">
                        <LineChart className="size-3.5 text-brand-400" /> {f.label}
                      </p>
                      <TrendChart
                        height={150}
                        domain={f.type === "scale" ? [0, 10] : undefined}
                        data={pts.map((a) => ({ label: short(a.done_on), v: numVal(a.answers[f.id]) }))}
                        series={[{ key: "v", label: f.label, color: i % 2 ? ACCENT : BRAND, unit: f.type === "scale" ? "/10" : f.unit }]}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ---------- Historique ---------- */}
            <div className="divide-y divide-line border-t border-line">
              {[...g.items].reverse().map((a, idx) => (
                <details key={a.id} open={idx === 0} className="group/d">
                  <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-3 transition hover:bg-canvas/60 [&::-webkit-details-marker]:hidden">
                    <ChevronDown className="size-4 shrink-0 text-slate-400 transition group-open/d:rotate-180" />
                    <span className="text-sm font-semibold text-ink">{fmtDate(a.done_on)}</span>
                    {idx === 0 && <Badge tone="brand">Dernière</Badge>}
                    {a.score !== null && <span className="ml-auto rounded-lg bg-accent-50 px-2 py-0.5 text-xs font-bold text-accent-700">Score {num(a.score)}</span>}
                  </summary>
                  <div className="px-5 pb-5">
                    <dl className="grid gap-2 sm:grid-cols-2">
                      {(a.fields ?? []).map((f) => {
                        const v = a.answers[f.id];
                        const empty = v === null || v === undefined || v === "";
                        return (
                          <div key={f.id} className={cn("rounded-xl bg-canvas/70 px-3.5 py-2.5", f.type === "text" && "sm:col-span-2")}>
                            <dt className="text-xs text-muted">{f.label}</dt>
                            <dd className={cn("mt-0.5 text-sm font-semibold", empty ? "text-slate-300" : "text-ink", f.type === "text" && "whitespace-pre-line font-normal text-slate-700")}>
                              {f.type === "scale" && !empty ? (
                                <span className="flex items-center gap-2">
                                  <span className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-200">
                                    <span className="block h-full rounded-full bg-brand-500" style={{ width: `${Number(v) * 10}%` }} />
                                  </span>
                                  {formatAnswer(f, v)}
                                </span>
                              ) : f.type === "yesno" && !empty ? (
                                <Badge tone={v ? "green" : "gray"}>{formatAnswer(f, v)}</Badge>
                              ) : (
                                formatAnswer(f, v)
                              )}
                            </dd>
                          </div>
                        );
                      })}
                    </dl>
                    {a.notes && <p className="mt-3 whitespace-pre-line rounded-xl border border-brand-100 bg-brand-50/50 px-4 py-3 text-sm text-slate-700">{a.notes}</p>}
                    {canEdit && (
                      <form action={deleteAssessmentAction} className="mt-3 flex justify-end">
                        <input type="hidden" name="id" value={a.id} />
                        <input type="hidden" name="client_id" value={clientId} />
                        <ConfirmIcon message={`Supprimer l'évaluation du ${fmtDate(a.done_on)} ?`} label="Supprimer l'évaluation" wide>
                          <Trash2 className="size-4" /> Supprimer
                        </ConfirmIcon>
                      </form>
                    )}
                  </div>
                </details>
              ))}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
