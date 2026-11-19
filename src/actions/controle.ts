"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { serviceClient } from "@/lib/supabase/service";
import { verifyCode } from "@/lib/pointage";
import { ESPACE_LABEL, espaceOf } from "@/lib/espace";
import { BUSY_STATUSES, todayAgadir } from "@/lib/planning";
import type { CoachPointage, Espace, Profile, Session } from "@/lib/types";
import { agadirToIso, fmtDate, fmtTime } from "@/lib/utils";

export type PointageState = { ok?: string; warning?: string; error?: string } | undefined;
export type FeedbackState = { ok?: boolean; error?: string } | undefined;

const LATE_ALERT_MIN = 15;

/** Destinataires des alertes : admins actifs + head coachs du même espace */
async function controlRecipients(db: SupabaseClient, espace: Espace, exclude?: string) {
  const { data } = await db.from("profiles").select("id, role, active, espace").in("role", ["admin", "head_coach"]);
  return ((data ?? []) as Pick<Profile, "id" | "role" | "active" | "espace">[])
    .filter((p) => p.active !== false && p.id !== exclude && (p.role === "admin" || espaceOf(p) === espace))
    .map((p) => p.id);
}

async function alert(db: SupabaseClient, ids: string[], title: string, body: string, link: string) {
  if (!ids.length) return;
  await db.from("notifications").insert(ids.map((user_id) => ({ user_id, title, body, link, kind: "alerte", read: false })));
}

/**
 * Pointage d'arrivée / de départ avec le code de la borne de l'accueil.
 * Le code change toutes les 30 s : il faut être devant l'écran pour le connaître.
 * Écriture par le serveur (clé service) : la base refuse un pointage envoyé directement par un compte.
 */
export async function pointageAction(_: PointageState, fd: FormData): Promise<PointageState> {
  const me = await getProfile();
  if (me.role === "client") return { error: "Réservé à l'équipe." };
  const espace = verifyCode(String(fd.get("code") ?? ""));
  if (!espace) return { error: "Code incorrect ou expiré. Tape le code affiché maintenant sur l'écran de l'accueil (il change toutes les 30 secondes)." };
  const db = serviceClient();
  if (!db) return { error: "Pointage indisponible : la clé SUPABASE_SERVICE_ROLE_KEY n'est pas configurée sur le serveur." };

  const nowMs = Date.now();
  const now = new Date(nowMs).toISOString();
  const dayStart = agadirToIso(todayAgadir(nowMs), "00:00");
  const dayEnd = new Date(new Date(dayStart).getTime() + 86400000).toISOString();
  const [{ data: pData }, { data: sData }] = await Promise.all([
    db.from("coach_pointages").select("*").eq("coach_id", me.id).gte("at", dayStart).order("at", { ascending: false }),
    db.from("sessions").select("id, starts_at, duration_min, status").eq("coach_id", me.id).gte("starts_at", dayStart).lt("starts_at", dayEnd).order("starts_at"),
  ]);
  const today = (pData ?? []) as CoachPointage[];
  const last = today[0];
  const wanted = String(fd.get("kind") ?? "");
  const kind: CoachPointage["kind"] = wanted === "arrivee" || wanted === "depart" ? wanted : last?.kind === "arrivee" ? "depart" : "arrivee";
  const label = kind === "arrivee" ? "Arrivée" : "Départ";

  // Double clic / double scan : on ne crée pas un second pointage identique
  if (last && last.kind === kind && nowMs - new Date(last.at).getTime() < 120000) {
    return { ok: `${label} déjà enregistrée à ${fmtTime(last.at)} · ${ESPACE_LABEL[last.espace]}.` };
  }
  const { error } = await db.from("coach_pointages").insert({ coach_id: me.id, espace, kind, at: now, method: fd.get("method") === "qr" ? "qr" : "code" });
  if (error) return { error: `Pointage impossible : ${error.message}` };

  const sessions = ((sData ?? []) as Pick<Session, "id" | "starts_at" | "duration_min" | "status">[]).filter((s) => s.status !== "annulee" && s.status !== "refusee");
  const name = me.full_name || me.email;
  let warning: string | undefined;
  if (kind === "arrivee" && !today.some((p) => p.kind === "arrivee")) {
    const first = sessions[0];
    const late = first ? Math.round((nowMs - new Date(first.starts_at).getTime()) / 60000) : 0;
    if (first && late >= LATE_ALERT_MIN) {
      warning = `Retard de ${late} min sur ta première séance (${fmtTime(first.starts_at)}). La direction est prévenue.`;
      await alert(
        db,
        await controlRecipients(db, espace, me.id),
        `Arrivée en retard · ${name}`,
        `Pointée à ${fmtTime(now)} · 1re séance à ${fmtTime(first.starts_at)} (${late} min de retard) · ${ESPACE_LABEL[espace]}`,
        `/admin/controle?espace=${espace}`,
      );
    }
  }
  if (kind === "depart") {
    const left = sessions.filter((s) => BUSY_STATUSES.includes(s.status) && new Date(s.starts_at).getTime() > nowMs);
    if (left.length) {
      warning = `Il te reste ${left.length} séance${left.length > 1 ? "s" : ""} aujourd'hui (prochaine à ${fmtTime(left[0]!.starts_at)}). La direction est prévenue.`;
      await alert(
        db,
        await controlRecipients(db, espace, me.id),
        `Départ avant la fin · ${name}`,
        `Départ pointé à ${fmtTime(now)} alors qu'il reste ${left.length} séance${left.length > 1 ? "s" : ""} (prochaine à ${fmtTime(left[0]!.starts_at)}) · ${ESPACE_LABEL[espace]}`,
        `/admin/controle?espace=${espace}`,
      );
    }
  }
  revalidatePath("/pointage");
  revalidatePath("/");
  revalidatePath("/admin/controle");
  return { ok: `${label} enregistrée à ${fmtTime(now)} · ${ESPACE_LABEL[espace]}.`, warning };
}

