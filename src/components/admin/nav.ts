import { KeyRound, LayoutDashboard, ShieldCheck, UsersRound, type LucideIcon } from "lucide-react";

/**
 * Menu de l'espace admin (application séparée de l'espace coach).
 * Tout ce qui concerne l'admin vit sous src/app/admin + src/components/admin + src/actions/admin.ts :
 * le dossier peut être déployé plus tard comme un site à part (ex. admin.moovup.ma).
 */
export type AdminNavItem = { href: string; label: string; icon: LucideIcon; hint: string };

export const ADMIN_NAV: AdminNavItem[] = [
  { href: "/admin", label: "Vue CEO", icon: LayoutDashboard, hint: "Ventes, clients et graphiques" },
  { href: "/admin/controle", label: "Contrôle à distance", icon: ShieldCheck, hint: "Moov'Up Lady : pointage, séances confirmées, avis" },
  { href: "/admin/coachs", label: "Coachs", icon: UsersRound, hint: "Équipe et rôles" },
  { href: "/admin/acces", label: "Accès & rôles", icon: KeyRound, hint: "Qui voit quoi, test automatique" },
];

/**
 * Adresse de l'espace coach. Même site par défaut ("/") ; si l'admin est déployé à part,
 * définir NEXT_PUBLIC_COACH_APP_URL (ex. https://coach.moovup.ma).
 */
export const COACH_APP_URL = process.env.NEXT_PUBLIC_COACH_APP_URL || "/";
