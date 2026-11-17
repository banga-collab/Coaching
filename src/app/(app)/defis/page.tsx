import { Award, CheckCircle2, Flag, Plus, RefreshCw, Timer, Trophy, Users } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Badge as BadgeRow, Challenge } from "@/lib/types";
import { challengeStatus, computeLeaderboard, loadScoreData } from "@/lib/challenges";
import { BADGES } from "@/lib/badges";
import { Card, Empty, Kpi, LinkButton, PageHeader, SectionTitle } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { ChallengeCard } from "@/components/challenges/challenge-card";
import { BadgeMedal } from "@/components/challenges/badge-icon";
import { syncAllBadgesAction } from "@/actions/challenges";

export const metadata = { title: "Défis & classements" };

export default async function ChallengesPage({ searchParams }: { searchParams: Promise<{ badges?: string }> }) {
  const [{ badges: badgesOk }] = await Promise.all([searchParams, requireStaff()]);
  const supabase = await createClient();
  const [{ data: chData }, { data: bData }, { count: memberCount }] = await Promise.all([
    supabase.from("challenges").select("*").order("start_date", { ascending: false }),
    supabase.from("badges").select("*"),
    supabase.from("clients").select("*", { count: "exact", head: true }).neq("status", "termine"),
  ]);
  const challenges = (chData ?? []) as Challenge[];
  const badges = (bData ?? []) as BadgeRow[];
  const data = await loadScoreData(supabase, challenges);
  const boards = new Map(challenges.map((c) => [c.id, computeLeaderboard(c, data)]));

  const groups = {
    en_cours: challenges.filter((c) => challengeStatus(c) === "en_cours").sort((a, b) => a.end_date.localeCompare(b.end_date)),
    a_venir: challenges.filter((c) => challengeStatus(c) === "a_venir").sort((a, b) => a.start_date.localeCompare(b.start_date)),
    termine: challenges.filter((c) => challengeStatus(c) === "termine"),
  };
  const participants = new Set(groups.en_cours.flatMap((c) => boards.get(c.id)!.map((r) => r.client_id)));
  const badgeCount = new Map<string, number>();
  for (const b of badges) badgeCount.set(b.code, (badgeCount.get(b.code) ?? 0) + 1);
  const holders = new Set(badges.map((b) => b.client_id)).size;

  const section = (key: keyof typeof groups, title: string, icon: React.ReactNode, empty: string) => (
    <section>
      <SectionTitle icon={icon}>
        {title} ({groups[key].length})
      </SectionTitle>
      {groups[key].length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {groups[key].map((c) => (
            <ChallengeCard key={c.id} ch={c} rows={boards.get(c.id)!} />
          ))}
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-line bg-white/60 px-5 py-6 text-center text-sm text-muted">{empty}</p>
      )}
    </section>
  );

  return (
    <>
      <PageHeader
        title="Défis & classements"
        subtitle="Motivez vos membres avec des défis mensuels, des classements et des badges."
        actions={
          <LinkButton href="/defis/nouveau">
            <Plus className="size-4" /> Nouveau défi
          </LinkButton>
        }
      />

      <div className="mb-2 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Kpi label="Défis en cours" value={groups.en_cours.length} icon={<Flag className="size-5" />} />
        <Kpi label="Participants actifs" value={participants.size} delta={memberCount ? `sur ${memberCount} membres` : undefined} icon={<Users className="size-5" />} />
        <Kpi label="Badges décernés" value={badges.length} tone="accent" icon={<Award className="size-5" />} />
        <Kpi label="Membres badgés" value={holders} tone="accent" icon={<Trophy className="size-5" />} />
      </div>

      {challenges.length === 0 ? (
        <Card className="mt-6">
          <Empty
            icon={<Trophy className="size-6" />}
            title="Aucun défi pour le moment"
            text="Lancez un premier défi (présences, squat, pas…) : vos membres verront leur classement en direct."
            action={
              <LinkButton href="/defis/nouveau">
                <Plus className="size-4" /> Créer un défi
              </LinkButton>
            }
          />
        </Card>
      ) : (
        <div className="animate-fade-up">
          {section("en_cours", "En cours", <Flag className="size-4" />, "Aucun défi en cours.")}
          {section("a_venir", "À venir", <Timer className="size-4" />, "Aucun défi programmé.")}
          {groups.termine.length > 0 && section("termine", "Terminés", <CheckCircle2 className="size-4" />, "")}
        </div>
      )}

      {/* Catalogue des badges */}
      <section id="badges" className="scroll-mt-6">
        <SectionTitle icon={<Award className="size-4" />}>Catalogue des badges</SectionTitle>
        <Card className="p-5">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-xl text-sm text-muted">
              Les badges sont attribués automatiquement quand un membre ouvre son espace. Vous pouvez aussi forcer le recalcul pour tous les membres actifs.
            </p>
            <form action={syncAllBadgesAction}>
              <SubmitButton variant="secondary" pendingText="Calcul…">
                <RefreshCw className="size-4" /> Recalculer les badges
              </SubmitButton>
            </form>
          </div>
          {badgesOk && (
            <p className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
              <CheckCircle2 className="size-4" /> Badges recalculés pour tous les membres actifs.
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {BADGES.map((b) => {
              const n = badgeCount.get(b.code) ?? 0;
              return (
                <div key={b.code} className="flex items-center gap-3 rounded-xl border border-line p-3 transition hover:bg-canvas/60">
                  <BadgeMedal def={b} earned={n > 0} size={48} />
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-sm font-bold text-ink">{b.label}</p>
                    <p className="line-clamp-2 text-xs text-muted">{b.description}</p>
                  </div>
                  <span className="text-right">
                    <span className="block font-display text-lg font-extrabold leading-none text-brand-600">{n}</span>
                    <span className="text-[10px] font-semibold uppercase text-muted">membre{n > 1 ? "s" : ""}</span>
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      </section>
    </>
  );
}
