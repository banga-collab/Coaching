"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { checkActiveCoach, getProfile, isActiveStaff, isManager, loadManagedClient } from "@/lib/auth";
import { PAIN_ZONES, parseNum, str } from "@/lib/utils";
import type { FormState } from "@/components/action-form";

const int = (v: FormDataEntryValue | null) => {
  const n = parseNum(v);
  return n === null ? null : Math.round(n);
};
const scale = (v: FormDataEntryValue | null) => {
  const n = int(v);
  return n === null ? null : Math.min(10, Math.max(1, n));
};
function fail(msg: string): FormState {
  return { error: msg };
}

/**
 * Droit d'écrire dans le dossier d'un client (mesures, bilans santé) :
 * l'adhérent lui-même pour son propre dossier, sinon son coach référent ou un manager.
 */
async function canWriteClient(supabase: Awaited<ReturnType<typeof createClient>>, clientId: string) {
  const me = await getProfile();
  if (me.role === "client") {
    const { data } = await supabase.from("clients").select("id").eq("id", clientId).eq("user_id", me.id).maybeSingle();
    return !!data;
  }
  return !!(await loadManagedClient(supabase, me, clientId));
}

/* ================= Clients ================= */
function clientFields(fd: FormData) {
  return {
    full_name: String(fd.get("full_name") ?? "").trim(),
    email: str(fd.get("email"))?.toLowerCase() ?? null,
    phone: str(fd.get("phone")),
    birth_date: str(fd.get("birth_date")),
    sex: (str(fd.get("sex")) as "H" | "F" | null) ?? null,
    height_cm: parseNum(fd.get("height_cm")),
    goal: str(fd.get("goal")),
    frequency: str(fd.get("frequency")),
    status: (str(fd.get("status")) ?? "actif") as "actif" | "pause" | "termine",
    start_date: str(fd.get("start_date")) ?? new Date().toISOString().slice(0, 10),
    notes: str(fd.get("notes")),
  };
}

/**
 * Création d'un dossier client.
 * - Admin / head coach : choisissent le coach référent (parmi le personnel actif).
 * - Coach : le client lui est toujours rattaché.
 */
export async function createClientAction(_: FormState, fd: FormData): Promise<FormState> {
  const me = await getProfile();
  if (!isActiveStaff(me)) return fail("Accès refusé.");
  const f = clientFields(fd);
  if (!f.full_name) return fail("Le nom est obligatoire.");
  const coach_id = isManager(me.role) ? str(fd.get("coach_id")) ?? me.id : me.id;
  const supabase = await createClient();
  const bad = await checkActiveCoach(supabase, coach_id);
  if (bad) return fail(bad);
  const { data, error } = await supabase.from("clients").insert({ ...f, coach_id }).select("id").single();
  if (error) return fail(error.code === "23505" ? "Ce compte est déjà lié à un autre client." : error.message);
  revalidatePath("/", "layout");
  redirect(`/clients/${data.id}`);
}

/** Modification : coach référent du client ou manager. Seul un manager change le coach référent. */
export async function updateClientAction(_: FormState, fd: FormData): Promise<FormState> {
  const me = await getProfile();
  const id = String(fd.get("id") ?? "");
  const f = clientFields(fd);
  if (!f.full_name) return fail("Le nom est obligatoire.");
  const supabase = await createClient();
  const current = await loadManagedClient(supabase, me, id);
  if (!current) return fail("Tu ne peux modifier que les dossiers de tes clients.");
  const patch: Record<string, unknown> = { ...f };
  const wanted = str(fd.get("coach_id"));
  if (isManager(me.role) && wanted && wanted !== current.coach_id) {
    const bad = await checkActiveCoach(supabase, wanted);
    if (bad) return fail(bad);
    patch.coach_id = wanted;
  }
  const { error } = await supabase.from("clients").update(patch).eq("id", id);
  if (error) return fail(error.message);
  revalidatePath("/", "layout");
  redirect(`/clients/${id}?tab=infos`);
}

/**
 * Archivage d'un client (statut « terminé ») : tout l'historique est conservé
 * (séances, mesures, bilans…). Aucune suppression définitive depuis l'application.
 * Autorisé au coach référent et aux managers (admin / head coach).
 */
export async function archiveClientAction(fd: FormData) {
  const me = await getProfile();
  const id = String(fd.get("id") ?? "");
  const supabase = await createClient();
  const client = await loadManagedClient(supabase, me, id);
  if (!client) redirect(id ? `/clients/${id}` : "/clients");
  const { error } = await supabase.from("clients").update({ status: "termine" }).eq("id", client.id);
  if (error) throw new Error(`Archivage impossible : ${error.message}`);
  revalidatePath("/", "layout");
  redirect(`/clients/${client.id}`);
}

/** Ancien nom conservé pour la fiche client : archive, ne supprime plus. */
export async function deleteClientAction(fd: FormData) {
  return archiveClientAction(fd);
}

