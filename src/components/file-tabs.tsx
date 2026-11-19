import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Onglets regroupés d'une fiche (client, espace adhérent) : quelques onglets principaux,
 * et des sous-vues en pastilles quand un onglet en regroupe plusieurs.
 * Les anciennes valeurs de ?tab= restent valides : ce sont les clés des sous-vues (ou des alias).
 */
export type FileTab = { key: string; label: string; subs?: { key: string; label: string }[]; aliases?: string[]; count?: number };

export function resolveTab(tabs: FileTab[], raw: string | undefined) {
  const v = raw ?? "";
  const main = tabs.find((t) => t.key === v || t.subs?.some((s) => s.key === v) || t.aliases?.includes(v)) ?? tabs[0]!;
  const sub = main.subs?.find((s) => s.key === v)?.key ?? main.subs?.[0]?.key ?? main.key;
  return { main, sub };
}

export function FileTabsNav({ tabs, main, sub, base }: { tabs: FileTab[]; main: FileTab; sub: string; base: string }) {
  const sep = base.includes("?") ? "&" : "?";
  return (
    <div className="no-print my-5">
      <nav className="-mx-4 flex gap-1 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={`${base}${sep}tab=${t.key}`}
            scroll={false}
            aria-current={main.key === t.key ? "page" : undefined}
            className={cn(
              "-mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 px-4 py-3 text-[15px] font-semibold transition",
              main.key === t.key ? "border-accent-500 text-brand-600" : "border-transparent text-muted hover:text-ink",
            )}
          >
            {t.label}
            {!!t.count && <span className="rounded-full bg-slate-100 px-1.5 text-xs text-slate-500">{t.count}</span>}
          </Link>
        ))}
      </nav>
      {main.subs && main.subs.length > 1 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {main.subs.map((s) => (
            <Link
              key={s.key}
              href={`${base}${sep}tab=${s.key}`}
              scroll={false}
              aria-current={sub === s.key ? "true" : undefined}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-sm font-semibold transition",
                sub === s.key ? "bg-brand-500 text-white" : "bg-white text-slate-600 ring-1 ring-line hover:bg-canvas",
              )}
            >
              {s.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
