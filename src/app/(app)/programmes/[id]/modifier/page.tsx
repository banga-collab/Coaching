import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth";
import type { Program } from "@/lib/types";
import { PageHeader } from "@/components/ui";
import { BackLink } from "@/components/back-link";
import { ProgramBuilder } from "@/components/coaching/program-builder";

export const metadata = { title: "Modifier le programme" };

export default async function EditProgramPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("programs").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const program = data as Program;
  return (
    <>
      <PageHeader back={<BackLink href={`/programmes/${id}`} label={program.name} />} title="Modifier le programme" subtitle={program.name} />
      <ProgramBuilder program={program} />
    </>
  );
}
