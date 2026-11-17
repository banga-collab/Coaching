import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";
import { dayKey } from "@/lib/utils";
import { PageHeader } from "@/components/ui";
import { BackLink } from "@/components/back-link";
import { ClassForm } from "@/components/classes/class-form";
import { isDayKey } from "@/components/classes/categories";

export const metadata = { title: "Nouveau cours" };

export default async function NewClassPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const [{ date }, me] = await Promise.all([searchParams, requireStaff()]);
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("*").in("role", ["admin", "coach"]).order("full_name");
  return (
    <>
      <PageHeader title="Nouveau cours" subtitle="Créez un créneau ponctuel ou récurrent." back={<BackLink href="/cours" label="Planning des cours" />} />
      <ClassForm coaches={(data ?? []) as Profile[]} defaultDate={isDayKey(date) ? date : dayKey(new Date())} meId={me.id} />
    </>
  );
}
