"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Bell, BellOff, CheckCheck } from "lucide-react";
import type { Notification } from "@/lib/types";
import { cn } from "@/lib/utils";
import { markAllNotificationsReadAction, openNotificationAction } from "@/actions/business";
import { NotifIcon } from "./notif-icon";

export type BellItem = Pick<Notification, "id" | "title" | "body" | "kind" | "read"> & { when: string };

export function BellMenu({ items, unread }: { items: BellItem[]; unread: number }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={`Notifications${unread ? ` (${unread} non lues)` : ""}`}
        aria-expanded={open}
        className={cn(
          "relative grid size-11 place-items-center rounded-2xl border border-line bg-white text-slate-600 shadow-card transition hover:border-slate-300 hover:text-brand-600 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100",
          open && "border-brand-200 text-brand-600 ring-4 ring-brand-50",
        )}
      >
        <Bell className="size-[18px]" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-accent-500 px-1 text-[10px] font-bold text-white ring-2 ring-canvas">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+8px)] z-40 w-[380px] origin-top-right animate-fade-up overflow-hidden rounded-2xl border border-line bg-white shadow-pop">
          <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
            <div>
              <p className="font-display text-[15px] font-bold text-ink">Notifications</p>
              <p className="text-xs text-muted">{unread ? `${unread} non lue${unread > 1 ? "s" : ""}` : "Tout est à jour"}</p>
            </div>
            {unread > 0 && (
              <form action={markAllNotificationsReadAction}>
                <button type="submit" className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-brand-600 transition hover:bg-brand-50">
                  <CheckCheck className="size-3.5" /> Tout marquer comme lu
                </button>
              </form>
            )}
          </div>

          {items.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-10 text-center">
              <span className="grid size-12 place-items-center rounded-2xl bg-brand-50 text-brand-500">
                <BellOff className="size-5" />
              </span>
              <p className="mt-3 text-sm font-semibold text-ink">Aucune notification</p>
              <p className="mt-0.5 text-xs text-muted">Les nouveautés apparaîtront ici.</p>
            </div>
          ) : (
            <ul className="max-h-[420px] divide-y divide-line overflow-y-auto">
              {items.map((n) => (
                <li key={n.id}>
                  <form action={openNotificationAction}>
                    <input type="hidden" name="id" value={n.id} />
                    <button
                      type="submit"
                      onClick={() => setTimeout(() => setOpen(false), 0)}
                      className={cn("flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-canvas", !n.read && "bg-brand-50/50")}
                    >
                      <NotifIcon kind={n.kind} />
                      <span className="min-w-0 flex-1">
                        <span className={cn("block truncate text-sm", n.read ? "font-medium text-slate-700" : "font-bold text-ink")}>{n.title}</span>
                        {n.body && <span className="mt-0.5 block truncate text-xs text-muted">{n.body}</span>}
                        <span className="mt-1 block text-[11px] font-medium text-slate-400">{n.when}</span>
                      </span>
                      {!n.read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-accent-500" />}
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}

          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className="block border-t border-line px-4 py-3 text-center text-sm font-semibold text-brand-600 transition hover:bg-canvas"
          >
            Voir toutes les notifications
          </Link>
        </div>
      )}
    </div>
  );
}
