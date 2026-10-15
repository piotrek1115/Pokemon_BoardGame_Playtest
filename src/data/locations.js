// Canonical Kanto topology (handoff spec §5 + Appendix B, with the family
// board's merged places — DQ-96).
//
// This file is the canonical topology. Two locations are adjacent only if
// they list each other in `connections`; visual distance on the board art
// never matters. Screen positions live separately in mapLayout.js so the art
// can change without touching topology.
//
// Any deliberate board-game shortcut must be added as an explicit design
// decision and documented in docs/RULES.md, separately from canonical edges:
// shortcut edges live only in data/travelConnections.js NETWORK_EDGES
// (versioned by CONFIG.rules.travelNetwork, DQ-85) and every caller reads the
// game's network through engine/travelEngine.js, never getNeighbors directly.
//
// `type`:  town | city | route | special
// `tags`:  extra descriptors from the spec table (forest, cave, water, island, endgame)
// `biomes`: what can be explored here — content placeholder, see DQ-10.
// `optional`: optional endpoint in the spec; can be disabled via CONFIG.map.
// `features`: board features at the location —
//             'pokeStop' on 6 hubs: Viridian, Cerulean, Vermilion, Celadon,
//             Fuchsia (DQ-33, v0.4; every land location is ≤ 3 steps from one)
//             and Indigo Plateau (the League, Step 5);
//             'gym' in the 6 gym cities (data/gyms.js);
//             'league' at Indigo Plateau.
// `subtitle`: the second name of a merged place (shown on a second line).
// `explore`: how Explore works here under rules.explorePools 'v2' (Macro 01) —
//             'mixed'  one Explore searches the whole place: the wild Pokémon
//                      come from every biome's species together (each species
//                      once), the rarity roll as before — routes, and special
//                      places whose areas blend (Safari Zone, Seafoam Islands…)
//             'choose' the player picks a biome, as before: a city or town with
//                      genuinely different areas (streets / waterfront, the
//                      Pokémon Tower) — Pallet, Cerulean, Vermilion, Lavender,
//                      Fuchsia, Cinnabar
//             'single' one biome — nothing to choose
//             'none'   nothing to explore (Indigo Plateau)
//             Before 'v2' every place with several biomes asks for one.
//
// Board topologies (`CONFIG.map.topology`, saved with every game):
// 'kanto46' the graph before the board merge (Appendix B — `legacy46` below):
//           only so a game saved before the merge replays exactly up to its
//           migration (gameState / engine/topologyEngine.js); never played on.
// 'kanto43' the family board of Build 3.0 (DQ-96, schema 16): three pairs of
//           places merged into one place each, keeping the route's id —
//             Route 2 + Viridian Forest → route-2   Route 10 + Rock Tunnel → route-10
//             Route 23 + Victory Road   → route-23
//           (`retiredInto`). A Build 3.0 game keeps playing on it.
// 'kanto45' the board of new games since Build 3.1 (DQ-104, Piotr 11.10.2026):
//           kanto43 with Route 10 split again around Rock Tunnel —
//             Route 9 → Route 10 North → Power Plant
//             Route 9 → Rock Tunnel → Route 10 South → Lavender Town
//           (`boards` / the `kanto45` overrides below; route-10 is drawn at
//           Rock Tunnel's spot in a kanto43 game — `drawnAt`).
import { LOCAL_POOLS } from './pools.js';
export const CURRENT_TOPOLOGY = 'kanto45';
export const BOARD_TOPOLOGIES = ['kanto46', 'kanto43', 'kanto45'];
// The DQ-96 merge (kanto46 → kanto43): the one migration of saved games.
export const MERGED_INTO = Object.freeze({ 'viridian-forest': 'route-2', 'rock-tunnel': 'route-10', 'victory-road': 'route-23' });

