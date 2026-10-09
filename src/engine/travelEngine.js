// Movement legality = canonical adjacency (data/locations.js) AND the edge's
// travel requirements (data/travelConnections.js) met by the player.
// The turn engine asks this module; nothing here reads map coordinates.
import { TRAVEL_CONNECTIONS } from '../data/travelConnections.js';
import { areAdjacent, getNeighbors } from '../data/locations.js';

const OVERLAND = Object.freeze({ traversal: 'land', requires: Object.freeze([]) });

export function edgeKey(a, b) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

const META_BY_EDGE = Object.fromEntries(TRAVEL_CONNECTIONS.map((e) => [edgeKey(e.a, e.b), e]));

// Metadata of the edge between a and b (overland with no requirement by default).
export function getEdgeMeta(a, b) {
  return META_BY_EDGE[edgeKey(a, b)] ?? OVERLAND;
}

export function missingRequirements(player, from, to) {
  return getEdgeMeta(from, to).requires.filter((cap) => !player.capabilities?.[cap]);
}

// Temporary blocks from a Team Rocket plot (rocketEngine.rocketBlocks):
// { locations: [ids nobody may enter — anyone inside may still leave],
//   edges: [edgeKey — closed both ways] }. Absent / null = no blocks.
export function isBlocked(blocks, from, to) {
  if (!blocks) return false;
  return Boolean(blocks.locations?.includes(to) || blocks.edges?.includes(edgeKey(from, to)));
}

export function canTraverse(player, from, to, config, blocks = null) {
  return areAdjacent(from, to, config) && missingRequirements(player, from, to).length === 0 && !isBlocked(blocks, from, to);
}

export function traversableNeighbors(player, config, blocks = null) {
  return getNeighbors(player.location, config).filter((to) => missingRequirements(player, player.location, to).length === 0 && !isBlocked(blocks, player.location, to));
}

// Adjacent but currently closed to this player, with the reason
// (`missing` capabilities, or `rocket: true` for a Team Rocket block).
export function blockedNeighbors(player, config, blocks = null) {
  return getNeighbors(player.location, config)
    .map((to) => ({ to, missing: missingRequirements(player, player.location, to), traversal: getEdgeMeta(player.location, to).traversal, ...(isBlocked(blocks, player.location, to) ? { rocket: true } : {}) }))
    .filter((b) => b.missing.length > 0 || b.rocket);
}

// Steps from `from` to every location this player can currently reach.
export function travelDistances(player, from, config, blocks = null) {
  const dist = { [from]: 0 };
  const queue = [from];
  while (queue.length) {
    const at = queue.shift();
    for (const to of getNeighbors(at, config)) {
      if (dist[to] === undefined && missingRequirements(player, at, to).length === 0 && !isBlocked(blocks, at, to)) {
        dist[to] = dist[at] + 1;
        queue.push(to);
      }
    }
  }
  return dist;
}
