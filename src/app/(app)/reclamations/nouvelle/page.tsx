import { isManager, requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import { CoachReclamationForm } from "@/components/reclamations/coach-form";

export const metadata = { title: "Nouvelle réclamation" };

/** Un coach (ou head coach) signale un problème à la direction */
export default async function NewReclamationPage({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  const [me, { client }] = await Promise.all([requireStaff(), searchParams]);
  const supabase = await createClient();
  // Coach : ses clients ; manager : tous les clients suivis
  let q = supabase.from("clients").select("id, full_name");
  if (!isManager(me.role)) q = q.eq("coach_id", me.id);
  const { data } = await q.order("full_name").limit(1000);
  const clients = (data ?? []) as { id: string; full_name: string }[];
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Nouvelle réclamation" subtitle="Un problème avec un client, le planning, le matériel ou l'organisation ? La direction est prévenue tout de suite." />
      <CoachReclamationForm clients={clients} defaultClient={clients.some((c) => c.id === client) ? client : undefined} />
    </div>
  );
}
