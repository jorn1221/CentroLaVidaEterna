const CACHE_NAME = "uecfi-songbook-print-final-v11";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./assets/uecfi-logo.png",
  "./assets/centro-la-vida-eterna.jpg",
  "./assets/clve-church-banner.webp",
  "./assets/icons/centro-icon-192.png",
  "./assets/icons/centro-icon-512.png"
];

// Never cache Supabase/auth/database API traffic, including cross-origin requests.
function isSensitiveApi(url) {
  return /(^|\.)supabase\.co$/i.test(url.hostname) &&
    (url.pathname.includes("/auth/v1/") ||
     url.pathname.includes("/rest/v1/") ||
     url.pathname.includes("/storage/v1/") ||
     url.pathname.includes("/functions/v1/"));
}

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // Cache each shell file independently so a missing optional asset doesn't
    // prevent the service worker from installing.
    for (const path of APP_SHELL) {
      try {
        const response = await fetch(path, { cache: "reload" });
        if (response.ok) await cache.put(path, response);
      } catch (error) {
        // A missing asset will be fetched on a later online visit.
      }
    }
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter(key =>
        key.startsWith("uecfi-songbook-shell-") && key !== CACHE_NAME
      ).map(key => caches.delete(key))
    );
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (isSensitiveApi(url)) return;

  // Navigations: network first, cached app shell as offline fallback.
  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response && response.ok && url.origin === self.location.origin) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put("./index.html", response.clone());
        }
        return response;
      } catch (error) {
        const cache = await caches.open(CACHE_NAME);
        return (await cache.match(request)) ||
               (await cache.match("./index.html")) ||
               new Response(
                 "UECFI Songbook is offline. Open the app online once to save its files and song library.",
                 { headers: { "Content-Type": "text/plain; charset=utf-8" }, status: 200 }
               );
      }
    })());
    return;
  }

  // Static assets: cache first; refresh cache from network when possible.
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) {
      // Update only same-origin static files in the background.
      if (url.origin === self.location.origin) {
        fetch(request).then(response => {
          if (response && response.ok) cache.put(request, response.clone());
        }).catch(() => {});
      }
      return cached;
    }

    try {
      const response = await fetch(request);
      // Cache successful same-origin assets and cacheable public CDN assets.
      // Supabase API requests are excluded above.
      if (response && (response.ok || response.type === "opaque")) {
        await cache.put(request, response.clone());
      }
      return response;
    } catch (error) {
      throw error;
    }
  })());
});
