/**
 * Assistant IA : contexte client compact + appels à Claude.
 * Sans clé ANTHROPIC_API_KEY (ou en mode démo), une analyse automatique déterministe
 * calculée à partir des données est renvoyée à la place.
 */
import Anthropic from "@anthropic-ai/sdk";
import { DEMO } from "./demo";
import { createClient } from "./supabase/server";
import type { Client, ClientProgram, Goal, HealthCheck, Measurement, Program, Session } from "./types";
import { age, fmtDate, num, signed } from "./utils";

export const AI_MODEL = "claude-opus-5-5";

export type AiSource = "claude" | "auto";
export type AiSection = { key: "forts" | "surveiller" | "recos" | "ajustements"; title: string; items: string[] };
export type AiSections = { source: AiSource; headline: string; sections: AiSection[]; note?: string };
export type AiText = { source: AiSource; text: string; note?: string };
export type DraftIntent = "motivation" | "rappel" | "felicitations" | "relance";
export type ChatTurn = { role: "user" | "assistant"; content: string };

export const INTENT_LABEL: Record<DraftIntent, string> = {
  motivation: "Motivation",
  rappel: "Rappel de séance",
  felicitations: "Félicitations",
  relance: "Relance absence",
};

export function aiEnabled() {
  return !!process.env.ANTHROPIC_API_KEY && !DEMO;
}

/* ===================== Données ===================== */
type Data = {
  client: Client;
  first: string;
  meas: Measurement[]; // chronologique (6 dernières)
  checks: HealthCheck[]; // chronologique (3 derniers)
  sessions: Session[]; // plus récentes d'abord (10 dernières passées) + prochaine
  next: Session | null;
  goals: Goal[];
  program: string | null;
};

async function loadData(clientId: string): Promise<Data | null> {
  const supabase = await createClient();
  const nowIso = new Date().toISOString();
  const [{ data: c }, { data: m }, { data: h }, { data: s }, { data: up }, { data: g }, { data: cp }] = await Promise.all([
    supabase.from("clients").select("*").eq("id", clientId).maybeSingle(),
    supabase.from("measurements").select("*").eq("client_id", clientId).order("measured_on", { ascending: false }).limit(6),
    supabase.from("health_checks").select("*").eq("client_id", clientId).order("checked_on", { ascending: false }).limit(3),
    supabase.from("sessions").select("*").eq("client_id", clientId).lte("starts_at", nowIso).order("starts_at", { ascending: false }).limit(10),
    supabase.from("sessions").select("*").eq("client_id", clientId).gt("starts_at", nowIso).in("status", ["planifiee", "acceptee"]).order("starts_at", { ascending: true }).limit(1),
    supabase.from("goals").select("*").eq("client_id", clientId).order("created_at", { ascending: false }).limit(8),
    supabase.from("client_programs").select("*").eq("client_id", clientId).eq("status", "actif").order("start_date", { ascending: false }).limit(1),
  ]);
  if (!c) return null;
  const client = c as Client;
  let program: string | null = null;
  const link = (cp?.[0] ?? null) as ClientProgram | null;
  if (link) {
    const { data: p } = await supabase.from("programs").select("*").eq("id", link.program_id).maybeSingle();
    if (p) program = `${(p as Program).name} (depuis le ${fmtDate(link.start_date)})`;
  }
  return {
    client,
    first: client.full_name.trim().split(/\s+/)[0] ?? client.full_name,
    meas: ((m ?? []) as Measurement[]).reverse(),
    checks: ((h ?? []) as HealthCheck[]).reverse(),
    sessions: (s ?? []) as Session[],
    next: ((up ?? [])[0] ?? null) as Session | null,
    goals: (g ?? []) as Goal[],
    program,
  };
}

