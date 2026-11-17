import type { SupabaseClient } from "@supabase/supabase-js";
import type { Automation, AutomationId, Client, Goal, GoalMetric, HealthCheck, Invoice, Measurement, Session, Task } from "./types";
import { addDays, dayKey } from "./utils";

/* ================= Métadonnées des règles ================= */
export type AutomationParam = { key: "days" | "count"; label: string; unit: string; min: number; max: number; def: number };
export type AutomationMeta = {
  title: string;
  description: (p: Record<string, number>) => string;
  effect: string;
  param?: AutomationParam;
};

export const AUTOMATION_ORDER: AutomationId[] = [
  "checkin_reminder",
  "health_check_due",
  "absence_followup",
  "invoice_overdue",
  "goal_reached",
  "inactive_client",
];

export const AUTOMATION_META: Record<AutomationId, AutomationMeta> = {
  checkin_reminder: {
    title: "Rappel de check-in",
    description: (p) =>
      `Quand un membre qui a un compte n'a pas rempli son check-in depuis ${p.days ?? 7} jours, il reçoit un rappel dans son espace et une tâche est créée pour son coach.`,
    effect: "Notification au membre + tâche",
    param: { key: "days", label: "Délai sans check-in", unit: "jours", min: 1, max: 60, def: 7 },
  },
  health_check_due: {
    title: "Bilan de santé à refaire",
    description: (p) => `Quand un client actif n'a pas eu de bilan de santé depuis ${p.days ?? 30} jours, une tâche « Bilan à faire » est créée pour son coach.`,
    effect: "Tâche pour le coach",
    param: { key: "days", label: "Délai entre deux bilans", unit: "jours", min: 7, max: 180, def: 30 },
  },
  absence_followup: {
    title: "Suivi des absences",
    description: (p) => `Quand un client est noté absent à ${p.count ?? 2} séances d'affilée, une tâche de relance est créée pour son coach.`,
    effect: "Tâche pour le coach",
    param: { key: "count", label: "Absences consécutives", unit: "séances", min: 1, max: 10, def: 2 },
  },
  invoice_overdue: {
    title: "Facture en retard",
    description: (p) =>
      (p.days ?? 0) > 0
        ? `Quand une facture envoyée n'est toujours pas payée ${p.days} jours après son échéance, le coach reçoit une notification et une tâche de relance.`
        : "Dès qu'une facture envoyée dépasse sa date d'échéance sans être payée, le coach reçoit une notification et une tâche de relance.",
    effect: "Notification + tâche",
    param: { key: "days", label: "Tolérance après échéance", unit: "jours", min: 0, max: 60, def: 0 },
  },
  goal_reached: {
    title: "Objectif atteint",
    description: () =>
      "Quand la dernière mesure d'un client atteint la valeur cible d'un objectif en cours, l'objectif passe en « atteint » et le coach comme le membre sont félicités.",
    effect: "Notifications coach + membre",
  },
  inactive_client: {
    title: "Client inactif",
    description: (p) =>
      `Quand un client actif n'a fait aucune séance depuis ${p.days ?? 14} jours et n'a rien de planifié, une tâche de relance est créée pour son coach.`,
    effect: "Tâche pour le coach",
    param: { key: "days", label: "Délai sans séance", unit: "jours", min: 3, max: 90, def: 14 },
  },
};

export const DEFAULT_PARAMS: Record<AutomationId, Record<string, number>> = {
  checkin_reminder: { days: 7 },
  health_check_due: { days: 30 },
  absence_followup: { count: 2 },
  invoice_overdue: { days: 0 },
  goal_reached: {},
  inactive_client: { days: 14 },
};

/* ================= Exécution ================= */
export type AutomationResult = { id: AutomationId; title: string; count: number; skipped?: boolean; error?: string };
export type AutomationSummary = { ranAt: string; total: number; results: AutomationResult[] };

const MEASURE_COLS: Partial<Record<GoalMetric, keyof Measurement>> = {
  weight_kg: "weight_kg",
  body_fat: "body_fat",
  waist_cm: "waist_cm",
  squat_kg: "squat_kg",
  bench_kg: "bench_kg",
  deadlift_kg: "deadlift_kg",
};

