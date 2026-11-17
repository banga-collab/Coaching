"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, CreditCard, Loader2, Lock, Sparkles } from "lucide-react";
import { demoPayAction } from "@/actions/payments";
import type { FormState } from "@/components/action-form";
import { buttonClass, Field, Input } from "@/components/ui";
import { cn } from "@/lib/utils";

const fmtCard = (v: string) =>
  v
    .replace(/\D/g, "")
    .slice(0, 19)
    .replace(/(\d{4})(?=\d)/g, "$1 ");
const fmtExp = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
};

function brandOf(card: string) {
  const d = card.replace(/\D/g, "");
  if (/^4/.test(d)) return "VISA";
  if (/^(5[1-5]|2[2-7])/.test(d)) return "MASTERCARD";
  if (/^3[47]/.test(d)) return "AMEX";
  return null;
}

function Submit({ amount }: { amount: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClass("primary", "h-12 w-full text-base")}>
      {pending ? <Loader2 className="size-5 animate-spin" /> : <Lock className="size-4" />}
      {pending ? "Traitement du paiement…" : `Payer ${amount}`}
    </button>
  );
}

export function DemoCheckout({ invoiceId, amount, holder }: { invoiceId: string; amount: string; holder: string }) {
  const [state, action] = useActionState<FormState, FormData>(demoPayAction, undefined);
  const [card, setCard] = useState("");
  const [exp, setExp] = useState("");
  const [name, setName] = useState(holder);
  const brand = brandOf(card);

  const fillTest = () => {
    setCard("4242 4242 4242 4242");
    const d = new Date();
    setExp(`12/${String((d.getFullYear() + 3) % 100).padStart(2, "0")}`);
    if (!name) setName(holder || "Membre Moov'Up");
  };

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="invoice_id" value={invoiceId} />

      {/* Carte visuelle */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-700 via-brand-500 to-brand-400 p-5 text-white shadow-pop">
        <div className="absolute -right-10 -top-10 size-40 rounded-full bg-white/10" />
        <div className="absolute -bottom-16 -left-6 size-40 rounded-full bg-accent-500/25" />
        <div className="relative flex items-start justify-between">
          <span className="h-8 w-11 rounded-md bg-gradient-to-br from-amber-200 to-amber-400 ring-1 ring-amber-500/40" aria-hidden />
          <span className="font-display text-sm font-black italic tracking-wider">{brand ?? "CARTE"}</span>
        </div>
        <p className="relative mt-6 font-mono text-lg tracking-[.18em] tabular-nums sm:text-xl">{card || "•••• •••• •••• ••••"}</p>
        <div className="relative mt-4 flex items-end justify-between gap-4 text-xs">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-white/60">Titulaire</p>
            <p className="truncate font-semibold uppercase">{name || "NOM PRÉNOM"}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider text-white/60">Expire</p>
            <p className="font-semibold tabular-nums">{exp || "MM/AA"}</p>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={fillTest}
        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-amber-300 bg-amber-50 px-4 text-sm font-semibold text-amber-800 transition hover:bg-amber-100"
      >
        <Sparkles className="size-4" /> Remplir avec la carte de test 4242
      </button>

      {state?.error && (
        <p className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          <AlertCircle className="mt-0.5 size-4 shrink-0" /> {state.error}
        </p>
      )}

      <Field label="Numéro de carte">
        <span className="relative block">
          <Input
            name="card"
            inputMode="numeric"
            autoComplete="off"
            placeholder="4242 4242 4242 4242"
            value={card}
            onChange={(e) => setCard(fmtCard(e.target.value))}
            className="h-12 pl-11 font-mono tracking-wider"
            required
          />
          <CreditCard className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
        </span>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Expiration">
          <Input name="exp" inputMode="numeric" autoComplete="off" placeholder="MM/AA" value={exp} onChange={(e) => setExp(fmtExp(e.target.value))} className="h-12 font-mono" required />
        </Field>
        <Field label="CVC">
          <Input name="cvc" inputMode="numeric" autoComplete="off" placeholder="123" maxLength={4} className="h-12 font-mono" required />
        </Field>
      </div>
      <Field label="Nom sur la carte">
        <Input name="name" autoComplete="off" value={name} onChange={(e) => setName(e.target.value)} className={cn("h-12 uppercase")} required />
      </Field>

      <div className="sticky bottom-20 z-10 -mx-1 rounded-2xl bg-white/90 p-1 backdrop-blur lg:static lg:bg-transparent lg:p-0">
        <Submit amount={amount} />
      </div>
      <p className="text-center text-xs text-muted">
        Astuce : la carte <span className="font-mono">4000 0000 0000 0002</span> simule un paiement refusé.
      </p>
    </form>
  );
}
