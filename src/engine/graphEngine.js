// The one effective travel graph (Build 3.3 A1, DQ-121; fixes AUD-03).
//
// Where a player may go right now = the game's network (travelEngine: the board,
// its Underground Paths) ∩ the player's capabilities (water from the Soul Badge)
// ∩ today's closures. Today the only closures are Team Rocket's blocks; regional
// incidents and persistent blockers (Snorlax, Cut — later slices) join HERE, in
// `worldBlocks`, never in a second movement system.
//
// Every caller asks this module: legal moves and the reasons a move is closed
// (turnEngine), the AI's distances and its BFS, mission destinations and mission
// distance (questEngine, with rules.travelGraph 'v2'), the board's highlights
// (table/board.js). The board's geometry is never changed here.
import { rocketBlocks } from './rocketEngine.js';
import { blockedNeighbors, canTraverse, traversableNeighbors, travelDistances } from './travelEngine.js';

// Today's closures: { locations: [ids nobody may enter], edges: [edgeKey] } or null.
export function worldBlocks(state) {
  return rocketBlocks(state);
}

// The closures mission routing respects: the effective graph's in new games
// (rules.travelGraph 'v2'); an older game keeps routing on the bare network
// (Build 3.2 and earlier — AUD-03 stays as it was there).
export function questBlocks(state) {
  return state.config.rules.travelGraph === 'v2' ? worldBlocks(state) : null;
}

export function legalMoves(state, player) {
  return traversableNeighbors(player, state.config, worldBlocks(state));
}

export function closedNeighbors(state, player) {
  return blockedNeighbors(player, state.config, worldBlocks(state));
}

export function canStep(state, player, from, to) {
  return canTraverse(player, from, to, state.config, worldBlocks(state));
}

export function distancesFrom(state, player, from = player.location) {
  return travelDistances(player, from, state.config, worldBlocks(state));
}