/**
 * La cliente confirme qu'une séance « réalisée » a bien eu lieu et peut la noter.
 * Réponse envoyée à la direction seulement (la coach ne la voit pas).
 * « Non » ou une note de 1 ou 2 : alerte immédiate à la direction.
 */
export async function confirmSessionAction(_: FeedbackState, fd: FormData): Promise<FeedbackState> {
  const me = await getProfile();
  if (me.role !== "client") return { error: "Réservé aux adhérents." };
  const supabase = await createClient();
  const { data: cData } = await supabase.from("clients").select("id, full_name").eq("user_id", me.id).maybeSingle();
  const client = cData as { id: string; full_name: string } | null;
  if (!client) return { error: "Ton dossier n'est pas encore relié." };

  const sessionId = String(fd.get("session_id") ?? "");
  const { data: sData } = await supabase.from("sessions").select("*").eq("id", sessionId).eq("client_id", client.id).maybeSingle();
  const s = sData as Session | null;
  if (!s || s.status !== "realisee") return { error: "Séance introuvable." };
  const { data: existing } = await supabase.from("session_feedback").select("id").eq("session_id", s.id).maybeSingle();
  if (existing) return { ok: true };

  const answer = String(fd.get("happened") ?? "");
  if (answer !== "oui" && answer !== "non") return { error: "Réponds d'abord : la séance a-t-elle eu lieu ?" };
  const happened = answer === "oui";
  const r = Number(fd.get("rating") ?? 0);
  const rating = Number.isInteger(r) && r >= 1 && r <= 5 ? r : null;
  const comment = String(fd.get("comment") ?? "").trim().slice(0, 1000) || null;
  if (!happened && !comment) return { error: "Dis-nous en quelques mots ce qui s'est passé." };

  const { error } = await supabase.from("session_feedback").insert({ session_id: s.id, client_id: client.id, coach_id: s.coach_id, happened, rating: happened ? rating : null, comment });
  if (error) return { error: `Envoi impossible : ${error.message}` };

  if (!happened || (rating !== null && rating <= 2)) {
    const db = serviceClient() ?? supabase;
    const { data: coach } = await db.from("profiles").select("full_name, email, espace").eq("id", s.coach_id).maybeSingle();
    const c = coach as Pick<Profile, "full_name" | "email" | "espace"> | null;
    const espace = espaceOf(c);
    const when = `${fmtDate(s.starts_at, { weekday: "short", day: "numeric", month: "short" })} à ${fmtTime(s.starts_at)}`;
    await alert(
      db,
      await controlRecipients(db, espace),
      happened ? `Avis négatif (${rating}/5) · ${c?.full_name ?? "Coach"}` : `Séance contestée · ${c?.full_name ?? "Coach"}`,
      `${client.full_name} · ${s.type} du ${when}${happened ? "" : " : « n'a pas eu lieu »"}${comment ? ` — ${comment.slice(0, 140)}` : ""}`,
      `/admin/controle?espace=${espace}`,
    );
  }
  revalidatePath("/moi");
  revalidatePath("/admin/controle");
  return { ok: true };
}