// Every place of either topology, in the original (Appendix B) order.
const ALL_LOCATIONS = [
  { id: 'pallet-town', name: 'Pallet Town', type: 'town', biomes: ['grass', 'beach'], explore: 'choose', connections: ['route-1', 'route-21'] },
  { id: 'route-1', name: 'Route 1', type: 'route', biomes: ['grass'], explore: 'single', connections: ['pallet-town', 'viridian-city'] },
  { id: 'viridian-city', name: 'Viridian City', type: 'city', features: ['pokeStop'], biomes: ['city', 'grass'], explore: 'mixed', connections: ['route-1', 'route-2', 'route-22'] },
  { id: 'route-2', name: 'Route 2', subtitle: 'Viridian Forest', type: 'route', tags: ['forest'], biomes: ['grass', 'forest'], explore: 'mixed', connections: ['viridian-city', 'pewter-city', 'digletts-cave'],
    legacy46: { subtitle: null, tags: [], connections: ['viridian-city', 'viridian-forest', 'digletts-cave'] } },
  { id: 'viridian-forest', name: 'Viridian Forest', type: 'special', tags: ['forest'], biomes: ['forest'], explore: 'single', connections: ['route-2', 'pewter-city'], retiredInto: 'route-2' },
  { id: 'pewter-city', name: 'Pewter City', type: 'city', features: ['gym'], biomes: ['city'], explore: 'single', connections: ['route-2', 'route-3'], legacy46: { connections: ['viridian-forest', 'route-3'] } },
  { id: 'route-3', name: 'Route 3', type: 'route', biomes: ['grass', 'air'], explore: 'mixed', connections: ['pewter-city', 'mt-moon'] },
  { id: 'mt-moon', name: 'Mt. Moon', type: 'special', tags: ['cave'], biomes: ['cave'], explore: 'single', connections: ['route-3', 'route-4'] },
  { id: 'route-4', name: 'Route 4', type: 'route', biomes: ['grass'], explore: 'single', connections: ['mt-moon', 'cerulean-city'] },
  { id: 'cerulean-city', name: 'Cerulean City', type: 'city', features: ['pokeStop', 'gym'], biomes: ['city', 'water'], explore: 'choose', connections: ['route-4', 'route-5', 'route-9', 'route-24', 'unknown-dungeon'] },
  { id: 'route-24', name: 'Route 24', type: 'route', biomes: ['grass', 'water'], explore: 'mixed', connections: ['cerulean-city', 'route-25'] },
  { id: 'route-25', name: 'Route 25', type: 'route', biomes: ['grass', 'beach'], explore: 'mixed', connections: ['route-24', 'bills-cottage'] },
  { id: 'bills-cottage', name: "Bill's Cottage", type: 'special', optional: true, biomes: ['grass', 'beach'], explore: 'mixed', connections: ['route-25'] },
  { id: 'route-5', name: 'Route 5', type: 'route', biomes: ['grass', 'city'], explore: 'mixed', connections: ['cerulean-city', 'saffron-city'] },
  { id: 'saffron-city', name: 'Saffron City', type: 'city', features: ['gym'], biomes: ['city'], explore: 'single', connections: ['route-5', 'route-6', 'route-7', 'route-8'] },
  { id: 'route-6', name: 'Route 6', type: 'route', biomes: ['grass', 'water'], explore: 'mixed', connections: ['saffron-city', 'vermilion-city'] },
  { id: 'vermilion-city', name: 'Vermilion City', type: 'city', features: ['pokeStop', 'gym'], biomes: ['city', 'sea'], explore: 'choose', connections: ['route-6', 'route-11'] },
  { id: 'route-11', name: 'Route 11', type: 'route', biomes: ['grass'], explore: 'single', connections: ['vermilion-city', 'route-12', 'digletts-cave'] },
  // Cross-map shortcut: Route 11 <-> Route 2 (spec §5.1).
  { id: 'digletts-cave', name: "Diglett's Cave", type: 'special', tags: ['cave'], biomes: ['cave'], explore: 'single', connections: ['route-11', 'route-2'] },
  { id: 'route-9', name: 'Route 9', type: 'route', biomes: ['grass'], explore: 'single', connections: ['cerulean-city', 'route-10'],
    kanto45: { connections: ['cerulean-city', 'route-10-north', 'rock-tunnel'] } },
  { id: 'route-10', name: 'Route 10', subtitle: 'Rock Tunnel', type: 'route', tags: ['cave'], biomes: ['grass', 'water', 'cave'], explore: 'mixed', connections: ['route-9', 'lavender-town', 'power-plant'],
    legacy46: { subtitle: null, tags: [], biomes: ['grass', 'water'], connections: ['route-9', 'rock-tunnel', 'power-plant'] }, boards: ['kanto46', 'kanto43'], drawnAt: 'rock-tunnel' },
  // Route 10 split around Rock Tunnel (kanto45, DQ-104).
  { id: 'route-10-north', name: 'Route 10 North', type: 'route', biomes: ['grass', 'water'], explore: 'mixed', connections: ['route-9', 'power-plant'], boards: ['kanto45'] },
  { id: 'rock-tunnel', name: 'Rock Tunnel', type: 'special', tags: ['cave'], biomes: ['cave'], explore: 'single', connections: ['route-10', 'lavender-town'], retiredInto: 'route-10',
    kanto45: { connections: ['route-9', 'route-10-south'] }, boards: ['kanto46', 'kanto45'] },
  { id: 'route-10-south', name: 'Route 10 South', type: 'route', biomes: ['grass'], explore: 'single', connections: ['rock-tunnel', 'lavender-town'], boards: ['kanto45'] },
  { id: 'power-plant', name: 'Power Plant', type: 'special', biomes: ['city'], explore: 'single', connections: ['route-10'], kanto45: { connections: ['route-10-north'] } },
  { id: 'lavender-town', name: 'Lavender Town', type: 'town', biomes: ['haunted', 'city'], explore: 'choose', connections: ['route-10', 'route-8', 'route-12'], legacy46: { connections: ['rock-tunnel', 'route-8', 'route-12'] },
    kanto45: { connections: ['route-10-south', 'route-8', 'route-12'] } },
  { id: 'route-8', name: 'Route 8', type: 'route', biomes: ['grass', 'city'], explore: 'mixed', connections: ['lavender-town', 'saffron-city'] },
  { id: 'route-7', name: 'Route 7', type: 'route', biomes: ['grass', 'city'], explore: 'mixed', connections: ['saffron-city', 'celadon-city'] },
  { id: 'celadon-city', name: 'Celadon City', type: 'city', features: ['pokeStop', 'gym'], biomes: ['city', 'grass'], explore: 'mixed', connections: ['route-7', 'route-16'] },
  // West loop: Celadon -> 16 -> 17 -> 18 -> Fuchsia.
  { id: 'route-16', name: 'Route 16', type: 'route', biomes: ['grass', 'air'], explore: 'mixed', connections: ['celadon-city', 'route-17'] },
  { id: 'route-17', name: 'Route 17', type: 'route', biomes: ['grass', 'beach'], explore: 'mixed', connections: ['route-16', 'route-18'] },
  { id: 'route-18', name: 'Route 18', type: 'route', biomes: ['grass', 'beach'], explore: 'mixed', connections: ['route-17', 'fuchsia-city'] },
  // East loop: Lavender -> 12 -> 13 -> 14 -> 15 -> Fuchsia.
  { id: 'route-12', name: 'Route 12', type: 'route', biomes: ['grass', 'sea'], explore: 'mixed', connections: ['lavender-town', 'route-11', 'route-13'] },
  { id: 'route-13', name: 'Route 13', type: 'route', biomes: ['grass'], explore: 'single', connections: ['route-12', 'route-14'] },
  { id: 'route-14', name: 'Route 14', type: 'route', biomes: ['grass', 'air'], explore: 'mixed', connections: ['route-13', 'route-15'] },
  { id: 'route-15', name: 'Route 15', type: 'route', biomes: ['grass'], explore: 'single', connections: ['route-14', 'fuchsia-city'] },
  { id: 'fuchsia-city', name: 'Fuchsia City', type: 'city', features: ['pokeStop', 'gym'], biomes: ['city', 'water'], explore: 'choose', connections: ['route-15', 'route-18', 'route-19', 'safari-zone'] },
  { id: 'safari-zone', name: 'Safari Zone', type: 'special', biomes: ['grass', 'water', 'forest'], explore: 'mixed', connections: ['fuchsia-city'] },
  // Southern water loop: Fuchsia -> 19 -> Seafoam -> 20 -> Cinnabar -> 21 -> Pallet.
  { id: 'route-19', name: 'Route 19', type: 'route', tags: ['water'], biomes: ['sea', 'beach'], explore: 'mixed', connections: ['fuchsia-city', 'seafoam-islands'] },
  { id: 'seafoam-islands', name: 'Seafoam Islands', type: 'special', tags: ['cave', 'water'], biomes: ['cave', 'sea'], explore: 'mixed', connections: ['route-19', 'route-20'] },
  { id: 'route-20', name: 'Route 20', type: 'route', tags: ['water'], biomes: ['sea'], explore: 'single', connections: ['seafoam-islands', 'cinnabar-island'] },
  { id: 'cinnabar-island', name: 'Cinnabar Island', type: 'city', tags: ['island'], biomes: ['city', 'beach'], explore: 'choose', connections: ['route-20', 'route-21'] },
  { id: 'route-21', name: 'Route 21', type: 'route', tags: ['water'], biomes: ['sea'], explore: 'single', connections: ['cinnabar-island', 'pallet-town'] },
  // League branch: Viridian -> 22 -> 23 -> Victory Road -> Indigo Plateau.
  { id: 'route-22', name: 'Route 22', type: 'route', biomes: ['grass'], explore: 'single', connections: ['viridian-city', 'route-23'] },
  { id: 'route-23', name: 'Route 23', subtitle: 'Victory Road', type: 'route', tags: ['cave'], biomes: ['grass', 'water', 'cave'], explore: 'mixed', connections: ['route-22', 'indigo-plateau'],
    legacy46: { subtitle: null, tags: [], biomes: ['grass', 'water'], connections: ['route-22', 'victory-road'] } },
  { id: 'victory-road', name: 'Victory Road', type: 'special', tags: ['cave'], biomes: ['cave'], explore: 'single', connections: ['route-23', 'indigo-plateau'], retiredInto: 'route-23' },
  // Endgame node: nothing to explore here until gyms / win condition exist (Milestone B).
  { id: 'indigo-plateau', name: 'Indigo Plateau', type: 'special', tags: ['endgame'], features: ['pokeStop', 'league'], biomes: [], explore: 'none', connections: ['route-23'], legacy46: { connections: ['victory-road'] } },
  // Reserved optional special node near Cerulean (spec §5).
  { id: 'unknown-dungeon', name: 'Unknown Dungeon', type: 'special', tags: ['cave'], optional: true, biomes: ['cave'], explore: 'single', connections: ['cerulean-city'] },
];

