// =============================================================================
// public/sw.js — Studeals Service Worker
//
// Strategy:
//   • App shell (HTML pages): Network-first with cache fallback.
//     Students get fresh data; if offline, cached shell still loads.
//   • Static assets (JS/CSS/images/fonts): Cache-first.
//     These are content-hashed by Next.js so stale = safe.
//   • API calls (/api/*): Network-only. Never cache auth or data endpoints.
//
// Cache names are versioned — bump SW_VERSION on breaking changes.
// =============================================================================

const SW_VERSION = 'v1';
const SHELL_CACHE = `studeals-shell-${SW_VERSION}`;
const ASSET_CACHE = `studeals-assets-${SW_VERSION}`;

// Pages to pre-cache on install (app shell)
const PRECACHE_URLS = [
  '/',
  '/dashboard',
  '/explore',
  '/loyalty',
  '/leaderboard',
  '/offline',
];

// ── Install: pre-cache the app shell ─────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      cache.addAll(PRECACHE_URLS.map((url) => new Request(url, { credentials: 'same-origin' })))
        .catch(() => {}) // Don't fail install if some shell pages 404 (e.g. logged-in-only)
    ).then(() => self.skipWaiting())
  );
});

// ── Activate: delete old caches ───────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== SHELL_CACHE && k !== ASSET_CACHE)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin GET requests
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  // API calls — always network-only (no caching of auth/data responses)
  if (url.pathname.startsWith('/api/')) return;

  // Next.js static assets (_next/static/) — cache-first, very long TTL
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.open(ASSET_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      })
    );
    return;
  }

  // Next.js image optimisation — cache-first with 24h revalidation
  if (url.pathname.startsWith('/_next/image')) {
    event.respondWith(
      caches.open(ASSET_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      })
    );
    return;
  }

  // Public static files (icons, manifest, images) — cache-first
  if (
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/manifest.json' ||
    url.pathname.match(/\.(png|jpg|jpeg|webp|svg|gif|woff2?|ico)$/)
  ) {
    event.respondWith(
      caches.open(ASSET_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      })
    );
    return;
  }

  // HTML page navigation — network-first, cache fallback, then /offline
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          caches.open(SHELL_CACHE).then((cache) => cache.put(request, response.clone()));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        // Fallback: return cached root shell
        const root = await caches.match('/');
        return root ?? new Response('You are offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
      })
  );
});
