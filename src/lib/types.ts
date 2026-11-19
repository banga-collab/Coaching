/** head_coach : coach qui répartit les séances entre les coachs (planning de l'équipe). */
export type Role = "admin" | "head_coach" | "coach" | "client";
export type ClientStatus = "actif" | "pause" | "termine";
/**
 * Cycle d'une séance :
 * planifiee (attend la réponse du coach) → acceptee | refusee | reportee (nouvel horaire proposé)
 * acceptee → en_cours (bouton « Séance démarrée ») → realisee (bouton « Séance terminée »)
 * À tout moment : absent, annulee.
 */
export type SessionStatus = "planifiee" | "acceptee" | "refusee" | "reportee" | "en_cours" | "realisee" | "absent" | "annulee";
export type CheckKind = "initial" | "mensuel" | "hebdo";

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: Role;
  created_at: string;
  phone?: string | null;
  /** Compte désactivé (ancien coach) */
  active?: boolean | null;
  /** Ancienne colonne (commissions) : plus utilisée par l'app coaching */
  coach_pct?: number | null;
  /** Ancienne colonne (commissions) : plus utilisée par l'app coaching */
  sales_pct?: number | null;
  specialties?: string[] | null;
  /** Espace de travail : « mixte » (par défaut) ou « lady » (Moov'Up Lady, 100 % femmes) */
  espace?: Espace | null;
}

export type Espace = "mixte" | "lady";

/** Pointage d'un coach à la borne de l'accueil (écrit par le serveur seulement) */
export interface CoachPointage {
  id: string;
  coach_id: string;
  espace: Espace;
  kind: "arrivee" | "depart";
  at: string;
  method: "qr" | "code";
  created_at: string;
}

/** Confirmation + avis de la cliente sur une séance réalisée (lu par la direction, jamais par les coachs) */
export interface SessionFeedback {
  id: string;
  session_id: string;
  client_id: string;
  coach_id: string;
  happened: boolean;
  rating: number | null;
  comment: string | null;
  created_at: string;
}

export interface Client {
  id: string;
  coach_id: string;
  user_id: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  birth_date: string | null;
  sex: "H" | "F" | null;
  height_cm: number | null;
  goal: string | null;
  frequency: string | null;
  status: ClientStatus;
  start_date: string;
  notes: string | null;
  created_at: string;
}

export interface Session {
  id: string;
  client_id: string;
  coach_id: string;
  starts_at: string;
  duration_min: number;
  type: string;
  status: SessionStatus;
  rpe: number | null;
  notes: string | null;
  /** Qui a affecté la séance au coach (head coach / admin) */
  assigned_by?: string | null;
  /** Réponse du coach : date et motif (refus, report) */
  responded_at?: string | null;
  response_note?: string | null;
  /** Nouvel horaire proposé quand le coach reporte */
  proposed_at?: string | null;
  /** Heures réelles (boutons Démarrer / Terminer) */
  started_at?: string | null;
  ended_at?: string | null;
  /** Prix indicatif de la séance (information seulement : l'encaissement est géré par le CRM général) */
  price_mad?: number | null;
}

export interface SessionExercise {
  id: string;
  session_id: string;
  position: number;
  name: string;
  sets: number | null;
  reps: string | null;
  load_kg: number | null;
  rpe: number | null;
}

export interface Measurement {
  id: string;
  client_id: string;
  measured_on: string;
  weight_kg: number | null;
  body_fat: number | null;
  muscle_kg: number | null;
  waist_cm: number | null;
  hips_cm: number | null;
  chest_cm: number | null;
  arm_cm: number | null;
  thigh_cm: number | null;
  squat_kg: number | null;
  bench_kg: number | null;
  deadlift_kg: number | null;
  notes: string | null;
}

export interface HealthCheck {
  id: string;
  client_id: string;
  created_by: string | null;
  kind: CheckKind;
  checked_on: string;
  systolic: number | null;
  diastolic: number | null;
  resting_hr: number | null;
  sleep: number | null;
  energy: number | null;
  stress: number | null;
  motivation: number | null;
  nutrition: number | null;
  recovery: number | null;
  pain_zones: string[];
  conditions: string | null;
  medications: string | null;
  injuries: string | null;
  parq_positive: boolean | null;
  notes: string | null;
  consent: boolean;
}

