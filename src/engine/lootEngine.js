// Build 3.3 E2 — loot from trainers (rules.loot 'v1', data/economy3.js
// TRAINER_LOOT; PROVISIONAL). Small, bounded, from activity:
// - only a won battle with a random trainer that pays money (an exhausted place
//   pays nothing and gives no loot — M02-2; a tired place: only a 6);
// - one d6 per battle, inside the dispatch that won it (a reload or a replay
//   rolls it the same way, once); a SYSTEM die like the trainer's difficulty —
//   with physical dice the game still rolls it;
// - stones from loot are capped per player (player.loot.stones ≤ stoneCap) — the
//   ledger also lists every item it gave (player.loot.items).
// Gyms, the League and Team Rocket never roll it (their own rewards, C1 credits).
import { STONE_SOURCES, TRAINER_LOOT } from '../data/economy3.js';
import { ITEMS } from '../data/items.js';
import { pickVersion } from '../rules.js';
import { createRng, d6, d6With } from './rng.js';
import { log } from './log.js';
import { currentPlayer } from './gameState.js';
import { addItem } from './itemEngine.js';

export function usesLoot(config) {
  return Boolean(config.rules.loot);
}

// EREV (rules.stoneSources 'explore' | 'mixed'): an Explore at a stone place may find its stone.
export function setupStones(state) {
  if (['explore', 'mixed'].includes(state.config.rules.stoneSources)) state.stoneRng = createRng(`${state.seed}:stones`);
}

export function stoneFind(state, player, place, fatigue) {
  const mode = state.config.rules.stoneSources;
  if (!['explore', 'mixed'].includes(mode) || fatigue >= 2) return null; // an exhausted place finds nothing
  const stone = STONE_SOURCES.finds[place];
  const found = (player.stoneFinds ??= []);
  if (!stone || found.includes(place) || (mode === 'mixed' && found.length >= STONE_SOURCES.mixedFindCap)) return null;
  const face = d6With(state, 'stoneRng', 'Stone find', (v) => (v >= STONE_SOURCES.findFace ? `a ${ITEMS[stone].name}!` : 'nothing'));
  if (face < STONE_SOURCES.findFace) return null;
  found.push(place);
  addItem(player, stone, 1);
  log(state, 'encounter', `✨ ${player.name} finds a ${ITEMS[stone].name} here!`, { stoneFind: { item: stone, place } });
  return stone;
}

export function trainerLoot(state, enc) {
  if (!usesLoot(state.config) || enc.kind !== 'trainer' || enc.questChallenge) return null; // E3: a quest challenge pays its quest only
  const player = currentPlayer(state);
  const table = pickVersion(TRAINER_LOOT, state.config.rules.loot, 'trainer loot');
  const tired = (enc.fatigue ?? 0) >= 1;
  const face = d6(state, 'Loot', (v) => (v === 6 ? 'the trainer’s item' : v === 5 && !tired ? 'a Poké Ball' : 'nothing'));
  let item = face === 6 ? table.byClass[enc.trainer.archetype] ?? table.common : face === 5 && !tired ? table.common : null;
  if (item && ITEMS[item].kind === 'evolution' && (player.loot?.stones ?? 0) >= table.stoneCap) item = table.common; // the cap: a Poké Ball instead
  if (!item) return null;
  const ledger = (player.loot ??= { stones: 0, items: [] });
  if (ITEMS[item].kind === 'evolution') ledger.stones += 1;
  ledger.items.push(item);
  addItem(player, item, 1);
  log(state, 'encounter', `${enc.trainer.name} leaves something behind: a ${ITEMS[item].name}!`, { loot: { item, face, trainer: enc.trainer.archetype } });
  return item;
}
