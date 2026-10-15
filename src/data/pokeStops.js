// Where the Poké Stops are (rules.pokeStops). Every network keeps the
// 'pokeStop' feature hubs of data/locations.js (v1) and only adds places.
//   v1  the 6 hubs since DQ-33: Viridian, Cerulean, Vermilion, Celadon,
//       Fuchsia and Indigo Plateau (the League) — Phase 2 … Build 3.0
//   v2  Macro 01: every gym city has one — + Pewter City, Saffron City
//   v3  Macro 01 variant: v2 + Lavender Town and Cinnabar Island (every city
//       and town except Pallet Town, Professor Oak's own hub)
import { LOCATIONS } from './locations.js';

const HUBS = LOCATIONS.filter((l) => (l.features ?? []).includes('pokeStop')).map((l) => l.id);

export const POKE_STOP_NETWORKS = Object.freeze({
  v1: Object.freeze([...HUBS]),
  v2: Object.freeze([...HUBS, 'pewter-city', 'saffron-city']),
  v3: Object.freeze([...HUBS, 'pewter-city', 'saffron-city', 'lavender-town', 'cinnabar-island']),
});

// The Poké Stops of a game (its rules.pokeStops; a config without the switch is 'v1').
export function pokeStopPlaces(config) {
  const version = config?.rules?.pokeStops ?? 'v1';
  const places = POKE_STOP_NETWORKS[version];
  if (!places) throw new Error(`No Poké Stop network ${version}`);
  return places;
}
