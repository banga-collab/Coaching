"use client";

import { useActionState } from "react";
import { AlertCircle } from "lucide-react";
import { useRestoreOnError } from "./form-restore";

export type FormState = { error?: string } | undefined;

/** Formulaire relié à une Server Action qui renvoie { error } ou redirige. En cas d'erreur, la saisie est conservée. */
export function ActionForm({
  action,
  children,
  className,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  children: React.ReactNode;
  className?: string;
}) {
  const [state, formAction] = useActionState(async (prev: FormState, fd: FormData) => {
    remember(fd);
    return action(prev, fd);
  }, undefined);
  const { ref, remember } = useRestoreOnError(!!state?.error, state);
  return (
    <form ref={ref} action={formAction} className={className}>
      {state?.error && (
        <p className="mb-5 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 size-4 shrink-0" /> {state.error}
        </p>
      )}
      {children}
    </form>
  );
}
