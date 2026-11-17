import {
  BarChart3,
  Bell,
  Bot,
  CalendarCheck,
  CalendarDays,
  ClipboardList,
  Dumbbell,
  HeartPulse,
  LayoutDashboard,
  ListChecks,
  MessageCircle,
  Plug,
  Receipt,
  Settings,
  ShieldCheck,
  TrendingUp,
  Users,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "./types";

export type NavItem = { href: string; label: string; icon: LucideIcon; roles?: Role[] };
export type NavGroup = { label: string; items: NavItem[] };

export const STAFF_NAV: NavGroup[] = [
  {
    label: "Principal",
    items: [
      { href: "/", label: "Tableau de bord", icon: LayoutDashboard },
      { href: "/clients", label: "Clients", icon: Users },
      { href: "/seances", label: "Séances", icon: CalendarDays },
      { href: "/messages", label: "Messages", icon: MessageCircle },
      { href: "/taches", label: "Tâches", icon: ListChecks },
    ],
  },
  {
    label: "Coaching",
    items: [
      { href: "/programmes", label: "Programmes", icon: Dumbbell },
      { href: "/evaluations", label: "Évaluations", icon: ClipboardList },
      { href: "/assistant", label: "Assistant IA", icon: Bot },
    ],
  },
  {
    label: "Business",
    items: [
      { href: "/facturation", label: "Facturation", icon: Receipt },
      { href: "/reservations", label: "Réservations", icon: CalendarCheck },
      { href: "/analytique", label: "Analytique", icon: BarChart3 },
    ],
  },
  {
    label: "Administration",
    items: [
      { href: "/equipe", label: "Équipe", icon: ShieldCheck, roles: ["admin"] },
      { href: "/automatisations", label: "Automatisations", icon: Workflow },
      { href: "/integrations", label: "Intégrations", icon: Plug, roles: ["admin"] },
      { href: "/parametres", label: "Paramètres", icon: Settings, roles: ["admin"] },
    ],
  },
];

export const CLIENT_NAV: NavGroup[] = [
  {
    label: "Mon espace",
    items: [
      { href: "/moi", label: "Ma progression", icon: TrendingUp },
      { href: "/moi/messages", label: "Messages", icon: MessageCircle },
      { href: "/moi/checkin", label: "Mon check-in", icon: HeartPulse },
      { href: "/notifications", label: "Notifications", icon: Bell },
    ],
  },
];

/** Barre du bas sur mobile (le reste est dans /plus) */
export const STAFF_MOBILE = ["/", "/clients", "/seances", "/messages"];

export function navFor(role: Role) {
  const groups = role === "client" ? CLIENT_NAV : STAFF_NAV;
  return groups
    .map((g) => ({ ...g, items: g.items.filter((i) => !i.roles || i.roles.includes(role)) }))
    .filter((g) => g.items.length);
}
