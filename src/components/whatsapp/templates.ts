import { WA_TEMPLATES } from "@/lib/whatsapp";

/**
 * Catalogue des modèles WhatsApp utilisés par l'app (pur, utilisable côté client et serveur).
 * `key` = valeur stockée dans `whatsapp_messages.template`.
 * `envName` = variable d'environnement optionnelle contenant le nom du modèle approuvé chez Meta.
 */
export type WaTemplateKey = "session_reminder" | "checkin_missing" | "welcome" | "manuel";

export type WaTemplateDef = {
  key: WaTemplateKey;
  label: string;
  description: string;
  envName: string | null;
  /** Variables nécessaires (dans l'ordre des paramètres {{1}}, {{2}}… du modèle Meta). */
  vars: string[];
  /** Exemple de valeurs pour l'aperçu. */
  sample: string[];
  build: (v: string[]) => string;
};

export const WA_CATALOG: Record<WaTemplateKey, WaTemplateDef> = {
  session_reminder: {
    key: "session_reminder",
    label: "Rappel de séance",
    description: "Envoyé la veille d'une séance acceptée par le coach.",
    envName: "WHATSAPP_TEMPLATE_SESSION_REMINDER",
    vars: ["Prénom", "Quand"],
    sample: ["Karim", "demain à 07:00"],
    build: ([first = "", when = ""]) => WA_TEMPLATES.sessionReminder(first, when),
  },
  checkin_missing: {
    key: "checkin_missing",
    label: "Check-in manquant",
    description: "Rappel du check-in hebdomadaire sur l'app.",
    envName: "WHATSAPP_TEMPLATE_CHECKIN_MISSING",
    vars: ["Prénom"],
    sample: ["Nadia"],
    build: ([first = ""]) => WA_TEMPLATES.checkin(first),
  },
  welcome: {
    key: "welcome",
    label: "Bienvenue",
    description: "Message d'accueil d'un nouveau membre.",
    envName: "WHATSAPP_TEMPLATE_WELCOME",
    vars: ["Prénom"],
    sample: ["Salma"],
    build: ([first = ""]) => WA_TEMPLATES.welcome(first),
  },
  manuel: {
    key: "manuel",
    label: "Message libre",
    description: "Texte rédigé par le coach (fenêtre de 24 h uniquement chez Meta).",
    envName: null,
    vars: ["Prénom"],
    sample: ["Youssef"],
    build: ([first = ""]) => WA_TEMPLATES.generic(first),
  },
};

export const WA_TEMPLATE_KEYS = Object.keys(WA_CATALOG) as WaTemplateKey[];

export function waTemplateLabel(key: string) {
  return (WA_CATALOG as Record<string, WaTemplateDef | undefined>)[key]?.label ?? key;
}

export function isWaTemplate(v: unknown): v is WaTemplateKey {
  return typeof v === "string" && v in WA_CATALOG;
}
