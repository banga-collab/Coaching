"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { DEMO } from "@/lib/demo";
import { parseNum, str } from "@/lib/utils";
import type { FormState } from "@/components/action-form";
import type { AssessmentField, AssessmentTemplate, FieldType, GoalMetric } from "@/lib/types";

const FIELD_TYPES: FieldType[] = ["number", "scale", "text", "choice", "yesno"];
const METRICS: GoalMetric[] = ["weight_kg", "body_fat", "waist_cm", "squat_kg", "bench_kg", "deadlift_kg", "sessions", "custom"];
const MAX_UPLOAD = 10 * 1024 * 1024;

function fail(msg: string): FormState {
  return { error: msg };
}

async function staff() {
  const me = await getProfile();
  return me.role === "client" ? null : me;
}

function revalidateClient(clientId: string) {
  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/moi");
}

/* ================= Modèles d'évaluation ================= */
function cleanFields(raw: unknown): AssessmentField[] | string {
  if (!Array.isArray(raw)) return "Format des champs invalide.";
  const out: AssessmentField[] = [];
  const ids = new Set<string>();
  for (const r of raw as Record<string, unknown>[]) {
    const label = String(r?.label ?? "").trim().slice(0, 120);
    const type = String(r?.type ?? "") as FieldType;
    if (!label) return "Chaque champ doit avoir un libellé.";
    if (!FIELD_TYPES.includes(type)) return `Type de champ inconnu pour « ${label} ».`;
    let id = String(r?.id ?? "").trim().replace(/[^\w-]/g, "").slice(0, 40);
    if (!id || ids.has(id)) id = `f_${crypto.randomUUID().slice(0, 8)}`;
    ids.add(id);
    const f: AssessmentField = { id, label, type };
    const help = String(r?.help ?? "").trim().slice(0, 240);
    if (help) f.help = help;
    if (type === "number") {
      const unit = String(r?.unit ?? "").trim().slice(0, 20);
      if (unit) f.unit = unit;
    }
    if (type === "choice") {
      const opts = Array.isArray(r?.options) ? (r.options as unknown[]).map((o) => String(o).trim()).filter(Boolean) : [];
      const uniq = [...new Set(opts)].slice(0, 12);
      if (uniq.length < 2) return `Le choix « ${label} » doit proposer au moins 2 options.`;
      f.options = uniq;
    }
    out.push(f);
  }
  if (!out.length) return "Ajoute au moins un champ au modèle.";
  if (out.length > 60) return "60 champs maximum par modèle.";
  return out;
}

export async function saveTemplateAction(_: FormState, fd: FormData): Promise<FormState> {
  const me = await staff();
  if (!me) return fail("Accès refusé.");
  const id = str(fd.get("id"));
  const name = String(fd.get("name") ?? "").trim();
  if (!name) return fail("Donne un nom au modèle.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(String(fd.get("fields") ?? "[]"));
  } catch {
    return fail("Format des champs invalide.");
  }
  const fields = cleanFields(parsed);
  if (typeof fields === "string") return fail(fields);
  const row = { name: name.slice(0, 120), category: str(fd.get("category")), description: str(fd.get("description")), fields };
  const supabase = await createClient();
  if (id) {
    const { error } = await supabase.from("assessment_templates").update(row).eq("id", id);
    if (error) return fail(error.message);
  } else {
    const { error } = await supabase.from("assessment_templates").insert({ ...row, created_by: me.id });
    if (error) return fail(error.message);
  }
  revalidatePath("/evaluations");
  redirect("/evaluations");
}

export async function deleteTemplateAction(fd: FormData) {
  if (!(await staff())) return;
  const supabase = await createClient();
  await supabase.from("assessment_templates").delete().eq("id", String(fd.get("id")));
  revalidatePath("/evaluations");
  redirect("/evaluations");
}

/* ================= Évaluations clients ================= */
export async function createAssessmentAction(_: FormState, fd: FormData): Promise<FormState> {
  const me = await staff();
  if (!me) return fail("Accès refusé.");
  const client_id = String(fd.get("client_id") ?? "");
  const template_id = String(fd.get("template_id") ?? "");
  const supabase = await createClient();
  const { data: tpl } = await supabase.from("assessment_templates").select("*").eq("id", template_id).single();
  if (!tpl) return fail("Modèle introuvable.");
  const t = tpl as AssessmentTemplate;

  const answers: Record<string, string | number | boolean | null> = {};
  let filled = 0;
  for (const f of t.fields) {
    const raw = fd.get(`a_${f.id}`);
    let v: string | number | boolean | null = null;
    if (f.type === "number") v = parseNum(raw);
    else if (f.type === "scale") {
      const n = parseNum(raw);
      v = n === null ? null : Math.min(10, Math.max(1, Math.round(n)));
    } else if (f.type === "yesno") v = raw === "oui" ? true : raw === "non" ? false : null;
    else if (f.type === "choice") {
      const s = str(raw);
      v = s && f.options?.includes(s) ? s : null;
    } else v = str(raw);
    if (v !== null) filled++;
    answers[f.id] = v;
  }
  if (!filled) return fail("Renseigne au moins un champ de l'évaluation.");

  const { error } = await supabase.from("assessments").insert({
    client_id,
    template_id: t.id,
    template_name: t.name,
    fields: t.fields,
    answers,
    score: parseNum(fd.get("score")),
    notes: str(fd.get("notes")),
    done_on: str(fd.get("done_on")) ?? new Date().toISOString().slice(0, 10),
    created_by: me.id,
  });
  if (error) return fail(error.message);
  revalidateClient(client_id);
  revalidatePath("/evaluations");
  redirect(`/clients/${client_id}?tab=evaluations`);
}

