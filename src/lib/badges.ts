import type { SupabaseClient } from "@supabase/supabase-js";
import type { Badge, Challenge, ClassBooking, Goal, GymCheckin, Measurement, Referral, Session } from "./types";
import { challengeStatus, computeLeaderboard, loadScoreData } from "./challenges";
import { dayKey, isoToAgadir } from "./utils";

export interface BadgeDef {
  code: string;
  label: string;
  description: string; // comment l'obtenir
  icon: string; // nom d'icône lucide (voir components/challenges/badge-icon.tsx)
  color: string; // couleur principale (hex)
}

export const BADGES: BadgeDef[] = [
  { code: "premiere_seance", label: "Première séance", description: "Réalise ta toute première séance ou ton premier passage.", icon: "Sparkles", color: "#1a6d8e" },
  { code: "dix_seances", label: "10 séances", description: "Cumule 10 séances ou passages à la salle.", icon: "Dumbbell", color: "#0ea5e9" },
  { code: "cinquante_seances", label: "50 séances", description: "Cumule 50 séances ou passages à la salle.", icon: "Medal", color: "#8b5cf6" },
  { code: "cent_seances", label: "100 séances", description: "Cumule 100 séances : légende du Complexe !", icon: "Crown", color: "#eab308" },
  { code: "regulier_4", label: "4 semaines d'affilée", description: "Viens au moins une fois par semaine, 4 semaines de suite.", icon: "CalendarCheck", color: "#10b981" },
  { code: "moins_5kg", label: "−5 kg", description: "Perds 5 kg par rapport à ta première pesée.", icon: "TrendingDown", color: "#14b8a6" },
  { code: "moins_10kg", label: "−10 kg", description: "Perds 10 kg par rapport à ta première pesée.", icon: "Flame", color: "#ef4444" },
  { code: "record_squat", label: "Record squat", description: "Bats ton meilleur squat lors d'une mesure.", icon: "Zap", color: "#e8782a" },
  { code: "objectif_atteint", label: "Objectif atteint", description: "Atteins un objectif fixé avec ton coach.", icon: "Target", color: "#22c55e" },
  { code: "defi_gagne", label: "Défi gagné", description: "Termine 1er d'un défi du mois.", icon: "Trophy", color: "#f59e0b" },
  { code: "parrain", label: "Parrain", description: "Parraine un ami qui s'inscrit (parrainage récompensé).", icon: "HeartHandshake", color: "#ec4899" },
  { code: "leve_tot", label: "Lève-tôt", description: "Fais 5 passages à la salle avant 8 h du matin.", icon: "Sunrise", color: "#f97316" },
];

export const BADGE_BY_CODE = new Map(BADGES.map((b) => [b.code, b]));

