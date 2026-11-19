"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CornerDownLeft, Search, User, type LucideIcon } from "lucide-react";
import type { Role } from "@/lib/types";
import { navDesc, navFor, navLabel } from "@/lib/nav";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { quickClientsAction, type ClientPick } from "@/actions/shell";
import { norm, quickActionsFor } from "./quick-actions";

const EVENT = "mu:palette";
/** Ouvre la recherche (Ctrl+K) depuis n'importe quel bouton */
export const openPalette = () => window.dispatchEvent(new Event(EVENT));

type Row = { id: string; section: string; label: string; hint?: string; icon: LucideIcon; href: string };

/** Recherche globale (Ctrl+K / ⌘K) : pages du menu, actions « + » et clients */
export function CommandPalette({ role }: { role: Role }) {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const [clients, setClients] = useState<ClientPick[] | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const staff = role !== "client";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(EVENT, onOpen);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    if (staff && !clients) {
      quickClientsAction()
        .then(setClients)
        .catch(() => setClients([]));
    }
  }, [open, staff, clients]);

  const rows = useMemo<Row[]>(() => {
    const n = norm(q);
    const match = (...s: (string | undefined)[]) => !n || s.some((x) => x && norm(x).includes(n));
    const pagesLabel = t("search.pages");
    const pages: Row[] = navFor(role)
      .all.map((it) => ({ id: `p:${it.href}`, section: pagesLabel, label: navLabel(t, it), hint: navDesc(t, it), icon: it.icon, href: it.href }))
      .filter((r) => match(r.label, r.hint));
    const create: Row[] = quickActionsFor(role)
      .filter((a) => !a.pick)
      .map((a) => ({ id: `a:${a.id}`, section: t("search.create"), label: t(`quick.${a.id}`), icon: a.icon, href: a.href }))
      .filter((r) => match(r.label));
    const people: Row[] = !staff || !n
      ? []
      : (clients ?? [])
          .filter((c) => norm(c.name).includes(n))
          .slice(0, 6)
          .map((c) => ({ id: `c:${c.id}`, section: t("search.clients"), label: c.name, icon: User, href: `/clients/${c.id}` }));
    const more: Row[] = staff && n ? [{ id: "c:search", section: t("search.clients"), label: t("search.inClients", { q: q.trim() }), icon: Search, href: `/clients?q=${encodeURIComponent(q.trim())}` }] : [];
    return [...people, ...more, ...pages.slice(0, n ? 8 : 12), ...create];
  }, [q, role, clients, staff, t]);

  const close = () => {
    setOpen(false);
    setQ("");
    setActive(0);
  };
  const go = (r: Row | undefined) => {
    if (!r) return;
    close();
    router.push(r.href);
  };

  useEffect(() => {
    listRef.current?.querySelector(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!open) return null;
  let lastSection = "";
  return (
    <div className="fixed inset-0 z-[60] bg-slate-900/40 px-4 pt-[10vh] backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div role="dialog" aria-modal="true" aria-label={t("search.title")} className="mx-auto w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-white shadow-pop animate-fade-up">
        <label className="flex items-center gap-3 border-b border-line px-4">
          <Search className="size-5 shrink-0 text-slate-400" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                close();
              } else if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(rows.length - 1, a + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(0, a - 1));
              } else if (e.key === "Enter") {
                e.preventDefault();
                go(rows[active]);
              } else if (e.key === "Tab") {
                e.preventDefault(); // la fenêtre garde le focus
              }
            }}
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-list"
            aria-activedescendant={rows[active] ? `palette-${active}` : undefined}
            placeholder={staff ? t("search.placeholder") : t("search.placeholderMember")}
            className="h-14 flex-1 bg-transparent text-base text-ink placeholder:text-slate-400 focus:outline-none"
          />
          <kbd className="rounded-md border border-line px-1.5 py-0.5 text-[10px] font-bold text-muted">Esc</kbd>
        </label>
        <ul ref={listRef} id="palette-list" role="listbox" className="max-h-[60vh] overflow-y-auto p-2">
          {rows.length === 0 && <li className="px-3 py-8 text-center text-sm text-muted">{t("search.none")}</li>}
          {rows.map((r, i) => {
            const head = r.section !== lastSection;
            lastSection = r.section;
            return (
              <li key={r.id} role="presentation">
                {head && <p className="px-3 pb-1 pt-2 text-[10.5px] font-semibold uppercase tracking-wider text-slate-400">{r.section}</p>}
                <div
                  id={`palette-${i}`}
                  data-i={i}
                  role="option"
                  aria-selected={i === active}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(r)}
                  className={cn("flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5", i === active ? "bg-brand-50 text-brand-700" : "text-ink")}
                >
                  <r.icon className={cn("size-[18px] shrink-0", i === active ? "text-brand-500" : "text-slate-400")} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{r.label}</span>
                    {r.hint && <span className="block truncate text-xs text-muted">{r.hint}</span>}
                  </span>
                  {i === active && <CornerDownLeft className="size-4 shrink-0 text-brand-400 rtl:-scale-x-100" />}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

/** Bouton qui ressemble à un champ de recherche (barre du haut) ou simple loupe (mobile) */
export function SearchButton({ compact = false }: { compact?: boolean }) {
  const t = useT();
  if (compact) {
    return (
      <button type="button" onClick={openPalette} className="grid size-9 place-items-center rounded-lg text-muted hover:bg-canvas" aria-label={t("search.title")}>
        <Search className="size-[18px]" />
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={openPalette}
      className="group flex h-11 w-full max-w-md items-center gap-3 rounded-2xl border border-line bg-white ps-4 pe-2 text-start text-sm text-slate-400 shadow-card transition hover:border-brand-300"
    >
      <Search className="size-4 transition group-hover:text-brand-500" />
      <span className="flex-1 truncate">{t("top.searchPlaceholder")}</span>
      <kbd className="rounded-md border border-line px-1.5 py-0.5 text-[10px] font-bold text-muted">Ctrl K</kbd>
    </button>
  );
}
