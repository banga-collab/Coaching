import { redirect } from "next/navigation";
import { CheckCircle2, ClipboardCheck, Clock, Pencil } from "lucide-react";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Client } from "@/lib/types";
import type { SportAssessment } from "@/lib/types-bilan";
import { age, fmtDate } from "@/lib/utils";
import { normalizeAnswers } from "@/lib/bilan";
import { Card, Empty, LinkButton, PageHeader } from "@/components/ui";
import { BackLink } from "@/components/back-link";
import { BilanAnswersView } from "@/components/bilan/bilan-view";

export const metadata = { title: "Mon bilan sportif" };

export default async function MyBilanPage({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const sp = await searchParams;
  const me = await getProfile();
  const supabase = await createClient();
  const { data: cData } = await supabase.from("clients").select("*").eq("user_id", me.id).maybeSingle();
  if (!cData) redirect("/moi");
  const c = cData as Client;
  const { data } = await supabase.from("sport_assessments").select("*").eq("client_id", c.id).order("done_on", { ascending: false }).order("created_at", { ascending: false }).limit(1).maybeSingle();
  const b = data as SportAssessment | null;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        back={<BackLink href="/moi" label="Ma progression" />}
        title="Mon bilan sportif"
        subtitle="Ton profil sportif et ta santé, pour un programme adapté et sans risque"
        actions={
          <LinkButton href="/moi/bilan/remplir">
            <Pencil className="size-4" /> {b ? "Mettre à jour" : "Remplir mon bilan"}
          </LinkButton>
        }
      />
      {sp.ok && (
        <p className="mb-5 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          <CheckCircle2 className="size-4" /> Merci ! Ton coach va relire tes réponses.
        </p>
      )}
      {!b ? (
        <Card>
          <Empty
            icon={<ClipboardCheck className="size-6" />}
            title="Pas encore de bilan sportif"
            text="Réponds à quelques questions sur ton passé sportif, ton mode de vie et ta santé (5 minutes). Ton coach s'en sert pour adapter tes séances."
            action={<LinkButton href="/moi/bilan/remplir">Commencer</LinkButton>}
          />
        </Card>
      ) : (
        <div className="space-y-5">
          <div className={b.status === "a_valider" ? "flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900" : "flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800"}>
            {b.status === "a_valider" ? <Clock className="size-4" /> : <CheckCircle2 className="size-4" />}
            Bilan du {fmtDate(b.done_on)} · {b.status === "a_valider" ? "à valider par le coach" : "validé par ton coach"}
          </div>
          <BilanAnswersView a={normalizeAnswers(b.answers)} sex={c.sex} ageYears={age(c.birth_date)} showCoach={false} doneOn={b.done_on} />
        </div>
      )}
    </div>
  );
}
