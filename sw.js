// Service worker for the tablet build (HTTPS / installed home-screen app).
// Network first: online, every load asks the server (revalidating), so a new
// deploy shows up on the next reload; the cache only answers when offline.
// Everything is precached on install, so after one online visit the whole
// game works offline. Precache and pages always come from the network, never
// from the browser's HTTP cache (GitHub Pages: max-age=600): a stale
// table.html next to a new build's modules would break the game. tools/build-tablet.js rewrites VERSION (build id) and
// PRECACHE (every file of the build) for each deploy; old caches are dropped.
const VERSION = 'pokemon-kanto-tablet-v2-108e792';
// Pokémon artwork from PokéAPI (another origin): kept on the device across
// builds, answered cache-first (Post-playtest Build 2, P0). Same name as
// ART_CACHE in src/table/art.js.
const ART_CACHE = 'kanto-art-v1';
const ART_PREFIX = 'https://raw.githubusercontent.com/PokeAPI/sprites/';
// Trainer portraits (Build 2.3, pret/pokefirered pinned): the same cache, kept once used (no prefetch).
const TRAINER_ART_PREFIX = 'https://raw.githubusercontent.com/pret/pokefirered/';
const PRECACHE = ["./","./assets/boards/kanto-board.jpg","./assets/fonts/lato/OFL.txt","./assets/fonts/lato/lato-400-latin-ext.woff2","./assets/fonts/lato/lato-400-latin.woff2","./assets/fonts/lato/lato-700-latin-ext.woff2","./assets/fonts/lato/lato-700-latin.woff2","./assets/fonts/lato/lato-900-latin-ext.woff2","./assets/fonts/lato/lato-900-latin.woff2","./assets/icons/lucide-LICENSE.txt","./assets/icons/tablet-icon-180.png","./assets/icons/tablet-icon-192.png","./assets/icons/tablet-icon-512.png","./assets/icons/tablet-icon-maskable-512.png","./assets/icons/tablet-icon.svg","./index.html","./manifest.webmanifest","./src/config.js","./src/data/biomes.js","./src/data/characters.js","./src/data/events.js","./src/data/gyms.js","./src/data/items.js","./src/data/locations.js","./src/data/mapLayout.js","./src/data/pokemon.js","./src/data/quests.js","./src/data/rocketPlots.js","./src/data/trainers.js","./src/data/travelConnections.js","./src/data/types.js","./src/engine/aiEngine.js","./src/engine/captureEngine.js","./src/engine/combatEngine.js","./src/engine/encounterEngine.js","./src/engine/endgameEngine.js","./src/engine/eventEngine.js","./src/engine/evolutionEngine.js","./src/engine/gameState.js","./src/engine/growthEngine.js","./src/engine/gymEngine.js","./src/engine/itemEngine.js","./src/engine/log.js","./src/engine/pokeStopEngine.js","./src/engine/questEngine.js","./src/engine/rng.js","./src/engine/rocketEngine.js","./src/engine/trainerEngine.js","./src/engine/travelEngine.js","./src/engine/turnEngine.js","./src/rules.js","./src/table/art.js","./src/table/artEditor.js","./src/table/board.js","./src/table/cards.js","./src/table/content-pl.js","./src/table/dice.js","./src/table/flow.js","./src/table/hud.js","./src/table/i18n.js","./src/table/icons.js","./src/table/main.js","./src/table/table.css","./src/table/tableLayer.js","./src/ui/dom.js","./src/ui/gymPanel.js","./src/ui/saveSlot.js","./src/ui/setup.js","./table.html"];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(PRECACHE.map((url) => new Request(url, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== VERSION && key !== ART_CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method === 'GET' && (request.url.startsWith(ART_PREFIX) || request.url.startsWith(TRAINER_ART_PREFIX))) {
    event.respondWith(artwork(request));
    return;
  }
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith((async () => {
    try {
      const navigate = request.mode === 'navigate';
      let response = await fetch(navigate ? new Request(request.url, { cache: 'no-cache', credentials: 'same-origin' }) : new Request(request, { cache: 'no-cache' }));
      // A page answer must not be flagged "redirected" (navigations don't follow redirects themselves).
      if (navigate && response.redirected) response = new Response(response.body, { status: response.status, statusText: response.statusText, headers: response.headers });
      if (response.ok) {
        const copy = response.clone();
        caches.open(VERSION).then((cache) => cache.put(request, copy));
      }
      return response;
    } catch (offline) {
      const cached = await caches.match(request, { ignoreSearch: true });
      if (cached) return cached;
      if (request.mode === 'navigate') return (await caches.match('./table.html')) ?? Response.error();
      throw offline;
    }
  })());
});

// A picture once seen (or prefetched) never needs the network again; a failed
// fetch fails like before (the table shows the fallback and tries again later).
async function artwork(request) {
  const cache = await caches.open(ART_CACHE);
  const hit = await cache.match(request.url);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok && response.type !== 'opaque') await cache.put(request.url, response.clone());
  return response;
}
