// Edge metadata: a parallel layer on top of the canonical topology.
//
// locations.js says which places are GEOGRAPHICALLY ADJACENT (Appendix B, never
// edited here). This file says HOW an existing edge is travelled and what a
// player needs to use it, which decides whether it is CURRENTLY TRAVERSABLE:
//
//   traversable(from, to) = adjacent(from, to) && player has every `requires` capability
//
// Edges without an entry are ordinary overland paths with no requirement.
// Entries can never create an edge: tests reject any entry that is not a
// canonical edge. Map coordinates play no part in any of this.
//
// Entry fields:
//   a, b        location ids of an existing canonical edge (order irrelevant)
//   traversal   one of TRAVERSAL_TYPES — how the edge is travelled
//   requires    capability keys the player must have (see CAPABILITIES)
//   note        why the gate exists
// Planned extensions (not used yet): progression gates (badges), travel events
// fired on an edge, one-way edges, extra travel cost.

export const TRAVERSAL_TYPES = ['land', 'water', 'cave', 'special'];

// Player capabilities that edges can require. Every player starts with
// CONFIG.travel.startingCapabilities; how they are gained later is DQ-16.
export const CAPABILITIES = {
  canTravelWater: { name: 'Water travel', icon: '🌊' },
};

const SEA = 'Open-water route: needs water travel (Surf / boat — DQ-16).';

export const TRAVEL_CONNECTIONS = [
  // Southern sea loop: Fuchsia -> 19 -> Seafoam -> 20 -> Cinnabar -> 21 -> Pallet.
  { a: 'pallet-town', b: 'route-21', traversal: 'water', requires: ['canTravelWater'], note: SEA },
  { a: 'route-21', b: 'cinnabar-island', traversal: 'water', requires: ['canTravelWater'], note: SEA },
  { a: 'cinnabar-island', b: 'route-20', traversal: 'water', requires: ['canTravelWater'], note: SEA },
  { a: 'route-20', b: 'seafoam-islands', traversal: 'water', requires: ['canTravelWater'], note: SEA },
  { a: 'seafoam-islands', b: 'route-19', traversal: 'water', requires: ['canTravelWater'], note: SEA },
  { a: 'route-19', b: 'fuchsia-city', traversal: 'water', requires: ['canTravelWater'], note: SEA },
];
