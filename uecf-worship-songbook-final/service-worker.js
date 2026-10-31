const CACHE_NAME = "uecfi-songbook-v29-intro-video-admin";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./assets/uecfi-logo.png",
  "./assets/uecfi-opening-cover.jpg",
  "./assets/centro-la-vida-eterna.jpg",
  "./assets/clve-church-banner.webp",
  "./assets/icons/centro-icon-192.png",
  "./assets/icons/centro-icon-512.png",
  "./assets/icons/centro-icon-maskable-512.png",
  "./assets/icons/apple-touch-icon.png",
  "./assets/intro/centro-intro-poster.jpg",
  "./assets/intro/centro-intro.mp4"
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


// Serve video from the saved copy with proper Range (206) support so the opening
// video also plays offline in Android Chrome, Windows Chrome/Edge and Safari.
async function serveRange(request, cache) {
  const cached = await cache.match(request.url.split("#")[0], { ignoreSearch: true });
  if (!cached) return null;
  const buf = await cached.arrayBuffer();
  const range = request.headers.get("range");
  const type = cached.headers.get("content-type") || "video/mp4";
  if (!range) return new Response(buf, { status: 200, headers: { "Content-Type": type, "Content-Length": String(buf.byteLength), "Accept-Ranges": "bytes" } });
  const m = /bytes=(\d*)-(\d*)/.exec(range);
  let start = m && m[1] ? parseInt(m[1], 10) : 0;
  let end = m && m[2] ? parseInt(m[2], 10) : buf.byteLength - 1;
  if (m && !m[1] && m[2]) { start = Math.max(0, buf.byteLength - parseInt(m[2], 10)); end = buf.byteLength - 1; }
  end = Math.min(end, buf.byteLength - 1);
  if (start > end) return new Response(null, { status: 416, headers: { "Content-Range": "bytes */" + buf.byteLength } });
  return new Response(buf.slice(start, end + 1), { status: 206, headers: {
    "Content-Type": type, "Content-Length": String(end - start + 1),
    "Content-Range": "bytes " + start + "-" + end + "/" + buf.byteLength, "Accept-Ranges": "bytes" } });
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

  // Opening video + poster: saved once per app version, served from the saved copy (with Range support).
  if (url.origin === self.location.origin && url.pathname.includes("/assets/intro/")) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      if (/\.mp4$/i.test(url.pathname)) {
        const ranged = await serveRange(request, cache);
        if (ranged) return ranged;
      } else {
        const hit = await cache.match(request, { ignoreSearch: true });
        if (hit) return hit;
      }
      const response = await fetch(request);
      if (response && response.status === 200) cache.put(url.href, response.clone()).catch(() => {});
      return response;
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
