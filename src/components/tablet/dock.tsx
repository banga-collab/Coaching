"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@/lib/types";
import { MORE_ITEM, navFor, navMatch, navShort } from "@/lib/nav";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { QuickAdd } from "../shell/quick-add";

/**
 * Barre d'accès rapide du mode tablette (visible seulement quand <html> a la classe « tablet ») :
 * mêmes entrées que la barre du bas (navFor().mobile), « Plus » et, pour le personnel, le bouton « + ».
 */
export function TabletDock({ role, badges = {} }: { role: Role; badges?: Record<string, number> }) {
  const t = useT();
  const path = usePathname();
  const { mobile } = navFor(role);
  const hidden = Object.entries(badges).some(([h, n]) => n > 0 && !mobile.some((i) => i.href === h));
  return (
    <nav aria-label={t("dock.label")} className="tablet-dock no-print fixed inset-x-0 bottom-0 z-30 justify-center gap-2 border-t border-line bg-white/95 px-3 pb-[max(env(safe-area-inset-bottom),10px)] pt-2.5 backdrop-blur lg:start-[260px]">
      {[...mobile, MORE_ITEM].map((it) => {
        const on = navMatch(it.href, path);
        const badge = it.href === MORE_ITEM.href ? 0 : badges[it.href] ?? 0;
        return (
          <Link
            key={it.href}
            href={it.href}
            aria-current={on ? "page" : undefined}
            className={cn(
              "relative flex min-h-16 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-3 text-sm font-semibold transition sm:max-w-48",
              on ? "bg-brand-500 text-white shadow-sm" : "bg-canvas text-slate-600 hover:bg-brand-50 hover:text-brand-600",
            )}
          >
            <it.icon className="size-6" />
            <span className="truncate">{navShort(t, it)}</span>
            {!!badge && <span className="absolute end-3 top-2 grid h-5 min-w-5 place-items-center rounded-full bg-accent-500 px-1 text-[11px] font-bold text-white">{badge > 99 ? "99+" : badge}</span>}
            {it.href === MORE_ITEM.href && hidden && <span className="absolute end-3 top-2 size-2.5 rounded-full bg-accent-500" />}
          </Link>
        );
      })}
      {role !== "client" && <QuickAdd role={role} variant="dock" />}
    </nav>
  );
}
