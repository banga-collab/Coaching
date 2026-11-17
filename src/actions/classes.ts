"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { agadirToIso, fmtDate, fmtTime, parseNum, str } from "@/lib/utils";
import type { ClassBooking, Client, GroupClass } from "@/lib/types";
import type { FormState } from "@/components/action-form";

const fail = (error: string): FormState => ({ error });
const CANCEL_LIMIT_MS = 2 * 3600 * 1000;

function revalidateClasses(id?: string) {
  revalidatePath("/cours");
  revalidatePath("/moi/cours");
  if (id) revalidatePath(`/cours/${id}`);
}

async function staffOnly() {
  const me = await getProfile();
  return me.role === "client" ? null : me;
}

const when = (c: GroupClass) => `${fmtDate(c.starts_at, { weekday: "long", day: "numeric", month: "long" })} à ${fmtTime(c.starts_at)}`;

async function notifyClient(supabase: SupabaseClient, clientId: string, title: string, body: string, link = "/moi/cours") {
  const { data } = await supabase.from("clients").select("*").eq("id", clientId).maybeSingle();
  const c = data as Client | null;
  if (!c?.user_id) return;
  // Peut être refusé par la RLS en production si l'auteur n'a pas le droit : on ignore l'erreur.
  await supabase.from("notifications").insert({ user_id: c.user_id, title, body, link, kind: "reservation", read: false });
}

/** Réserve une place (ou la liste d'attente). Gère la ré-inscription après annulation. */
async function book(supabase: SupabaseClient, cls: GroupClass, clientId: string): Promise<{ error?: string; status?: ClassBooking["status"] }> {
  if (cls.cancelled) return { error: "Ce cours est annulé." };
  if (new Date(cls.starts_at).getTime() < Date.now()) return { error: "Ce cours a déjà commencé." };
  const { data: rows } = await supabase.from("class_bookings").select("*").eq("class_id", cls.id);
  const bookings = (rows ?? []) as ClassBooking[];
  const mine = bookings.find((b) => b.client_id === clientId);
  if (mine && mine.status !== "annule") return { error: mine.status === "attente" ? "Déjà sur la liste d'attente." : "Déjà inscrit à ce cours." };
  const taken = bookings.filter((b) => b.status === "inscrit" || b.status === "present").length;
  const status: ClassBooking["status"] = taken < cls.capacity ? "inscrit" : "attente";
  const created_at = new Date().toISOString();
  const { error } = mine
    ? await supabase.from("class_bookings").update({ status, created_at }).eq("id", mine.id)
    : await supabase.from("class_bookings").insert({ class_id: cls.id, client_id: clientId, status, created_at });
  if (error) return { error: error.code === "23505" ? "Déjà inscrit à ce cours." : error.message };
  return { status };
}

/** Promeut le premier de la liste d'attente si une place s'est libérée. */
async function promoteNext(supabase: SupabaseClient, cls: GroupClass) {
  if (cls.cancelled) return;
  const { data: rows } = await supabase.from("class_bookings").select("*").eq("class_id", cls.id).order("created_at");
  const bookings = (rows ?? []) as ClassBooking[];
  let free = cls.capacity - bookings.filter((b) => b.status === "inscrit" || b.status === "present").length;
  for (const b of bookings.filter((x) => x.status === "attente")) {
    if (free <= 0) break;
    await supabase.from("class_bookings").update({ status: "inscrit" }).eq("id", b.id);
    await notifyClient(supabase, b.client_id, `🎉 Une place s'est libérée : ${cls.title}`, `Tu passes de la liste d'attente à inscrit pour le cours du ${when(cls)}. À tout à l'heure !`);
    free--;
  }
}

async function getClass(supabase: SupabaseClient, id: string) {
  const { data } = await supabase.from("group_classes").select("*").eq("id", id).maybeSingle();
  return data as GroupClass | null;
}

