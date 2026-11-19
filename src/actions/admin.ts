"use server";

/**
 * Actions de l'espace admin (gestion des coachs). Chaque action revérifie le rôle admin côté serveur.
 * Mode démo : les profils sont créés directement dans la base en mémoire.
 * Mode réel : un profil doit correspondre à un compte Supabase Auth → création / invitation via la clé
 * service-role (SUPABASE_SERVICE_ROLE_KEY, jamais exposée au navigateur).
 */
import { randomBytes, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient as createSupabase, type SupabaseClient } from "@supabase/supabase-js";
import { getProfile } from "@/lib/auth";
import { DEMO } from "@/lib/demo";
import { createClient } from "@/lib/supabase/server";
import type { Profile, Role } from "@/lib/types";
import { ROUTE_EXPECTATIONS, TEST_USERS, classify, expectedFor, type Check } from "@/components/admin/access-spec";
import { handoverCount, handoverSummary, loadHandover } from "@/app/admin/coachs/handover-data";

export type AdminFormState = { error?: string; ok?: string; secret?: string } | undefined;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STAFF: Role[] = ["admin", "head_coach", "coach"];

/** Client service-role (contourne la RLS) — null si la clé n'est pas configurée ou en démo. */
function adminAuthClient(): SupabaseClient | null {
  if (DEMO) return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createSupabase(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function assertAdmin() {
  const me = await getProfile();
  return me.role === "admin" && me.active !== false ? me : null;
}

const specialtiesOf = (v: FormDataEntryValue | null) =>
  [...new Set(String(v ?? "").split(/[,;\n]/).map((s) => s.trim()).filter(Boolean))].slice(0, 12).map((s) => s.slice(0, 40));
const clean = (v: FormDataEntryValue | null, max = 120) => String(v ?? "").trim().slice(0, max);

function refresh() {
  revalidatePath("/admin", "layout");
  revalidatePath("/", "layout");
}

/** Nombre d'admins actifs autres que `exceptId` (on garde toujours au moins un admin). */
async function otherActiveAdmins(supabase: SupabaseClient, exceptId: string) {
  const { data } = await supabase.from("profiles").select("id, active").eq("role", "admin");
  return ((data ?? []) as Pick<Profile, "id" | "active">[]).filter((p) => p.id !== exceptId && p.active !== false).length;
}

const isStaff = (role: string | null | undefined) => STAFF.includes(role as Role);

/**
 * Un adhérent promu dans l'équipe ne doit plus être relié à un dossier client (sinon il garderait
 * l'espace adhérent et ses données de membre). On délie le dossier et on renvoie un avertissement.
 */
async function unlinkMemberFile(supabase: SupabaseClient, profileId: string): Promise<{ error?: string; warning?: string }> {
  const { data } = await supabase.from("clients").select("id, full_name").eq("user_id", profileId);
  const files = (data ?? []) as { id: string; full_name: string }[];
  if (!files.length) return {};
  const { error } = await supabase.from("clients").update({ user_id: null }).eq("user_id", profileId);
  if (error) return { error: `Impossible de délier son dossier adhérent : ${error.message}` };
  return {
    warning: ` Attention : son dossier adhérent (${files.map((f) => f.full_name).join(", ")}) a été délié de ce compte ; l'historique du dossier est conservé mais il n'a plus accès à l'espace adhérent.`,
  };
}

/**
 * Passation avant désactivation / retour au rôle adhérent : transfère les clients actifs (coach référent)
 * et les séances à venir à `toId`. Les séances transférées repartent « à confirmer » (planifiee),
 * affectées par l'admin, et le nouveau coach est notifié. Renvoie une erreur si un transfert est
 * nécessaire mais impossible (pas de coach choisi, coach invalide).
 */
async function handOver(supabase: SupabaseClient, me: Profile, from: Profile, toId: string): Promise<{ error?: string; done?: string }> {
  const work = await loadHandover(supabase, from.id);
  if (!handoverCount(work)) return {};
  const name = from.full_name || from.email;
  if (!toId) {
    return { error: `${name} a encore ${handoverSummary(work)}. Choisis à qui les transférer (« Transférer à ») avant de continuer.` };
  }
  if (toId === from.id) return { error: "Choisis un autre coach que celui qui quitte l'équipe." };
  const { data: t } = await supabase.from("profiles").select("id, role, active, full_name, email").eq("id", toId).maybeSingle();
  const to = t as Profile | null;
  if (!to || !isStaff(to.role) || to.active === false) return { error: "Le coach choisi pour le transfert n'est pas un membre actif de l'équipe." };

  if (work.clients.length) {
    const { error } = await supabase.from("clients").update({ coach_id: to.id }).in("id", work.clients.map((c) => c.id));
    if (error) return { error: `Transfert des clients impossible : ${error.message}` };
  }
  if (work.sessions.length) {
    const self = to.id === me.id;
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("sessions")
      .update({ coach_id: to.id, status: self ? "acceptee" : "planifiee", assigned_by: me.id, responded_at: self ? now : null, response_note: null, proposed_at: null })
      .in("id", work.sessions.map((s) => s.id));
    if (error) return { error: `Transfert des séances impossible : ${error.message}` };
  }
  if (to.id !== me.id) {
    const sessionsTxt = work.sessions.length
      ? ` ${work.sessions.length} séance${work.sessions.length > 1 ? "s" : ""} à confirmer dans ton planning.`
      : "";
    await supabase.from("notifications").insert({
      user_id: to.id,
      title: `Reprise du suivi de ${name}`,
      body: `${handoverSummary(work)} t'${work.clients.length + work.sessions.length > 1 ? "ont" : "a"} été confié${work.clients.length + work.sessions.length > 1 ? "s" : ""}.${sessionsTxt}`,
      link: work.sessions.length ? "/seances" : "/clients",
      kind: "info",
      read: false,
    });
  }
  return { done: ` ${handoverSummary(work)} transféré${handoverCount(work) > 1 ? "s" : ""} à ${to.full_name || to.email}.` };
}

/* ================= Création ================= */
export async function createCoachAction(_: AdminFormState, fd: FormData): Promise<AdminFormState> {
  const me = await assertAdmin();
  if (!me) return { error: "Action réservée à l'administrateur." };

  const full_name = clean(fd.get("full_name"));
  const email = clean(fd.get("email"), 160).toLowerCase();
  const phone = clean(fd.get("phone"), 30) || null;
  const role = String(fd.get("role") ?? "coach") as Role;
  const mode = String(fd.get("mode") ?? "invite");
  if (!full_name) return { error: "Indique le nom complet." };
  if (!EMAIL.test(email)) return { error: "Adresse e-mail invalide." };
  if (role !== "coach" && role !== "head_coach") return { error: "Rôle invalide (coach ou head coach)." };
  const fields = { full_name, phone, role, active: true, specialties: specialtiesOf(fd.get("specialties")), espace: fd.get("espace") === "lady" ? "lady" : "mixte" };

  const supabase = await createClient();

  // 1. Le compte existe déjà (ex. le coach s'est inscrit lui-même) : on le promeut.
  const { data: existing } = await supabase.from("profiles").select("*").eq("email", email).maybeSingle();
  if (existing) {
    const ex = existing as Profile;
    if (ex.role === "admin") return { error: "Ce compte est administrateur : modifie-le depuis sa fiche." };
    // Adhérent promu : son dossier client est délié (un membre de l'équipe n'a pas d'espace adhérent)
    const unlink = ex.role === "client" ? await unlinkMemberFile(supabase, ex.id) : {};
    if (unlink.error) return { error: unlink.error };
    const { error } = await supabase.from("profiles").update(fields).eq("id", ex.id);
    if (error) return { error: `Mise à jour impossible : ${error.message}` };
    refresh();
    return { ok: `Compte existant (${email}) passé en ${role === "head_coach" ? "head coach" : "coach"}.${unlink.warning ?? ""}` };
  }

  // 2. Démo : profil créé directement en mémoire.
  if (DEMO) {
    const { error } = await supabase.from("profiles").insert({ id: randomUUID(), email, created_at: new Date().toISOString(), ...fields });
    if (error) return { error: error.message };
    refresh();
    return { ok: `${full_name} ajouté(e) à l'équipe (mode démo : pas de compte de connexion créé).` };
  }

  // 3. Réel : création du compte Auth via la clé service-role.
  const svc = adminAuthClient();
  if (!svc) {
    return {
      error:
        "Impossible de créer le compte : SUPABASE_SERVICE_ROLE_KEY n'est pas configurée sur le serveur. Ajoute-la (Vercel → Settings → Environment Variables), ou demande au coach de créer son compte sur /signup puis ajoute-le ici avec la même adresse e-mail : il sera promu.",
    };
  }
  let userId: string | null = null;
  let secret: string | undefined;
  if (mode === "password") {
    secret = `Moov-${randomBytes(6).toString("base64url")}`;
    const { data, error } = await svc.auth.admin.createUser({ email, password: secret, email_confirm: true, user_metadata: { full_name } });
    if (error) return { error: `Création du compte refusée : ${error.message}` };
    userId = data.user?.id ?? null;
  } else {
    const h = await headers();
    const base = (process.env.NEXT_PUBLIC_APP_URL || h.get("origin") || `https://${h.get("host")}`).replace(/\/+$/, "");
    const { data, error } = await svc.auth.admin.inviteUserByEmail(email, { data: { full_name }, redirectTo: `${base}/auth/callback` });
    if (error) return { error: `Invitation refusée : ${error.message}` };
    userId = data.user?.id ?? null;
  }
  if (!userId) return { error: "Compte créé mais identifiant introuvable : recharge la page." };

  // Le déclencheur handle_new_user a créé le profil en « client » (et l'a peut-être relié à un dossier
  // client de même e-mail) : on délie ce dossier, puis on applique le rôle avec la session de l'admin
  // (le déclencheur protect_role l'autorise) ; repli sur la clé service-role.
  const unlink = await unlinkMemberFile(supabase, userId);
  if (unlink.error) return { error: unlink.error };
  let { error } = await supabase.from("profiles").update(fields).eq("id", userId);
  if (error) ({ error } = await svc.from("profiles").update(fields).eq("id", userId));
  if (error) return { error: `Compte créé, mais le profil n'a pas pu être mis à jour (${error.message}). As-tu exécuté supabase/v5-roles.sql ?` };
  refresh();
  return mode === "password"
    ? { ok: `Compte créé pour ${email}. Communique-lui ce mot de passe provisoire (affiché une seule fois) :${unlink.warning ?? ""}`, secret }
    : { ok: `Invitation envoyée à ${email}. Le coach choisira son mot de passe en suivant le lien reçu.${unlink.warning ?? ""}` };
}

/* ================= Modification ================= */
/**
 * Profil, rôle et spécialités. Règles :
 * - impossible de retirer son propre rôle admin, il reste toujours un admin actif ;
 * - retour au rôle adhérent : passation obligatoire (clients actifs + séances à venir → `transfer_to`) ;
 * - adhérent promu dans l'équipe : son dossier client est délié (avertissement).
 */
export async function updateCoachAction(_: AdminFormState, fd: FormData): Promise<AdminFormState> {
  const me = await assertAdmin();
  if (!me) return { error: "Action réservée à l'administrateur." };
  const id = String(fd.get("id") ?? "");
  const role = String(fd.get("role") ?? "") as Role;
  if (!id) return { error: "Coach introuvable." };
  if (!STAFF.includes(role) && role !== "client") return { error: "Rôle invalide." };

  const supabase = await createClient();
  const { data: cur } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
  const target = cur as Profile | null;
  if (!target) return { error: "Coach introuvable." };
  if (target.role === "admin" && role !== "admin") {
    if (id === me.id) return { error: "Tu ne peux pas retirer ton propre rôle d'administrateur." };
    if ((await otherActiveAdmins(supabase, id)) < 1) return { error: "Il doit rester au moins un administrateur actif." };
  }

  let note = "";
  // Membre de l'équipe → adhérent : ses clients et séances à venir passent à un autre coach
  if (isStaff(target.role) && role === "client") {
    const h = await handOver(supabase, me, target, String(fd.get("transfer_to") ?? ""));
    if (h.error) return { error: h.error };
    note = h.done ?? "";
  }
  // Adhérent → équipe : on délie son dossier client
  if (target.role === "client" && isStaff(role)) {
    const u = await unlinkMemberFile(supabase, id);
    if (u.error) return { error: u.error };
    note = u.warning ?? "";
  }

  const full_name = clean(fd.get("full_name"));
  const { error } = await supabase
    .from("profiles")
    .update({
      ...(full_name ? { full_name } : {}),
      role,
      phone: clean(fd.get("phone"), 30) || null,
      specialties: specialtiesOf(fd.get("specialties")),
      espace: fd.get("espace") === "lady" ? "lady" : "mixte",
    })
    .eq("id", id);
  if (error) return { error: `Enregistrement impossible : ${error.message}${note ? ` (transfert déjà effectué :${note})` : ""}` };
  refresh();
  return { ok: `${role === "client" ? "Compte retiré de l'équipe (redevenu adhérent)." : "Modifications enregistrées."}${note}` };
}

/* ================= Activation / désactivation ================= */
async function setActive(me: Profile, id: string, active: boolean, transferTo: string): Promise<AdminFormState> {
  if (!id) return { error: "Coach introuvable." };
  if (id === me.id && !active) return { error: "Tu ne peux pas désactiver ton propre compte." };
  const supabase = await createClient();
  const { data: cur } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
  const target = cur as Profile | null;
  if (!target) return { error: "Coach introuvable." };
  if (!active && target.role === "admin" && (await otherActiveAdmins(supabase, id)) < 1) return { error: "Il doit rester au moins un administrateur actif." };

  let note = "";
  if (!active) {
    // Passation obligatoire : clients actifs et séances à venir (ses disponibilités restent enregistrées
    // mais ne sont plus proposées : un coach inactif est refusé à l'affectation).
    const h = await handOver(supabase, me, target, transferTo);
    if (h.error) return { error: h.error };
    note = h.done ?? "";
  }
  const { error } = await supabase.from("profiles").update({ active }).eq("id", id);
  if (error) return { error: `Enregistrement impossible : ${error.message}${note ? ` (transfert déjà effectué :${note})` : ""}` };
  // Réel : on bloque aussi la connexion (bannissement Supabase Auth), réversible.
  const svc = adminAuthClient();
  if (svc) {
    try {
      await svc.auth.admin.updateUserById(id, { ban_duration: active ? "none" : "876000h" });
    } catch {
      // Clé invalide : la désactivation du profil (RLS via is_staff) reste appliquée.
    }
  }
  refresh();
  return { ok: `${active ? "Compte réactivé." : "Compte désactivé."}${note}` };
}

/** Bouton simple (liste des coachs) : réactivation, ou désactivation d'un coach qui n'a rien à transférer. */
export async function setCoachActiveAction(fd: FormData) {
  const me = await assertAdmin();
  if (!me) return;
  await setActive(me, String(fd.get("id") ?? ""), String(fd.get("active")) === "1", String(fd.get("transfer_to") ?? ""));
}

/** Formulaire de la fiche coach : désactivation avec passation (« Transférer à »), message en retour. */
export async function deactivateCoachAction(_: AdminFormState, fd: FormData): Promise<AdminFormState> {
  const me = await assertAdmin();
  if (!me) return { error: "Action réservée à l'administrateur." };
  return setActive(me, String(fd.get("id") ?? ""), String(fd.get("active")) === "1", String(fd.get("transfer_to") ?? ""));
}

/* ================= Test automatique des accès (mode démo) ================= */
export type AccessTestResult = { error?: string; base?: string; checks?: Check[]; ms?: number } | undefined;

/**
 * Rejoue le test de scripts/test-acces.mjs depuis le serveur : chaque compte de démo (cookie demo_user)
 * demande chaque route sans suivre les redirections. Mode démo uniquement (en production, il faudrait de vraies sessions).
 */
export async function runAccessTestAction(): Promise<AccessTestResult> {
  const me = await assertAdmin();
  if (!me) return { error: "Action réservée à l'administrateur." };
  if (!DEMO) return { error: "Le test intégré fonctionne en mode démo (NEXT_PUBLIC_DEMO=1). En production, lance le script sur un serveur de démo." };
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const base = `${host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https"}://${host}`;
  const t0 = Date.now();
  const jobs = TEST_USERS.flatMap((u) => ROUTE_EXPECTATIONS.map((r) => ({ u, r })));
  const checks: Check[] = [];
  let i = 0;
  const worker = async () => {
    while (i < jobs.length) {
      const { u, r } = jobs[i++]!;
      const expected = expectedFor(r, u.role);
      try {
        const res = await fetch(base + r.route, { redirect: "manual", cache: "no-store", headers: { cookie: `demo_user=${u.id}` }, signal: AbortSignal.timeout(120000) });
        const body = res.status === 200 ? await res.text() : "";
        const location = res.headers.get("location");
        const { got, detail } = classify(res.status, location, body);
        const toLogin = got === "redirect" && !!location && new URL(location, base).pathname === "/login";
        checks.push({ role: u.role, route: r.route, expected, got, status: res.status, location: location ?? undefined, pass: got === expected && !toLogin, detail: toLogin ? "session non reconnue (/login)" : detail });
      } catch (e) {
        checks.push({ role: u.role, route: r.route, expected, got: "error", status: 0, pass: false, detail: e instanceof Error ? e.message : String(e) });
      }
    }
  };
  await Promise.all(Array.from({ length: 4 }, worker));
  const order = (c: Check) => TEST_USERS.findIndex((u) => u.role === c.role) * 100 + ROUTE_EXPECTATIONS.findIndex((r) => r.route === c.route);
  checks.sort((a, b) => order(a) - order(b));
  return { base, checks, ms: Date.now() - t0 };
}
