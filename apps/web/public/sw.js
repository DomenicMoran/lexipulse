/*
 * LexiPulse service worker.
 *
 * Two strategies, chosen by what the request is for:
 *
 *   Documents  network first. A reader that shows yesterday's build after a deploy is
 *              worse than one that waits 200 ms. The cache is the fallback, and
 *              /offline is the fallback of the fallback.
 *   Assets     cache first. Everything under /_next/static carries a content hash in
 *              its name, so a cached copy can never be the wrong one.
 *
 * Nothing here talks to a server of ours beyond the origin the app was loaded from, and
 * no request is ever recorded.
 */

const VERSION = 'lexipulse-v1';
const SHELL_CACHE = `${VERSION}-shell`;
const ASSET_CACHE = `${VERSION}-assets`;
const PAGE_CACHE = `${VERSION}-pages`;

const SHELL = [
  '/',
  '/pdf',
  '/reader',
  '/reader/library',
  '/reader/stats',
  '/reader/original',
  '/offline',
  '/manifest.webmanifest',
];

/*
 * pdf.js and its data directories.
 *
 * Cached under their own strategy because their names carry no content hash: `pdf.mjs` is
 * `pdf.mjs` in every version. Cache-first would pin whatever version was current the first
 * time the reader opened a PDF, for as long as the cache survives. Stale-while-revalidate
 * serves the copy on disk straight away — which is what makes opening a PDF work with no
 * network at all — and quietly replaces it when a newer one is deployed.
 */
function isPdfjsAsset(url) {
  return url.pathname.startsWith('/pdfjs/');
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      // A single missing entry must not fail the whole install.
      .then((cache) => Promise.allSettled(SHELL.map((url) => cache.add(url))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => !key.startsWith(VERSION)).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/favicon.svg' ||
    /\.(?:css|js|mjs|woff2?|png|svg|webp|avif)$/.test(url.pathname)
  );
}

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response && response.status === 200 && response.type === 'basic') {
      const copy = response.clone();
      const cache = await caches.open(cacheName);
      await cache.put(request, copy);
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request, { ignoreSearch: true });
    if (cached) return cached;
    if (request.mode === 'navigate') {
      const offline = await caches.match('/offline');
      if (offline) return offline;
    }
    throw error;
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cached = await caches.match(request);
  const fresh = fetch(request)
    .then(async (response) => {
      if (response && response.status === 200) {
        const cache = await caches.open(cacheName);
        await cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => undefined);
  // Offline and never fetched before: there is nothing to serve but the failure.
  return cached ?? (await fresh) ?? fetch(request);
}

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.status === 200) {
    const cache = await caches.open(cacheName);
    await cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // The extract endpoint must never be served from a cache — and never be recorded.
  if (url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, PAGE_CACHE));
    return;
  }

  if (isPdfjsAsset(url)) {
    event.respondWith(staleWhileRevalidate(request, ASSET_CACHE));
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request, ASSET_CACHE));
  }
});
