"use client";

import { useActionState, useEffect, useRef } from "react";
import { AlertTriangle, CheckCircle2, Loader2, LogIn, LogOut } from "lucide-react";
import { pointageAction, type PointageState } from "@/actions/controle";
import { cn } from "@/lib/utils";
import { Card, Input, buttonClass } from "@/components/ui";

/** Saisie du code de la borne ; envoi automatique quand le QR code a été scanné (?c=…) */
export function PointageForm({ nextKind, scanned }: { nextKind: "arrivee" | "depart"; scanned?: string }) {
  const [state, action, pending] = useActionState<PointageState, FormData>(pointageAction, undefined);
  const form = useRef<HTMLFormElement>(null);
  const sent = useRef(false);

  useEffect(() => {
    if (scanned && !sent.current && form.current) {
      sent.current = true;
      form.current.requestSubmit();
    }
  }, [scanned]);

  const arrive = nextKind === "arrivee";
  return (
    <Card className="p-5 sm:p-7">
      <form ref={form} action={action} className="space-y-4">
        <input type="hidden" name="kind" value={nextKind} />
        <input type="hidden" name="method" value={scanned ? "qr" : "code"} />
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-ink">Code affiché sur l&apos;écran de l&apos;accueil</span>
          <Input
            name="code"
            required
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9 ]{6,7}"
            maxLength={7}
            defaultValue={scanned ?? ""}
            placeholder="000 000"
            className="h-14 text-center font-mono text-2xl tracking-[0.3em]"
          />
        </label>
        <button type="submit" disabled={pending} className={cn(buttonClass("primary", "h-12 w-full text-base"), !arrive && "bg-slate-800 hover:bg-slate-900")}>
          {pending ? <Loader2 className="size-5 animate-spin" /> : arrive ? <LogIn className="size-5" /> : <LogOut className="size-5" />}
          {arrive ? "Pointer mon arrivée" : "Pointer mon départ"}
        </button>
        {state?.error && (
          <p role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {state.error}
          </p>
        )}
        {state?.ok && (
          <p role="status" className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> {state.ok}
          </p>
        )}
        {state?.warning && (
          <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {state.warning}
          </p>
        )}
      </form>
    </Card>
  );
}
