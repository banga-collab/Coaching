"use client";

import { Copy } from "lucide-react";
import { duplicatePlanAction } from "@/actions/nutrition";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { Select } from "@/components/ui";

type Opt = { id: string; label: string };

/** Copie un plan vers un client : soit plan fixé + choix du client, soit client fixé + choix du modèle. */
export function AssignPlanForm({
  planId,
  clientId,
  options,
  placeholder,
  submitLabel = "Assigner",
}: {
  planId?: string;
  clientId?: string;
  options: Opt[];
  placeholder: string;
  submitLabel?: string;
}) {
  const selectName = planId ? "client_id" : "plan_id";
  return (
    <ActionForm action={duplicatePlanAction}>
      {planId && <input type="hidden" name="plan_id" value={planId} />}
      {clientId && <input type="hidden" name="client_id" value={clientId} />}
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="min-w-0 flex-1">
          <Select name={selectName} required defaultValue="" aria-label={placeholder}>
            <option value="" disabled>
              {placeholder}
            </option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
        <SubmitButton variant="brand" className="h-11" pendingText="Copie…">
          <Copy className="size-4" /> {submitLabel}
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
