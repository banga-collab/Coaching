import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import type {
  ClassBooking,
  Client,
  ClientProgram,
  Exercise,
  Food,
  GroupClass,
  HealthCheck,
  Measurement,
  MealPlan,
  Profile,
  Program,
  Session,
  SessionStatus,
  Task,
} from "@/lib/types";
import { agadirToIso, fmtDate, fmtTime, SESSION_LABEL, STATUS_LABEL } from "@/lib/utils";
import { exportResponse, filterRows, fold, parseFormat, type Cell } from "@/lib/export";

export const dynamic = "force-dynamic";

/* eslint-disable @typescript-eslint/no-explicit-any */

const TITLES = {
  clients: "Clients",
  seances: "Séances",
  mesures: "Mesures",
  bilans: "Bilans de santé",
  programmes: "Programmes",
  exercices: "Exercices",
  cours: "Cours collectifs",
  nutrition: "Plans alimentaires",
  taches: "Tâches",
  reclamations: "Réclamations",
} as const;
type Kind = keyof typeof TITLES;
/** Exports qui acceptent `?client=<id>` */
const CLIENT_KINDS = new Set<Kind>(["seances", "mesures", "bilans", "nutrition", "taches"]);

/** Réclamation (signalement d'un problème par QR code) */
interface Reclamation {
  id: string;
  created_at: string;
  category: string;
  location: string | null;
  description: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  status: "nouvelle" | "en_cours" | "resolue";
  task_id: string | null;
  resolved_at: string | null;
}

const LIMIT = 5000;
const CHECK_LABEL: Record<HealthCheck["kind"], string> = { initial: "Initial", mensuel: "Mensuel", hebdo: "Hebdomadaire" };
const PRIO_LABEL: Record<Task["priority"], string> = { haute: "Haute", normale: "Normale", basse: "Basse" };
const RECLA_CAT: Record<string, string> = { panne: "Panne", proprete: "Propreté", securite: "Sécurité", service: "Service", autre: "Autre", client: "Client", planning: "Planning", materiel: "Matériel", equipe: "Équipe", administratif: "Administratif" };
const RECLA_STATUS: Record<Reclamation["status"], string> = { nouvelle: "Nouvelle", en_cours: "En cours", resolue: "Résolue" };
const BOOKING_TAKEN = new Set<ClassBooking["status"]>(["inscrit", "present"]);

const d = (v: string | null | undefined) => (v ? fmtDate(v.length === 10 ? `${v}T12:00:00Z` : v, { day: "2-digit", month: "2-digit", year: "numeric" }) : "");
const n = (v: number | string | null | undefined) => (v === null || v === undefined || v === "" ? null : Number(v));
const isDay = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
const addDay = (key: string, k: number) => {
  const x = new Date(`${key}T12:00:00Z`);
  x.setUTCDate(x.getUTCDate() + k);
  return x.toISOString().slice(0, 10);
};
const mondayOf = (key: string) => addDay(key, -((new Date(`${key}T12:00:00Z`).getUTCDay() + 6) % 7));
/** Début (inclus) / fin (exclue) d'une période AAAA-MM-JJ en heure d'Agadir, en ISO UTC */
const isoStart = (day: string) => agadirToIso(day, "00:00");
const isoEnd = (day: string) => agadirToIso(addDay(day, 1), "00:00");
const pick = <T extends string>(v: string | null, allowed: readonly T[]) => (v && (allowed as readonly string[]).includes(v) ? (v as T) : null);

