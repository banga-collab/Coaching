/* Types du module planning (V5). */

/** Créneau hebdomadaire de disponibilité d'un coach (heure d'Agadir). */
export interface CoachAvailability {
  id: string;
  coach_id: string;
  /** 1 = lundi … 7 = dimanche */
  weekday: number;
  /** "HH:MM" */
  start_time: string;
  /** "HH:MM" */
  end_time: string;
  created_at?: string;
}

/** Congé / absence d'un coach (dates incluses). */
export interface CoachTimeOff {
  id: string;
  coach_id: string;
  /** AAAA-MM-JJ */
  starts_on: string;
  /** AAAA-MM-JJ (inclus) */
  ends_on: string;
  reason: string | null;
  created_at?: string;
}

/*
 * Prix INDICATIF d'une séance (DH), sans aucune notion de paiement.
 * Déclaré ici aussi (fusion d'interface) pour ne pas dépendre du module paiements.
 */
declare module "./types" {
  interface Session {
    price_mad?: number | null;
  }
}
