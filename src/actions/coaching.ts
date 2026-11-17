"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { parseNum, str } from "@/lib/utils";
import { AUTOMATION_META, runAutomations, type AutomationSummary } from "@/lib/automations";
import type { FormState } from "@/components/action-form";
import type { AutomationId, ProgramDay, ProgramExercise, Task } from "@/lib/types";

const fail = (error: string): FormState => ({ error });

async function staff() {
  const me = await getProfile();
  if (me.role === "client") throw new Error("Accès refusé.");
  return me;
}

const safeBack = (v: FormDataEntryValue | null, fallback: string) => {
  const s = typeof v === "string" ? v : "";
  return s.startsWith("/") && !s.startsWith("//") ? s : fallback;
};

/* ======================= Programmes ======================= */
const txt = (v: unknown, max = 200) => {
  const s = typeof v === "string" ? v.trim().slice(0, max) : typeof v === "number" ? String(v) : "";
  return s || null;
};

function parseDays(raw: FormDataEntryValue | null): ProgramDay[] {
  try {
    const arr: unknown = JSON.parse(String(raw ?? "[]"));
    if (!Array.isArray(arr)) return [];
    return arr
      .map((d: Record<string, unknown>) => {
        const exs = Array.isArray(d?.exercises) ? (d.exercises as Record<string, unknown>[]) : [];
        const exercises: ProgramExercise[] = exs
          .map((e) => {
            const sets = parseNum(e?.sets === undefined || e?.sets === null ? null : String(e.sets));
            return {
              name: txt(e?.name, 120) ?? "",
              sets: sets === null ? null : Math.max(0, Math.min(99, Math.round(sets))),
              reps: txt(e?.reps, 40),
              load: txt(e?.load, 40),
              rest: txt(e?.rest, 40),
              notes: txt(e?.notes, 300),
            };
          })
          .filter((e) => e.name);
        return { title: txt(d?.title, 120) ?? "", focus: txt(d?.focus, 120), exercises };
      })
      .filter((d) => d.title || d.exercises.length)
      .map((d, i) => ({ ...d, title: d.title || `Jour ${i + 1}` }));
  } catch {
    return [];
  }
}

export async function saveProgramAction(_: FormState, fd: FormData): Promise<FormState> {
  const me = await getProfile();
  if (me.role === "client") return fail("Accès refusé.");
  const id = str(fd.get("id"));
  const name = str(fd.get("name"));
  if (!name) return fail("Donne un nom au programme.");
  const days = parseDays(fd.get("days"));
  if (!days.length) return fail("Ajoute au moins une journée avec un exercice.");
  const weeks = Math.round(parseNum(fd.get("weeks")) ?? 4);
  if (weeks < 1 || weeks > 52) return fail("La durée doit être comprise entre 1 et 52 semaines.");
  const row = {
    name,
    description: str(fd.get("description")),
    goal: str(fd.get("goal")),
    level: str(fd.get("level")) ?? "Intermédiaire",
    weeks,
    days,
  };
  const supabase = await createClient();
  let programId = id;
  if (id) {
    const { error } = await supabase.from("programs").update(row).eq("id", id);
    if (error) return fail(error.message);
  } else {
    const { data, error } = await supabase.from("programs").insert({ ...row, created_by: me.id }).select("id").single();
    if (error || !data) return fail(error?.message ?? "Impossible de créer le programme.");
    programId = data.id as string;
  }
  revalidatePath("/programmes");
  revalidatePath("/clients", "layout");
  redirect(`/programmes/${programId}`);
}

export async function duplicateProgramAction(fd: FormData) {
  const me = await staff();
  const supabase = await createClient();
  const { data: p } = await supabase.from("programs").select("*").eq("id", String(fd.get("id"))).single();
  if (!p) redirect("/programmes");
  const { data } = await supabase
    .from("programs")
    .insert({ name: `${p.name} (copie)`, description: p.description, goal: p.goal, level: p.level, weeks: p.weeks, days: p.days, created_by: me.id })
    .select("id")
    .single();
  revalidatePath("/programmes");
  redirect(data ? `/programmes/${data.id}/modifier` : "/programmes");
}

export async function deleteProgramAction(fd: FormData) {
  await staff();
  const id = String(fd.get("id"));
  const supabase = await createClient();
  await supabase.from("client_programs").delete().eq("program_id", id);
  await supabase.from("programs").delete().eq("id", id);
  revalidatePath("/programmes");
  revalidatePath("/clients", "layout");
  redirect("/programmes");
}

