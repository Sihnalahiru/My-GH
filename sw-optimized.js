const CACHE_CORE = "ssw-gh-core-v1"; // Critical resources
const CACHE_IMAGES = "ssw-gh-images-v1"; // Images (lazy-loaded)
const CACHE_DATA = "ssw-gh-data-v1"; // JSON data

const CORE = [
  "./",
  "./index.html",
  "./styles.css",
  "./app-optimized.js",
  "./manifest.json",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png"
];

// Only cache critical data files
const DATA_FILES = [
  "./data/study.json",
  "./data/questions.json",
  "./data/glossary.json",
  "./data/topics.json"
];

// Images are cached on-demand, not pre-cached
const IMAGE_PATHS = [
  "assets/images/official/gh01/",
  "assets/images/official/gh02/"
];

// Install: Cache only critical resources
self.addEventListener("install", e => {
  e.waitUntil(
    Promise.all([
      caches.open(CACHE_CORE).then(c => c.addAll(CORE)),
      caches.open(CACHE_DATA).then(c => c.addAll(DATA_FILES))
    ]).then(() => self.skipWaiting())
  );
});

// Activate: Clean up old caches
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => !k.startsWith("ssw-gh-"))
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch: Smart caching strategy
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;

  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;

  const pathname = url.pathname;

  // Strategy 1: Core resources (stale-while-revalidate)
  if (CORE.some(p => pathname.includes(p.replace("./", "")))) {
    return e.respondWith(
      caches.match(e.request).then(cached => {
        const fetched = fetch(e.request)
          .then(r => {
            if (r.ok) {
              caches.open(CACHE_CORE).then(c => c.put(e.request, r.clone()));
            }
            return r;
          })
          .catch(() => cached);
        return cached || fetched;
      })
    );
  }

  // Strategy 2: Data files (network-first with cache fallback)
  if (pathname.includes("/data/")) {
    return e.respondWith(
      fetch(e.request)
        .then(r => {
          if (r.ok) {
            caches.open(CACHE_DATA).then(c => c.put(e.request, r.clone()));
          }
          return r;
        })
        .catch(() => caches.match(e.request))
    );
  }

  // Strategy 3: Images (cache-first, lazy-load)
  if (pathname.includes("/assets/images/")) {
    return e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request)
        .then(r => {
          if (r.ok) {
            caches.open(CACHE_IMAGES).then(c => c.put(e.request, r.clone()));
          }
          return r;
        })
      )
    );
  }

  // Default: network-first
  e.respondWith(
    fetch(e.request)
      .catch(() => caches.match(e.request))
  );
});
