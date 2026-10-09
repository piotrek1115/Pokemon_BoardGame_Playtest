// Canonical Kanto topology (handoff spec §5 + Appendix B).
//
// This file is the ONLY source of movement legality. Two locations are
// adjacent only if they list each other in `connections`; visual distance on
// the board art never matters. Screen positions live separately in
// mapLayout.js so the art can change without touching topology.
//
// Any deliberate board-game shortcut must be added as an explicit design
// decision and documented in docs/RULES.md, separately from canonical edges.
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

export const LOCATIONS = [
  { id: 'pallet-town', name: 'Pallet Town', type: 'town', biomes: ['grass', 'beach'], connections: ['route-1', 'route-21'] },
  { id: 'route-1', name: 'Route 1', type: 'route', biomes: ['grass'], connections: ['pallet-town', 'viridian-city'] },
  { id: 'viridian-city', name: 'Viridian City', type: 'city', features: ['pokeStop'], biomes: ['city', 'grass'], connections: ['route-1', 'route-2', 'route-22'] },
  { id: 'route-2', name: 'Route 2', type: 'route', biomes: ['grass', 'forest'], connections: ['viridian-city', 'viridian-forest', 'digletts-cave'] },
  { id: 'viridian-forest', name: 'Viridian Forest', type: 'special', tags: ['forest'], biomes: ['forest'], connections: ['route-2', 'pewter-city'] },
  { id: 'pewter-city', name: 'Pewter City', type: 'city', features: ['gym'], biomes: ['city'], connections: ['viridian-forest', 'route-3'] },
  { id: 'route-3', name: 'Route 3', type: 'route', biomes: ['grass', 'air'], connections: ['pewter-city', 'mt-moon'] },
  { id: 'mt-moon', name: 'Mt. Moon', type: 'special', tags: ['cave'], biomes: ['cave'], connections: ['route-3', 'route-4'] },
  { id: 'route-4', name: 'Route 4', type: 'route', biomes: ['grass'], connections: ['mt-moon', 'cerulean-city'] },
  { id: 'cerulean-city', name: 'Cerulean City', type: 'city', features: ['pokeStop', 'gym'], biomes: ['city', 'water'], connections: ['route-4', 'route-5', 'route-9', 'route-24', 'unknown-dungeon'] },
  { id: 'route-24', name: 'Route 24', type: 'route', biomes: ['grass', 'water'], connections: ['cerulean-city', 'route-25'] },
  { id: 'route-25', name: 'Route 25', type: 'route', biomes: ['grass', 'beach'], connections: ['route-24', 'bills-cottage'] },
  { id: 'bills-cottage', name: "Bill's Cottage", type: 'special', optional: true, biomes: ['grass', 'beach'], connections: ['route-25'] },
  { id: 'route-5', name: 'Route 5', type: 'route', biomes: ['grass', 'city'], connections: ['cerulean-city', 'saffron-city'] },
  { id: 'saffron-city', name: 'Saffron City', type: 'city', features: ['gym'], biomes: ['city'], connections: ['route-5', 'route-6', 'route-7', 'route-8'] },
  { id: 'route-6', name: 'Route 6', type: 'route', biomes: ['grass', 'water'], connections: ['saffron-city', 'vermilion-city'] },
  { id: 'vermilion-city', name: 'Vermilion City', type: 'city', features: ['pokeStop', 'gym'], biomes: ['city', 'sea'], connections: ['route-6', 'route-11'] },
  { id: 'route-11', name: 'Route 11', type: 'route', biomes: ['grass'], connections: ['vermilion-city', 'route-12', 'digletts-cave'] },
  // Cross-map shortcut: Route 11 <-> Route 2 (spec §5.1).
  { id: 'digletts-cave', name: "Diglett's Cave", type: 'special', tags: ['cave'], biomes: ['cave'], connections: ['route-11', 'route-2'] },
  { id: 'route-9', name: 'Route 9', type: 'route', biomes: ['grass'], connections: ['cerulean-city', 'route-10'] },
  { id: 'route-10', name: 'Route 10', type: 'route', biomes: ['grass', 'water'], connections: ['route-9', 'rock-tunnel', 'power-plant'] },
  { id: 'rock-tunnel', name: 'Rock Tunnel', type: 'special', tags: ['cave'], biomes: ['cave'], connections: ['route-10', 'lavender-town'] },
  { id: 'power-plant', name: 'Power Plant', type: 'special', biomes: ['city'], connections: ['route-10'] },
  { id: 'lavender-town', name: 'Lavender Town', type: 'town', biomes: ['haunted', 'city'], connections: ['rock-tunnel', 'route-8', 'route-12'] },
  { id: 'route-8', name: 'Route 8', type: 'route', biomes: ['grass', 'city'], connections: ['lavender-town', 'saffron-city'] },
  { id: 'route-7', name: 'Route 7', type: 'route', biomes: ['grass', 'city'], connections: ['saffron-city', 'celadon-city'] },
  { id: 'celadon-city', name: 'Celadon City', type: 'city', features: ['pokeStop', 'gym'], biomes: ['city', 'grass'], connections: ['route-7', 'route-16'] },
  // West loop: Celadon -> 16 -> 17 -> 18 -> Fuchsia.
  { id: 'route-16', name: 'Route 16', type: 'route', biomes: ['grass', 'air'], connections: ['celadon-city', 'route-17'] },
  { id: 'route-17', name: 'Route 17', type: 'route', biomes: ['grass', 'beach'], connections: ['route-16', 'route-18'] },
  { id: 'route-18', name: 'Route 18', type: 'route', biomes: ['grass', 'beach'], connections: ['route-17', 'fuchsia-city'] },
  // East loop: Lavender -> 12 -> 13 -> 14 -> 15 -> Fuchsia.
  { id: 'route-12', name: 'Route 12', type: 'route', biomes: ['grass', 'sea'], connections: ['lavender-town', 'route-11', 'route-13'] },
  { id: 'route-13', name: 'Route 13', type: 'route', biomes: ['grass'], connections: ['route-12', 'route-14'] },
  { id: 'route-14', name: 'Route 14', type: 'route', biomes: ['grass', 'air'], connections: ['route-13', 'route-15'] },
  { id: 'route-15', name: 'Route 15', type: 'route', biomes: ['grass'], connections: ['route-14', 'fuchsia-city'] },
  { id: 'fuchsia-city', name: 'Fuchsia City', type: 'city', features: ['pokeStop', 'gym'], biomes: ['city', 'water'], connections: ['route-15', 'route-18', 'route-19', 'safari-zone'] },
  { id: 'safari-zone', name: 'Safari Zone', type: 'special', biomes: ['grass', 'water', 'forest'], connections: ['fuchsia-city'] },
  // Southern water loop: Fuchsia -> 19 -> Seafoam -> 20 -> Cinnabar -> 21 -> Pallet.
  { id: 'route-19', name: 'Route 19', type: 'route', tags: ['water'], biomes: ['sea', 'beach'], connections: ['fuchsia-city', 'seafoam-islands'] },
  { id: 'seafoam-islands', name: 'Seafoam Islands', type: 'special', tags: ['cave', 'water'], biomes: ['cave', 'sea'], connections: ['route-19', 'route-20'] },
  { id: 'route-20', name: 'Route 20', type: 'route', tags: ['water'], biomes: ['sea'], connections: ['seafoam-islands', 'cinnabar-island'] },
  { id: 'cinnabar-island', name: 'Cinnabar Island', type: 'city', tags: ['island'], biomes: ['city', 'beach'], connections: ['route-20', 'route-21'] },
  { id: 'route-21', name: 'Route 21', type: 'route', tags: ['water'], biomes: ['sea'], connections: ['cinnabar-island', 'pallet-town'] },
  // League branch: Viridian -> 22 -> 23 -> Victory Road -> Indigo Plateau.
  { id: 'route-22', name: 'Route 22', type: 'route', biomes: ['grass'], connections: ['viridian-city', 'route-23'] },
  { id: 'route-23', name: 'Route 23', type: 'route', biomes: ['grass', 'water'], connections: ['route-22', 'victory-road'] },
  { id: 'victory-road', name: 'Victory Road', type: 'special', tags: ['cave'], biomes: ['cave'], connections: ['route-23', 'indigo-plateau'] },
  // Endgame node: nothing to explore here until gyms / win condition exist (Milestone B).
  { id: 'indigo-plateau', name: 'Indigo Plateau', type: 'special', tags: ['endgame'], features: ['pokeStop', 'league'], biomes: [], connections: ['victory-road'] },
  // Reserved optional special node near Cerulean (spec §5).
  { id: 'unknown-dungeon', name: 'Unknown Dungeon', type: 'special', tags: ['cave'], optional: true, biomes: ['cave'], connections: ['cerulean-city'] },
];

export const LOCATIONS_BY_ID = Object.fromEntries(LOCATIONS.map((l) => [l.id, l]));

export function hasFeature(id, feature) {
  return (LOCATIONS_BY_ID[id]?.features ?? []).includes(feature);
}

export function getLocation(id) {
  const loc = LOCATIONS_BY_ID[id];
  if (!loc) throw new Error(`Unknown location: ${id}`);
  return loc;
}

export function isLocationEnabled(id, config) {
  const loc = LOCATIONS_BY_ID[id];
  if (!loc) return false;
  return !loc.optional || config.map.includeOptionalNodes;
}

// Legal neighbours of a location under the given config.
export function getNeighbors(id, config) {
  return getLocation(id).connections.filter((n) => isLocationEnabled(n, config));
}

export function areAdjacent(a, b, config) {
  return isLocationEnabled(a, config) && isLocationEnabled(b, config) && getLocation(a).connections.includes(b);
}
