"use server";

import { revalidatePath } from "next/cache";
import { isManager, requireManager, requireStaff } from "@/lib/auth";
import { serviceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";
import { CATEGORY_LABEL, COACH_CATEGORIES, MAX_PHOTO_CHARS, RECLAMATION_CATEGORIES, sourceOf, type ReclamationStatus } from "@/lib/reclamations";
import { dayKey } from "@/lib/utils";

export type ReportState = { ok?: boolean; error?: string } | undefined;

const clip = (v: FormDataEntryValue | null, n: number) => String(v ?? "").trim().slice(0, n) || null;

/**
 * Signalement public (QR code) : enregistre la réclamation, crée une tâche prioritaire
 * et une notification pour chaque administrateur.
 * Sans session : passe par la clé « service » du serveur (SUPABASE_SERVICE_ROLE_KEY) ; en démo, la fausse base.
 */
export async function submitReclamationAction(_: ReportState, fd: FormData): Promise<ReportState> {
  // Champ piège anti-robots
  if (String(fd.get("website") ?? "")) return { ok: true };
  const category = String(fd.get("category") ?? "") as (typeof RECLAMATION_CATEGORIES)[number];
  if (!(RECLAMATION_CATEGORIES as readonly string[]).includes(category)) return { error: "Choisissez un type de problème." };
  const description = clip(fd.get("description"), 2000);
  if (!description || description.length < 3) return { error: "Décrivez le problème en quelques mots." };
  const location = clip(fd.get("location"), 120);
  let photo = clip(fd.get("photo"), MAX_PHOTO_CHARS + 1);
  if (photo && (!photo.startsWith("data:image/") || photo.length > MAX_PHOTO_CHARS)) photo = null;

  const db = serviceClient() ?? (await createClient());
  const now = new Date().toISOString();
  const { data: admins } = await db.from("profiles").select("id").eq("role", "admin");
  const adminIds = ((admins ?? []) as { id: string }[]).map((a) => a.id);

  const label = CATEGORY_LABEL[category];
  const title = `Réclamation · ${label}${location ? ` · ${location}` : ""}`;
  const { data: task } = await db
    .from("tasks")
    .insert({
      title: title.slice(0, 160),
      notes: description,
      client_id: null,
      assigned_to: adminIds[0] ?? null,
      due_date: dayKey(new Date()),
      priority: category === "securite" || category === "panne" ? "haute" : "normale",
      done: false,
      done_at: null,
      source: `reclamation:${category}`,
      created_by: null,
      created_at: now,
    })
    .select("id")
    .maybeSingle();

  const { error } = await db.from("reclamations").insert({
    source: "adherent",
    category,
    location,
    description,
    contact_name: clip(fd.get("name"), 80),
    contact_phone: clip(fd.get("phone"), 30),
    photo,
    status: "nouvelle",
    task_id: (task as { id: string } | null)?.id ?? null,
    resolved_at: null,
    created_at: now,
  });
  if (error) return { error: "L'envoi a échoué. Merci de prévenir l'accueil." };

  if (adminIds.length) {
    await db.from("notifications").insert(
      adminIds.map((user_id) => ({ user_id, title, body: description.slice(0, 140), link: "/reclamations", kind: "alerte", read: false, created_at: now })),
    );
  }
  revalidatePath("/reclamations");
  return { ok: true };
}

const catLabel = (c: string) => CATEGORY_LABEL[c as keyof typeof CATEGORY_LABEL] ?? c;

/**
 * Changement de statut ; « résolue » clôt aussi la tâche liée.
 * Signalements de la salle : toute l'équipe. Réclamations de coach : managers seulement.
 */
export async function setReclamationStatusAction(fd: FormData) {
  const me = await requireStaff();
  const id = String(fd.get("id") ?? "");
  const status = String(fd.get("status") ?? "") as ReclamationStatus;
  if (!id || !["nouvelle", "en_cours", "resolue"].includes(status)) return;
  const supabase = await createClient();
  const { data: row } = await supabase.from("reclamations").select("id, source, author_id, category").eq("id", id).maybeSingle();
  const r = row as { id: string; source: string | null; author_id: string | null; category: string } | null;
  if (!r) return;
  if (sourceOf(r) === "coach" && !isManager(me.role)) return;
  const done = status === "resolue";
  const now = new Date().toISOString();
  const { data } = await supabase.from("reclamations").update({ status, resolved_at: done ? now : null }).eq("id", id).select("task_id").maybeSingle();
  const taskId = (data as { task_id: string | null } | null)?.task_id;
  if (taskId) await supabase.from("tasks").update({ done, done_at: done ? now : null }).eq("id", taskId);
  // Le coach auteur est prévenu quand sa réclamation est résolue
  if (done && sourceOf(r) === "coach" && r.author_id && r.author_id !== me.id) {
    await supabase.from("notifications").insert({
      user_id: r.author_id,
      title: `Réclamation résolue · ${catLabel(r.category)}`,
      body: "La direction a marqué votre réclamation comme résolue.",
      link: `/reclamations?source=coach#r-${r.id}`,
      kind: "info",
      read: false,
      created_at: now,
    });
  }
  revalidatePath("/reclamations");
  revalidatePath("/taches");
}

export type CoachReclamationState = { ok?: boolean; error?: string } | undefined;

/**
 * Réclamation d'un coach (ou head coach) à la direction : sujet, client concerné (facultatif), urgence, photo.
 * Privée : visible par l'auteur et les managers. Notifie les managers (sauf l'auteur).
 */
export async function createCoachReclamationAction(_: CoachReclamationState, fd: FormData): Promise<CoachReclamationState> {
  const me = await requireStaff();
  const category = String(fd.get("category") ?? "") as (typeof COACH_CATEGORIES)[number];
  if (!(COACH_CATEGORIES as readonly string[]).includes(category)) return { error: "Choisissez le sujet de la réclamation." };
  const description = clip(fd.get("description"), 2000);
  if (!description || description.length < 5) return { error: "Expliquez le problème en une ou deux phrases." };
  const supabase = await createClient();

  let clientId = String(fd.get("client_id") ?? "") || null;
  let clientName: string | null = null;
  if (clientId) {
    const { data: c } = await supabase.from("clients").select("id, full_name").eq("id", clientId).maybeSingle();
    if (!c) clientId = null;
    else clientName = (c as { full_name: string }).full_name;
  }
  let photo = clip(fd.get("photo"), MAX_PHOTO_CHARS + 1);
  if (photo && (!photo.startsWith("data:image/") || photo.length > MAX_PHOTO_CHARS)) photo = null;
  const urgent = fd.get("urgent") === "on";
  const now = new Date().toISOString();

  const { data: created, error } = await supabase
    .from("reclamations")
    .insert({
      source: "coach",
      category,
      location: clip(fd.get("location"), 120),
      description,
      contact_name: me.full_name || me.email,
      contact_phone: me.phone ?? null,
      photo,
      status: "nouvelle",
      task_id: null,
      resolved_at: null,
      author_id: me.id,
      client_id: clientId,
      urgent,
      response: null,
      responded_by: null,
      responded_at: null,
      created_at: now,
    })
    .select("id")
    .maybeSingle();
  if (error) return { error: "L'envoi a échoué. Réessayez dans un instant." };

  const { data: managers } = await supabase.from("profiles").select("id, role, active").in("role", ["admin", "head_coach"]);
  const ids = ((managers ?? []) as { id: string; active?: boolean | null }[]).filter((m) => m.id !== me.id && m.active !== false).map((m) => m.id);
  if (ids.length) {
    const id = (created as { id: string } | null)?.id;
    const title = `${urgent ? "Urgent · " : ""}Réclamation de ${me.full_name || "un coach"} · ${catLabel(category)}`;
    await supabase.from("notifications").insert(
      ids.map((user_id) => ({
        user_id,
        title: title.slice(0, 160),
        body: `${clientName ? `Client : ${clientName} · ` : ""}${description.slice(0, 120)}`,
        link: id ? `/reclamations?source=coach#r-${id}` : "/reclamations?source=coach",
        kind: urgent ? "alerte" : "info",
        read: false,
        created_at: now,
      })),
    );
  }
  revalidatePath("/reclamations");
  return { ok: true };
}

/** Réponse de la direction à une réclamation de coach (prévient l'auteur) */
export async function respondReclamationAction(fd: FormData) {
  const me = await requireManager();
  const id = String(fd.get("id") ?? "");
  const response = clip(fd.get("response"), 2000);
  if (!id || !response) return;
  const supabase = await createClient();
  const { data: row } = await supabase.from("reclamations").select("id, status, author_id, category").eq("id", id).maybeSingle();
  const r = row as { id: string; status: ReclamationStatus; author_id: string | null; category: string } | null;
  if (!r) return;
  const now = new Date().toISOString();
  const resolve = fd.get("resolve") === "1";
  await supabase
    .from("reclamations")
    .update({
      response,
      responded_by: me.id,
      responded_at: now,
      status: resolve ? "resolue" : r.status === "nouvelle" ? "en_cours" : r.status,
      ...(resolve ? { resolved_at: now } : {}),
    })
    .eq("id", id);
  if (r.author_id && r.author_id !== me.id) {
    await supabase.from("notifications").insert({
      user_id: r.author_id,
      title: `Réponse à votre réclamation · ${catLabel(r.category)}`,
      body: response.slice(0, 140),
      link: `/reclamations?source=coach#r-${r.id}`,
      kind: "info",
      read: false,
      created_at: now,
    });
  }
  revalidatePath("/reclamations");
}
