import Link from "next/link";
import {
  Bell,
  CalendarClock,
  CalendarX2,
  Clock,
  FlaskConical,
  HeartPulse,
  ListChecks,
  MessageCircle,
  Save,
  Trophy,
  UserX,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireManager } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { AUTOMATION_META, DEFAULT_PARAMS, WHATSAPP_RULES, withDefaults, type AutomationRule, type RuleId } from "@/lib/automations";
import { whatsappMode } from "@/lib/whatsapp-api";
import { cn, fmtDate, fmtTime } from "@/lib/utils";
import { Badge, Card, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { RunAutomations } from "@/components/coaching/run-automations";
import { saveAutomationParamAction, toggleAutomationAction } from "@/actions/coaching";

export const metadata = { title: "Automatisations" };

const ICONS: Record<RuleId, { icon: LucideIcon; bg: string }> = {
  checkin_reminder: { icon: Bell, bg: "bg-brand-50 text-brand-500" },
  health_check_due: { icon: HeartPulse, bg: "bg-rose-50 text-rose-500" },
  absence_followup: { icon: CalendarX2, bg: "bg-amber-50 text-amber-600" },
  goal_reached: { icon: Trophy, bg: "bg-emerald-50 text-emerald-600" },
  inactive_client: { icon: UserX, bg: "bg-accent-50 text-accent-600" },
  wa_session_reminder: { icon: CalendarClock, bg: "bg-emerald-50 text-emerald-600" },
  wa_checkin_missing: { icon: MessageCircle, bg: "bg-emerald-50 text-emerald-600" },
};

function RuleCard({ r, i }: { r: AutomationRule; i: number }) {
  const meta = AUTOMATION_META[r.id];
  const { icon: Icon, bg } = ICONS[r.id];
  const params = { ...DEFAULT_PARAMS[r.id], ...(r.params ?? {}) };
  const isWa = WHATSAPP_RULES.includes(r.id);
  return (
    <Card className={cn("flex animate-fade-up flex-col transition", !r.enabled && "bg-slate-50/60")} style={{ animationDelay: `${i * 40}ms` }}>
      <div className="flex items-start gap-3 p-5 pb-4">
        <span className={cn("grid size-11 shrink-0 place-items-center rounded-xl transition", r.enabled ? bg : "bg-slate-100 text-slate-400")}>
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className={cn("font-display text-[15px] font-bold", r.enabled ? "text-ink" : "text-slate-500")}>{meta.title}</h3>
            {r.enabled ? <Badge tone="green" dot>Active</Badge> : <Badge tone="gray">Désactivée</Badge>}
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">{meta.description(params)}</p>
        </div>
        <form action={toggleAutomationAction}>
          <input type="hidden" name="id" value={r.id} />
          <input type="hidden" name="enabled" value={r.enabled ? "0" : "1"} />
          <button
            type="submit"
            role="switch"
            aria-checked={r.enabled}
            aria-label={r.enabled ? `Désactiver « ${meta.title} »` : `Activer « ${meta.title} »`}
            className={cn(
              "relative h-6 w-11 shrink-0 rounded-full transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100",
              r.enabled ? "bg-brand-500" : "bg-slate-300",
            )}
          >
            <span className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow transition-all", r.enabled ? "left-[22px]" : "left-0.5")} />
          </button>
        </form>
      </div>

      <div className="mt-auto flex flex-wrap items-end justify-between gap-3 border-t border-line px-5 py-3.5">
        {meta.param ? (
          <form action={saveAutomationParamAction} className="flex items-end gap-2">
            <input type="hidden" name="id" value={r.id} />
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">{meta.param.label}</span>
              <span className="flex items-center gap-2">
                <input
                  type="number"
                  name="value"
                  min={meta.param.min}
                  max={meta.param.max}
                  defaultValue={params[meta.param.key] ?? meta.param.def}
                  className="h-9 w-20 rounded-lg border border-line bg-white px-3 text-sm font-semibold text-ink focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-50"
                />
                <span className="text-sm text-muted">{meta.param.unit}</span>
              </span>
            </label>
            <SubmitButton variant="secondary" className="h-9 px-3 text-xs" pendingText="…">
              <Save className="size-3.5" /> OK
            </SubmitButton>
          </form>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-xs text-muted">
            <ListChecks className="size-3.5" /> Aucun réglage nécessaire
          </span>
        )}
        <div className="text-right text-xs">
          <p className="font-semibold text-slate-600">{meta.effect}</p>
          <p className="mt-0.5 text-muted">
            {r.last_run ? (
              <>
                {fmtDate(r.last_run, { day: "numeric", month: "short" })} à {fmtTime(r.last_run)} ·{" "}
                <b className={cn(r.last_count ? "text-accent-600" : "text-slate-500")}>
                  {r.last_count ?? 0} {isWa ? `message${(r.last_count ?? 0) > 1 ? "s" : ""}` : `créée${(r.last_count ?? 0) > 1 ? "s" : ""}`}
                </b>
              </>
            ) : (
              "Jamais exécutée"
            )}
          </p>
        </div>
      </div>
    </Card>
  );
}

export default async function AutomationsPage() {
  // Réservé aux managers (admin, head coach) : un coach ne gère pas les automatisations
  await requireManager();
  const supabase = await createClient();
  const [{ data }, settings] = await Promise.all([supabase.from("automations").select("*"), getSettings()]);
  const rules = withDefaults((data ?? []) as AutomationRule[]);
  const coreRules = rules.filter((r) => !r.id.startsWith("wa_"));
  const waRules = rules.filter((r) => r.id.startsWith("wa_"));
  const enabled = rules.filter((r) => r.enabled).length;
  const lastRun = rules.map((r) => r.last_run).filter((d): d is string => !!d).sort().at(-1);
  const wa = whatsappMode(settings.whatsapp_enabled);

  return (
    <>
      <PageHeader title="Automatisations" subtitle={`${enabled} règle${enabled > 1 ? "s" : ""} active${enabled > 1 ? "s" : ""} sur ${rules.length}`} />

      {/* Explication + exécution */}
      <Card className="relative mb-6 overflow-hidden">
        <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-brand-500 to-accent-500" />
        <div className="flex flex-col gap-4 p-5 sm:p-6 lg:flex-row lg:items-start">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-500">
            <Workflow className="size-6" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-base font-bold text-ink">Votre assistant de suivi, tous les matins</h2>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted">
              Chaque jour à 7 h (heure d&apos;Agadir), l&apos;application vérifie automatiquement vos clients et crée les{" "}
              <Link href="/taches" className="font-semibold text-brand-600 hover:underline">
                tâches
              </Link>{" "}
              et notifications utiles : relances, bilans à prévoir, objectifs atteints… Rien n&apos;est créé en double : tant qu&apos;une tâche automatique reste
              ouverte pour un client, elle n&apos;est pas recréée.
            </p>
            <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted">
              <Clock className="size-3.5" />
              {lastRun ? `Dernière exécution le ${fmtDate(lastRun, { day: "numeric", month: "long" })} à ${fmtTime(lastRun)}` : "Jamais exécutée pour l'instant"}
            </p>
          </div>
          <div className="lg:w-[420px]">
            <RunAutomations />
          </div>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {coreRules.map((r, i) => (
          <RuleCard key={r.id} r={r} i={i} />
        ))}
      </div>

      {/* Rappels WhatsApp */}
      <div className="mb-4 mt-10 flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl bg-emerald-50 text-emerald-600">
            <MessageCircle className="size-5" />
          </span>
          <div>
            <h2 className="font-display text-lg font-bold text-ink">Rappels WhatsApp</h2>
            <p className="text-xs text-muted">Messages automatiques envoyés depuis votre numéro WhatsApp Business. Chaque envoi est visible dans l&apos;historique.</p>
          </div>
        </div>
        <Link
          href="/whatsapp"
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ring-inset transition",
            wa.live ? "bg-emerald-50 text-emerald-700 ring-emerald-100 hover:bg-emerald-100" : "bg-amber-50 text-amber-800 ring-amber-100 hover:bg-amber-100",
          )}
        >
          {wa.live ? <MessageCircle className="size-3.5" /> : <FlaskConical className="size-3.5" />}
          {wa.live ? "WhatsApp connecté" : "Mode simulation : aucun envoi réel"}
        </Link>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {waRules.map((r, i) => (
          <RuleCard key={r.id} r={r} i={i} />
        ))}
      </div>
    </>
  );
}
