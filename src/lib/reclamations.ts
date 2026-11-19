/**
 * Réclamations :
 * - « adherent » : envoyées par les adhérents via le QR code affiché dans la salle (page publique /signaler) ;
 * - « coach »    : envoyées par un coach (ou un head coach) à la direction depuis l'application.
 *   Privées : seuls l'auteur et les managers (admin, head coach) les voient.
 */
export const RECLAMATION_CATEGORIES = ["panne", "proprete", "securite", "service", "autre"] as const;
export const COACH_CATEGORIES = ["client", "planning", "materiel", "equipe", "administratif", "autre"] as const;
export type ReclamationCategory = (typeof RECLAMATION_CATEGORIES)[number] | (typeof COACH_CATEGORIES)[number];
export type ReclamationStatus = "nouvelle" | "en_cours" | "resolue";
export type ReclamationSource = "adherent" | "coach";

export interface Reclamation {
  id: string;
  created_at: string;
  source: ReclamationSource;
  category: ReclamationCategory;
  location: string | null;
  description: string;
  contact_name: string | null;
  contact_phone: string | null;
  /** Photo compressée (data URL JPEG) ou null */
  photo: string | null;
  status: ReclamationStatus;
  task_id: string | null;
  resolved_at: string | null;
  /** Réclamation de coach : auteur, client concerné, urgence, réponse de la direction */
  author_id: string | null;
  client_id: string | null;
  urgent: boolean | null;
  response: string | null;
  responded_by: string | null;
  responded_at: string | null;
}

export const CATEGORY_LABEL: Record<ReclamationCategory, string> = {
  panne: "Panne / matériel",
  proprete: "Propreté",
  securite: "Sécurité",
  service: "Accueil / service",
  autre: "Autre",
  client: "Un client",
  planning: "Planning / séances",
  materiel: "Matériel / salle",
  equipe: "Équipe / collègue",
  administratif: "Horaires, congés, administratif",
};

export const COACH_CATEGORY_HINT: Record<(typeof COACH_CATEGORIES)[number], string> = {
  client: "Comportement, retards, absences répétées…",
  planning: "Séance mal placée, surcharge, conflit d'horaire…",
  materiel: "Machine en panne, matériel manquant, salle…",
  equipe: "Souci avec un collègue ou l'organisation",
  administratif: "Horaires, congés, contrat, demande à la direction",
  autre: "Tout autre sujet",
};

export const SOURCE_LABEL: Record<ReclamationSource, string> = { adherent: "Salle (QR code)", coach: "Coach" };

export const STATUS_LABEL: Record<ReclamationStatus, string> = { nouvelle: "Nouvelle", en_cours: "En cours", resolue: "Résolue" };

/** Taille maximale de la photo stockée (data URL) */
export const MAX_PHOTO_CHARS = 700_000;

/** Source d'une ligne (les anciennes lignes sans colonne « source » viennent du QR code) */
export const sourceOf = (r: { source?: string | null }): ReclamationSource => (r.source === "coach" ? "coach" : "adherent");
