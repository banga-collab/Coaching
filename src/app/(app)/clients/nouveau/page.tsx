import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";
import { PageHeader } from "@/components/ui";
import { BackLink } from "@/components/back-link";
import { ClientForm } from "../client-form";
import { createClientAction } from "../../actions";

export const metadata = { title: "Nouveau client" };

export default async function NewClientPage() {
  const me = await requireStaff();
  let coaches: Pick<Profile, "id" | "full_name" | "email">[] | undefined;
  if (me.role === "admin") {
    const supabase = await createClient();
    const { data } = await supabase.from("profiles").select("id, full_name, email").in("role", ["admin", "coach"]).order("full_name");
    coaches = data ?? [];
  }
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader back={<BackLink href="/clients" label="Clients" />} title="Nouveau client" subtitle="Les informations de base pour démarrer le suivi." />
      <ClientForm action={createClientAction} coaches={coaches} meId={me.id} />
    </div>
  );
}
