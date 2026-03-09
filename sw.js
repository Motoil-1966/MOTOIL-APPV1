const CACHE_NAME = 'motoil-v3'; // incrementa versione ad ogni deploy

const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
];

// Installa e mette in cache le risorse principali
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
});

// Rimuove le vecchie cache e prende possesso dei client
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// Strategia: network-first con fallback su cache
// Se la rete è assente, risponde dalla cache (fondamentale per iOS)
self.addEventListener('fetch', event => {
  // Ignora richieste non-GET e richieste cross-origin
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith(self.location.origin)) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Aggiorna la cache solo con risposte valide
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        // Rete non disponibile: usa la cache
        return caches.match(event.request).then(cached => {
          if (cached) return cached;
          // Fallback finale per navigazione: restituisce index.html dalla cache
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
          return new Response('Offline', { status: 503 });
        });
      })
  );
});
