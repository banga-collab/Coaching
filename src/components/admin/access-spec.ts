/**
 * Matrice des accès (documentation affichée sur /admin/acces) et attentes du test automatique.
 * ⚠ Les attentes par route sont dupliquées dans scripts/test-acces.mjs (script Node sans dépendance) :
 * garder les deux listes synchronisées.
 */
import type { Role } from "@/lib/types";

export const ROLES: { key: Role; label: string }[] = [
  { key: "admin", label: "Admin" },
  { key: "head_coach", label: "Head coach" },
  { key: "coach", label: "Coach" },
  { key: "client", label: "Adhérent" },
];

/** yes = accès complet · own = limité à ses propres données · view = lecture seule · no = refusé */
export type Level = "yes" | "own" | "view" | "no";
export type Feature = { label: string; route?: string; levels: Record<Role, Level>; note?: string };

export const FEATURES: Feature[] = [
  { label: "Tableau de bord", route: "/", levels: { admin: "yes", head_coach: "yes", coach: "yes", client: "no" }, note: "L'adhérent est renvoyé vers son espace (/moi)." },
  { label: "Clients", route: "/clients", levels: { admin: "yes", head_coach: "yes", coach: "own", client: "no" }, note: "Le coach voit ses clients ; admin et head coach voient tous les clients." },
  { label: "Séances", route: "/seances", levels: { admin: "yes", head_coach: "yes", coach: "own", client: "own" }, note: "Coach : ses séances. Adhérent : ses séances dans son espace." },
  { label: "Planning équipe", route: "/planning", levels: { admin: "yes", head_coach: "yes", coach: "no", client: "no" } },
  { label: "Mes créneaux (disponibilités)", route: "/disponibilites", levels: { admin: "yes", head_coach: "yes", coach: "yes", client: "no" } },
  { label: "Affecter une séance à un coach", levels: { admin: "yes", head_coach: "yes", coach: "no", client: "no" } },
  { label: "Accepter / refuser une séance", levels: { admin: "own", head_coach: "own", coach: "own", client: "no" }, note: "Chaque coach répond aux séances qui lui sont affectées." },
  { label: "Équipe (annuaire des coachs)", route: "/coachs", levels: { admin: "yes", head_coach: "yes", coach: "yes", client: "no" } },
  { label: "Types de séance", route: "/seances/types", levels: { admin: "yes", head_coach: "yes", coach: "view", client: "no" }, note: "Admin et head coach modifient la liste." },
  { label: "Choisir / changer le coach d'un client", levels: { admin: "yes", head_coach: "yes", coach: "no", client: "no" }, note: "Uniquement parmi le personnel actif. Un coach crée ses clients pour lui-même." },
  { label: "Archiver un client", levels: { admin: "yes", head_coach: "yes", coach: "own", client: "no" }, note: "Statut « terminé », historique conservé : aucune suppression définitive depuis l'application." },
  { label: "Bilan sportif / médical (lecture)", levels: { admin: "yes", head_coach: "yes", coach: "yes", client: "own" }, note: "Tout le personnel ; l'adhérent consulte le sien (/moi/bilan)." },
  { label: "Bilan sportif (modifier / valider)", levels: { admin: "yes", head_coach: "yes", coach: "own", client: "no" }, note: "Coach du client ou auteur du bilan. Suppression : admin et head coach uniquement." },
  { label: "Pointage à la borne (arrivée / départ)", route: "/pointage", levels: { admin: "yes", head_coach: "yes", coach: "yes", client: "no" }, note: "Code de la borne de l'accueil, change toutes les 30 s. Le pointage est écrit par le serveur seulement." },
  { label: "Contrôle à distance (Moov'Up Lady)", route: "/admin/controle", levels: { admin: "yes", head_coach: "no", coach: "no", client: "no" }, note: "Pointages, séances confirmées ou contestées par les clientes, avis (jamais visibles par les coachs)." },
  { label: "Réclamations : envoyer à la direction", route: "/reclamations/nouvelle", levels: { admin: "yes", head_coach: "yes", coach: "yes", client: "no" }, note: "Surtout pour les coachs et le head coach. Une réclamation de coach n'est visible que par son auteur et les managers." },
  { label: "Réclamations : répondre et clore", route: "/reclamations", levels: { admin: "yes", head_coach: "yes", coach: "own", client: "no" }, note: "Les managers répondent aux coachs. Les signalements de la salle (QR code) sont traités par toute l'équipe." },
  { label: "Gestion des coachs", route: "/admin/coachs", levels: { admin: "yes", head_coach: "no", coach: "no", client: "no" }, note: "Rôles, activation, passation des clients et séances : uniquement dans l'Espace admin." },
  { label: "Espace admin", route: "/admin", levels: { admin: "yes", head_coach: "no", coach: "no", client: "no" } },
  { label: "Paramètres & intégrations", route: "/parametres", levels: { admin: "yes", head_coach: "no", coach: "no", client: "no" } },
  { label: "Automatisations", route: "/automatisations", levels: { admin: "yes", head_coach: "yes", coach: "no", client: "no" }, note: "Outil de manager : un coach ne gère pas les relances automatiques." },
  { label: "WhatsApp (envois et rappels)", route: "/whatsapp", levels: { admin: "yes", head_coach: "yes", coach: "no", client: "no" }, note: "Outil de manager. Le coach garde le bouton WhatsApp de la fiche client." },
  { label: "Espace adhérent", route: "/moi", levels: { admin: "no", head_coach: "no", coach: "no", client: "yes" }, note: "Le personnel voit seulement « compte non relié » sur /moi." },
];

