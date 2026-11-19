"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { checkActiveCoach, getProfile, isManager } from "@/lib/auth";
import type { Profile, Session, SessionStatus } from "@/lib/types";
import {
  BUSY_STATUSES,
  allowedStatuses,
  canFinish,
  canMarkAbsent,
  canStart,
  cappedEndIso,
  firstName,
  plannedEnd,
  shiftDate,
  staffName,
  timeReached,
  toMin,
  verifySlot,
  visibleToMember,
} from "@/lib/planning";
import { SESSION_LABEL, agadirToIso, fmtDate, fmtTime, parseNum, str } from "@/lib/utils";
import type { FormState } from "@/components/action-form";
import { createQuickClient, loadSessionTypes, readNewClient, readPrice, resolveSessionType } from "@/lib/session-extras";

/** État renvoyé aux formulaires du planning : erreur, avertissement, coachs libres suggérés, succès */
export type PlanState = { error?: string; warning?: string; ok?: string; free?: { id: string; name: string }[]; sessionId?: string } | undefined;

const int = (v: FormDataEntryValue | null) => {
  const n = parseNum(v);
  return n === null ? null : Math.round(n);
};
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const STATUSES: SessionStatus[] = ["planifiee", "acceptee", "refusee", "reportee", "en_cours", "realisee", "absent", "annulee"];
const when = (iso: string) => `${fmtDate(iso, { weekday: "short", day: "numeric", month: "short" })} à ${fmtTime(iso)}`;
const dayLabel = (date: string) => fmtDate(`${date}T12:00:00Z`, { day: "numeric", month: "short" });

function refresh(id?: string | null) {
  revalidatePath("/seances");
  revalidatePath("/planning");
  revalidatePath("/");
  revalidatePath("/moi");
  if (id) revalidatePath(`/seances/${id}`);
}

async function staffOnly() {
  const me = await getProfile();
  if (me.role === "client") throw new Error("Accès refusé.");
  return me;
}

type Notif = { user_id: string | null | undefined; title: string; body?: string | null; link?: string | null };
async function notify(supabase: SupabaseClient, me: Profile, rows: Notif[]) {
  const seen = new Set<string>();
  const list = rows
    .filter((r): r is Notif & { user_id: string } => !!r.user_id && r.user_id !== me.id && !seen.has(r.user_id) && !!seen.add(r.user_id))
    .map((r) => ({ user_id: r.user_id, title: r.title, body: r.body ?? null, link: r.link ?? null, kind: "reservation", read: false }));
  if (list.length) await supabase.from("notifications").insert(list);
}

/** Admins et head coachs actifs */
async function managerIds(supabase: SupabaseClient) {
  const { data } = await supabase.from("profiles").select("id, role, active").in("role", ["admin", "head_coach"]);
  return ((data ?? []) as { id: string; active?: boolean | null }[]).filter((p) => p.active !== false).map((p) => p.id);
}

async function loadSession(supabase: SupabaseClient, id: string | null) {
  if (!id) return null;
  const { data } = await supabase.from("sessions").select("*").eq("id", id).maybeSingle();
  return (data as Session | null) ?? null;
}
async function loadClient(supabase: SupabaseClient, id: string) {
  const { data } = await supabase.from("clients").select("id, full_name, user_id, coach_id").eq("id", id).maybeSingle();
  return data as { id: string; full_name: string; user_id: string | null; coach_id: string } | null;
}
async function profileName(supabase: SupabaseClient, id: string | null | undefined) {
  if (!id) return null;
  const { data } = await supabase.from("profiles").select("full_name, email").eq("id", id).maybeSingle();
  return data ? staffName(data as Pick<Profile, "full_name" | "email">) : null;
}

/**
 * Prix indicatif (DH) de la séance : champ « Prix (DH) » du formulaire,
 * ou à défaut le prix par défaut du type de séance. Information seulement (aucun paiement).
 */
async function priceFor(supabase: SupabaseClient, fd: FormData, type: string): Promise<{ price: number | null } | { error: string }> {
  if (fd.has("price_mad")) return readPrice(fd.get("price_mad"));
  const t = (await loadSessionTypes(supabase, true)).find((x) => x.name === type);
  return { price: t?.price_mad ?? null };
}

/* =====================================================================
   Disponibilités et congés
   ===================================================================== */
function targetCoach(me: Profile, fd: FormData) {
  const wanted = str(fd.get("coach_id"));
  return isManager(me.role) && wanted ? wanted : me.id;
}

