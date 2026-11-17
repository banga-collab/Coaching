import Link from "next/link";
import { BellOff, CheckCheck, ChevronRight } from "lucide-react";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Notification } from "@/lib/types";
import { cn, dayKey, fmtTime, startOfWeek } from "@/lib/utils";
import { Card, Empty, PageHeader } from "@/components/ui";
import { NotifIcon } from "@/components/business/notif-icon";
import { relTime } from "@/components/business/format";
import { markAllNotificationsReadAction, openNotificationAction } from "@/actions/business";

export const metadata = { title: "Notifications" };

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ filtre?: string }> }) {
  const { filtre = "" } = await searchParams;
  const unreadOnly = filtre === "nonlues";
  const me = await getProfile();
  const supabase = await createClient();

  let query = supabase.from("notifications").select("*").eq("user_id", me.id).order("created_at", { ascending: false }).limit(200);
  if (unreadOnly) query = query.eq("read", false);
  const [{ data }, { count }] = await Promise.all([
    query,
    supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", me.id).eq("read", false),
  ]);
  const items = (data ?? []) as Notification[];
  const unread = count ?? 0;

  const today = dayKey(new Date());
  const weekStart = dayKey(startOfWeek());
  const groups = [
    { label: "Aujourd'hui", items: items.filter((n) => dayKey(n.created_at) === today) },
    { label: "Cette semaine", items: items.filter((n) => dayKey(n.created_at) !== today && dayKey(n.created_at) >= weekStart) },
    { label: "Plus ancien", items: items.filter((n) => dayKey(n.created_at) < weekStart) },
  ].filter((g) => g.items.length);
  const now = Date.now();

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Notifications"
        subtitle={unread ? `${unread} notification${unread > 1 ? "s" : ""} non lue${unread > 1 ? "s" : ""}` : "Tout est à jour"}
        actions={
          unread > 0 ? (
            <form action={markAllNotificationsReadAction}>
              <button type="submit" className="inline-flex h-10 items-center gap-2 rounded-xl border border-line bg-white px-4 text-sm font-semibold text-ink transition hover:border-slate-300 hover:bg-canvas">
                <CheckCheck className="size-4 text-brand-500" /> Tout marquer comme lu
              </button>
            </form>
          ) : undefined
        }
      />

      <div className="mb-4 flex w-fit gap-1 rounded-xl bg-white p-1 ring-1 ring-line">
        {[
          { key: "", label: "Toutes" },
          { key: "nonlues", label: `Non lues${unread ? ` (${unread})` : ""}` },
        ].map((f) => (
          <Link
            key={f.key}
            href={f.key ? `/notifications?filtre=${f.key}` : "/notifications"}
            className={cn("rounded-lg px-3 py-1.5 text-sm font-semibold transition", filtre === f.key ? "bg-brand-500 text-white shadow-sm" : "text-muted hover:text-ink")}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {groups.length === 0 ? (
        <Card>
          <Empty
            icon={<BellOff className="size-6" />}
            title={unreadOnly ? "Aucune notification non lue" : "Aucune notification"}
            text={unreadOnly ? "Tout est à jour." : "Messages, paiements, réservations et alertes apparaîtront ici."}
          />
        </Card>
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <section key={g.label} className="animate-fade-up">
              <h2 className="mb-2 px-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">{g.label}</h2>
              <Card className="overflow-hidden">
                <ul className="divide-y divide-line">
                  {g.items.map((n) => (
                    <li key={n.id}>
                      <form action={openNotificationAction}>
                        <input type="hidden" name="id" value={n.id} />
                        <button
                          type="submit"
                          className={cn("group flex w-full items-start gap-3.5 px-4 py-3.5 text-left transition hover:bg-canvas sm:px-5", !n.read && "bg-brand-50/40")}
                        >
                          <NotifIcon kind={n.kind} size={40} />
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-2">
                              <span className={cn("truncate text-sm", n.read ? "font-medium text-slate-700" : "font-bold text-ink")}>{n.title}</span>
                              {!n.read && <span className="size-2 shrink-0 rounded-full bg-accent-500" />}
                            </span>
                            {n.body && <span className="mt-0.5 block text-sm text-muted line-clamp-2">{n.body}</span>}
                            <span className="mt-1 block text-xs font-medium text-slate-400">
                              {relTime(n.created_at, now)} · {fmtTime(n.created_at)}
                            </span>
                          </span>
                          {n.link && <ChevronRight className="mt-2.5 size-4 shrink-0 text-slate-300 transition group-hover:text-brand-500" />}
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              </Card>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
