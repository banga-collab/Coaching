import { Sidebar } from "@/components/sidebar";
import { DemoBar } from "@/components/demo-bar";
import { Topbar } from "@/components/topbar";
import { BrandStyle } from "@/components/modules/brand-style";
import { getProfile } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [profile, settings] = await Promise.all([getProfile(), getSettings()]);
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  // Pastilles du menu : messages non lus et tâches dues
  const badges: Record<string, number> = {};
  if (profile.role === "client") {
    const { data: me } = await supabase.from("clients").select("id").eq("user_id", profile.id).maybeSingle();
    if (me) {
      const { count } = await supabase.from("messages").select("id", { count: "exact", head: true }).eq("client_id", me.id).eq("from_client", false).is("read_at", null);
      badges["/moi/messages"] = count ?? 0;
    }
  } else {
    const [{ count: unread }, { count: due }] = await Promise.all([
      supabase.from("messages").select("id", { count: "exact", head: true }).eq("from_client", true).is("read_at", null),
      supabase.from("tasks").select("id", { count: "exact", head: true }).eq("done", false).lte("due_date", today),
    ]);
    badges["/messages"] = unread ?? 0;
    badges["/taches"] = due ?? 0;
  }

  return (
    <div className="lg:flex">
      <BrandStyle />
      <Sidebar name={profile.full_name || profile.email} role={profile.role} logoUrl={settings.logo_url} badges={badges} />
      <main className="min-w-0 flex-1 px-4 pb-28 pt-6 sm:px-6 lg:px-10 lg:pb-12 lg:pt-7">
        <div className="mx-auto max-w-[1240px]">
          {profile.role !== "client" && <Topbar />}
          {children}
        </div>
      </main>
      <DemoBar />
    </div>
  );
}
