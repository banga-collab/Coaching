import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import { BackLink } from "@/components/back-link";
import { SessionForm } from "../session-form";

export const metadata = { title: "Nouvelle séance" };

export default async function NewSessionPage({ searchParams }: { searchParams: Promise<{ client?: string; date?: string }> }) {
  const { client, date } = await searchParams;
  await requireStaff();
  const supabase = await createClient();
  const { data } = await supabase.from("clients").select("id, full_name").neq("status", "termine").order("full_name");
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader back={<BackLink href="/seances" label="Séances" />} title="Nouvelle séance" subtitle="Planifie une séance ou enregistre une séance déjà faite." />
      <SessionForm clients={data ?? []} defaultClient={client} defaultDate={date} />
    </div>
  );
}
