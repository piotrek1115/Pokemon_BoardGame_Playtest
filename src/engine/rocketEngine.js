// Team Rocket plots (Step 4: V3 "Rocket Plots" with the Meowth balloon).
// One shared plot deck; at most one plot is active. At the start of each week
// (from CONFIG.rocket.firstWeek), if no plot is active, a d6 decides whether the
// next plot is revealed; its balloon sits on the plot location until someone
// beats Rocket there. A roaming card moves its balloon one step along the route
// printed on the card at each week start instead.
//
// Rocket battles reuse the trainer battle flow (encounter kind 'rocket': fight
// only, no fleeing). Winning clears the plot: everyone's loot goes back to its
// owner and the winner takes the card reward — no Evolution Star (DQ-27) and no
// mission progress. Losing lets Meowth grab one thing onto the plot card.
//
// Week-start rolls and deck shuffles use their own stream (state.rocketRng), so
// switching Rocket off/on leaves the rest of the dice untouched until a Rocket
// effect changes what players do.
import { ROCKET_PLOTS, ROCKET_PLOTS_BY_ID } from '../data/rocketPlots.js';
import { getLocation } from '../data/locations.js';
import { getSpecies } from '../data/pokemon.js';
import { ITEMS } from '../data/items.js';
import { log } from './log.js';
import { createRng, d6, d6With, shuffleWith } from './rng.js';
import { createPokemonInstance, currentPlayer, hasHealthyPokemon, markSeen } from './gameState.js';
import { addItem, itemCount } from './itemEngine.js';
import { endEncounter } from './encounterEngine.js';
import { edgeKey } from './travelEngine.js';

// Items Meowth may take on a "5" (the player picks which one).
export const LOOT_ITEMS = ['superball', 'potion', 'revive'];

function lootLabel(outcome, config) {
  return { money: `up to ${config.rocket.lootMoney} money`, pokeball: 'a Poké Ball (never the last)', item: 'an item of your choice', nothing: 'Meowth trips!' }[outcome];
}

export function rocketEnabled(state) {
  return Boolean(state.config.rocket?.enabled);
}

export function emptyRocketStats() {
  return {
    battles: 0, challenges: 0, exploreBattles: 0, ambushes: 0, pitfalls: 0,
    wins: 0, losses: 0, cleared: 0, rewardValue: 0,
    lootLost: 0, lootLostValue: 0, lootRecovered: 0, lootRecoveredValue: 0, recoveryWeeks: [],
  };
}

// Called once at game creation (and by save migration).
export function setupRocket(state) {
  state.rocketRng = createRng(`${state.seed}:rocket`);
  state.rocket = { deck: { draw: [], discard: [] }, active: null, pendingLoot: null, plots: [] };
  if (!rocketEnabled(state)) return;
  state.rocket.deck.draw = shuffleWith(state, 'rocketRng', 'Rocket plot deck', ROCKET_PLOTS.map((p) => p.id));
}

// ---- reading the active plot ------------------------------------------------

export function activePlot(state) {
  return state.rocket?.active ?? null;
}

export function plotCard(active) {
  return ROCKET_PLOTS_BY_ID[active.plotId];
}

function effectHere(state, location, kind) {
  const active = activePlot(state);
  return Boolean(active && active.location === location && plotCard(active).effect.kind === kind);
}

// Where "Challenge Rocket" is allowed: the balloon, plus the card's extra places.
export function challengeLocations(state) {
  const active = activePlot(state);
  if (!active) return [];
  return [active.location, ...(plotCard(active).challengeFrom ?? [])];
}

// Temporary movement blocks for travelEngine ({ locations, edges }), or null.
export function rocketBlocks(state) {
  const active = activePlot(state);
  if (!active) return null;
  const { effect } = plotCard(active);
  if (effect.kind === 'closed') return { locations: [active.location], edges: [] };
  if (effect.kind === 'blockEdge') return { locations: [], edges: [edgeKey(...effect.edge)] };
  return null;
}

