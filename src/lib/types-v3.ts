/* ===================== Modules V3 ===================== */

export interface Food {
  id: string;
  name: string;
  category: string;
  portion: string | null;
  grams: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  moroccan: boolean;
}

export interface MealItem {
  food_id?: string | null;
  name: string;
  qty: number; // nombre de portions
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}
export interface Meal {
  name: string;
  time?: string | null;
  items: MealItem[];
}
export interface MealPlan {
  id: string;
  client_id: string | null;
  name: string;
  goal: string | null;
  target_kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  meals: Meal[];
  notes: string | null;
  active: boolean;
  created_by: string | null;
  created_at: string;
}

export interface FoodLog {
  id: string;
  client_id: string;
  logged_on: string;
  meal: string;
  food_name: string;
  qty: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  water_ml: number | null;
  created_at: string;
}

export interface ProgressPhoto {
  id: string;
  client_id: string;
  taken_on: string;
  pose: "face" | "profil" | "dos";
  storage_path: string | null;
  url: string | null;
  weight_kg: number | null;
  notes: string | null;
  shared_publicly: boolean;
  created_by: string | null;
  created_at: string;
}

export interface Membership {
  id: string;
  client_id: string;
  package_id: string | null;
  name: string;
  start_date: string;
  end_date: string;
  sessions_total: number | null;
  sessions_used: number;
  price_mad: number | null;
  status: "actif" | "suspendu" | "annule";
  auto_renew: boolean;
  created_at: string;
}

export interface GymCheckin {
  id: string;
  client_id: string;
  checked_at: string;
  method: "qr" | "manuel" | "code";
  created_by: string | null;
}

export interface OnlinePayment {
  id: string;
  invoice_id: string;
  client_id: string;
  provider: "stripe" | "cmi" | "demo";
  provider_ref: string | null;
  amount_mad: number;
  status: "en_attente" | "reussi" | "echoue";
  created_at: string;
  paid_at: string | null;
}

export interface WhatsAppMessage {
  id: string;
  client_id: string | null;
  to_phone: string;
  template: string;
  body: string;
  status: "en_attente" | "envoye" | "simule" | "echec";
  error: string | null;
  provider_id: string | null;
  created_at: string;
  sent_at: string | null;
}

export interface Challenge {
  id: string;
  title: string;
  description: string | null;
  metric: "presences" | "squat_kg" | "pas" | "custom";
  unit: string | null;
  goal_value: number | null;
  start_date: string;
  end_date: string;
  reward: string | null;
  cover: string | null;
  created_by: string | null;
  created_at: string;
}
export interface ChallengeEntry {
  id: string;
  challenge_id: string;
  client_id: string;
  value: number;
  updated_at: string;
}
export interface Badge {
  id: string;
  client_id: string;
  code: string;
  label: string;
  earned_on: string;
}

export interface GroupClass {
  id: string;
  title: string;
  category: string;
  coach_id: string | null;
  starts_at: string;
  duration_min: number;
  capacity: number;
  room: string | null;
  level: string | null;
  description: string | null;
  cancelled: boolean;
  created_at: string;
}
export interface ClassBooking {
  id: string;
  class_id: string;
  client_id: string;
  status: "inscrit" | "attente" | "annule" | "present" | "absent";
  created_at: string;
}

export interface Exercise {
  id: string;
  name: string;
  category: string;
  muscles: string[];
  equipment: string | null;
  level: string | null;
  video_url: string | null;
  instructions: string | null;
  tips: string | null;
  created_at: string;
}

export interface WorkoutSet {
  reps: string | number | null;
  load: number | null;
  done: boolean;
}
export interface WorkoutEntry {
  exercise: string;
  target?: string | null;
  sets: WorkoutSet[];
}
export interface WorkoutLog {
  id: string;
  client_id: string;
  program_id: string | null;
  day_title: string | null;
  started_at: string;
  finished_at: string | null;
  entries: WorkoutEntry[];
  rpe: number | null;
  notes: string | null;
  created_at: string;
}

export interface Referral {
  id: string;
  referrer_client_id: string;
  referred_name: string;
  referred_phone: string | null;
  referred_client_id: string | null;
  status: "en_attente" | "inscrit" | "recompense";
  reward_mad: number | null;
  created_at: string;
}
