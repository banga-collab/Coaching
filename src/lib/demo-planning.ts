/* eslint-disable @typescript-eslint/no-explicit-any */
/** Données de démo du module planning (V5) : disponibilités, congés, répartition des clients et cycle des séances. */
import { agadirToIso, isoToAgadir } from "./utils";

type Row = Record<string, any>;
type DB = Record<string, Row[]>;

const ADMIN = "00000000-0000-4000-8000-000000000001";
const SARA = "00000000-0000-4000-8000-000000000003";
const RACHID = "00000000-0000-4000-8000-000000000004";
const ANAS = "00000000-0000-4000-8000-000000000005";

/** Date AAAA-MM-JJ (Agadir) décalée de n jours par rapport à aujourd'hui */
function dayFromToday(n: number) {
  const today = isoToAgadir(new Date().toISOString()).date;
  const d = new Date(`${today}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const plusMin = (iso: string, min: number) => new Date(new Date(iso).getTime() + min * 60000).toISOString();

export function seedPlanning(db: DB, uid: () => string): DB {
  const clients = db.clients ?? [];
  const sessions = db.sessions ?? [];
  const now = Date.now();

  /* ---- 1. Répartition : 2 clients à Anas, 1 à Rachid ---- */
  const move: Record<string, string> = { "Salma Bennani": ANAS, "Mehdi Alaoui": ANAS, "Youssef Ait Lahcen": RACHID };
  for (const c of clients) {
    const to = move[c.full_name];
    if (!to) continue;
    c.coach_id = to;
    for (const s of sessions) if (s.client_id === c.id) s.coach_id = to;
  }

  /* ---- 1 bis. Pas de chevauchement avec les cours collectifs du même coach ----
     Yassine anime le « CrossFit WOD » lun/mer/ven à 07:00 : les séances privées de Karim passent à 08:00.
     Sara anime « Pilates » le jeudi à 09:00 : les séances de Nadia passent de 09:30 à 10:30. */
  const shiftClient = (name: string, fromTime: string, min: number) => {
    const c = clients.find((x) => x.full_name === name);
    if (!c) return;
    for (const s of sessions) if (s.client_id === c.id && isoToAgadir(s.starts_at).time === fromTime) s.starts_at = plusMin(s.starts_at, min);
  };
  shiftClient("Karim El Amrani", "07:00", 60);
  shiftClient("Nadia Ouhammou", "09:30", 60);

  /* ---- 2. Disponibilités hebdomadaires (1 = lundi … 7 = dimanche) ---- */
  const coach_availability: Row[] = [];
  const add = (coach_id: string, days: number[], start_time: string, end_time: string) => {
    for (const weekday of days) coach_availability.push({ id: uid(), coach_id, weekday, start_time, end_time, created_at: new Date(now - 30 * 86400000).toISOString() });
  };
  const monSat = [1, 2, 3, 4, 5, 6];
  add(ADMIN, monSat, "07:00", "13:00");
  add(ADMIN, [1, 2, 3, 4, 5], "17:00", "20:00");
  add(RACHID, monSat, "09:00", "12:00");
  add(RACHID, [1, 2, 3, 4, 5], "17:00", "21:00");
  // Sara ne travaille pas le mercredi ; le soir jusqu'à 20:00 (cours « HIIT Express » lun/jeu 19:00–19:45)
  add(SARA, [1, 2, 4, 5], "08:00", "12:00");
  add(SARA, [1, 2, 4, 5], "16:00", "20:00");
  add(SARA, [6], "09:00", "12:00");
  add(ANAS, monSat, "12:00", "14:00");
  add(ANAS, [1, 2, 3, 4, 5], "18:00", "21:30");

  /* ---- 3. Un congé : Anas en formation la semaine après la prochaine (mer → ven) ---- */
  const todayDate = dayFromToday(0);
  const wd = ((new Date(`${todayDate}T12:00:00Z`).getUTCDay() + 6) % 7) + 1; // 1 = lundi
  const nextNextMonday = 15 - wd; // décalage (en jours) jusqu'au lundi de la semaine S+2
  const coach_time_off: Row[] = [
    { id: uid(), coach_id: ANAS, starts_on: dayFromToday(nextNextMonday + 2), ends_on: dayFromToday(nextNextMonday + 4), reason: "Formation boxe – certification", created_at: new Date(now - 5 * 86400000).toISOString() },
  ];

  /* ---- 4. Cycle des séances ---- */
  // Date de création réaliste (quelques jours avant la séance, jamais dans le futur)
  for (const s of sessions) s.created_at = new Date(Math.min(new Date(s.starts_at).getTime() - 5 * 86400000, now - 3 * 86400000)).toISOString();
  // Séances passées réalisées : heures réelles
  for (const s of sessions) {
    if (s.status === "realisee") {
      const late = ((s.rpe ?? 6) % 3) * 2; // 0 à 4 min de retard
      s.started_at = plusMin(s.starts_at, late);
      s.ended_at = plusMin(s.starts_at, late + s.duration_min + (((s.rpe ?? 6) % 2) ? 5 : -3));
      s.responded_at = plusMin(s.starts_at, -3 * 24 * 60);
      s.assigned_by = s.coach_id === RACHID || s.coach_id === ADMIN ? null : RACHID;
    }
  }

  // Séances futures : acceptées, sauf quelques cas pour montrer le cycle
  const future = sessions.filter((s) => s.status === "planifiee" && new Date(s.starts_at).getTime() > now).sort((a, b) => (a.starts_at < b.starts_at ? -1 : 1));
  for (const s of future) {
    s.status = "acceptee";
    s.assigned_by = s.coach_id === ADMIN ? null : RACHID;
    s.responded_at = new Date(now - 2 * 86400000).toISOString();
  }
  const pick = (coach: string, skip = 0) => future.filter((s) => s.coach_id === coach && s.status === "acceptee")[skip];
  const awaiting = [pick(SARA, 0), pick(SARA, 2), pick(ANAS, 0), pick(ANAS, 3)].filter(Boolean) as Row[];
  for (const s of awaiting) {
    s.status = "planifiee";
    s.assigned_by = RACHID;
    s.responded_at = null;
  }
  // Report proposé par le coach de Karim (adhérent de démo) : visible côté /moi
  const karim = clients.find((c) => c.user_id === "00000000-0000-4000-8000-000000000002");
  const rep = future.find((s) => s.client_id === karim?.id && s.status === "acceptee" && new Date(s.starts_at).getTime() > now + 36 * 3600000);
  if (rep) {
    const { date } = isoToAgadir(rep.starts_at);
    rep.status = "reportee";
    rep.assigned_by = RACHID;
    rep.responded_at = new Date(now - 6 * 3600000).toISOString();
    rep.proposed_at = agadirToIso(date, "10:00"); // même jour, 10:00 (dans les créneaux de Yassine, libre)
    rep.response_note = "Rendez-vous en début de matinée, je propose 10h au lieu de 8h.";
  }
  // Un refus (Anas) à réaffecter
  const ref = pick(ANAS, 1);
  if (ref) {
    ref.status = "refusee";
    ref.assigned_by = RACHID;
    ref.responded_at = new Date(now - 20 * 3600000).toISOString();
    ref.response_note = "Indisponible : rendez-vous médical ce jour-là.";
  }

  /* ---- 5. Une séance aujourd'hui pour Sara (boutons Démarrer / Terminer) ---- */
  const imane = clients.find((c) => c.full_name === "Imane Chraibi");
  if (imane && [1, 2, 4, 5].includes(wd)) {
    const startsAt = agadirToIso(todayDate, "17:00");
    const clash = sessions.some((s) => s.coach_id === SARA && Math.abs(new Date(s.starts_at).getTime() - new Date(startsAt).getTime()) < 60 * 60000);
    if (!clash) {
      sessions.push({
        id: uid(),
        client_id: imane.id,
        coach_id: SARA,
        starts_at: startsAt,
        duration_min: 45,
        type: "Mobilité & gainage",
        status: "acceptee",
        rpe: null,
        notes: null,
        assigned_by: RACHID,
        responded_at: new Date(now - 86400000).toISOString(),
        created_at: new Date(now - 2 * 86400000).toISOString(),
      });
    }
  }

  /* ---- 6. Une séance oubliée (« À clôturer ») : la dernière séance passée de Karim n'a jamais été démarrée ---- */
  const forgot = sessions
    .filter((s) => s.client_id === karim?.id && s.status === "realisee" && new Date(s.starts_at).getTime() < now - 3 * 3600000 && new Date(s.starts_at).getTime() > now - 4 * 86400000)
    .sort((a, b) => (a.starts_at < b.starts_at ? 1 : -1))[0];
  if (forgot) {
    forgot.status = "acceptee";
    forgot.started_at = null;
    forgot.ended_at = null;
    forgot.rpe = null;
    forgot.notes = null;
  }

  /* ---- 7. Réservation en ligne « confirmée » : sa séance existe (client créé, séance réalisée avec Rachid) ---- */
  const bookings = db.booking_requests ?? [];
  for (const b of bookings.filter((x) => x.status === "confirmee" && !x.session_id)) {
    let client = clients.find((c) => c.full_name === b.full_name);
    if (!client) {
      client = {
        id: uid(),
        coach_id: RACHID,
        user_id: null,
        full_name: b.full_name,
        email: b.email,
        phone: b.phone,
        birth_date: null,
        sex: null,
        height_cm: null,
        goal: "Préparation marathon",
        frequency: "2x/semaine",
        status: "actif",
        start_date: String(b.wanted_at).slice(0, 10),
        notes: `Créé depuis une réservation en ligne (${b.type})${b.message ? ` — « ${b.message} »` : ""}`,
        created_at: b.created_at,
      };
      clients.push(client);
    }
    const past = new Date(b.wanted_at).getTime() < now;
    const id = uid();
    sessions.push({
      id,
      client_id: client.id,
      coach_id: client.coach_id ?? RACHID,
      starts_at: b.wanted_at,
      duration_min: 60,
      type: b.type,
      status: past ? "realisee" : "acceptee",
      rpe: past ? 6 : null,
      notes: b.message ? `Réservation en ligne : ${b.message}` : "Réservation en ligne",
      assigned_by: RACHID,
      responded_at: b.created_at,
      started_at: past ? b.wanted_at : null,
      ended_at: past ? plusMin(b.wanted_at, 60) : null,
      created_at: b.created_at,
    });
    b.session_id = id;
  }

  // Types de séance (liste gérée, modifiable dans Séances → Types de séance) avec un prix INDICATIF (DH)
  const typeNames: [string, number | null, number | null][] = [
    ["Musculation – Haut du corps", 60, 300], ["Musculation – Bas du corps", 60, 300], ["Musculation – Full body", 60, 300],
    ["Cardio / HIIT", 45, 250], ["Circuit training", 45, 250], ["Mobilité & gainage", 45, 250], ["Renforcement doux", 45, 250],
    ["Préparation physique", 60, 350], ["Évaluation / tests", 60, 200], ["Boxe", 60, 300], ["Pilates", 45, 250], ["Stretching", 30, 150],
    ["Séance duo", 60, 400], ["Séance découverte", 60, 200], ["Bilan initial", 60, 200], ["Coaching individuel", 60, 300],
  ];
  const session_types = typeNames.map(([name, duration_min, price_mad], position) => ({ id: uid(), name, duration_min, price_mad, color: null, active: true, position, created_at: new Date(now).toISOString() }));
  // Prix indicatif de chaque séance (selon son type ; 300 DH par défaut)
  const priceOf = new Map(typeNames.map(([name, , price]) => [name, price]));
  for (const s of sessions) if (s.price_mad === undefined || s.price_mad === null) s.price_mad = priceOf.get(s.type) ?? 300;
  return { coach_availability, coach_time_off, session_types };
}