/** Lundi (AAAA-MM-JJ) de la semaine d'une clé jour */
function weekOf(key: string) {
  const d = new Date(`${key}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

function hasConsecutiveWeeks(weeks: Set<string>, n: number) {
  const sorted = [...weeks].sort();
  let run = 0;
  let prev: number | null = null;
  for (const w of sorted) {
    const t = Date.parse(`${w}T12:00:00Z`);
    run = prev !== null && Math.round((t - prev) / 86400000) === 7 ? run + 1 : 1;
    if (run >= n) return true;
    prev = t;
  }
  return false;
}

/** Calcule les badges mérités par un client (codes). */
export async function computeBadges(supabase: SupabaseClient, clientId: string): Promise<string[]> {
  const [{ data: s }, { data: g }, { data: m }, { data: go }, { data: r }, { data: b }, { data: ch }] = await Promise.all([
    supabase.from("sessions").select("starts_at, status").eq("client_id", clientId).eq("status", "realisee"),
    supabase.from("gym_checkins").select("checked_at").eq("client_id", clientId),
    supabase.from("measurements").select("measured_on, weight_kg, squat_kg").eq("client_id", clientId).order("measured_on"),
    supabase.from("goals").select("status").eq("client_id", clientId).eq("status", "atteint"),
    supabase.from("referrals").select("status").eq("referrer_client_id", clientId).eq("status", "recompense"),
    supabase.from("class_bookings").select("status, created_at, class_id").eq("client_id", clientId).eq("status", "present"),
    supabase.from("challenges").select("*"),
  ]);
  const sessions = (s ?? []) as Pick<Session, "starts_at">[];
  const checkins = (g ?? []) as Pick<GymCheckin, "checked_at">[];
  const meas = (m ?? []) as Pick<Measurement, "measured_on" | "weight_kg" | "squat_kg">[];
  const presentClasses = (b ?? []) as Pick<ClassBooking, "class_id">[];
  const earned = new Set<string>();

  // Séances réalisées + passages + cours suivis
  const total = sessions.length + checkins.length + presentClasses.length;
  if (total >= 1) earned.add("premiere_seance");
  if (total >= 10) earned.add("dix_seances");
  if (total >= 50) earned.add("cinquante_seances");
  if (total >= 100) earned.add("cent_seances");

  // Régularité (semaines consécutives)
  const weeks = new Set<string>([...sessions.map((x) => weekOf(dayKey(x.starts_at))), ...checkins.map((x) => weekOf(dayKey(x.checked_at)))]);
  if (hasConsecutiveWeeks(weeks, 4)) earned.add("regulier_4");

  // Perte de poids depuis la première pesée
  const weights = meas.filter((x) => x.weight_kg !== null).map((x) => Number(x.weight_kg));
  if (weights.length > 1) {
    const loss = weights[0]! - Math.min(...weights.slice(1));
    if (loss >= 5) earned.add("moins_5kg");
    if (loss >= 10) earned.add("moins_10kg");
  }

  // Record squat : une mesure dépasse le meilleur précédent
  let best: number | null = null;
  for (const x of meas) {
    if (x.squat_kg === null) continue;
    const v = Number(x.squat_kg);
    if (best !== null && v > best) earned.add("record_squat");
    best = best === null ? v : Math.max(best, v);
  }

  if (((go ?? []) as Pick<Goal, "status">[]).length) earned.add("objectif_atteint");
  if (((r ?? []) as Pick<Referral, "status">[]).length) earned.add("parrain");

  // Lève-tôt : 5 passages avant 8 h (heure d'Agadir)
  if (checkins.filter((x) => isoToAgadir(x.checked_at).time < "08:00").length >= 5) earned.add("leve_tot");

  // Défi gagné : 1er d'un défi terminé
  const ended = ((ch ?? []) as Challenge[]).filter((c) => challengeStatus(c) === "termine");
  if (ended.length) {
    const data = await loadScoreData(supabase, ended);
    if (ended.some((c) => computeLeaderboard(c, data).some((row) => row.client_id === clientId && row.rank === 1 && row.value > 0))) earned.add("defi_gagne");
  }

  return BADGES.map((x) => x.code).filter((c) => earned.has(c));
}

/** Calcule les badges mérités et insère ceux qui manquent. Renvoie tous les badges du client. */
export async function syncBadges(supabase: SupabaseClient, clientId: string): Promise<{ badges: Badge[]; added: string[] }> {
  const [codes, { data: existing }] = await Promise.all([
    computeBadges(supabase, clientId),
    supabase.from("badges").select("*").eq("client_id", clientId),
  ]);
  const have = new Set(((existing ?? []) as Badge[]).map((x) => x.code));
  const missing = codes.filter((c) => !have.has(c));
  const today = dayKey(new Date());
  const added: string[] = [];
  for (const code of missing) {
    const def = BADGE_BY_CODE.get(code)!;
    try {
      // Une ligne à la fois : un doublon (contrainte unique) n'empêche pas les autres
      const { error } = await supabase.from("badges").insert({ client_id: clientId, code, label: def.label, earned_on: today });
      if (!error) added.push(code);
    } catch {
      /* doublon ou RLS : ignoré */
    }
  }
  if (!added.length) return { badges: (existing ?? []) as Badge[], added };
  const { data: all } = await supabase.from("badges").select("*").eq("client_id", clientId);
  return { badges: (all ?? []) as Badge[], added };
}
