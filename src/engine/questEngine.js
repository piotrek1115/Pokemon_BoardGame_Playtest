// Missions (Step 3, DQ-29): one shared shuffled deck; each player holds up to
// CONFIG.quests.maxActive mission cards. Progress is event-driven: engines
// call recordQuestEvent() when something happens (catch, trainer win, explore,
// arrival, Poké Stop visit, evolution). Completed missions pay out, go to the
// discard pile and are replaced — after the event has been fully processed,
// so a new card never counts the event that completed the old one.
// Card shuffles and destination picks use their own RNG stream (state.questRng).
import { QUESTS, QUESTS_BY_ID } from '../data/quests.js';
import { getLocation, isLocationEnabled, topologyLocations, topologyOf } from '../data/locations.js';
import { getSpecies } from '../data/pokemon.js';
import { ITEMS } from '../data/items.js';
import { log } from './log.js';
import { createRng, pickWith, shuffleWith } from './rng.js';
import { addItem } from './itemEngine.js';
import { travelDistances } from './travelEngine.js';
import { questBlocks } from './graphEngine.js';
import { bookEvent } from './questBookEngine.js';
import { rumourEvent } from './rumourEngine.js';

export function questsEnabled(state) {
  return Boolean(state.config.quests?.enabled);
}

export function emptyQuestStats() {
  return {
    acquired: 0, acquiredGlobal: 0, acquiredTravel: 0,
    completed: 0, completedGlobal: 0, completedTravel: 0,
    swapped: 0, weeksToComplete: [],
    rewards: { money: 0, pokeballs: 0, superball: 0, potion: 0, revive: 0, stars: 0 },
  };
}

// Called once at game creation (and by save migration).
export function setupQuests(state) {
  state.questRng = createRng(`${state.seed}:quests`);
  state.questDeck = { draw: [], discard: [] };
  if (!questsEnabled(state)) return;
  state.questDeck.draw = shuffleWith(state, 'questRng', 'Mission deck', QUESTS.map((q) => q.id));
  for (const p of state.players) refillQuests(state, p);
}

// ---- targets ------------------------------------------------------------------

// A mission's fixed places under the game's board topology: a history played
// before the merge (DQ-96) keeps the place its card named then.
export function questTargets(quest, config = null) {
  return (topologyOf(config) === 'kanto46' && quest.target.legacy46) || quest.target.locations;
}

// Locations a mission points at (fixed or generated), or [] for anywhere.
export function questLocations(instance, config = null) {
  const q = QUESTS_BY_ID[instance.questId];
  if (instance.destination) return [instance.destination];
  return questTargets(q, config) ?? [];
}

// Steps to the nearest target location, Infinity if unreachable, 0 if anywhere.
// `blocks`: today's closures (graphEngine.questBlocks — Build 3.3 games route
// through the one effective graph, AUD-03; older games pass none).
export function questDistance(player, instance, config, blocks = null) {
  const targets = questLocations(instance, config);
  if (!targets.length) return 0;
  const dist = travelDistances(player, player.location, config, blocks);
  return Math.min(...targets.map((t) => dist[t] ?? Infinity));
}

// Can this card be given to this player right now? Returns { destination } or null.
function prepareCard(state, player, quest, exclude) {
  if (exclude.includes(quest.id)) return null;
  if (player.quests.some((q) => q.questId === quest.id)) return null; // no duplicate active ids
  if (!quest.target.locations && !quest.target.generate) return {};
  const cfg = state.config;
  const dist = travelDistances(player, player.location, cfg, questBlocks(state)); // AUD-03: closed places are not reachable today
  if (quest.target.locations) {
    const fixed = questTargets(quest, cfg);
    if (fixed.includes(player.location)) return null; // never "you are already there"
    if (!fixed.some((id) => isLocationEnabled(id, cfg) && dist[id] !== undefined)) return null; // unreachable / gated
    return {};
  }
  const gen = quest.target.generate;
  const pool = topologyLocations(cfg).filter((l) =>
    l.id !== player.location && dist[l.id] !== undefined && isLocationEnabled(l.id, cfg)
    && (!gen.locationTypes || gen.locationTypes.includes(l.type)));
  if (!pool.length) return null;
  const far = pool.filter((l) => dist[l.id] >= cfg.quests.destinationMinDistance);
  const max = Math.max(...pool.map((l) => dist[l.id]));
  const options = far.length ? far : pool.filter((l) => dist[l.id] === max); // fall back to the farthest
  const choice = pickWith(state, 'questRng', `Mission destination for ${player.name}`, options, (l) => `${l.name} (${dist[l.id]} steps)`);
  return { destination: choice.id };
}

