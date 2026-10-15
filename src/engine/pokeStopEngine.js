// Poké Stops (the hubs of DQ-33; Macro 01: more of them, data/pokeStops.js).
// Phase 2 / Build 2 games (rules.pokeStop 'v1'): a visit costs 1 action, fully heals the active team and opens the shop (phase
// "shop"); buying and the mission swap are free until the player leaves.
//
// Gameplay P1 (rules.pokeStop 'v2', DQ-89): no heal on entering. Two separate
// actions, 1 each, both allowed in one turn: Leczenie (healAtPokeStop — the
// whole active team to full HP, fainted included) and Sklep (openShop — buy,
// sell (rules.selling, DQ-94) and the mission swap, any number, until the
// player leaves). Both count as a Poké Stop visit for missions.
import { getLocation } from '../data/locations.js';
import { pokeStopPlaces } from '../data/pokeStops.js';
import { ITEMS } from '../data/items.js';
import { getSpecies } from '../data/pokemon.js';
import { log } from './log.js';
import { currentPlayer } from './gameState.js';
import { addItem, ballCount, itemCount } from './itemEngine.js';
import { recordQuestEvent, refillQuests } from './questEngine.js';
import { SHOP_STOCK } from '../data/economy3.js';

// Macro 01 (rules.pokeStops): which places have one depends on the game.
export function hasPokeStop(locationId, config) {
  if (!config) throw new Error('hasPokeStop needs the game config (rules.pokeStops)');
  return pokeStopPlaces(config).includes(locationId);
}

export function pokeStopV2(state) {
  return state.config.rules.pokeStop === 'v2';
}

// The whole active team back to full HP, fainted Pokémon included (DQ-34).
function healTeam(player) {
  return player.team.filter((p) => p.hp < p.maxHp).map((p) => {
    const before = p.hp;
    p.hp = p.maxHp;
    return `${getSpecies(p.species).name} ${before}→${p.maxHp}${before === 0 ? ' (revived)' : ''}`;
  });
}

function countVisit(state, player) {
  recordQuestEvent(state, player, { kind: 'pokeStopVisit', location: player.location });
  refillQuests(state, player); // top up if the deck could not refill earlier
}

function enterShop(state, player) {
  state.shop = { location: player.location, questSwaps: 0 };
  state.phase = 'shop';
}

// Phase 2 / Build 2 (rules.pokeStop 'v1'): a visit heals the team and opens the shop.
export function visitPokeStop(state) {
  const player = currentPlayer(state);
  const healed = healTeam(player);
  log(state, 'action', `${player.name} visits the Poké Stop in ${getLocation(player.location).name}: ${healed.length ? `full heal — ${healed.join(', ')}` : 'team already healthy'}`);
  enterShop(state, player);
  countVisit(state, player);
}

// Gameplay P1: Leczenie — only when someone in the team needs it.
export function canHealAtPokeStop(player) {
  return player.team.some((p) => p.hp < p.maxHp);
}

export function healAtPokeStop(state) {
  const player = currentPlayer(state);
  const healed = healTeam(player);
  log(state, 'action', `${player.name} heals the team at the Poké Stop in ${getLocation(player.location).name}: ${healed.join(', ')}`, { pokeStop: { event: 'heal', healed: healed.length } });
  countVisit(state, player);
}

// Gameplay P1: Sklep — buying, selling and the mission swap; no heal.
export function openShop(state) {
  const player = currentPlayer(state);
  log(state, 'action', `${player.name} goes shopping at the Poké Stop in ${getLocation(player.location).name}`, { pokeStop: { event: 'shop' } });
  enterShop(state, player);
  countVisit(state, player);
}

export function price(itemId, config) {
  return config.economy[itemId];
}

// What a Poké Stop sells in this game: the stock, plus the Evolution Stones in
// Growth games (a placeholder source until 3B, DQ-78).
export function shopStock(state, place = currentPlayer(state).location) {
  const cfg = state.config;
  if (cfg.rules.shopStock === 'regional') {
    // Build 3.3 E2 (data/economy3.js): the basics everywhere, a few cities their own
    const { base, extra } = SHOP_STOCK.regional;
    return [...base, ...(extra[place] ?? [])].filter((id) => id !== 'ultraball' || cfg.rules.ultraBall);
  }
  const stock = cfg.rules.healingItems === 'v2' ? cfg.pokeStop.stockV2 : cfg.pokeStop.stock;
  return cfg.rules.evolution === 'growth' ? [...stock, ...cfg.pokeStop.placeholderStones] : stock;
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

// ---- selling (rules.selling, DQ-94) ---------------------------------------------
// ⌊rate × buy price⌋ — always below the buy price, so a buy / sell loop can
// only lose money. Never key items, never the last ball (Poké Balls and
// Super Balls together, as for a trainer retreat).
export function sellPrice(itemId, config) {
  const buy = config.economy[itemId];
  return buy ? Math.floor(buy * config.selling.rate) : 0;
}

export function canSell(player, itemId, config) {
  if (!ITEMS[itemId] || ITEMS[itemId].kind === 'key' || sellPrice(itemId, config) < 1) return false;
  if (itemCount(player, itemId) <= 0) return false;
  if (ITEMS[itemId].kind === 'ball') return ballCount(player) > 1;
  return true;
}

export function sellableItems(state) {
  if (!state.config.rules.selling) return [];
  const player = currentPlayer(state);
  return Object.keys(ITEMS).filter((id) => canSell(player, id, state.config));
}

export function sellItem(state, itemId) {
  const player = currentPlayer(state);
  const gain = sellPrice(itemId, state.config);
  addItem(player, itemId, -1);
  player.money += gain;
  log(state, 'action', `${player.name} sells a ${ITEMS[itemId].name} for ${gain} (money ${player.money}, now ${itemCount(player, itemId)})`, { sell: { item: itemId, gain } });
}

export function leaveShop(state) {
  log(state, 'action', `${currentPlayer(state).name} leaves the Poké Stop`);
  state.shop = null;
  state.phase = 'turn';
}
