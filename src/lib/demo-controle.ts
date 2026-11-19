/** Démo : Moov'Up Lady (Sara + Houda), pointages à la borne et avis des clientes */
type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
type DB = Record<string, Row[]>;
import { dayKey } from "./utils";

const SARA = "00000000-0000-4000-8000-000000000003";
export const DEMO_HOUDA = "00000000-0000-4000-8000-000000000006";
export const DEMO_LADY_CLIENT = "00000000-0000-4000-8000-000000000007";

export function seedControle(db: DB, uid: () => string): DB {
  const profiles: Row[] = (db.profiles ?? []).map((p) => ({ ...p, espace: p.id === SARA ? "lady" : (p.espace ?? "mixte") }));
  profiles.push(
    { id: DEMO_HOUDA, full_name: "Houda Benali", email: "houda@moovup.ma", role: "coach", created_at: new Date(Date.now() - 80 * 86400000).toISOString(), phone: "06 61 00 00 06", active: true, coach_pct: 0, sales_pct: 0, specialties: ["Pilates", "Cardio"], espace: "lady" },
    { id: DEMO_LADY_CLIENT, full_name: "Imane Chraibi", email: "imane@example.com", role: "client", created_at: new Date(Date.now() - 100 * 86400000).toISOString() },
  );
  const clients = (db.clients ?? []).map((c) => ({ ...c }));
  const sessions = (db.sessions ?? []).map((s) => ({ ...s }));
  const imane = clients.find((c) => c.full_name === "Imane Chraibi");
  if (imane) imane.user_id = DEMO_LADY_CLIENT;
  // Salma passe chez Houda (avec ses séances)
  const salma = clients.find((c) => c.full_name === "Salma Bennani");
  if (salma) {
    salma.coach_id = DEMO_HOUDA;
    for (const s of sessions) if (s.client_id === salma.id) s.coach_id = DEMO_HOUDA;
  }
  const now = Date.now();
  const iso = (t: number) => new Date(t).toISOString();
  const H = 3600000;
  // Séances d'aujourd'hui
  const ladyClients = clients.filter((c) => c.coach_id === SARA || c.coach_id === DEMO_HOUDA);
  const add = (coach: string, client: Row | undefined, t: number, status: string, type: string) => {
    if (!client) return;
    sessions.push({ id: uid(), client_id: client.id, coach_id: coach, starts_at: iso(t), duration_min: 60, type, status, rpe: null, notes: null, created_at: iso(t - 48 * H), started_at: status === "realisee" ? iso(t) : null, ended_at: status === "realisee" ? iso(t + H) : null, responded_at: iso(t - 24 * H), price_mad: 300 });
  };
  const today0 = now - 2.5 * H;
  add(SARA, imane, today0, "realisee", "Coaching individuel");
  add(SARA, ladyClients.find((c) => c.coach_id === SARA && c !== imane), now + 1.5 * H, "acceptee", "Mobilité");
  add(DEMO_HOUDA, salma, now - 1.5 * H, "realisee", "Pilates");
  add(DEMO_HOUDA, salma, now + 2 * H, "acceptee", "Cardio / HIIT");

  const pointages: Row[] = [];
  const feedback: Row[] = [];
  const lady = sessions.filter((s) => (s.coach_id === SARA || s.coach_id === DEMO_HOUDA) && now - new Date(s.starts_at).getTime() < 30 * 86400000 && new Date(s.starts_at).getTime() <= now + 6 * H);
  const days = new Map<string, Row[]>();
  for (const s of lady) {
    if (s.status === "annulee" || s.status === "refusee") continue;
    const k = `${s.coach_id}|${dayKey(s.starts_at)}`;
    days.set(k, [...(days.get(k) ?? []), s]);
  }
  const todayKey = dayKey(new Date());
  let n = 0;
  for (const [k, list] of days) {
    const [coach, day] = k.split("|");
    list.sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    const first = new Date(list[0]!.starts_at).getTime();
    const last = new Date(list.at(-1)!.starts_at).getTime() + 60 * 60000;
    if (day === todayKey) {
      if (coach === SARA) pointages.push({ id: uid(), coach_id: coach, espace: "lady", kind: "arrivee", at: iso(first - 12 * 60000), method: "qr", created_at: iso(first) });
      continue; // Houda n'a pas pointé aujourd'hui
    }
    if (first > now) continue;
    n++;
    if (coach === DEMO_HOUDA && n % 5 === 0) continue; // jour sans pointage
    const late = coach === DEMO_HOUDA && n % 4 === 1 ? 25 : -(8 + (n % 7));
    pointages.push({ id: uid(), coach_id: coach, espace: "lady", kind: "arrivee", at: iso(first + late * 60000), method: n % 2 ? "qr" : "code", created_at: iso(first) });
    pointages.push({ id: uid(), coach_id: coach, espace: "lady", kind: "depart", at: iso(last + 10 * 60000), method: "code", created_at: iso(last) });
  }
  // Avis des clientes (sauf la séance du jour d'Imane, à confirmer dans la démo)
  let i = 0;
  const comments = ["Super séance, très motivante !", "Coach à l'écoute, merci.", null, null, "Bonne séance."];
  for (const s of lady.filter((x) => x.status === "realisee" && now - new Date(x.starts_at).getTime() > 20 * H)) {
    i++;
    if (i % 4 === 0) continue; // sans réponse
    const houda = s.coach_id === DEMO_HOUDA;
    const contested = houda && i === 3;
    const low = houda && i === 6;
    feedback.push({
      id: uid(), session_id: s.id, client_id: s.client_id, coach_id: s.coach_id,
      happened: !contested,
      rating: contested ? null : low ? 2 : 4 + (i % 2),
      comment: contested ? "La coach n'est pas venue, j'ai attendu 20 minutes à l'accueil." : low ? "Séance écourtée d'un quart d'heure, coach souvent sur son téléphone." : comments[i % comments.length],
      created_at: iso(new Date(s.starts_at).getTime() + 3 * H),
    });
  }
  return { profiles, clients, sessions, coach_pointages: [...(db.coach_pointages ?? []), ...pointages], session_feedback: [...(db.session_feedback ?? []), ...feedback] };
}