/* ===================== Modules phases 1-3 ===================== */
export interface Settings {
  id: number;
  brand_name: string;
  app_name: string;
  primary_color: string;
  accent_color: string;
  logo_url: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
  ice: string | null;
  invoice_footer: string | null;
  booking_enabled: boolean;
  booking_types: string[];
  booking_hours: { start: string; end: string; days: number[]; slot: number };
  calendar_token: string;
  webhook_url: string | null;
  whatsapp_enabled?: boolean;
}

export type FieldType = "number" | "scale" | "text" | "choice" | "yesno";
export interface AssessmentField {
  id: string;
  label: string;
  type: FieldType;
  unit?: string;
  options?: string[];
  help?: string;
}
export interface AssessmentTemplate {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  fields: AssessmentField[];
  created_by: string | null;
  created_at: string;
}
export interface Assessment {
  id: string;
  client_id: string;
  template_id: string | null;
  template_name: string;
  fields: AssessmentField[];
  answers: Record<string, string | number | boolean | null>;
  score: number | null;
  notes: string | null;
  done_on: string;
  created_by: string | null;
  created_at: string;
}

export type GoalMetric = "weight_kg" | "body_fat" | "waist_cm" | "squat_kg" | "bench_kg" | "deadlift_kg" | "sessions" | "custom";
export interface Goal {
  id: string;
  client_id: string;
  title: string;
  metric: GoalMetric;
  unit: string | null;
  start_value: number | null;
  target_value: number | null;
  current_value: number | null;
  due_date: string | null;
  status: "en_cours" | "atteint" | "abandonne";
  created_at: string;
}

export interface DocumentRow {
  id: string;
  client_id: string;
  name: string;
  category: string;
  storage_path: string | null;
  size_bytes: number | null;
  mime: string | null;
  shared: boolean;
  created_by: string | null;
  created_at: string;
}

export interface ProgramExercise {
  name: string;
  sets?: number | null;
  reps?: string | null;
  load?: string | null;
  rest?: string | null;
  notes?: string | null;
}
export interface ProgramDay {
  title: string;
  focus?: string | null;
  exercises: ProgramExercise[];
}
export interface Program {
  id: string;
  name: string;
  description: string | null;
  goal: string | null;
  level: string | null;
  weeks: number;
  days: ProgramDay[];
  created_by: string | null;
  created_at: string;
}
export interface ClientProgram {
  id: string;
  client_id: string;
  program_id: string;
  start_date: string;
  status: "actif" | "termine" | "pause";
  created_at: string;
}

export interface Task {
  id: string;
  title: string;
  notes: string | null;
  client_id: string | null;
  assigned_to: string | null;
  due_date: string | null;
  priority: "basse" | "normale" | "haute";
  done: boolean;
  done_at: string | null;
  source: string;
  created_by: string | null;
  created_at: string;
}

export interface Message {
  id: string;
  client_id: string;
  sender_id: string | null;
  from_client: boolean;
  body: string;
  read_at: string | null;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  body: string | null;
  link: string | null;
  /** « paiement » : anciennes notifications uniquement (plus créées par l'app de coaching) */
  kind: "info" | "alerte" | "message" | "paiement" | "reservation" | "tache";
  read: boolean;
  created_at: string;
}

export interface BookingRequest {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  type: string;
  wanted_at: string;
  message: string | null;
  status: "nouvelle" | "confirmee" | "refusee";
  session_id: string | null;
  created_at: string;
}

export type AutomationId =
  | "checkin_reminder"
  | "health_check_due"
  | "absence_followup"
  | "goal_reached"
  | "inactive_client"
  | "wa_session_reminder"
  | "wa_checkin_missing";
export interface Automation {
  id: AutomationId;
  enabled: boolean;
  params: Record<string, number>;
  last_run: string | null;
  last_count: number | null;
}

export * from "./types-v3";
export * from "./types-planning";
export * from "./types-bilan";
