import Link from "next/link";
import { CheckCircle2, FlaskConical, MessageCircle, XCircle } from "lucide-react";
import { saveWhatsAppSettingsAction } from "@/actions/whatsapp";
import type { WaEnvStatus, WaMode } from "@/lib/whatsapp-api";
import { cn } from "@/lib/utils";
import { Badge, Card, CardHeader } from "@/components/ui";

/** Section « WhatsApp » des paramètres : interrupteur + état des variables (lecture seule). */
export function WhatsAppSettingsCard({ enabled, env, mode }: { enabled: boolean; env: WaEnvStatus; mode: WaMode }) {
  const rows = [
    { label: "WHATSAPP_TOKEN", ok: env.token },
    { label: "WHATSAPP_PHONE_ID", ok: env.phoneId },
    ...env.templates.map((t) => ({ label: t.envName, ok: t.set, optional: true })),
  ];
  return (
    <Card id="whatsapp" className="scroll-mt-6">
      <CardHeader
        icon={<MessageCircle className="size-4" />}
        title="WhatsApp"
        subtitle="Rappels automatiques et messages via l'API WhatsApp Business (Meta)."
        action={mode.live ? <Badge tone="green" dot>Connecté</Badge> : <Badge tone="amber" dot>Simulation</Badge>}
      />
      <div className="space-y-4 px-5 pb-5">
        <form action={saveWhatsAppSettingsAction} className="flex items-center justify-between gap-4 rounded-xl border border-line px-4 py-3">
          <input type="hidden" name="whatsapp_enabled" value={enabled ? "0" : "1"} />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">Envoi WhatsApp activé</p>
            <p className="text-xs text-muted">Désactivé : les messages sont seulement enregistrés en simulation.</p>
          </div>
          <button
            type="submit"
            role="switch"
            aria-checked={enabled}
            aria-label={enabled ? "Désactiver l'envoi WhatsApp" : "Activer l'envoi WhatsApp"}
            className={cn(
              "relative h-6 w-11 shrink-0 rounded-full transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100",
              enabled ? "bg-emerald-500" : "bg-slate-300",
            )}
          >
            <span className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow transition-all", enabled ? "left-[22px]" : "left-0.5")} />
          </button>
        </form>

        <div className="rounded-xl border border-line bg-canvas/50 px-4 py-3">
          <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">Variables d&apos;environnement (lecture seule)</p>
          <ul className="divide-y divide-line">
            {rows.map((r) => (
              <li key={r.label} className="flex items-center justify-between gap-3 py-1.5 text-xs">
                <code className="truncate font-mono text-[11px] text-slate-600">{r.label}</code>
                <span className={cn("inline-flex shrink-0 items-center gap-1 font-semibold", r.ok ? "text-emerald-600" : "optional" in r ? "text-slate-400" : "text-amber-600")}>
                  {r.ok ? <CheckCircle2 className="size-3.5" /> : <XCircle className="size-3.5" />}
                  {r.ok ? "Définie" : "optional" in r ? "Optionnelle" : "Manquante"}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {!mode.live && (
          <p className="flex items-start gap-2 text-xs leading-relaxed text-amber-800">
            <FlaskConical className="mt-0.5 size-3.5 shrink-0" />
            <span>Simulation : {mode.missing.join(" · ")}.</span>
          </p>
        )}
        <Link href="/whatsapp" className="inline-flex text-sm font-semibold text-brand-600 hover:underline">
          Ouvrir WhatsApp (historique, guide de mise en service) →
        </Link>
      </div>
    </Card>
  );
}