/* ================= Staff ================= */
export async function saveClassAction(_: FormState, fd: FormData): Promise<FormState> {
  if (!(await staffOnly())) return fail("Accès refusé.");
  const id = str(fd.get("id"));
  const date = str(fd.get("date"));
  const time = str(fd.get("time"));
  const capacity = Math.round(parseNum(fd.get("capacity")) ?? 0);
  const duration = Math.round(parseNum(fd.get("duration_min")) ?? 0);
  const row = {
    title: String(fd.get("title") ?? "").trim(),
    category: str(fd.get("category")) ?? "HIIT",
    coach_id: str(fd.get("coach_id")),
    duration_min: duration,
    capacity,
    room: str(fd.get("room")),
    level: str(fd.get("level")) ?? "Tous niveaux",
    description: str(fd.get("description")),
  };
  if (!row.title) return fail("Le titre est obligatoire.");
  if (!date || !time) return fail("La date et l'heure sont obligatoires.");
  if (capacity < 1 || capacity > 200) return fail("Le nombre de places doit être compris entre 1 et 200.");
  if (duration < 10 || duration > 240) return fail("La durée doit être comprise entre 10 et 240 minutes.");
  const supabase = await createClient();

  if (id) {
    const before = await getClass(supabase, id);
    const { error } = await supabase.from("group_classes").update({ ...row, starts_at: agadirToIso(date, time) }).eq("id", id);
    if (error) return fail(error.message);
    // Capacité augmentée → on fait monter la liste d'attente
    const after = await getClass(supabase, id);
    if (before && after && after.capacity > before.capacity) await promoteNext(supabase, after);
    revalidateClasses(id);
    redirect(`/cours/${id}`);
  }

  const weeks = Math.min(12, Math.max(1, fd.get("repeat") ? Math.round(parseNum(fd.get("weeks")) ?? 1) : 1));
  const rows = Array.from({ length: weeks }, (_, i) => {
    const d = new Date(`${date}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i * 7);
    return { ...row, starts_at: agadirToIso(d.toISOString().slice(0, 10), time), cancelled: false };
  });
  const { data, error } = await supabase.from("group_classes").insert(rows).select("id");
  if (error) return fail(error.message);
  revalidateClasses();
  const first = (data as { id: string }[] | null)?.[0]?.id;
  redirect(weeks === 1 && first ? `/cours/${first}` : `/cours?semaine=${date}&cree=${weeks}`);
}

export async function cancelClassAction(fd: FormData) {
  if (!(await staffOnly())) return;
  const id = String(fd.get("id"));
  const supabase = await createClient();
  const cls = await getClass(supabase, id);
  if (!cls || cls.cancelled) return;
  await supabase.from("group_classes").update({ cancelled: true }).eq("id", id);
  const { data } = await supabase.from("class_bookings").select("*").eq("class_id", id);
  for (const b of (data ?? []) as ClassBooking[]) {
    if (b.status !== "inscrit" && b.status !== "attente") continue;
    await notifyClient(supabase, b.client_id, `Cours annulé : ${cls.title}`, `Désolé, le cours du ${when(cls)} est annulé. Ta réservation est libérée, choisis un autre créneau !`);
  }
  revalidateClasses(id);
}

export async function restoreClassAction(fd: FormData) {
  if (!(await staffOnly())) return;
  const id = String(fd.get("id"));
  const supabase = await createClient();
  await supabase.from("group_classes").update({ cancelled: false }).eq("id", id);
  revalidateClasses(id);
}

export async function deleteClassAction(fd: FormData) {
  if (!(await staffOnly())) return;
  const id = String(fd.get("id"));
  const supabase = await createClient();
  await supabase.from("class_bookings").delete().eq("class_id", id);
  await supabase.from("group_classes").delete().eq("id", id);
  revalidateClasses();
  redirect("/cours");
}

export async function staffAddMemberAction(_: FormState, fd: FormData): Promise<FormState> {
  if (!(await staffOnly())) return fail("Accès refusé.");
  const id = String(fd.get("class_id"));
  const clientId = str(fd.get("client_id"));
  if (!clientId) return fail("Choisissez un membre.");
  const supabase = await createClient();
  const cls = await getClass(supabase, id);
  if (!cls) return fail("Cours introuvable.");
  if (cls.cancelled) return fail("Ce cours est annulé.");
  const { data: rows } = await supabase.from("class_bookings").select("*").eq("class_id", id);
  const bookings = (rows ?? []) as ClassBooking[];
  const mine = bookings.find((b) => b.client_id === clientId);
  if (mine && mine.status !== "annule") return fail("Ce membre est déjà inscrit.");
  const taken = bookings.filter((b) => b.status === "inscrit" || b.status === "present").length;
  const status: ClassBooking["status"] = taken < cls.capacity ? "inscrit" : "attente";
  const created_at = new Date().toISOString();
  const { error } = mine
    ? await supabase.from("class_bookings").update({ status, created_at }).eq("id", mine.id)
    : await supabase.from("class_bookings").insert({ class_id: id, client_id: clientId, status, created_at });
  if (error) return fail(error.message);
  await notifyClient(
    supabase,
    clientId,
    status === "inscrit" ? `Tu es inscrit : ${cls.title}` : `Liste d'attente : ${cls.title}`,
    status === "inscrit" ? `Ton coach t'a inscrit au cours du ${when(cls)}.` : `Le cours du ${when(cls)} est complet : tu es sur la liste d'attente.`,
  );
  revalidateClasses(id);
  return undefined;
}

export async function setBookingStatusAction(fd: FormData) {
  if (!(await staffOnly())) return;
  const id = String(fd.get("booking_id"));
  const classId = String(fd.get("class_id"));
  const status = String(fd.get("status")) as ClassBooking["status"];
  if (!["present", "absent", "inscrit"].includes(status)) return;
  const supabase = await createClient();
  await supabase.from("class_bookings").update({ status }).eq("id", id);
  revalidateClasses(classId);
}

export async function staffCancelBookingAction(fd: FormData) {
  if (!(await staffOnly())) return;
  const id = String(fd.get("booking_id"));
  const classId = String(fd.get("class_id"));
  const supabase = await createClient();
  const { data } = await supabase.from("class_bookings").select("*").eq("id", id).maybeSingle();
  const b = data as ClassBooking | null;
  if (!b) return;
  await supabase.from("class_bookings").update({ status: "annule" }).eq("id", id);
  const cls = await getClass(supabase, classId);
  if (cls && b.status !== "attente") {
    await notifyClient(supabase, b.client_id, `Réservation annulée : ${cls.title}`, `Ta place pour le cours du ${when(cls)} a été annulée par l'équipe.`);
    await promoteNext(supabase, cls);
  }
  revalidateClasses(classId);
}

/* ================= Adhérent ================= */
async function myClient(supabase: SupabaseClient) {
  const me = await getProfile();
  const { data } = await supabase.from("clients").select("*").eq("user_id", me.id).maybeSingle();
  return data as Client | null;
}

export async function bookClassAction(_: FormState, fd: FormData): Promise<FormState> {
  const supabase = await createClient();
  const c = await myClient(supabase);
  if (!c) return fail("Ton dossier n'est pas encore relié.");
  const cls = await getClass(supabase, String(fd.get("class_id")));
  if (!cls) return fail("Cours introuvable.");
  const res = await book(supabase, cls, c.id);
  if (res.error) return fail(res.error);
  revalidateClasses(cls.id);
  return undefined;
}

export async function cancelMyBookingAction(_: FormState, fd: FormData): Promise<FormState> {
  const supabase = await createClient();
  const c = await myClient(supabase);
  if (!c) return fail("Ton dossier n'est pas encore relié.");
  const cls = await getClass(supabase, String(fd.get("class_id")));
  if (!cls) return fail("Cours introuvable.");
  const { data } = await supabase.from("class_bookings").select("*").eq("class_id", cls.id).eq("client_id", c.id).maybeSingle();
  const b = data as ClassBooking | null;
  if (!b || (b.status !== "inscrit" && b.status !== "attente")) return fail("Aucune réservation à annuler.");
  if (b.status === "inscrit" && new Date(cls.starts_at).getTime() - Date.now() < CANCEL_LIMIT_MS) {
    return fail("Annulation possible jusqu'à 2 h avant le cours. Préviens ton coach si besoin.");
  }
  const { error } = await supabase.from("class_bookings").update({ status: "annule" }).eq("id", b.id);
  if (error) return fail(error.message);
  if (b.status === "inscrit") await promoteNext(supabase, cls);
  revalidateClasses(cls.id);
  return undefined;
}
