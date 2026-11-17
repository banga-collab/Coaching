import { requireStaff } from "@/lib/auth";
import { todayKey } from "@/lib/challenges";
import { PageHeader } from "@/components/ui";
import { BackLink } from "@/components/back-link";
import { ChallengeForm } from "@/components/challenges/challenge-form";

export const metadata = { title: "Nouveau défi" };

export default async function NewChallengePage() {
  await requireStaff();
  const start = todayKey();
  const [y, m] = start.split("-").map(Number) as [number, number];
  const end = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); // dernier jour du mois
  return (
    <>
      <PageHeader title="Nouveau défi" subtitle="Un objectif clair, une date de fin, une récompense : c'est parti !" back={<BackLink href="/defis" label="Défis & classements" />} />
      <ChallengeForm defaults={{ start, end: end > start ? end : start }} />
    </>
  );
}
