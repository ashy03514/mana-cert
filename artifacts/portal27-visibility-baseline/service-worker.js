const CACHE_NAME = "mana-pwa-v3-portal-27";
const ASSETS = [
  "./",
  "./index.html",
  "./js/config.js",
  "./js/effect-settings.js",
  "./js/probability-settings.js",
  "./js/result-system.js",
  "./js/portal-scene.js",
  "./js/element-material-fluids.js",
  "./js/element-material-matter.js",
  "./js/element-material-energy.js",
  "./js/element-material-renderer.js",
  "./js/reveal-flow.js",
  "./js/reveal-gather.js",
  "./js/reveal-atmosphere.js",
  "./js/ribbon-renderer.js",
  "./js/finger-trails.js",
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