export async function addAvailabilityAction(_: FormState, fd: FormData): Promise<FormState> {
  const me = await staffOnly();
  const coach_id = targetCoach(me, fd);
  const days = fd.getAll("weekday").map(Number).filter((d) => d >= 1 && d <= 7);
  const start_time = String(fd.get("start_time") ?? "");
  const end_time = String(fd.get("end_time") ?? "");
  if (!days.length) return { error: "Coche au moins un jour." };
  if (!HHMM.test(start_time) || !HHMM.test(end_time)) return { error: "Heures invalides (format HH:MM)." };
  if (toMin(end_time) <= toMin(start_time)) return { error: "L'heure de fin doit être après l'heure de début." };
  const supabase = await createClient();
  if (coach_id !== me.id) {
    const bad = await checkActiveCoach(supabase, coach_id);
    if (bad) return { error: bad };
  }
  const { data } = await supabase.from("coach_availability").select("*").eq("coach_id", coach_id);
  const existing = (data ?? []) as { weekday: number; start_time: string; end_time: string }[];
  const clash = days.find((d) => existing.some((a) => a.weekday === d && toMin(a.start_time) < toMin(end_time) && toMin(start_time) < toMin(a.end_time)));
  if (clash) {
    const names = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];
    return { error: `Ce créneau chevauche un créneau existant le ${names[clash - 1]}. Supprime-le ou choisis d'autres heures.` };
  }
  const { error } = await supabase.from("coach_availability").insert(days.map((weekday) => ({ coach_id, weekday, start_time, end_time })));
  if (error) return { error: error.message };
  revalidatePath("/disponibilites");
  revalidatePath("/planning");
  return undefined;
}

export async function deleteAvailabilityAction(fd: FormData) {
  const me = await staffOnly();
  const supabase = await createClient();
  const id = String(fd.get("id") ?? "");
  let q = supabase.from("coach_availability").delete().eq("id", id);
  if (!isManager(me.role)) q = q.eq("coach_id", me.id);
  await q;
  revalidatePath("/disponibilites");
  revalidatePath("/planning");
}

/**
 * Congé : refuse un chevauchement avec une période existante (doublon compris).
 * S'il y a déjà des séances pendant la période, le congé est quand même enregistré :
 * on prévient les managers (admin + head coach) et on renvoie un AVERTISSEMENT.
 */
export async function addTimeOffAction(_: PlanState, fd: FormData): Promise<PlanState> {
  const me = await staffOnly();
  const coach_id = targetCoach(me, fd);
  const starts_on = String(fd.get("starts_on") ?? "");
  const ends_on = str(fd.get("ends_on")) ?? starts_on;
  if (!DATE.test(starts_on) || !DATE.test(ends_on)) return { error: "Choisis les dates du congé." };
  if (ends_on < starts_on) return { error: "La date de fin doit être après la date de début." };
  const supabase = await createClient();
  if (coach_id !== me.id) {
    const bad = await checkActiveCoach(supabase, coach_id);
    if (bad) return { error: bad };
  }
  const { data: same } = await supabase.from("coach_time_off").select("*").eq("coach_id", coach_id).lte("starts_on", ends_on).gte("ends_on", starts_on);
  const overlap = ((same ?? []) as { starts_on: string; ends_on: string }[])[0];
  if (overlap) {
    const range = overlap.starts_on === overlap.ends_on ? `le ${dayLabel(overlap.starts_on)}` : `du ${dayLabel(overlap.starts_on)} au ${dayLabel(overlap.ends_on)}`;
    return { error: `Ce congé chevauche une période déjà enregistrée (${range}). Supprime-la ou choisis d'autres dates.` };
  }
  const { error } = await supabase.from("coach_time_off").insert({ coach_id, starts_on, ends_on, reason: str(fd.get("reason")) });
  if (error) return { error: error.message };
  revalidatePath("/disponibilites");
  revalidatePath("/planning");
  revalidatePath("/coachs");

  // Séances déjà prévues pendant le congé : on prévient les managers
  const { data: hit } = await supabase
    .from("sessions")
    .select("id, starts_at, status")
    .eq("coach_id", coach_id)
    .gte("starts_at", agadirToIso(starts_on, "00:00"))
    .lt("starts_at", agadirToIso(shiftDate(ends_on, 1), "00:00"))
    .in("status", BUSY_STATUSES);
  const n = hit?.length ?? 0;
  if (!n) return { ok: "Congé enregistré." };
  const coachName = coach_id === me.id ? firstName(me.full_name) : firstName((await profileName(supabase, coach_id)) ?? "Le coach");
  const range = starts_on === ends_on ? `le ${dayLabel(starts_on)}` : `du ${dayLabel(starts_on)} au ${dayLabel(ends_on)}`;
  const managers = await managerIds(supabase);
  await notify(
    supabase,
    me,
    managers.map((id) => ({
      user_id: id,
      title: "Congé : séances à réaffecter",
      body: `${coachName} sera en congé ${range} : ${n} séance${n > 1 ? "s" : ""} prévue${n > 1 ? "s" : ""} pendant cette période.`,
      link: `/planning?jour=${starts_on}`,
    })),
  );
  return {
    warning: `Congé enregistré, mais ${n} séance${n > 1 ? "s sont" : " est"} déjà prévue${n > 1 ? "s" : ""} pendant cette période : ${isManager(me.role) ? "pense à les réaffecter depuis le planning" : "le head coach est prévenu pour les réaffecter"}.`,
  };
}

