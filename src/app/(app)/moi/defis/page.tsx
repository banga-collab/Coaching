import { redirect } from "next/navigation";
import { Award, CalendarClock, Flag, Gift, Hourglass, Sparkles, Timer, TrendingUp, Trophy } from "lucide-react";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Challenge, Client } from "@/lib/types";
import { METRICS, challengeStatus, computeLeaderboard, countdownLabel, loadScoreData, privacyName, progressPct, type LeaderRow } from "@/lib/challenges";
import { BADGES, syncBadges } from "@/lib/badges";
import { cn, fmtDate, num } from "@/lib/utils";
import { Avatar, Card, Empty, PageHeader } from "@/components/ui";
import { ProgressRing, RankMedal } from "@/components/challenges/progress-ring";
import { BadgeMedal } from "@/components/challenges/badge-icon";
import { StepsForm } from "@/components/challenges/steps-form";

export const metadata = { title: "Défis & badges" };

function Leaderboard({ rows, meId, unit }: { rows: LeaderRow[]; meId: string; unit: string }) {
  const myIdx = rows.findIndex((r) => r.client_id === meId);
  const shown = rows.slice(0, 5);
  const showMe = myIdx >= 5;
  const line = (r: LeaderRow) => {
    const me = r.client_id === meId;
    const name = privacyName(r.name);
    return (
      <li key={r.client_id} className={cn("flex items-center gap-3 rounded-xl px-3 py-2", me ? "bg-accent-50 ring-1 ring-accent-200" : "")}>
        <RankMedal rank={r.rank} size={28} />
        <Avatar name={name} size={32} />
        <span className={cn("min-w-0 flex-1 truncate text-sm", me ? "font-bold text-accent-700" : "font-medium text-ink")}>{me ? "Toi" : name}</span>
        <span className={cn("text-sm font-bold", me ? "text-accent-700" : "text-brand-600")}>
          {num(r.value)} <span className="text-[11px] font-medium text-muted">{unit}</span>
        </span>
      </li>
    );
  };
  return (
    <ol className="space-y-1">
      {shown.map(line)}
      {showMe && (
        <>
          <li className="py-0.5 text-center text-xs font-bold tracking-widest text-slate-300">• • •</li>
          {line(rows[myIdx]!)}
        </>
      )}
    </ol>
  );
}

