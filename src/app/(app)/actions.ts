"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { PAIN_ZONES, agadirToIso, parseNum, str } from "@/lib/utils";
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

export async function createClientAction(_: FormState, fd: FormData): Promise<FormState> {
  const me = await getProfile();
  if (me.role === "client") return fail("Accès refusé.");
  const f = clientFields(fd);
  if (!f.full_name) return fail("Le nom est obligatoire.");
  const coach_id = me.role === "admin" ? str(fd.get("coach_id")) ?? me.id : me.id;
  const supabase = await createClient();
  const { data, error } = await supabase.from("clients").insert({ ...f, coach_id }).select("id").single();
  if (error) return fail(error.code === "23505" ? "Ce compte est déjà lié à un autre client." : error.message);
  revalidatePath("/", "layout");
  redirect(`/clients/${data.id}`);
}

export async function updateClientAction(_: FormState, fd: FormData): Promise<FormState> {
  const me = await getProfile();
  const id = String(fd.get("id"));
  const f = clientFields(fd);
  if (!f.full_name) return fail("Le nom est obligatoire.");
  const patch: Record<string, unknown> = { ...f };
  if (me.role === "admin" && str(fd.get("coach_id"))) patch.coach_id = str(fd.get("coach_id"));
  const supabase = await createClient();
  const { error } = await supabase.from("clients").update(patch).eq("id", id);
  if (error) return fail(error.message);
  revalidatePath("/", "layout");
  redirect(`/clients/${id}?tab=infos`);
}

export async function deleteClientAction(fd: FormData) {
  const supabase = await createClient();
  await supabase.from("clients").delete().eq("id", String(fd.get("id")));
  revalidatePath("/", "layout");
  redirect("/clients");
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
  const { error } = await supabase.from("measurements").insert(row);
  if (error) return fail(error.message);
  revalidatePath(`/clients/${client_id}`);
  redirect(`/clients/${client_id}?tab=progression`);
}

export async function deleteMeasurementAction(fd: FormData) {
  const supabase = await createClient();
  const client_id = String(fd.get("client_id"));
  await supabase.from("measurements").delete().eq("id", String(fd.get("id")));
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

/* ================= Séances ================= */
function exercisesFrom(fd: FormData) {
  const names = fd.getAll("ex_name").map(String);
  const sets = fd.getAll("ex_sets");
  const reps = fd.getAll("ex_reps").map(String);
  const loads = fd.getAll("ex_load");
  const rpes = fd.getAll("ex_rpe");
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

/** Date + heure saisies à Agadir (UTC+1) → ISO */
function agadirIso(date: string, time: string) {
  return agadirToIso(date, time);
}

export async function saveSessionAction(_: FormState, fd: FormData): Promise<FormState> {
  const me = await getProfile();
  if (me.role === "client") return fail("Accès refusé.");
  const id = str(fd.get("id"));
  const client_id = str(fd.get("client_id"));
  const date = str(fd.get("date"));
  if (!client_id) return fail("Choisis un client.");
  if (!date) return fail("Choisis une date.");
  const supabase = await createClient();

  const { data: client } = await supabase.from("clients").select("coach_id").eq("id", client_id).single();
  if (!client) return fail("Client introuvable.");

  const row = {
    client_id,
    coach_id: client.coach_id as string,
    starts_at: agadirIso(date, String(fd.get("time") ?? "")),
    duration_min: int(fd.get("duration_min")) ?? 60,
    type: str(fd.get("type")) ?? "Séance",
    status: (str(fd.get("status")) ?? "planifiee") as "planifiee" | "realisee" | "absent" | "annulee",
    rpe: scale(fd.get("rpe")),
    notes: str(fd.get("notes")),
  };

  let sessionId = id;
  if (id) {
    const { error } = await supabase.from("sessions").update(row).eq("id", id);
    if (error) return fail(error.message);
    await supabase.from("session_exercises").delete().eq("session_id", id);
  } else {
    const { data, error } = await supabase.from("sessions").insert(row).select("id").single();
    if (error) return fail(error.message);
    sessionId = data.id;
  }
  const ex = exercisesFrom(fd);
  if (ex.length) {
    const { error } = await supabase.from("session_exercises").insert(ex.map((e) => ({ ...e, session_id: sessionId })));
    if (error) return fail(error.message);
  }
  revalidatePath("/", "layout");
  redirect(`/seances/${sessionId}`);
}

export async function setSessionStatusAction(fd: FormData) {
  const supabase = await createClient();
  const id = String(fd.get("id"));
  await supabase.from("sessions").update({ status: String(fd.get("status")) }).eq("id", id);
  revalidatePath("/", "layout");
}

export async function deleteSessionAction(fd: FormData) {
  const supabase = await createClient();
  await supabase.from("sessions").delete().eq("id", String(fd.get("id")));
  revalidatePath("/", "layout");
  redirect("/seances");
}

/* ================= Équipe ================= */
export async function setRoleAction(fd: FormData) {
  const me = await getProfile();
  if (me.role !== "admin") return;
  const id = String(fd.get("id"));
  const role = String(fd.get("role"));
  if (id === me.id || !["admin", "coach", "client"].includes(role)) return;
  const supabase = await createClient();
  await supabase.from("profiles").update({ role }).eq("id", id);
  revalidatePath("/equipe");
}

export async function updateMyNameAction(fd: FormData) {
  const me = await getProfile();
  const supabase = await createClient();
  await supabase.from("profiles").update({ full_name: String(fd.get("full_name") ?? "").trim() }).eq("id", me.id);
  revalidatePath("/", "layout");
}
