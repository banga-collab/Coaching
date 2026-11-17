import {
  Apple,
  BarChart3,
  Bell,
  Bot,
  CalendarCheck,
  CalendarDays,
  ClipboardList,
  CreditCard,
  Dumbbell,
  Gift,
  HeartPulse,
  LayoutDashboard,
  ListChecks,
  MessageCircle,
  MessagesSquare,
  Plug,
  PlayCircle,
  QrCode,
  Receipt,
  ScanLine,
  Settings,
  ShieldCheck,
  Timer,
  TrendingUp,
  Trophy,
  Users,
  UsersRound,
  Wallet,
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
      { href: "/cours", label: "Cours collectifs", icon: UsersRound },
      { href: "/messages", label: "Messages", icon: MessageCircle },
      { href: "/taches", label: "Tâches", icon: ListChecks },
    ],
  },
  {
    label: "Coaching",
    items: [
      { href: "/programmes", label: "Programmes", icon: Dumbbell },
      { href: "/exercices", label: "Vidéothèque", icon: PlayCircle },
      { href: "/nutrition", label: "Nutrition", icon: Apple },
      { href: "/evaluations", label: "Évaluations", icon: ClipboardList },
      { href: "/defis", label: "Défis", icon: Trophy },
      { href: "/assistant", label: "Assistant IA", icon: Bot },
    ],
  },
  {
    label: "Business",
    items: [
      { href: "/abonnements", label: "Abonnements", icon: CreditCard },
      { href: "/acces", label: "Accès salle", icon: ScanLine },
      { href: "/facturation", label: "Facturation", icon: Receipt },
      { href: "/reservations", label: "Réservations", icon: CalendarCheck },
      { href: "/parrainage", label: "Parrainage", icon: Gift },
      { href: "/analytique", label: "Analytique", icon: BarChart3 },
    ],
  },
  {
    label: "Administration",
    items: [
      { href: "/equipe", label: "Équipe", icon: ShieldCheck, roles: ["admin"] },
      { href: "/automatisations", label: "Automatisations", icon: Workflow },
      { href: "/whatsapp", label: "WhatsApp", icon: MessagesSquare },
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
      { href: "/moi/seance", label: "Ma séance", icon: Timer },
      { href: "/moi/cours", label: "Cours collectifs", icon: UsersRound },
      { href: "/moi/nutrition", label: "Nutrition", icon: Apple },
      { href: "/moi/defis", label: "Défis & badges", icon: Trophy },
    ],
  },
  {
    label: "Mon compte",
    items: [
      { href: "/moi/carte", label: "Ma carte & abonnement", icon: QrCode },
      { href: "/paiement", label: "Paiements", icon: Wallet },
      { href: "/moi/parrainage", label: "Parrainage", icon: Gift },
      { href: "/moi/messages", label: "Messages", icon: MessageCircle },
      { href: "/moi/checkin", label: "Mon check-in", icon: HeartPulse },
      { href: "/notifications", label: "Notifications", icon: Bell },
    ],
  },
];

/** Barre du bas sur mobile (le reste est dans /plus) */
export const STAFF_MOBILE = ["/", "/clients", "/seances", "/messages"];
export const CLIENT_MOBILE = ["/moi", "/moi/seance", "/moi/cours", "/moi/carte"];

export function navFor(role: Role) {
  const groups = role === "client" ? CLIENT_NAV : STAFF_NAV;
  return groups
    .map((g) => ({ ...g, items: g.items.filter((i) => !i.roles || i.roles.includes(role)) }))
    .filter((g) => g.items.length);
}
