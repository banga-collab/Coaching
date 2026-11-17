"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, ArrowRight, Loader2, Lock } from "lucide-react";
import { startOnlinePaymentAction } from "@/actions/payments";
import type { FormState } from "@/components/action-form";
import { buttonClass } from "@/components/ui";

function PayButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClass("primary", "h-12 w-full text-base")}>
      {pending ? <Loader2 className="size-5 animate-spin" /> : <Lock className="size-4" />}
      {pending ? "Redirection sécurisée…" : label}
      {!pending && <ArrowRight className="size-4" />}
    </button>
  );
}

/** Bouton principal « Payer » : sticky au-dessus de la barre de navigation sur mobile. */
export function PayForm({ invoiceId, label }: { invoiceId: string; label: string }) {
  const [state, action] = useActionState<FormState, FormData>(startOnlinePaymentAction, undefined);
  return (
    <form action={action}>
      <input type="hidden" name="invoice_id" value={invoiceId} />
      {state?.error && (
        <p className="mb-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          <AlertCircle className="mt-0.5 size-4 shrink-0" /> {state.error}
        </p>
      )}
      <div className="sticky bottom-20 z-10 -mx-1 rounded-2xl bg-white/90 p-1 backdrop-blur lg:static lg:bg-transparent lg:p-0">
        <PayButton label={label} />
      </div>
    </form>
  );
}
