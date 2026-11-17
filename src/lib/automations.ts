import type { SupabaseClient } from "@supabase/supabase-js";
import type { Automation, AutomationId, Client, Goal, GoalMetric, HealthCheck, Invoice, Measurement, Membership, Session, Task, WhatsAppMessage } from "./types";
import { addDays, dayKey, fmtDate, fmtTime } from "./utils";
import { WA_TEMPLATES } from "./whatsapp";
import { sendWhatsApp } from "./whatsapp-api";
import { membershipExpiringText } from "@/components/whatsapp/templates";

/** Règles ajoutées par le module WhatsApp / abonnements (en plus des `AutomationId` historiques). */
export type WaRuleId = "wa_session_reminder" | "wa_invoice_overdue" | "wa_checkin_missing" | "membership_expiring";
export type RuleId = AutomationId | WaRuleId;
export type AutomationRule = Omit<Automation, "id"> & { id: RuleId };

/* ================= Métadonnées des règles ================= */
export type AutomationParam = { key: "days" | "count" | "hours"; label: string; unit: string; min: number; max: number; def: number };
export type AutomationMeta = {
  title: string;
  description: (p: Record<string, number>) => string;
  effect: string;
  param?: AutomationParam;
};

export const AUTOMATION_ORDER: RuleId[] = [
  "checkin_reminder",
  "health_check_due",
  "absence_followup",
  "invoice_overdue",
  "goal_reached",
  "inactive_client",
  "membership_expiring",
  "wa_session_reminder",
  "wa_invoice_overdue",
  "wa_checkin_missing",
];

/** Règles qui envoient (ou simulent) un message WhatsApp. */
export const WHATSAPP_RULES: RuleId[] = ["wa_session_reminder", "wa_invoice_overdue", "wa_checkin_missing", "membership_expiring"];

export const AUTOMATION_META: Record<RuleId, AutomationMeta> = {
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
  membership_expiring: {
    title: "Abonnement bientôt terminé",
    description: (p) =>
      `Quand un abonnement actif se termine dans ${p.days ?? 7} jours ou moins (et n'a pas déjà été renouvelé), le membre est prévenu dans son espace et sur WhatsApp, et une tâche de renouvellement est créée pour son coach. Une seule fois par abonnement.`,
    effect: "Notification + tâche + WhatsApp",
    param: { key: "days", label: "Prévenir avant la fin", unit: "jours", min: 1, max: 60, def: 7 },
  },
  wa_session_reminder: {
    title: "WhatsApp : rappel de séance",
    description: (p) =>
      `Chaque séance planifiée qui commence dans les ${p.hours ?? 24} prochaines heures déclenche un rappel WhatsApp au client (un seul message par client et par jour).`,
    effect: "Message WhatsApp au client",
    param: { key: "hours", label: "Fenêtre avant la séance", unit: "heures", min: 2, max: 72, def: 24 },
  },
  wa_invoice_overdue: {
    title: "WhatsApp : facture en retard",
    description: (p) =>
      `Quand une facture envoyée n'est pas payée ${p.days ?? 3} jour${(p.days ?? 3) > 1 ? "s" : ""} après son échéance, le client reçoit une relance WhatsApp courtoise. Une seule relance par facture.`,
    effect: "Message WhatsApp au client",
    param: { key: "days", label: "Retard minimum", unit: "jours", min: 1, max: 60, def: 3 },
  },
  wa_checkin_missing: {
    title: "WhatsApp : check-in manquant",
    description: (p) =>
      `Quand un membre qui a un compte n'a pas fait de check-in depuis ${p.days ?? 7} jours, il reçoit un petit rappel WhatsApp (au maximum une fois par semaine).`,
    effect: "Message WhatsApp au membre",
    param: { key: "days", label: "Délai sans check-in", unit: "jours", min: 3, max: 60, def: 7 },
  },
};