/** Contexte compact en français — prénom uniquement, ni téléphone, ni e-mail, ni date de naissance. */
function buildContext(d: Data) {
  const c = d.client;
  const L: string[] = [];
  const years = age(c.birth_date);
  L.push(
    `Adhérent : ${d.first}${years ? `, ${years} ans` : ""}${c.sex ? `, ${c.sex === "H" ? "homme" : "femme"}` : ""}${c.height_cm ? `, ${c.height_cm} cm` : ""}.`,
  );
  L.push(`Objectif : ${c.goal ?? "non précisé"} · Fréquence : ${c.frequency ?? "–"} · Statut : ${c.status} · Suivi depuis le ${fmtDate(c.start_date)}.`);
  if (d.program) L.push(`Programme actif : ${d.program}.`);
  if (d.meas.length) {
    L.push("Mesures (ancienne → récente) :");
    for (const m of d.meas) {
      const parts = [
        m.weight_kg !== null && `poids ${num(m.weight_kg)} kg`,
        m.body_fat !== null && `MG ${num(m.body_fat)} %`,
        m.muscle_kg !== null && `muscle ${num(m.muscle_kg)} kg`,
        m.waist_cm !== null && `taille ${num(m.waist_cm)} cm`,
        m.squat_kg !== null && `squat ${num(m.squat_kg)} kg`,
        m.bench_kg !== null && `DC ${num(m.bench_kg)} kg`,
        m.deadlift_kg !== null && `SdT ${num(m.deadlift_kg)} kg`,
      ].filter(Boolean);
      L.push(`- ${m.measured_on} : ${parts.join(", ") || "–"}`);
    }
  }
  if (d.checks.length) {
    L.push("Bilans santé / bien-être (échelles 1-10) :");
    for (const h of d.checks) {
      const parts = [
        h.systolic && h.diastolic && `TA ${h.systolic}/${h.diastolic}`,
        h.resting_hr && `FC repos ${h.resting_hr}`,
        h.sleep && `sommeil ${h.sleep}`,
        h.energy && `énergie ${h.energy}`,
        h.stress && `stress ${h.stress}`,
        h.motivation && `motivation ${h.motivation}`,
        h.nutrition && `nutrition ${h.nutrition}`,
        h.recovery && `récup ${h.recovery}`,
        h.pain_zones?.length && `douleurs : ${h.pain_zones.join(", ")}`,
        h.injuries && `blessures : ${h.injuries}`,
        h.parq_positive && "PAR-Q positif",
      ].filter(Boolean);
      L.push(`- ${h.checked_on} (${h.kind}) : ${parts.join(", ") || "–"}`);
    }
  }
  if (d.sessions.length) {
    L.push("10 dernières séances (récente → ancienne) :");
    for (const s of d.sessions) L.push(`- ${s.starts_at.slice(0, 10)} ${s.type} : ${s.status}${s.rpe ? `, RPE ${s.rpe}` : ""}`);
  }
  if (d.next) L.push(`Prochaine séance : ${fmtWhen(d.next.starts_at)} (${d.next.type}).`);
  if (d.goals.length) {
    L.push("Objectifs :");
    for (const g of d.goals)
      L.push(`- ${g.title} : départ ${g.start_value ?? "–"}, actuel ${g.current_value ?? "–"}, cible ${g.target_value ?? "–"} ${g.unit ?? ""} · ${g.status}${g.due_date ? ` · échéance ${g.due_date}` : ""}`);
  }
  return L.join("\n");
}

function fmtWhen(iso: string) {
  return `${fmtDate(iso, { weekday: "long", day: "numeric", month: "long" })} à ${fmtDate(iso, { hour: "2-digit", minute: "2-digit" })}`;
}

/* ===================== Indicateurs (analyse automatique) ===================== */
type Facts = ReturnType<typeof computeFacts>;

