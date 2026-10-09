// Inventory and item use. Poké Balls keep their own counter (`pokeballs`,
// from Milestone A); every other item lives in `player.items`.
import { ITEMS } from '../data/items.js';
import { getSpecies } from '../data/pokemon.js';
import { log } from './log.js';
import { currentPlayer, heal } from './gameState.js';

export function itemCount(player, id) {
  return id === 'pokeball' ? player.pokeballs : player.items?.[id] ?? 0;
}

export function addItem(player, id, n) {
  if (!ITEMS[id]) throw new Error(`Unknown item: ${id}`);
  if (id === 'pokeball') player.pokeballs = Math.max(0, player.pokeballs + n);
  else player.items[id] = Math.max(0, (player.items[id] ?? 0) + n);
}

// Team Pokémon an item can be used on right now.
export function itemTargets(player, id) {
  if (itemCount(player, id) <= 0) return [];
  if (id === 'potion') return player.team.filter((p) => p.hp > 0 && p.hp < p.maxHp);
  if (id === 'revive') return player.team.filter((p) => p.hp === 0);
  return [];
}

// `battle`: used as the battle exchange (Phase 3A-2) — the log entry says so.
export function useItem(state, id, targetUid, { battle = false } = {}) {
  const player = currentPlayer(state);
  const pokemon = player.team.find((p) => p.uid === targetUid);
  const name = getSpecies(pokemon.species).name;
  addItem(player, id, -1);
  const data = battle ? { item: { id, target: targetUid, species: pokemon.species, battle: true } } : undefined;
  if (id === 'potion') {
    const healed = heal(pokemon, state.config.items.potion.heal, false);
    log(state, 'action', `${player.name} uses a Potion: ${name} +${healed} HP (❤ ${pokemon.hp}/${pokemon.maxHp})`, data);
  } else if (id === 'revive') {
    pokemon.hp = Math.max(1, Math.ceil(pokemon.maxHp * state.config.items.revive.hpFraction));
    log(state, 'action', `${player.name} uses a Revive: ${name} is back (❤ ${pokemon.hp}/${pokemon.maxHp})`, data);
  } else {
    throw new Error(`${id} cannot be used this way`);
  }
}
