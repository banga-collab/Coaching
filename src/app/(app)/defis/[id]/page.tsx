import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarRange, Check, CheckCircle2, Gift, Megaphone, Pencil, RefreshCw, Target, Timer, Trash2, UserPlus, Users } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Challenge } from "@/lib/types";
import { METRICS, challengeStatus, computeLeaderboard, countdownLabel, loadScoreData, progressPct } from "@/lib/challenges";
import { cn, fmtDate, num } from "@/lib/utils";
import { Avatar, Badge, Card, CardHeader, Empty, Input, LinkButton, PageHeader, Select } from "@/components/ui";
import { BackLink } from "@/components/back-link";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { ConfirmButton } from "@/components/confirm-button";
import { RankMedal } from "@/components/challenges/progress-ring";
import { closeChallengeAction, deleteChallengeAction, refreshScoresAction, removeEntryAction, setScoreAction } from "@/actions/challenges";

export const metadata = { title: "Défi" };

const STATUS = {
  en_cours: { label: "En cours", tone: "accent" },
  a_venir: { label: "À venir", tone: "brand" },
  termine: { label: "Terminé", tone: "gray" },
} as const;

export default async function ChallengeDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ annonce?: string }> }) {
  const [{ id }, { annonce }] = await Promise.all([params, searchParams, requireStaff()]);
  const supabase = await createClient();
  const { data } = await supabase.from("challenges").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const ch = data as Challenge;
  const scores = await loadScoreData(supabase, [ch]);
  const rows = computeLeaderboard(ch, scores);
  const st = challengeStatus(ch);
  const meta = METRICS[ch.metric];
  const unit = ch.unit ?? meta.unit;
  const manual = !meta.auto;
  const inBoard = new Set(rows.map((r) => r.client_id));
  const candidates = scores.clients.filter((c) => c.status !== "termine" && !inBoard.has(c.id)).sort((a, b) => a.full_name.localeCompare(b.full_name, "fr"));
  const best = rows[0]?.value ?? 0;
  const avg = rows.length ? rows.reduce((s, r) => s + r.value, 0) / rows.length : 0;
  const reached = ch.goal_value ? rows.filter((r) => r.value >= ch.goal_value!).length : null;
  const podium = rows.filter((r) => r.rank <= 3 && r.value > 0).slice(0, 3);
  const winners = rows.filter((r) => r.rank === 1 && r.value > 0);

  return (
    <>
      <PageHeader
        back={<BackLink href="/defis" label="Défis & classements" />}
        title={
          <span className="flex items-center gap-3">
            <span className="text-4xl">{ch.cover ?? "🏆"}</span>
            {ch.title}
          </span>
        }
        subtitle={ch.description ?? meta.label}
        actions={
          <>
            <LinkButton href={`/defis/${id}/modifier`} variant="secondary">
              <Pencil className="size-4" /> Modifier
            </LinkButton>
            {meta.auto && (
              <form action={refreshScoresAction}>
                <input type="hidden" name="id" value={id} />
                <SubmitButton variant="secondary" pendingText="Calcul…">
                  <RefreshCw className="size-4" /> Actualiser
                </SubmitButton>
              </form>
            )}
            {st !== "a_venir" && rows.length > 0 && (
              <form action={closeChallengeAction}>
                <input type="hidden" name="id" value={id} />
                <SubmitButton variant="primary" pendingText="Annonce…">
                  <Megaphone className="size-4" /> {st === "en_cours" ? "Clôturer & annoncer" : "Annoncer le gagnant"}
                </SubmitButton>
              </form>
            )}
          </>
        }
      />

      {annonce && (
        <p className="mb-5 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 animate-fade-up">
          <CheckCircle2 className="size-4" /> Défi clôturé : les participants avec un compte ont été notifiés
          {winners.length ? ` — victoire de ${winners.map((w) => w.name).join(" & ")} 🏆` : "."}
        </p>
      )}

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="flex items-center gap-3 p-4">
          <span className="grid size-10 place-items-center rounded-xl bg-accent-50 text-accent-500">
            <Timer className="size-5" />
          </span>
          <div>
            <Badge tone={STATUS[st].tone} dot>
              {STATUS[st].label}
            </Badge>
            <p className="mt-1 text-sm font-semibold text-ink">{countdownLabel(ch)}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3 p-4">
          <span className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-500">
            <CalendarRange className="size-5" />
          </span>
          <div className="text-sm">
            <p className="text-xs text-muted">Période</p>
            <p className="font-semibold text-ink">
              {fmtDate(`${ch.start_date}T12:00:00Z`, { day: "numeric", month: "short" })} → {fmtDate(`${ch.end_date}T12:00:00Z`, { day: "numeric", month: "short", year: "numeric" })}
            </p>
          </div>
        </Card>
        <Card className="flex items-center gap-3 p-4">
          <span className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-500">
            <Target className="size-5" />
          </span>
          <div className="text-sm">
            <p className="text-xs text-muted">{meta.label}</p>
            <p className="font-semibold text-ink">{ch.goal_value ? `Objectif ${num(ch.goal_value, unit)}` : "Meilleur score gagne"}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3 p-4">
          <span className="grid size-10 place-items-center rounded-xl bg-accent-50 text-accent-500">
            <Gift className="size-5" />
          </span>
          <div className="min-w-0 text-sm">
            <p className="text-xs text-muted">Récompense</p>
            <p className="truncate font-semibold text-ink">{ch.reward ?? "—"}</p>
          </div>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <CardHeader
            icon={<Users className="size-4" />}
            title="Classement"
            subtitle={meta.hint}
            action={<Badge tone="brand">{rows.length} participant{rows.length > 1 ? "s" : ""}</Badge>}
          />
          {/* Podium */}
          {podium.length > 0 && (
            <div className="mx-5 mb-4 flex items-end justify-center gap-3 rounded-2xl bg-gradient-to-b from-accent-50 to-white px-3 pt-5 sm:gap-6">
              {[podium[1], podium[0], podium[2]].map((r, i) =>
                r ? (
                  <div key={r.client_id} className="flex w-24 flex-col items-center text-center">
                    <span className="text-2xl">{r.rank === 1 ? "🥇" : r.rank === 2 ? "🥈" : "🥉"}</span>
                    <Avatar name={r.name} size={i === 1 ? 56 : 44} className={cn("mt-1 ring-4", i === 1 ? "ring-amber-300" : "ring-white")} />
                    <p className="mt-1.5 w-full truncate text-xs font-bold text-ink">{r.name.split(" ")[0]}</p>
                    <p className="text-xs font-semibold text-brand-600">{num(r.value, unit)}</p>
                    <div className={cn("mt-2 w-full rounded-t-xl bg-gradient-to-b", i === 1 ? "h-20 from-amber-300 to-amber-200" : i === 0 ? "h-14 from-slate-300 to-slate-200" : "h-10 from-orange-300 to-orange-200")} />
                  </div>
                ) : (
                  <div key={i} className="w-24" />
                ),
              )}
            </div>
          )}

          {rows.length === 0 ? (
            <Empty
              icon={<Users className="size-6" />}
              title={st === "a_venir" ? "Le défi n'a pas encore commencé" : "Aucun score pour l'instant"}
              text={manual ? "Ajoutez des participants et leurs scores, ou laissez les membres saisir leurs pas depuis leur espace." : "Les scores apparaîtront dès les premiers passages / mesures."}
            />
          ) : (
            <ul className="divide-y divide-line">
              {rows.map((r) => {
                const pct = progressPct(r.value, ch.goal_value);
                return (
                  <li key={r.client_id} className={cn("flex flex-wrap items-center gap-3 px-5 py-3 transition hover:bg-canvas/60", r.rank === 1 && "bg-amber-50/40")}>
                    <RankMedal rank={r.rank} />
                    <Avatar name={r.name} size={36} />
                    <div className="min-w-0 flex-1">
                      <Link href={`/clients/${r.client_id}`} className="block truncate font-semibold text-ink hover:text-brand-600">
                        {r.name}
                      </Link>
                      {pct !== null ? (
                        <div className="mt-1 flex items-center gap-2">
                          <div className="h-1.5 max-w-[180px] flex-1 overflow-hidden rounded-full bg-slate-100">
                            <div className={cn("h-full rounded-full", pct >= 100 ? "bg-emerald-500" : "bg-accent-500")} style={{ width: `${pct}%` }} />
                          </div>
                          <span className={cn("text-[11px] font-semibold", pct >= 100 ? "text-emerald-600" : "text-muted")}>{pct >= 100 ? "Objectif ✓" : `${pct} %`}</span>
                        </div>
                      ) : (
                        !r.linked && <p className="text-[11px] text-muted">Sans compte adhérent</p>
                      )}
                    </div>
                    {manual ? (
                      <div className="flex items-center gap-1.5">
                        <ActionForm action={setScoreAction} className="flex items-center gap-1.5">
                          <input type="hidden" name="challenge_id" value={id} />
                          <input type="hidden" name="client_id" value={r.client_id} />
                          <Input name="value" inputMode="decimal" defaultValue={r.value} aria-label={`Score de ${r.name}`} className="h-9 w-28 text-right font-semibold" />
                          <SubmitButton variant="secondary" className="h-9 w-9 px-0" pendingText="">
                            <Check className="size-4" />
                          </SubmitButton>
                        </ActionForm>
                        {r.entryId && (
                          <form action={removeEntryAction}>
                            <input type="hidden" name="challenge_id" value={id} />
                            <input type="hidden" name="entry_id" value={r.entryId} />
                            <button type="submit" title="Retirer du défi" aria-label="Retirer du défi" className="grid size-9 place-items-center rounded-xl text-muted transition hover:bg-red-50 hover:text-red-600">
                              <Trash2 className="size-4" />
                            </button>
                          </form>
                        )}
                      </div>
                    ) : (
                      <span className="font-display text-lg font-extrabold text-brand-600">
                        {num(r.value)} <span className="text-xs font-semibold text-muted">{unit}</span>
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <div className="space-y-5">
          <Card className="p-5">
            <p className="mb-3 font-display text-[15px] font-bold text-ink">En chiffres</p>
            <dl className="grid grid-cols-2 gap-3 text-center">
              {[
                ["Meilleur", num(best, unit)],
                ["Moyenne", num(Math.round(avg * 10) / 10, unit)],
                ["Participants", String(rows.length)],
                ["Objectif atteint", reached === null ? "—" : String(reached)],
              ].map(([k, v]) => (
                <div key={k} className="rounded-xl bg-canvas p-3">
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">{k}</dt>
                  <dd className="mt-0.5 font-display text-base font-extrabold text-ink">{v}</dd>
                </div>
              ))}
            </dl>
          </Card>

          {manual && candidates.length > 0 && (
            <Card className="p-5">
              <p className="mb-3 flex items-center gap-2 font-display text-[15px] font-bold text-ink">
                <UserPlus className="size-4 text-brand-500" /> Ajouter un participant
              </p>
              <ActionForm action={setScoreAction} className="space-y-3">
                <input type="hidden" name="challenge_id" value={id} />
                <Select name="client_id" required defaultValue="">
                  <option value="" disabled>
                    Choisir un membre…
                  </option>
                  {candidates.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.full_name}
                    </option>
                  ))}
                </Select>
                <Input name="value" inputMode="decimal" placeholder={`Score de départ (${unit})`} defaultValue="0" />
                <SubmitButton variant="brand" className="w-full" pendingText="Ajout…">
                  Ajouter au classement
                </SubmitButton>
              </ActionForm>
            </Card>
          )}

          <form action={deleteChallengeAction} className="flex justify-end">
            <input type="hidden" name="id" value={id} />
            <ConfirmButton message="Supprimer ce défi et tous ses scores ?" className="h-9 border-transparent text-xs">
              <Trash2 className="size-3.5" /> Supprimer le défi
            </ConfirmButton>
          </form>
        </div>
      </div>
    </>
  );
}
