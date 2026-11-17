import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import { BackLink } from "@/components/back-link";
import { HealthForm } from "@/components/health-form";

export const metadata = { title: "Bilan de santé" };

export default async function BilanPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ type?: string }> }) {
  const [{ id }, { type }] = await Promise.all([params, searchParams]);
  await requireStaff();
  const supabase = await createClient();
  const [{ data: c }, { count }] = await Promise.all([
    supabase.from("clients").select("full_name").eq("id", id).single(),
    supabase.from("health_checks").select("id", { count: "exact", head: true }).eq("client_id", id).eq("kind", "initial"),
  ]);
  if (!c) notFound();
  const kind = type === "initial" || type === "hebdo" || type === "mensuel" ? type : count ? "mensuel" : "initial";
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        back={<BackLink href={`/clients/${id}?tab=sante`} label={c.full_name} />}
        title={kind === "initial" ? "Bilan initial" : "Nouveau bilan"}
        subtitle={`${c.full_name} · mesures, bien-être et santé`}
      />
      <HealthForm clientId={id} kind={kind} mode="coach" cancelHref={`/clients/${id}?tab=sante`} />
    </div>
  );
}
