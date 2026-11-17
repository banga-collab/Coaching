import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { PageHeader } from "@/components/ui";
import { SettingsForm } from "./settings-form";

export const metadata = { title: "Paramètres" };

export default async function ParametresPage() {
  await requireAdmin();
  const s = await getSettings();
  return (
    <>
      <PageHeader title="Paramètres" subtitle="Marque blanche, coordonnées de la salle, facturation et réservation en ligne." />
      <SettingsForm settings={s} />
    </>
  );
}
