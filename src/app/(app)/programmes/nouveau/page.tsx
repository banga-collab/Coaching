import { requireStaff } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { BackLink } from "@/components/back-link";
import { ProgramBuilder } from "@/components/coaching/program-builder";

export const metadata = { title: "Nouveau programme" };

export default async function NewProgramPage() {
  await requireStaff();
  return (
    <>
      <PageHeader
        back={<BackLink href="/programmes" label="Programmes" />}
        title="Nouveau programme"
        subtitle="Compose les journées d'entraînement et leurs exercices, puis assigne le programme à tes clients."
      />
      <ProgramBuilder />
    </>
  );
}
