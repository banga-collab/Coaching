import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import { BackLink } from "@/components/back-link";
import { HealthForm } from "@/components/health-form";

export const metadata = { title: "Mon check-in" };

export default async function CheckinPage() {
  const me = await getProfile();
  const supabase = await createClient();
  const { data } = await supabase.from("clients").select("id").eq("user_id", me.id).maybeSingle();
  if (!data) redirect("/moi");
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader back={<BackLink href="/moi" label="Ma progression" />} title="Check-in de la semaine" subtitle="Réponds honnêtement : ça aide ton coach à adapter ton programme." />
      <HealthForm clientId={data.id} kind="hebdo" mode="client" cancelHref="/moi" />
    </div>
  );
}
