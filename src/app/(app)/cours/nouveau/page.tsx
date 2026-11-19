import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { dayKey } from "@/lib/utils";
import { loadStaff } from "@/lib/planning";
import { PageHeader } from "@/components/ui";
import { BackLink } from "@/components/back-link";
import { ClassForm } from "@/components/classes/class-form";
import { isDayKey } from "@/components/classes/categories";

export const metadata = { title: "Nouveau cours" };

export default async function NewClassPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const [{ date }, me] = await Promise.all([searchParams, requireStaff()]);
  const supabase = await createClient();
  const coaches = await loadStaff(supabase);
  return (
    <>
      <PageHeader title="Nouveau cours" subtitle="Créez un créneau ponctuel ou récurrent." back={<BackLink href="/cours" label="Planning des cours" />} />
      <ClassForm coaches={coaches} defaultDate={isDayKey(date) ? date : dayKey(new Date())} meId={me.id} />
    </>
  );
}