/* ================= Mesures ================= */
export async function addMeasurementAction(_: FormState, fd: FormData): Promise<FormState> {
  const client_id = String(fd.get("client_id"));
  const row = {
    client_id,
    measured_on: str(fd.get("measured_on")) ?? new Date().toISOString().slice(0, 10),
    weight_kg: parseNum(fd.get("weight_kg")),
    body_fat: parseNum(fd.get("body_fat")),
    muscle_kg: parseNum(fd.get("muscle_kg")),
    waist_cm: parseNum(fd.get("waist_cm")),
    hips_cm: parseNum(fd.get("hips_cm")),
    chest_cm: parseNum(fd.get("chest_cm")),
    arm_cm: parseNum(fd.get("arm_cm")),
    thigh_cm: parseNum(fd.get("thigh_cm")),
    squat_kg: parseNum(fd.get("squat_kg")),
    bench_kg: parseNum(fd.get("bench_kg")),
    deadlift_kg: parseNum(fd.get("deadlift_kg")),
    notes: str(fd.get("notes")),
  };
  const filled = Object.entries(row).filter(([k, v]) => !["client_id", "measured_on", "notes"].includes(k) && v !== null);
  if (!filled.length) return fail("Renseigne au moins une mesure.");
  const supabase = await createClient();
  if (!(await canWriteClient(supabase, client_id))) return fail("Seuls le coach du client ou un manager peuvent ajouter des mesures.");
  const { error } = await supabase.from("measurements").insert(row);
  if (error) return fail(error.message);
  revalidatePath(`/clients/${client_id}`);
  redirect(`/clients/${client_id}?tab=progression`);
}

export async function deleteMeasurementAction(fd: FormData) {
  const supabase = await createClient();
  const client_id = String(fd.get("client_id"));
  const me = await getProfile();
  if (me.role === "client" || !(await loadManagedClient(supabase, me, client_id))) throw new Error("Seuls le coach du client ou un manager peuvent supprimer une mesure.");
  await supabase.from("measurements").delete().eq("id", String(fd.get("id"))).eq("client_id", client_id);
  revalidatePath(`/clients/${client_id}`);
}

/* ================= Bilans de santé ================= */
export async function addHealthCheckAction(_: FormState, fd: FormData): Promise<FormState> {
  const me = await getProfile();
  const client_id = String(fd.get("client_id"));
  const kind = (str(fd.get("kind")) ?? "mensuel") as "initial" | "mensuel" | "hebdo";
  const consent = fd.get("consent") === "on";
  if (!consent) return fail("Le consentement du client est nécessaire pour enregistrer des données de santé.");
  const zones = fd.getAll("pain_zones").map(String).filter((z) => PAIN_ZONES.includes(z));
  const row = {
    client_id,
    kind: me.role === "client" ? "hebdo" : kind,
    created_by: me.id,
    checked_on: str(fd.get("checked_on")) ?? new Date().toISOString().slice(0, 10),
    systolic: int(fd.get("systolic")),
    diastolic: int(fd.get("diastolic")),
    resting_hr: int(fd.get("resting_hr")),
    sleep: scale(fd.get("sleep")),
    energy: scale(fd.get("energy")),
    stress: scale(fd.get("stress")),
    motivation: scale(fd.get("motivation")),
    nutrition: scale(fd.get("nutrition")),
    recovery: scale(fd.get("recovery")),
    pain_zones: zones,
    conditions: str(fd.get("conditions")),
    medications: str(fd.get("medications")),
    injuries: str(fd.get("injuries")),
    parq_positive: fd.get("parq") === null ? null : fd.get("parq") === "oui",
    notes: str(fd.get("notes")),
    consent,
  };
  const supabase = await createClient();
  if (!(await canWriteClient(supabase, client_id))) return fail("Tu ne peux pas ajouter de bilan de santé à ce dossier.");
  const { error } = await supabase.from("health_checks").insert(row);
  if (error) return fail(error.message);

  // Le bilan peut aussi contenir le poids/tour de taille : on crée une mesure liée
  const weight = parseNum(fd.get("weight_kg"));
  const fat = parseNum(fd.get("body_fat"));
  const waist = parseNum(fd.get("waist_cm"));
  if (me.role !== "client" && (weight !== null || fat !== null || waist !== null)) {
    await supabase.from("measurements").insert({ client_id, measured_on: row.checked_on, weight_kg: weight, body_fat: fat, waist_cm: waist });
  }

  if (me.role === "client") {
    revalidatePath("/moi");
    redirect("/moi?checkin=ok");
  }
  revalidatePath(`/clients/${client_id}`);
  revalidatePath("/");
  redirect(`/clients/${client_id}?tab=sante`);
}

/* ================= Profil ================= */
export async function updateMyNameAction(fd: FormData) {
  const me = await getProfile();
  const supabase = await createClient();
  await supabase.from("profiles").update({ full_name: String(fd.get("full_name") ?? "").trim() }).eq("id", me.id);
  revalidatePath("/", "layout");
}
