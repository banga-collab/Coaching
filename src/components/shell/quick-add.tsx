"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Plus, Search, UserPlus } from "lucide-react";
import type { Role } from "@/lib/types";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { quickClientsAction, type ClientPick } from "@/actions/shell";
import { isTyping, norm, quickActionsFor, type QuickAction } from "./quick-actions";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Bouton « + » global : Nouvelle séance, Nouveau client, Nouveau bilan sportif (choix du client),
 * Nouvelle tâche, Nouveau message et, pour les managers, Affecter une séance.
 * Touche « N » (hors saisie) : ouvre le premier bouton « + » visible. Échap ferme.
 */
export function QuickAdd({ role, variant = "topbar" }: { role: Role; variant?: "topbar" | "header" | "dock" }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"menu" | "client">("menu");
  const [pick, setPick] = useState<QuickAction | null>(null);
  const [clients, setClients] = useState<ClientPick[] | null>(null);
  const [q, setQ] = useState("");
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const actions = useMemo(() => quickActionsFor(role), [role]);

  const close = useCallback((refocus = true) => {
    setOpen(false);
    setView("menu");
    setQ("");
    if (refocus) btnRef.current?.focus();
  }, []);

  // Raccourci « N » : seulement le premier bouton « + » visible réagit
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "n" && e.key !== "N") return;
      if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e)) return;
      const visible = [...document.querySelectorAll<HTMLElement>("[data-quickadd]")].filter((b) => b.offsetParent !== null);
      if (visible[0] !== btnRef.current) return;
      e.preventDefault();
      setOpen(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Clic à l'extérieur
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) close(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, close]);

  // Focus sur le premier élément à l'ouverture / au changement de vue
  useEffect(() => {
    if (!open) return;
    const first = panelRef.current?.querySelector<HTMLElement>(view === "client" ? "input" : '[role="menuitem"]');
    first?.focus();
  }, [open, view]);

  // Liste des clients chargée à la demande
  useEffect(() => {
    if (view !== "client" || clients) return;
    let alive = true;
    quickClientsAction()
      .then((l) => alive && setClients(l))
      .catch(() => alive && setClients([]));
    return () => {
      alive = false;
    };
  }, [view, clients]);

  const onPanelKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      if (view === "client") setView("menu");
      else close();
      return;
    }
    const nodes = [...(panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])];
    if (!nodes.length) return;
    const i = nodes.indexOf(document.activeElement as HTMLElement);
    if (e.key === "Tab") {
      // Piège de focus léger : on reste dans le menu
      if (e.shiftKey && i <= 0) {
        e.preventDefault();
        nodes.at(-1)?.focus();
      } else if (!e.shiftKey && i === nodes.length - 1) {
        e.preventDefault();
        nodes[0]?.focus();
      }
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const n = e.key === "ArrowDown" ? (i + 1) % nodes.length : (i - 1 + nodes.length) % nodes.length;
      nodes[n]?.focus();
    }
  };

  const found = (clients ?? []).filter((c) => !q || norm(c.name).includes(norm(q))).slice(0, 8);
  const label = t("quick.create");

  return (
    <div ref={wrapRef} className={cn("relative", variant === "dock" && "flex min-w-0 flex-1 sm:max-w-48")}>
      <button
        ref={btnRef}
        type="button"
        data-quickadd
        onClick={() => (open ? close() : setOpen(true))}
        aria-haspopup="menu"
        aria-expanded={open}
        title={`${label} (N)`}
        aria-label={label}
        className={cn(
          variant === "topbar" && "inline-flex h-11 items-center gap-2 rounded-2xl bg-brand-500 px-4 text-sm font-semibold text-white shadow-sm shadow-brand-500/20 transition hover:bg-brand-600",
          variant === "header" && "grid size-9 place-items-center rounded-xl bg-brand-500 text-white",
          variant === "dock" && "flex min-h-16 w-full min-w-0 flex-col items-center justify-center gap-1 rounded-2xl bg-accent-500 px-3 text-sm font-semibold text-white shadow-sm transition hover:bg-accent-600",
        )}
      >
        <Plus className={variant === "dock" ? "size-6" : "size-4"} strokeWidth={2.4} />
        {variant === "topbar" && <span>{label}</span>}
        {variant === "topbar" && <kbd className="hidden rounded bg-white/20 px-1.5 text-[10px] font-bold xl:inline">N</kbd>}
        {variant === "dock" && <span className="truncate">{label}</span>}
      </button>

      {open && (
        <div
          ref={panelRef}
          onKeyDown={onPanelKey}
          className={cn(
            "absolute z-50 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-line bg-white p-1.5 shadow-pop animate-fade-up",
            variant === "dock" ? "bottom-full end-0 mb-2" : "end-0 top-full mt-2",
          )}
        >
          {view === "menu" ? (
            <div role="menu" aria-label={label}>
              {actions.map((a) =>
                a.pick ? (
                  <button
                    key={a.id}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setPick(a);
                      setView("client");
                    }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start text-sm font-semibold text-ink transition hover:bg-canvas focus:bg-brand-50 focus:outline-none"
                  >
                    <a.icon className="size-[18px] text-brand-500" /> <span className="flex-1">{t(`quick.${a.id}`)}</span>
                    <span className="text-xs text-muted">…</span>
                  </button>
                ) : (
                  <Link
                    key={a.id}
                    href={a.href}
                    role="menuitem"
                    onClick={() => close(false)}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-ink transition hover:bg-canvas focus:bg-brand-50 focus:outline-none"
                  >
                    <a.icon className="size-[18px] text-brand-500" /> {t(`quick.${a.id}`)}
                  </Link>
                ),
              )}
              <p className="border-t border-line px-3 pb-1 pt-2 text-[11px] text-muted">{t("quick.hint")}</p>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-1 px-1 pb-1.5">
                <button type="button" onClick={() => setView("menu")} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-canvas" aria-label={t("quick.back")}>
                  <ArrowLeft className="size-4 rtl:-scale-x-100" />
                </button>
                <p className="text-sm font-bold">{pick ? t(`quick.${pick.id}`) : ""}</p>
              </div>
              <label className="relative block">
                <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder={t("quick.chooseClient")}
                  aria-label={t("quick.chooseClient")}
                  className="h-10 w-full rounded-xl border border-line bg-white ps-9 pe-3 text-sm focus:border-brand-300 focus:outline-none focus:ring-4 focus:ring-brand-50"
                />
              </label>
              <ul className="mt-1.5 max-h-72 overflow-y-auto">
                {!clients ? (
                  <li className="flex items-center justify-center gap-2 py-6 text-sm text-muted">
                    <Loader2 className="size-4 animate-spin" /> {t("common.loading")}
                  </li>
                ) : found.length === 0 ? (
                  <li className="px-3 py-5 text-center text-sm text-muted">
                    {t("quick.noClient")}
                    <Link href="/clients/nouveau" onClick={() => close(false)} className="mt-2 flex items-center justify-center gap-1.5 font-semibold text-brand-600">
                      <UserPlus className="size-4" /> {t("quick.client")}
                    </Link>
                  </li>
                ) : (
                  found.map((c) => (
                    <li key={c.id}>
                      <Link
                        href={pick?.pick ? pick.pick(c.id) : `/clients/${c.id}`}
                        onClick={() => close(false)}
                        className="block truncate rounded-xl px-3 py-2.5 text-sm font-medium text-ink hover:bg-canvas focus:bg-brand-50 focus:outline-none"
                      >
                        {c.name}
                      </Link>
                    </li>
                  ))
                )}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
