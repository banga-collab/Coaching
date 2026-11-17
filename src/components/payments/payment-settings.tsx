"use client";

import { useActionState, useEffect, useState } from "react";
import { AlertCircle, Ban, CheckCircle2, CreditCard, Save, XCircle } from "lucide-react";
import { savePaymentSettingsAction, type PaymentSettingsState } from "@/actions/payments";
import { Card, CardHeader } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { cn } from "@/lib/utils";

type Env = { stripeSecret: boolean; stripeWebhook: boolean; cmiClientId: boolean; cmiStoreKey: boolean; cmiGatewayCustom: boolean; serviceRole: boolean; appUrl: boolean };

const OPTIONS = [
  { value: "stripe", title: "Stripe", text: "Cartes internationales et marocaines via Stripe Checkout.", cls: "text-[#635bff]" },
  { value: "cmi", title: "CMI", text: "Centre Monétique Interbancaire : cartes bancaires marocaines (3D Secure).", cls: "text-[#0a4f9e]" },
  { value: "aucun", title: "Aucun", text: "Pas de paiement en ligne : encaissement à l'accueil uniquement.", cls: "text-slate-500" },
] as const;

function EnvRow({ label, ok, optional }: { label: string; ok: boolean; optional?: boolean }) {
  return (
    <li className="flex items-center justify-between gap-3 py-1.5 text-xs">
      <code className="truncate font-mono text-[11px] text-slate-600">{label}</code>
      <span className={cn("inline-flex shrink-0 items-center gap-1 font-semibold", ok ? "text-emerald-600" : optional ? "text-slate-400" : "text-amber-600")}>
        {ok ? <CheckCircle2 className="size-3.5" /> : <XCircle className="size-3.5" />}
        {ok ? "Définie" : optional ? "Optionnelle" : "Manquante"}
      </span>
    </li>
  );
}

export function PaymentSettingsCard({ provider, env, demo }: { provider: "stripe" | "cmi" | "aucun"; env: Env; demo: boolean }) {
  const [state, action] = useActionState<PaymentSettingsState, FormData>(savePaymentSettingsAction, undefined);
  const [value, setValue] = useState<string>(provider);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (!state?.ok) return;
    setSaved(true);
    const t = setTimeout(() => setSaved(false), 3000);
    return () => clearTimeout(t);
  }, [state?.ok]);

  return (
    <Card id="paiement-en-ligne" className="scroll-mt-6">
      <CardHeader icon={<CreditCard className="size-4" />} title="Paiement en ligne" subtitle="Permet aux membres de régler leurs factures et formules par carte depuis l'app." />
      <form action={action} className="space-y-4 px-5 pb-5">
        {state?.error && (
          <p className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle className="mt-0.5 size-4 shrink-0" /> {state.error}
          </p>
        )}
        <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Prestataire de paiement">
          {OPTIONS.map((o) => (
            <label
              key={o.value}
              className={cn(
                "relative flex cursor-pointer flex-col rounded-xl border p-3.5 transition",
                value === o.value ? "border-brand-400 bg-brand-50/50 ring-4 ring-brand-50" : "border-line bg-white hover:border-slate-300",
              )}
            >
              <input type="radio" name="payment_provider" value={o.value} checked={value === o.value} onChange={() => setValue(o.value)} className="sr-only" />
              <span className={cn("flex items-center gap-1.5 font-display text-sm font-extrabold", o.cls)}>
                {o.value === "aucun" && <Ban className="size-3.5" />}
                {o.title}
              </span>
              <span className="mt-1 text-xs leading-relaxed text-muted">{o.text}</span>
              {value === o.value && <CheckCircle2 className="absolute right-3 top-3 size-4 text-brand-500" />}
            </label>
          ))}
        </div>

        {value !== "aucun" && (
          <div className="rounded-xl border border-line bg-canvas/50 px-4 py-3">
            <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">Variables d&apos;environnement (serveur)</p>
            <ul className="divide-y divide-line">
              {value === "stripe" ? (
                <>
                  <EnvRow label="STRIPE_SECRET_KEY" ok={env.stripeSecret} />
                  <EnvRow label="STRIPE_WEBHOOK_SECRET" ok={env.stripeWebhook} />
                </>
              ) : (
                <>
                  <EnvRow label="CMI_CLIENT_ID" ok={env.cmiClientId} />
                  <EnvRow label="CMI_STORE_KEY" ok={env.cmiStoreKey} />
                  <EnvRow label="CMI_GATEWAY_URL (défaut : test)" ok={env.cmiGatewayCustom} optional />
                </>
              )}
              <EnvRow label="SUPABASE_SERVICE_ROLE_KEY" ok={env.serviceRole} />
              <EnvRow label="NEXT_PUBLIC_APP_URL" ok={env.appUrl} optional />
            </ul>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              {demo
                ? "Mode démo : les paiements sont simulés quel que soit le prestataire."
                : value === "stripe"
                  ? "Webhook Stripe à créer sur /api/stripe/webhook (événement checkout.session.completed). Sans clé, le paiement est simulé pour l'équipe uniquement."
                  : "Communiquez au CMI l'URL de callback /api/cmi/callback. Sans identifiants, le paiement est simulé pour l'équipe uniquement."}
            </p>
          </div>
        )}

        <div className="flex items-center justify-end gap-3">
          {saved && (
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-600" role="status">
              <CheckCircle2 className="size-4" /> Enregistré
            </span>
          )}
          <SubmitButton variant="brand">
            <Save className="size-4" /> Enregistrer
          </SubmitButton>
        </div>
      </form>
    </Card>
  );
}
