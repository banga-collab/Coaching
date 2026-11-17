import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { DEMO } from "@/lib/demo";
import { paymentEnv, providerSetting } from "@/lib/payments";
import { whatsappEnv, whatsappMode } from "@/lib/whatsapp-api";
import { PageHeader } from "@/components/ui";
import { PaymentSettingsCard } from "@/components/payments/payment-settings";
import { WhatsAppSettingsCard } from "@/components/whatsapp/whatsapp-settings";
import { SettingsForm } from "./settings-form";

export const metadata = { title: "Paramètres" };

export default async function ParametresPage() {
  await requireAdmin();
  const s = await getSettings();
  return (
    <>
      <PageHeader title="Paramètres" subtitle="Marque blanche, coordonnées de la salle, facturation et réservation en ligne." />
      <SettingsForm settings={s} />
      <div className="mt-5 grid gap-5 lg:grid-cols-2 lg:items-start">
        <PaymentSettingsCard provider={providerSetting(s)} env={paymentEnv()} demo={DEMO} />
        <WhatsAppSettingsCard enabled={!!s.whatsapp_enabled} env={whatsappEnv()} mode={whatsappMode(s.whatsapp_enabled)} />
      </div>
    </>
  );
}
