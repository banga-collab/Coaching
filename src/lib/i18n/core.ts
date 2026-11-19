/** Dictionnaires et traduction (utilisable côté serveur ET navigateur) */
import { fr } from "./fr";
import { en } from "./en";
import { ar } from "./ar";

export type Lang = "fr" | "en" | "ar";
export type Dict = Record<string, string>;
export const LANGS: { code: Lang; label: string; short: string }[] = [
  { code: "fr", label: "Français", short: "FR" },
  { code: "en", label: "English", short: "EN" },
  { code: "ar", label: "العربية", short: "ع" },
];
export const DICTS: Record<Lang, Dict> = { fr, en, ar };

export const asLang = (v: string | undefined | null): Lang => (v === "ar" || v === "en" ? v : "fr");

/** Texte traduit ; retombe sur le français puis sur la clé. Variables : t(lang, "x", { n: 3 }) avec « {n} » dans le texte */
export function t(lang: Lang, key: string, vars?: Record<string, string | number>) {
  let s = DICTS[lang][key] ?? fr[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}

export const dir = (lang: Lang) => (lang === "ar" ? "rtl" : "ltr");
/** Locale Intl pour les dates et nombres */
export const locale = (lang: Lang) => (lang === "ar" ? "ar-MA" : lang === "en" ? "en-GB" : "fr-FR");
