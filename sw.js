// BillerPRO Service Worker — v3
// Handles PWA install caching + WhatsApp/share-target file interception

const CACHE_NAME = 'billerpro-v3';

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

// ── Share Target handler ───────────────────────────────────────────────────
// When the user shares a PDF/image from WhatsApp → BillerPRO,
// Android POSTs the file here. We save it to a temp store and redirect
// the app to the Upload tab with the file ready to process.
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Intercept the share-target POST
  if (url.pathname === '/share-target' && event.request.method === 'POST') {
    event.respondWith((async () => {
      try {
        const formData = await event.request.formData();
        const file = formData.get('file');

        if (file && file instanceof File) {
          // Store file in a broadcast so the app can pick it up
          const arrayBuffer = await file.arrayBuffer();
          const clients = await self.clients.matchAll({ type: 'window' });

          if (clients.length > 0) {
            // App is open — send file directly
            clients[0].postMessage({
              type: 'SHARE_TARGET_FILE',
              fileName: file.name,
              fileType: file.type,
              fileData: arrayBuffer,
            }, [arrayBuffer]);
            // Redirect to upload tab
            clients[0].focus();
            return Response.redirect('/?tab=upload', 303);
          } else {
            // App not open — store in cache temporarily, open app
            const cache = await caches.open('billerpro-share-tmp');
            await cache.put('/pending-share', new Response(arrayBuffer, {
              headers: {
                'Content-Type': file.type,
                'X-File-Name': file.name,
              }
            }));
          }
        }
      } catch (err) {
        console.error('Share target error:', err);
      }
      // Always redirect to app after handling
      return Response.redirect('/?tab=upload', 303);
    })());
    return;
  }

  // ── Normal fetch handling ─────────────────────────────────────────────────
  // Never intercept: API calls, JS/CSS assets (prevents MIME type crash)
  if (
    event.request.method !== 'GET' ||
    url.pathname.startsWith('/api/') ||
    url.pathname.match(/\.(js|css|png|svg|ico|woff|woff2|ttf|json)$/)
  ) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Navigation — network first, fall back to cached index
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match('/'))
    );
    return;
  }

  event.respondWith(fetch(event.request));
});