export async function deleteTimeOffAction(fd: FormData) {
  const me = await staffOnly();
  const supabase = await createClient();
  let q = supabase.from("coach_time_off").delete().eq("id", String(fd.get("id") ?? ""));
  if (!isManager(me.role)) q = q.eq("coach_id", me.id);
  await q;
  revalidatePath("/disponibilites");
  revalidatePath("/planning");
}

/* =====================================================================
   Affectation par le head coach / l'admin
   ===================================================================== */
export async function assignSessionAction(_: PlanState, fd: FormData): Promise<PlanState> {
  const me = await getProfile();
  if (!isManager(me.role)) return { error: "Seuls l'admin et le head coach peuvent affecter des séances." };
  const client_id = str(fd.get("client_id"));
  const coach_id = str(fd.get("coach_id"));
  const date = str(fd.get("date"));
  const time = str(fd.get("time"));
  const duration_min = int(fd.get("duration_min")) ?? 60;
  if (!client_id) return { error: "Choisis un client." };
  if (!coach_id) return { error: "Choisis un coach." };
  if (!date || !DATE.test(date) || !time || !HHMM.test(time)) return { error: "Choisis une date et une heure." };
  if (duration_min < 15 || duration_min > 240) return { error: "Durée entre 15 et 240 minutes." };
  const starts_at = agadirToIso(date, time);
  const supabase = await createClient();
  const newClient = readNewClient(fd);
  if (newClient && "error" in newClient) return { error: newClient.error };
  let client = newClient ? null : await loadClient(supabase, client_id);
  if (!newClient && !client) return { error: "Client introuvable." };

  // Créneau : disponibilités, congés, séances, cours collectifs, coach actif, pas dans le passé
  const { check, free, coach } = await verifySlot(supabase, { coachId: coach_id, startIso: starts_at, durationMin: duration_min });
  if (!check.ok) return { error: check.message, free };
  const type = await resolveSessionType(supabase, fd);
  const price = await priceFor(supabase, fd, type);
  if ("error" in price) return { error: price.error };
  // Nouveau client : sa fiche n'est créée qu'une fois le créneau validé
  if (newClient) {
    const r = await createQuickClient(supabase, newClient, coach_id);
    if ("error" in r) return { error: r.error };
    client = r.client;
  }
  if (!client) return { error: "Client introuvable." };

  const self = coach_id === me.id;
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("sessions")
    .insert({
      client_id: client.id,
      coach_id,
      starts_at,
      duration_min,
      type,
      status: self ? "acceptee" : "planifiee",
      assigned_by: me.id,
      responded_at: self ? now : null,
      notes: str(fd.get("notes")),
      rpe: null,
      ...(price.price !== null ? { price_mad: price.price } : {}),
    })
    .select("id")
    .single();
  if (error || !data) return { error: error?.message ?? "Impossible de créer la séance." };
  await notify(supabase, me, [
    {
      user_id: coach_id,
      title: "Nouvelle séance à confirmer",
      body: `${client.full_name} · ${when(starts_at)} · ${duration_min} min (affectée par ${firstName(me.full_name)})`,
      link: `/seances/${data.id}`,
    },
  ]);
  refresh(data.id);
  const coachLabel = coach ? firstName(staffName(coach)) : "le coach";
  return { ok: self ? `Séance ajoutée à ton planning (${when(starts_at)}).` : `Séance affectée à ${coachLabel} (${when(starts_at)}) : en attente de sa réponse.`, sessionId: data.id };
}

