/* eslint-disable @typescript-eslint/no-explicit-any */
/** Données démo des modules V3 (nutrition, photos, abonnements, cours, défis…). */
import { agadirToIso } from "./utils";

type Row = Record<string, any>;
type DB = Record<string, Row[]>;

const ADMIN = "00000000-0000-4000-8000-000000000001";
const COACH = "00000000-0000-4000-8000-000000000003";

const day = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};
const at = (offset: number, hh: number, mm = 0) => agadirToIso(day(offset), `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`);

/** Photos libres de droits (silhouettes génériques) — remplacées par les vraies photos en production */
const PHOTO = (seed: string) => `https://picsum.photos/seed/${seed}/600/800?grayscale`;

export function seedV3(db: DB, uid: () => string): DB {
  const clients = db.clients!;
  const C = (i: number) => clients[i]!;
  const packages = db.packages ?? [];

  // Codes personnels
  clients.forEach((c, i) => {
    c.access_code = `MU${String(4821 + i * 137).padStart(6, "0")}`;
    c.referral_code = ["KARIM10", "SALMA10", "YOUSSEF10", "NADIA10", "OMAR10", "IMANE10", "MEHDI10", "LEILA10"][i] ?? `MU${i}`;
  });
  const s = db.settings?.[0];
  if (s) Object.assign(s, { payment_provider: "stripe", referral_reward_mad: 200, referral_discount_pct: 10, whatsapp_enabled: false });

  /* ---------- Aliments (dont plats marocains) ---------- */
  const F = (name: string, category: string, portion: string, grams: number, kcal: number, protein: number, carbs: number, fat: number, moroccan = false) => ({
    id: uid(), name, category, portion, grams, kcal, protein, carbs, fat, moroccan, created_at: day(-200),
  });
  const foods = [
    F("Tajine de poulet aux légumes", "Plats marocains", "1 assiette (350 g)", 350, 420, 38, 22, 19, true),
    F("Couscous aux 7 légumes", "Plats marocains", "1 assiette (400 g)", 400, 560, 22, 88, 13, true),
    F("Harira", "Plats marocains", "1 bol (300 ml)", 300, 210, 11, 30, 5, true),
    F("Msemen", "Plats marocains", "1 pièce (80 g)", 80, 260, 5, 34, 12, true),
    F("Baghrir", "Plats marocains", "1 pièce (60 g)", 60, 120, 3, 24, 1, true),
    F("Rfissa", "Plats marocains", "1 assiette (350 g)", 350, 610, 34, 62, 24, true),
    F("Zaalouk", "Plats marocains", "1 portion (150 g)", 150, 140, 3, 12, 9, true),
    F("Loubia (haricots blancs)", "Plats marocains", "1 bol (250 g)", 250, 280, 16, 40, 6, true),
    F("Bissara", "Plats marocains", "1 bol (300 ml)", 300, 290, 17, 42, 7, true),
    F("Pain khobz complet", "Féculents", "1/4 de pain (70 g)", 70, 175, 6, 33, 2, true),
    F("Thé à la menthe sucré", "Boissons", "1 verre (150 ml)", 150, 60, 0, 15, 0, true),
    F("Amlou", "Matières grasses", "1 c. à soupe (20 g)", 20, 120, 3, 5, 10, true),
    F("Blanc de poulet grillé", "Protéines", "150 g", 150, 248, 46, 0, 5),
    F("Œufs", "Protéines", "2 œufs (110 g)", 110, 155, 13, 1, 11),
    F("Thon au naturel", "Protéines", "1 boîte (140 g)", 140, 150, 34, 0, 1),
    F("Sardines grillées", "Protéines", "150 g", 150, 300, 37, 0, 17, true),
    F("Lben / raïb", "Produits laitiers", "1 verre (200 ml)", 200, 120, 7, 9, 6, true),
    F("Fromage blanc 0 %", "Produits laitiers", "1 pot (150 g)", 150, 75, 12, 6, 0),
    F("Riz complet cuit", "Féculents", "150 g", 150, 170, 4, 36, 1),
    F("Flocons d'avoine", "Féculents", "50 g", 50, 190, 7, 32, 3),
    F("Patate douce", "Féculents", "200 g", 200, 172, 3, 40, 0),
    F("Lentilles cuites", "Légumineuses", "200 g", 200, 230, 18, 40, 1),
    F("Banane", "Fruits", "1 moyenne (120 g)", 120, 105, 1, 27, 0),
    F("Dattes", "Fruits", "3 dattes (30 g)", 30, 85, 1, 22, 0, true),
    F("Orange", "Fruits", "1 moyenne (150 g)", 150, 70, 1, 17, 0),
    F("Amandes", "Oléagineux", "30 g", 30, 175, 6, 6, 15),
    F("Huile d'olive", "Matières grasses", "1 c. à soupe (10 g)", 10, 90, 0, 0, 10),
    F("Salade marocaine (tomate-oignon)", "Légumes", "1 bol (200 g)", 200, 60, 2, 10, 2, true),
    F("Whey protéine", "Compléments", "1 dose (30 g)", 30, 120, 24, 3, 2),
  ];
  const f = (name: string, qty = 1) => {
    const x = foods.find((y) => y.name === name)!;
    return { food_id: x.id, name: x.name, qty, kcal: x.kcal * qty, protein: x.protein * qty, carbs: x.carbs * qty, fat: x.fat * qty };
  };

  /* ---------- Plans alimentaires ---------- */
  const plan = (client_id: string | null, name: string, goal: string, kcal: number, p: number, c: number, fa: number, meals: any[]) => ({
    id: uid(), client_id, name, goal, target_kcal: kcal, protein_g: p, carbs_g: c, fat_g: fa, meals, notes: null, active: true, created_by: ADMIN, created_at: day(-40),
  });
  const cutMeals = [
    { name: "Petit-déjeuner", time: "07:30", items: [f("Flocons d'avoine"), f("Lben / raïb"), f("Banane"), f("Thé à la menthe sucré")] },
    { name: "Déjeuner", time: "13:00", items: [f("Tajine de poulet aux légumes"), f("Pain khobz complet"), f("Salade marocaine (tomate-oignon)")] },
    { name: "Collation", time: "16:30", items: [f("Fromage blanc 0 %"), f("Dattes"), f("Amandes", 0.5)] },
    { name: "Dîner", time: "20:30", items: [f("Harira"), f("Œufs"), f("Salade marocaine (tomate-oignon)")] },
  ];
  const bulkMeals = [
    { name: "Petit-déjeuner", time: "07:00", items: [f("Flocons d'avoine", 2), f("Œufs"), f("Banane"), f("Amlou")] },
    { name: "Déjeuner", time: "12:30", items: [f("Couscous aux 7 légumes"), f("Blanc de poulet grillé")] },
    { name: "Post-entraînement", time: "18:30", items: [f("Whey protéine"), f("Dattes", 2)] },
    { name: "Dîner", time: "21:00", items: [f("Riz complet cuit", 1.5), f("Sardines grillées"), f("Huile d'olive")] },
  ];
  const meal_plans = [
    plan(C(0).id, "Sèche progressive – 1 900 kcal", "Perte de poids", 1900, 140, 190, 60, cutMeals),
    plan(C(2).id, "Prise de masse – 3 000 kcal", "Prise de masse", 3000, 170, 360, 90, bulkMeals),
    plan(null, "Modèle – Rééquilibrage marocain", "Santé", 2000, 110, 230, 65, cutMeals),
  ];

  /* ---------- Journal alimentaire (Karim, 5 derniers jours) ---------- */
  const food_logs: Row[] = [];
  for (let d = -4; d <= 0; d++) {
    const entries: [string, string, number][] = [
      ["Petit-déjeuner", "Flocons d'avoine", 1], ["Petit-déjeuner", "Lben / raïb", 1],
      ["Déjeuner", d % 2 ? "Tajine de poulet aux légumes" : "Couscous aux 7 légumes", 1], ["Déjeuner", "Pain khobz complet", 1],
      ["Collation", "Dattes", 1],
      ["Dîner", d === 0 ? "Harira" : "Œufs", 1],
    ];
    if (d === 0) entries.pop();
    entries.forEach(([meal, name, qty]) => {
      const x = f(name, qty);
      food_logs.push({ id: uid(), client_id: C(0).id, logged_on: day(d), meal, food_name: x.name, qty, kcal: x.kcal, protein: x.protein, carbs: x.carbs, fat: x.fat, water_ml: null, created_at: at(d, 12) });
    });
    food_logs.push({ id: uid(), client_id: C(0).id, logged_on: day(d), meal: "Eau", food_name: "Eau", qty: 1, kcal: 0, protein: 0, carbs: 0, fat: 0, water_ml: 1500 + ((d + 4) % 3) * 500, created_at: at(d, 18) });
  }

  /* ---------- Photos avant/après ---------- */
  const progress_photos: Row[] = [];
  [[0, 95], [6, 101], [1, 64]].forEach(([ci, w0]) => {
    const months = [-150, -90, -30, -2];
    months.forEach((back, k) => {
      (["face", "profil"] as const).forEach((pose) => {
        progress_photos.push({
          id: uid(), client_id: C(ci).id, taken_on: day(back), pose, storage_path: null,
          url: PHOTO(`moovup-${ci}-${k}-${pose}`), weight_kg: +(w0 - (ci === 1 ? 0.8 : 2.2) * k * 1.5).toFixed(1),
          notes: k === 0 ? "Photo de départ" : null, shared_publicly: ci === 0, created_by: ADMIN, created_at: day(back),
        });
      });
    });
  });

  /* ---------- Abonnements & passages ---------- */
  const pkg = (name: string) => packages.find((p) => p.name === name);
  const ms: [number, string, number, number][] = [
    [0, "Coaching 12 séances", -24, 6], [1, "Coaching 8 séances", -26, 4], [2, "Pack 3 mois premium", -60, 30],
    [3, "Coaching 8 séances", -10, 20], [4, "Abonnement mensuel salle", -45, -15], [5, "Coaching 8 séances", -20, 10], [6, "Abonnement mensuel salle", -25, 5],
  ];
  const memberships = ms.map(([ci, name, start, endIn]) => {
    const p = pkg(name);
    return {
      id: uid(), client_id: C(ci).id, package_id: p?.id ?? null, name, start_date: day(start), end_date: day(endIn),
      sessions_total: p?.sessions_count ?? null, sessions_used: p?.sessions_count ? Math.min(p.sessions_count, Math.round(((0 - start) / ((endIn - start) || 1)) * p.sessions_count)) : 0,
      price_mad: p?.price_mad ?? null, status: "actif", auto_renew: ci === 2, created_at: day(start),
    };
  });
  const gym_checkins: Row[] = [];
  clients.forEach((c, ci) => {
    if (c.status === "termine") return;
    for (let d = -20; d <= 0; d++) {
      if ((ci * 3 + d * 7 + 50) % (ci === 4 ? 9 : 3) !== 0) continue;
      if (c.status === "pause" && d > -14) continue;
      gym_checkins.push({ id: uid(), client_id: c.id, checked_at: at(d, 7 + ((ci * 5 + d + 40) % 13), (ci * 7) % 60), method: d % 4 === 0 ? "manuel" : "qr", created_by: ADMIN });
    }
  });

  /* ---------- Paiements en ligne ---------- */
  const paid = (db.invoices ?? []).filter((i) => i.status === "payee").slice(-3);
  const online_payments = paid.map((inv, i) => ({
    id: uid(), invoice_id: inv.id, client_id: inv.client_id, provider: i === 1 ? "cmi" : "stripe", provider_ref: `pi_demo_${i}`,
    amount_mad: inv.amount_mad, status: "reussi", created_at: at(-i - 1, 10), paid_at: at(-i - 1, 10, 2),
  }));

  /* ---------- WhatsApp ---------- */
  const whatsapp_messages = [
    [0, "session_reminder", "Bonjour Karim 👋 Petit rappel : ta séance est prévue demain à 07:00. À demain au Complexe Moov'Up !", -1, "simule"],
    [5, "invoice_overdue", "Bonjour Imane, voici un rappel pour la facture MU-2026-0031 d'un montant de 1 200 MAD. Merci !", -1, "simule"],
    [3, "checkin_missing", "Salut Nadia ! N'oublie pas ton check-in de la semaine sur l'app Moov'Up 💪", -2, "simule"],
    [4, "membership_expiring", "Bonjour Omar, ton abonnement Moov'Up a expiré. On te réserve une place ? 😊", -3, "simule"],
  ].map(([ci, template, body, d, status]) => ({
    id: uid(), client_id: C(ci as number).id, to_phone: C(ci as number).phone, template, body, status, error: null, provider_id: null, created_at: at(d as number, 18), sent_at: at(d as number, 18),
  }));

  /* ---------- Défis & badges ---------- */
  const monthStart = day(-new Date().getDate() + 1);
  const monthEnd = (() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10); })();
  const ch1 = { id: uid(), title: "Défi 12 présences", description: "Viens 12 fois à la salle ce mois-ci.", metric: "presences", unit: "passages", goal_value: 12, start_date: monthStart, end_date: monthEnd, reward: "1 séance de coaching offerte", cover: "🔥", created_by: ADMIN, created_at: monthStart };
  const ch2 = { id: uid(), title: "Roi du squat", description: "Meilleur squat (1RM) validé par un coach.", metric: "squat_kg", unit: "kg", goal_value: null, start_date: day(-20), end_date: day(10), reward: "T-shirt Moov'Up", cover: "🏋️", created_by: ADMIN, created_at: day(-20) };
  const ch3 = { id: uid(), title: "100 000 pas", description: "Cumule 100 000 pas sur 2 semaines.", metric: "pas", unit: "pas", goal_value: 100000, start_date: day(-6), end_date: day(8), reward: "Shaker + 1 mois de whey", cover: "👟", created_by: COACH, created_at: day(-6) };
  const challenges = [ch1, ch2, ch3];
  const challenge_entries: Row[] = [];
  const act = clients.filter((c) => c.status === "actif");
  act.forEach((c, i) => {
    challenge_entries.push({ id: uid(), challenge_id: ch1.id, client_id: c.id, value: gym_checkins.filter((g) => g.client_id === c.id && g.checked_at >= monthStart).length, updated_at: at(0, 9) });
    const sq = (db.measurements ?? []).filter((m) => m.client_id === c.id).at(-1)?.squat_kg ?? 40;
    challenge_entries.push({ id: uid(), challenge_id: ch2.id, client_id: c.id, value: sq, updated_at: at(-1, 9) });
    challenge_entries.push({ id: uid(), challenge_id: ch3.id, client_id: c.id, value: 38000 + ((i * 13711) % 52000), updated_at: at(0, 8) });
  });
  const badgeDefs: [number, string, string, number][] = [
    [0, "premiere_seance", "Première séance", -170], [0, "dix_seances", "10 séances", -120], [0, "cinquante_seances", "50 séances", -10],
    [0, "moins_5kg", "−5 kg", -60], [0, "regulier_4", "4 semaines d'affilée", -20], [2, "record_squat", "Record squat", -5],
    [1, "objectif_atteint", "Objectif atteint", -15], [2, "cinquante_seances", "50 séances", -30], [6, "moins_5kg", "−5 kg", -25],
  ];
  const badges = badgeDefs.map(([ci, code, label, d]) => ({ id: uid(), client_id: C(ci).id, code, label, earned_on: day(d) }));

  /* ---------- Cours collectifs ---------- */
  const monday = (new Date().getDay() + 6) % 7;
  const planning: [number, number, string, string, number, string, string][] = [
    [0, 7, "CrossFit WOD", "CrossFit", 14, ADMIN, "Box"], [0, 19, "HIIT Express", "HIIT", 16, COACH, "Studio 1"],
    [1, 9, "Yoga Flow", "Yoga", 12, COACH, "Studio 2"], [1, 18, "Renfo Fessiers-Abdos", "Renforcement", 15, COACH, "Studio 1"],
    [2, 7, "CrossFit WOD", "CrossFit", 14, ADMIN, "Box"], [2, 19, "Cardio Boxe", "Cardio", 16, ADMIN, "Studio 1"],
    [3, 9, "Pilates", "Pilates", 10, COACH, "Studio 2"], [3, 19, "HIIT Express", "HIIT", 16, COACH, "Studio 1"],
    [4, 7, "CrossFit WOD", "CrossFit", 14, ADMIN, "Box"], [4, 18, "Yoga Flow", "Yoga", 12, COACH, "Studio 2"],
    [5, 10, "Bootcamp plage", "Cardio", 20, ADMIN, "Plage d'Agadir"],
  ];
  const group_classes: Row[] = [];
  const class_bookings: Row[] = [];
  for (const w of [-1, 0, 1]) {
    planning.forEach(([d, h, title, category, capacity, coach, room], k) => {
      const offset = w * 7 + d - monday;
      const id = uid();
      group_classes.push({ id, title, category, coach_id: coach, starts_at: at(offset, h), duration_min: category === "Yoga" || category === "Pilates" ? 60 : 45, capacity, room, level: category === "CrossFit" ? "Intermédiaire" : "Tous niveaux", description: null, cancelled: false, created_at: day(-30) });
      const n = Math.min(capacity + (k % 3 === 0 ? 2 : 0), 3 + ((k * 5 + w * 3 + 21) % (capacity + 1)));
      const pool = act.concat(clients.filter((c) => c.status !== "actif")).filter((c) => c.id !== C(0).id || k % 4 === 1);
      const rot = pool.slice(k % pool.length).concat(pool.slice(0, k % pool.length));
      rot.slice(0, Math.min(n, pool.length)).forEach((c, j) => {
        const past = offset < 0 || (offset === 0 && h < 10);
        class_bookings.push({ id: uid(), class_id: id, client_id: c.id, status: j >= capacity ? "attente" : past ? (j % 5 === 4 ? "absent" : "present") : "inscrit", created_at: day(offset - 2) });
      });
    });
  }

  /* ---------- Vidéothèque ---------- */
  const E = (name: string, category: string, muscles: string[], equipment: string, level: string, video: string | null, instructions: string, tips: string) => ({
    id: uid(), name, category, muscles, equipment, level, video_url: video, instructions, tips, created_at: day(-100),
  });
  const exercises = [
    E("Squat barre", "Musculation", ["Quadriceps", "Fessiers", "Lombaires"], "Barre + rack", "Intermédiaire", "https://www.youtube.com/watch?v=ultWZbUMPL8", "Pieds largeur d'épaules, descends en poussant les hanches en arrière, garde le dos neutre, remonte en poussant dans les talons.", "Genoux dans l'axe des pieds. Regard droit devant."),
    E("Développé couché", "Musculation", ["Pectoraux", "Triceps", "Épaules"], "Barre + banc", "Intermédiaire", "https://www.youtube.com/watch?v=rT7DgCr-3pg", "Omoplates serrées, descends la barre au bas des pectoraux, pousse en expirant.", "Pieds ancrés au sol, ne décolle pas les fesses."),
    E("Soulevé de terre", "Musculation", ["Ischios", "Fessiers", "Dos"], "Barre", "Avancé", "https://www.youtube.com/watch?v=op9kVnSso6Q", "Barre au-dessus du milieu du pied, dos plat, pousse le sol avec les jambes puis verrouille les hanches.", "La barre reste collée aux jambes."),
    E("Fentes haltères", "Musculation", ["Quadriceps", "Fessiers"], "Haltères", "Débutant", null, "Grand pas en avant, descends le genou arrière près du sol, remonte en poussant sur le talon avant.", "Buste droit, genou avant au-dessus de la cheville."),
    E("Hip thrust", "Musculation", ["Fessiers", "Ischios"], "Barre + banc", "Débutant", null, "Dos appuyé sur le banc, pousse les hanches vers le haut en serrant les fessiers, contrôle la descente.", "Menton rentré, côtes basses."),
    E("Rowing barre", "Musculation", ["Dos", "Biceps"], "Barre", "Intermédiaire", null, "Buste penché à 45°, tire la barre vers le nombril en serrant les omoplates.", "Pas d'élan avec le dos."),
    E("Développé militaire", "Musculation", ["Épaules", "Triceps"], "Barre", "Intermédiaire", null, "Debout, gainé, pousse la barre au-dessus de la tête jusqu'à bras tendus.", "Serre les fessiers pour protéger le bas du dos."),
    E("Tractions", "Musculation", ["Dos", "Biceps"], "Barre de traction", "Avancé", "https://www.youtube.com/watch?v=eGo4IYlbE5g", "Mains en pronation, tire jusqu'à passer le menton au-dessus de la barre, redescends contrôlé.", "Utilise un élastique pour progresser."),
    E("Kettlebell swing", "Cardio", ["Fessiers", "Ischios", "Gainage"], "Kettlebell", "Intermédiaire", null, "Charnière de hanche, projette la kettlebell à hauteur d'épaules avec les hanches, pas avec les bras.", "Le mouvement vient des hanches."),
    E("Burpees", "Cardio", ["Corps entier"], "Aucun", "Tous niveaux", null, "Accroupi, saute en planche, pompe, ramène les pieds, saute bras en l'air.", "Garde le gainage en planche."),
    E("Gainage planche", "Gainage", ["Abdominaux", "Épaules"], "Aucun", "Débutant", null, "Avant-bras au sol, corps aligné de la tête aux talons, respire normalement.", "Ne creuse pas le dos."),
    E("Bird dog", "Mobilité", ["Lombaires", "Gainage"], "Tapis", "Débutant", null, "À quatre pattes, tends bras et jambe opposés, tiens 2 secondes, alterne.", "Bassin stable, mouvement lent."),
    E("Pont fessier", "Mobilité", ["Fessiers", "Lombaires"], "Tapis", "Débutant", null, "Allongé, pieds au sol, monte le bassin en serrant les fessiers.", "Idéal pour soulager le bas du dos."),
    E("Rameur", "Cardio", ["Corps entier"], "Rameur", "Tous niveaux", null, "Pousse avec les jambes, puis bascule le buste, puis tire les bras. Retour dans l'ordre inverse.", "Jambes 60 %, dos 20 %, bras 20 %."),
  ];

  /* ---------- Suivi de séance (Karim) ---------- */
  const prog = (db.programs ?? [])[0];
  const workout_logs = [-5, -3, -1].map((d, k) => ({
    id: uid(), client_id: C(0).id, program_id: prog?.id ?? null, day_title: prog?.days?.[k % (prog?.days?.length || 1)]?.title ?? "Séance",
    started_at: at(d, 7), finished_at: at(d, 8, 2),
    entries: [
      { exercise: "Squat barre", target: "4 × 8-10", sets: [0, 1, 2, 3].map((i) => ({ reps: 8 + (i < 2 ? 2 : 0), load: 80 + k * 2.5, done: true })) },
      { exercise: "Fentes haltères", target: "3 × 12", sets: [0, 1, 2].map(() => ({ reps: 12, load: 16, done: true })) },
      { exercise: "Gainage planche", target: "3 × 45 s", sets: [0, 1, 2].map((i) => ({ reps: "45 s", load: null, done: i < 2 || k > 0 })) },
    ],
    rpe: 7 + (k % 2), notes: k === 2 ? "Genou OK, bonne énergie." : null, created_at: at(d, 8),
  }));

  /* ---------- Parrainage ---------- */
  const hamza = (db.profiles ?? []).find((p) => p.full_name === "Hamza Berrada");
  void hamza;
  const referrals = [
    { referrer: 0, name: "Hamza Berrada", phone: "06 61 23 45 67", referred: null, status: "en_attente", reward: null, d: -3 },
    { referrer: 0, name: "Imane Chraibi", phone: C(5).phone, referred: C(5).id, status: "recompense", reward: 200, d: -25 },
    { referrer: 1, name: "Sofia Amrani", phone: "06 77 88 99 00", referred: null, status: "en_attente", reward: null, d: -8 },
    { referrer: 2, name: "Mehdi Alaoui", phone: C(6).phone, referred: C(6).id, status: "inscrit", reward: null, d: -40 },
  ].map((r) => ({ id: uid(), referrer_client_id: C(r.referrer).id, referred_name: r.name, referred_phone: r.phone, referred_client_id: r.referred, status: r.status, reward_mad: r.reward, created_at: day(r.d) }));

  /* ---------- Automatisations supplémentaires ---------- */
  const automations = db.automations ?? [];
  [["wa_session_reminder", { hours: 24 }, false], ["wa_invoice_overdue", { days: 3 }, false], ["wa_checkin_missing", { days: 7 }, false], ["membership_expiring", { days: 7 }, true]].forEach(([id, params, enabled]) => {
    if (!automations.find((a) => a.id === id)) automations.push({ id, params, enabled, last_run: null, last_count: null });
  });

  return {
    automations, foods, meal_plans, food_logs, progress_photos, memberships, gym_checkins, online_payments, whatsapp_messages,
    challenges, challenge_entries, badges, group_classes, class_bookings, exercises, workout_logs, referrals,
  };
}