/** Comptes de démo testés (cookie demo_user=<id>) */
export const TEST_USERS: { role: Role; id: string; name: string }[] = [
  { role: "admin", id: "00000000-0000-4000-8000-000000000001", name: "Yassine (admin)" },
  { role: "head_coach", id: "00000000-0000-4000-8000-000000000004", name: "Rachid (head coach)" },
  { role: "coach", id: "00000000-0000-4000-8000-000000000003", name: "Sara (coach)" },
  { role: "client", id: "00000000-0000-4000-8000-000000000002", name: "Karim (adhérent)" },
];

const STAFF: Role[] = ["admin", "head_coach", "coach"];
const ALL: Role[] = [...STAFF, "client"];

/**
 * Route → rôles autorisés (200) ; les autres doivent être redirigés (30x).
 * `gone` : page retirée (fonctions d'argent supprimées) → 404 attendu pour tous les comptes.
 * `allowed: []` : redirection attendue pour tous (ancienne page devenue un renvoi).
 */
export const ROUTE_EXPECTATIONS: { route: string; allowed: Role[]; gone?: boolean; note?: string }[] = [
  { route: "/", allowed: STAFF },
  { route: "/clients", allowed: STAFF },
  { route: "/seances", allowed: STAFF },
  { route: "/seances/types", allowed: STAFF },
  { route: "/coachs", allowed: STAFF },
  { route: "/planning", allowed: ["admin", "head_coach"] },
  { route: "/disponibilites", allowed: STAFF },
  { route: "/reclamations", allowed: STAFF },
  { route: "/reclamations/nouvelle", allowed: STAFF },
  { route: "/admin", allowed: ["admin"] },
  { route: "/admin/coachs", allowed: ["admin"] },
  { route: "/admin/controle", allowed: ["admin"] },
  { route: "/pointage", allowed: STAFF },
  { route: "/admin/acces", allowed: ["admin"] },
  { route: "/parametres", allowed: ["admin"] },
  { route: "/integrations", allowed: ["admin"] },
  { route: "/automatisations", allowed: ["admin", "head_coach"] },
  { route: "/whatsapp", allowed: ["admin", "head_coach"] },
  { route: "/moi", allowed: ALL, note: "Le personnel obtient la page « compte non relié » (200)." },
  { route: "/moi/bilan", allowed: ["client"], note: "Le personnel (sans dossier adhérent) est renvoyé vers /moi." },
  { route: "/equipe", allowed: [], note: "Ancienne page : renvoie vers /admin/coachs (puis l'espace admin refuse les non-admins)." },
  // Pages retirées avec les fonctions d'argent
  { route: "/tarifs", allowed: [], gone: true },
  { route: "/encaissements", allowed: [], gone: true },
  { route: "/facturation", allowed: [], gone: true },
  { route: "/abonnements", allowed: [], gone: true },
  { route: "/acces", allowed: [], gone: true },
  { route: "/parrainage", allowed: [], gone: true },
  { route: "/paiement", allowed: [], gone: true },
  { route: "/moi/carte", allowed: [], gone: true },
  { route: "/moi/parrainage", allowed: [], gone: true },
  { route: "/admin/paiements", allowed: [], gone: true },
  { route: "/admin/commissions", allowed: [], gone: true },
];

export type Expected = "ok" | "redirect" | "notfound";
/** Résultat attendu pour un rôle sur une route */
export function expectedFor(r: { allowed: Role[]; gone?: boolean }, role: Role): Expected {
  if (r.gone) return "notfound";
  return r.allowed.includes(role) ? "ok" : "redirect";
}
export const EXPECTED_LABEL: Record<Expected, string> = { ok: "autorisé", redirect: "redirigé", notfound: "404 (retirée)" };

export type Outcome = "ok" | "redirect" | "notfound" | "error";
export type Check = { role: Role; route: string; expected: Expected; got: Outcome; status: number; location?: string; pass: boolean; detail?: string };

/** Interprète une réponse HTTP (fetch avec redirect: "manual"). */
export function classify(status: number, location: string | null, body: string): { got: Outcome; detail?: string } {
  if (status >= 300 && status < 400) return { got: "redirect", detail: location ?? undefined };
  if (status === 404) return { got: "notfound" };
  if (status >= 500) return { got: "error", detail: `HTTP ${status}` };
  if (body.includes("__next-page-redirect") || body.includes("NEXT_REDIRECT")) return { got: "redirect", detail: "redirection côté client" };
  if (body.includes("NEXT_HTTP_ERROR_FALLBACK;404")) return { got: "notfound" };
  if (body.includes("Application error") || body.includes("Internal Server Error")) return { got: "error", detail: "Application error" };
  return { got: "ok" };
}
