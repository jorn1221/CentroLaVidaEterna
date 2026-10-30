const CACHE_NAME = "uecfi-songbook-v26-secure-password-reset";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./assets/uecfi-logo.png",
  "./assets/centro-la-vida-eterna.jpg",
  "./assets/clve-church-banner.webp",
  "./assets/icons/centro-icon-192.png",
  "./assets/icons/centro-icon-512.png",
  "./assets/icons/apple-touch-icon.png"
];

// Third-party files the app needs to draw itself. They are saved on the first online
// visit so the app also opens with no signal (airplane mode, no data).
const CDN_SHELL = [
  "https://cdn.tailwindcss.com",
  "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css",
  "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/webfonts/fa-solid-900.woff2",
  "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/webfonts/fa-regular-400.woff2",
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"
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
    for (const url of CDN_SHELL) {
      try {
        const response = await fetch(new Request(url, { mode: "no-cors" }));
        if (response && (response.ok || response.type === "opaque")) await cache.put(url, response);
      } catch (error) {
        // Will be cached automatically the next time the app is opened online.
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
        key.startsWith("uecfi-songbook-") && key !== CACHE_NAME
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

  // Navigations: try the network briefly, then fall back to the saved app shell so the
  // app opens instantly even on a weak or missing connection.
  if (request.mode === "navigate") {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const fromCache = async () =>
        (await cache.match(request, { ignoreSearch: true })) ||
        (await cache.match("./index.html")) ||
        (await cache.match("./")) ||
        new Response(
          "UECFI Songbook is offline. Open the app online once to save its files and song library.",
          { headers: { "Content-Type": "text/plain; charset=utf-8" }, status: 200 }
        );
      if (self.navigator && self.navigator.onLine === false) return fromCache();
      try {
        const network = fetch(request).then(async response => {
          if (response && response.ok && url.origin === self.location.origin) {
            await cache.put("./index.html", response.clone());
          }
          return response;
        });
        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 4000));
        return await Promise.race([network, timeout]);
      } catch (error) {
        return fromCache();
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
