"use client";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import { ArrowRight, CalendarRange, Dumbbell, Eye, EyeOff, Loader2, MailCheck, ShieldCheck, UserRound } from "lucide-react";
import { signIn, signUp, type AuthState } from "./actions";
import { Field, Input, buttonClass } from "@/components/ui";
import { useT } from "@/lib/i18n/client";

type DemoAccount = { email: string; password: string; label: string; name: string; space: string };

export function AuthForm({ mode, demoAccounts }: { mode: "login" | "signup"; demoAccounts?: DemoAccount[] }) {
  const emailRef = useRef<HTMLInputElement>(null);
  const passRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const fill = (a: DemoAccount) => {
    if (emailRef.current) emailRef.current.value = a.email;
    if (passRef.current) passRef.current.value = a.password;
    formRef.current?.requestSubmit();
  };
  const [state, action, pending] = useActionState<AuthState, FormData>(mode === "login" ? signIn : signUp, undefined);
  const [show, setShow] = useState(false);
  const t = useT();
  const space = (a: DemoAccount) =>
    a.label === "Head coach" ? `${t("role.head_coach")} · ${a.space}` : t(a.label === "Adhérent" ? "auth.space.client" : a.label === "Coach" ? "auth.space.coach" : "auth.space.admin");

  if (state?.success) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <MailCheck className="mx-auto size-10 text-emerald-600" />
        <p className="mt-3 font-display font-bold text-ink">{t("auth.checkMail")}</p>
        <p className="mt-1 text-sm text-emerald-800">{state.success}</p>
        <Link href="/login" className="mt-5 inline-block text-sm font-semibold text-brand-500 hover:underline">
          {t("auth.backToLogin")}
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="mb-7 text-center">
        <h1 className="font-display text-2xl font-extrabold tracking-tight">{mode === "login" ? t("auth.login.title") : t("auth.signup.title")}</h1>
        <p className="mt-1.5 text-sm text-muted">
          {mode === "login" ? t("auth.login.sub") : t("auth.signup.sub")}
        </p>
      </div>
      <form ref={formRef} action={action} className="space-y-4">
        {mode === "signup" && (
          <Field label={t("auth.fullName")}>
            <Input name="full_name" required autoComplete="name" placeholder={t("auth.fullNamePh")} />
          </Field>
        )}
        <Field label={t("auth.email")}>
          <Input ref={emailRef} name="email" type="email" required autoComplete="email" placeholder={t("auth.emailPh")} dir="ltr" />
        </Field>
        <Field label={t("auth.password")}>
          <span className="relative block">
            <Input
              ref={passRef}
              name="password"
              type={show ? "text" : "password"}
              required
              minLength={mode === "signup" ? 8 : undefined}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              placeholder={mode === "signup" ? t("auth.passwordMin") : "••••••••"}
              className="pe-11"
            />
            <button type="button" onClick={() => setShow((s) => !s)} className="absolute end-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-muted hover:bg-canvas" aria-label={show ? t("auth.hide") : t("auth.show")}>
              {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </span>
        </Field>
        {state?.error && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</p>}
        <button type="submit" disabled={pending} className={buttonClass("primary", "h-12 w-full text-[15px]")}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          {mode === "login" ? t("auth.submitLogin") : t("auth.submitSignup")}
        </button>
      </form>
      {demoAccounts && (
        <div className="mt-7">
          <div className="mb-3 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            <span className="h-px flex-1 bg-line" /> {t("auth.demo")} <span className="h-px flex-1 bg-line" />
          </div>
          <div className="space-y-1.5">
            {demoAccounts.map((a) => {
              const Icon = a.label === "Adhérent" ? UserRound : a.label === "Coach" ? Dumbbell : a.label === "Head coach" ? CalendarRange : ShieldCheck;
              return (
                <button key={a.email} type="button" onClick={() => fill(a)} disabled={pending} className="group flex w-full items-center gap-3 rounded-2xl border border-line bg-white px-3 py-2.5 text-start transition hover:border-brand-200 hover:bg-brand-50/50 disabled:opacity-60">
                  <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${a.label === "Adhérent" ? "bg-accent-50 text-accent-600" : "bg-brand-50 text-brand-500"}`}>
                    <Icon className="size-[18px]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-ink">{space(a)}</span>
                    <span className="block truncate text-xs text-muted">{a.email} · <span className="font-mono">{a.password}</span></span>
                  </span>
                  <ArrowRight className="size-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-brand-500 rtl:-scale-x-100" />
                </button>
              );
            })}
          </div>
        </div>
      )}
      <p className="mt-6 text-center text-sm text-muted">
        {mode === "login" ? (
          <>
            {t("auth.newMember")}{" "}
            <Link href="/signup" className="font-semibold text-brand-500 hover:underline">
              {t("auth.createAccount")}
            </Link>
          </>
        ) : (
          <>
            {t("auth.haveAccount")}{" "}
            <Link href="/login" className="font-semibold text-brand-500 hover:underline">
              {t("auth.signIn")}
            </Link>
          </>
        )}
      </p>
    </>
  );
}
