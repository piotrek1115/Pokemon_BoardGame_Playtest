// One Kanto bonus 14.10 — FISHING with the Old Rod (rules.fishing 'v1'; data/fishing.js). „Łów” is one action at
// a place with water, for a player holding the Old Rod (a lasting key item in the quest book's key-item list):
//   1. fatigue READ FIRST (fatigueEngine — the same contract as an Explore: the level stamps the battle; an
//      exhausted place turns a bite on a quiet face into nothing);
//   2. the player's own d6 (kind 'player' — a physical die at the table): a bite on FISHING.bite faces;
//   3. a bite: one species from the place's fishing pool (the game's weighted draw) appears as an ordinary
//      wild encounter (encounterEngine.appearWild) — fight, catch (the Catch Dice), run as always; the
//      encounter is marked `fishing` so a catch counts in stats.fishing.caught (FISHING ROOKIE);
//   4. fatigue +1 here, whatever happened.
// Saves keep everything in the state (the encounter, its stamp, the counters). The AI never holds a rod
// (it never takes the sailor's quest), so it never fishes.
import { FISHING } from '../data/fishing.js';
import { getSpecies } from '../data/pokemon.js';
import { getLocation, locationBiomes } from '../data/locations.js';
import { d6, weightedPick } from './rng.js';
import { log } from './log.js';
import { hasHealthyPokemon } from './gameState.js';
import { appearWild } from './encounterEngine.js';
import { placeFatigue, quietFace, raiseFatigue, stampBattle } from './fatigueEngine.js';

export const usesFishing = (config) => config.rules.fishing === 'v1';
const spec = () => FISHING.v1;
export const hasRod = (player) => Boolean(player.questBook?.keyItems.includes(spec().rod));
// The waters of a place: 'water' (fresh) and / or 'sea' — none = no fishing there.
export const fishingWaters = (place, config) => locationBiomes(place, config).filter((b) => b === 'water' || b === 'sea');
export const fishingStats = (player) => (player.stats.fishing ??= { tries: 0, bites: 0, caught: 0 });

export function canFish(state, player) {
  return usesFishing(state.config) && state.phase === 'turn' && state.turn.actionsRemaining > 0 && hasRod(player)
    && fishingWaters(player.location, state.config).length > 0 && hasHealthyPokemon(player);
}

export function fish(state, player) {
  const place = player.location;
  const fatigue = placeFatigue(player, place, state.config);
  const stats = fishingStats(player);
  stats.tries += 1;
  state.turn.actionsRemaining -= 1;
  log(state, 'action', `🎣 ${player.name} fishes at ${getLocation(place).name}.`, { fishing: { event: 'cast', place } });
  const roll = d6(state, 'Fishing', (v) => (spec().bite.includes(v) ? 'a bite!' : 'nothing bites'), 'player');
  const bite = spec().bite.includes(roll) && !quietFace(roll, fatigue, state.config);
  if (!bite) {
    log(state, 'encounter', `Nothing bites${fatigue >= 2 && spec().bite.includes(roll) ? ' — the fish here know the hook by now' : ''}.`, { fishing: { event: 'nothing', place } });
  } else {
    stats.bites += 1;
    const waters = fishingWaters(place, state.config);
    const pool = waters.flatMap((w) => spec().pools[w]);
    const entry = weightedPick(state, 'Fishing pool', pool, (e) => e.weight, (e) => getSpecies(e.species).name);
    const water = waters.find((w) => spec().pools[w].includes(entry)) ?? waters[0];
    appearWild(state, getSpecies(entry.species), water);
    state.encounter.fishing = true;
    stampBattle(state, fatigue);
    log(state, 'encounter', `🎣 Something bites — a wild ${getSpecies(entry.species).name}!`, { fishing: { event: 'bite', place, species: entry.species } });
  }
  raiseFatigue(player, place, state.config);
}
