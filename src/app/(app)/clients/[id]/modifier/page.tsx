import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
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
  const { data } = await supabase.from("clients").select("*").eq("id", id).single();
  if (!data) notFound();
  let coaches: Pick<Profile, "id" | "full_name" | "email">[] | undefined;
  if (me.role === "admin") {
    const r = await supabase.from("profiles").select("id, full_name, email").in("role", ["admin", "coach"]).order("full_name");
    coaches = r.data ?? [];
  }
  const c = data as Client;
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader back={<BackLink href={`/clients/${id}`} label={c.full_name} />} title="Modifier le client" />
      <ClientForm action={updateClientAction} client={c} coaches={coaches} meId={me.id} />
    </div>
  );
}