// Is the place on this board? (`boards` when it is on some only; a place
// retired by the DQ-96 merge only on kanto46.)
function onBoard(loc, topology) {
  if (loc.boards) return loc.boards.includes(topology);
  return loc.retiredInto ? topology === 'kanto46' : true;
}

// The place as this board has it (kanto46: `legacy46`, kanto45: `kanto45`).
function onThisBoard(loc, topology) {
  const variant = topology === 'kanto46' ? loc.legacy46 : topology === 'kanto45' ? loc.kanto45 : null;
  return variant ? { ...loc, ...variant } : loc;
}

const ALL_BY_ID = Object.fromEntries(ALL_LOCATIONS.map((l) => [l.id, l]));

// The places of the board new games play on (CURRENT_TOPOLOGY), in the original order.
export const LOCATIONS = ALL_LOCATIONS.filter((l) => onBoard(l, CURRENT_TOPOLOGY));
export const LOCATIONS_BY_ID = Object.fromEntries(LOCATIONS.map((l) => [l.id, l]));
// Not on that board: known to older games (kanto43: route-10), to replay old
// histories and to migrate old saves.
export const RETIRED_LOCATIONS_BY_ID = Object.fromEntries(ALL_LOCATIONS.filter((l) => !onBoard(l, CURRENT_TOPOLOGY)).map((l) => [l.id, l]));

