// Poké Stops (5 hubs, DQ-33): a visit costs 1 action, fully heals the active
// team and opens the shop (phase "shop"); buying and the mission swap are free
// until the player leaves.
import { getLocation, hasFeature } from '../data/locations.js';
import { ITEMS } from '../data/items.js';
import { getSpecies } from '../data/pokemon.js';
import { log } from './log.js';
import { currentPlayer } from './gameState.js';
import { addItem, itemCount } from './itemEngine.js';
import { recordQuestEvent, refillQuests } from './questEngine.js';

export function hasPokeStop(locationId) {
  return hasFeature(locationId, 'pokeStop');
}

// A visit heals the whole active team to full HP, fainted Pokémon included (DQ-34).
export function visitPokeStop(state) {
  const player = currentPlayer(state);
  const healed = player.team.filter((p) => p.hp < p.maxHp).map((p) => {
    const before = p.hp;
    p.hp = p.maxHp;
    return `${getSpecies(p.species).name} ${before}→${p.maxHp}${before === 0 ? ' (revived)' : ''}`;
  });
  log(state, 'action', `${player.name} visits the Poké Stop in ${getLocation(player.location).name}: ${healed.length ? `full heal — ${healed.join(', ')}` : 'team already healthy'}`);
  state.shop = { location: player.location, questSwaps: 0 };
  state.phase = 'shop';
  recordQuestEvent(state, player, { kind: 'pokeStopVisit', location: player.location });
  refillQuests(state, player); // top up if the deck could not refill earlier
}

export function price(itemId, config) {
  return config.economy[itemId];
}

// What a Poké Stop sells in this game: the stock, plus the Evolution Stones in
// Growth games (a placeholder source until 3B, DQ-78).
export function shopStock(state) {
  const cfg = state.config;
  return cfg.rules.evolution === 'growth' ? [...cfg.pokeStop.stock, ...cfg.pokeStop.placeholderStones] : cfg.pokeStop.stock;
}

export function buyableItems(state) {
  const player = currentPlayer(state);
  return shopStock(state).filter((id) => player.money >= price(id, state.config));
}

export function buyItem(state, itemId) {
  const player = currentPlayer(state);
  const cost = price(itemId, state.config);
  player.money -= cost;
  addItem(player, itemId, 1);
  log(state, 'action', `${player.name} buys a ${ITEMS[itemId].name} for ${cost} (money ${player.money}, now ${itemCount(player, itemId)})`);
}

export function leaveShop(state) {
  log(state, 'action', `${currentPlayer(state).name} leaves the Poké Stop`);
  state.shop = null;
  state.phase = 'turn';
}