function computeFacts(d: Data) {
  const lossGoal = !/masse|prise/i.test(d.client.goal ?? "");
  const weights = d.meas.filter((m) => m.weight_kg !== null);
  const wFirst = weights[0]?.weight_kg ?? null;
  const wLast = weights.at(-1)?.weight_kg ?? null;
  const wDelta = wFirst !== null && wLast !== null && weights.length > 1 ? Number(wLast) - Number(wFirst) : null;
  const fats = d.meas.filter((m) => m.body_fat !== null);
  const fDelta = fats.length > 1 ? Number(fats.at(-1)!.body_fat) - Number(fats[0]!.body_fat) : null;
  const strength = d.meas.filter((m) => m.squat_kg !== null);
  const sqDelta = strength.length > 1 ? Number(strength.at(-1)!.squat_kg) - Number(strength[0]!.squat_kg) : null;

  const past = d.sessions.filter((s) => ["realisee", "absent"].includes(s.status));
  const done = past.filter((s) => s.status === "realisee");
  const absent = past.filter((s) => s.status === "absent");
  const rate = past.length ? Math.round((done.length / past.length) * 100) : null;
  let streakAbsent = 0;
  for (const s of past) {
    if (s.status === "absent") streakAbsent++;
    else break;
  }
  const rpes = done.map((s) => s.rpe).filter((v): v is number => v !== null);
  const rpe = rpes.length ? rpes.reduce((a, b) => a + b, 0) / rpes.length : null;
  const lastDone = done[0]?.starts_at ?? null;
  const daysSince = lastDone ? Math.floor((Date.now() - new Date(lastDone).getTime()) / 86400000) : null;

  const hc = d.checks.at(-1) ?? null;
  const highBp = !!hc && ((hc.systolic ?? 0) >= 140 || (hc.diastolic ?? 0) >= 90);
  const goals = d.goals.map((g) => {
    const span = g.target_value !== null && g.start_value !== null ? Number(g.target_value) - Number(g.start_value) : null;
    const pct = span && g.current_value !== null ? Math.max(0, Math.min(100, Math.round(((Number(g.current_value) - Number(g.start_value)) / span) * 100))) : null;
    const late = g.status === "en_cours" && !!g.due_date && g.due_date < new Date().toISOString().slice(0, 10);
    return { g, pct, late };
  });
  return { lossGoal, wDelta, wLast, fDelta, sqDelta, past, done, absent, rate, streakAbsent, rpe, daysSince, hc, highBp, goals, weights };
}

const PAIN_TIPS: Record<string, string> = {
  Genoux: "genoux : privilégier box squat, presse amplitude contrôlée, limiter sauts et impacts",
  "Bas du dos": "bas du dos : gainage anti-rotation, hip hinge léger, éviter les charges axiales lourdes",
  Épaules: "épaules : travail scapulaire, tirages avant poussées, éviter le développé derrière la nuque",
  Nuque: "nuque : mobilité cervicale douce, réduire les shrugs et le port de charge lourde",
  "Haut du dos": "haut du dos : mobilité thoracique, rowing léger, posture",
  Hanches: "hanches : mobilité, renforcement fessiers (pont, abductions), amplitude progressive",
  Chevilles: "chevilles : mobilité, proprioception, éviter les réceptions de sauts",
  Coudes: "coudes : prises neutres, charges modérées sur les flexions/extensions",
  Poignets: "poignets : prises neutres ou sangles, éviter l'appui prolongé poignet en extension",
};

