/**
 * Vector Football — Service Worker
 * Strategy: cache-first for static assets, network-first for API calls.
 * On install: pre-cache the app shell.
 * On activate: clean up old caches.
 */

const CACHE_VERSION = 'vf-v1';
const STATIC_CACHE = `${CACHE_VERSION}-static`;

// App shell — files that make the app work offline
const SHELL = [
  '/',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
];

// ── Install: cache the app shell ──────────────────────────────────────────

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: remove old caches ───────────────────────────────────────────

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key.startsWith('vf-') && key !== STATIC_CACHE)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

// ── Fetch: serve from cache, fall back to network ─────────────────────────

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests and cross-origin requests (Supabase API etc.)
  if (request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  // Hashed /assets/* — cache-first (immutable)
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then(cached => cached ?? fetchAndCache(request, STATIC_CACHE))
    );
    return;
  }

  // Everything else — network-first, fall back to cache
  event.respondWith(
    fetch(request)
      .then(response => {
        const clone = response.clone();
        caches.open(STATIC_CACHE).then(cache => cache.put(request, clone));
        return response;
      })
      .catch(() => caches.match(request).then(cached => cached ?? caches.match('/')))
  );
});

function fetchAndCache(request, cacheName) {
  return fetch(request).then(response => {
    const clone = response.clone();
    caches.open(cacheName).then(cache => cache.put(request, clone));
    return response;
  });
}
