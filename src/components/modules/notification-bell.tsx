import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Notification } from "@/lib/types";
import { relTime } from "@/components/business/format";
import { BellMenu } from "@/components/business/bell-menu";

/** Cloche de notifications (barre du haut, bureau). */
export async function NotificationBell() {
  const me = await getProfile();
  const supabase = await createClient();
  const [{ data }, { count }] = await Promise.all([
    supabase.from("notifications").select("*").eq("user_id", me.id).order("created_at", { ascending: false }).limit(8),
    supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", me.id).eq("read", false),
  ]);
  const now = Date.now();
  const items = ((data ?? []) as Notification[]).map((n) => ({
    id: n.id,
    title: n.title,
    body: n.body,
    kind: n.kind,
    read: n.read,
    when: relTime(n.created_at, now),
  }));
  return <BellMenu items={items} unread={count ?? 0} />;
}
