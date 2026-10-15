// Bonus 2, 14.10 — character traits (rules.characterTraits 'pilot'; data/characterTraits.js). Small hooks only:
// the modules that rest, catch and end battles ask here; nothing here rolls a die or keeps a counter.
// Every use logs { trait: { id, player, … } } so the table can say it in one line.
import { CHARACTER_TRAITS } from '../data/characterTraits.js';
import { getSpecies } from '../data/pokemon.js';
import { log } from './log.js';
import { getLead } from './gameState.js';
import { canTakeGrowth, growthEdge, usesGrowth } from './growthEngine.js';
import { battleGivesNoGrowth } from './fatigueEngine.js';

export const usesTraits = (config) => config.rules.characterTraits === 'pilot';
export const traitOf = (player, config) => (usesTraits(config) ? CHARACTER_TRAITS[player.id] ?? null : null); // a player's id is its character
const has = (state, player, id) => traitOf(player, state.config)?.id === id;

// Brock: +1 ❤ on a rest.
export const restBonus = (state, player) => (has(state, player, 'brock') ? 1 : 0);
export function noteRest(state, player) {
  if (has(state, player, 'brock')) log(state, 'action', `💤 ${player.name}'s care: +1 HP more.`, { trait: { id: 'brock', player: player.id, event: 'rest' } });
}

// Misty: one colour easier on the Catch Die of a Water-type Pokémon.
export const catchEase = (state, player, pokemon) => (has(state, player, 'misty') && getSpecies(pokemon.species).types.includes('water') ? 1 : 0);

// Gary: a species new to his Pokédex caught (`fresh` was read before the catch was recorded).
export function afterCatch(state, player, speciesId, fresh) {
  if (!fresh || !has(state, player, 'gary')) return;
  player.money += 1;
  log(state, 'action', `🔬 ${player.name} researches a new species — ${getSpecies(speciesId).name}: +1 money.`, { trait: { id: 'gary', player: player.id, event: 'newSpecies', species: speciesId } });
}

// Ash: a won hard battle — the Pokémon standing (the lead) +1 Growth, if it can still grow and the place gives Growth.
const HARD_WINS = ['trainerWon', 'rocketWon', 'gymWon', 'eliteFourWon', 'leagueWon'];
export function afterBattle(state, player, enc, result) {
  if (!has(state, player, 'ash') || !HARD_WINS.includes(result) || !usesGrowth(state) || battleGivesNoGrowth(enc)) return;
  const lead = getLead(player);
  if (!lead || !canTakeGrowth(lead, state.config.rules)) return;
  const edge = growthEdge(lead, state.config.rules);
  lead.growth = Math.min(edge.growth, (lead.growth ?? 0) + 1);
  log(state, 'evolution', `⭐ ${player.name} never gives up: ${getSpecies(lead.species).name} +1 Growth (${lead.growth}/${edge.growth}).`, { trait: { id: 'ash', player: player.id, event: 'growth', uid: lead.uid, growth: lead.growth, threshold: edge.growth } });
}