// The card's reward in the version this game plays (rules.questRewards): 'v2'
// (Growth games) swaps the ⭐ rewards for items / money of the same value
// (DQ-87); 'v1' is the Phase 2 card.
export function questReward(quest, config) {
  const version = config.rules.questRewards;
  return version === 'v1' ? quest.reward : quest.rewardByVersion?.[version] ?? quest.reward;
}

function rewardText(reward) {
  return reward.map((r) => {
    if (r.type === 'money') return `+${r.amount} money`;
    if (r.type === 'stars') return `+${r.amount} ⭐`;
    const item = ITEMS[r.type === 'pokeballs' ? 'pokeball' : r.type];
    return `+${r.amount} ${item.name}${r.amount > 1 ? 's' : ''}`;
  }).join(', ');
}

export function describeQuest(instance) {
  const q = QUESTS_BY_ID[instance.questId];
  const where = instance.destination ? ` → ${getLocation(instance.destination).name}` : '';
  const count = q.count ?? 1;
  return `${q.icon} ${q.title}${where}${count > 1 ? ` (${instance.progress}/${count})` : ''}`;
}

// ---- drawing ------------------------------------------------------------------

export function drawQuest(state, player, { exclude = [] } = {}) {
  const deck = state.questDeck;
  if (!deck.draw.length && deck.discard.length) {
    deck.draw = shuffleWith(state, 'questRng', 'Mission deck (reshuffled discards)', deck.discard);
    deck.discard = [];
  }
  for (let i = 0; i < deck.draw.length; i++) {
    const quest = QUESTS_BY_ID[deck.draw[i]];
    const prepared = prepareCard(state, player, quest, exclude);
    if (!prepared) continue;
    deck.draw.splice(i, 1);
    const instance = { questId: quest.id, progress: 0, acquiredRound: state.turn.round };
    if (prepared.destination) instance.destination = prepared.destination;
    if (quest.kind === 'visitPokeStops') instance.visited = [];
    if (quest.kind === 'exploreLocations') instance.places = [];
    player.quests.push(instance);
    const s = player.stats.quests;
    s.acquired += 1;
    if (quest.scope === 'travel') s.acquiredTravel += 1;
    else s.acquiredGlobal += 1;
    log(state, 'quest', `📜 ${player.name} gets a mission from ${quest.giver}: ${describeQuest(instance)} — ${quest.text} (reward ${rewardText(questReward(quest, state.config))})`);
    return instance;
  }
  return null;
}

export function refillQuests(state, player, opts) {
  if (!questsEnabled(state)) return;
  while (player.quests.length < state.config.quests.maxActive) {
    if (!drawQuest(state, player, opts)) break;
  }
}

// ---- progress -----------------------------------------------------------------

export function speciesMatches(target, speciesId) {
  const s = getSpecies(speciesId);
  if (target.types && !s.types.some((t) => target.types.includes(t))) return false;
  if (target.rarities && !target.rarities.includes(s.rarity)) return false;
  return true;
}

export function placeMatches(quest, instance, event, config = null) {
  const t = quest.target;
  const locations = instance.destination ? [instance.destination] : questTargets(quest, config);
  if (locations && !locations.includes(event.location)) return false;
  if (t.locationTypes && !t.locationTypes.includes(getLocation(event.location).type)) return false;
  // Macro 01: a mixed Explore searched every biome of the place (event.biomes).
  if (t.biomes && !(event.biomes ?? [event.biome]).some((b) => t.biomes.includes(b))) return false;
  return true;
}