export async function assignProgramAction(_: FormState, fd: FormData): Promise<FormState> {
  const me = await getProfile();
  if (me.role === "client") return fail("Accès refusé.");
  const client_id = str(fd.get("client_id"));
  const program_id = str(fd.get("program_id"));
  if (!client_id) return fail("Choisis un client.");
  if (!program_id) return fail("Choisis un programme.");
  const start_date = str(fd.get("start_date")) ?? new Date().toISOString().slice(0, 10);
  const supabase = await createClient();

  if (fd.get("replace") === "on") {
    await supabase.from("client_programs").update({ status: "termine" }).eq("client_id", client_id).in("status", ["actif", "pause"]);
  }
  const { error } = await supabase.from("client_programs").insert({ client_id, program_id, start_date, status: "actif" });
  if (error) return fail(error.message);

  // Le membre est prévenu s'il a un compte
  const [{ data: c }, { data: p }] = await Promise.all([
    supabase.from("clients").select("user_id").eq("id", client_id).maybeSingle(),
    supabase.from("programs").select("name").eq("id", program_id).maybeSingle(),
  ]);
  if (c?.user_id) {
    await supabase.from("notifications").insert({
      user_id: c.user_id,
      title: "Nouveau programme disponible",
      body: p?.name ?? null,
      link: "/moi?tab=programme",
      kind: "info",
      read: false,
    });
  }

  revalidatePath(`/clients/${client_id}`);
  revalidatePath(`/programmes/${program_id}`);
  revalidatePath("/programmes");
  redirect(safeBack(fd.get("back"), `/clients/${client_id}?tab=programme`));
}

export async function setClientProgramStatusAction(fd: FormData) {
  await staff();
  const id = String(fd.get("id"));
  const status = String(fd.get("status"));
  if (!["actif", "pause", "termine"].includes(status)) return;
  const supabase = await createClient();
  await supabase.from("client_programs").update({ status }).eq("id", id);
  revalidatePath(`/clients/${String(fd.get("client_id"))}`);
  revalidatePath("/programmes", "layout");
}

export async function removeClientProgramAction(fd: FormData) {
  await staff();
  const supabase = await createClient();
  await supabase.from("client_programs").delete().eq("id", String(fd.get("id")));
  revalidatePath(`/clients/${String(fd.get("client_id"))}`);
  revalidatePath("/programmes", "layout");
}

/* ======================= Tâches ======================= */
export async function createTaskAction(_: FormState, fd: FormData): Promise<FormState> {
  const me = await getProfile();
  if (me.role === "client") return fail("Accès refusé.");
  const title = str(fd.get("title"));
  if (!title) return fail("Écris l'intitulé de la tâche.");
  const priority = (str(fd.get("priority")) ?? "normale") as Task["priority"];
  if (!["basse", "normale", "haute"].includes(priority)) return fail("Priorité invalide.");
  const supabase = await createClient();
  const { error } = await supabase.from("tasks").insert({
    title: title.slice(0, 200),
    notes: str(fd.get("notes")),
    client_id: str(fd.get("client_id")),
    assigned_to: me.id,
    due_date: str(fd.get("due_date")),
    priority,
    done: false,
    done_at: null,
    source: "manuel",
    created_by: me.id,
  });
  if (error) return fail(error.message);
  revalidatePath("/taches");
  revalidatePath("/");
  return undefined;
}

export async function toggleTaskAction(fd: FormData) {
  await staff();
  const done = String(fd.get("done")) !== "1";
  const supabase = await createClient();
  await supabase
    .from("tasks")
    .update({ done, done_at: done ? new Date().toISOString() : null })
    .eq("id", String(fd.get("id")));
  revalidatePath("/taches");
  revalidatePath("/");
}

export async function deleteTaskAction(fd: FormData) {
  await staff();
  const supabase = await createClient();
  await supabase.from("tasks").delete().eq("id", String(fd.get("id")));
  revalidatePath("/taches");
  revalidatePath("/");
}

/* ======================= Automatisations ======================= */
const isRule = (v: unknown): v is AutomationId => typeof v === "string" && v in AUTOMATION_META;

export async function toggleAutomationAction(fd: FormData) {
  await staff();
  const id = fd.get("id");
  if (!isRule(id)) return;
  const supabase = await createClient();
  await supabase.from("automations").update({ enabled: String(fd.get("enabled")) === "1" }).eq("id", id);
  revalidatePath("/automatisations");
}

export async function saveAutomationParamAction(fd: FormData) {
  await staff();
  const id = fd.get("id");
  if (!isRule(id)) return;
  const meta = AUTOMATION_META[id].param;
  if (!meta) return;
  const raw = parseNum(fd.get("value"));
  const value = Math.round(Math.min(meta.max, Math.max(meta.min, raw ?? meta.def)));
  const supabase = await createClient();
  const { data } = await supabase.from("automations").select("*").eq("id", id).maybeSingle();
  const params = { ...((data?.params as Record<string, number> | undefined) ?? {}), [meta.key]: value };
  await supabase.from("automations").update({ params }).eq("id", id);
  revalidatePath("/automatisations");
}

export type RunState = { error?: string; summary?: AutomationSummary } | undefined;

export async function runAutomationsAction(prev: RunState, fd: FormData): Promise<RunState> {
  void prev;
  void fd;
  const me = await getProfile();
  if (me.role === "client") return { error: "Accès refusé." };
  try {
    const supabase = await createClient();
    const summary = await runAutomations(supabase, { actorId: me.id });
    revalidatePath("/automatisations");
    revalidatePath("/taches");
    revalidatePath("/");
    return { summary };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur pendant l'exécution." };
  }
}
