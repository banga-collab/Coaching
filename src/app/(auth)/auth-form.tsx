"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Eye, EyeOff, Loader2, MailCheck } from "lucide-react";
import { signIn, signUp, type AuthState } from "./actions";
import { Field, Input, buttonClass } from "@/components/ui";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(mode === "login" ? signIn : signUp, undefined);
  const [show, setShow] = useState(false);

  if (state?.success) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <MailCheck className="mx-auto size-10 text-emerald-600" />
        <p className="mt-3 font-display font-bold text-ink">Vérifie ta boîte mail</p>
        <p className="mt-1 text-sm text-emerald-800">{state.success}</p>
        <Link href="/login" className="mt-5 inline-block text-sm font-semibold text-brand-500 hover:underline">
          Retour à la connexion
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="mb-7 text-center">
        <h1 className="font-display text-2xl font-extrabold tracking-tight">{mode === "login" ? "Bon retour 👋" : "Créer mon compte"}</h1>
        <p className="mt-1.5 text-sm text-muted">
          {mode === "login" ? "Connecte-toi à ton espace Moov'Up." : "Utilise l'e-mail que tu as donné à ton coach pour retrouver ton suivi."}
        </p>
      </div>
      <form action={action} className="space-y-4">
        {mode === "signup" && (
          <Field label="Nom complet">
            <Input name="full_name" required autoComplete="name" placeholder="Prénom Nom" />
          </Field>
        )}
        <Field label="E-mail">
          <Input name="email" type="email" required autoComplete="email" placeholder="toi@exemple.com" />
        </Field>
        <Field label="Mot de passe">
          <span className="relative block">
            <Input
              name="password"
              type={show ? "text" : "password"}
              required
              minLength={mode === "signup" ? 8 : undefined}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              placeholder={mode === "signup" ? "8 caractères minimum" : "••••••••"}
              className="pr-11"
            />
            <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-muted hover:bg-canvas" aria-label={show ? "Masquer" : "Afficher"}>
              {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </span>
        </Field>
        {state?.error && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</p>}
        <button type="submit" disabled={pending} className={buttonClass("primary", "h-12 w-full text-[15px]")}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          {mode === "login" ? "Se connecter" : "Créer mon compte"}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        {mode === "login" ? (
          <>
            Nouvel adhérent ?{" "}
            <Link href="/signup" className="font-semibold text-brand-500 hover:underline">
              Créer un compte
            </Link>
          </>
        ) : (
          <>
            Déjà un compte ?{" "}
            <Link href="/login" className="font-semibold text-brand-500 hover:underline">
              Se connecter
            </Link>
          </>
        )}
      </p>
    </>
  );
}
