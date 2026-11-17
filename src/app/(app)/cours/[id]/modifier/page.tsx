import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { GroupClass, Profile } from "@/lib/types";
import { PageHeader } from "@/components/ui";
import { BackLink } from "@/components/back-link";
import { ClassForm } from "@/components/classes/class-form";

export const metadata = { title: "Modifier le cours" };

export default async function EditClassPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, me] = await Promise.all([params, requireStaff()]);
  const supabase = await createClient();
  const [{ data: c }, { data: p }] = await Promise.all([
    supabase.from("group_classes").select("*").eq("id", id).maybeSingle(),
    supabase.from("profiles").select("*").in("role", ["admin", "coach"]).order("full_name"),
  ]);
  if (!c) notFound();
  const cls = c as GroupClass;
  return (
    <>
      <PageHeader title="Modifier le cours" subtitle={cls.title} back={<BackLink href={`/cours/${id}`} label="Retour au cours" />} />
      <ClassForm coaches={(p ?? []) as Profile[]} initial={cls} defaultDate={cls.starts_at.slice(0, 10)} meId={me.id} />
    </>
  );
}
