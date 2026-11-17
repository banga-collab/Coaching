/** Liens WhatsApp « click-to-chat » (aucune API requise). */

/** Normalise un numéro marocain : "06 12 34 56 78" → "212612345678" */
export function waNumber(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let d = phone.replace(/[^\d+]/g, "");
  if (d.startsWith("+")) d = d.slice(1);
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("0") && d.length === 10) d = "212" + d.slice(1);
  return d.length >= 9 ? d : null;
}

export function waLink(phone: string | null | undefined, text?: string): string | null {
  const n = waNumber(phone);
  if (!n) return null;
  return `https://wa.me/${n}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

export const WA_TEMPLATES = {
  sessionReminder: (first: string, when: string) => `Bonjour ${first} 👋 Petit rappel : ta séance est prévue ${when}. À tout à l'heure au Complexe Moov'Up !`,
  checkin: (first: string) => `Salut ${first} ! N'oublie pas ton check-in de la semaine sur l'app Moov'Up 💪 (2 minutes)`,
  invoice: (first: string, number: string, amount: string) => `Bonjour ${first}, voici un rappel pour la facture ${number} d'un montant de ${amount}. Merci !`,
  welcome: (first: string) => `Bienvenue chez Moov'Up ${first} ! Crée ton compte sur l'app avec ton e-mail pour suivre ta progression.`,
  generic: (first: string) => `Bonjour ${first} 👋`,
};
