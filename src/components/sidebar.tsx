"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Image from "next/image";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { Loader2, LogOut } from "lucide-react";
import type { Role } from "@/lib/types";
import { MORE_ITEM, navFor, navLabel, navMatch, navShort } from "@/lib/nav";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { Avatar } from "./ui";
import { LangSwitcher, TabletToggle, ThemeToggle } from "./shell/controls";
import { SearchButton } from "./shell/command-palette";
import { QuickAdd } from "./shell/quick-add";
import { BackButton } from "./shell/back-button";
import { signOut } from "@/app/(auth)/actions";

const SCROLL_KEY = "mu:nav-scroll";

/** Petit indicateur de chargement affiché dans le lien cliqué tant que la page suivante n'est pas prête */
function Pending() {
  const { pending } = useLinkStatus();
  return pending ? <Loader2 className="size-3.5 shrink-0 animate-spin text-brand-500" aria-hidden /> : null;
}

/**
 * Menu court par rôle (bureau), barre du bas (mobile) et en-tête mobile.
 * Les entrées viennent de navFor() (src/lib/nav.ts) ; tout le reste est sur la page « Plus » et dans la recherche Ctrl+K.
 */
export function Sidebar({
  name,
  role,
  logoUrl,
  badges = {},
}: {
  name: string;
  role: Role;
  logoUrl?: string | null;
  badges?: Record<string, number>;
}) {
  const t = useT();
  const path = usePathname();
  const { main, mobile } = navFor(role);
  // Retour visuel immédiat : l'entrée cliquée est surlignée avant la fin du chargement
  const [clicked, setClicked] = useState<string | null>(null);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => setClicked(null), [path]);

  const active = (href: string) => (clicked ? clicked === href : navMatch(href, path));
  // Pastille de « Plus » : une entrée cachée dans « Plus » a quelque chose à traiter
  const hiddenBadge = (hrefs: string[]) => Object.entries(badges).some(([h, n]) => n > 0 && !hrefs.includes(h));
  const badgeOf = (href: string) => (href === MORE_ITEM.href ? 0 : badges[href] ?? 0);
  const logo = logoUrl || "/logo.png";

  // Défilement du menu conservé d'une page à l'autre (et après rechargement)
  useLayoutEffect(() => {
    const el = navRef.current;
    if (!el) return;
    try {
      const y = Number(window.sessionStorage.getItem(SCROLL_KEY));
      if (y) el.scrollTop = y;
    } catch {
      // stockage indisponible
    }
  }, []);
  const onScroll = () => {
    try {
      window.sessionStorage.setItem(SCROLL_KEY, String(navRef.current?.scrollTop ?? 0));
    } catch {
      // stockage indisponible
    }
  };

  return (
    <>
      {/* Bureau */}
      <aside className="no-print sticky top-0 hidden h-dvh w-[260px] shrink-0 flex-col border-e border-line bg-white lg:flex">
        <div className="px-6 pb-3 pt-6">
          <Link href={role === "client" ? "/moi" : "/"}>
            <Image src={logo} alt="Logo" width={473} height={136} priority unoptimized={!!logoUrl} className="h-auto max-h-14 w-auto max-w-[180px] object-contain" />
          </Link>
        </div>
        <nav ref={navRef} onScroll={onScroll} className="side-nav flex flex-1 flex-col gap-1 overflow-y-auto px-3 pb-3 pt-2" aria-label={t("nav.main")}>
          {main.map((it) => {
            const on = active(it.href);
            const badge = badgeOf(it.href);
            const dot = it.href === MORE_ITEM.href && hiddenBadge(main.map((i) => i.href));
            return (
              <Link
                key={it.href}
                href={it.href}
                prefetch
                onClick={(e) => {
                  if (!e.metaKey && !e.ctrlKey && !e.shiftKey && it.href !== path) setClicked(it.href);
                }}
                aria-current={navMatch(it.href, path) ? "page" : undefined}
                className={cn(
                  "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium transition-colors",
                  it.href === MORE_ITEM.href && "mt-2 border-t border-line pt-3",
                  on ? "bg-brand-50 text-brand-600" : "text-slate-500 hover:bg-canvas hover:text-ink",
                )}
              >
                {on && <span className="absolute -start-3 top-1/2 h-5 w-1 -translate-y-1/2 rounded-e-full bg-accent-500" />}
                <it.icon className={cn("size-[19px] shrink-0", on ? "text-brand-500" : "text-slate-400 group-hover:text-ink")} strokeWidth={on ? 2.2 : 1.9} />
                <span className="flex-1 truncate">{navLabel(t, it)}</span>
                <Pending />
                {dot && <span className="size-2 rounded-full bg-accent-500" aria-hidden />}
                {!!badge && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-accent-500 px-1.5 text-[10.5px] font-bold text-white">{badge > 99 ? "99+" : badge}</span>}
              </Link>
            );
          })}
        </nav>
        {role === "client" && (
          <div className="flex items-center gap-2 px-3 pb-2">
            <ThemeToggle />
            <TabletToggle />
            <LangSwitcher up />
          </div>
        )}
        <div className="m-3 mt-0 flex items-center gap-3 rounded-2xl border border-line p-3">
          <Avatar name={name || "?"} size={38} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{name || t("top.account")}</p>
            <p className="text-xs text-muted">{t(`role.${role}`)}</p>
          </div>
          <form action={signOut}>
            <button className="grid size-9 place-items-center rounded-lg text-muted transition hover:bg-red-50 hover:text-red-600" title={t("top.logout")} aria-label={t("top.logout")}>
              <LogOut className="size-4 rtl:-scale-x-100" />
            </button>
          </form>
        </div>
      </aside>

      {/* Mobile : barre du haut */}
      <header className="no-print sticky top-0 z-20 flex items-center gap-1 border-b border-line bg-white/90 px-3 py-2 backdrop-blur sm:gap-1.5 sm:px-4 lg:hidden">
        <BackButton variant="compact" className="-ms-2" />
        <Image src={logo} alt="Logo" width={473} height={136} priority unoptimized={!!logoUrl} className="me-auto h-auto max-h-9 w-auto max-w-[92px] object-contain sm:max-w-[120px]" />
        <SearchButton compact />
        {role !== "client" && <QuickAdd role={role} variant="header" />}
        <ThemeToggle className="size-9 rounded-xl shadow-none" />
        <span className="hidden sm:contents">
          <TabletToggle className="size-9 rounded-xl shadow-none" />
        </span>
        <LangSwitcher className="[&>button]:h-9 [&>button]:rounded-xl [&>button]:shadow-none" />
        <form action={signOut}>
          <button className="grid size-9 place-items-center rounded-lg text-muted hover:bg-canvas" aria-label={t("top.logout")}>
            <LogOut className="size-4 rtl:-scale-x-100" />
          </button>
        </form>
      </header>

      {/* Mobile : barre du bas */}
      <nav className="mobile-tabbar no-print fixed inset-x-0 bottom-0 z-20 flex justify-around border-t border-line bg-white/95 px-1 pb-[max(env(safe-area-inset-bottom),6px)] pt-1.5 backdrop-blur lg:hidden" aria-label={t("nav.main")}>
        {[...mobile, MORE_ITEM].map((it) => {
          const dot = it.href === MORE_ITEM.href ? hiddenBadge(mobile.map((i) => i.href)) : !!badges[it.href];
          return (
            <Link
              key={it.href}
              href={it.href}
              aria-current={navMatch(it.href, path) ? "page" : undefined}
              className={cn("relative flex min-w-14 flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 text-[10.5px] font-semibold", active(it.href) ? "text-brand-500" : "text-slate-400")}
            >
              <it.icon className="size-5" />
              {navShort(t, it)}
              {dot && <span className="absolute end-2 top-0.5 size-2 rounded-full bg-accent-500" />}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
