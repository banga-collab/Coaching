/* eslint-disable @typescript-eslint/no-explicit-any */
import { agadirToIso } from "./utils";

/** Données démo des modules phases 1 à 3 (évaluations, objectifs, programmes, factures…). */

type Row = Record<string, any>;
type DB = Record<string, Row[]>;

const ADMIN = "00000000-0000-4000-8000-000000000001";
const CLIENT_USER = "00000000-0000-4000-8000-000000000002";

const day = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};
const ts = (offset: number, hh = 10, mm = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return agadirToIso(d.toISOString().slice(0, 10), `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`);
};

export function seedExtra(base: DB, uid: () => string): DB {
  const clients = base.clients!;
  const C = (i: number) => clients[i]!;

  /* ---------- Paramètres ---------- */
  const settings = [
    {
      id: 1,
      brand_name: "Complexe Moov'Up Sports",
      app_name: "Moov'Up Coach",
      primary_color: "#1a6d8e",
      accent_color: "#e8782a",
      logo_url: null,
      phone: "05 28 00 00 00",
      whatsapp: "212600000000",
      email: "contact@moovup.ma",
      address: "Quartier Founty, Agadir",
      ice: "001234567000089",
      invoice_footer: "Merci pour votre confiance. Paiement à réception.",
      booking_enabled: true,
      booking_types: ["Séance découverte", "Bilan initial", "Coaching individuel"],
      booking_hours: { start: "08:00", end: "20:00", days: [1, 2, 3, 4, 5, 6], slot: 60 },
      calendar_token: "demo-calendar-token",
      webhook_url: null,
    },
  ];

  /* ---------- Évaluations ---------- */
  const tplPosture = {
    id: uid(),
    name: "Bilan postural",
    description: "Observation de la posture debout, de face et de profil.",
    category: "Posture",
    fields: [
      { id: "tete", label: "Position de la tête", type: "choice", options: ["Alignée", "Projetée en avant", "Inclinée"] },
      { id: "epaules", label: "Épaules", type: "choice", options: ["Équilibrées", "Enroulées", "Asymétriques"] },
      { id: "bassin", label: "Bascule du bassin", type: "choice", options: ["Neutre", "Antéversion", "Rétroversion"] },
      { id: "genoux", label: "Genoux en valgus", type: "yesno" },
      { id: "score", label: "Score global", type: "scale", help: "1 = très mauvais, 10 = excellent" },
      { id: "obs", label: "Observations", type: "text" },
    ],
    created_by: ADMIN,
    created_at: day(-120),
  };
  const tplCondition = {
    id: uid(),
    name: "Tests de condition physique",
    description: "Batterie de tests standard à refaire toutes les 6 semaines.",
    category: "Performance",
    fields: [
      { id: "pompes", label: "Pompes en 1 min", type: "number", unit: "reps" },
      { id: "gainage", label: "Gainage planche", type: "number", unit: "s" },
      { id: "squat_jump", label: "Squat jump", type: "number", unit: "cm" },
      { id: "cooper", label: "Test de Cooper (12 min)", type: "number", unit: "m" },
      { id: "souplesse", label: "Flexion avant (doigts-sol)", type: "number", unit: "cm" },
      { id: "ressenti", label: "Ressenti global", type: "scale" },
    ],
    created_by: ADMIN,
    created_at: day(-150),
  };
  const tplNutrition = {
    id: uid(),
    name: "Habitudes alimentaires",
    description: "Questionnaire rapide sur l'alimentation et l'hydratation.",
    category: "Nutrition",
    fields: [
      { id: "repas", label: "Repas par jour", type: "number" },
      { id: "eau", label: "Eau par jour", type: "number", unit: "L" },
      { id: "petitdej", label: "Prend un petit-déjeuner", type: "yesno" },
      { id: "sucre", label: "Consommation de sucre", type: "choice", options: ["Faible", "Modérée", "Élevée"] },
      { id: "qualite", label: "Qualité perçue", type: "scale" },
    ],
    created_by: ADMIN,
    created_at: day(-90),
  };
  const assessment_templates = [tplCondition, tplPosture, tplNutrition];

  const assessments: Row[] = [];
  [0, 1, 2, 6].forEach((ci, n) => {
    for (let k = 0; k < 3; k++) {
      const back = (2 - k) * 42;
      assessments.push({
        id: uid(),
        client_id: C(ci).id,
        template_id: tplCondition.id,
        template_name: tplCondition.name,
        fields: tplCondition.fields,
        answers: {
          pompes: 18 + n * 4 + k * 5,
          gainage: 45 + n * 10 + k * 15,
          squat_jump: 28 + n * 2 + k * 3,
          cooper: 1900 + n * 120 + k * 150,
          souplesse: -6 + k * 3,
          ressenti: 6 + k,
        },
        score: 6 + k,
        notes: k === 2 ? "Belle progression sur le gainage et l'endurance." : null,
        done_on: day(-back - 3),
        created_by: C(ci).coach_id,
        created_at: day(-back - 3),
      });
    }
  });
  assessments.push({
    id: uid(),
    client_id: C(0).id,
    template_id: tplPosture.id,
    template_name: tplPosture.name,
    fields: tplPosture.fields,
    answers: { tete: "Projetée en avant", epaules: "Enroulées", bassin: "Antéversion", genoux: true, score: 6, obs: "Travail de mobilité thoracique et renforcement des fessiers." },
    score: 6,
    notes: null,
    done_on: day(-60),
    created_by: ADMIN,
    created_at: day(-60),
  });

  /* ---------- Objectifs ---------- */
  const goals = [
    { client: 0, title: "Descendre à 82 kg", metric: "weight_kg", unit: "kg", start: 95, target: 82, due: 45 },
    { client: 0, title: "Squat à 120 kg", metric: "squat_kg", unit: "kg", start: 80, target: 120, due: 90 },
    { client: 0, title: "Courir 5 km sans s'arrêter", metric: "custom", unit: "km", start: 1, target: 5, current: 3.5, due: 30 },
    { client: 1, title: "Masse grasse sous 22 %", metric: "body_fat", unit: "%", start: 27, target: 22, due: 60 },
    { client: 2, title: "Développé couché 100 kg", metric: "bench_kg", unit: "kg", start: 80, target: 100, due: 75 },
    { client: 2, title: "Prendre 6 kg", metric: "weight_kg", unit: "kg", start: 72, target: 78, due: 120 },
    { client: 3, title: "Tour de taille sous 90 cm", metric: "waist_cm", unit: "cm", start: 97, target: 90, due: 90 },
    { client: 6, title: "Perdre 15 kg", metric: "weight_kg", unit: "kg", start: 101, target: 86, due: 150 },
    { client: 1, title: "10 séances ce mois-ci", metric: "sessions", unit: "séances", start: 0, target: 10, due: 13 },
  ].map((g, i) => ({
    id: uid(),
    client_id: C(g.client).id,
    title: g.title,
    metric: g.metric,
    unit: g.unit,
    start_value: g.start,
    target_value: g.target,
    current_value: (g as any).current ?? null,
    due_date: day(g.due),
    status: i === 3 ? "atteint" : "en_cours",
    created_at: day(-100 + i * 5),
  }));

  /* ---------- Documents ---------- */
  const documents = [
    [0, "Certificat médical 2026.pdf", "Certificat médical", 182_000, "application/pdf"],
    [0, "Programme bloc 3.pdf", "Programme", 96_000, "application/pdf"],
    [0, "Photo face – septembre.jpg", "Photo", 1_420_000, "image/jpeg"],
    [1, "Certificat médical.pdf", "Certificat médical", 150_000, "application/pdf"],
    [2, "Contrat coaching 6 mois.pdf", "Contrat", 210_000, "application/pdf"],
    [3, "Ordonnance kiné.pdf", "Bilan", 88_000, "application/pdf"],
  ].map(([ci, name, category, size, mime], i) => ({
    id: uid(),
    client_id: C(ci as number).id,
    name,
    category,
    storage_path: null,
    size_bytes: size,
    mime,
    shared: i !== 5,
    created_by: ADMIN,
    created_at: day(-80 + i * 9),
  }));

  /* ---------- Programmes ---------- */
  const progFatLoss = {
    id: uid(),
    name: "Perte de poids – 8 semaines",
    description: "3 séances par semaine : force + conditionnement métabolique.",
    goal: "Perte de poids",
    level: "Débutant",
    weeks: 8,
    days: [
      { title: "Jour A – Bas du corps", focus: "Force", exercises: [
        { name: "Squat barre", sets: 4, reps: "8-10", load: "70 %", rest: "90 s" },
        { name: "Fentes haltères", sets: 3, reps: "12/jambe", rest: "60 s" },
        { name: "Hip thrust", sets: 3, reps: "12", rest: "60 s" },
        { name: "Gainage planche", sets: 3, reps: "45 s", rest: "30 s" },
      ] },
      { title: "Jour B – Circuit métabolique", focus: "Cardio", exercises: [
        { name: "Kettlebell swing", sets: 5, reps: "15", rest: "30 s" },
        { name: "Burpees", sets: 5, reps: "10", rest: "30 s" },
        { name: "Rameur", sets: 5, reps: "250 m", rest: "60 s" },
      ] },
      { title: "Jour C – Haut du corps", focus: "Force", exercises: [
        { name: "Développé couché", sets: 4, reps: "8-10", load: "70 %", rest: "90 s" },
        { name: "Rowing barre", sets: 4, reps: "10", rest: "75 s" },
        { name: "Développé militaire", sets: 3, reps: "10", rest: "60 s" },
        { name: "Tractions assistées", sets: 3, reps: "8", rest: "60 s" },
      ] },
    ],
    created_by: ADMIN,
    created_at: day(-140),
  };
  const progMass = {
    id: uid(),
    name: "Prise de masse – Push / Pull / Legs",
    description: "Hypertrophie, 4 à 6 séances par semaine, progression linéaire.",
    goal: "Prise de masse",
    level: "Avancé",
    weeks: 12,
    days: [
      { title: "Push", focus: "Pectoraux, épaules, triceps", exercises: [
        { name: "Développé couché", sets: 5, reps: "5", load: "80 %", rest: "2 min" },
        { name: "Développé incliné haltères", sets: 4, reps: "10", rest: "90 s" },
        { name: "Élévations latérales", sets: 4, reps: "15", rest: "45 s" },
        { name: "Dips", sets: 3, reps: "max", rest: "90 s" },
      ] },
      { title: "Pull", focus: "Dos, biceps", exercises: [
        { name: "Soulevé de terre", sets: 5, reps: "5", load: "80 %", rest: "2 min" },
        { name: "Tractions", sets: 4, reps: "8", rest: "90 s" },
        { name: "Rowing barre", sets: 4, reps: "10", rest: "90 s" },
        { name: "Curl biceps", sets: 3, reps: "12", rest: "60 s" },
      ] },
      { title: "Legs", focus: "Jambes", exercises: [
        { name: "Squat barre", sets: 5, reps: "5", load: "80 %", rest: "2 min" },
        { name: "Presse à cuisses", sets: 4, reps: "12", rest: "90 s" },
        { name: "Leg curl", sets: 4, reps: "12", rest: "60 s" },
      ] },
    ],
    created_by: ADMIN,
    created_at: day(-130),
  };
  const progMobility = {
    id: uid(),
    name: "Santé du dos & mobilité",
    description: "Programme doux pour soulager le bas du dos et retrouver de la mobilité.",
    goal: "Santé & mobilité",
    level: "Débutant",
    weeks: 6,
    days: [
      { title: "Séance mobilité", focus: "Colonne et hanches", exercises: [
        { name: "Chat-vache", sets: 2, reps: "10" },
        { name: "Bird dog", sets: 3, reps: "8/côté" },
        { name: "Pont fessier", sets: 3, reps: "12" },
        { name: "Étirement psoas", sets: 2, reps: "30 s/côté" },
      ] },
      { title: "Renforcement doux", focus: "Gainage", exercises: [
        { name: "Dead bug", sets: 3, reps: "10" },
        { name: "Gainage latéral", sets: 3, reps: "20 s/côté" },
        { name: "Marche rapide tapis", sets: 1, reps: "15 min" },
      ] },
    ],
    created_by: "00000000-0000-4000-8000-000000000003",
    created_at: day(-100),
  };
  const programs = [progFatLoss, progMass, progMobility];
  const client_programs = [
    [0, progFatLoss, -50],
    [6, progFatLoss, -60],
    [2, progMass, -35],
    [3, progMobility, -40],
    [5, progMobility, -20],
  ].map(([ci, p, start]) => ({ id: uid(), client_id: C(ci as number).id, program_id: (p as Row).id, start_date: day(start as number), status: "actif", created_at: day(start as number) }));

  /* ---------- Tâches ---------- */
  const tasks = [
    { t: "Appeler Nadia pour adapter ses séances (dos)", c: 3, due: 0, p: "haute", src: "manuel" },
    { t: "Préparer le programme bloc 4 de Karim", c: 0, due: 2, p: "normale", src: "manuel" },
    { t: "Relancer Omar (en pause depuis 3 semaines)", c: 4, due: -1, p: "normale", src: "auto:inactive_client" },
    { t: "Bilan mensuel à faire : Mehdi Alaoui", c: 6, due: 1, p: "normale", src: "auto:health_check_due" },
    { t: "Commander des kettlebells 16 kg", c: null, due: 5, p: "basse", src: "manuel" },
    { t: "Envoyer le rapport mensuel à Salma", c: 1, due: -3, p: "normale", src: "manuel", done: true },
  ].map((x, i) => ({
    id: uid(),
    title: x.t,
    notes: null,
    client_id: x.c === null ? null : C(x.c).id,
    assigned_to: ADMIN,
    due_date: day(x.due),
    priority: x.p,
    done: !!x.done,
    done_at: x.done ? ts(-3) : null,
    source: x.src,
    created_by: ADMIN,
    created_at: day(-10 + i),
  }));

  /* ---------- Messages ---------- */
  const conv: [number, boolean, string, number, number][] = [
    [0, false, "Salut Karim ! Super séance hier, on monte le squat à 105 kg jeudi 💪", -3, 9],
    [0, true, "Merci coach ! Le genou a bien tenu. Je peux faire du vélo le week-end ?", -3, 12],
    [0, false, "Oui, 30-40 min tranquille, c'est parfait pour la récupération.", -3, 13],
    [0, true, "Top. Je serai là jeudi à 7h.", -1, 20],
    [1, true, "Bonjour, je pourrai décaler mardi à 19h30 ?", -2, 18],
    [1, false, "Pas de souci Salma, c'est noté pour 19h30.", -2, 19],
    [3, true, "J'ai encore mal au bas du dos ce matin…", 0, 8],
    [2, false, "Youssef, pense à prendre tes mensurations samedi.", -5, 11],
    [2, true, "Ok coach 👍", -5, 14],
  ];
  const messages = conv.map(([ci, fromClient, body, d, h]) => ({
    id: uid(),
    client_id: C(ci).id,
    sender_id: fromClient ? (ci === 0 ? CLIENT_USER : null) : C(ci).coach_id,
    from_client: fromClient,
    body,
    read_at: fromClient && d === 0 ? null : fromClient && ci === 0 && d === -1 ? null : ts(d, h + 1),
    created_at: ts(d, h),
  }));

  /* ---------- Notifications ---------- */
  const notifications = [
    { u: ADMIN, t: "Nouveau message de Nadia Ouhammou", b: "J'ai encore mal au bas du dos ce matin…", l: `/messages?client=${C(3).id}`, k: "message", r: false, d: 0 },
    { u: ADMIN, t: "Nouvelle demande de réservation", b: "Hamza Berrada – Séance découverte", l: "/reservations", k: "reservation", r: false, d: 0 },
    { u: ADMIN, t: "Séance réalisée", b: "Salma Bennani – Séance privée", l: `/clients/${C(1).id}?tab=seances`, k: "info", r: false, d: -1 },
    { u: ADMIN, t: "Alerte santé : tension élevée", b: "Nadia Ouhammou – 14/9", l: `/clients/${C(3).id}?tab=sante`, k: "alerte", r: true, d: -2 },
    { u: ADMIN, t: "Objectif atteint 🎉", b: "Salma Bennani – Masse grasse sous 22 %", l: `/clients/${C(1).id}?tab=objectifs`, k: "info", r: true, d: -4 },
    { u: CLIENT_USER, t: "Nouveau message de ton coach", b: "Oui, 30-40 min tranquille…", l: "/moi/messages", k: "message", r: false, d: -3 },
    { u: CLIENT_USER, t: "Nouveau programme disponible", b: "Perte de poids – 8 semaines", l: "/moi?tab=programme", k: "info", r: true, d: -50 },
  ].map((n) => ({ id: uid(), user_id: n.u, title: n.t, body: n.b, link: n.l, kind: n.k, read: n.r, created_at: ts(n.d, 9) }));

  /* ---------- Formules & factures ---------- */
  const pk = (name: string, price: number, sessions: number | null, days: number | null, description: string) => ({ id: uid(), name, description, price_mad: price, sessions_count: sessions, duration_days: days, active: true, created_at: day(-200) });
  const packages = [
    pk("Coaching 8 séances", 1200, 8, 30, "2 séances par semaine pendant 1 mois"),
    pk("Coaching 12 séances", 1650, 12, 30, "3 séances par semaine pendant 1 mois"),
    pk("Abonnement mensuel salle", 350, null, 30, "Accès illimité à la salle"),
    pk("Bilan complet", 300, 1, null, "Bilan santé + tests + programme"),
    pk("Pack 3 mois premium", 4200, 36, 90, "Coaching 3x/semaine + suivi nutrition"),
  ];
  const invoices: Row[] = [];
  let n = 1;
  const plan: [number, number, number][] = [
    [0, 1, 0], [1, 0, 0], [2, 4, 0], [3, 0, 0], [5, 0, 0], [6, 1, 0],
  ];
  for (let m = 5; m >= 0; m--) {
    plan.forEach(([ci, pi], k) => {
      const client = C(ci);
      if (ci === 2 && m % 3 !== 0) return; // pack 3 mois
      if (ci === 5 && m > 1) return; // nouvelle cliente
      if (ci === 3 && m > 2) return;
      const p = packages[pi]!;
      const issued = -30 * m - 3 - k;
      const isLatest = m === 0;
      const status = isLatest && ci === 5 ? "envoyee" : isLatest && ci === 6 ? "envoyee" : "payee";
      invoices.push({
        id: uid(),
        number: `MU-2026-${String(n++).padStart(4, "0")}`,
        client_id: client.id,
        package_id: p.id,
        lines: [{ label: p.name, qty: 1, unit_price: p.price_mad }],
        amount_mad: p.price_mad,
        issued_on: day(issued),
        due_on: day(issued + 7),
        status,
        paid_on: status === "payee" ? day(issued + 2) : null,
        method: status === "payee" ? ["Espèces", "Carte", "Virement"][(k + m) % 3] : null,
        notes: null,
        created_by: client.coach_id,
        created_at: day(issued),
      });
    });
  }

  /* ---------- Réservations ---------- */
  const booking_requests = [
    { full_name: "Hamza Berrada", phone: "06 61 23 45 67", email: "hamza@example.com", type: "Séance découverte", wanted_at: ts(2, 18), message: "Je veux reprendre le sport après 2 ans d'arrêt.", status: "nouvelle", d: 0 },
    { full_name: "Fatima Zahra Lahlou", phone: "06 70 11 22 33", email: null, type: "Bilan initial", wanted_at: ts(3, 10), message: null, status: "nouvelle", d: -1 },
    { full_name: "Rachid Amine", phone: "06 55 44 33 22", email: "rachid@example.com", type: "Coaching individuel", wanted_at: ts(-2, 19), message: "Préparation marathon d'Agadir.", status: "confirmee", d: -4 },
  ].map((b) => ({ id: uid(), full_name: b.full_name, phone: b.phone, email: b.email, type: b.type, wanted_at: b.wanted_at, message: b.message, status: b.status, session_id: null, created_at: ts(b.d, 11) }));

  /* ---------- Automatisations ---------- */
  const automations = [
    { id: "checkin_reminder", enabled: true, params: { days: 7 }, last_run: ts(0, 7), last_count: 2 },
    { id: "health_check_due", enabled: true, params: { days: 30 }, last_run: ts(0, 7), last_count: 1 },
    { id: "absence_followup", enabled: true, params: { count: 2 }, last_run: ts(0, 7), last_count: 0 },
    { id: "goal_reached", enabled: true, params: {}, last_run: ts(0, 7), last_count: 0 },
    { id: "inactive_client", enabled: false, params: { days: 14 }, last_run: null, last_count: null },
  ];

  return {
    settings,
    assessment_templates,
    assessments,
    goals,
    documents,
    programs,
    client_programs,
    tasks,
    messages,
    notifications,
    packages,
    invoices,
    booking_requests,
    automations,
  };
}
