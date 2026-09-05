// Zenith — Service Worker (offline support)
const CACHE_NAME = 'zenith-cache-v1';

const PRECACHE_URLS = [
  'index.html',
  'manifest.json',
  'icon-192.png',
  'icon-512.png',
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js'
];

// ---- INSTALL: pre-cache the app shell + CDN assets ----
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.allSettled(
        PRECACHE_URLS.map((url) =>
          cache.add(new Request(url, { mode: 'cors' })).catch(() => {
            // Some CDN resources may reject a plain cors request; retry as no-cors
            // so the (opaque) response is still cached for offline use.
            return cache.add(new Request(url, { mode: 'no-cors' })).catch(() => null);
          })
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// ---- ACTIVATE: clean up old cache versions ----
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))
      )
    ).then(() => self.clients.claim())
  );
});

// ---- FETCH ----
// Navigations (the page itself): network-first, falling back to the cached
// shell when offline, so users always get the latest version when online.
// Everything else (CSS/JS/fonts/images): cache-first, filling the cache
// on first successful network fetch, so repeat visits work fully offline.
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('index.html', copy));
          return response;
        })
        .catch(() => caches.match('index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => cached);
    })
  );
});
