const CACHE_NAME = "snipster-cache-v2";
const OFFLINE_DB_CACHE = "snipster-db-cache";
const ASSETS_TO_CACHE = [
  "/",
  "/index.html",
  "/login.html",
  "/style.css",
  "/script.js",
  "/manifest.json",
  "/assets/icons/icon-192.png",
  "/assets/icons/icon-512.png"
];

// Install SW & cache static assets
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log("[SW] Caching assets");
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activate SW & remove old caches
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME && key !== OFFLINE_DB_CACHE) {
            console.log("[SW] Removing old cache:", key);
            return caches.delete(key);
          }
        })
      )
    )
  );
  self.clients.claim();
});

// Fetch handler
self.addEventListener("fetch", event => {
  const requestURL = new URL(event.request.url);

  // Handle Supabase API requests separately (network-first)
  if (requestURL.origin.includes("supabase.co")) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Clone and cache API response
          const clone = response.clone();
          caches.open(OFFLINE_DB_CACHE).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() =>
          caches.match(event.request).then(cachedResponse => {
            if (cachedResponse) return cachedResponse;
            return new Response(JSON.stringify({ error: "Offline or not cached" }), {
              headers: { "Content-Type": "application/json" },
              status: 503
            });
          })
        )
    );
    return;
  }

  // Default: cache-first for other assets
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      return cachedResponse || fetch(event.request).then(networkResponse => {
        return caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, networkResponse.clone());
          return networkResponse;
        });
      }).catch(() => {
        if (event.request.destination === "document") {
          return caches.match("/index.html");
        }
      });
    })
  );
});

// Optional: sync offline updates later
self.addEventListener("sync", event => {
  if (event.tag === "sync-snippets") {
    event.waitUntil(syncOfflineSnippets());
  }
});

// Offline queue sync
async function syncOfflineSnippets() {
  const cache = await caches.open(OFFLINE_DB_CACHE);
  const requests = await cache.keys();
  for (const req of requests) {
    const res = await cache.match(req);
    const data = await res.json();
    // TODO: implement Supabase create/update calls here
  }
  console.log("[SW] Offline snippets synced");
}
