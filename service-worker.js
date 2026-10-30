const CACHE_NAME = "mana-pwa-v3-portal-133";
const ASSETS = [
  "./",
  "./index.html",
  "./js/config.js",
  "./js/effect-settings.js",
  "./js/probability-settings.js",
  "./js/cert-settings.js",
  "./js/rank-lettering.js",
  "./js/result-layout.js",
  "./js/result-system.js",
  "./js/portal-scene.js",
  "./js/element-material-fluids.js",
  "./js/element-material-matter.js",
  "./js/element-material-energy.js",
  "./js/element-material-renderer.js",
  "./js/ocean-surface-shader.js",
  "./js/ocean-spray-field.js",
  "./js/ocean-spray.js",
  "./js/water-ocean-study.js",
  "./js/water-rank-effects.js",
  "./js/water-ocean-reveal.js",
  "./js/wind-tornado-shader.js",
  "./js/wind-rank-effects.js",
  "./js/wind-backdrop.js",
  "./js/wind-tornado-renderer.js",
  "./wind-tornado-study.html",
  "./js/earth-rank-effects.js",
  "./js/earth-backdrop.js",
  "./js/earth-mountain-renderer.js",
  "./earth-mountain-study.html",
  "./js/light-holy-shader.js",
  "./js/light-holy-wings.js",
  "./js/light-holy-renderer.js",
  "./js/light-holy-study.js",
  "./light-holy-study.html",
  "./light-angel-wing-study.html",
  "./assets/light-angel-wings-v1.png",
  "./light-angel-motion-study.html",
  "./assets/light-angel-wings-v1.local.js",
  "./assets/light-angel-wings-ranks.local.js",
  "./assets/light-angel-wings-a-v1.png",
  "./assets/light-angel-wings-s-v1.png",
  "./js/light-angel-motion.js",
  "./js/light-angel-motion-renderer.js",
  "./js/light-angel-layered-growth-renderer.js",
  "./js/light-angel-motion-study.js",
  "./assets/ocean-surface-v1.webp",
  "./js/element-reveal-backdrop.js",
  "./js/reveal-flow.js",
  "./js/light-awakening.js",
  "./js/dark-awakening.js",
  "./js/light-feathers.js",
  "./assets/light-angel-feather-v1.local.js",
  "./assets/light-angel-feather-v1.png",
  "./js/fire-scan-transition.js",
  "./js/light-rank-growth.js",
  "./assets/dark-chain-v1.local.js",
  "./assets/dark-demon-wings-ss-v2.local.js",
  "./assets/dark-demon-wings-ranks.local.js",
  "./js/dark-demon-wing-motion.js",
  "./js/dark-demon-wing-motion-renderer.js",
  "./js/dark-demon-wing-growth-renderer.js",
  "./js/dark-rank-growth.js",
  "./js/fire-rank-sparkles.js",
  "./js/fire-rank-embers.js",
  "./js/reveal-gather.js",
  "./js/reveal-atmosphere.js",
  "./js/reveal-shockwaves.js",
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
    // Preview/version links address the same static document. Match its
    // canonical cache entry offline; asset requests retain exact URL matching.
    caches.open(CACHE_NAME).then((cache) => cache.match(event.request,
      event.request.mode === 'navigate' ? {ignoreSearch:true} : undefined
    )).then((cached) => cached || fetch(event.request))
  );
});
