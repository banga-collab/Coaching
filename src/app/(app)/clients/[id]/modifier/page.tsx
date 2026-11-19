import { notFound, redirect } from "next/navigation";
import { isManager, listActiveCoaches, requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Client, Profile } from "@/lib/types";
import { PageHeader } from "@/components/ui";
import { BackLink } from "@/components/back-link";
import { ClientForm } from "../../client-form";
import { updateClientAction } from "../../../actions";

export const metadata = { title: "Modifier le client" };

export default async function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireStaff();
  const supabase = await createClient();
  const { data } = await supabase.from("clients").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const c = data as Client;
  const manager = isManager(me.role);
  // Seuls le coach référent et les managers modifient le dossier
  if (!manager && c.coach_id !== me.id) redirect(`/clients/${id}`);

  // Admin et head coach peuvent réaffecter le client à un autre membre actif de l'équipe
  let coaches: Pick<Profile, "id" | "full_name" | "email">[] | undefined;
  if (manager) {
    coaches = await listActiveCoaches(supabase);
    if (!coaches.some((p) => p.id === c.coach_id)) {
      // Coach actuel désactivé : on l'affiche pour ne pas réaffecter le client par mégarde
      const { data: cur } = await supabase.from("profiles").select("id, full_name, email").eq("id", c.coach_id).maybeSingle();
      const p = cur as Pick<Profile, "id" | "full_name" | "email"> | null;
      coaches = [{ id: c.coach_id, full_name: `${p?.full_name || p?.email || "Coach"} (compte désactivé)`, email: p?.email ?? "" }, ...coaches];
    }
  }
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader back={<BackLink href={`/clients/${id}`} label={c.full_name} />} title="Modifier le client" />
      <ClientForm action={updateClientAction} client={c} coaches={coaches} meId={me.id} />
    </div>
  );
}
