const CACHE_NAME = "snipster-cache-v1";
const urlsToCache = [
  "./",
  "./index.html",
  "./style.css",
  "./script.js",
  "./data/cheats.json",
  "https://cdnjs.cloudflare.com/ajax/libs/prism/1.30.0/prism.min.css",
  "https://cdnjs.cloudflare.com/ajax/libs/prism/1.30.0/prism.min.js",
  "https://cdn.jsdelivr.net/npm/skulpt@1.2.0/dist/skulpt.min.js",
  "https://cdn.jsdelivr.net/npm/skulpt@1.2.0/dist/skulpt-stdlib.js"
];

// Install SW and cache files
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
  );
});

// Activate SW and clean old caches
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
    ))
  );
  return self.clients.claim();
});

// Fetch from cache first, then network
self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(response => response || fetch(event.request))
  );
});
