"use client";

import { useActionState } from "react";
import { useRestoreOnError } from "@/components/form-restore";
import Link from "next/link";
import { AlertCircle, AlertTriangle, CheckCircle2, UserCheck } from "lucide-react";
import type { PlanState } from "@/actions/planning";

/**
 * Formulaire relié à une action du planning : affiche l'erreur (avec la raison),
 * les coachs libres suggérés (un clic les sélectionne dans le champ « coach_id ») et le succès.
 */
export function PlanForm({
  action,
  children,
  className,
}: {
  action: (state: PlanState, formData: FormData) => Promise<PlanState>;
  children: React.ReactNode;
  className?: string;
}) {
  const [state, formAction] = useActionState(async (prev: PlanState, fd: FormData) => {
    remember(fd);
    return action(prev, fd);
  }, undefined);
  // React vide le formulaire après l'envoi : en cas d'erreur on remet ce qui avait été saisi
  const { ref, remember } = useRestoreOnError(!!state?.error, state);
  const pickCoach = (id: string) => {
    const sel = ref.current?.querySelector<HTMLSelectElement>('select[name="coach_id"]');
    if (sel) {
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set?.call(sel, id);
      sel.dispatchEvent(new Event("change", { bubbles: true }));
      sel.focus();
    }
  };
  const canPick = () => !!ref.current?.querySelector('select[name="coach_id"]');
  return (
    <form ref={ref} action={formAction} className={className}>
      {state?.error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <p className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 size-4 shrink-0" /> <span>{state.error}</span>
          </p>
          {state.free && (
            <div className="mt-2 border-t border-red-100 pt-2">
              {state.free.length ? (
                <>
                  <p className="mb-1.5 text-xs font-semibold text-red-800">Coachs libres à cet horaire :</p>
                  <div className="flex flex-wrap gap-1.5">
                    {state.free.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => (canPick() ? pickCoach(f.id) : undefined)}
                        className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200 transition hover:bg-emerald-50"
                      >
                        <UserCheck className="size-3.5" /> {f.name}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-xs font-semibold text-red-800">Aucun autre coach n&apos;est libre à cet horaire.</p>
              )}
            </div>
          )}
        </div>
      )}
      {state?.warning && (
        <p className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" /> <span>{state.warning}</span>
        </p>
      )}
      {state?.ok && (
        <p className="mb-4 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
          <span>
            {state.ok}
            {state.sessionId && (
              <>
                {" "}
                <Link href={`/seances/${state.sessionId}`} className="font-semibold underline">
                  Voir la séance
                </Link>
              </>
            )}
          </span>
        </p>
      )}
      {children}
    </form>
  );
}
