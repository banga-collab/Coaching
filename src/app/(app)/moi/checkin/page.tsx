import { redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import { BackLink } from "@/components/back-link";
import { HealthForm } from "@/components/health-form";
import { getT } from "@/lib/i18n";

export const metadata = { title: "Mon check-in" };

export default async function CheckinPage() {
  const tr = await getT();
  const me = await getProfile();
  const supabase = await createClient();
  const { data } = await supabase.from("clients").select("id").eq("user_id", me.id).maybeSingle();
  if (!data) redirect("/moi");
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader back={<BackLink href="/moi" label={tr("nav.moi")} />} title={tr("moi.checkin.title")} subtitle={tr("moi.checkin.sub")} />
      <HealthForm clientId={data.id} kind="hebdo" mode="client" cancelHref="/moi" />
    </div>
  );
}
