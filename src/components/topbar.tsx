import { CalendarDays, Plus, Search } from "lucide-react";
import { fmtDate } from "@/lib/utils";
import { buttonClass } from "./ui";
import Link from "next/link";
import { NotificationBell } from "./modules/notification-bell";

/** Barre du haut (bureau) : recherche globale de clients + raccourcis. */
export async function Topbar() {
  return (
    <div className="no-print mb-7 hidden items-center gap-3 lg:flex">
      <form action="/clients" className="group relative max-w-md flex-1">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-400 transition group-focus-within:text-brand-500" />
        <input
          name="q"
          placeholder="Rechercher un client, un objectif…"
          className="h-11 w-full rounded-2xl border border-line bg-white pl-11 pr-4 text-sm shadow-card transition placeholder:text-slate-400 focus:border-brand-300 focus:outline-none focus:ring-4 focus:ring-brand-50"
        />
      </form>
      <div className="ml-auto flex items-center gap-2">
        <span className="hidden items-center gap-2 rounded-2xl border border-line bg-white px-3.5 py-2.5 text-sm font-medium capitalize text-slate-600 shadow-card xl:inline-flex">
          <CalendarDays className="size-4 text-accent-500" />
          {fmtDate(new Date(), { weekday: "long", day: "numeric", month: "long" })}
        </span>
        <NotificationBell />
        <Link href="/seances/nouvelle" className={buttonClass("brand", "h-11 rounded-2xl")}>
          <Plus className="size-4" /> Séance
        </Link>
      </div>
    </div>
  );
}
