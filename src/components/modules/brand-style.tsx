import { getSettings } from "@/lib/settings";
import { brandCss } from "@/components/platform/colors";
import { InstallPrompt, ServiceWorkerRegister } from "@/components/platform/pwa";

/** Couleurs de la marque (marque blanche) : surcharge des variables CSS si elles diffèrent des couleurs par défaut. */
export async function BrandColors() {
  const s = await getSettings();
  const css = brandCss(s.primary_color, s.accent_color);
  if (!css) return null;
  return <style id="brand-colors" dangerouslySetInnerHTML={{ __html: css }} />;
}

/** Rendu une fois dans le layout de l'app : couleurs de marque + PWA (service worker, invitation à installer). */
export async function BrandStyle() {
  const s = await getSettings();
  return (
    <>
      <BrandColors />
      <ServiceWorkerRegister />
      <InstallPrompt appName={s.app_name.replace(/\s*Coach$/i, "") || "Moov'Up"} />
    </>
  );
}