export const DEFAULT_PARAMS: Record<RuleId, Record<string, number>> = {
  checkin_reminder: { days: 7 },
  health_check_due: { days: 30 },
  absence_followup: { count: 2 },
  invoice_overdue: { days: 0 },
  goal_reached: {},
  inactive_client: { days: 14 },
  membership_expiring: { days: 7 },
  wa_session_reminder: { hours: 24 },
  wa_invoice_overdue: { days: 3 },
  wa_checkin_missing: { days: 7 },
};

/** État par défaut quand la ligne n'existe pas encore en base (identique au seed SQL). */
export const DEFAULT_ENABLED: Record<RuleId, boolean> = {
  checkin_reminder: true,
  health_check_due: true,
  absence_followup: true,
  invoice_overdue: true,
  goal_reached: true,
  inactive_client: true,
  membership_expiring: true,
  wa_session_reminder: false,
  wa_invoice_overdue: false,
  wa_checkin_missing: false,
};

type RuleRow = { id: string; enabled: boolean; params: Record<string, number> | null; last_run: string | null; last_count: number | null };

/** Règles complètes (lignes en base + valeurs par défaut), dans l'ordre d'affichage. */
export function withDefaults(rows: RuleRow[]): AutomationRule[] {
  return AUTOMATION_ORDER.map((id) => {
    const r = rows.find((x) => x.id === id);
    return r
      ? { id, enabled: r.enabled, params: r.params ?? {}, last_run: r.last_run, last_count: r.last_count }
      : { id, enabled: DEFAULT_ENABLED[id], params: DEFAULT_PARAMS[id], last_run: null, last_count: null };
  });
}

