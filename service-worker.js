const CACHE_NAME = "mana-pwa-v2-settings-2";
const ASSETS = [
  "./",
  "./index.html",
  "./js/config.js",
  "./js/probability-settings.js",
  "./js/result-system.js",
  "./js/magic-interaction.js",
  "./js/particle-renderer.js",
  "./js/resonance.js",
  "./js/ritual-renderer.js",
  "./js/element-effects.js",
  "./js/mana-scan.js",
  "./js/runtime.js",
  "./js/audio.js",
  "./js/pwa.js",
  "./manifest.webmanifest",
  "./service-worker.js",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => (k.startsWith('mana-pwa-') && k !== CACHE_NAME ? caches.delete(k) : null)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => cache.match(event.request)).then((cached) => cached || fetch(event.request))
  );
});
