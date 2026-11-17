"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Footprints, Loader2, Plus } from "lucide-react";
import { useFormStatus } from "react-dom";
import { addStepsAction } from "@/actions/challenges";
import type { FormState } from "@/components/action-form";
import { buttonClass } from "@/components/ui";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClass("primary", "h-12 shrink-0 px-5")}>
      {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Ajouter
    </button>
  );
}

/** Saisie des pas du jour (ajoutés au cumul du défi) */
export function StepsForm({ challengeId }: { challengeId: string }) {
  const [submitted, setSubmitted] = useState(false);
  const [state, action] = useActionState(async (prev: FormState, fd: FormData) => {
    const res = await addStepsAction(prev, fd);
    setSubmitted(!res?.error);
    return res;
  }, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (submitted) {
      ref.current?.reset();
      const t = setTimeout(() => setSubmitted(false), 3500);
      return () => clearTimeout(t);
    }
  }, [submitted]);

  return (
    <form ref={ref} action={action} className="rounded-2xl bg-canvas p-3">
      <input type="hidden" name="challenge_id" value={challengeId} />
      <label htmlFor={`steps-${challengeId}`} className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-600">
        <Footprints className="size-3.5 text-accent-500" /> Mes pas d&apos;aujourd&apos;hui
      </label>
      <div className="flex gap-2">
        <input
          id={`steps-${challengeId}`}
          name="steps"
          type="number"
          inputMode="numeric"
          min={1}
          max={80000}
          required
          placeholder="Ex. 8 500"
          className="h-12 min-w-0 flex-1 rounded-xl border border-line bg-white px-4 text-base font-semibold text-ink placeholder:font-normal placeholder:text-slate-400 focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-50"
        />
        <Submit />
      </div>
      {state?.error && (
        <p className="mt-2 flex items-start gap-1.5 text-xs font-medium text-red-600">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" /> {state.error}
        </p>
      )}
      {submitted && !state?.error && (
        <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-emerald-700 animate-fade-up">
          <CheckCircle2 className="size-3.5" /> Bien joué ! Tes pas sont ajoutés au classement 👟
        </p>
      )}
    </form>
  );
}