function advances(quest, instance, event, config) {
  switch (quest.kind) {
    case 'catch': return event.kind === 'catch' && speciesMatches(quest.target, event.species) && placeMatches(quest, instance, event, config);
    case 'defeatTrainer': return event.kind === 'trainerWin' && placeMatches(quest, instance, event, config);
    case 'winFlawless': return event.kind === 'trainerWin' && event.flawless && placeMatches(quest, instance, event, config);
    case 'explore': return event.kind === 'explore' && placeMatches(quest, instance, event, config);
    case 'visit': return event.kind === 'arrive' && placeMatches(quest, instance, event, config);
    case 'evolve': return event.kind === 'evolve';
    case 'visitPokeStops': return event.kind === 'pokeStopVisit' && !instance.visited.includes(event.location);
    case 'exploreLocations': return event.kind === 'explore' && !instance.places.includes(event.location);
    default: return false;
  }
}

// One game event; may advance several active missions. Replacements are drawn
// only after every active mission has seen the event.
export function recordQuestEvent(state, player, event) {
  bookEvent(state, player, event); // Build 3.3 E3: the quest book hears every event first
  rumourEvent(state, player, event); // PLAYTEST_006 C5: an arrival can bring a rumour
  if (!questsEnabled(state) || !player.quests.length) return;
  const done = [];
  for (const instance of [...player.quests]) {
    const quest = QUESTS_BY_ID[instance.questId];
    if (!advances(quest, instance, event, state.config)) continue;
    if (quest.kind === 'visitPokeStops') instance.visited.push(event.location);
    if (quest.kind === 'exploreLocations') instance.places.push(event.location);
    instance.progress += 1;
    if (instance.progress >= (quest.count ?? 1)) done.push(instance);
    else log(state, 'quest', `📜 ${player.name}'s mission progresses: ${describeQuest(instance)}`);
  }
  for (const instance of done) completeQuest(state, player, instance);
  if (done.length) refillQuests(state, player);
}

function applyReward(state, player, reward) {
  const s = player.stats.quests.rewards;
  for (const r of reward) {
    if (r.type === 'money') player.money += r.amount;
    else if (r.type === 'stars') {
      player.stars += r.amount;
      player.stats.starsEarned += r.amount;
    } else addItem(player, r.type === 'pokeballs' ? 'pokeball' : r.type, r.amount);
    s[r.type] += r.amount;
  }
}

function completeQuest(state, player, instance) {
  const quest = QUESTS_BY_ID[instance.questId];
  player.quests = player.quests.filter((q) => q !== instance);
  state.questDeck.discard.push(quest.id);
  applyReward(state, player, questReward(quest, state.config));
  const s = player.stats.quests;
  s.completed += 1;
  if (quest.scope === 'travel') s.completedTravel += 1;
  else s.completedGlobal += 1;
  s.weeksToComplete.push(state.turn.round - instance.acquiredRound);
  log(state, 'quest', `🏆 ${player.name} completes "${quest.title}" for ${quest.giver}: ${rewardText(questReward(quest, state.config))}`);
}

// ---- swapping (inside a Poké Stop) ------------------------------------------------

export function rewardValue(quest, config) {
  return questReward(quest, config).reduce((sum, r) => sum + config.quests.rewardValue[r.type] * r.amount, 0);
}

export function canSwapQuests(state, player) {
  return questsEnabled(state) && state.phase === 'shop'
    && state.shop.questSwaps < state.config.quests.swapsPerPokeStopVisit && !questSwapUsedThisTurn(state) && player.quests.length > 0;
}

// Gameplay P1 (rules.pokeStop 'v2'): two Sklep visits in one turn still swap
// one mission — the limit is per player turn; Build 2 games keep one per visit.
export function questSwapUsedThisTurn(state) {
  return state.config.rules.pokeStop === 'v2' && (state.turn.questSwaps ?? 0) >= (state.config.quests.swapsPerTurn ?? 1);
}

export function swapQuest(state, player, questId) {
  const instance = player.quests.find((q) => q.questId === questId);
  player.quests = player.quests.filter((q) => q !== instance);
  state.questDeck.discard.push(questId);
  state.shop.questSwaps += 1;
  if (state.config.rules.pokeStop === 'v2') state.turn.questSwaps = (state.turn.questSwaps ?? 0) + 1;
  player.stats.quests.swapped += 1;
  log(state, 'quest', `🔄 ${player.name} swaps away "${QUESTS_BY_ID[questId].title}"`);
  refillQuests(state, player, { exclude: [questId] });
}