function autoSummary(d: Data, f: Facts): AiSections {
  const forts: string[] = [];
  const watch: string[] = [];
  const recos: string[] = [];

  if (f.wDelta !== null) {
    const good = f.lossGoal ? f.wDelta < -0.2 : f.wDelta > 0.2;
    const line = `Poids : ${signed(Math.round(f.wDelta * 10) / 10, "kg")} sur les ${f.weights.length} dernières mesures (actuel ${num(f.wLast, "kg")}).`;
    if (good) forts.push(line);
    else if (Math.abs(f.wDelta) <= 0.2) watch.push(`${line} Stagnation à surveiller.`);
    else watch.push(`${line} Évolution contraire à l'objectif « ${d.client.goal ?? "–"} ».`);
  }
  if (f.fDelta !== null) {
    if (f.fDelta < -0.2) forts.push(`Masse grasse en baisse (${signed(Math.round(f.fDelta * 10) / 10, "pts")}).`);
    else if (f.fDelta > 0.5 && f.lossGoal) watch.push(`Masse grasse en hausse (${signed(Math.round(f.fDelta * 10) / 10, "pts")}).`);
  }
  if (f.sqDelta !== null && f.sqDelta > 0) forts.push(`Force en progression : squat ${signed(f.sqDelta, "kg")}.`);

  if (f.rate !== null) {
    const line = `Assiduité : ${f.done.length}/${f.past.length} séances réalisées (${f.rate} %).`;
    if (f.rate >= 80) forts.push(line);
    else if (f.rate < 60) watch.push(`${line} ${f.absent.length} absence(s) récente(s).`);
    else forts.push(line);
  } else {
    watch.push("Aucune séance récente enregistrée.");
  }
  if (f.streakAbsent >= 2) watch.push(`${f.streakAbsent} absences consécutives sur les dernières séances.`);
  if (f.daysSince !== null && f.daysSince > 10) watch.push(`Dernière séance réalisée il y a ${f.daysSince} jours.`);
  if (f.rpe !== null) {
    if (f.rpe >= 8.5) watch.push(`Intensité perçue élevée (RPE moyen ${num(f.rpe)}) : risque de fatigue accumulée.`);
    else if (f.rpe < 6) recos.push(`RPE moyen de ${num(f.rpe)} : marge pour augmenter progressivement les charges.`);
    else forts.push(`Intensité bien dosée (RPE moyen ${num(f.rpe)}).`);
  }

  const h = f.hc;
  if (h) {
    if ((h.motivation ?? 0) >= 8) forts.push(`Motivation élevée (${h.motivation}/10).`);
    if ((h.energy ?? 0) >= 8) forts.push(`Bon niveau d'énergie (${h.energy}/10).`);
    if (h.sleep !== null && h.sleep <= 5) watch.push(`Sommeil faible (${h.sleep}/10).`);
    if (h.stress !== null && h.stress >= 7) watch.push(`Stress élevé (${h.stress}/10).`);
    if (h.recovery !== null && h.recovery <= 4) watch.push(`Récupération insuffisante (${h.recovery}/10).`);
    if (h.motivation !== null && h.motivation <= 4) watch.push(`Motivation en baisse (${h.motivation}/10).`);
    if (h.pain_zones?.length) watch.push(`Douleurs signalées : ${h.pain_zones.join(", ")}.`);
    if (h.injuries) watch.push(`Blessure / antécédent : ${h.injuries}.`);
    if (f.highBp) watch.push(`Tension mesurée à ${h.systolic}/${h.diastolic} : à faire vérifier par un médecin avant toute intensification.`);
    if (h.parq_positive) watch.push("PAR-Q positif : avis médical requis avant de progresser en intensité.");
  } else {
    recos.push("Aucun bilan de santé : en planifier un pour mieux personnaliser le suivi.");
  }

  for (const { g, pct, late } of f.goals) {
    if (g.status === "atteint") forts.push(`Objectif atteint : ${g.title}.`);
    else if (late) watch.push(`Objectif « ${g.title} » en retard sur l'échéance${pct !== null ? ` (${pct} %)` : ""}.`);
    else if (g.status === "en_cours" && pct !== null && pct >= 60) forts.push(`Objectif « ${g.title} » à ${pct} %.`);
  }

  // Recommandations
  if (f.streakAbsent >= 2 || (f.rate !== null && f.rate < 60)) recos.push(`Relancer ${d.first} sur WhatsApp et caler un créneau fixe chaque semaine.`);
  if (f.rpe !== null && f.rpe >= 8.5) recos.push("Programmer une semaine allégée (-30 % de volume) pour relancer la récupération.");
  if (h?.sleep !== null && h?.sleep !== undefined && h.sleep <= 5) recos.push("Aborder l'hygiène de sommeil (horaires réguliers, écrans) : impact direct sur la récupération.");
  if (h?.pain_zones?.length) recos.push(`Adapter les exercices : ${h.pain_zones.map((z) => PAIN_TIPS[z] ?? z.toLowerCase()).join(" ; ")}.`);
  if (f.wDelta !== null && Math.abs(f.wDelta) <= 0.2) recos.push(f.lossGoal ? "Plateau de poids : ajouter 2 blocs cardio de 20 min et revoir l'alimentation." : "Plateau : augmenter légèrement l'apport calorique et le volume de travail.");
  if (f.weights.length < 2) recos.push("Prendre une nouvelle mesure pour suivre l'évolution.");
  if (!d.next && d.client.status === "actif") recos.push("Aucune séance planifiée : programmer la prochaine.");
  if (!recos.length) recos.push("Maintenir le programme actuel et réévaluer lors du prochain bilan mensuel.");

  const tone = watch.length === 0 ? "Très bonne dynamique" : watch.length <= 2 ? "Bonne dynamique, quelques points d'attention" : "Plusieurs signaux à surveiller";
  return {
    source: "auto",
    headline: `${tone} pour ${d.first}.`,
    sections: [
      { key: "forts", title: "Points forts", items: forts.length ? forts : ["Pas encore assez de données pour dégager des points forts."] },
      { key: "surveiller", title: "À surveiller", items: watch.length ? watch : ["Rien d'inquiétant dans les données récentes."] },
      { key: "recos", title: "Recommandations", items: recos.slice(0, 6) },
    ],
  };
}