/** Réaffecter une séance à un autre coach libre au même horaire (ou à l'horaire proposé si demandé). */
export async function reassignSessionAction(_: PlanState, fd: FormData): Promise<PlanState> {
  const me = await getProfile();
  if (!isManager(me.role)) return { error: "Seuls l'admin et le head coach peuvent réaffecter une séance." };
  const supabase = await createClient();
  const s = await loadSession(supabase, str(fd.get("id")));
  if (!s) return { error: "Séance introuvable." };
  if (!["planifiee", "acceptee", "refusee", "reportee"].includes(s.status)) return { error: `Une séance « ${SESSION_LABEL[s.status].toLowerCase()} » ne peut plus être réaffectée.` };
  const coach_id = str(fd.get("coach_id"));
  if (!coach_id) return { error: "Choisis un coach." };
  const useProposed = fd.get("use_proposed") === "1" && !!s.proposed_at;
  const starts_at = useProposed ? s.proposed_at! : s.starts_at;
  if (coach_id === s.coach_id && !useProposed && s.status !== "refusee") return { error: "La séance est déjà affectée à ce coach." };

  const { check, free } = await verifySlot(supabase, { coachId: coach_id, startIso: starts_at, durationMin: s.duration_min, excludeId: s.id });
  if (!check.ok) return { error: check.message, free };

  const self = coach_id === me.id;
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("sessions")
    .update({ coach_id, starts_at, status: self ? "acceptee" : "planifiee", assigned_by: me.id, responded_at: self ? now : null, response_note: null, proposed_at: null })
    .eq("id", s.id);
  if (error) return { error: error.message };
  const client = await loadClient(supabase, s.client_id);
  const newName = (await profileName(supabase, coach_id)) ?? "un autre coach";
  await notify(supabase, me, [
    { user_id: coach_id, title: "Nouvelle séance à confirmer", body: `${client?.full_name ?? "Client"} · ${when(starts_at)} · ${s.duration_min} min (affectée par ${firstName(me.full_name)})`, link: `/seances/${s.id}` },
    ...(s.coach_id !== coach_id ? [{ user_id: s.coach_id, title: "Séance réaffectée", body: `${client?.full_name ?? "Client"} · ${when(starts_at)} a été confiée à ${firstName(newName)}.`, link: "/seances" }] : []),
    { user_id: client?.user_id, title: "Ta séance change de coach", body: `${when(starts_at)} avec ${firstName(newName)}${self ? "" : " (en attente de confirmation)"}.`, link: "/moi?tab=seances" },
  ]);
  refresh(s.id);
  return { ok: `Séance réaffectée à ${firstName(newName)}${self ? "" : ", en attente de sa réponse"}.` };
}

/** Le manager valide le nouvel horaire proposé par le coach : l'adhérent n'est prévenu qu'à ce moment-là. */
export async function validateProposalAction(_: PlanState, fd: FormData): Promise<PlanState> {
  const me = await getProfile();
  if (!isManager(me.role)) return { error: "Seuls l'admin et le head coach peuvent valider un nouvel horaire." };
  const supabase = await createClient();
  const s = await loadSession(supabase, str(fd.get("id")));
  if (!s || s.status !== "reportee" || !s.proposed_at) return { error: "Aucun nouvel horaire à valider." };
  if (new Date(s.proposed_at).getTime() < Date.now()) return { error: "L'horaire proposé est déjà passé : garde l'horaire initial ou réaffecte la séance." };
  const { check, free } = await verifySlot(supabase, { coachId: s.coach_id, startIso: s.proposed_at, durationMin: s.duration_min, excludeId: s.id });
  if (!check.ok) return { error: `Impossible de valider : ${check.message}`, free };
  const starts_at = s.proposed_at;
  const { error } = await supabase.from("sessions").update({ starts_at, proposed_at: null, status: "acceptee", responded_at: new Date().toISOString() }).eq("id", s.id);
  if (error) return { error: error.message };
  const client = await loadClient(supabase, s.client_id);
  const coachFirst = firstName((await profileName(supabase, s.coach_id)) ?? "ton coach");
  await notify(supabase, me, [
    { user_id: s.coach_id, title: "Nouvel horaire validé", body: `${client?.full_name ?? "Client"} · ${when(starts_at)}`, link: `/seances/${s.id}` },
    { user_id: client?.user_id, title: "Ta séance est déplacée", body: `Nouvel horaire confirmé : ${when(starts_at)} avec ${coachFirst} (au lieu du ${when(s.starts_at)}).`, link: "/moi?tab=seances" },
  ]);
  refresh(s.id);
  return { ok: `Nouvel horaire validé : ${when(starts_at)}.` };
}

/**
 * Le manager refuse le nouvel horaire proposé et garde l'horaire initial.
 * Règle : un report ne peut être proposé que sur une séance « en attente » (le coach n'avait pas encore accepté).
 * La séance repasse donc « en attente du coach » (il accepte l'horaire initial ou refuse avec un motif),
 * sauf si le manager est lui-même le coach de la séance : elle est alors directement « acceptée ».
 */
