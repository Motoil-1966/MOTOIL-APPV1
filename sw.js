// MOTOIL — Service Worker v4
// Incrementa CACHE_NAME ad ogni deploy per forzare aggiornamento
const CACHE_NAME = 'motoil-v4';

const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
];

// ── INSTALL ───────────────────────────────────────────────────────────────
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .catch(err => console.warn('[SW] Pre-cache fallito:', err))
  );
});

// ── ACTIVATE ──────────────────────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
      .catch(err => console.warn('[SW] Activate error:', err))
  );
});

// ── FETCH ─────────────────────────────────────────────────────────────────
// IMPORTANTE: non deve MAI lanciare eccezioni non gestite.
// Un SW che crasha ripetutamente porta Chrome a de-registrarlo
// e rimuovere il WebAPK dall'launcher Android.
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  if (!req.url.startsWith(self.location.origin)) return;
  if (!req.url.startsWith('http')) return;

  event.respondWith(handleFetch(req));
});

async function handleFetch(req) {
  try {
    const networkResponse = await fetch(req);
    if (networkResponse && networkResponse.status === 200) {
      const clone = networkResponse.clone();
      caches.open(CACHE_NAME)
        .then(cache => cache.put(req, clone))
        .catch(() => {});
    }
    return networkResponse;
  } catch (_networkError) {
    const cached = await caches.match(req);
    if (cached) return cached;

    if (req.mode === 'navigate') {
      const shell = await caches.match('/index.html');
      if (shell) return shell;
    }

    return new Response('Offline', {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}
