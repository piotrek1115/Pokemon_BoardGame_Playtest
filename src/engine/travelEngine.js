// Movement legality = adjacency on the game's travel network AND the edge's
// travel requirements (data/travelConnections.js) met by the player.
//
// The travel network (3A-5, DQ-85) is the canonical graph of locations.js plus
// the shortcut edges of the game's `rules.travelNetwork` version. It is the one
// graph of the game: legal moves, illegal-move reasons, distances, AI paths,
// mission destinations and the board all read it from here. Nothing else adds
// an edge; nothing here reads map coordinates.
import { NETWORK_EDGES, TRAVEL_CONNECTIONS } from '../data/travelConnections.js';
import { areAdjacent, getNeighbors, isLocationEnabled, topologyLocations } from '../data/locations.js';
import { pickVersion } from '../rules.js';

// The travel contract every edge has (an entry overrides what it lists).
const CONTRACT = Object.freeze({ actionCost: 1, moneyCost: 0, requires: Object.freeze([]) });
const OVERLAND = Object.freeze({ traversal: 'land', ...CONTRACT });

export function edgeKey(a, b) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

const withContract = (e) => Object.freeze({ ...CONTRACT, ...e });
const META_BY_EDGE = Object.fromEntries(TRAVEL_CONNECTIONS.map((e) => [edgeKey(e.a, e.b), withContract(e)]));

// Per version: the shortcut edges by key and the extra neighbours of each place.
const NETWORKS = Object.fromEntries(Object.entries(NETWORK_EDGES).map(([version, edges]) => {
  const byEdge = {};
  const extra = {};
  for (const e of edges) {
    byEdge[edgeKey(e.a, e.b)] = withContract(e);
    (extra[e.a] ??= []).push(e.b);
    (extra[e.b] ??= []).push(e.a);
  }
  return [version, { byEdge, extra }];
}));

function network(config) {
  return pickVersion(NETWORKS, config.rules.travelNetwork, 'travel network');
}

// The shortcut edges this game adds to the canonical graph (data entries).
export function networkEdges(config) {
  return pickVersion(NETWORK_EDGES, config.rules.travelNetwork, 'travel network')
    .filter((e) => isLocationEnabled(e.a, config) && isLocationEnabled(e.b, config));
}

// Neighbours on the game's network: the canonical ones first, then shortcuts.
export function networkNeighbors(id, config) {
  const extra = network(config).extra[id];
  const canonical = getNeighbors(id, config);
  return extra ? [...canonical, ...extra.filter((n) => isLocationEnabled(n, config))] : canonical;
}

export function networkAdjacent(a, b, config) {
  if (areAdjacent(a, b, config)) return true;
  return isLocationEnabled(a, config) && isLocationEnabled(b, config) && Boolean(network(config).byEdge[edgeKey(a, b)]);
}

// Every edge of the game's network once, for drawing: { a, b, meta }.
export function networkEdgeList(config) {
  const list = [];
  for (const loc of topologyLocations(config)) {
    if (!isLocationEnabled(loc.id, config)) continue;
    for (const n of getNeighbors(loc.id, config)) if (loc.id < n) list.push({ a: loc.id, b: n, meta: getEdgeMeta(loc.id, n, config) });
  }
  for (const e of networkEdges(config)) list.push({ a: e.a, b: e.b, meta: getEdgeMeta(e.a, e.b, config) });
  return list;
}

// Metadata of the edge between a and b: how it is travelled and its contract
// (overland, 1 action, free, no requirement by default). Without a config only
// the canonical edges' metadata is known.
export function getEdgeMeta(a, b, config = null) {
  const key = edgeKey(a, b);
  return (config && network(config).byEdge[key]) ?? META_BY_EDGE[key] ?? OVERLAND;
}

export function missingRequirements(player, from, to, config = null) {
  return getEdgeMeta(from, to, config).requires.filter((cap) => !player.capabilities?.[cap]);
}

// Temporary blocks from a Team Rocket plot (rocketEngine.rocketBlocks):
// { locations: [ids nobody may enter — anyone inside may still leave],
//   edges: [edgeKey — closed both ways] }. Absent / null = no blocks. An edge
// block closes exactly that edge, never another way between other places.
export function isBlocked(blocks, from, to) {
  if (!blocks) return false;
  return Boolean(blocks.locations?.includes(to) || blocks.edges?.includes(edgeKey(from, to)));
}

export function canTraverse(player, from, to, config, blocks = null) {
  return networkAdjacent(from, to, config) && missingRequirements(player, from, to, config).length === 0 && !isBlocked(blocks, from, to);
}

export function traversableNeighbors(player, config, blocks = null) {
  return networkNeighbors(player.location, config).filter((to) => missingRequirements(player, player.location, to, config).length === 0 && !isBlocked(blocks, player.location, to));
}

// Adjacent but currently closed to this player, with the reason
// (`missing` capabilities, or `rocket: true` for a Team Rocket block).
export function blockedNeighbors(player, config, blocks = null) {
  return networkNeighbors(player.location, config)
    .map((to) => ({ to, missing: missingRequirements(player, player.location, to, config), traversal: getEdgeMeta(player.location, to, config).traversal, ...(isBlocked(blocks, player.location, to) ? { rocket: true } : {}) }))
    .filter((b) => b.missing.length > 0 || b.rocket);
}

// Steps from `from` to every location this player can currently reach.
export function travelDistances(player, from, config, blocks = null) {
  const dist = { [from]: 0 };
  const queue = [from];
  while (queue.length) {
    const at = queue.shift();
    for (const to of networkNeighbors(at, config)) {
      if (dist[to] === undefined && missingRequirements(player, at, to, config).length === 0 && !isBlocked(blocks, at, to)) {
        dist[to] = dist[at] + 1;
        queue.push(to);
      }
    }
  }
  return dist;
}
