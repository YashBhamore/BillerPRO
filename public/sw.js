// BillerPRO Service Worker — v4
// Only caches navigation (HTML). All JS/CSS assets go straight to network.
// This prevents the "text/html MIME type" crash on module scripts.
//
// NOTE: this file — public/sw.js — is the one that actually ships. Vite copies
// public/ into dist/ verbatim; a sw.js at the project root is NOT part of the
// build. Bump CACHE_NAME *here* to push an update to installed PWAs.

const CACHE_NAME = 'billerpro-v4';

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.add('/'))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Always go to network for: API calls, JS, CSS, images, fonts, non-GET
  if (
    request.method !== 'GET' ||
    url.pathname.startsWith('/api/') ||
    url.pathname.match(/\.(m?js|css|png|svg|ico|woff|woff2|ttf|json)$/)
  ) {
    event.respondWith(fetch(request));
    return;
  }

  // Navigation requests (HTML pages) — network first, fall back to cache
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match('/'))
    );
    return;
  }

  // Everything else — straight to network
  event.respondWith(fetch(request));
});
