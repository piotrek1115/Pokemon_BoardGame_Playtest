// Evolution, in one of two models (CONFIG.rules.evolution, kept per game):
//
// 'stars' (Phase 2; DQ-22, Variant 3): no XP on individual Pokémon. Each player
// has one star pool, earned by successful encounters (see endEncounter) and
// spent during their own turn, outside encounters, to evolve an active-team
// Pokémon by one stage at no action cost (DQ-35). A Pokémon evolves at most
// CONFIG.evolution.maxStagesPerTurn stages per turn, so a stockpile can't turn
// Charmander into Charizard in one go.
//
// 'growth' (Phase 3A; DQ-74…79): each Pokémon evolves on its own Growth
// (growthEngine.js) once it reaches its edge's threshold, plus the edge's
// Evolution Stone if it has one (consumed). Free, outside battle, active team
// only, not when fainted, and at most CONFIG.evolution.maxPerTurn evolutions per
// player turn — any Pokémon, not one stage each. Growth resets to 0 on the new
// edge.
import { POKEMON_BY_ID, getSpecies } from '../data/pokemon.js';
import { ITEMS } from '../data/items.js';
import { log } from './log.js';
import { currentPlayer, markSeen } from './gameState.js';
import { recordQuestEvent } from './questEngine.js';
import { growthEdge, growthEdges, usesGrowth } from './growthEngine.js';
import { addItem, itemCount } from './itemEngine.js';

const REASONS = { wildFainted: 'defeated a wild Pokémon', caught: 'caught a Pokémon', trainerWon: 'won a trainer battle', gymWon: 'won a gym badge' };

export function awardStars(state, n, reason) {
  const player = currentPlayer(state);
  player.stars += n;
  player.stats.starsEarned += n;
  log(state, 'evolution', `⭐ ${player.name} earns ${n} Evolution Star${n > 1 ? 's' : ''} (${REASONS[reason] ?? reason}) — now ${player.stars}`);
}

export function evolutionTarget(species) {
  return species.evolvesTo ? POKEMON_BY_ID[species.evolvesTo] ?? null : null;
}

export function starCost(species, config) {
  return config.evolution.starCost[species.stage];
}

// Why this team Pokémon cannot evolve right now, or null if it can.
export function evolveBlocker(state, player, pokemon) {
  const species = getSpecies(pokemon.species);
  const branching = usesGrowth(state) && growthEdges(pokemon, state.config.rules).length > 1; // bonus 14.10: Eevee
  if (!evolutionTarget(species) && !branching) return 'final form';
  if (state.phase !== 'turn') return 'only during your turn, outside encounters';
  if (pokemon.hp === 0) return 'fainted';
  if (usesGrowth(state)) {
    const edge = growthEdge(pokemon, state.config.rules);
    if ((pokemon.growth ?? 0) < edge.growth) return `needs ${edge.growth} Growth (has ${pokemon.growth ?? 0})`;
    if (branching && !evolveOptions(state, player, pokemon).length) return `needs a ${growthEdges(pokemon, state.config.rules).map((e) => ITEMS[e.item].name).join(' / ')}`;
    if (!branching && edge.item && itemCount(player, edge.item) < 1) return `needs a ${ITEMS[edge.item].name}`;
    if (state.turn.evolved.length >= state.config.evolution.maxPerTurn) return 'one evolution per turn — this one waits for your next turn';
    return null;
  }
  const timesThisTurn = state.turn.evolved.filter((uid) => uid === pokemon.uid).length;
  if (timesThisTurn >= state.config.evolution.maxStagesPerTurn) return 'already evolved this turn';
  const cost = starCost(species, state.config);
  if (player.stars < cost) return `needs ${cost} ⭐ (have ${player.stars})`;
  return null;
}

// Bonus 14.10 (rules.eeveeBranch): the forms this Pokémon can take now — a branch whose stone the player holds.
export function evolveOptions(state, player, pokemon) {
  return growthEdges(pokemon, state.config.rules).filter((e) => !e.item || itemCount(player, e.item) > 0).map((e) => e.to);
}

export function evolvablePokemon(state) {
  if (state.phase !== 'turn') return [];
  const player = currentPlayer(state);
  return player.team.filter((p) => evolveBlocker(state, player, p) === null);
}

export function evolve(state, uid, choice = null) {
  if (usesGrowth(state)) {
    evolveByGrowth(state, uid, choice);
    return;
  }
  const player = currentPlayer(state);
  const pokemon = player.team.find((p) => p.uid === uid);
  const from = getSpecies(pokemon.species);
  const to = evolutionTarget(from);
  const cost = starCost(from, state.config);

  player.stars -= cost;
  player.stats.starsSpent += cost;
  player.stats.evolutions += 1;
  // Damage taken stays the same; the new form's extra max HP is added (DQ-23).
  pokemon.hp = Math.max(1, Math.min(to.hp, pokemon.hp + (to.hp - from.hp)));
  pokemon.maxHp = to.hp;
  pokemon.species = to.id;
  state.turn.evolved.push(uid);
  markSeen(player, to.id);
  if (!player.pokedex.evolved.includes(to.id)) player.pokedex.evolved.push(to.id);

  log(state, 'evolution', `✨ ${player.name}'s ${from.name} evolved into ${to.name}! (−${cost} ⭐, ${player.stars} left) ❤ ${pokemon.hp}/${pokemon.maxHp} · ⚔ ${to.attack >= 0 ? '+' : ''}${to.attack}`);
  recordQuestEvent(state, player, { kind: 'evolve', species: to.id });
}

function evolveByGrowth(state, uid, choice = null) {
  const player = currentPlayer(state);
  const pokemon = player.team.find((p) => p.uid === uid);
  const from = getSpecies(pokemon.species);
  // bonus 14.10: a branching species takes the chosen form's edge (its stone); the same instance evolves
  const edge = choice ? growthEdges(pokemon, state.config.rules).find((e) => e.to === choice) : growthEdge(pokemon, state.config.rules);
  const to = getSpecies(edge.to);
  if (edge.item) addItem(player, edge.item, -1);
  player.stats.evolutions += 1;
  // Damage taken stays the same; the new form's extra max HP is added (DQ-23).
  pokemon.hp = Math.max(1, Math.min(to.hp, pokemon.hp + (to.hp - from.hp)));
  pokemon.maxHp = to.hp;
  pokemon.species = to.id;
  pokemon.growth = 0; // the next edge starts from zero (DQ-76)
  state.turn.evolved.push(uid);
  markSeen(player, to.id);
  if (!player.pokedex.evolved.includes(to.id)) player.pokedex.evolved.push(to.id);
  const next = growthEdge(pokemon, state.config.rules);
  log(state, 'evolution', `✨ ${player.name}'s ${from.name} evolved into ${to.name}!${edge.item ? ` (used a ${ITEMS[edge.item].name})` : ''} ❤ ${pokemon.hp}/${pokemon.maxHp} · ⚔ ${to.attack >= 0 ? '+' : ''}${to.attack}${next ? ` · Growth 0/${next.growth}` : ' · final form'}`, {
    evolution: { uid, from: from.id, to: to.id, stage: to.stage, item: edge.item ?? null },
  });
  recordQuestEvent(state, player, { kind: 'evolve', species: to.id });
}