export default async function MyChallengesPage() {
  const me = await getProfile();
  if (me.role !== "client") redirect("/defis");
  const supabase = await createClient();
  const { data: cData } = await supabase.from("clients").select("*").eq("user_id", me.id).maybeSingle();
  if (!cData) {
    return (
      <>
        <PageHeader title="Défis & badges" />
        <Card>
          <Empty icon={<Trophy className="size-6" />} title="Ton dossier n'est pas encore relié" text="Demande à ton coach de relier ton compte pour participer aux défis." />
        </Card>
      </>
    );
  }
  const client = cData as Client;
  const [{ data: chData }, { badges }] = await Promise.all([
    supabase.from("challenges").select("*").order("end_date"),
    syncBadges(supabase, client.id),
  ]);
  const challenges = (chData ?? []) as Challenge[];
  const scores = await loadScoreData(supabase, challenges);
  const active = challenges.filter((c) => challengeStatus(c) === "en_cours");
  const upcoming = challenges.filter((c) => challengeStatus(c) === "a_venir");
  const finished = challenges
    .filter((c) => challengeStatus(c) === "termine")
    .sort((a, b) => b.end_date.localeCompare(a.end_date))
    .slice(0, 4);
  const earned = new Map(badges.map((b) => [b.code, b]));
  const earnedCount = BADGES.filter((b) => earned.has(b.code)).length;
  const firstName = client.full_name.split(" ")[0];

  return (
    <>
      <PageHeader title="Défis & badges" subtitle={`Allez ${firstName}, chaque séance compte ! 💪`} />

      {/* Défis en cours */}
      {active.length === 0 ? (
        <Card className="mb-6">
          <Empty icon={<Flag className="size-6" />} title="Pas de défi en cours" text="Ton coach prépare le prochain défi. Reste prêt !" />
        </Card>
      ) : (
        <div className="mb-6 grid gap-4 lg:grid-cols-2 animate-fade-up">
          {active.map((ch) => {
            const rows = computeLeaderboard(ch, scores);
            const mine = rows.find((r) => r.client_id === client.id) ?? null;
            const unit = ch.unit ?? METRICS[ch.metric].unit;
            const value = mine?.value ?? 0;
            const leader = rows[0]?.value ?? 0;
            const pct = progressPct(value, ch.goal_value) ?? (leader > 0 ? Math.round((value / leader) * 100) : 0);
            const above = mine ? rows.filter((r) => r.value > mine.value).at(-1) : rows.at(-1);
            const gap = above ? above.value - value : 0;
            const done = ch.goal_value ? value >= ch.goal_value : false;
            return (
              <Card key={ch.id} className="overflow-hidden">
                <div className="relative bg-gradient-to-br from-brand-600 via-brand-500 to-sky-500 px-5 pb-5 pt-4 text-white">
                  <span className="pointer-events-none absolute -right-2 -top-3 select-none text-[84px] leading-none opacity-90">{ch.cover ?? "🏆"}</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-1 text-xs font-bold backdrop-blur">
                    <Timer className="size-3.5" /> {countdownLabel(ch)}
                  </span>
                  <h2 className="mt-2 max-w-[75%] font-display text-xl font-extrabold leading-tight">{ch.title}</h2>
                  {ch.description && <p className="mt-1 max-w-[80%] text-sm text-white/85">{ch.description}</p>}
                </div>

                <div className="p-5">
                  <div className="flex items-center gap-5">
                    <ProgressRing pct={pct} color={done ? "#10b981" : "#e8782a"}>
                      <div>
                        <p className="font-display text-2xl font-extrabold leading-none text-ink">{mine ? `#${mine.rank}` : "–"}</p>
                        <p className="mt-0.5 text-[11px] font-semibold text-muted">sur {Math.max(rows.length, 1)}</p>
                      </div>
                    </ProgressRing>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted">Mon score</p>
                      <p className="font-display text-3xl font-extrabold leading-tight text-brand-600">
                        {num(value)} <span className="text-base font-bold text-muted">{unit}</span>
                      </p>
                      {ch.goal_value ? (
                        <p className={cn("text-sm font-semibold", done ? "text-emerald-600" : "text-slate-600")}>
                          {done ? "🎉 Objectif atteint !" : `${pct} % de l'objectif (${num(ch.goal_value, unit)})`}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl border border-line px-4 py-3 text-sm">
                    {!mine ? (
                      <p className="flex items-center gap-2 text-slate-600">
                        <Sparkles className="size-4 shrink-0 text-accent-500" />
                        {ch.metric === "pas" ? "Ajoute tes pas pour entrer dans le classement !" : ch.metric === "presences" ? "Viens à la salle pour marquer tes premiers points !" : "Ton coach saisira ton score prochainement."}
                      </p>
                    ) : mine.rank === 1 ? (
                      <p className="flex items-center gap-2 font-semibold text-emerald-700">
                        <Trophy className="size-4 shrink-0" /> Tu es en tête ! Garde le rythme 🔥
                      </p>
                    ) : above ? (
                      <p className="flex items-center gap-2 text-slate-600">
                        <TrendingUp className="size-4 shrink-0 text-accent-500" />
                        <span>
                          Plus que <b className="text-ink">{num(gap === 0 ? 1 : gap, unit)}</b> pour dépasser <b className="text-ink">{privacyName(above.name)}</b>
                        </span>
                      </p>
                    ) : null}
                  </div>

                  {ch.reward && (
                    <p className="mt-3 flex items-center gap-2 text-sm font-medium text-accent-700">
                      <Gift className="size-4 shrink-0" /> À gagner : {ch.reward}
                    </p>
                  )}

                  {ch.metric === "pas" && (
                    <div className="mt-4">
                      <StepsForm challengeId={ch.id} />
                    </div>
                  )}

                  {rows.length > 0 && (
                    <div className="mt-5">
                      <p className="mb-2 text-xs font-bold uppercase tracking-wider text-brand-600">Classement</p>
                      <Leaderboard rows={rows} meId={client.id} unit={unit} />
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {upcoming.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-3 flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wider text-brand-600">
            <CalendarClock className="size-4 text-accent-500" /> Bientôt
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {upcoming.map((ch) => (
              <Card key={ch.id} className="flex items-center gap-4 p-4">
                <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-brand-50 text-3xl">{ch.cover ?? "🏆"}</span>
                <div className="min-w-0">
                  <p className="font-display font-bold text-ink">{ch.title}</p>
                  <p className="text-xs text-muted">
                    {countdownLabel(ch)} · jusqu&apos;au {fmtDate(`${ch.end_date}T12:00:00Z`, { day: "numeric", month: "long" })}
                  </p>
                  {ch.reward && <p className="mt-0.5 truncate text-xs font-medium text-accent-700">🎁 {ch.reward}</p>}
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Badges */}
      <section className="mb-6">
        <div className="mb-3 flex items-end justify-between gap-3">
          <h2 className="flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wider text-brand-600">
            <Award className="size-4 text-accent-500" /> Mes badges
          </h2>
          <span className="text-sm font-semibold text-muted">
            <b className="text-ink">{earnedCount}</b> / {BADGES.length}
          </span>
        </div>
        <Card className="p-4 sm:p-5">
          <div className="mb-4 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-gradient-to-r from-accent-500 to-amber-400" style={{ width: `${Math.round((earnedCount / BADGES.length) * 100)}%` }} />
          </div>
          <ul className="grid grid-cols-3 gap-x-2 gap-y-5 sm:grid-cols-4 lg:grid-cols-6">
            {BADGES.map((b) => {
              const got = earned.get(b.code);
              return (
                <li key={b.code} className="flex flex-col items-center text-center">
                  <BadgeMedal def={b} earned={!!got} size={60} />
                  <p className={cn("mt-2 text-xs font-bold leading-tight", got ? "text-ink" : "text-slate-400")}>{b.label}</p>
                  <p className="mt-0.5 text-[11px] leading-snug text-muted">
                    {got ? `Obtenu le ${fmtDate(`${got.earned_on}T12:00:00Z`, { day: "numeric", month: "short" })}` : b.description}
                  </p>
                </li>
              );
            })}
          </ul>
        </Card>
      </section>

      {finished.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wider text-brand-600">
            <Hourglass className="size-4 text-accent-500" /> Défis terminés
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {finished.map((ch) => {
              const rows = computeLeaderboard(ch, scores);
              const mine = rows.find((r) => r.client_id === client.id);
              const winner = rows[0];
              return (
                <Card key={ch.id} className="flex items-center gap-4 p-4">
                  <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-slate-100 text-2xl grayscale-[30%]">{ch.cover ?? "🏆"}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display font-bold text-ink">{ch.title}</p>
                    <p className="truncate text-xs text-muted">
                      {winner ? `Vainqueur : ${winner.client_id === client.id ? "toi 🏆" : privacyName(winner.name)}` : "Aucun participant"}
                    </p>
                  </div>
                  {mine && (
                    <span className="text-right">
                      <RankMedal rank={mine.rank} size={32} />
                    </span>
                  )}
                </Card>
              );
            })}
          </div>
        </section>
      )}
    </>
  );
}