export function canChallengeRocket(state, player) {
  return state.phase === 'turn' && state.turn.actionsRemaining > 0
    && challengeLocations(state).includes(player.location) && hasHealthyPokemon(player);
}

export function exploreFindsRocket(state, player) {
  return effectHere(state, player.location, 'exploreRocket');
}

export function catchBlocked(state, player) {
  return effectHere(state, player.location, 'noCatch');
}

export function rocketTeam(state, card) {
  const cfg = state.config.rocket;
  const base = state.turn.round >= cfg.evolvedFromWeek ? cfg.evolvedTeam : cfg.team;
  return card.meowth ? [...base, cfg.meowth] : [...base];
}

// ---- values (money-equivalents at shop prices) ------------------------------

function unitValue(item, config) {
  return item === 'money' ? 1 : config.economy[item];
}

export function lootValue(entry, config) {
  return unitValue(entry.item, config) * entry.amount;
}

export function plotRewardValue(card, config) {
  return card.reward.reduce((sum, r) => sum + unitValue(r.type === 'pokeballs' ? 'pokeball' : r.type, config) * r.amount, 0);
}

function thingText(item, amount) {
  if (item === 'money') return `${amount} money`;
  return `${amount} ${ITEMS[item].name}${amount > 1 ? 's' : ''}`;
}

export function rewardText(reward) {
  return reward.map((r) => `+${thingText(r.type === 'pokeballs' ? 'pokeball' : r.type, r.amount)}`).join(', ');
}

// ---- week start: spawn check / roaming step -----------------------------------

export function rocketWeekStart(state) {
  if (!rocketEnabled(state) || state.turn.round < state.config.rocket.firstWeek) return;
  if (activePlot(state)) {
    moveBalloon(state);
    return;
  }
  const faces = state.config.rocket.spawnRoll;
  const roll = d6With(state, 'rocketRng', 'Team Rocket', (v) => (faces.includes(v) ? 'a plot is revealed!' : 'no plot this week'));
  if (faces.includes(roll)) revealPlot(state, drawPlot(state));
}

function drawPlot(state) {
  const deck = state.rocket.deck;
  if (!deck.draw.length) {
    deck.draw = shuffleWith(state, 'rocketRng', 'Rocket plot deck (reshuffled discards)', deck.discard);
    deck.discard = [];
  }
  return deck.draw.shift();
}

export function revealPlot(state, plotId) {
  const card = ROCKET_PLOTS_BY_ID[plotId];
  const deck = state.rocket.deck;
  deck.draw = deck.draw.filter((id) => id !== plotId);
  deck.discard = deck.discard.filter((id) => id !== plotId);
  state.rocket.plots.push({ plotId, spawnedRound: state.turn.round, clearedRound: null, clearedBy: null, battles: 0, lootTaken: 0 });
  state.rocket.active = { plotId, location: card.location, step: 0, spawnedRound: state.turn.round, loot: [], record: state.rocket.plots.length - 1 };
  log(state, 'rocket', `🎈 Team Rocket plot at ${getLocation(card.location).name}: ${card.icon} ${card.title}! ${card.flavor} ${card.text} Reward: ${rewardText(card.reward)}.`, { rocket: { event: 'plot', plot: card.id, location: card.location } });
}

function moveBalloon(state) {
  const active = activePlot(state);
  const route = plotCard(active).movement?.route;
  if (!route || active.step >= route.length - 1) return;
  const from = active.location;
  active.step += 1;
  active.location = route[active.step];
  const landed = active.step === route.length - 1;
  log(state, 'rocket', `🎈 The Team Rocket balloon drifts ${getLocation(from).name} → ${getLocation(active.location).name}${landed ? ' and lands there' : ''}.`, { rocket: { event: 'drift', from, to: active.location, landed } });
}

// ---- local effects --------------------------------------------------------------