function autoAdjust(d: Data, f: Facts): AiSections {
  const items: string[] = [];
  const watch: string[] = [];
  if (d.program) items.push(`Programme de référence : ${d.program}.`);
  if (f.rpe !== null) {
    if (f.rpe >= 8.5) items.push("Décharge d'une semaine : -30 % de volume (séries), charges maintenues, RPE cible 6-7.");
    else if (f.rpe < 6) items.push("Surcharge progressive : +2,5 à 5 % sur les mouvements principaux, ou +1 répétition par série.");
    else items.push("Intensité adaptée : poursuivre la progression linéaire (+2,5 % toutes les 1 à 2 semaines).");
  }
  if (f.rate !== null && f.rate < 60) items.push("Assiduité faible : passer à des séances plus courtes (40 min, full body) pour faciliter la régularité.");
  if (f.wDelta !== null && Math.abs(f.wDelta) <= 0.2)
    items.push(f.lossGoal ? "Plateau de poids : ajouter 2 × 20 min de cardio zone 2 ou un finisher HIIT de 8 min." : "Plateau : ajouter une série sur les exercices polyarticulaires et vérifier l'apport en protéines.");
  if (f.sqDelta !== null && f.sqDelta <= 0) items.push("Force stagnante : varier le schéma de répétitions (5×5 → 4×8) pendant 3 semaines.");
  const h = f.hc;
  if (h?.pain_zones?.length) for (const z of h.pain_zones) items.push(`Adaptation ${PAIN_TIPS[z] ?? z.toLowerCase()}.`);
  if (h?.recovery !== null && h?.recovery !== undefined && h.recovery <= 4) items.push("Récupération faible : 48 h entre deux séances lourdes du même groupe musculaire, ajouter mobilité en fin de séance.");
  if (f.highBp || h?.parq_positive) watch.push("Ne pas augmenter l'intensité avant validation médicale (tension / PAR-Q).");
  if (h?.injuries) watch.push(`Tenir compte de : ${h.injuries}.`);
  if (!items.length) items.push("Les données ne montrent pas de besoin d'ajustement : maintenir le programme et réévaluer dans 2 semaines.");
  return {
    source: "auto",
    headline: `Propositions d'ajustement pour ${d.first}.`,
    sections: [
      { key: "ajustements", title: "Ajustements proposés", items },
      ...(watch.length ? [{ key: "surveiller" as const, title: "Précautions", items: watch }] : []),
    ],
  };
}