const fmtN = (n: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(n);

/**
 * Évalue les règles de la table `automations` et crée tâches / notifications.
 * `supabase` peut être le client de l'utilisateur (bouton « Exécuter ») ou un client service-role (cron).
 */
export async function runAutomations(
  supabase: SupabaseClient,
  opts: { only?: AutomationId[]; actorId?: string | null; includeDisabled?: boolean } = {},
): Promise<AutomationSummary> {
  const now = new Date();
  const ranAt = now.toISOString();
  const today = dayKey(now);
  const daysAgo = (n: number) => dayKey(addDays(now, -n));

  const [aRes, cRes, hRes, sRes, iRes, gRes, mRes, tRes] = await Promise.all([
    supabase.from("automations").select("*"),
    supabase.from("clients").select("*"),
    supabase.from("health_checks").select("client_id, checked_on").order("checked_on", { ascending: false }),
    supabase.from("sessions").select("client_id, starts_at, status").order("starts_at", { ascending: false }),
    supabase.from("invoices").select("*").eq("status", "envoyee"),
    supabase.from("goals").select("*").eq("status", "en_cours"),
    supabase.from("measurements").select("*").order("measured_on", { ascending: true }),
    supabase.from("tasks").select("*").ilike("source", "auto:%").gte("created_at", addDays(now, -180).toISOString()),
  ]);

  const rows = (aRes.data ?? []) as Automation[];
  const rules: Automation[] = AUTOMATION_ORDER.map(
    (id) => rows.find((r) => r.id === id) ?? { id, enabled: true, params: DEFAULT_PARAMS[id], last_run: null, last_count: null },
  );
  const clients = (cRes.data ?? []) as Client[];
  const clientById = new Map(clients.map((c) => [c.id, c]));
  const active = clients.filter((c) => c.status === "actif");
  const health = (hRes.data ?? []) as Pick<HealthCheck, "client_id" | "checked_on">[];
  const sessions = (sRes.data ?? []) as Pick<Session, "client_id" | "starts_at" | "status">[];
  const invoices = (iRes.data ?? []) as Invoice[];
  const goals = (gRes.data ?? []) as Goal[];
  const meas = (mRes.data ?? []) as Measurement[];
  const autoTasks = (tRes.data ?? []) as Task[];

  const lastHealth = new Map<string, string>();
  for (const h of health) if (!lastHealth.has(h.client_id) || h.checked_on > lastHealth.get(h.client_id)!) lastHealth.set(h.client_id, h.checked_on);

  const open = new Set(autoTasks.filter((t) => !t.done).map((t) => `${t.source}|${t.client_id ?? ""}`));

  async function addTask(rule: AutomationId, client: Client, title: string, priority: Task["priority"] = "normale", notes: string | null = null) {
    const source = `auto:${rule}`;
    const key = `${source}|${client.id}`;
    if (open.has(key)) return false;
    const { error } = await supabase.from("tasks").insert({
      title,
      notes,
      client_id: client.id,
      assigned_to: client.coach_id,
      due_date: today,
      priority,
      done: false,
      done_at: null,
      source,
      created_by: opts.actorId ?? null,
    });
    if (error) throw new Error(error.message);
    open.add(key);
    autoTasks.push({ title, source, client_id: client.id, done: false, created_at: ranAt } as Task);
    return true;
  }

  async function notify(user_id: string | null, title: string, body: string | null, link: string | null, kind: "info" | "alerte" | "paiement" | "tache" = "info") {
    if (!user_id) return;
    const { error } = await supabase.from("notifications").insert({ user_id, title, body, link, kind, read: false });
    if (error) throw new Error(error.message);
  }

  const handlers: Record<AutomationId, (p: Record<string, number>) => Promise<number>> = {
    async checkin_reminder(p) {
      const limit = daysAgo(p.days ?? 7);
      let n = 0;
      for (const c of active) {
        if (!c.user_id) continue;
        const last = lastHealth.get(c.id);
        if (last && last >= limit) continue;
        const created = await addTask(
          "checkin_reminder",
          c,
          `Check-in en attente : ${c.full_name}`,
          "normale",
          last ? `Dernier check-in le ${last}.` : "Aucun check-in enregistré.",
        );
        if (!created) continue;
        await notify(c.user_id, "C'est l'heure de ton check-in", "Prends 2 minutes pour dire à ton coach comment tu te sens cette semaine.", "/moi/checkin", "tache");
        n++;
      }
      return n;
    },

    async health_check_due(p) {
      const limit = daysAgo(p.days ?? 30);
      let n = 0;
      for (const c of active) {
        const last = lastHealth.get(c.id);
        if (last && last >= limit) continue;
        if (await addTask("health_check_due", c, `Bilan à faire : ${c.full_name}`, "normale", last ? `Dernier bilan le ${last}.` : "Aucun bilan enregistré.")) n++;
      }
      return n;
    },

    async absence_followup(p) {
      const count = Math.max(1, p.count ?? 2);
      let n = 0;
      for (const c of active) {
        const done = sessions.filter((s) => s.client_id === c.id && (s.status === "realisee" || s.status === "absent") && new Date(s.starts_at) <= now);
        const lastN = done.slice(0, count);
        if (lastN.length < count || !lastN.every((s) => s.status === "absent")) continue;
        // Déjà relancé après la dernière absence ?
        const latest = lastN[0]!.starts_at;
        if (autoTasks.some((t) => t.source === "auto:absence_followup" && t.client_id === c.id && t.created_at >= latest)) continue;
        if (await addTask("absence_followup", c, `Relancer ${c.full_name} : ${count} absence${count > 1 ? "s" : ""} d'affilée`, "haute")) n++;
      }
      return n;
    },

    async invoice_overdue(p) {
      const limit = daysAgo(p.days ?? 0);
      let n = 0;
      for (const inv of invoices) {
        if (!inv.due_on || inv.due_on >= limit) continue;
        const c = clientById.get(inv.client_id);
        if (!c) continue;
        if (autoTasks.some((t) => t.source === "auto:invoice_overdue" && t.client_id === c.id && t.title.includes(inv.number))) continue;
        const amount = `${new Intl.NumberFormat("fr-FR").format(Number(inv.amount_mad))} MAD`;
        const created = await addTask("invoice_overdue", c, `Facture en retard : ${c.full_name} (${inv.number})`, "haute", `${amount}, échéance le ${inv.due_on}.`);
        if (!created) continue;
        await notify(c.coach_id, "Facture en retard", `${c.full_name} – ${inv.number} – ${amount}`, "/facturation", "paiement");
        n++;
      }
      return n;
    },

    async goal_reached() {
      let n = 0;
      for (const g of goals) {
        if (g.target_value === null || g.target_value === undefined) continue;
        const c = clientById.get(g.client_id);
        if (!c) continue;
        const target = Number(g.target_value);
        let current: number | null = null;
        let start: number | null = g.start_value === null || g.start_value === undefined ? null : Number(g.start_value);
        let decreasing = false;

        const col = MEASURE_COLS[g.metric];
        if (col) {
          const vals = meas.filter((m) => m.client_id === c.id && m[col] !== null && m[col] !== undefined).map((m) => Number(m[col]));
          if (!vals.length) continue;
          current = vals.at(-1)!;
          if (start === null) start = vals[0]!;
          decreasing = start !== target ? target < start : g.metric === "body_fat" || g.metric === "waist_cm";
        } else if (g.metric === "sessions") {
          current = sessions.filter((s) => s.client_id === c.id && s.status === "realisee" && s.starts_at >= g.created_at).length;
        } else {
          current = g.current_value === null || g.current_value === undefined ? null : Number(g.current_value);
          decreasing = start !== null && target < start;
        }
        if (current === null) continue;
        const reached = decreasing ? current <= target : current >= target;
        if (!reached) continue;

        const { error } = await supabase.from("goals").update({ status: "atteint", current_value: current }).eq("id", g.id);
        if (error) throw new Error(error.message);
        const unit = g.unit ? ` ${g.unit}` : "";
        await notify(c.coach_id, "Objectif atteint", `${c.full_name} – ${g.title} (${fmtN(current)}${unit})`, `/clients/${c.id}?tab=objectifs`, "info");
        await notify(c.user_id, "Bravo, objectif atteint !", `Tu as atteint ton objectif « ${g.title} ». Continue comme ça !`, "/moi?tab=objectifs", "info");
        n++;
      }
      return n;
    },

    async inactive_client(p) {
      const days = p.days ?? 14;
      const since = addDays(now, -days);
      let n = 0;
      for (const c of active) {
        const mine = sessions.filter((s) => s.client_id === c.id);
        const recent = mine.some((s) => s.status === "realisee" && new Date(s.starts_at) >= since);
        const planned = mine.some((s) => s.status === "planifiee" && new Date(s.starts_at) >= now);
        if (recent || planned) continue;
        if (new Date(c.start_date) > since) continue; // client trop récent
        if (await addTask("inactive_client", c, `Relancer ${c.full_name} : aucune séance depuis ${days} jours`, "normale")) n++;
      }
      return n;
    },
  };

  const results: AutomationResult[] = [];
  for (const rule of rules) {
    const title = AUTOMATION_META[rule.id].title;
    if (opts.only && !opts.only.includes(rule.id)) continue;
    if (!rule.enabled && !opts.includeDisabled) {
      results.push({ id: rule.id, title, count: 0, skipped: true });
      continue;
    }
    const params = { ...DEFAULT_PARAMS[rule.id], ...(rule.params ?? {}) };
    try {
      const count = await handlers[rule.id](params);
      results.push({ id: rule.id, title, count });
      await supabase.from("automations").update({ last_run: ranAt, last_count: count }).eq("id", rule.id);
    } catch (e) {
      results.push({ id: rule.id, title, count: 0, error: e instanceof Error ? e.message : String(e) });
    }
  }

  return { ranAt, total: results.reduce((a, r) => a + r.count, 0), results };
}