export function topologyOf(config) {
  return config?.map?.topology ?? CURRENT_TOPOLOGY;
}

// The places of a game's topology, in the original order (kanto46: all 46 of that graph).
export function topologyLocations(config) {
  const topology = topologyOf(config);
  return ALL_LOCATIONS.filter((l) => onBoard(l, topology));
}

export function hasFeature(id, feature) {
  return (ALL_BY_ID[id]?.features ?? []).includes(feature);
}

// A place's record (a place of an older board too: old logs and histories name them).
export function getLocation(id) {
  const loc = ALL_BY_ID[id];
  if (!loc) throw new Error(`Unknown location: ${id}`);
  return loc;
}

export function isLocationEnabled(id, config) {
  const loc = ALL_BY_ID[id];
  if (!loc || !onBoard(loc, topologyOf(config))) return false;
  return !loc.optional || config.map.includeOptionalNodes;
}

// What can be explored here under the game's topology.
export function locationBiomes(id, config) {
  return onThisBoard(getLocation(id), topologyOf(config)).biomes;
}

// How Explore works here in this game (rules.explorePools): 'mixed' (one pool,
// no biome to pick), 'choose' (a biome per Explore) or 'single' / 'none' —
// before 'v2' every place with several biomes is 'choose'.
export function exploreMode(id, config) {
  const biomes = locationBiomes(id, config);
  if (!biomes.length) return 'none';
  // Macro 02 M02-1 (rules.localPools 'v2'): a place with its own pool is explored whole.
  if (config.rules?.localPools === 'v2' && LOCAL_POOLS[id]) return 'mixed';
  if (config.rules?.explorePools !== 'v2') return biomes.length > 1 ? 'choose' : 'single';
  return getLocation(id).explore;
}

// Legal neighbours of a location under the given config.
export function getNeighbors(id, config) {
  return onThisBoard(getLocation(id), topologyOf(config)).connections.filter((n) => isLocationEnabled(n, config));
}

export function areAdjacent(a, b, config) {
  return isLocationEnabled(a, config) && isLocationEnabled(b, config) && getNeighbors(a, config).includes(b);
}
