/* eslint-disable @typescript-eslint/no-explicit-any */
/** Données de démo du module bilan sportif (V5). */
import { computeRisk, keyColumns, normalizeAnswers } from "./bilan";
import type { BilanAnswers } from "./types-bilan";

type Row = Record<string, any>;
type DB = Record<string, Row[]>;

const day = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};
const ageOf = (birth: string | null) => {
  if (!birth) return null;
  const b = new Date(birth);
  const n = new Date();
  let a = n.getFullYear() - b.getFullYear();
  if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) a--;
  return a;
};
/** Mois et année il y a `m` mois */
const monthsAgo = (m: number) => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - m);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
};

const NO_PARQ = [false, false, false, false, false, false, false];

export function seedBilan(db: DB, uid: () => string): DB {
  const clients = db.clients ?? [];
  const byName = (name: string) => clients.find((c) => c.full_name === name);
  const rows: Row[] = [];

  const push = (name: string, offset: number, partial: Partial<BilanAnswers>, opts: { status?: "valide" | "a_valider"; by?: string } = {}) => {
    const c = byName(name);
    if (!c) return;
    const answers = normalizeAnswers({ height_cm: c.height_cm, ...partial });
    const doneOn = day(offset);
    const risk = computeRisk(answers, { sex: c.sex, age: ageOf(c.birth_date), now: new Date(doneOn) });
    const status = opts.status ?? "valide";
    const by = opts.by ?? c.coach_id;
    rows.push({
      id: uid(),
      client_id: c.id,
      created_by: by,
      done_on: doneOn,
      status,
      validated_by: status === "valide" ? c.coach_id : null,
      validated_at: status === "valide" ? `${doneOn}T10:00:00.000Z` : null,
      ...keyColumns(answers, risk, new Date(doneOn)),
      answers,
      created_at: `${doneOn}T09:30:00.000Z`,
      updated_at: `${doneOn}T09:30:00.000Z`,
    });
  };

  // Karim : ancien footballeur, ménisque opéré en 2019. Premier bilan à l'inscription puis mise à jour.
  const karim: Partial<BilanAnswers> = {
    weight_kg: 98, profession: "sedentaire", profession_label: "Comptable",
    sport_history: "Football en club pendant 12 ans (milieu de terrain), arrêt en 2019 après l'opération du genou.", sport_level: "ancien_sportif",
    activity_frequency: "Moins d'1x / semaine", objectives: ["Perte de poids", "Santé & bien-être"], objectives_note: "Perdre 12 kg et rejouer au foot entre amis sans douleur.",
    motivation: 8, availability: "Lundi, mercredi, vendredi à 7h",
    sleep_hours: 6, sleep_quality: "moyenne", stress: 6, water_l: 1.2, nutrition_habits: "Saute souvent le petit-déjeuner, repas copieux le soir, sodas au travail.",
    surgery: true, surgeries: [{ what: "Ménisque genou droit (arthroscopie)", year: 2019, month: 4 }],
    diabetes: "non", hypertension: false, cardiac: false, respiratory: false, cholesterol: false, epilepsy: false,
    allergies: "Aucune", medications: "Aucun", pain_zones: ["Genoux"], pain_details: "Gêne au genou droit sur les fentes et les descentes d'escaliers.",
    smoker: "non", alcohol: "non", med_certificate: true, med_certificate_date: day(-170), parq: [false, false, false, false, true, false, false],
    resting_hr: 74, systolic: 134, diastolic: 85, waist_cm: 104, flexibility_cm: -6, pushups: 14, plank_s: 45, ruffier_p0: 74, ruffier_p1: 128, ruffier_p2: 96,
    coach_notes: "Très motivé. Genou droit à ménager : pas de sauts au début.", recommendations: "Renforcement quadriceps/ischios, vélo et rameur pour le cardio, fentes en amplitude réduite.",
  };
  push("Karim El Amrani", -172, karim);
  push("Karim El Amrani", -12, {
    ...karim, weight_kg: 90, activity_frequency: "2-3x / semaine", motivation: 9, stress: 5, water_l: 1.8,
    nutrition_habits: "Petit-déjeuner tous les jours, moins de sodas. Encore des écarts le week-end.",
    resting_hr: 66, systolic: 128, diastolic: 82, waist_cm: 94, flexibility_cm: -2, pushups: 26, plank_s: 90, ruffier_p0: 66, ruffier_p1: 116, ruffier_p2: 82,
    coach_notes: "Belle progression, le genou tient bien sur le squat parallèle.", recommendations: "Introduire la course légère sur tapis (10 min) ; garder le renforcement du genou.",
  });

  // Salma : jeune, active, aucun signal → vert
  push("Salma Bennani", -150, {
    weight_kg: 63, profession: "debout", profession_label: "Pharmacienne", sport_history: "Danse classique jusqu'à 18 ans, yoga occasionnel.", sport_level: "intermediaire",
    activity_frequency: "1x / semaine", objectives: ["Tonification", "Mobilité"], motivation: 8, availability: "Mardi et jeudi soir après 19h",
    sleep_hours: 8, sleep_quality: "bonne", stress: 3, water_l: 2, nutrition_habits: "Équilibrée, cuisine maison.",
    surgery: false, diabetes: "non", hypertension: false, cardiac: false, respiratory: false, cholesterol: false, epilepsy: false, allergies: "Pollen", medications: "Aucun",
    pregnant: false, smoker: "non", alcohol: "non", med_certificate: true, med_certificate_date: day(-160), parq: NO_PARQ,
    resting_hr: 61, systolic: 112, diastolic: 72, waist_cm: 75, flexibility_cm: 14, pushups: 12, plank_s: 70, ruffier_p0: 62, ruffier_p1: 104, ruffier_p2: 72,
    recommendations: "Programme standard, travail haut du corps et gainage.",
  });

  // Nadia : hypertension traitée + diabète de type 2, PAR-Q positif sans certificat → rouge
  push("Nadia Ouhammou", -20, {
    weight_kg: 74, profession: "sedentaire", profession_label: "Assistante de direction", sport_history: "Marche le week-end, aucune pratique en salle.", sport_level: "debutant",
    activity_frequency: "Moins d'1x / semaine", objectives: ["Santé & bien-être", "Mobilité"], objectives_note: "Moins de douleurs au dos, retrouver de l'énergie.", motivation: 6, availability: "Lundi et jeudi matin",
    sleep_hours: 5, sleep_quality: "moyenne", stress: 8, water_l: 1, nutrition_habits: "Grignotage l'après-midi, pain blanc à chaque repas.",
    surgery: true, surgeries: [{ what: "Césarienne", year: 2004, month: null }],
    diabetes: "type2", hypertension: true, hypertension_treated: true, cardiac: false, respiratory: false, cholesterol: true, epilepsy: false,
    other_conditions: "Arthrose lombaire", allergies: "Aucune", medications: "Amlodipine 5 mg, Metformine 850 mg", pain_zones: ["Bas du dos", "Genoux"],
    pain_details: "Douleurs lombaires le matin, raideur.", pregnant: false, smoker: "non", alcohol: "non", med_certificate: false,
    parq: [false, false, false, true, true, true, false],
    resting_hr: 78, systolic: 146, diastolic: 92, waist_cm: 97,
    coach_notes: "Fatiguée, travail stressant. A promis de voir son médecin traitant.", recommendations: "En attendant le certificat : mobilité, marche, gainage doux. Pas d'apnée ni de charges lourdes.",
  });

  // Omar : jeune athlète, ancien fumeur → vert
  push("Omar Tazi", -100, {
    weight_kg: 71, profession: "debout", profession_label: "Étudiant STAPS", sport_history: "Athlétisme (400 m), compétitions régionales. Basket au lycée.", sport_level: "confirme",
    activity_frequency: "4x / semaine ou plus", objectives: ["Performance"], objectives_note: "Descendre sous les 50 s au 400 m.", motivation: 10, availability: "Mardi et vendredi 17h",
    sleep_hours: 7.5, sleep_quality: "bonne", stress: 4, water_l: 2.5, nutrition_habits: "Riche en protéines, suit un plan.",
    surgery: false, diabetes: "non", hypertension: false, cardiac: false, respiratory: false, cholesterol: false, epilepsy: false, allergies: "Aucune", medications: "Aucun",
    pain_zones: ["Chevilles"], pain_details: "Ancienne entorse cheville gauche (2024), parfois raide.",
    smoker: "ancien", alcohol: "non", med_certificate: true, med_certificate_date: day(-110), parq: NO_PARQ,
    resting_hr: 52, systolic: 118, diastolic: 72, waist_cm: 77, flexibility_cm: 9, pushups: 48, plank_s: 180, ruffier_p0: 52, ruffier_p1: 92, ruffier_p2: 60,
    recommendations: "Pliométrie et force maximale ; proprioception cheville gauche.",
  });

  // Imane : mauvaise qualité de sommeil (signal info) → vert
  push("Imane Chraibi", -45, {
    weight_kg: 70, profession: "sedentaire", profession_label: "Développeuse", sport_history: "Natation enfant, rien depuis 5 ans.", sport_level: "debutant",
    activity_frequency: "Aucune", objectives: ["Santé & bien-être", "Tonification"], objectives_note: "Reprendre une routine sportive.", motivation: 7, availability: "Mardi et vendredi 8h",
    sleep_hours: 6, sleep_quality: "mauvaise", stress: 6, water_l: 1, nutrition_habits: "Beaucoup de café, repas rapides au bureau.",
    surgery: false, diabetes: "non", hypertension: false, cardiac: false, respiratory: true, cholesterol: false, epilepsy: false, allergies: "Acariens", medications: "Ventoline si besoin",
    pregnant: false, smoker: "non", alcohol: "occasionnel", med_certificate: true, med_certificate_date: day(-50), parq: NO_PARQ,
    resting_hr: 72, systolic: 110, diastolic: 70, waist_cm: 86, flexibility_cm: 4, pushups: 5, plank_s: 35,
    coach_notes: "Se couche tard (écrans). Réveils nocturnes fréquents.", recommendations: "Séances le matin, mobilité et respiration en fin de séance. Conseils sommeil.",
  });

  // Mehdi : fumeur régulier 10/jour, alcool occasionnel → orange
  push("Mehdi Alaoui", -60, {
    weight_kg: 92, profession: "sedentaire", profession_label: "Commercial (beaucoup de voiture)", sport_history: "Tennis il y a 10 ans.", sport_level: "debutant",
    activity_frequency: "Moins d'1x / semaine", objectives: ["Perte de poids"], objectives_note: "Perdre du ventre avant l'été.", motivation: 7, availability: "Midi, lundi-mercredi-vendredi",
    sleep_hours: 6.5, sleep_quality: "moyenne", stress: 7, water_l: 1, nutrition_habits: "Restaurants d'affaires fréquents, peu de légumes.",
    surgery: false, diabetes: "non", hypertension: false, cardiac: false, respiratory: false, cholesterol: false, epilepsy: false, allergies: "Aucune", medications: "Aucun",
    smoker: "regulier", cigarettes_per_day: 10, alcohol: "occasionnel", med_certificate: false, parq: NO_PARQ,
    resting_hr: 76, systolic: 132, diastolic: 84, waist_cm: 104, pushups: 15, plank_s: 40, ruffier_p0: 76, ruffier_p1: 136, ruffier_p2: 104,
    coach_notes: "Essoufflé vite sur le rameur.", recommendations: "Cardio progressif en intervalles doux, circuit training. Parler de l'arrêt du tabac.",
  });

  // Leila : opération de l'épaule il y a 8 mois → orange
  const shoulder = monthsAgo(8);
  push("Leila Benjelloun", -30, {
    weight_kg: 65, profession: "debout", profession_label: "Enseignante", sport_history: "Pilates 2 ans, randonnée.", sport_level: "intermediaire",
    activity_frequency: "1x / semaine", objectives: ["Rééducation / reprise", "Mobilité"], objectives_note: "Retrouver toute la mobilité de l'épaule droite.", motivation: 9, availability: "Mardi et vendredi matin",
    sleep_hours: 7, sleep_quality: "bonne", stress: 4, water_l: 1.5, nutrition_habits: "Équilibrée.",
    surgery: true, surgeries: [{ what: "Coiffe des rotateurs, épaule droite", year: shoulder.year, month: shoulder.month }],
    diabetes: "non", hypertension: false, cardiac: false, respiratory: false, cholesterol: false, epilepsy: false, allergies: "Pénicilline", medications: "Aucun",
    pain_zones: ["Épaules"], pain_details: "Douleur en fin d'amplitude (bras au-dessus de la tête).", pregnant: false,
    smoker: "non", alcohol: "occasionnel", med_certificate: true, med_certificate_date: day(-35), parq: [false, false, false, false, true, false, false],
    resting_hr: 66, systolic: 120, diastolic: 78, waist_cm: 82, flexibility_cm: 6, plank_s: 50,
    coach_notes: "Suivi kiné terminé il y a 2 mois. Le kiné autorise le renforcement léger.", recommendations: "Élastiques, rotations externes, pas de développé au-dessus de la tête pour l'instant.",
  });

  // Youssef Ait Lahcen : pas encore de bilan sportif (pour tester « Faire le bilan »)
  return { sport_assessments: rows };
}
