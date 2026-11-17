import { redirect } from "next/navigation";
import { Hourglass, ShieldCheck } from "lucide-react";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Client, Message, Profile } from "@/lib/types";
import { Avatar, Card, Empty, PageHeader } from "@/components/ui";
import { Thread } from "@/components/business/thread";
import { Composer } from "@/components/business/composer";

export const metadata = { title: "Messages" };

export default async function MyMessagesPage() {
  const me = await getProfile();
  if (me.role !== "client") redirect("/messages");
  const supabase = await createClient();
  const { data: cData } = await supabase.from("clients").select("*").eq("user_id", me.id).maybeSingle();

  if (!cData) {
    return (
      <>
        <PageHeader title="Messages" />
        <Card>
          <Empty
            icon={<Hourglass className="size-6" />}
            title="Ton dossier n'est pas encore relié"
            text="Dès que ton coach aura relié ton compte à ta fiche, tu pourras lui écrire ici."
          />
        </Card>
      </>
    );
  }
  const client = cData as Client;

  // Ouvrir le fil = marquer les messages du coach comme lus (+ notifications liées)
  await Promise.all([
    supabase.from("messages").update({ read_at: new Date().toISOString() }).eq("client_id", client.id).eq("from_client", false).is("read_at", null),
    supabase.from("notifications").update({ read: true }).eq("user_id", me.id).eq("link", "/moi/messages").eq("read", false),
  ]);

  const [{ data: mData }, { data: pData }] = await Promise.all([
    supabase.from("messages").select("*").eq("client_id", client.id).order("created_at"),
    supabase.from("profiles").select("*").eq("id", client.coach_id).maybeSingle(),
  ]);
  const messages = (mData ?? []) as Message[];
  const coach = pData as Profile | null;
  const coachName = coach?.full_name || "Ton coach";

  return (
    <>
      <PageHeader title="Messages" subtitle="Pose tes questions à ton coach, il te répond ici." />
      <Card className="flex h-[calc(100dvh-250px)] min-h-[440px] flex-col overflow-hidden lg:h-[calc(100dvh-190px)]">
        <header className="flex items-center gap-3 border-b border-line bg-white px-4 py-3 sm:px-5">
          <span className="relative">
            <Avatar name={coachName} size={42} />
            <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full bg-emerald-500 ring-2 ring-white" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-[15px] font-bold text-ink">{coachName}</p>
            <p className="text-xs text-muted">Ton coach · Complexe Moov&apos;Up</p>
          </div>
          <span className="hidden items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand-600 sm:inline-flex">
            <ShieldCheck className="size-3.5" /> Conversation privée
          </span>
        </header>
        <Thread messages={messages} mine="client" emptyText="Écris ton premier message : une question sur ton programme, une séance à décaler…" />
        <Composer clientId={client.id} placeholder="Écris à ton coach…" />
      </Card>
    </>
  );
}