function autoDraft(d: Data, f: Facts, intent: DraftIntent): string {
  const n = d.first;
  const when = d.next ? fmtWhen(d.next.starts_at) : null;
  const win =
    f.goals.find((x) => x.g.status === "atteint")?.g.title ??
    (f.wDelta !== null && (f.lossGoal ? f.wDelta < -0.2 : f.wDelta > 0.2) ? `${signed(Math.round(f.wDelta * 10) / 10, "kg")} sur la balance` : null) ??
    (f.sqDelta && f.sqDelta > 0 ? `+${f.sqDelta} kg au squat` : null);
  switch (intent) {
    case "motivation":
      return `Salut ${n} 💪\n\nJe voulais te dire que je vois tes efforts${f.rate !== null && f.rate >= 70 ? ` : ${f.done.length} séances sur les ${f.past.length} dernières, c'est solide` : ""}. ${win ? `Déjà ${win}, ` : ""}continue comme ça, chaque séance te rapproche de ton objectif${d.client.goal ? ` (${d.client.goal.toLowerCase()})` : ""}.\n\n${when ? `On se voit ${when} !` : "On cale ta prochaine séance ?"}`;
    case "rappel":
      return when
        ? `Bonjour ${n} 👋\n\nPetit rappel : ta séance${d.next ? ` « ${d.next.type} »` : ""} est prévue ${when} au Complexe Moov'Up.\nPense à ta bouteille d'eau et ta serviette. À tout à l'heure !`
        : `Bonjour ${n} 👋\n\nTu n'as pas encore de séance planifiée cette semaine. Quel créneau t'arrangerait ? Je te le réserve.`;
    case "felicitations":
      return `Bravo ${n} 🎉\n\n${win ? `${win[0]!.toUpperCase()}${win.slice(1)} : ` : ""}c'est le résultat de ton travail et de ta régularité. Je suis fier de ta progression !\n\nOn continue sur cette lancée${when ? `, rendez-vous ${when}` : ""} 💪`;
    case "relance":
      return `Salut ${n}, j'espère que tout va bien 🙂\n\nJe ne t'ai pas vu${f.daysSince ? ` depuis ${f.daysSince} jours` : " ces derniers temps"} et je voulais prendre de tes nouvelles. Pas de souci si tu as eu un empêchement, l'important c'est de reprendre en douceur.\n\nDis-moi quel créneau te conviendrait cette semaine, je m'adapte.`;
  }
}

function autoAnswer(d: Data, f: Facts, q: string): string {
  const s = q.toLowerCase();
  const sum = autoSummary(d, f);
  const pick = (re: RegExp) => sum.sections.flatMap((x) => x.items).filter((i) => re.test(i.toLowerCase()));
  let lines: string[] = [];
  if (/poids|kilo|maigr|masse grasse|graisse/.test(s)) lines = pick(/poids|masse grasse|plateau/);
  else if (/présence|presence|assidu|absen|séance|seance|vient/.test(s)) lines = pick(/assiduité|absence|séance/);
  else if (/douleur|bless|santé|sante|tension|mal|dos|genou/.test(s)) lines = pick(/douleur|blessure|tension|par-q|sommeil|stress|récupération/);
  else if (/objectif|but|cible/.test(s)) lines = f.goals.map(({ g, pct }) => `${g.title} : ${pct !== null ? `${pct} %` : "–"} (${g.status.replace("_", " ")}).`);
  else if (/programme|ajust|charge|volume|intensit|rpe/.test(s)) lines = autoAdjust(d, f).sections[0]!.items;
  else if (/motiv|moral|énergie|energie|sommeil|stress/.test(s)) lines = pick(/motivation|énergie|sommeil|stress/);
  if (!lines.length) lines = [sum.headline, ...sum.sections.map((x) => `${x.title} : ${x.items[0]}`)];
  return lines.map((l) => `• ${l}`).join("\n");
}

