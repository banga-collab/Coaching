/**
 * Traduction de l'interface : français (par défaut), anglais, arabe (de droite à gauche).
 * La langue est choisie par chaque membre (cookie « lang »).
 * Serveur : const lang = await getLang(); t(lang, "nav.clients")
 * Navigateur : const t = useT() (voir ./client.tsx)
 */
import { cookies } from "next/headers";
import { asLang, t, type Lang } from "./core";

export { DICTS, LANGS, asLang, t, dir, locale, type Lang, type Dict } from "./core";

export async function getLang(): Promise<Lang> {
  return asLang((await cookies()).get("lang")?.value);
}

/** Raccourci serveur : const tr = await getT(); tr("nav.clients") */
export async function getT() {
  const lang = await getLang();
  return (key: string, vars?: Record<string, string | number>) => t(lang, key, vars);
}
