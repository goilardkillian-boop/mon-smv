/* ============================================================
   Mon SMV · Service Worker · cache-first pour les assets
   Version cassée à chaque déploiement pour invalider le cache.
   ============================================================ */
const VERSION = 'mon-smv-v4';
const CORE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/styles.css',
  './assets/app.js',
  './assets/icons.js',
  './assets/db.js',
  './assets/auth.js',
  './assets/seed.js',
  './assets/screens-admin.js',
  './assets/img/logo.svg',
  './assets/img/blob-fluo.svg',
  './assets/img/blob-dots.svg',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  // Stale-while-revalidate
  e.respondWith(
    caches.open(VERSION).then(async (cache) => {
      const cached = await cache.match(e.request);
      const network = fetch(e.request).then((res) => {
        if (res && res.status === 200 && (url.origin === location.origin)) cache.put(e.request, res.clone());
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