export async function keepOriginalTimeAction(_: PlanState, fd: FormData): Promise<PlanState> {
  const me = await getProfile();
  if (!isManager(me.role)) return { error: "Seuls l'admin et le head coach peuvent décider d'un report." };
  const supabase = await createClient();
  const s = await loadSession(supabase, str(fd.get("id")));
  if (!s || s.status !== "reportee") return { error: "Aucun report en attente sur cette séance." };
  const { check, free } = await verifySlot(supabase, { coachId: s.coach_id, startIso: s.starts_at, durationMin: s.duration_min, excludeId: s.id });
  if (!check.ok) return { error: check.reason === "passe" ? "L'horaire initial est déjà passé : réaffecte ou annule la séance." : `Horaire initial impossible : ${check.message}`, free };
  const self = s.coach_id === me.id;
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("sessions")
    .update({ status: self ? "acceptee" : "planifiee", proposed_at: null, response_note: null, responded_at: self ? now : null, assigned_by: s.assigned_by ?? me.id })
    .eq("id", s.id);
  if (error) return { error: error.message };
  const client = await loadClient(supabase, s.client_id);
  await notify(supabase, me, [
    {
      user_id: s.coach_id,
      title: "Horaire initial maintenu",
      body: `${client?.full_name ?? "Client"} · ${when(s.starts_at)} : le nouvel horaire proposé n'est pas retenu par ${firstName(me.full_name)}. Merci de confirmer la séance.`,
      link: `/seances/${s.id}`,
    },
  ]);
  refresh(s.id);
  return { ok: self ? `Horaire initial gardé (${when(s.starts_at)}).` : `Horaire initial gardé (${when(s.starts_at)}) : la séance attend de nouveau la réponse du coach.` };
}

/* =====================================================================
   Réponse du coach : accepter, refuser, reporter
   ===================================================================== */
export async function respondSessionAction(_: PlanState, fd: FormData): Promise<PlanState> {
  const me = await staffOnly();
  const supabase = await createClient();
  const s = await loadSession(supabase, str(fd.get("id")));
  if (!s) return { error: "Séance introuvable." };
  if (s.coach_id !== me.id) return { error: "Seul le coach affecté peut répondre à cette séance." };
  if (s.status !== "planifiee") return { error: "Cette séance n'attend plus de réponse." };
  const answer = String(fd.get("answer") ?? "");
  const note = str(fd.get("note"));
  const now = new Date().toISOString();
  if (answer !== "refuse" && plannedEnd(s) < Date.now()) return { error: "Cette séance est déjà passée : clôture-la (Terminée, Absent ou Annulée)." };
  const client = await loadClient(supabase, s.client_id);
  const cName = client?.full_name ?? "Client";
  const coachFirst = firstName(me.full_name);
  let patch: Partial<Session>;
  let toAssigner: string;
  let toMember: string | null;
  let ok: string;

  if (answer === "accept") {
    patch = { status: "acceptee", responded_at: now, response_note: note };
    toAssigner = `${coachFirst} a accepté la séance de ${cName} (${when(s.starts_at)}).`;
    toMember = `Ta séance du ${when(s.starts_at)} avec ${coachFirst} est confirmée.`;
    ok = "Séance acceptée.";
  } else if (answer === "refuse") {
    if (!note) return { error: "Indique le motif du refus." };
    patch = { status: "refusee", responded_at: now, response_note: note };
    toAssigner = `${coachFirst} a refusé la séance de ${cName} (${when(s.starts_at)}) : ${note}`;
    toMember = null; // l'adhérent n'est prévenu qu'une fois la séance réaffectée
    ok = "Séance refusée : le head coach est prévenu pour la réaffecter.";
  } else if (answer === "report") {
    const date = str(fd.get("date"));
    const time = str(fd.get("time"));
    if (!date || !DATE.test(date) || !time || !HHMM.test(time)) return { error: "Choisis la date et l'heure que tu proposes." };
    const proposed_at = agadirToIso(date, time);
    if (new Date(proposed_at).getTime() < Date.now()) return { error: "Le nouvel horaire doit être dans le futur." };
    if (proposed_at === s.starts_at) return { error: "Propose un horaire différent de l'horaire actuel." };
    const { check } = await verifySlot(supabase, { coachId: me.id, startIso: proposed_at, durationMin: s.duration_min, excludeId: s.id });
    if (!check.ok) return { error: `Nouvel horaire impossible : ${check.message}` };
    patch = { status: "reportee", responded_at: now, response_note: note, proposed_at };
    toAssigner = `${coachFirst} propose de déplacer la séance de ${cName} (${when(s.starts_at)}) au ${when(proposed_at)}${note ? ` : ${note}` : ""}. À valider.`;
    // L'adhérent n'est prévenu qu'une fois le nouvel horaire validé par le head coach / l'admin
    toMember = null;
    ok = "Nouvel horaire proposé : en attente de validation.";
  } else {
    return { error: "Réponse inconnue." };
  }

  const { error } = await supabase.from("sessions").update(patch).eq("id", s.id);
  if (error) return { error: error.message };
  const deciders = s.assigned_by ? [s.assigned_by] : await managerIds(supabase);
  await notify(supabase, me, [
    ...deciders.map((id) => ({ user_id: id, title: answer === "accept" ? "Séance acceptée" : answer === "refuse" ? "Séance refusée" : "Report proposé", body: toAssigner, link: `/seances/${s.id}` })),
    ...(toMember ? [{ user_id: client?.user_id, title: "Séance confirmée", body: toMember, link: "/moi?tab=seances" }] : []),
  ]);
  refresh(s.id);
  return { ok };
}

