import { Clock3,
  Apple,
  BarChart3,
  Bell,
  Bot,
  CalendarCheck,
  CalendarDays,
  CalendarRange,
  ClipboardList,
  Clock,
  Dumbbell,
  FileBarChart,
  Grid2x2,
  HeartPulse,
  LayoutDashboard,
  ListChecks,
  LockKeyhole,
  Megaphone,
  MessageCircle,
  MessagesSquare,
  PlayCircle,
  Plug,
  Settings,
  Sun,
  Timer,
  TrendingUp,
  Trophy,
  UserCog,
  Users,
  UsersRound,
  Watch,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "./types";

/**
 * Menu de l'application : SOURCE UNIQUE pour le menu latéral, la barre du bas (mobile),
 * le dock du mode tablette, la page « Plus » et la recherche Ctrl+K.
 *
 * - `main`   : menu court par rôle (bureau), « Plus » en dernier ;
 * - `mobile` : 4 entrées + « Plus » (barre du bas et dock tablette) ;
 * - `more`   : tout le reste, par groupes, avec une description d'une ligne (page « Plus ») ;
 * - `all`    : toutes les entrées accessibles au rôle (recherche).
 */

export type NavItem = {
  href: string;
  /** Libellé français (repli si la clé de traduction manque) */
  label: string;
  icon: LucideIcon;
  /** Rôles autorisés (absent = tout le personnel pour le menu staff, tous les adhérents pour le menu adhérent) */
  roles?: Role[];
  /** Description d'une ligne (page « Plus », recherche) */
  desc?: string;
  /** Clé de traduction si elle diffère du chemin (« nav.<key> ») */
  key?: string;
};
export type NavGroup = { id: string; label: string; items: NavItem[] };

const MANAGERS: Role[] = ["admin", "head_coach"];

/* ---------- Catalogue du personnel (page « Plus », groupes) ---------- */
export const STAFF_NAV: NavGroup[] = [
  {
    id: "agenda",
    label: "Agenda",
    items: [
      { href: "/seances", label: "Agenda", icon: CalendarDays, desc: "Mes séances de la semaine, à confirmer et à clôturer" },
      { href: "/planning", label: "Planning équipe", icon: CalendarRange, roles: MANAGERS, desc: "Affecter les séances et voir qui est libre" },
      { href: "/cours", label: "Cours collectifs", icon: UsersRound, desc: "Planning des cours, inscrits et listes d'attente" },
      { href: "/reservations", label: "Demandes de réservation", icon: CalendarCheck, desc: "Rendez-vous demandés en ligne à traiter" },
      { href: "/disponibilites", label: "Mes créneaux", icon: Clock, desc: "Mes disponibilités de la semaine et mes congés" },
    ],
  },
  {
    id: "clients",
    label: "Clients & suivi",
    items: [
      { href: "/clients", label: "Clients", icon: Users, desc: "Fiches, progression, santé et bilans" },
      { href: "/messages", label: "Messages", icon: MessageCircle, desc: "Conversations avec les adhérents" },
      { href: "/taches", label: "Tâches", icon: ListChecks, desc: "Ma liste de choses à faire" },
      { href: "/evaluations", label: "Évaluations", icon: ClipboardList, desc: "Tests physiques et comparaisons" },
      { href: "/rapports", label: "Rapports clients", icon: FileBarChart, desc: "Rapports de progression à imprimer ou envoyer" },
      { href: "/notifications", label: "Notifications", icon: Bell, desc: "Alertes et rappels reçus" },
    ],
  },
  {
    id: "coaching",
    label: "Coaching",
    items: [
      { href: "/programmes", label: "Programmes", icon: Dumbbell, desc: "Créer et attribuer des programmes d'entraînement" },
      { href: "/exercices", label: "Vidéothèque", icon: PlayCircle, desc: "Exercices en vidéo" },
      { href: "/nutrition", label: "Nutrition", icon: Apple, desc: "Plans alimentaires et suivi des repas" },
      { href: "/defis", label: "Défis", icon: Trophy, desc: "Challenges et badges pour motiver les adhérents" },
      { href: "/assistant", label: "Assistant IA", icon: Bot, desc: "Résumés, ajustements et brouillons de messages" },
    ],
  },
  {
    id: "equipe",
    label: "Équipe & pilotage",
    items: [
      { href: "/coachs", label: "Coachs", icon: UserCog, desc: "L'équipe, ses clients et sa charge" },
      { href: "/analytique", label: "Analytique", icon: BarChart3, roles: MANAGERS, desc: "Présence, fidélité et activité de la salle" },
      { href: "/automatisations", label: "Automatisations", icon: Workflow, roles: MANAGERS, desc: "Relances et tâches créées automatiquement" },
      { href: "/whatsapp", label: "WhatsApp", icon: MessagesSquare, roles: MANAGERS, desc: "Rappels et messages WhatsApp Business" },
      { href: "/pointage", label: "Pointage", icon: Clock3, desc: "Arrivée et départ avec le code de la borne de l'accueil" },
      { href: "/reclamations", label: "Réclamations", icon: Megaphone, desc: "Signaler un problème à la direction · signalements de la salle" },
    ],
  },
  {
    id: "admin",
    label: "Administration",
    items: [
      { href: "/admin", label: "Vue CEO", icon: LockKeyhole, roles: ["admin"], desc: "Cockpit de direction et gestion des coachs" },
      { href: "/parametres", label: "Paramètres", icon: Settings, roles: ["admin"], desc: "Marque, coordonnées et réservation en ligne" },
      { href: "/integrations", label: "Intégrations", icon: Plug, roles: ["admin"], desc: "Agenda, tableurs et outils connectés" },
    ],
  },
];

/* ---------- Catalogue de l'adhérent ---------- */
export const CLIENT_NAV: NavGroup[] = [
  {
    id: "monespace",
    label: "Mon espace",
    items: [
      { href: "/moi", label: "Ma progression", icon: TrendingUp, desc: "Ma prochaine séance, mes courbes et mes objectifs" },
      { href: "/moi/seance", label: "Ma séance", icon: Timer, desc: "Mon entraînement du jour, exercice par exercice" },
      { href: "/moi/cours", label: "Cours collectifs", icon: UsersRound, desc: "Réserver une place à un cours" },
      { href: "/moi/nutrition", label: "Nutrition", icon: Apple, desc: "Mon plan et mon journal de repas" },
      { href: "/moi/defis", label: "Défis & badges", icon: Trophy, desc: "Mes challenges et récompenses" },
    ],
  },
  {
    id: "moncompte",
    label: "Mon compte",
    items: [
      { href: "/moi/messages", label: "Messages", icon: MessageCircle, desc: "Écrire à mon coach" },
      { href: "/moi/checkin", label: "Mon check-in", icon: HeartPulse, desc: "2 minutes pour dire comment je me sens" },
      { href: "/moi/bilan", label: "Mon bilan sportif", icon: ClipboardList, desc: "Mon profil sportif et médical" },
      { href: "/moi/sante", label: "Santé connectée", icon: Watch, desc: "Pas, sommeil et fréquence cardiaque" },
      { href: "/notifications", label: "Notifications", icon: Bell, desc: "Rappels et nouvelles de mon coach" },
    ],
  },
];

/** Entrée « Plus » (fin du menu court et de la barre du bas) */
export const MORE_ITEM: NavItem = { href: "/plus", label: "Plus", icon: Grid2x2, key: "more" };

/* ---------- Menu court par rôle ---------- */
const it = (href: string, over: Partial<NavItem> = {}): NavItem => {
  const base = [...STAFF_NAV, ...CLIENT_NAV].flatMap((g) => g.items).find((i) => i.href === href);
  if (!base) throw new Error(`Entrée de menu inconnue : ${href}`);
  return { ...base, ...over };
};
const TODAY = (): NavItem => ({ href: "/", label: "Ma journée", icon: Sun, key: "today", desc: "Mes séances du jour, à confirmer et alertes" });
const DASHBOARD = (): NavItem => ({ href: "/", label: "Tableau de bord", icon: LayoutDashboard, key: "home", desc: "Aujourd'hui et indicateurs de la salle" });

const MAIN: Record<Role, () => NavItem[]> = {
  coach: () => [TODAY(), it("/clients", { label: "Mes clients", key: "myClients" }), it("/seances"), it("/messages"), it("/programmes"), it("/disponibilites"), MORE_ITEM],
  head_coach: () => [TODAY(), it("/clients"), it("/seances"), it("/planning"), it("/coachs"), it("/messages"), MORE_ITEM],
  admin: () => [it("/admin"), DASHBOARD(), it("/clients"), it("/seances"), it("/planning"), it("/coachs"), it("/messages"), MORE_ITEM],
  client: () => [it("/moi"), it("/moi/seance"), it("/moi/cours"), it("/moi/messages"), MORE_ITEM],
};
/** Barre du bas (mobile) et dock tablette : 4 entrées + « Plus » */
const MOBILE: Record<Role, string[]> = {
  coach: ["/", "/clients", "/seances", "/messages"],
  head_coach: ["/", "/clients", "/seances", "/messages"],
  admin: ["/", "/clients", "/seances", "/messages"],
  client: ["/moi", "/moi/seance", "/moi/cours", "/moi/messages"],
};

const allowed = (role: Role) => (i: NavItem) => !i.roles || i.roles.includes(role);

/** Menu complet d'un rôle (source unique) */
export function navFor(role: Role) {
  const catalogue = (role === "client" ? CLIENT_NAV : STAFF_NAV)
    .map((g) => ({ ...g, items: g.items.filter(allowed(role)) }))
    .filter((g) => g.items.length);
  const main = MAIN[role]().filter(allowed(role));
  const mobileHrefs = MOBILE[role];
  const mobile = mobileHrefs.map((h) => main.find((i) => i.href === h) ?? catalogue.flatMap((g) => g.items).find((i) => i.href === h)).filter((i): i is NavItem => !!i);
  // Page « Plus » : tout sauf ce qui est déjà dans la barre du bas
  const more = catalogue.map((g) => ({ ...g, items: g.items.filter((i) => !mobileHrefs.includes(i.href)) })).filter((g) => g.items.length);
  const all = [...main.filter((i) => i.href !== MORE_ITEM.href), ...catalogue.flatMap((g) => g.items)].filter((i, k, arr) => arr.findIndex((x) => x.href === i.href) === k);
  return { main, mobile, more, all };
}

/** L'entrée est-elle active pour ce chemin ? (« / » et « /moi » : correspondance exacte) */
export const navMatch = (href: string, path: string) => (href === "/" || href === "/moi" ? path === href : path === href || path.startsWith(href + "/"));

/** Clé de traduction d'une entrée : "/" → home, "/moi/cours" → moi.cours */
export const navKey = (href: string) => (href === "/" ? "home" : href.slice(1).replace(/\//g, "."));

type Tr = (key: string, vars?: Record<string, string | number>) => string;
const keyOf = (it: Pick<NavItem, "href" | "key">) => it.key ?? navKey(it.href);
/** Libellé traduit (retombe sur le libellé français) */
export function navLabel(t: Tr, it: Pick<NavItem, "href" | "label" | "key">) {
  const k = `nav.${keyOf(it)}`;
  const v = t(k);
  return v === k ? it.label : v;
}
/** Libellé court (barre du bas) */
export function navShort(t: Tr, it: Pick<NavItem, "href" | "label" | "key">) {
  const k = `nav.${keyOf(it)}.short`;
  const v = t(k);
  return v === k ? navLabel(t, it) : v;
}
/** Description traduite (retombe sur la description française) */
export function navDesc(t: Tr, it: Pick<NavItem, "href" | "desc" | "key">) {
  const k = `nav.${keyOf(it)}.desc`;
  const v = t(k);
  return v === k ? it.desc ?? "" : v;
}
export function navGroupLabel(t: Tr, g: Pick<NavGroup, "id" | "label">) {
  const k = `nav.g.${g.id}`;
  const v = t(k);
  return v === k ? g.label : v;
}
