"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, LockKeyhole, LogOut, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui";
import { ThemeToggle } from "@/components/shell/controls";
import { BackButton } from "@/components/shell/back-button";
import { signOut } from "@/app/(auth)/actions";
import { ADMIN_NAV, COACH_APP_URL } from "./nav";

/** Coque de l'espace admin : en-tête sombre, menu latéral (tiroir sur mobile). Indépendante de la coque coach. */
export function AdminShell({ name, email, children }: { name: string; email: string; children: React.ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const isActive = (href: string) => (href === "/admin" ? path === href : path === href || path.startsWith(href + "/"));

  const nav = (
    <nav className="flex flex-col gap-1" aria-label="Menu admin">
      {ADMIN_NAV.map((it) => {
        const Icon = it.icon;
        const on = isActive(it.href);
        return (
          <Link
            key={it.href}
            href={it.href}
            aria-current={on ? "page" : undefined}
            className={cn(
              "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
              on ? "bg-white/12 text-white ring-1 ring-white/15" : "text-[#b9d6e2] hover:bg-white/8 hover:text-white",
            )}
          >
            <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg", on ? "bg-[#e8782a] text-white" : "bg-white/8 text-[#9cc6d7] group-hover:text-white")}>
              <Icon className="size-4" />
            </span>
            <span className="min-w-0">
              <span className="block truncate">{it.label}</span>
              <span className="block truncate text-[11px] font-normal text-[#86aebf]">{it.hint}</span>
            </span>
          </Link>
        );
      })}
    </nav>
  );

  const footer = (
    <div className="space-y-2 border-t border-white/10 pt-4">
      <a href={COACH_APP_URL} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-[#f5b183] hover:bg-white/8 hover:text-white">
        <ArrowLeft className="size-4 rtl:-scale-x-100" /> Retour à l&apos;espace coach
      </a>
      <div className="flex items-center gap-3 rounded-xl px-3 py-2">
        <Avatar name={name || email} size={34} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-white">{name || "Administrateur"}</span>
          <span className="block truncate text-[11px] text-[#86aebf]">{email}</span>
        </span>
        <form action={signOut}>
          <button type="submit" title="Se déconnecter" aria-label="Se déconnecter" className="grid size-8 place-items-center rounded-lg text-[#9cc6d7] hover:bg-white/10 hover:text-white">
            <LogOut className="size-4" />
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh bg-canvas">
      {/* En-tête sombre (couleurs fixes : ne s'inversent pas en mode sombre) */}
      <header className="sticky top-0 z-30 flex print:hidden h-14 items-center gap-3 bg-[#0b2a37] px-4 text-white shadow-lg shadow-black/10 sm:px-6">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="grid size-9 place-items-center rounded-lg text-[#b9d6e2] hover:bg-white/10 hover:text-white lg:hidden"
          aria-label="Ouvrir le menu"
          aria-expanded={open}
        >
          <Menu className="size-5" />
        </button>
        <BackButton variant="dark" />
        <Link href="/admin" className="flex min-w-0 items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-lg bg-[#e8782a]">
            <LockKeyhole className="size-4" />
          </span>
          <span className="truncate font-display text-[15px] font-extrabold tracking-tight">
            Moov&apos;Up <span className="text-[#f5b183]">·</span> Administration
          </span>
        </Link>
        <span className="ms-auto hidden items-center gap-1.5 rounded-full bg-white/8 px-3 py-1 text-[11px] font-semibold text-[#b9d6e2] ring-1 ring-white/10 sm:inline-flex">
          <span className="size-1.5 rounded-full bg-emerald-400" /> Accès réservé à l&apos;administrateur
        </span>
        <ThemeToggle className="ms-auto scale-[.82] sm:ms-0" />
        <a href={COACH_APP_URL} className="hidden items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold text-[#f5b183] hover:bg-white/10 hover:text-white md:inline-flex">
          <ArrowLeft className="size-4 rtl:-scale-x-100" /> Espace coach
        </a>
      </header>

      <div className="lg:flex">
        {/* Menu latéral (bureau) */}
        <aside className="hidden w-72 shrink-0 lg:block print:hidden">
          <div className="sticky top-14 flex h-[calc(100dvh-3.5rem)] flex-col justify-between gap-6 overflow-y-auto bg-[#0f3a4b] p-4">
            {nav}
            {footer}
          </div>
        </aside>

        {/* Tiroir (mobile / tablette) */}
        {open && (
          <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu admin">
            <button type="button" className="absolute inset-0 bg-black/50" aria-label="Fermer le menu" onClick={() => setOpen(false)} />
            <div className="absolute inset-y-0 start-0 flex w-[min(20rem,86vw)] flex-col justify-between gap-6 overflow-y-auto bg-[#0f3a4b] p-4 shadow-2xl">
              <div>
                <div className="mb-4 flex items-center justify-between">
                  <span className="font-display text-sm font-bold uppercase tracking-wider text-[#86aebf]">Administration</span>
                  <button type="button" onClick={() => setOpen(false)} className="grid size-9 place-items-center rounded-lg text-[#b9d6e2] hover:bg-white/10 hover:text-white" aria-label="Fermer le menu">
                    <X className="size-5" />
                  </button>
                </div>
                {nav}
              </div>
              {footer}
            </div>
          </div>
        )}

        <main className="min-w-0 flex-1 px-4 pb-16 pt-6 sm:px-6 lg:px-10 lg:pt-8">
          <div className="mx-auto max-w-[1240px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