/** Acceptation en un clic (liste « À confirmer ») */
export async function quickAcceptAction(fd: FormData) {
  const fd2 = new FormData();
  fd2.set("id", String(fd.get("id") ?? ""));
  fd2.set("answer", "accept");
  await respondSessionAction(undefined, fd2);
}

/* =====================================================================
   Séance démarrée / terminée / clôturée
   ===================================================================== */
function canRun(me: Profile, s: Session) {
  return s.coach_id === me.id || isManager(me.role);
}

/** « Séance démarrée » : séance acceptée, à partir de 30 min avant (jamais un jour futur) */
export async function startSessionAction(fd: FormData) {
  const me = await staffOnly();
  const supabase = await createClient();
  const s = await loadSession(supabase, str(fd.get("id")));
  if (!s || !canRun(me, s) || !canStart(s)) return;
  const now = new Date().toISOString();
  await supabase.from("sessions").update({ status: "en_cours", started_at: now, ...(s.responded_at ? {} : { responded_at: now }) }).eq("id", s.id);
  refresh(s.id);
}

/** « Séance terminée » : seulement depuis « en cours ». Fin plafonnée à début + durée + 60 min si clôturée tard. */
export async function endSessionAction(fd: FormData) {
  const me = await staffOnly();
  const supabase = await createClient();
  const s = await loadSession(supabase, str(fd.get("id")));
  if (!s || !canRun(me, s) || !canFinish(s)) return;
  await supabase.from("sessions").update({ status: "realisee", ended_at: cappedEndIso(s) }).eq("id", s.id);
  await askConfirmation(supabase, me, s);
  refresh(s.id);
}

/** Séance réalisée : l'adhérent(e) confirme dans son espace qu'elle a bien eu lieu (contrôle à distance) */
async function askConfirmation(supabase: SupabaseClient, me: Profile, s: Session) {
  const client = await loadClient(supabase, s.client_id);
  const coach = firstName(await profileName(supabase, s.coach_id));
  await notify(supabase, me, [{ user_id: client?.user_id, title: "Confirme ta séance", body: `${s.type} avec ${coach} · ${when(s.starts_at)}. Un clic pour confirmer et noter la séance.`, link: "/moi#confirmer" }]);
}

/**
 * Marquer une séance (coach de la séance ou manager) :
 * - « absent » : séance ouverte, à partir de 30 min avant ;
 * - « annulee » : séance pas encore close ;
 * - « realisee » (clôture d'une séance oubliée) : heure de début passée ; heures réelles complétées
 *   (début prévu → fin prévue, ou fin plafonnée si la séance était restée « en cours »).
 */
export async function markSessionAction(fd: FormData) {
  const me = await staffOnly();
  const supabase = await createClient();
  const s = await loadSession(supabase, str(fd.get("id")));
  const status = String(fd.get("status") ?? "") as SessionStatus;
  if (!s || !canRun(me, s)) return;
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  let patch: Partial<Session>;
  if (status === "absent") {
    if (!canMarkAbsent(s, nowMs)) return;
    patch = { status };
  } else if (status === "annulee") {
    if (![...BUSY_STATUSES, "refusee"].includes(s.status)) return;
    patch = { status };
  } else if (status === "realisee") {
    if (!BUSY_STATUSES.includes(s.status) || new Date(s.starts_at).getTime() > nowMs) return;
    patch =
      s.status === "en_cours"
        ? { status, ended_at: cappedEndIso(s, nowMs) }
        : { status, started_at: s.started_at ?? s.starts_at, ended_at: s.ended_at ?? new Date(Math.min(plannedEnd(s), nowMs)).toISOString(), responded_at: s.responded_at ?? nowIso };
  } else return;
  await supabase.from("sessions").update(patch).eq("id", s.id);
  if (status === "realisee") await askConfirmation(supabase, me, s);
  if (status === "annulee") {
    const client = await loadClient(supabase, s.client_id);
    await notify(supabase, me, [
      ...(visibleToMember(s) && new Date(s.starts_at).getTime() > nowMs ? [{ user_id: client?.user_id, title: "Séance annulée", body: `Ta séance du ${when(s.starts_at)} est annulée.`, link: "/moi?tab=seances" }] : []),
      { user_id: s.coach_id, title: "Séance annulée", body: `${client?.full_name ?? "Client"} · ${when(s.starts_at)}`, link: `/seances/${s.id}` },
    ]);
  }
  refresh(s.id);
}

/** Suppression : réservée aux managers (la base l'impose aussi). Un coach annule la séance à la place. */
export async function deletePlanningSessionAction(fd: FormData) {
  const me = await staffOnly();
  if (!isManager(me.role)) return;
  const supabase = await createClient();
  const s = await loadSession(supabase, str(fd.get("id")));
  if (!s) return;
  await supabase.from("sessions").delete().eq("id", s.id);
  refresh();
  redirect("/seances");
}

