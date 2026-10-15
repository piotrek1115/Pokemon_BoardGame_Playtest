// Board topology migration (DQ-96, schema 16). One explicit boundary: a game
// saved on the graph before the merge ('kanto46') moves to the family board
// ('kanto43') here — and only here. Every saved reference to a retired place
// (a player's place, last place, visited places, explore counts, the wary
// place of Vigilance, mission progress) is mapped to the place it merged
// into; nothing else changes (the game keeps its rule switches). The step is
// recorded in `setup.topologyMigration`, so replayGame plays the history up to
// it on the old graph, migrates at the same point and goes on: replays stay
// exact. No string is replaced anywhere else.
// A game on the family board stays on its board: a Build 3.0 game keeps
// 'kanto43' (Route 10 / Rock Tunnel), new games are 'kanto45' (DQ-104) — no
// migration between those two.
import { MERGED_INTO, getLocation, topologyOf } from '../data/locations.js';

const MERGED_BOARD = 'kanto43';
import { log } from './log.js';

const canonical = (id) => MERGED_INTO[id] ?? id;
const canonicalList = (ids) => [...new Set(ids.map(canonical))];

export function migrateTopology(state) {
  const from = topologyOf(state.config);
  if (from !== 'kanto46') return false;
  for (const p of state.players) {
    p.location = canonical(p.location);
    if (p.previousLocation) p.previousLocation = canonical(p.previousLocation);
    p.visited = canonicalList(p.visited);
    const counts = {};
    for (const [id, n] of Object.entries(p.exploreCounts ?? {})) counts[canonical(id)] = (counts[canonical(id)] ?? 0) + n;
    p.exploreCounts = counts;
    if (p.vigilance?.location) p.vigilance.location = canonical(p.vigilance.location);
    if (p.fatigue) {
      const fatigue = {};
      for (const [id, n] of Object.entries(p.fatigue)) fatigue[canonical(id)] = Math.max(fatigue[canonical(id)] ?? 0, n);
      p.fatigue = fatigue;
    }
    for (const q of p.quests ?? []) {
      if (q.destination) q.destination = canonical(q.destination);
      if (q.visited) q.visited = canonicalList(q.visited);
      if (q.places) q.places = canonicalList(q.places);
    }
  }
  if (state.rocket?.active) state.rocket.active.location = canonical(state.rocket.active.location);
  if (state.shop) state.shop.location = canonical(state.shop.location);
  state.config.map.topology = MERGED_BOARD;
  state.setup.topologyMigration = { from, atHistory: state.history.length };
  const merged = Object.entries(MERGED_INTO).map(([old, into]) => `${getLocation(old).name} → ${getLocation(into).name} / ${getLocation(into).subtitle}`).join(', ');
  log(state, 'system', `Board update (DQ-96): merged places — ${merged}. The game keeps its rules.`);
  return true;
}
