"use client";

import { useActionState } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Field, Select } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { deactivateCoachAction, type AdminFormState } from "@/actions/admin";
import type { CoachOption } from "@/components/admin/coach-form";

/**
 * Désactivation / réactivation depuis la fiche coach. S'il reste des clients actifs ou des séances
 * à venir, l'admin choisit obligatoirement à qui les transférer.
 */
export function DeactivateForm({ id, active, needsTransfer, coaches }: { id: string; active: boolean; needsTransfer: boolean; coaches: CoachOption[] }) {
  const [state, action] = useActionState<AdminFormState, FormData>(deactivateCoachAction, undefined);
  return (
    <form action={action} className="mt-4 space-y-3">
      {state?.error && (
        <p className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertCircle className="mt-0.5 size-4 shrink-0" /> {state.error}
        </p>
      )}
      {state?.ok && (
        <p className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> {state.ok}
        </p>
      )}
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="active" value={active ? "0" : "1"} />
      {active && needsTransfer && (
        <Field label="Transférer à" hint="Clients actifs → nouveau coach référent ; séances à venir → à confirmer par le nouveau coach (notifié).">
          <Select name="transfer_to" required defaultValue="">
            <option value="" disabled>
              Choisir un coach actif…
            </option>
            {coaches.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <SubmitButton variant={active ? "danger" : "secondary"} className="w-full" pendingText={active ? "Désactivation…" : "Réactivation…"}>
        {active ? (needsTransfer ? "Transférer et désactiver" : "Désactiver") : "Réactiver"}
      </SubmitButton>
    </form>
  );
}