/* =====================================================================
   Formulaire « Nouvelle séance » / « Modifier » (avec contrôle du créneau)
   ===================================================================== */
function exercisesFrom(fd: FormData) {
  const names = fd.getAll("ex_name").map(String);
  const sets = fd.getAll("ex_sets");
  const reps = fd.getAll("ex_reps").map(String);
  const loads = fd.getAll("ex_load");
  const rpes = fd.getAll("ex_rpe");
  const scale = (v: FormDataEntryValue | null) => {
    const n = int(v);
    return n === null ? null : Math.min(10, Math.max(1, n));
  };
  return names
    .map((name, i) => ({
      position: i,
      name: name.trim(),
      sets: int(sets[i] ?? null),
      reps: reps[i]?.trim() || null,
      load_kg: parseNum(loads[i] ?? null),
      rpe: scale(rpes[i] ?? null),
    }))
    .filter((e) => e.name);
}

const statusName = (s: string) => (s === "a_venir" ? "À venir" : (SESSION_LABEL[s as SessionStatus] ?? s));

export async function saveSessionPlanningAction(_: FormState, fd: FormData): Promise<FormState> {
  const me = await getProfile();
  if (me.role === "client") return { error: "Accès refusé." };
  const manager = isManager(me.role);
  const id = str(fd.get("id"));
  const client_id = str(fd.get("client_id"));
  const date = str(fd.get("date"));
  const time = str(fd.get("time"));
  if (!client_id) return { error: "Choisis un client." };
  if (!date || !DATE.test(date)) return { error: "Choisis une date." };
  if (time && !HHMM.test(time)) return { error: "Heure invalide." };
  const supabase = await createClient();
  const newClient = readNewClient(fd);
  if (newClient && "error" in newClient) return { error: newClient.error };
  const existing = newClient ? null : await loadClient(supabase, client_id);
  if (!newClient && !existing) return { error: "Client introuvable." };
  const previous = id ? await loadSession(supabase, id) : null;
  if (id && !previous) return { error: "Séance introuvable." };
  if (previous && !manager && previous.coach_id !== me.id) return { error: "Tu ne peux modifier que tes propres séances." };

  const starts_at = agadirToIso(date, time ?? "09:00");
  const duration_min = Math.min(240, Math.max(15, int(fd.get("duration_min")) ?? 60));
  const wantedCoach = manager ? str(fd.get("coach_id")) : null;
  const coach_id = wantedCoach ?? previous?.coach_id ?? (manager && existing ? existing.coach_id : me.id);
  const rpeRaw = int(fd.get("rpe"));
  const nowMs = Date.now();
  const startMs = new Date(starts_at).getTime();

  // Un coach ne crée / déplace des séances que pour ses propres clients (règle aussi appliquée par la base)
  const touchesPlanning = !previous || previous.client_id !== client_id || previous.starts_at !== starts_at || previous.duration_min !== duration_min;
  if (!manager && touchesPlanning && existing && existing.coach_id !== me.id) {
    return { error: `${existing.full_name} est suivi(e) par un autre coach : seuls l'admin et le head coach peuvent lui planifier ou déplacer une séance.` };
  }
  if (!manager && coach_id !== me.id) return { error: "Tu ne peux planifier des séances que pour toi-même." };

  // Statut demandé : seulement une suite logique du statut actuel
  let asked = str(fd.get("status")) ?? "a_venir";
  if (asked !== "a_venir" && !STATUSES.includes(asked as SessionStatus)) return { error: "Statut inconnu." };
  const coachChanged = !!previous && previous.coach_id !== coach_id;
  // Coach venant du formulaire : compte actif obligatoire (même pour une séance déjà faite ou annulée)
  if (!previous || coachChanged) {
    const bad = await checkActiveCoach(supabase, coach_id);
    if (bad) return { error: bad };
  }
  const allowed = allowedStatuses(previous?.status ?? null, { isCoach: coach_id === me.id && !coachChanged, started: startMs <= nowMs, reached: timeReached({ starts_at }, nowMs) });
  if (!allowed.includes(asked as SessionStatus | "a_venir")) {
    const why =
      asked === "acceptee"
        ? "Seul le coach de la séance peut l'accepter (il reçoit la demande de confirmation)."
        : asked === "realisee"
          ? "Une séance ne peut être « Terminée » qu'une fois son heure de début passée."
          : asked === "absent"
            ? "« Absent » n'est possible qu'à partir de 30 min avant la séance."
            : asked === "en_cours"
              ? "Utilise le bouton « Séance démarrée » le jour de la séance."
              : asked === "refusee" || asked === "reportee"
                ? "Le refus et le report se font depuis la réponse du coach."
                : "";
    return { error: `Changement de statut impossible : ${statusName(previous?.status ?? "a_venir")} → ${statusName(asked)}. ${why}`.trim() };
  }

  const timeChanged = !!previous && (previous.starts_at !== starts_at || previous.duration_min !== duration_min);
  // Coach changé, ou horaire changé par quelqu'un d'autre que le coach : la séance repart en confirmation
  const reset = !!previous && ["planifiee", "acceptee", "reportee", "refusee"].includes(asked) && (coachChanged || (timeChanged && coach_id !== me.id));
  if (reset) asked = "a_venir";
  let status: SessionStatus;
  let assigned_by = previous?.assigned_by ?? null;
  let responded_at = previous?.responded_at ?? null;
  let notifyCoach = false;
  if (asked === "a_venir") {
    const keep = previous && !reset && BUSY_STATUSES.includes(previous.status) ? previous.status : null;
    if (keep) status = keep;
    else if (coach_id === me.id) {
      status = "acceptee";
      responded_at = new Date(nowMs).toISOString();
      if (!previous) assigned_by = manager ? me.id : null;
    } else {
      status = "planifiee";
      assigned_by = me.id;
      responded_at = null;
      notifyCoach = true;
    }
  } else {
    status = asked as SessionStatus;
    if (status === "acceptee" && previous?.status !== "acceptee") responded_at = new Date(nowMs).toISOString();
  }

  // Contrôle du créneau pour toute séance qui occupe le coach et dont l'horaire / le coach change
  // (ou qui redevient « à venir ») : disponibilités, congés, séances, cours, coach actif, jamais dans le passé
  const moved = !previous || previous.starts_at !== starts_at || previous.duration_min !== duration_min || previous.coach_id !== coach_id || !BUSY_STATUSES.includes(previous.status);
  if (BUSY_STATUSES.includes(status) && status !== "en_cours" && moved) {
    const { check, free } = await verifySlot(supabase, { coachId: coach_id, startIso: starts_at, durationMin: duration_min, excludeId: id });
    if (!check.ok) {
      const alt = manager && free.length ? ` Coachs libres à cet horaire : ${free.map((f) => f.name).join(", ")}.` : "";
      const past = check.reason === "passe" ? " Pour une séance déjà faite, choisis le statut « Terminée »." : "";
      return { error: `${check.message}${alt}${past}` };
    }
  }

  // Heures réelles d'une séance passée en « Terminée » sans les boutons
  const realTimes: Partial<Session> = {};
  if (status === "realisee" && previous?.status !== "realisee") {
    if (previous?.status === "en_cours") realTimes.ended_at = previous.ended_at ?? cappedEndIso(previous, nowMs);
    else {
      realTimes.started_at = previous?.started_at ?? starts_at;
      realTimes.ended_at = previous?.ended_at ?? new Date(Math.min(startMs + duration_min * 60000, nowMs)).toISOString();
      if (!responded_at) responded_at = new Date(nowMs).toISOString();
    }
  }

  const type = await resolveSessionType(supabase, fd);
  const price = await priceFor(supabase, fd, type);
  if ("error" in price) return { error: price.error };

  // Nouveau client : fiche créée une fois le créneau validé
  let client = existing;
  if (newClient) {
    const r = await createQuickClient(supabase, newClient, coach_id);
    if ("error" in r) return { error: r.error };
    client = r.client;
  }
  if (!client) return { error: "Client introuvable." };
  const row = {
    client_id: client.id,
    coach_id,
    starts_at,
    duration_min,
    type,
    status,
    assigned_by,
    responded_at,
    rpe: rpeRaw === null ? null : Math.min(10, Math.max(1, rpeRaw)),
    notes: str(fd.get("notes")),
    ...realTimes,
    ...(previous || price.price !== null ? { price_mad: price.price } : {}),
    ...(status === "planifiee" && previous?.status !== "planifiee" ? { response_note: null, proposed_at: null } : {}),
  };

  let sessionId = id;
  if (id) {
    const { error } = await supabase.from("sessions").update(row).eq("id", id);
    if (error) return { error: error.message };
    await supabase.from("session_exercises").delete().eq("session_id", id);
  } else {
    const { data, error } = await supabase.from("sessions").insert(row).select("id").single();
    if (error || !data) return { error: error?.message ?? "Impossible de créer la séance." };
    sessionId = data.id as string;
  }
  const ex = exercisesFrom(fd);
  if (ex.length) {
    const { error } = await supabase.from("session_exercises").insert(ex.map((e) => ({ ...e, session_id: sessionId })));
    if (error) return { error: error.message };
  }
  if (notifyCoach) {
    await notify(supabase, me, [
      { user_id: coach_id, title: "Nouvelle séance à confirmer", body: `${client.full_name} · ${when(starts_at)} · ${duration_min} min (affectée par ${firstName(me.full_name)})`, link: `/seances/${sessionId}` },
    ]);
  }
  revalidatePath("/", "layout");
  redirect(`/seances/${sessionId}`);
}