/** Requête `in` découpée (évite des URL trop longues côté Supabase) */
async function inChunks<T>(ids: string[], run: (chunk: string[]) => PromiseLike<{ data: unknown }>): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await run(ids.slice(i, i + 200));
    out.push(...((data ?? []) as T[]));
  }
  return out;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ kind: string }> }) {
  const me: Profile = await getProfile();
  if (me.role === "client") return new NextResponse("Accès réservé à l'équipe.", { status: 403 });

  const { kind: raw } = await params;
  if (!(raw in TITLES)) return new NextResponse("Export inconnu.", { status: 404 });
  const kind = raw as Kind;
  const sp = req.nextUrl.searchParams;
  const format = parseFormat(sp.get("format"));
  const q = (sp.get("q") ?? "").trim().slice(0, 100);
  let from = isDay(sp.get("from"));
  let to = isDay(sp.get("to"));
  if (from && to && from > to) [from, to] = [to, from];
  // Pages hebdomadaires (séances, cours) : la semaine affichée sert de période par défaut
  const semaine = isDay(sp.get("semaine"));
  if (!from && !to && semaine && (kind === "seances" || kind === "cours")) {
    from = mondayOf(semaine);
    to = addDay(from, 6);
  }
  const clientId = sp.get("client") || null;

  const supabase = await createClient();
  const filters: string[] = [];
  if (from && to) filters.push(`Période : du ${d(from)} au ${d(to)}`);
  else if (from) filters.push(`Période : depuis le ${d(from)}`);
  else if (to) filters.push(`Période : jusqu'au ${d(to)}`);

  // Référentiels chargés à la demande (une seule fois)
  let clientsP: Promise<Client[]> | null = null;
  const loadClients = () =>
    (clientsP ??= Promise.resolve(supabase.from("clients").select("*").order("full_name").limit(LIMIT)).then(({ data }: { data: unknown }) => (data ?? []) as Client[]));
  let peopleP: Promise<Map<string, string>> | null = null;
  const loadPeople = () =>
    (peopleP ??= Promise.resolve(supabase.from("profiles").select("id, full_name, email")).then(
      ({ data }: { data: unknown }) => new Map(((data ?? []) as Pick<Profile, "id" | "full_name" | "email">[]).map((p) => [p.id, p.full_name || p.email])),
    ));
  const clientNames = async () => new Map((await loadClients()).map((c) => [c.id, c.full_name]));
  // Filtre `client` (exports liés à un client). Synchrone : une requête Supabase est « thenable »,
  // la renvoyer depuis une fonction async l'exécuterait.
  if (clientId && CLIENT_KINDS.has(kind)) filters.push(`Client : ${(await clientNames()).get(clientId) ?? "inconnu"}`);
  const withClient = (q0: any, col = "client_id") => (clientId ? q0.eq(col, clientId) : q0);
  const coachFilter = async (param = "coach") => {
    const id = sp.get(param);
    if (!id) return null;
    filters.push(`Coach : ${(await loadPeople()).get(id) ?? "inconnu"}`);
    return id;
  };

  let title: string = TITLES[kind];
  let header: string[] = [];
  let rows: Cell[][] = [];

  if (kind === "clients") {
    const [clients, people] = await Promise.all([loadClients(), loadPeople()]);
    const statut = pick(sp.get("statut"), ["actif", "pause", "termine"] as const);
    if (statut) filters.push(`Statut : ${STATUS_LABEL[statut]}`);
    const coach = await coachFilter();
    const list = clients.filter(
      (c) => (!from || c.start_date >= from) && (!to || c.start_date <= to) && (!statut || c.status === statut) && (!coach || c.coach_id === coach),
    );
    header = ["Nom", "E-mail", "Téléphone", "Sexe", "Date de naissance", "Taille (cm)", "Objectif", "Fréquence", "Statut", "Coach", "Date de début", "Notes"];
    rows = list.map((c) => [c.full_name, c.email, c.phone, c.sex, d(c.birth_date), n(c.height_cm), c.goal, c.frequency, STATUS_LABEL[c.status], people.get(c.coach_id), d(c.start_date), c.notes]);
  } else if (kind === "seances") {
    let qb: any = supabase.from("sessions").select("*");
    if (from) qb = qb.gte("starts_at", isoStart(from));
    if (to) qb = qb.lt("starts_at", isoEnd(to));
    const statut = pick(sp.get("statut"), ["planifiee", "acceptee", "refusee", "reportee", "en_cours", "realisee", "absent", "annulee"] as const);
    if (statut) {
      qb = qb.eq("status", statut);
      filters.push(`Statut : ${SESSION_LABEL[statut as SessionStatus]}`);
    }
    const coach = await coachFilter();
    if (coach) qb = qb.eq("coach_id", coach);
    const type = sp.get("type");
    if (type) {
      qb = qb.eq("type", type);
      filters.push(`Type : ${type}`);
    }
    qb = withClient(qb);
    const [{ data }, name, people] = await Promise.all([qb.order("starts_at", { ascending: true }).limit(LIMIT), clientNames(), loadPeople()]);
    header = ["Date", "Heure", "Client", "Coach", "Type", "Durée (min)", "Statut", "RPE", "Notes"];
    rows = ((data ?? []) as Session[]).map((s) => [d(s.starts_at), fmtTime(s.starts_at), name.get(s.client_id), people.get(s.coach_id), s.type, n(s.duration_min), SESSION_LABEL[s.status], n(s.rpe), s.notes]);
  } else if (kind === "mesures") {
    let qb: any = supabase.from("measurements").select("*");
    if (from) qb = qb.gte("measured_on", from);
    if (to) qb = qb.lte("measured_on", to);
    qb = withClient(qb);
    const [{ data }, name] = await Promise.all([qb.order("measured_on", { ascending: true }).limit(LIMIT), clientNames()]);
    header = ["Date", "Client", "Poids (kg)", "Masse grasse (%)", "Masse musculaire (kg)", "Tour de taille (cm)", "Hanches (cm)", "Poitrine (cm)", "Bras (cm)", "Cuisse (cm)", "Squat (kg)", "Développé couché (kg)", "Soulevé de terre (kg)", "Notes"];
    rows = ((data ?? []) as Measurement[]).map((m) => [
      d(m.measured_on), name.get(m.client_id), n(m.weight_kg), n(m.body_fat), n(m.muscle_kg), n(m.waist_cm), n(m.hips_cm), n(m.chest_cm), n(m.arm_cm), n(m.thigh_cm), n(m.squat_kg), n(m.bench_kg), n(m.deadlift_kg), m.notes,
    ]);
  } else if (kind === "bilans") {
    let qb: any = supabase.from("health_checks").select("*");
    if (from) qb = qb.gte("checked_on", from);
    if (to) qb = qb.lte("checked_on", to);
    qb = withClient(qb);
    const [{ data }, name] = await Promise.all([qb.order("checked_on", { ascending: true }).limit(LIMIT), clientNames()]);
    header = ["Date", "Client", "Type", "Tension sys.", "Tension dia.", "FC repos", "Sommeil /10", "Énergie /10", "Stress /10", "Motivation /10", "Nutrition /10", "Récupération /10", "Zones douloureuses", "Pathologies", "Traitements", "Blessures", "PAR-Q positif", "Consentement", "Notes"];
    rows = ((data ?? []) as HealthCheck[]).map((h) => [
      d(h.checked_on), name.get(h.client_id), CHECK_LABEL[h.kind] ?? h.kind, n(h.systolic), n(h.diastolic), n(h.resting_hr), n(h.sleep), n(h.energy), n(h.stress), n(h.motivation), n(h.nutrition), n(h.recovery),
      (h.pain_zones ?? []).join(", "), h.conditions, h.medications, h.injuries, h.parq_positive, h.consent, h.notes,
    ]);
  } else if (kind === "programmes") {
    let qb: any = supabase.from("programs").select("*");
    if (from) qb = qb.gte("created_at", isoStart(from));
    if (to) qb = qb.lt("created_at", isoEnd(to));
    const objectif = sp.get("objectif");
    if (objectif) {
      qb = qb.eq("goal", objectif);
      filters.push(`Objectif : ${objectif}`);
    }
    const niveau = sp.get("niveau");
    if (niveau) {
      qb = qb.eq("level", niveau);
      filters.push(`Niveau : ${niveau}`);
    }
    const [{ data }, { data: cpData }, people] = await Promise.all([
      qb.order("name").limit(LIMIT),
      supabase.from("client_programs").select("program_id, client_id, status").in("status", ["actif", "pause"]),
      loadPeople(),
    ]);
    const followers = new Map<string, Set<string>>();
    for (const a of (cpData ?? []) as Pick<ClientProgram, "program_id" | "client_id">[]) {
      const s = followers.get(a.program_id);
      if (s) s.add(a.client_id);
      else followers.set(a.program_id, new Set([a.client_id]));
    }
    header = ["Programme", "Objectif", "Niveau", "Semaines", "Séances / semaine", "Exercices", "Clients suivis", "Description", "Créé par", "Créé le"];
    rows = ((data ?? []) as Program[]).map((p) => [
      p.name, p.goal, p.level, n(p.weeks), (p.days ?? []).length, (p.days ?? []).reduce((s, x) => s + (x.exercises ?? []).length, 0), followers.get(p.id)?.size ?? 0,
      p.description, p.created_by ? people.get(p.created_by) : null, d(p.created_at),
    ]);
  } else if (kind === "exercices") {
    let qb: any = supabase.from("exercises").select("*");
    if (from) qb = qb.gte("created_at", isoStart(from));
    if (to) qb = qb.lt("created_at", isoEnd(to));
    const cat = sp.get("categorie") || sp.get("cat");
    if (cat) {
      qb = qb.eq("category", cat);
      filters.push(`Catégorie : ${cat}`);
    }
    const niveau = sp.get("niveau");
    if (niveau) {
      qb = qb.eq("level", niveau);
      filters.push(`Niveau : ${niveau}`);
    }
    const materiel = sp.get("materiel") || sp.get("equipement");
    if (materiel) {
      qb = qb.eq("equipment", materiel);
      filters.push(`Matériel : ${materiel}`);
    }
    const { data } = await qb.order("name").limit(LIMIT);
    let list = (data ?? []) as Exercise[];
    const muscle = sp.get("muscle");
    if (muscle) {
      filters.push(`Muscle : ${muscle}`);
      const m = fold(muscle);
      list = list.filter((e) => (Array.isArray(e.muscles) ? e.muscles : []).some((x) => fold(x) === m));
    }
    const video = sp.get("video");
    if (video === "oui" || video === "non") {
      filters.push(video === "oui" ? "Avec vidéo" : "Sans vidéo");
      list = list.filter((e) => !!e.video_url === (video === "oui"));
    }
    header = ["Exercice", "Catégorie", "Muscles", "Matériel", "Niveau", "Vidéo", "Consignes", "Conseils"];
    rows = list.map((e) => [e.name, e.category, (Array.isArray(e.muscles) ? e.muscles : []).join(", "), e.equipment, e.level, e.video_url, e.instructions, e.tips]);
  } else if (kind === "cours") {
    let qb: any = supabase.from("group_classes").select("*");
    if (from) qb = qb.gte("starts_at", isoStart(from));
    if (to) qb = qb.lt("starts_at", isoEnd(to));
    const cat = sp.get("categorie") || sp.get("cat");
    if (cat) {
      qb = qb.eq("category", cat);
      filters.push(`Catégorie : ${cat}`);
    }
    const coach = await coachFilter();
    if (coach) qb = qb.eq("coach_id", coach);
    const salle = sp.get("salle");
    if (salle) {
      qb = qb.eq("room", salle);
      filters.push(`Salle : ${salle}`);
    }
    const [{ data }, people] = await Promise.all([qb.order("starts_at", { ascending: true }).limit(2000), loadPeople()]);
    const classes = (data ?? []) as GroupClass[];
    const bookings = await inChunks<Pick<ClassBooking, "class_id" | "status">>(classes.map((c) => c.id), (ids) => supabase.from("class_bookings").select("class_id, status").in("class_id", ids));
    const stats = new Map<string, { taken: number; present: number; waiting: number }>();
    for (const b of bookings) {
      const s = stats.get(b.class_id) ?? { taken: 0, present: 0, waiting: 0 };
      if (BOOKING_TAKEN.has(b.status)) s.taken++;
      if (b.status === "present") s.present++;
      if (b.status === "attente") s.waiting++;
      stats.set(b.class_id, s);
    }
    header = ["Date", "Heure", "Durée (min)", "Cours", "Catégorie", "Coach", "Salle", "Niveau", "Capacité", "Inscrits", "Présents", "Liste d'attente", "Remplissage (%)", "Statut"];
    rows = classes.map((c) => {
      const s = stats.get(c.id) ?? { taken: 0, present: 0, waiting: 0 };
      return [
        d(c.starts_at), fmtTime(c.starts_at), n(c.duration_min), c.title, c.category, c.coach_id ? people.get(c.coach_id) : null, c.room, c.level, n(c.capacity), s.taken, s.present, s.waiting,
        c.capacity ? Math.round((s.taken / c.capacity) * 100) : null, c.cancelled ? "Annulé" : "Prévu",
      ];
    });
  } else if (kind === "nutrition" && sp.get("vue") === "aliments") {
    // Onglet « Aliments » de la page Nutrition
    title = "Aliments";
    const { data } = await supabase.from("foods").select("*").order("name").limit(LIMIT);
    let list = (data ?? []) as Food[];
    const cat = sp.get("cat");
    if (cat === "maroc") {
      filters.push("Catégorie : Plats marocains");
      list = list.filter((f) => f.moroccan);
    } else if (cat) {
      filters.push(`Catégorie : ${cat}`);
      list = list.filter((f) => f.category === cat);
    }
    header = ["Aliment", "Catégorie", "Portion", "Grammes", "Calories (kcal)", "Protéines (g)", "Glucides (g)", "Lipides (g)", "Plat marocain"];
    rows = list.map((f) => [f.name, f.category, f.portion, n(f.grams), n(f.kcal), n(f.protein), n(f.carbs), n(f.fat), f.moroccan]);
  } else if (kind === "nutrition") {
    let qb: any = supabase.from("meal_plans").select("*");
    if (from) qb = qb.gte("created_at", isoStart(from));
    if (to) qb = qb.lt("created_at", isoEnd(to));
    qb = withClient(qb);
    const [{ data }, name] = await Promise.all([qb.order("created_at", { ascending: false }).limit(LIMIT), clientNames()]);
    let list = (data ?? []) as MealPlan[];
    // Mêmes filtres que la page : type (modeles|clients) ; filtre (actifs|inactifs) sur les plans des clients
    const type = sp.get("type");
    if (type === "modeles") {
      filters.push("Type : Modèles");
      list = list.filter((p) => p.client_id === null);
    } else if (type === "clients") {
      filters.push("Type : Plans des clients");
      list = list.filter((p) => p.client_id !== null);
    }
    const filtre = sp.get("filtre");
    if (filtre === "actifs" || filtre === "inactifs") {
      filters.push(`Plans des clients : ${filtre === "actifs" ? "Actifs" : "Inactifs"}`);
      list = list.filter((p) => p.client_id === null || p.active === (filtre === "actifs"));
    }
    header = ["Plan", "Type", "Client", "Objectif", "Calories cibles (kcal)", "Protéines (g)", "Glucides (g)", "Lipides (g)", "Repas", "Actif", "Créé le", "Notes"];
    rows = list.map((p) => [
      p.name, p.client_id ? "Plan client" : "Modèle", p.client_id ? name.get(p.client_id) : null, p.goal, n(p.target_kcal), n(p.protein_g), n(p.carbs_g), n(p.fat_g), (p.meals ?? []).length, p.active, d(p.created_at), p.notes,
    ]);
  } else if (kind === "taches") {
    let qb: any = supabase.from("tasks").select("*");
    const all = me.role === "admin" && sp.get("vue") === "all";
    if (!all) {
      qb = qb.eq("assigned_to", me.id);
      filters.push("Mes tâches");
    }
    const prio = pick(sp.get("prio"), ["haute", "normale", "basse"] as const);
    if (prio) {
      qb = qb.eq("priority", prio);
      filters.push(`Priorité : ${PRIO_LABEL[prio]}`);
    }
    const etat = sp.get("etat");
    if (etat === "fait" || etat === "a_faire") {
      qb = qb.eq("done", etat === "fait");
      filters.push(etat === "fait" ? "Terminées" : "À faire");
    }
    qb = withClient(qb);
    const [{ data }, name, people] = await Promise.all([qb.order("due_date", { ascending: true }).limit(LIMIT), clientNames(), loadPeople()]);
    // Période : échéance (ou date de création si pas d'échéance)
    const list = ((data ?? []) as Task[]).filter((t) => {
      const k = t.due_date ?? t.created_at.slice(0, 10);
      return (!from || k >= from) && (!to || k <= to);
    });
    header = ["Tâche", "Client", "Assignée à", "Échéance", "Priorité", "État", "Faite le", "Origine", "Notes", "Créée le"];
    rows = list.map((t) => [
      t.title, t.client_id ? name.get(t.client_id) : null, t.assigned_to ? people.get(t.assigned_to) : null, d(t.due_date), PRIO_LABEL[t.priority] ?? t.priority,
      t.done ? "Faite" : "À faire", d(t.done_at), t.source === "manuel" ? "Manuelle" : t.source?.startsWith("auto") ? "Automatisation" : t.source, t.notes, d(t.created_at),
    ]);
  } else {
    // Réclamations : la photo (data URL) n'est jamais chargée ni exportée, seulement sa présence
    let qb: any = supabase.from("reclamations").select("id, created_at, category, location, description, contact_name, contact_phone, status, task_id, resolved_at");
    // Un coach n'exporte que les signalements de la salle (les réclamations des autres coachs sont privées)
    if (me.role === "coach") qb = qb.eq("source", "adherent");
    if (from) qb = qb.gte("created_at", isoStart(from));
    if (to) qb = qb.lt("created_at", isoEnd(to));
    const statut = pick(sp.get("statut"), Object.keys(RECLA_STATUS) as Reclamation["status"][]);
    if (statut) {
      qb = qb.eq("status", statut);
      filters.push(`Statut : ${RECLA_STATUS[statut]}`);
    }
    const cat = pick(sp.get("categorie") || sp.get("cat"), Object.keys(RECLA_CAT) as Reclamation["category"][]);
    if (cat) {
      qb = qb.eq("category", cat);
      filters.push(`Catégorie : ${RECLA_CAT[cat]}`);
    }
    const [res, photoRes] = await Promise.all([
      Promise.resolve(qb.order("created_at", { ascending: false }).limit(LIMIT)).catch(() => ({ data: [] })),
      Promise.resolve(supabase.from("reclamations").select("id").not("photo", "is", null).limit(20000)).catch(() => ({ data: [] })),
    ]);
    const withPhoto = new Set(((photoRes as { data: unknown }).data as { id: string }[] | null ?? []).map((r) => r.id));
    header = ["Date", "Heure", "Catégorie", "Lieu", "Description", "Contact", "Téléphone", "Photo", "Statut", "Tâche liée", "Résolue le"];
    rows = (((res as { data: unknown }).data ?? []) as Reclamation[]).map((r) => [
      d(r.created_at), fmtTime(r.created_at), RECLA_CAT[r.category] ?? r.category, r.location, r.description, r.contact_name, r.contact_phone, withPhoto.has(r.id) ? "Oui" : "Non",
      RECLA_STATUS[r.status] ?? r.status, r.task_id ? "Oui" : "Non", d(r.resolved_at),
    ]);
  }

  if (q) {
    filters.push(`Recherche : « ${q} »`);
    rows = filterRows(rows, q);
  }

  return exportResponse({ format, title, kind: title === "Aliments" ? "aliments" : kind, user: me.full_name || me.email, filters, header, rows });
}
