/* Service worker Moov'Up Coach — minimal : coque statique + page hors ligne. */
const VERSION = "moovup-v1";
const SHELL = ["/logo.png", "/icons/icon-192.png", "/icons/icon-512.png"];

const OFFLINE_HTML = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Hors ligne · Moov'Up</title>
<style>body{margin:0;min-height:100dvh;display:grid;place-items:center;background:#f4f6f8;color:#16212b;font:15px/1.5 system-ui,sans-serif;padding:24px;box-sizing:border-box}
.c{max-width:360px;text-align:center;background:#fff;border:1px solid #e5e9ee;border-radius:20px;padding:32px 24px}
img{width:72px;height:72px}h1{font-size:19px;margin:16px 0 6px}p{color:#66727e;margin:0 0 20px}
button{background:#1a6d8e;color:#fff;border:0;border-radius:12px;height:42px;padding:0 20px;font-weight:600;font-size:14px;cursor:pointer}</style></head>
<body><div class="c"><img src="/icons/icon-192.png" alt=""><h1>Vous êtes hors ligne</h1><p>Vérifiez votre connexion Internet puis réessayez. Vos données sont en sécurité.</p><button onclick="location.reload()">Réessayer</button></div></body></html>`;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((c) => c.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return; // jamais de POST / server actions
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api") || url.pathname.startsWith("/auth")) return;

  // Navigations : réseau d'abord (les pages privées ne sont pas mises en cache), page hors ligne sinon
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() => new Response(OFFLINE_HTML, { headers: { "Content-Type": "text/html; charset=utf-8" } })),
    );
    return;
  }

  // Ressources statiques versionnées : cache d'abord
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/") || url.pathname === "/logo.png") {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(VERSION).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
  }
});
