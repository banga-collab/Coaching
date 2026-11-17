"use client";

import { useActionState } from "react";
import { AlertCircle, CheckCircle2, Send } from "lucide-react";
import { saveWebhook, testWebhook, type IntegrationState } from "@/actions/integrations";
import { Input } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

function Status({ state }: { state: IntegrationState }) {
  if (!state) return null;
  return state.error ? (
    <p className="mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
      <AlertCircle className="mt-0.5 size-4 shrink-0" /> {state.error}
    </p>
  ) : state.ok ? (
    <p className="mt-3 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-700">
      <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> {state.ok}
    </p>
  ) : null;
}

export function WebhookForms({ url }: { url: string | null }) {
  const [saveState, saveAction] = useActionState(saveWebhook, undefined);
  const [testState, testAction] = useActionState(testWebhook, undefined);
  return (
    <div>
      <form action={saveAction}>
        <label className="mb-1.5 block text-xs font-semibold text-slate-600" htmlFor="webhook_url">
          URL du webhook
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input id="webhook_url" name="webhook_url" type="url" inputMode="url" defaultValue={url ?? ""} placeholder="https://hooks.zapier.com/hooks/catch/…" className="font-mono text-xs" />
          <SubmitButton variant="brand" className="shrink-0">
            Enregistrer
          </SubmitButton>
        </div>
        <Status state={saveState} />
      </form>
      <form action={testAction} className="mt-3">
        <SubmitButton variant="secondary" pendingText="Envoi…">
          <Send className="size-4" /> Envoyer un test
        </SubmitButton>
        <Status state={testState} />
      </form>
    </div>
  );
}