// After a move: ambush (forced battle) or pitfall (turn ends).
export function rocketOnArrive(state, player) {
  const active = activePlot(state);
  if (!active || active.location !== player.location) return;
  const kind = plotCard(active).effect.kind;
  if (kind === 'ambush') {
    if (hasHealthyPokemon(player)) startRocketBattle(state, 'ambush');
    else log(state, 'rocket', `Jessie: "No fun picking on a trainer whose Pokémon have all fainted!" Team Rocket lets ${player.name} pass.`, { rocket: { event: 'pass' } });
  } else if (kind === 'pitfall') {
    const lost = state.turn.actionsRemaining;
    state.turn.actionsRemaining = 0;
    player.stats.rocket.pitfalls += 1;
    log(state, 'rocket', `🕳 ${player.name} falls into Team Rocket's pitfall! The turn ends${lost ? ` (${lost} action${lost > 1 ? 's' : ''} lost)` : ''}.`, { rocket: { event: 'pitfall', lost } });
  }
}

// ---- battle ---------------------------------------------------------------------

const TRIGGER_TEXT = {
  challenge: (p) => `${p.name} challenges Team Rocket!`,
  explore: () => 'Team Rocket is here — exploring finds only them!',
  ambush: () => 'Ambush!',
};

export function startRocketBattle(state, trigger) {
  const player = currentPlayer(state);
  const active = activePlot(state);
  const card = plotCard(active);
  const pokemonTeam = rocketTeam(state, card).map((id) => createPokemonInstance(state, id));
  for (const p of pokemonTeam) markSeen(player, p.species);
  state.encounter = { kind: 'rocket', plotId: card.id, trigger, biome: null, trainer: { name: 'Team Rocket', pokemonTeam, reward: 0 }, index: 0, playerFainted: false };
  state.phase = 'encounter';
  const s = player.stats.rocket;
  s.battles += 1;
  if (trigger === 'challenge') s.challenges += 1;
  else if (trigger === 'explore') s.exploreBattles += 1;
  else if (trigger === 'ambush') s.ambushes += 1;
  state.rocket.plots[active.record].battles += 1;
  const team = pokemonTeam.map((p) => getSpecies(p.species).name).join(', ');
  log(state, 'rocket', `${TRIGGER_TEXT[trigger](player)} "Prepare for trouble! And make it double!" Team Rocket battles ${player.name} at ${getLocation(player.location).name} (team: ${team}). Rocket battles can't be fled.`, { rocket: { event: 'battle', trigger } });
  return state.encounter;
}

// The last Rocket Pokémon fainted.
export function rocketDefeated(state) {
  const player = currentPlayer(state);
  player.stats.rocket.wins += 1;
  log(state, 'rocket', `${player.name} beats Team Rocket! "Team Rocket's blasting off agaaain!" ✨`, { rocket: { event: 'blastOff' } });
  clearPlot(state, player);
  endEncounter(state, 'rocketWon');
}

// The player's whole team fainted in a Rocket battle.
export function rocketWins(state) {
  const player = currentPlayer(state);
  player.stats.rocket.losses += 1;
  log(state, 'encounter', `All of ${player.name}'s Pokémon fainted. Team Rocket wins this time!`);
  endEncounter(state, 'rocketLost');
  meowthGrabs(state, player);
}

