import { Bot, Cpu, Sparkles } from "lucide-react";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { aiEnabled } from "@/lib/ai";
import type { Client } from "@/lib/types";
import { Empty, LinkButton, PageHeader } from "@/components/ui";
import { AssistantWorkspace, type PickClient } from "./workspace";

export const metadata = { title: "Assistant IA" };

export default async function AssistantPage({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  const [{ client: initial }] = await Promise.all([searchParams, requireStaff()]);
  const supabase = await createClient();
  const { data } = await supabase.from("clients").select("id, full_name, goal, status, phone").order("full_name");
  const clients: PickClient[] = ((data ?? []) as Client[])
    .sort((a, b) => (a.status === "termine" ? 1 : 0) - (b.status === "termine" ? 1 : 0) || a.full_name.localeCompare(b.full_name, "fr"))
    .map((c) => ({ id: c.id, name: c.full_name, goal: c.goal, status: c.status, phone: c.phone }));
  const live = aiEnabled();

  return (
    <>
      <PageHeader
        title={
          <span className="inline-flex items-center gap-3">
            Assistant IA
            <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-accent-500 text-white shadow-sm">
              <Sparkles className="size-[18px]" />
            </span>
          </span>
        }
        subtitle="Synthèses, messages et ajustements de programme générés à partir des données de vos clients."
        actions={
          live ? (
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-100">
              <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" /> Claude connecté
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 ring-1 ring-inset ring-slate-200" title="Ajoutez ANTHROPIC_API_KEY pour activer Claude">
              <Cpu className="size-3.5" /> Mode automatique (sans IA)
            </span>
          )
        }
      />
      {clients.length ? (
        <AssistantWorkspace clients={clients} initialId={clients.some((c) => c.id === initial) ? initial! : null} />
      ) : (
        <div className="rounded-2xl border border-line bg-white shadow-card">
          <Empty icon={<Bot className="size-6" />} title="Aucun client" text="Ajoutez un client pour utiliser l'assistant." action={<LinkButton href="/clients/nouveau">Nouveau client</LinkButton>} />
        </div>
      )}
    </>
  );
}
