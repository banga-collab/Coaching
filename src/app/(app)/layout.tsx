import { Sidebar } from "@/components/sidebar";
import { DemoBar } from "@/components/demo-bar";
import { Topbar } from "@/components/topbar";
import { BrandStyle } from "@/components/modules/brand-style";
import { getProfile } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { loadNavBadges } from "@/lib/nav-badges";
import { TabletDock } from "@/components/tablet/dock";
import { CommandPalette } from "@/components/shell/command-palette";
import { BackButton } from "@/components/shell/back-button";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [profile, settings] = await Promise.all([getProfile(), getSettings()]);
  // Pastilles du menu : messages non lus, tâches dues, séances à confirmer, demandes de réservation
  const badges = await loadNavBadges(profile.id, profile.role);

  return (
    <div className="lg:flex">
      <BrandStyle />
      <Sidebar name={profile.full_name || profile.email} role={profile.role} logoUrl={settings.logo_url} badges={badges} />
      <main className="min-w-0 flex-1 px-4 pb-28 pt-6 sm:px-6 lg:px-10 lg:pb-12 lg:pt-7">
        <div className="mx-auto max-w-[1240px]">
          {profile.role !== "client" ? <Topbar role={profile.role} /> : <BackButton wrapClass="mb-5 hidden lg:flex" />}
          {children}
        </div>
      </main>
      <TabletDock role={profile.role} badges={badges} />
      <CommandPalette role={profile.role} />
      <DemoBar />
    </div>
  );
}