// Loot goes back to its owners; the clearer (null for a debug removal) takes the reward.
export function clearPlot(state, clearer) {
  const active = activePlot(state);
  const card = plotCard(active);
  const round = state.turn.round;
  for (const entry of active.loot) {
    const owner = state.players.find((p) => p.id === entry.owner);
    if (entry.item === 'money') owner.money += entry.amount;
    else addItem(owner, entry.item, entry.amount);
    const s = owner.stats.rocket;
    s.lootRecovered += 1;
    s.lootRecoveredValue += lootValue(entry, state.config);
    s.recoveryWeeks.push(round - entry.round);
    log(state, 'rocket', `🎒 ${owner.name} gets back ${thingText(entry.item, entry.amount)} from the plot card.`, { rocket: { event: 'lootBack', owner: owner.id, item: entry.item, amount: entry.amount } });
  }
  if (clearer) {
    for (const r of card.reward) {
      if (r.type === 'money') clearer.money += r.amount;
      else addItem(clearer, r.type === 'pokeballs' ? 'pokeball' : r.type, r.amount);
    }
    clearer.stats.rocket.cleared += 1;
    clearer.stats.rocket.rewardValue += plotRewardValue(card, state.config);
    log(state, 'rocket', `🏆 ${clearer.name} clears "${card.title}": ${rewardText(card.reward)}. The balloon leaves ${getLocation(active.location).name}.`, { rocket: { event: 'cleared', plot: card.id, by: clearer.id, reward: card.reward } });
  } else {
    log(state, 'rocket', `"${card.title}" is removed. The balloon leaves ${getLocation(active.location).name}.`);
  }
  const record = state.rocket.plots[active.record];
  record.clearedRound = round;
  record.clearedBy = clearer?.id ?? null;
  state.rocket.deck.discard.push(card.id);
  state.rocket.active = null;
}

function lootOutcome(roll, config) {
  return Object.entries(config.rocket.lootRoll).find(([, faces]) => faces.includes(roll))[0];
}

// d6 on the main stream (forced rolls work here, like any battle roll).
// Never debt, never the last ball, no substitute penalty.
function meowthGrabs(state, player) {
  const cfg = state.config;
  const outcome = lootOutcome(d6(state, 'Meowth grabs', (v) => lootLabel(lootOutcome(v, cfg), cfg)), cfg);
  if (outcome === 'money') {
    const n = Math.min(cfg.rocket.lootMoney, player.money);
    if (n) take(state, player, 'money', n);
    else log(state, 'rocket', `😼 Meowth finds an empty wallet — nothing taken.`, { rocket: { event: 'nothing' } });
  } else if (outcome === 'pokeball') {
    const balls = player.pokeballs + itemCount(player, 'superball');
    if (player.pokeballs >= 1 && balls >= 2) take(state, player, 'pokeball', 1);
    else log(state, 'rocket', `😼 Meowth never takes your last ball — nothing taken.`, { rocket: { event: 'nothing' } });
  } else if (outcome === 'item') {
    const options = LOOT_ITEMS.filter((id) => itemCount(player, id) > 0);
    if (!options.length) log(state, 'rocket', `😼 Meowth finds no items to grab — nothing taken.`, { rocket: { event: 'nothing' } });
    else if (options.length === 1) take(state, player, options[0], 1);
    else {
      state.rocket.pendingLoot = { options };
      state.phase = 'loot';
      log(state, 'rocket', `😼 Meowth wants an item! ${player.name} picks which one to hand over.`);
    }
  } else {
    log(state, 'rocket', `😼 Meowth trips over his own tail — nothing taken!`, { rocket: { event: 'nothing' } });
  }
}

// The player's choice after "Meowth wants an item".
export function giveLoot(state, item) {
  const player = currentPlayer(state);
  state.rocket.pendingLoot = null;
  state.phase = 'turn';
  take(state, player, item, 1);
}

function take(state, player, item, amount) {
  const active = activePlot(state);
  if (item === 'money') player.money -= amount;
  else addItem(player, item, -amount);
  const entry = { owner: player.id, item, amount, round: state.turn.round };
  active.loot.push(entry);
  state.rocket.plots[active.record].lootTaken += 1;
  player.stats.rocket.lootLost += 1;
  player.stats.rocket.lootLostValue += lootValue(entry, state.config);
  log(state, 'rocket', `😼 Meowth grabs ${thingText(item, amount)} from ${player.name} and puts it on the plot card — it comes back when anyone beats Rocket.`, { rocket: { event: 'loot', owner: player.id, item, amount } });
}

// Debug: reveal a specific plot now ('' removes the active one). Loot on a
// replaced plot goes back to its owners.
export function debugSetPlot(state, plotId) {
  if (activePlot(state)) clearPlot(state, null);
  if (plotId) revealPlot(state, plotId);
}