/* ================= Exécution ================= */
export type AutomationResult = { id: RuleId; title: string; count: number; skipped?: boolean; error?: string };
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
  opts: { only?: RuleId[]; actorId?: string | null; includeDisabled?: boolean } = {},
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

  const rules = withDefaults((aRes.data ?? []) as RuleRow[]);
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

  async function addTask(rule: RuleId, client: Client, title: string, priority: Task["priority"] = "normale", notes: string | null = null) {
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

  /* ---------- WhatsApp : historique (anti-doublon) + envoi ---------- */
  type WaLog = Pick<WhatsAppMessage, "client_id" | "template" | "body" | "created_at">;
  let waLog: WaLog[] | null = null;
  async function waHistory() {
    if (!waLog) {
      const { data, error } = await supabase
        .from("whatsapp_messages")
        .select("client_id, template, body, created_at")
        .in("template", ["session_reminder", "invoice_overdue", "checkin_missing", "membership_expiring"])
        .gte("created_at", addDays(now, -400).toISOString());
      if (error) throw new Error(error.message);
      waLog = (data ?? []) as WaLog[];
    }
    return waLog;
  }
  async function wa(c: Client, template: string, body: string, params: string[]) {
    const res = await sendWhatsApp({ to: c.phone, body, template, clientId: c.id, params }, supabase);
    (await waHistory()).push({ client_id: c.id, template, body, created_at: ranAt });
    return res.ok;
  }
  const firstName = (c: Client) => c.full_name.split(" ")[0] ?? c.full_name;
  const madTxt = (v: number) => `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(Number(v))} MAD`;

  const handlers: Record<RuleId, (p: Record<string, number>) => Promise<number>> = {
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

    async membership_expiring(p) {
      const days = p.days ?? 7;
      const limit = dayKey(addDays(now, days));
      const { data, error } = await supabase.from("memberships").select("*").eq("status", "actif");
      if (error) throw new Error(error.message);
      const all = (data ?? []) as Membership[];
      let n = 0;
      for (const m of all) {
        if (m.end_date < today || m.end_date > limit) continue;
        // Déjà renouvelé : un autre abonnement actif du même membre se termine plus tard
        if (all.some((o) => o.id !== m.id && o.client_id === m.client_id && o.end_date > m.end_date)) continue;
        const c = clientById.get(m.client_id);
        if (!c || c.status === "termine") continue;
        const dateLabel = fmtDate(`${m.end_date}T12:00:00`, { day: "numeric", month: "long" });
        if (autoTasks.some((t) => t.source === "auto:membership_expiring" && t.client_id === c.id && t.title.includes(m.name) && t.title.includes(dateLabel))) continue;
        const created = await addTask(
          "membership_expiring",
          c,
          `Renouvellement : « ${m.name} » de ${c.full_name} se termine le ${dateLabel}`,
          "haute",
          m.sessions_total ? `${m.sessions_used}/${m.sessions_total} séances utilisées.` : null,
        );
        if (!created) continue;
        await notify(c.user_id, "Ton abonnement se termine bientôt", `« ${m.name} » prend fin le ${dateLabel}. Pense à le renouveler pour continuer sur ta lancée 💪`, "/moi/carte", "alerte");
        if (c.phone) await wa(c, "membership_expiring", membershipExpiringText(firstName(c), m.name, dateLabel), [firstName(c), m.name, dateLabel]);
        n++;
      }
      return n;
    },

    async wa_session_reminder(p) {
      const hours = p.hours ?? 24;
      const until = new Date(now.getTime() + hours * 3_600_000);
      const { data, error } = await supabase
        .from("sessions")
        .select("*")
        .eq("status", "planifiee")
        .gte("starts_at", now.toISOString())
        .lte("starts_at", until.toISOString())
        .order("starts_at", { ascending: true });
      if (error) throw new Error(error.message);
      const log = await waHistory();
      const tomorrow = dayKey(addDays(now, 1));
      let n = 0;
      for (const s of (data ?? []) as Session[]) {
        const c = clientById.get(s.client_id);
        if (!c || !c.phone || c.status === "termine") continue;
        // Un seul rappel par client et par jour
        if (log.some((m) => m.template === "session_reminder" && m.client_id === c.id && dayKey(m.created_at) === today)) continue;
        const d = dayKey(s.starts_at);
        const dayTxt = d === today ? "aujourd'hui" : d === tomorrow ? "demain" : `le ${fmtDate(s.starts_at, { weekday: "long", day: "numeric", month: "long" })}`;
        const when = `${dayTxt} à ${fmtTime(s.starts_at)}`;
        if (await wa(c, "session_reminder", WA_TEMPLATES.sessionReminder(firstName(c), when), [firstName(c), when])) n++;
      }
      return n;
    },

    async wa_invoice_overdue(p) {
      const limit = daysAgo(Math.max(1, p.days ?? 3));
      const log = await waHistory();
      let n = 0;
      for (const inv of invoices) {
        if (!inv.due_on || inv.due_on > limit) continue;
        const c = clientById.get(inv.client_id);
        if (!c || !c.phone) continue;
        // Une seule relance par facture
        if (log.some((m) => m.template === "invoice_overdue" && m.client_id === c.id && m.body.includes(inv.number))) continue;
        const amount = madTxt(inv.amount_mad);
        if (await wa(c, "invoice_overdue", WA_TEMPLATES.invoice(firstName(c), inv.number, amount), [firstName(c), inv.number, amount])) n++;
      }
      return n;
    },

    async wa_checkin_missing(p) {
      const limit = daysAgo(p.days ?? 7);
      const weekAgo = addDays(now, -7).toISOString();
      const log = await waHistory();
      let n = 0;
      for (const c of active) {
        if (!c.user_id || !c.phone) continue;
        const last = lastHealth.get(c.id);
        if (last && last >= limit) continue;
        // Au maximum une fois par semaine
        if (log.some((m) => m.template === "checkin_missing" && m.client_id === c.id && m.created_at >= weekAgo)) continue;
        if (await wa(c, "checkin_missing", WA_TEMPLATES.checkin(firstName(c)), [firstName(c)])) n++;
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
