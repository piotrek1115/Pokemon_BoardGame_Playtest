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
// Every edge has the travel contract below (defaults for an overland edge):
//   actionCost  Move actions the step costs (1)
//   moneyCost   money the step costs (0)
//   requires    capability keys ([])
// The engine plays actionCost 1 / moneyCost 0 only (tests pin every edge to
// them): paid or multi-action travel needs a rule decision first (DQ-85).
// Planned extensions (not used yet): progression gates (badges), travel events
// fired on an edge, one-way edges.

export const TRAVERSAL_TYPES = ['land', 'water', 'cave', 'special', 'underground'];

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

// ---- The travel network (3A-5, DQ-85; switch CONFIG.rules.travelNetwork) ----
//
// The ONLY place a board-game shortcut edge may come from. Each version lists
// the edges it ADDS to the canonical graph of locations.js; a version never
// removes a canonical edge and never adds a node. A game plays the version it
// was created with (a v1 save stays v1). Tests reject an edge that already is
// canonical, one with an unknown end, and a cost other than 1 action / 0 money.
//
//   v1  the canonical Kanto graph only (Phase 2, Build 2, saves before 3A-5)
//   v2  + Underground Path Route 5 <-> Route 6 and Route 7 <-> Route 8: one
//       Move action, free, no requirement, no encounter on the way; both
//       bypass Saffron City (Saffron stays reachable by its four roads)
//
// Edge fields: a, b, kind ('underground'), label, traversal, actionCost,
// moneyCost, requires, note.
const UNDERGROUND = Object.freeze({
  kind: 'underground', label: 'Underground Path', traversal: 'underground', actionCost: 1, moneyCost: 0, requires: Object.freeze([]),
  note: 'Underground Path under Saffron City: 1 Move action, free, nothing met on the way (DQ-85).',
});

export const NETWORK_EDGES = Object.freeze({
  v1: Object.freeze([]),
  v2: Object.freeze([
    Object.freeze({ a: 'route-5', b: 'route-6', ...UNDERGROUND }),
    Object.freeze({ a: 'route-7', b: 'route-8', ...UNDERGROUND }),
  ]),
});

// Presentation only (no rule): a canonical place the family board shows as a
// cross-map shortcut. Diglett's Cave stays a real location — 2 moves from
// Route 2 to Route 11, explorable, closable by Team Rocket — and there is no
// direct Route 2 <-> Route 11 edge.
export const CROSS_MAP_SHORTCUTS = Object.freeze([
  Object.freeze({ location: 'digletts-cave', between: Object.freeze(['route-2', 'route-11']) }),
]);
