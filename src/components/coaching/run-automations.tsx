"use client";

import { useActionState } from "react";
import { AlertCircle, CheckCircle2, Loader2, MinusCircle, Play } from "lucide-react";
import { runAutomationsAction, type RunState } from "@/actions/coaching";
import { buttonClass } from "@/components/ui";
import { cn } from "@/lib/utils";

export function RunAutomations() {
  const [state, action, pending] = useActionState<RunState, FormData>(runAutomationsAction, undefined);
  const s = state?.summary;
  return (
    <div className="w-full">
      <form action={action} className="flex justify-end">
        <button type="submit" disabled={pending} className={buttonClass("primary")}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
          {pending ? "Exécution…" : "Exécuter maintenant"}
        </button>
      </form>
      {state?.error && (
        <p className="mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 size-4 shrink-0" /> {state.error}
        </p>
      )}
      {s && (
        <div className="mt-4 animate-fade-up rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4" role="status">
          <p className="flex items-center gap-2 font-display text-sm font-bold text-emerald-800">
            <CheckCircle2 className="size-4" />
            {s.total === 0 ? "Exécution terminée : rien de nouveau à signaler." : `Exécution terminée : ${s.total} action${s.total > 1 ? "s" : ""} créée${s.total > 1 ? "s" : ""}.`}
          </p>
          <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
            {s.results.map((r) => (
              <li key={r.id} className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm ring-1 ring-emerald-100">
                {r.error ? (
                  <AlertCircle className="size-4 shrink-0 text-red-500" />
                ) : r.skipped ? (
                  <MinusCircle className="size-4 shrink-0 text-slate-300" />
                ) : (
                  <CheckCircle2 className={cn("size-4 shrink-0", r.count ? "text-emerald-500" : "text-slate-300")} />
                )}
                <span className="min-w-0 flex-1 truncate text-slate-700">{r.title}</span>
                <span className={cn("text-xs font-semibold", r.error ? "text-red-600" : r.skipped ? "text-slate-400" : r.count ? "text-emerald-700" : "text-slate-500")}>
                  {r.error ? "Erreur" : r.skipped ? "Désactivée" : r.count}
                </span>
              </li>
            ))}
          </ul>
          {s.results.some((r) => r.error) && (
            <p className="mt-2 text-xs text-red-600">{s.results.filter((r) => r.error).map((r) => `${r.title} : ${r.error}`).join(" · ")}</p>
          )}
        </div>
      )}
    </div>
  );
}
