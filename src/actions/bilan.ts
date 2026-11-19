"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getProfile, isActiveStaff, isManager } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { age } from "@/lib/utils";
import { answersFromForm, computeRisk, keyColumns } from "@/lib/bilan";
import type { FormState } from "@/components/action-form";
import type { Profile } from "@/lib/types";

type Db = Awaited<ReturnType<typeof createClient>>;

/**
 * Droits sur les bilans sportifs (même règle qu'en base, supabase/v5-securite.sql) :
 * - lecture : tout le personnel (pages) ; l'adhérent, les siens ;
 * - création : le coach référent, un manager, ou un coach à qui une séance du client est affectée ;
 * - modification / validation : le coach référent, l'auteur du bilan, ou un manager ;
 * - suppression : managers (admin / head coach) uniquement.
 */
async function canWriteForClient(supabase: Db, me: Profile, client: { id: string; coach_id: string }) {
  if (!isActiveStaff(me)) return false;
  if (isManager(me.role) || client.coach_id === me.id) return true;
  const { data } = await supabase.from("sessions").select("id, status").eq("client_id", client.id).eq("coach_id", me.id);
  return ((data ?? []) as { status: string }[]).some((s) => s.status !== "refusee" && s.status !== "annulee");
}

async function canEditBilan(supabase: Db, me: Profile, bilanId: string, clientId: string) {
  if (!isActiveStaff(me)) return null;
  const [{ data: b }, { data: c }] = await Promise.all([
    supabase.from("sport_assessments").select("id, client_id, created_by").eq("id", bilanId).maybeSingle(),
    supabase.from("clients").select("id, coach_id").eq("id", clientId).maybeSingle(),
  ]);
  const bilan = b as { id: string; client_id: string; created_by: string | null } | null;
  const client = c as { id: string; coach_id: string } | null;
  if (!bilan || !client || bilan.client_id !== client.id) return null;
  return isManager(me.role) || client.coach_id === me.id || bilan.created_by === me.id ? bilan : null;
}

function refresh(clientId: string) {
  revalidatePath(`/clients/${clientId}/bilan-sportif`);
  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/moi/bilan");
  revalidatePath("/evaluations");
}

/**
 * Enregistre un bilan sportif.
 * - Personnel : création ou modification (bilan_id), statut « valide ».
 * - Adhérent : création uniquement, pour son propre dossier, statut « à valider » (sans tests ni notes coach).
 */
export async function saveBilanAction(_: FormState, fd: FormData): Promise<FormState> {
  const me = await getProfile();
  const staff = isActiveStaff(me);
  const clientId = String(fd.get("client_id") ?? "");
  const bilanId = staff ? String(fd.get("bilan_id") ?? "") : "";
  if (!clientId) return { error: "Client manquant." };
  if (fd.get("consent") !== "on") return { error: "Le consentement est nécessaire pour enregistrer des données de santé." };

  const supabase = await createClient();
  const { data: c } = await supabase.from("clients").select("id, user_id, coach_id, sex, birth_date").eq("id", clientId).maybeSingle();
  if (!c) return { error: "Client introuvable." };
  if (!staff && (me.role !== "client" || c.user_id !== me.id)) return { error: "Accès refusé." };
  if (staff) {
    if (bilanId) {
      if (!(await canEditBilan(supabase, me, bilanId, clientId)))
        return { error: "Seuls le coach du client, l'auteur du bilan et les managers peuvent le modifier." };
    } else if (!(await canWriteForClient(supabase, me, c as { id: string; coach_id: string }))) {
      return { error: "Seuls le coach du client, un coach qui a une séance avec lui et les managers peuvent créer un bilan." };
    }
  }

  const answers = answersFromForm(fd, { sex: c.sex, withTests: staff, withCoach: staff });
  const doneOn = (staff && /^\d{4}-\d{2}-\d{2}$/.test(String(fd.get("done_on") ?? "")) ? String(fd.get("done_on")) : null) ?? new Date().toISOString().slice(0, 10);
  const now = new Date(doneOn);
  const risk = computeRisk(answers, { sex: c.sex, age: age(c.birth_date), now });
  const stamp = new Date().toISOString();
  const row = {
    client_id: clientId,
    done_on: doneOn,
    ...keyColumns(answers, risk, now),
    answers,
    updated_at: stamp,
  };

  if (bilanId) {
    const { error } = await supabase
      .from("sport_assessments")
      .update({ ...row, status: "valide", validated_by: me.id, validated_at: stamp })
      .eq("id", bilanId)
      .eq("client_id", clientId);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from("sport_assessments").insert({
      ...row,
      created_by: me.id,
      status: staff ? "valide" : "a_valider",
      validated_by: staff ? me.id : null,
      validated_at: staff ? stamp : null,
    });
    if (error) return { error: error.message };
  }
  refresh(clientId);
  redirect(staff ? `/clients/${clientId}/bilan-sportif?ok=1` : "/moi/bilan?ok=1");
}

/** Le coach valide un questionnaire rempli par l'adhérent. */
export async function validateBilanAction(fd: FormData) {
  const me = await getProfile();
  const id = String(fd.get("id") ?? "");
  const clientId = String(fd.get("client_id") ?? "");
  const supabase = await createClient();
  if (!(await canEditBilan(supabase, me, id, clientId))) return;
  await supabase.from("sport_assessments").update({ status: "valide", validated_by: me.id, validated_at: new Date().toISOString() }).eq("id", id).eq("client_id", clientId);
  refresh(clientId);
  redirect(`/clients/${clientId}/bilan-sportif?b=${id}`);
}

/** Suppression : managers (admin / head coach) uniquement. */
export async function deleteBilanAction(fd: FormData) {
  const me = await getProfile();
  if (!isActiveStaff(me) || !isManager(me.role)) return;
  const id = String(fd.get("id") ?? "");
  const clientId = String(fd.get("client_id") ?? "");
  const supabase = await createClient();
  await supabase.from("sport_assessments").delete().eq("id", id).eq("client_id", clientId);
  refresh(clientId);
  redirect(`/clients/${clientId}/bilan-sportif`);
}
