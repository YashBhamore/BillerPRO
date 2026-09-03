// BillerPRO Service Worker — v5
// Only caches navigation (HTML). All JS/CSS assets go straight to network.
// This prevents the "text/html MIME type" crash on module scripts.
// Also receives files shared from WhatsApp via the Web Share Target API.
//
// NOTE: this file — public/sw.js — is the one that actually ships. Vite copies
// public/ into dist/ verbatim; a sw.js at the project root is NOT part of the
// build. Bump CACHE_NAME *here* to push an update to installed PWAs.

const CACHE_NAME = 'billerpro-v5';

// Separate cache for an incoming shared file. Kept apart from CACHE_NAME so the
// activate handler below does not delete a share that is mid-flight.
const SHARE_CACHE = 'billerpro-share';
const SHARE_KEY = '/pending-share';

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
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME && k !== SHARE_CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // ── Web Share Target ──────────────────────────────────────────────────────
  // Sharing a bill from WhatsApp makes Android POST it here. Must be handled
  // before the non-GET passthrough below, or the file goes to the network and
  // is lost.
  //
  // The file is always stashed in a cache and the browser is then redirected to
  // the app, which picks it up on load. An earlier draft tried to postMessage
  // the file to an already-open window instead, but that races with the
  // redirect replacing that very window — the file could vanish. Going through
  // the cache means one code path whether or not the app was already open.
  if (request.method === 'POST' && url.pathname === '/share-target') {
    event.respondWith((async () => {
      try {
        const formData = await request.formData();
        const file = formData.get('file');
        if (file && typeof file.arrayBuffer === 'function' && file.size > 0) {
          const cache = await caches.open(SHARE_CACHE);
          await cache.put(SHARE_KEY, new Response(file, {
            headers: {
              'Content-Type': file.type || 'application/octet-stream',
              // Header values must be ASCII; filenames often are not.
              'X-File-Name': encodeURIComponent(file.name || 'shared-bill'),
              'X-Shared-At': String(Date.now()),
            },
          }));
        }
      } catch (err) {
        console.error('Share target error:', err);
      }
      // 303 so the browser follows with a GET. Absolute URL on purpose:
      // Response.redirect resolves a relative URL against the caller's base,
      // which is the worker script's location rather than the page's.
      return Response.redirect(new URL('/?tab=upload', self.location.origin).href, 303);
    })());
    return;
  }

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
