import { CalendarDays } from "lucide-react";
import type { Role } from "@/lib/types";
import { getLang } from "@/lib/i18n";
import { locale } from "@/lib/i18n/core";
import { NotificationBell } from "./modules/notification-bell";
import { LangSwitcher, TabletToggle, ThemeToggle } from "./shell/controls";
import { SearchButton } from "./shell/command-palette";
import { QuickAdd } from "./shell/quick-add";
import { BackButton } from "./shell/back-button";

/** Barre du haut (bureau) : recherche Ctrl+K, date, mode sombre, mode tablette, langue, cloche, bouton « + ». */
export async function Topbar({ role }: { role: Role }) {
  const lang = await getLang();
  const today = new Intl.DateTimeFormat(locale(lang), { timeZone: "Africa/Casablanca", weekday: "long", day: "numeric", month: "long" }).format(new Date());
  return (
    <div className="no-print mb-7 hidden items-center gap-2 lg:flex">
      <BackButton />
      <SearchButton />
      <div className="ms-auto flex items-center gap-2">
        <span className="hidden items-center gap-2 rounded-2xl border border-line bg-white px-3.5 py-2.5 text-sm font-medium capitalize text-slate-600 shadow-card 2xl:inline-flex">
          <CalendarDays className="size-4 text-accent-500" />
          {today}
        </span>
        <ThemeToggle />
        <TabletToggle />
        <LangSwitcher />
        <NotificationBell />
        <QuickAdd role={role} />
      </div>
    </div>
  );
}
