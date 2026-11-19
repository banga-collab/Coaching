import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { GroupClass } from "@/lib/types";
import { loadStaff } from "@/lib/planning";
import { isoToAgadir } from "@/lib/utils";
import { PageHeader } from "@/components/ui";
import { BackLink } from "@/components/back-link";
import { ClassForm } from "@/components/classes/class-form";

export const metadata = { title: "Modifier le cours" };

export default async function EditClassPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, me] = await Promise.all([params, requireStaff()]);
  const supabase = await createClient();
  const [{ data: c }, coaches] = await Promise.all([
    supabase.from("group_classes").select("*").eq("id", id).maybeSingle(),
    loadStaff(supabase),
  ]);
  if (!c) notFound();
  const cls = c as GroupClass;
  return (
    <>
      <PageHeader title="Modifier le cours" subtitle={cls.title} back={<BackLink href={`/cours/${id}`} label="Retour au cours" />} />
      <ClassForm coaches={coaches} initial={cls} defaultDate={isoToAgadir(cls.starts_at).date} meId={me.id} />
    </>
  );
}
