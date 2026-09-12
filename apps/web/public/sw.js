/*
 * Offline service worker for the public Browser Core site.
 *
 * Policy:
 * - Immutable build assets (engine, sounds, hashed Next chunks) are cache-first,
 *   so a returning visitor never re-downloads the Stockfish build.
 * - Page navigations are network-first: an online visitor always receives the
 *   current release, and the cache only answers when the network fails.
 * - `/api/*` is never intercepted, so platform sessions, origin checks and
 *   server-side rate limits keep their existing behaviour.
 *
 * Bump CACHE_VERSION whenever the caching rules below change; older caches are
 * deleted on activate. Retained asset entries outlive a release on purpose,
 * because a page cached for offline use must still find its engine.
 */
const CACHE_VERSION = "v2";
const ASSET_CACHE = `ocr-assets-${CACHE_VERSION}`;
const PAGE_CACHE = `ocr-pages-${CACHE_VERSION}`;
const RETAINED_CACHES = [ASSET_CACHE, PAGE_CACHE];
const OFFLINE_URL = "/offline.html";
const ASSET_PREFIXES = ["/engine/", "/sounds/", "/pieces/", "/_next/static/"];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    // Only the fallback page is precached. The engine is fetched lazily by the
    // first review and retained from then on, so installing stays cheap.
    const cache = await caches.open(ASSET_CACHE);
    await cache.add(new Request(OFFLINE_URL, { cache: "reload" })).catch(() => undefined);
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => !RETAINED_CACHES.includes(name)).map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  // Partial and opaque responses must not be stored as if they were complete.
  if (response.status === 200 && response.type === "basic") await cache.put(request, response.clone());
  return response;
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.status === 200 && response.type === "basic") await cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    const fallback = await caches.match(OFFLINE_URL);
    if (fallback) return fallback;
    throw error;
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;
  if (ASSET_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) {
    event.respondWith(cacheFirst(request, ASSET_CACHE));
    return;
  }
  if (request.mode === "navigate") event.respondWith(networkFirst(request, PAGE_CACHE));
});

/*
 * Client-side routing never produces a navigation request, so a reviewed game
 * would only be reachable offline through the shell that first opened it. The
 * page therefore asks the worker to keep the document of each route it opens.
 */
const WARMABLE_PREFIXES = ["/review/", "/history", "/training", "/settings", "/help"];

self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || data.type !== "ocr:cache-route" || typeof data.url !== "string") return;
  // The page sends a path, not an absolute URL, because it cannot know which
  // origin the worker considers canonical.
  let url;
  try {
    url = new URL(data.url, self.location.origin);
  } catch {
    return;
  }
  if (url.origin !== self.location.origin) return;
  if (!WARMABLE_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) return;
  event.waitUntil((async () => {
    try {
      const response = await fetch(url.href, { credentials: "same-origin" });
      if (response.status !== 200 || response.type !== "basic") return;
      const cache = await caches.open(PAGE_CACHE);
      await cache.put(new Request(url.href), response);
    } catch {
      // Warming is best effort: a failed fetch must never affect the page.
    }
  })());
});
