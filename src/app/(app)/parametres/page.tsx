import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { whatsappEnv, whatsappMode } from "@/lib/whatsapp-api";
import { PageHeader } from "@/components/ui";
import { WhatsAppSettingsCard } from "@/components/whatsapp/whatsapp-settings";
import { SettingsForm } from "./settings-form";

export const metadata = { title: "Paramètres" };

export default async function ParametresPage() {
  await requireAdmin();
  const s = await getSettings();
  return (
    <>
      <PageHeader title="Paramètres" subtitle="Marque blanche, coordonnées de la salle et réservation en ligne." />
      <SettingsForm settings={s} />
      <div className="mt-5 grid gap-5 lg:grid-cols-2 lg:items-start">
        <WhatsAppSettingsCard enabled={!!s.whatsapp_enabled} env={whatsappEnv()} mode={whatsappMode(s.whatsapp_enabled)} />
      </div>
    </>
  );
}