/* ===================== Claude ===================== */
const SYSTEM = `Tu es l'assistant des coachs du Complexe Moov'Up Sports (salle de sport à Agadir, Maroc).
Tu aides un coach sportif à suivre ses adhérents à partir des données fournies.
Règles :
- Réponds en français, de façon concise, concrète et actionnable.
- Appuie-toi uniquement sur les données fournies ; si une information manque, dis-le.
- Tu n'es pas médecin : ne pose jamais de diagnostic et ne prescris aucun traitement. Pour tout signal de santé (tension élevée, douleur persistante, PAR-Q positif), recommande l'avis d'un professionnel de santé.
- Pas de conseils nutritionnels extrêmes ni de compléments.`;

let _client: Anthropic | null = null;
function anthropic() {
  _client ??= new Anthropic({ timeout: 90_000, maxRetries: 1 });
  return _client;
}

class AiRefusal extends Error {}

async function callClaude(opts: {
  system: string;
  messages: Anthropic.Beta.BetaMessageParam[];
  effort: "low" | "medium";
  schema?: Record<string, unknown>;
}): Promise<string> {
  const res = await anthropic().beta.messages.create({
    model: AI_MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: opts.system,
    messages: opts.messages,
    output_config: { effort: opts.effort, ...(opts.schema ? { format: { type: "json_schema", schema: opts.schema } } : {}) },
  });
  if (res.stop_reason === "refusal") throw new AiRefusal("refus");
  return res.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

function errorNote(e: unknown) {
  if (e instanceof AiRefusal) return "Claude n'a pas pu traiter cette demande : analyse automatique affichée.";
  if (e instanceof Anthropic.AuthenticationError) return "Clé API Claude invalide : analyse automatique affichée.";
  if (e instanceof Anthropic.RateLimitError) return "Claude est momentanément saturé : analyse automatique affichée.";
  if (e instanceof Anthropic.APIError) return `Claude indisponible (${e.status ?? "réseau"}) : analyse automatique affichée.`;
  return "Claude indisponible : analyse automatique affichée.";
}

const SECTIONS_SCHEMA = (keys: { key: string; title: string }[]) => ({
  type: "object",
  additionalProperties: false,
  required: ["headline", ...keys.map((k) => k.key)],
  properties: {
    headline: { type: "string", description: "Une phrase de synthèse" },
    ...Object.fromEntries(keys.map((k) => [k.key, { type: "array", items: { type: "string" }, description: k.title }])),
  },
});

const NO_DATA: AiSections = { source: "auto", headline: "Client introuvable.", sections: [] };

/* ===================== API publique ===================== */
export async function summarizeClient(clientId: string): Promise<AiSections> {
  const d = await loadData(clientId);
  if (!d) return NO_DATA;
  const f = computeFacts(d);
  if (!aiEnabled()) return autoSummary(d, f);
  const keys = [
    { key: "forts", title: "Points forts" },
    { key: "surveiller", title: "À surveiller" },
    { key: "recos", title: "Recommandations" },
  ] as const;
  try {
    const raw = await callClaude({
      system: SYSTEM,
      effort: "medium",
      schema: SECTIONS_SCHEMA([...keys]),
      messages: [
        {
          role: "user",
          content: `Données de l'adhérent :\n${buildContext(d)}\n\nFais une synthèse pour le coach : une phrase de synthèse, puis 2 à 5 points courts par rubrique (Points forts, À surveiller, Recommandations). Chiffre les tendances quand c'est possible.`,
        },
      ],
    });
    const j = JSON.parse(raw) as Record<string, string[] | string>;
    return {
      source: "claude",
      headline: String(j.headline ?? ""),
      sections: keys.map((k) => ({ key: k.key, title: k.title, items: (j[k.key] as string[]) ?? [] })),
    };
  } catch (e) {
    return { ...autoSummary(d, f), note: errorNote(e) };
  }
}

export async function suggestAdjustments(clientId: string): Promise<AiSections> {
  const d = await loadData(clientId);
  if (!d) return NO_DATA;
  const f = computeFacts(d);
  if (!aiEnabled()) return autoAdjust(d, f);
  try {
    const raw = await callClaude({
      system: SYSTEM,
      effort: "medium",
      schema: SECTIONS_SCHEMA([
        { key: "ajustements", title: "Ajustements proposés" },
        { key: "precautions", title: "Précautions" },
      ]),
      messages: [
        {
          role: "user",
          content: `Données de l'adhérent :\n${buildContext(d)}\n\nPropose 3 à 6 ajustements concrets du programme d'entraînement (volume, intensité, choix d'exercices, fréquence) justifiés par les données, puis les précautions éventuelles (liste vide s'il n'y en a pas).`,
        },
      ],
    });
    const j = JSON.parse(raw) as { headline?: string; ajustements?: string[]; precautions?: string[] };
    return {
      source: "claude",
      headline: j.headline ?? "",
      sections: [
        { key: "ajustements", title: "Ajustements proposés", items: j.ajustements ?? [] },
        ...(j.precautions?.length ? [{ key: "surveiller" as const, title: "Précautions", items: j.precautions }] : []),
      ],
    };
  } catch (e) {
    return { ...autoAdjust(d, f), note: errorNote(e) };
  }
}

const INTENT_BRIEF: Record<DraftIntent, string> = {
  motivation: "un message de motivation personnalisé",
  rappel: "un rappel de sa prochaine séance (date, heure, type) ; s'il n'y en a pas, propose de caler un créneau",
  felicitations: "un message de félicitations pour un progrès réel visible dans les données",
  relance: "une relance bienveillante après ses absences, sans culpabiliser",
};

export async function draftMessage(clientId: string, intent: DraftIntent): Promise<AiText> {
  const d = await loadData(clientId);
  if (!d) return { source: "auto", text: "" };
  const f = computeFacts(d);
  if (!aiEnabled()) return { source: "auto", text: autoDraft(d, f, intent) };
  try {
    const text = await callClaude({
      system: SYSTEM,
      effort: "low",
      messages: [
        {
          role: "user",
          content: `Données de l'adhérent :\n${buildContext(d)}\n\nRédige ${INTENT_BRIEF[intent]}, à envoyer par WhatsApp de la part de son coach. Tutoie l'adhérent, appelle-le par son prénom, 3 à 5 phrases, chaleureux et naturel, 1 ou 2 émojis maximum. Ne mentionne aucune donnée de santé. Réponds uniquement avec le texte du message.`,
        },
      ],
    });
    return { source: "claude", text };
  } catch (e) {
    return { source: "auto", text: autoDraft(d, f, intent), note: errorNote(e) };
  }
}

export async function askAboutClient(clientId: string, question: string, history: ChatTurn[] = []): Promise<AiText> {
  const q = question.trim().slice(0, 1000);
  const d = await loadData(clientId);
  if (!d || !q) return { source: "auto", text: "Question vide ou client introuvable." };
  const f = computeFacts(d);
  if (!aiEnabled()) return { source: "auto", text: autoAnswer(d, f, q) };
  const past = history
    .slice(-6)
    .filter((t) => t.content.trim())
    .map((t) => ({ role: t.role, content: t.content.slice(0, 2000) }) as Anthropic.Beta.BetaMessageParam);
  while (past.length && past[0]!.role !== "user") past.shift();
  try {
    const text = await callClaude({
      system: `${SYSTEM}\n\nDonnées de l'adhérent :\n${buildContext(d)}`,
      effort: "low",
      messages: [...past, { role: "user", content: q }],
    });
    return { source: "claude", text };
  } catch (e) {
    return { source: "auto", text: autoAnswer(d, f, q), note: errorNote(e) };
  }
}
