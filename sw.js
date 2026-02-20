// MOTOIL — Service Worker
// Strategia: Cache-First per assets locali, Network-First per Google Fonts

const CACHE_NAME = 'motoil-v1';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
];

// Font da Google Fonts (cacheati al primo caricamento)
const FONT_ORIGINS = ['https://fonts.googleapis.com', 'https://fonts.gstatic.com'];

// ── INSTALL: pre-cacha gli asset principali ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ── ACTIVATE: elimina vecchie cache ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH: strategia ibrida ──
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Font Google: Cache-First (stale-while-revalidate)
  if (FONT_ORIGINS.some(origin => event.request.url.startsWith(origin))) {
    event.respondWith(
      caches.open(CACHE_NAME).then(cache =>
        cache.match(event.request).then(cached => {
          const networkFetch = fetch(event.request).then(response => {
            cache.put(event.request, response.clone());
            return response;
          }).catch(() => cached); // se offline, usa il cache
          return cached || networkFetch;
        })
      )
    );
    return;
  }

  // Asset locali: Cache-First
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          // Cacha la risposta per dopo
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        }).catch(() => {
          // Fallback: se è una navigazione, ritorna index.html
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
        });
      })
    );
    return;
  }

  // Tutto il resto: rete normale
  event.respondWith(fetch(event.request));
});