export async function deleteAssessmentAction(fd: FormData) {
  if (!(await staff())) return;
  const client_id = String(fd.get("client_id"));
  const supabase = await createClient();
  await supabase.from("assessments").delete().eq("id", String(fd.get("id")));
  revalidateClient(client_id);
  revalidatePath("/evaluations");
}

/* ================= Objectifs ================= */
export async function createGoalAction(_: FormState, fd: FormData): Promise<FormState> {
  if (!(await staff())) return fail("Accès refusé.");
  const client_id = String(fd.get("client_id") ?? "");
  const title = String(fd.get("title") ?? "").trim();
  const metric = String(fd.get("metric") ?? "custom") as GoalMetric;
  if (!title) return fail("Donne un intitulé à l'objectif.");
  if (!METRICS.includes(metric)) return fail("Indicateur inconnu.");
  const target_value = parseNum(fd.get("target_value"));
  if (target_value === null) return fail("Indique une valeur cible.");
  const start_value = parseNum(fd.get("start_value")) ?? (metric === "sessions" ? 0 : null);
  if (start_value !== null && start_value === target_value) return fail("La valeur cible doit être différente de la valeur de départ.");
  const supabase = await createClient();
  const { error } = await supabase.from("goals").insert({
    client_id,
    title: title.slice(0, 140),
    metric,
    unit: str(fd.get("unit")),
    start_value,
    target_value,
    current_value: metric === "custom" ? parseNum(fd.get("current_value")) ?? start_value : null,
    due_date: str(fd.get("due_date")),
    status: "en_cours",
  });
  if (error) return fail(error.message);
  revalidateClient(client_id);
  redirect(`/clients/${client_id}?tab=objectifs`);
}

export async function updateGoalValueAction(fd: FormData) {
  if (!(await staff())) return;
  const client_id = String(fd.get("client_id"));
  const v = parseNum(fd.get("current_value"));
  if (v === null) return;
  const supabase = await createClient();
  await supabase.from("goals").update({ current_value: v }).eq("id", String(fd.get("id")));
  revalidateClient(client_id);
}

export async function setGoalStatusAction(fd: FormData) {
  if (!(await staff())) return;
  const client_id = String(fd.get("client_id"));
  const status = String(fd.get("status"));
  if (!["en_cours", "atteint", "abandonne"].includes(status)) return;
  const supabase = await createClient();
  await supabase.from("goals").update({ status }).eq("id", String(fd.get("id")));
  revalidateClient(client_id);
}

export async function deleteGoalAction(fd: FormData) {
  if (!(await staff())) return;
  const client_id = String(fd.get("client_id"));
  const supabase = await createClient();
  await supabase.from("goals").delete().eq("id", String(fd.get("id")));
  revalidateClient(client_id);
}

/* ================= Documents ================= */
function safeName(name: string) {
  const clean = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w.-]+/g, "_")
    .replace(/_+/g, "_")
    .slice(-100);
  return clean || "fichier";
}

export async function uploadDocumentAction(_: FormState, fd: FormData): Promise<FormState> {
  const me = await staff();
  if (!me) return fail("Accès refusé.");
  const client_id = String(fd.get("client_id") ?? "");
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return fail("Choisis un fichier à envoyer.");
  if (file.size > MAX_UPLOAD) return fail("Fichier trop volumineux (10 Mo maximum).");
  const category = str(fd.get("category")) ?? "Autre";
  const shared = fd.get("shared") === "on";
  const name = (str(fd.get("name")) ?? file.name).slice(0, 160);
  const supabase = await createClient();

  let storage_path: string | null = null;
  if (!DEMO) {
    storage_path = `${client_id}/${crypto.randomUUID()}-${safeName(file.name)}`;
    const { error: upErr } = await supabase.storage.from("documents").upload(storage_path, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
    if (upErr) return fail(`Envoi impossible : ${upErr.message}`);
  }

  const { error } = await supabase.from("documents").insert({
    client_id,
    name,
    category,
    storage_path,
    size_bytes: file.size,
    mime: file.type || null,
    shared,
    created_by: me.id,
  });
  if (error) {
    if (storage_path) await supabase.storage.from("documents").remove([storage_path]);
    return fail(error.message);
  }
  revalidateClient(client_id);
  return undefined;
}

export async function toggleDocumentSharedAction(fd: FormData) {
  if (!(await staff())) return;
  const client_id = String(fd.get("client_id"));
  const supabase = await createClient();
  await supabase.from("documents").update({ shared: fd.get("shared") === "1" }).eq("id", String(fd.get("id")));
  revalidateClient(client_id);
}

export async function deleteDocumentAction(fd: FormData) {
  if (!(await staff())) return;
  const client_id = String(fd.get("client_id"));
  const id = String(fd.get("id"));
  const supabase = await createClient();
  const { data } = await supabase.from("documents").select("storage_path").eq("id", id).maybeSingle();
  const path = (data as { storage_path: string | null } | null)?.storage_path;
  if (!DEMO && path) await supabase.storage.from("documents").remove([path]);
  await supabase.from("documents").delete().eq("id", id);
  revalidateClient(client_id);
}
