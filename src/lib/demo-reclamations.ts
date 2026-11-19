/** Démo : quelques réclamations de la salle (QR code) et des coachs, avec une réponse de la direction */
type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
type DB = Record<string, Row[]>;

const ADMIN = "00000000-0000-4000-8000-000000000001";
const SARA = "00000000-0000-4000-8000-000000000003";
const RACHID = "00000000-0000-4000-8000-000000000004";

const ago = (days: number, hour: number) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, 15, 0, 0);
  return d.toISOString();
};

export function seedReclamations(db: DB, uid: () => string): DB {
  const clients = db.clients ?? [];
  const otherCoach = (db.profiles ?? []).find((p) => p.role === "coach" && p.id !== SARA)?.id ?? null;
  const ofSara = clients.filter((c) => c.coach_id === SARA);
  const c1 = ofSara[0] ?? clients[0];
  const c2 = ofSara[1] ?? clients[1];
  const base = { location: null, contact_phone: null, photo: null, task_id: null, resolved_at: null, client_id: null, urgent: false, response: null, responded_by: null, responded_at: null };

  const rows: Row[] = [
    // Coachs → direction
    {
      ...base,
      id: uid(),
      source: "coach",
      category: "client",
      author_id: SARA,
      contact_name: "Sara Bennani",
      client_id: c1?.id ?? null,
      description: "Troisième absence sans prévenir ce mois-ci. Je propose de lui rappeler la règle d'annulation 24 h avant.",
      status: "nouvelle",
      urgent: false,
      created_at: ago(0, 9),
    },
    {
      ...base,
      id: uid(),
      source: "coach",
      category: "materiel",
      author_id: SARA,
      contact_name: "Sara Bennani",
      location: "Salle musculation · rack n°2",
      description: "La poulie haute fait un bruit anormal et le câble est effiloché. Je ne l'utilise plus en séance en attendant.",
      status: "en_cours",
      urgent: true,
      response: "Merci Sara. Le technicien passe demain matin ; le rack est condamné d'ici là.",
      responded_by: RACHID,
      responded_at: ago(1, 12),
      created_at: ago(1, 10),
    },
    {
      ...base,
      id: uid(),
      source: "coach",
      category: "planning",
      author_id: otherCoach ?? SARA,
      contact_name: null,
      client_id: c2?.id ?? null,
      location: "Mardi 18 h – 20 h",
      description: "Deux séances privées et un cours collectif se suivent sans pause le mardi soir. Possible de décaler le cours de 30 min ?",
      status: "resolue",
      response: "C'est fait : le cours passe à 19 h 30 à partir de la semaine prochaine.",
      responded_by: ADMIN,
      responded_at: ago(5, 17),
      resolved_at: ago(5, 17),
      created_at: ago(6, 11),
    },
    {
      ...base,
      id: uid(),
      source: "coach",
      category: "administratif",
      author_id: RACHID,
      contact_name: "Rachid Alaoui",
      description: "Demande de congé du 22 au 24 décembre. Les séances de mes clients peuvent être reprises par Sara.",
      status: "nouvelle",
      created_at: ago(2, 16),
    },
    // Salle (QR code)
    { ...base, id: uid(), source: "adherent", category: "proprete", location: "Vestiaires femmes", description: "Plus de savon depuis ce matin.", contact_name: "Imane", status: "nouvelle", created_at: ago(0, 8) },
    { ...base, id: uid(), source: "adherent", category: "panne", location: "Cardio · tapis 4", description: "Le tapis s'arrête tout seul après 5 minutes.", status: "en_cours", created_at: ago(3, 19) },
    { ...base, id: uid(), source: "adherent", category: "service", location: "Accueil", description: "Personne à l'accueil à 7 h ce matin.", contact_name: "Youssef", status: "resolue", resolved_at: ago(8, 12), created_at: ago(9, 7) },
  ];
  // Le nom des auteurs vient du profil quand il existe
  for (const r of rows) {
    const p = (db.profiles ?? []).find((x) => x.id === r.author_id);
    if (p?.full_name) r.contact_name = p.full_name;
  }
  return { reclamations: [...(db.reclamations ?? []), ...rows] };
}
