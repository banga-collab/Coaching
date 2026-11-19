#!/usr/bin/env node
/**
 * Test automatique des accès Moov'Up (Node 18+, aucune dépendance).
 *
 *   1. Lancer le serveur en mode démo : NEXT_PUBLIC_DEMO=1 (ex. npx next dev -p 3100)
 *   2. node scripts/test-acces.mjs [baseUrl]          (défaut : http://localhost:3100)
 *
 * Pour chaque compte de démo (cookie demo_user=<id>), chaque route est demandée sans suivre
 * les redirections : 200 = autorisé, 30x = refusé, 404 = page retirée (fonctions d'argent supprimées).
 * Un 404 inattendu / « Application error » est un échec, tout comme une redirection vers /login
 * (le serveur n'est pas en mode démo ou le cookie est ignoré).
 * Sortie : tableau PASS/FAIL, code 1 en cas d'échec.
 *
 * ⚠ Attentes dupliquées depuis src/components/admin/access-spec.ts : garder les deux synchronisées.
 */

const base = (process.argv[2] || process.env.BASE_URL || "http://localhost:3100").replace(/\/+$/, "");
const TIMEOUT = Number(process.env.TIMEOUT_MS || 120000);

const USERS = [
  { role: "admin", id: "00000000-0000-4000-8000-000000000001", name: "Yassine (admin)" },
  { role: "head_coach", id: "00000000-0000-4000-8000-000000000004", name: "Rachid (head coach)" },
  { role: "coach", id: "00000000-0000-4000-8000-000000000003", name: "Sara (coach)" },
  { role: "client", id: "00000000-0000-4000-8000-000000000002", name: "Karim (adhérent)" },
];

const STAFF = ["admin", "head_coach", "coach"];
const ALL = [...STAFF, "client"];
// [route, rôles autorisés (200), options] — les autres rôles doivent être redirigés (30x).
// { gone: true } : page retirée → 404 attendu pour tous. [] sans gone : redirection pour tous.
const ROUTES = [
  ["/", STAFF],
  ["/clients", STAFF],
  ["/seances", STAFF],
  ["/seances/types", STAFF],
  ["/coachs", STAFF],
  ["/planning", ["admin", "head_coach"]],
  ["/disponibilites", STAFF],
  ["/reclamations", STAFF],
  ["/reclamations/nouvelle", STAFF],
  ["/admin", ["admin"]],
  ["/admin/coachs", ["admin"]],
  ["/admin/controle", ["admin"]],
  ["/pointage", STAFF],
  ["/admin/acces", ["admin"]],
  ["/parametres", ["admin"]],
  ["/integrations", ["admin"]],
  ["/automatisations", ["admin", "head_coach"]],
  ["/whatsapp", ["admin", "head_coach"]],
  ["/moi", ALL], // le personnel voit « compte non relié » (200)
  ["/moi/bilan", ["client"]], // le personnel est renvoyé vers /moi
  ["/equipe", []], // ancienne page → /admin/coachs
  // Pages retirées avec les fonctions d'argent
  ["/tarifs", [], { gone: true }],
  ["/encaissements", [], { gone: true }],
  ["/facturation", [], { gone: true }],
  ["/abonnements", [], { gone: true }],
  ["/acces", [], { gone: true }],
  ["/parrainage", [], { gone: true }],
  ["/paiement", [], { gone: true }],
  ["/moi/carte", [], { gone: true }],
  ["/moi/parrainage", [], { gone: true }],
  ["/admin/paiements", [], { gone: true }],
  ["/admin/commissions", [], { gone: true }],
];

function classify(status, location, body) {
  if (status >= 300 && status < 400) return { got: "redirect", detail: location || "" };
  if (status === 404) return { got: "notfound", detail: "" };
  if (status >= 500) return { got: "error", detail: `HTTP ${status}` };
  if (body.includes("__next-page-redirect") || body.includes("NEXT_REDIRECT")) return { got: "redirect", detail: "redirection côté client" };
  if (body.includes("NEXT_HTTP_ERROR_FALLBACK;404")) return { got: "notfound", detail: "" };
  if (body.includes("Application error") || body.includes("Internal Server Error")) return { got: "error", detail: "Application error" };
  return { got: "ok", detail: "" };
}

async function check(user, route, allowed, opts = {}) {
  const expected = opts.gone ? "notfound" : allowed.includes(user.role) ? "ok" : "redirect";
  try {
    const res = await fetch(base + route, {
      redirect: "manual",
      headers: { cookie: `demo_user=${user.id}` },
      signal: AbortSignal.timeout(TIMEOUT),
    });
    const location = res.headers.get("location");
    const body = res.status === 200 ? await res.text() : (await res.body?.cancel(), "");
    const { got, detail } = classify(res.status, location, body);
    const toLogin = got === "redirect" && location && new URL(location, base).pathname === "/login";
    return { user, route, expected, got, status: res.status, detail: toLogin ? `${location} (session non reconnue)` : detail, pass: got === expected && !toLogin };
  } catch (e) {
    return { user, route, expected, got: "error", status: 0, detail: e?.cause?.code || e?.message || String(e), pass: false };
  }
}

const pad = (s, n) => String(s).padEnd(n).slice(0, n);
const color = (ok, s) => (process.stdout.isTTY ? `\x1b[${ok ? 32 : 31}m${s}\x1b[0m` : s);
const LABEL = { ok: "200", redirect: "30x", notfound: "404", error: "ERR" };

async function main() {
  console.log(`\nTest des accès Moov'Up — ${base}\n`);
  // Préchauffage (compilation à la demande en dev) + vérification que le serveur répond
  try {
    await fetch(base + "/login", { redirect: "manual", signal: AbortSignal.timeout(TIMEOUT) });
  } catch (e) {
    console.error(`Serveur injoignable sur ${base} (${e?.cause?.code || e?.message}). Lance-le d'abord en mode démo.`);
    process.exit(2);
  }

  const results = [];
  for (const user of USERS) {
    // Séquentiel par utilisateur, routes en parallèle par petits lots
    const batch = 4;
    for (let i = 0; i < ROUTES.length; i += batch) {
      results.push(...(await Promise.all(ROUTES.slice(i, i + batch).map(([r, a, o]) => check(user, r, a, o)))));
    }
  }

  console.log(`${pad("Compte", 22)}${pad("Route", 22)}${pad("Attendu", 10)}${pad("Obtenu", 10)}${pad("Résultat", 10)}Détail`);
  console.log("-".repeat(100));
  let last = "";
  for (const r of results) {
    if (last && last !== r.user.role) console.log("");
    last = r.user.role;
    const got = `${LABEL[r.got]}${r.status && r.got !== "ok" ? ` ${r.status}` : ""}`;
    console.log(
      `${pad(r.user.name, 22)}${pad(r.route, 22)}${pad(LABEL[r.expected], 10)}${pad(got, 10)}${color(r.pass, pad(r.pass ? "PASS" : "FAIL", 10))}${r.detail || ""}`,
    );
  }
  const failed = results.filter((r) => !r.pass);
  console.log("-".repeat(100));
  console.log(color(!failed.length, failed.length ? `${failed.length} échec(s) sur ${results.length} vérifications` : `OK : ${results.length} vérifications conformes`));
  process.exit(failed.length ? 1 : 0);
}

main();
