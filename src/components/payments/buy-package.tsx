"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, Loader2, ShoppingBag } from "lucide-react";
import { buyPackageAction } from "@/actions/payments";
import type { FormState } from "@/components/action-form";
import { buttonClass } from "@/components/ui";

function Btn({ featured }: { featured: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClass(featured ? "primary" : "secondary", "h-11 w-full")}>
      {pending ? <Loader2 className="size-4 animate-spin" /> : <ShoppingBag className="size-4" />}
      {pending ? "Préparation…" : "Choisir et payer"}
    </button>
  );
}

export function BuyPackageButton({ packageId, featured = false }: { packageId: string; featured?: boolean }) {
  const [state, action] = useActionState<FormState, FormData>(buyPackageAction, undefined);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="package_id" value={packageId} />
      {state?.error && (
        <p className="flex items-start gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700" role="alert">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" /> {state.error}
        </p>
      )}
      <Btn featured={featured} />
    </form>
  );
}
