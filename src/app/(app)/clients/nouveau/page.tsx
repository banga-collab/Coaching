import { isManager, listActiveCoaches, requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";
import { PageHeader } from "@/components/ui";
import { BackLink } from "@/components/back-link";
import { ClientForm } from "../client-form";
import { createClientAction } from "../../actions";

export const metadata = { title: "Nouveau client" };

export default async function NewClientPage() {
  const me = await requireStaff();
  // Admin et head coach choisissent le coach référent parmi le personnel actif ; un coach se l'attribue.
  let coaches: Pick<Profile, "id" | "full_name" | "email">[] | undefined;
  if (isManager(me.role)) {
    const supabase = await createClient();
    coaches = await listActiveCoaches(supabase);
  }
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader back={<BackLink href="/clients" label="Clients" />} title="Nouveau client" subtitle="Les informations de base pour démarrer le suivi." />
      <ClientForm action={createClientAction} coaches={coaches} meId={me.id} />
    </div>
  );
}
