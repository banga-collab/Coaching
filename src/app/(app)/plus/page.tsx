import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getProfile } from "@/lib/auth";
import { navDesc, navFor, navGroupLabel, navLabel } from "@/lib/nav";
import { loadNavBadges } from "@/lib/nav-badges";
import { getT } from "@/lib/i18n";
import { PageHeader } from "@/components/ui";
import { SearchButton } from "@/components/shell/command-palette";

export const metadata = { title: "Plus" };

/** Page « Plus » : tout ce qui n'est pas dans la barre du bas, par groupes (filtré par rôle) */
export default async function MorePage() {
  const [me, t] = await Promise.all([getProfile(), getT()]);
  const badges = await loadNavBadges(me.id, me.role);
  const { more } = navFor(me.role);
  return (
    <>
      <PageHeader title={t("nav.more")} subtitle={t("nav.allSections")} />
      <div className="mb-6 lg:hidden">
        <SearchButton />
      </div>
      <div className="space-y-7">
        {more.map((g) => (
          <section key={g.id} aria-labelledby={`plus-${g.id}`}>
            <h2 id={`plus-${g.id}`} className="mb-2.5 px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              {navGroupLabel(t, g)}
            </h2>
            <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
              {g.items.map((it) => {
                const badge = badges[it.href] ?? 0;
                return (
                  <Link
                    key={it.href}
                    href={it.href}
                    className="group flex items-center gap-3 rounded-2xl border border-line bg-white p-3.5 shadow-card transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-pop active:bg-canvas"
                  >
                    <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-500 transition group-hover:bg-brand-500 group-hover:text-white">
                      <it.icon className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-ink">{navLabel(t, it)}</span>
                      <span className="block truncate text-xs text-muted">{navDesc(t, it)}</span>
                    </span>
                    {badge > 0 && <span className="grid h-6 min-w-6 place-items-center rounded-full bg-accent-500 px-1.5 text-xs font-bold text-white">{badge > 99 ? "99+" : badge}</span>}
                    <ChevronRight className="size-4 shrink-0 text-slate-300 transition group-hover:text-brand-500 rtl:-scale-x-100" />
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
