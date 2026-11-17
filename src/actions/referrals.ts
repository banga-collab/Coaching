"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { parseNum, str } from "@/lib/utils";
import type { FormState } from "@/components/action-form";
import type { Client, Referral, Settings } from "@/lib/types";

function refresh() {
  revalidatePath("/parrainage");
  revalidatePath("/moi/parrainage");
}

/* ================= Réglages (admin) ================= */
export async function updateReferralSettingsAction(_: FormState, fd: FormData): Promise<FormState> {
  const me = await getProfile();
  if (me.role !== "admin") return { error: "Seul un administrateur peut modifier ces réglages." };
  const reward = parseNum(fd.get("referral_reward_mad"));
  const pct = parseNum(fd.get("referral_discount_pct"));
  if (reward === null || reward < 0 || reward > 100000) return { error: "Récompense invalide (en MAD)." };
  if (pct === null || pct < 0 || pct > 100) return { error: "La remise doit être comprise entre 0 et 100 %." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("settings")
    .update({ referral_reward_mad: Math.round(reward * 100) / 100, referral_discount_pct: Math.round(pct) })
    .eq("id", 1);
  if (error) return { error: error.message };
  refresh();
  redirect("/parrainage?ok=reglages");
}

/* ================= Relier le filleul à une fiche client ================= */
export async function linkReferralAction(fd: FormData) {
  const me = await getProfile();
  if (me.role === "client") return;
  const id = String(fd.get("id") ?? "");
  const client_id = str(fd.get("client_id"));
  if (!id || !client_id) return;
  const supabase = await createClient();
  const { data } = await supabase.from("referrals").select("*").eq("id", id).maybeSingle();
  const r = data as Referral | null;
  if (!r || r.referrer_client_id === client_id) return;
  await supabase.from("referrals").update({ referred_client_id: client_id, status: r.status === "recompense" ? "recompense" : "inscrit" }).eq("id", id);
  refresh();
}

/* ================= Récompense ================= */
export async function markReferralRewardedAction(fd: FormData) {
  const me = await getProfile();
  if (me.role === "client") return;
  const id = String(fd.get("id") ?? "");
  const supabase = await createClient();
  const [{ data }, { data: sData }] = await Promise.all([
    supabase.from("referrals").select("*").eq("id", id).maybeSingle(),
    supabase.from("settings").select("*").eq("id", 1).maybeSingle(),
  ]);
  const r = data as Referral | null;
  if (!r || r.status === "recompense") return;
  const reward = Number((sData as Partial<Settings> | null)?.referral_reward_mad ?? 200);
  await supabase.from("referrals").update({ status: "recompense", reward_mad: reward }).eq("id", id);

  // Prévenir le parrain (peut être refusé par la RLS : on ignore l'erreur)
  const { data: cData } = await supabase.from("clients").select("*").eq("id", r.referrer_client_id).maybeSingle();
  const referrer = cData as Client | null;
  if (referrer?.user_id) {
    await supabase.from("notifications").insert({
      user_id: referrer.user_id,
      title: "Ta récompense de parrainage est disponible 🎁",
      body: `Merci d'avoir recommandé ${r.referred_name} ! ${new Intl.NumberFormat("fr-FR").format(reward)} MAD t'attendent.`,
      link: "/moi/parrainage",
      kind: "info",
      read: false,
    });
  }
  refresh();
}

/* ================= Recommander un ami ================= */
export async function createReferralAction(_: FormState, fd: FormData): Promise<FormState> {
  const me = await getProfile();
  const name = str(fd.get("referred_name"))?.slice(0, 120);
  const phone = str(fd.get("referred_phone"))?.slice(0, 30) ?? null;
  if (!name || name.length < 2) return { error: "Indique le prénom et le nom de ton ami(e)." };
  if (phone && phone.replace(/\D/g, "").length < 9) return { error: "Le numéro de téléphone semble incomplet." };

  const supabase = await createClient();
  let referrerId: string | null = null;
  if (me.role === "client") {
    const { data } = await supabase.from("clients").select("*").eq("user_id", me.id).maybeSingle();
    referrerId = (data as Client | null)?.id ?? null;
    if (!referrerId) return { error: "Ton dossier n'est pas encore relié à ton compte." };
  } else {
    referrerId = str(fd.get("referrer_client_id"));
    if (!referrerId) return { error: "Choisis le parrain." };
  }

  const { data: dup } = await supabase.from("referrals").select("*").eq("referrer_client_id", referrerId);
  const norm = (v: string | null) => (v ?? "").replace(/\D/g, "").slice(-9);
  if (phone && ((dup ?? []) as Referral[]).some((r) => norm(r.referred_phone) === norm(phone))) {
    return { error: "Tu as déjà recommandé cette personne 😉" };
  }

  const { error } = await supabase.from("referrals").insert({
    referrer_client_id: referrerId,
    referred_name: name,
    referred_phone: phone,
    referred_client_id: null,
    status: "en_attente",
    reward_mad: null,
  });
  if (error) return { error: error.message };
  refresh();
  redirect(me.role === "client" ? "/moi/parrainage?ok=1" : "/parrainage?ok=ajout");
}
