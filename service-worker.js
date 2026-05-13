/* ============================================================
   Mon SMV · Service Worker · stale-while-revalidate pour les assets statiques.
   On ne cache PAS les appels Supabase (toujours en réseau).
   ============================================================ */
const VERSION = 'mon-smv-v6';
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
  './assets/supabase-client.js',
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

  // Ne PAS cacher Supabase ni esm.sh (toujours en réseau)
  if (url.hostname.endsWith('supabase.co') ||
      url.hostname.endsWith('supabase.in') ||
      url.hostname.includes('esm.sh') ||
      url.hostname.includes('googleapis.com') ||
      url.hostname.includes('gstatic.com')) {
    return; // navigateur gère normalement
  }

  // Cache stale-while-revalidate pour les assets locaux
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
