import Link from "next/link";
import { CalendarCheck, CalendarDays, CalendarRange, Clock, UsersRound } from "lucide-react";
import { getProfile, isManager } from "@/lib/auth";
import { loadNavBadges } from "@/lib/nav-badges";
import { getT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type AgendaTab = "seances" | "planning" | "cours" | "reservations" | "disponibilites";

/**
 * Barre d'onglets commune de l'agenda : Mes séances · Équipe · Cours collectifs · Demandes · Mes créneaux.
 * Filtrée par rôle (« Équipe » : managers). Pastilles : séances à confirmer, refus / reports, demandes en attente.
 */
export async function AgendaTabs({ active }: { active: AgendaTab }) {
  const [me, t] = await Promise.all([getProfile(), getT()]);
  if (me.role === "client") return null;
  const manager = isManager(me.role);
  const badges = await loadNavBadges(me.id, me.role);
  const tabs = [
    { key: "seances", href: "/seances", label: t(manager ? "agenda.tab.sessions" : "agenda.tab.mySessions"), icon: CalendarDays },
    ...(manager ? [{ key: "planning", href: "/planning", label: t("agenda.tab.team"), icon: CalendarRange }] : []),
    { key: "cours", href: "/cours", label: t("agenda.tab.classes"), icon: UsersRound },
    { key: "reservations", href: "/reservations", label: t("agenda.tab.requests"), icon: CalendarCheck },
    { key: "disponibilites", href: "/disponibilites", label: t("agenda.tab.slots"), icon: Clock },
  ] as const;
  return (
    <nav aria-label={t("agenda.label")} className="no-print -mx-4 mb-5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div className="inline-flex min-w-full gap-1 rounded-2xl border border-line bg-white p-1 shadow-card sm:min-w-0">
        {tabs.map((tab) => {
          const on = tab.key === active;
          const count = badges[tab.href] ?? 0;
          return (
            <Link
              key={tab.key}
              href={tab.href}
              aria-current={on ? "page" : undefined}
              className={cn(
                "flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-semibold transition",
                on ? "bg-brand-500 text-white shadow-sm" : "text-slate-500 hover:bg-canvas hover:text-ink",
              )}
            >
              <tab.icon className="size-4" />
              {tab.label}
              {count > 0 && (
                <span className={cn("grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[10.5px] font-bold", on ? "bg-white text-brand-600" : "bg-accent-500 text-white")}>
                  {count > 99 ? "99+" : count}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
