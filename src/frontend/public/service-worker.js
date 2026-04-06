const CACHE_NAME = 'flute-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/assets/generated/flute-icon-192.dim_192x192.png',
  '/assets/generated/flute-icon-256.dim_256x256.png',
  '/assets/generated/flute-icon-384.dim_384x384.png',
  '/assets/generated/flute-icon-transparent.dim_512x512.png',
];

// Cache static assets on install
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Clean old caches on activate
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch strategy: cache-first for static, network-only for API/streams
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Network-only for Piped API calls and audio streams
  if (
    url.hostname.includes('piped') ||
    url.hostname.includes('googlevideo') ||
    url.pathname.includes('/streams/') ||
    url.pathname.includes('/search')
  ) {
    return; // let browser handle it
  }

  // Cache-first for everything else (app shell)
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // If offline and not cached, return index.html for navigation requests
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
      });
    })
  );
});
