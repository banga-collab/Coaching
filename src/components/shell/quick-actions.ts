import { Clock3, CalendarPlus, CalendarRange, ClipboardCheck, ListChecks, Megaphone, MessageCircle, UserPlus, type LucideIcon } from "lucide-react";
import type { Role } from "@/lib/types";

/** Actions du bouton « + » (et de la recherche Ctrl+K). `pick` : choisir d'abord un client. */
export type QuickAction = { id: string; href: string; label: string; icon: LucideIcon; roles?: Role[]; pick?: (clientId: string) => string };

export const QUICK_ACTIONS: QuickAction[] = [
  { id: "session", href: "/seances/nouvelle", label: "Nouvelle séance", icon: CalendarPlus },
  { id: "client", href: "/clients/nouveau", label: "Nouveau client", icon: UserPlus },
  { id: "bilan", href: "/clients", label: "Nouveau bilan sportif", icon: ClipboardCheck, pick: (id) => `/clients/${id}/bilan-sportif/nouveau` },
  { id: "task", href: "/taches", label: "Nouvelle tâche", icon: ListChecks },
  { id: "message", href: "/messages", label: "Nouveau message", icon: MessageCircle },
  { id: "assign", href: "/planning#affecter", label: "Affecter une séance", icon: CalendarRange, roles: ["admin", "head_coach"] },
  { id: "pointage", href: "/pointage", label: "Pointage (arrivée / départ)", icon: Clock3, roles: ["coach", "head_coach"] },
  { id: "reclamation", href: "/reclamations/nouvelle", label: "Réclamation à la direction", icon: Megaphone, roles: ["coach", "head_coach"] },
];

export const quickActionsFor = (role: Role) => (role === "client" ? [] : QUICK_ACTIONS.filter((a) => !a.roles || a.roles.includes(role)));

/** Recherche sans accents ni majuscules */
export const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

/** L'utilisateur est-il en train d'écrire ? (raccourcis clavier désactivés) */
export function isTyping(e: KeyboardEvent) {
  const el = e.target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}
