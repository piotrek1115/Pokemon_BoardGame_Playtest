// AI opponent: transparent heuristic scoring over getLegalActions(). No LLM.
// Every candidate gets a list of reasons (+/- contributions); the best score
// wins and the reasons are written to the log via dispatch(meta.ai).
// Archetypes (balanced / collector / aggressive / explorer) are weight sets in
// CONFIG.ai.archetypes. Ties are broken with a stateless hash so AI decisions
// never consume the game RNG.
import { POKEMON, attackTypeOf, getSpecies, isWild } from '../data/pokemon.js';
import { LOCAL_POOLS } from '../data/pools.js';
import { placeFatigue, usesFatigue } from './fatigueEngine.js';
import { isLocationEnabled, locationBiomes, topologyLocations } from '../data/locations.js';
import { EVENTS_BY_ID } from '../data/events.js';
import { hashIndex } from './rng.js';
import { currentPlayer, getLead } from './gameState.js';
import { getLegalActions, restHeal } from './turnEngine.js';
import { catchChanceWithRetries, escapeColour, throwChance, vigilanceSteps } from './captureEngine.js';
import { currentOpponent, freeBattleHealing, typeModifier } from './combatEngine.js';
import { canTraverse, networkNeighbors } from './travelEngine.js';
import { hasPokeStop, price, sellPrice, shopStock } from './pokeStopEngine.js';
import { ballCount, healingItems, itemCount } from './itemEngine.js';
import { evolutionTarget, starCost } from './evolutionEngine.js';
import { QUESTS_BY_ID } from '../data/quests.js';
import { CHARACTERS_BY_ID } from '../data/characters.js';
import { ITEMS } from '../data/items.js';
import { awardAmount, growthEdge } from './growthEngine.js';
import { placeMatches, questDistance, questLocations, speciesMatches } from './questEngine.js';
import { travelDistances } from './travelEngine.js';
import { questBlocks, worldBlocks } from './graphEngine.js';
import { GYMS, LEAGUE } from '../data/gyms.js';
import { chainOpponents, gymHere, gymRow, gymTier, gymUnlock, gymsEnabled, hasBadge, leagueStageTeam, leagueStartStage, placeClosedNow, rowPower, usesGymChain, usesLeagueChallenge } from './gymEngine.js';
import { activePlot, catchBlocked, challengeLocations, exploreFindsRocket, lootValue, plotCard, plotRewardValue, rocketTeam } from './rocketEngine.js';
import { jobSpec, kitPlace, needsKit } from './oakEngine.js';
import { localPool, placeSpecies } from './localPoolEngine.js';
import { bookQuest, findOcc, isDone, objectiveProgress, objectiveTarget, openChallenge, usesQuestBook } from './questBookEngine.js';
import { pokeStopPlaces } from '../data/pokeStops.js';
import { huntDef, huntOpenFor } from './huntEngine.js';

export function chooseAction(state) {
  const legal = getLegalActions(state);
  if (!legal.length) return null;
  const player = currentPlayer(state);
  const cfg = state.config;
  const weights = cfg.ai.archetypes[player.aiArchetype] ?? cfg.ai.archetypes[cfg.ai.defaultArchetype];

  const scored = legal.map((action) => {
    const reasons = scoreAction(state, player, action, weights).filter((r) => r.value !== 0);
    const score = reasons.reduce((sum, r) => sum + r.value, 0);
    return { action, reasons, score };
  });
  const best = Math.max(...scored.map((s) => s.score));
  const top = scored.filter((s) => Math.abs(s.score - best) < 1e-9);
  const chosen = top.length > 1 ? top[hashIndex(`${state.seed}:${state.history.length}`, top.length)] : top[0];

  return {
    action: chosen.action,
    ai: {
      archetype: player.aiArchetype,
      score: chosen.score,
      reasons: chosen.reasons,
      ...(top.length > 1 ? { tiebreak: top.length } : {}),
    },
  };
}

function r(label, value) {
  return { label, value };
}

function uncaughtShare(player, biome) {
  const pool = POKEMON.filter((p) => isWild(p) && p.biomes.includes(biome));
  if (!pool.length) return 0;
  return pool.filter((p) => !player.pokedex.caught.includes(p.id)).length / pool.length;
}

// Macro 01 (rules.explorePools 'v2'): a mixed place's pool is every biome's species, each once.
function uncaughtShareMixed(player, biomes) {
  const pool = POKEMON.filter((p) => isWild(p) && p.biomes.some((b) => biomes.includes(b)));
  if (!pool.length) return 0;
  return pool.filter((p) => !player.pokedex.caught.includes(p.id)).length / pool.length;
}

// Macro 02 M02-1 (rules.localPools 'v2'): a place with its own pool — the same
// share over that pool's species (no new weights).
function uncaughtSharePlace(player, place, config) {
  const pool = placeSpecies(place, config);
  if (!pool.length) return 0;
  return pool.filter((p) => !player.pokedex.caught.includes(p.id)).length / pool.length;
}

function hpFraction(p) {
  return p ? p.hp / p.maxHp : 0;
}

function totalBalls(player) {
  return ballCount(player);
}

// Steps to the nearest Poké Stop over edges this player can travel.
function distanceToPokeStop(player, from, config, blocks) {
  const dist = { [from]: 0 };
  const queue = [from];
  while (queue.length) {
    const at = queue.shift();
    if (hasPokeStop(at, config)) return dist[at];
    for (const to of networkNeighbors(at, config)) { // the game's travel network (3A-5)
      if (dist[to] === undefined && canTraverse(player, at, to, config, blocks)) {
        dist[to] = dist[at] + 1;
        queue.push(to);
      }
    }
  }
  return Infinity;
}

// Poké Stops are a few far-apart hubs with a full heal (DQ-33/34): the pull home
// grows with damage the bag can't fix. A fully fainted team without a Revive
// outranks every mission pull (missions pull at most 5 per step).
function pokeStopNeed(player, config) {
  const fainted = player.team.filter((p) => p.hp === 0).length;
  const missing = player.team.reduce((sum, p) => sum + p.maxHp - p.hp, 0);
  const max = player.team.reduce((sum, p) => sum + p.maxHp, 0);
  const revives = itemCount(player, 'revive');
  const potions = itemCount(player, 'potion');
  let heal;
  if (fainted === player.team.length) heal = revives ? 1 : 8; // with a Revive, revive first (free)
  else {
    const unfixedFainted = Math.max(0, fainted - revives);
    heal = (missing / max) * 4 + unfixedFainted * 1.5;
    if (potions >= 2) heal *= 0.6; // potions can patch the team in the field
  }
  const canBuy = player.money >= price('pokeball', config);
  const shop = canBuy && totalBalls(player) === 0 ? 3 : canBuy && totalBalls(player) <= 1 ? 1.5 : 0;
  return heal + shop + (stoneWanted(player, config) ? 2 : 0);
}

// Growth games: an Evolution Stone a READY team Pokémon is waiting for, that the
// player can afford and doesn't have yet (Poké Stops sell them, DQ-78).
function stoneWanted(player, config) {
  if (config.rules.evolution !== 'growth') return null;
  for (const p of player.team) {
    const edge = growthEdge(p, config.rules);
    if (edge?.item && (p.growth ?? 0) >= edge.growth && itemCount(player, edge.item) === 0 && player.money >= price(edge.item, config)) return edge.item;
  }
  return null;
}

// Growth games: the starter's evolution line is the one the player cares about most.
function isStarterLine(player, pokemon) {
  const starter = CHARACTERS_BY_ID[player.id]?.starter;
  return Boolean(starter) && getSpecies(starter).family === getSpecies(pokemon.species).family;
}

function stoneReasons(player, id, rules) {
  const needers = player.team.filter((p) => growthEdge(p, rules)?.item === id);
  if (!needers.length) return [r(`no team Pokémon needs a ${ITEMS[id].name}`, -2)];
  if (itemCount(player, id) >= needers.length) return [r(`already carrying a ${ITEMS[id].name}`, -2)];
  const left = Math.min(...needers.map((p) => growthEdge(p, rules).growth - (p.growth ?? 0)));
  return [r(`${ITEMS[id].name}: ${left ? `${left} Growth to go` : 'ready to evolve'}`, left <= 0 ? 4 : left === 1 ? 2.5 : left === 2 ? 1 : -0.5)];
}

export function scoreAction(state, player, action, w) {
  const lead = getLead(player);
  switch (action.type) {
    case 'move': {
      const toBiomes = locationBiomes(action.to, state.config); // the game's board topology (DQ-96)
      const here = player.exploreCounts[player.location] ?? 0;
      const newSpecies = localPool(action.to, state.config) ? uncaughtSharePlace(player, action.to, state.config) : Math.max(0, ...toBiomes.map((b) => uncaughtShare(player, b)));
      // EREV-03: with the League open and the team ready for it, the League leads — side goals
      // (missions, quests, Team Rocket, hunts) pull at half strength. Pulling with equal force
      // in opposite directions held the AI between two places for dozens of weeks.
      const league = towardLeague(state, player, action.to);
      const side = league.value ? 0.5 : 1;
      const half = (list) => (side === 1 ? list : list.map((x) => (x.value ? r(`${x.label} ×½ (the League first)`, x.value * side) : x)));
      return [
        r('base move', 1 * w.move),
        r('unvisited location', player.visited.includes(action.to) ? 0 : 3 * w.novelty),
        r('uncaught species there', 1.5 * newSpecies * w.novelty),
        r(`explored here ${here}×`, here >= 2 ? 1 * w.move : 0),
        r('backtracking', action.to === player.previousLocation ? -2 : 0),
        r('nothing to explore there', toBiomes.length ? 0 : -1),
        towardPokeStop(state, player, action.to),
        ...half(towardQuests(state, player, action.to, w)),
        ...half([towardRocket(state, player, action.to)]),
        ...enteringPlot(state, player, action.to, w),
        towardGym(state, player, action.to),
        league,
        ...towardOak(state, player, action.to),
        ...half(towardBook(state, player, action.to)),
        ...half(towardHunt(state, player, action.to)),
      ];
    }
    case 'visitPokeStop': {
      // Full heal of the active team (fainted included).
      const missing = player.team.reduce((sum, p) => sum + p.maxHp - p.hp, 0);
      const fainted = player.team.filter((p) => p.hp === 0).length;
      const canBuy = player.money >= price('pokeball', state.config);
      const balls = totalBalls(player);
      return [
        r(`full heal (+${missing} HP)`, missing * w.rest),
        r(`revives ${fainted}`, fainted * 2 * w.rest),
        r('restock Poké Balls', canBuy ? (balls === 0 ? 7 : balls <= 1 ? 3 : balls <= 3 ? 1 : 0) * w.catch : 0),
        r('buy an Evolution Stone', stoneWanted(player, state.config) ? 4 : 0),
        ...activeQuests(player)
          .filter(({ instance, quest }) => quest.kind === 'visitPokeStops' && !instance.visited.includes(player.location))
          .map(({ quest }) => r(`mission "${quest.title}"`, 2)),
      ];
    }
    // Gameplay P1 (rules.pokeStop 'v2'): healing and shopping are separate actions.
    case 'pokeStopHeal': {
      const missing = player.team.reduce((sum, p) => sum + p.maxHp - p.hp, 0);
      const fainted = player.team.filter((p) => p.hp === 0).length;
      // EREV-03: the gym the AI came for is here — heal, then challenge (it used to walk off
      // to a mission and come back, week after week)
      const here = gymTarget(state, player)?.d === 0 ? gymHere(state, player) : null;
      const forGym = Boolean(here) && missing >= 1 && (missing >= 2 || gymReadiness(state, player, here) < state.config.ai.gym.readyRatio);
      return [
        r(`full heal (+${missing} HP)`, missing * w.rest),
        r(`revives ${fainted}`, fainted * 2 * w.rest),
        r('heal for the gym here', forGym ? state.config.ai.gym.challenge / 2 : 0),
        ...pokeStopMissionReasons(player),
      ];
    }
    case 'pokeStopShop': {
      const canBuy = player.money >= price('pokeball', state.config);
      const balls = totalBalls(player);
      const restock = canBuy ? (balls === 0 ? 7 : balls <= 1 ? 3 : balls <= 3 ? 1 : 0) * w.catch : 0;
      // The field kit (2 Potions / Super Potions + a Revive) is bought here now — no
      // heal-and-shop in one action any more (DQ-89).
      const kit = itemCount(player, 'potion') + itemCount(player, 'superpotion');
      const medicine = player.money >= price('potion', state.config) ? (kit === 0 ? 2 : kit === 1 ? 1.2 : 0) * w.rest : 0;
      const revive = player.money >= price('revive', state.config) + 2 && itemCount(player, 'revive') === 0 ? 0.8 * w.rest : 0;
      // EREV-03: only what THIS shop sells (regional stock, E2) and what the AI would really
      // buy once inside — entering, buying nothing and leaving cost an action again and again
      const stock = shopStock(state, player.location);
      const wanted = stoneWanted(player, state.config);
      const stone = wanted && stock.includes(wanted) ? 4 : 0;
      const wouldBuy = stock.some((id) => player.money >= price(id, state.config) && scoreAction(state, player, { type: 'buy', item: id }, w).reduce((sum, x) => sum + x.value, 0) > 1);
      const buying = wouldBuy ? 1 : 0;
      const surplus = state.config.rules.selling && Object.keys(ITEMS).some((id) => sellValue(state, player, id) > 1) ? 1 : 0;
      const missions = pokeStopMissionReasons(player);
      const worth = (restock + medicine + revive) * buying + stone + surplus + missions.reduce((sum, m) => sum + m.value, 0);
      return [
        r('restock Poké Balls', restock * buying),
        r(`${kit} Potions in the bag`, medicine * buying),
        r('no Revive in the bag', revive * buying),
        r('buy an Evolution Stone', stone),
        r('something to sell', surplus),
        ...missions,
        r('nothing worth an action', worth ? 0 : -1),
      ];
    }
    case 'sell':
      return [r(`sell a ${ITEMS[action.item].name} for ${sellPrice(action.item, state.config)}`, sellValue(state, player, action.item))];
    case 'boxKeep': {
      // Gameplay P1 (rules.oakBox): the catch joins the team when it beats who would leave.
      const caught = player.reserve.find((p) => p.uid === state.boxChoice.uid);
      const out = player.team.find((p) => p.uid === action.target);
      return boxSwapReasons(player, caught, out);
    }
    case 'boxSend':
      return [r("keep the team, the catch goes to Oak's Box", 0.5)];
    case 'boxIn': {
      const mon = player.reserve.find((p) => p.uid === action.target);
      if (!action.swap) return [r('a free place in the team', mon.hp > 0 ? 2 : -1)];
      return boxSwapReasons(player, mon, player.team.find((p) => p.uid === action.swap));
    }
    case 'boxOut':
      return [r('the AI keeps its team together', -3)];
    // Macro 01: Professor Oak in Pallet Town.
    case 'oakKit':
      return [r("Professor Oak's emergency kit: a free Poké Ball", 20)];
    case 'oakJob':
      return oakJobReasons(state, player, action.job);
    case 'oakJobPick':
      return oakPickReasons(player, action.target);
    case 'oakJobCancel':
      return [r('the AI finishes what it starts', -10)];
    case 'swapQuest': {
      const instance = player.quests.find((q) => q.questId === action.target);
      const quest = QUESTS_BY_ID[action.target];
      const d = questDistance(player, instance, state.config, questBlocks(state));
      if (!Number.isFinite(d)) return [r(`mission "${quest.title}" is unreachable`, 6)];
      const places = questLocations(instance, state.config);
      if (quest.kind === 'catch' && places.length && places.every((id) => placeFatigue(player, id, state.config) >= 2)) return [r(`mission "${quest.title}": its place is exhausted for now`, 4)]; // EREV-03
      if (d >= 7) return [r(`mission "${quest.title}" is ${d} steps away`, 1.5)];
      return [r(`keep mission "${quest.title}"`, -1)];
    }
    case 'evolve': {
      // Evolve before shopping; prefer the lead, then the biggest stat jump.
      const target = player.team.find((p) => p.uid === action.target);
      const from = getSpecies(target.species);
      const to = action.to ? getSpecies(action.to) : evolutionTarget(from); // bonus 14.10: Eevee's chosen form
      return [
        r(`evolve ${from.name} → ${to.name} (free)`, 9),
        r('lead Pokémon', target === lead ? 1.5 : 0),
        r('stat gain', (to.hp - from.hp) * 0.2 + (to.attack - from.attack) * 0.5),
      ];
    }
    case 'buy': {
      const left = player.money - price(action.item, state.config);
      const balls = totalBalls(player);
      switch (action.item) {
        case 'pokeball': return [r(`have ${balls} balls`, (balls < 3 ? 3 : balls < 5 ? 1.2 : 0.2) * w.catch)];
        case 'superball': return [r('spare money for a Super Ball', left >= 4 && balls < 6 ? 1.3 * w.catch : 0)];
        // Build 3.3 E2: one Ultra Ball for a rare one, only with plenty of money left
        case 'ultraball': return [r('an Ultra Ball for a rare Pokémon', left >= 6 && itemCount(player, 'ultraball') === 0 && balls >= 3 ? 1.1 * w.catch : 0)];
        // Poké Stops are far apart (DQ-33): keep a small field kit of 2 Potions + 1 Revive.
        case 'potion': return [r(`carrying ${itemCount(player, 'potion')} Potions`, (itemCount(player, 'potion') === 0 ? 1.25 : itemCount(player, 'potion') === 1 ? 1.1 : 0.2) * w.rest)];
        // Gameplay P1: one Super Potion for the big hits, when there's money to spare.
        case 'superpotion': return [r(`carrying ${itemCount(player, 'superpotion')} Super Potions`, (itemCount(player, 'superpotion') === 0 && itemCount(player, 'potion') >= 1 && left >= 0 ? 1.15 : 0.1) * w.rest)];
        case 'revive': return [r(`carrying ${itemCount(player, 'revive')} Revives`, (itemCount(player, 'revive') === 0 && left >= 1 ? 1.05 : 0.1) * w.rest)];
        default: return ITEMS[action.item]?.kind === 'evolution' ? stoneReasons(player, action.item, state.config.rules) : [];
      }
    }
    case 'assignGrowth': {
      // Growth games: closest to evolving first, then the starter's line, then the stronger next form.
      const mon = player.team.find((p) => p.uid === action.target);
      const edge = growthEdge(mon, state.config.rules);
      const left = edge.growth - (mon.growth ?? 0);
      const to = getSpecies(edge.to);
      if (state.config.rules.exp && state.growthChoice?.awards[0]) {
        // Build 3.3 E1: the award is worth more to a weaker receiver (class difference)
        const amount = Math.min(left, awardAmount(state.config.rules, mon, state.growthChoice.awards[0]));
        return [
          r(`+${amount} EXP (${left} to evolving)`, amount * 1.5 + (amount >= left ? 3 : 0)),
          r('starter line', isStarterLine(player, mon) ? 1.5 : 0),
          r(`next form ${to.name}`, (to.hp + 2 * to.attack) * 0.1),
        ];
      }
      return [
        r(`${left} Growth from evolving`, 4 / left),
        r('starter line', isStarterLine(player, mon) ? 1.5 : 0),
        r(`next form ${to.name}`, (to.hp + 2 * to.attack) * 0.1),
      ];
    }
    case 'leaveShop':
      return [r('done shopping', 1)];
    // Build 3.3 E3: the quest book — take a quest when a slot is free, collect at once, never give up
    case 'takeQuest':
      if (bookQuest(action.quest).pack) return [r('a day-14 pack quest: the AI does not plan its steps (show / give / observe / evolve)', -20)]; // One Kanto day 14.10
      return [r(`take the quest ${action.quest} (free)`, bookQuest(action.quest).giver === 'oak' ? 7 : 6.5)]; // free: before moving on
    case 'claimQuest':
      return [r(`collect the quest reward ${action.occ}`, 10)];
    case 'abandonQuest':
      return [r('never give up a quest', -5)];
    case 'questChallenge': {
      const a = findOcc(player, action.occ); // E5: a trial's challenge too
      const ratio = challengeRatio(state, player, openChallenge(state, player, a).spec);
      return [r(`quest challenge (team ${Math.round(ratio * 100)}% of it)`, ratio >= state.config.ai.gym.readyRatio ? 4 : -(1 + (state.config.ai.gym.readyRatio - ratio) * 10) * w.caution)];
    }
    case 'questEncounter':
      return [r('the expedition encounter is here (PLAYTEST_006 C4)', 5)];
    case 'challengeRocket':
      return rocketBattleReasons(state, player, w);
    case 'challengeGym':
      return gymChallengeReasons(state, player, w);
    case 'challengeLeague':
      return leagueChallengeReasons(state, player, w);
    case 'continueLeague':
      // Items and lead changes first (they score higher when useful), then Lance.
      return [r('face Champion Lance', 0.5)];
    case 'continueChallenge':
      // Build 3.3 B33-3: items and lead first (they score higher when useful), then the next battle
      return [r('the next battle of the challenge', 0.5)];
    case 'quitChallenge':
      // the AI does not give up an attempt it can still fight
      return [r('leave the challenge (it starts over next time)', -4)];
    case 'giveLoot':
      // Hand Meowth the cheapest item; it comes back when anyone beats Rocket.
      return [r(`give up ${action.item} (worth ${price(action.item, state.config)})`, -price(action.item, state.config))];
    case 'useItem': {
      if (state.phase === 'encounter') return battleItemReasons(state, player, action, w);
      const target = player.team.find((p) => p.uid === action.target);
      if (action.item === 'revive') {
        const allDown = player.team.every((p) => p.hp === 0);
        return [r('revive fainted', 3 * w.rest), r(allDown ? 'whole team fainted' : 'free action', allDown ? 12 : 2)];
      }
      const heal = state.config.items[action.item].heal;
      const missing = Math.min(heal, target.maxHp - target.hp);
      const reasons = [r(`heals ${missing}`, missing * w.rest), r('badly hurt, free action', hpFraction(target) <= 0.5 ? 5 : 0)];
      // Gameplay P1: don't spend a Super Potion where a Potion does.
      if (action.item === 'superpotion') reasons.push(r(`wastes ${heal - missing}`, -(heal - missing) * 0.6));
      return reasons;
    }
    case 'explore': {
      // Build 3.3 E4: the hunt's place — a sure meeting with a clue, a 1-in-6 chance without
      if (huntHere(state, player)) return [r('the rare hunt is here', player.clues.includes(state.hunts.active.id) && !player.huntsMet.includes(state.hunts.active.id) ? 9 : 2.5 * w.catch)];
      const here = player.exploreCounts[player.location] ?? 0;
      // Macro 01: no biome = the whole mixed place.
      const mixed = action.biome === undefined ? locationBiomes(player.location, state.config) : null;
      // Exploring here only finds Team Rocket: it's a challenge in disguise.
      if (exploreFindsRocket(state, player)) return [...rocketBattleReasons(state, player, w), ...exploreQuestReasons(state, player, action.biome, w, mixed)];
      const noCatch = catchBlocked(state, player) ? 0 : 1;
      return [
        r('base explore', 2 * w.explore),
        r('uncaught in biome', 3 * (localPool(player.location, state.config) ? uncaughtSharePlace(player, player.location, state.config) : mixed ? uncaughtShareMixed(player, mixed) : uncaughtShare(player, action.biome)) * w.explore * noCatch),
        r('not explored here yet', here === 0 ? 2 * w.explore : 0),
        r('new place: explore it before moving on', here === 0 ? w.exploreNewPlace ?? 0 : 0),
        // EREV-03: in a fatigue game the place recovers week by week (M02-2) — judge it by today's
        // fatigue (as the rule does), not by every Explore ever made here (that pinned the AI for good)
        ...(usesFatigue(state.config)
          ? [r(`explored here ${here}×`, -Math.min(3, 0.3 * here)), r(['', 'tired here', 'exhausted here'][placeFatigue(player, player.location, state.config)] || 'fresh here', -3 * placeFatigue(player, player.location, state.config))]
          : [r(`explored here ${here}×`, -1 * here)]),
        // Gameplay P1 (rules.vigilance): the Pokémon here are wary after our catches.
        r('wary Pokémon here', -vigilanceSteps(state, player) * 1.5 * w.catch),
        r('lead hurt', lead.hp < lead.maxHp ? -(1 - hpFraction(lead)) * 6 * w.caution : 0),
        r('no Poké Balls', totalBalls(player) === 0 ? -1 * w.catch : 0),
        ...exploreQuestReasons(state, player, action.biome, w, mixed),
        ...bookExploreHere(state, player),
      ];
    }
    case 'rest': {
      const target = player.team.find((p) => p.uid === action.target);
      const missing = Math.min(target.maxHp - target.hp, restHeal(state.config));
      return [
        r(`heals ${missing}`, missing * w.rest),
        r('revives fainted', target.hp === 0 ? 2 * w.rest : 0),
        r('lead badly hurt', target === lead && hpFraction(lead) <= 0.5 ? 1 * w.caution : 0),
      ];
    }
    case 'setLead': {
      const target = player.team.find((p) => p.uid === action.target);
      const better = hpFraction(lead) < 0.5 && hpFraction(target) > hpFraction(lead);
      return [r(better ? 'healthier lead' : 'no reason to swap', better ? 1.5 : -1)];
    }
    case 'chooseLead': {
      // DQ-107: like setLead — the AI keeps its lead (DQ-71) unless it is badly
      // hurt and another one is healthier (the healthiest first).
      const target = player.team.find((p) => p.uid === action.target);
      if (target === lead) return [r('keeps its lead', 1)];
      const better = hpFraction(lead) < 0.5 && hpFraction(target) > hpFraction(lead);
      return [r(better ? 'healthier lead' : 'no reason to swap', better ? 1.5 + hpFraction(target) : -1)];
    }
    case 'cancelBattle':
      return [r('the AI finishes what it starts', -10)];
    case 'switchPokemon':
      // DQ-71: the AI keeps its lead for now (simulations stay comparable).
      return [r('AI does not switch in battle yet', -5)];
    case 'endTurn':
      return [r('wastes remaining actions', -0.5 * state.turn.actionsRemaining)];
    // One Kanto day 14.10: trading and friendly duels are for two people at the table — the AI (and a developer
    // table's autoplay) never starts one, backs out of one it finds open, and finishes a duel already fought
    case 'tradeOpen':
    case 'pvpChallenge':
      return [r('trades and duels are for the people at the table', -20)];
    case 'tradeCancel':
    case 'pvpCancel':
      return [r('back out of a trade / duel', 2)];
    case 'pvpAttack':
      return [r('the duel goes on', 1)];
    // bonus 2 (rules.signatureMoves): the line's move when it is ready — the AI's simple rule (spec v1)
    case 'pvpMove':
      return [r('the signature move in a duel', 1.2)];
    case 'signature':
      return [...scoreAction(state, player, { type: 'fight' }, w), r('the signature move (once per battle)', 0.5)];
    case 'fight': {
      const opp = currentOpponent(state.encounter);
      if (state.encounter.kind === 'trainer') return [r('trainer battle', 1 * w.fight)];
      return [
        // Weakening serves both fighters and collectors (an easier Catch Die and Escape Die at low HP).
        r('weaken it', (hpFraction(opp) * 4 + hpFraction(lead) * 2) * Math.max(w.fight, w.catch)),
        r('might knock it out', opp.hp <= 2 ? -2 * w.catch : 0),
      ];
    }
    case 'throwBall': {
      const wild = state.encounter.pokemon;
      const species = getSpecies(wild.species);
      // With retries (DQ-61) a throw is worth more: the chance to catch within
      // the balls in hand, a failed throw possibly leaving another try.
      const p = catchChanceWithRetries(state, wild, action.ball, totalBalls(player));
      const known = player.pokedex.caught.includes(species.id);
      return [
        ...counterRisk(state, player, wild, action.ball, w),
        r(`capture chance ${Math.round(p * 100)}%${state.config.capture.retry === 'harsh' ? '' : ' (with retries)'}`, 10 * p * w.catch * (known ? 0.5 : 1)),
        r('new for Pokédex', known ? 0 : 1 * w.catch),
        r('pricier ball', action.ball === 'superball' ? -0.8 : action.ball === 'ultraball' ? (species.rarity === 'common' ? -3 : -1.2) : 0), // E2: an Ultra Ball for the rare ones
        ...catchQuestBonus(state, player, species.id, w),
      ];
    }
    case 'run':
      if (state.encounter.kind === 'trainer') return retreatReasons(state, player, action, w);
      return [
        r('mission target', catchQuestBonus(state, player, state.encounter.pokemon.species, w).length ? -1.5 : 0),
        r('lead hurt', (1 - hpFraction(lead)) * 5 * w.caution),
        r('lead about to faint', lead?.hp === 1 ? 2 * w.caution : 0),
        r('no Poké Balls', totalBalls(player) === 0 ? 2 : 0),
      ];
    case 'chooseEvent': {
      const choice = EVENTS_BY_ID[state.pendingEvent.id].choices[action.choice];
      return choice.effects.map((e) => r(`${e.type} ${e.amount ?? ''}`.trim(), effectValue(player, lead, e, w)));
    }
    default:
      return [];
  }
}

// ---- missions: explainable bonuses, always smaller than survival needs ----------

function activeQuests(player) {
  return (player.quests ?? []).map((instance) => ({ instance, quest: QUESTS_BY_ID[instance.questId] }));
}

// Where a mission wants the player to go, and how hard it pulls per step.
// Fixed / generated destinations pull hardest; travel counters ("2 different
// Poké Stops", "3 different biomes") pull toward the nearest place that counts.
function questTravelTargets(state, player, instance, quest) {
  const q = state.config.ai.quest;
  const fixed = questLocations(instance, state.config);
  // EREV-03: a catch mission's place this player has exhausted (M02-2) is no target this
  // week — it recovers; until then the mission must not hold the AI there
  if (fixed.length && quest.kind === 'catch') return { targets: fixed.filter((id) => placeFatigue(player, id, state.config) < 2), pull: q.destinationPull };
  if (fixed.length) return { targets: fixed, pull: q.destinationPull };
  if (quest.kind === 'visitPokeStops') {
    return { targets: topologyLocations(state.config).filter((l) => hasPokeStop(l.id, state.config) && !instance.visited.includes(l.id)).map((l) => l.id), pull: q.counterPull };
  }
  if (quest.kind === 'exploreLocations') {
    // Any new place counts; the AI prefers places it has never explored.
    const open = topologyLocations(state.config).filter((l) => isLocationEnabled(l.id, state.config) && l.biomes.length && !instance.places.includes(l.id));
    const fresh = open.filter((l) => !player.exploreCounts[l.id]);
    return { targets: (fresh.length ? fresh : open).map((l) => l.id), pull: q.counterPull };
  }
  return { targets: [], pull: 0 };
}

function towardQuests(state, player, to, w) {
  const travel = activeQuests(player)
    .map(({ instance, quest }) => ({ quest, ...questTravelTargets(state, player, instance, quest) }))
    .filter((t) => t.targets.length);
  if (!travel.length) return [];
  const blocks = worldBlocks(state);
  const here = travelDistances(player, player.location, state.config, blocks);
  const there = travelDistances(player, to, state.config, blocks);
  return travel.map(({ quest, targets, pull }) => {
    const now = Math.min(...targets.map((t) => here[t] ?? Infinity));
    const next = Math.min(...targets.map((t) => there[t] ?? Infinity));
    if (!Number.isFinite(now) || !Number.isFinite(next)) return r(`mission "${quest.title}"`, 0);
    return r(`mission "${quest.title}" (${now} → ${next} away)`, (now - next) * pull);
  });
}

function speciesInBiome(biome, target) {
  return POKEMON.some((p) => isWild(p) && p.biomes.includes(biome) && speciesMatches(target, p.id));
}

function exploreQuestReasons(state, player, biome, w, mixed = null) {
  const q = state.config.ai.quest;
  const place = mixed ? { location: player.location, biome, biomes: mixed } : { location: player.location, biome };
  const local = localPool(player.location, state.config) ? placeSpecies(player.location, state.config) : null;
  const lives = (target) => (local ? local.some((p) => speciesMatches(target, p.id)) : mixed ? mixed.some((b) => speciesInBiome(b, target)) : speciesInBiome(biome, target));
  return activeQuests(player).flatMap(({ instance, quest }) => {
    // Finishing a mission on the spot beats wandering off to the next one.
    if (quest.kind === 'explore' && placeMatches(quest, instance, place, state.config)) return [r(`mission "${quest.title}" done by exploring`, q.finishHere)];
    if (quest.kind === 'exploreLocations' && !instance.places.includes(player.location)) return [r(`mission "${quest.title}": new place`, q.newPlace)];
    if (quest.kind === 'catch' && placeMatches(quest, instance, place, state.config) && lives(quest.target)) {
      const atDestination = questLocations(instance, state.config).includes(player.location);
      return [r(`mission "${quest.title}": target lives here`, (atDestination ? q.catchHereDestination : q.catchHereGlobal) * w.catch)];
    }
    return [];
  });
}

function catchQuestBonus(state, player, speciesId, w) {
  const place = { location: player.location };
  return activeQuests(player)
    .filter(({ instance, quest }) => quest.kind === 'catch' && speciesMatches(quest.target, speciesId) && placeMatches(quest, instance, { ...place, biome: undefined }, state.config))
    .map(({ quest }) => r(`mission "${quest.title}"`, state.config.ai.quest.catchTarget * w.catch));
}

function towardPokeStop(state, player, to) {
  const need = pokeStopNeed(player, state.config);
  if (!need) return r('toward Poké Stop', 0);
  const blocks = worldBlocks(state);
  const now = distanceToPokeStop(player, player.location, state.config, blocks);
  const next = distanceToPokeStop(player, to, state.config, blocks);
  if (!Number.isFinite(now) || !Number.isFinite(next)) return r('toward Poké Stop', 0);
  return r(`toward Poké Stop (${now} → ${next} away)`, (now - next) * need);
}

// ---- Team Rocket: go for a plot when the team can take it ------------------------
// Power = HP + 2 × attack of every healthy Pokémon (Rocket: full HP). The stake
// is what clearing pays this player: card reward + own loot + a bit for others'.

function speciesPower(speciesId, hp) {
  return hp + 2 * Math.max(0, getSpecies(speciesId).attack);
}

function rocketReadiness(state, player) {
  const card = plotCard(activePlot(state));
  const rocket = rocketTeam(state, card).reduce((sum, id) => sum + speciesPower(id, getSpecies(id).hp), 0);
  const mine = player.team.filter((p) => p.hp > 0).reduce((sum, p) => sum + speciesPower(p.species, p.hp), 0);
  return mine / rocket;
}

function plotStake(state, player) {
  const q = state.config.ai.rocket;
  const active = activePlot(state);
  const loot = (own) => active.loot.filter((e) => (e.owner === player.id) === own).reduce((sum, e) => sum + lootValue(e, state.config), 0);
  return plotRewardValue(plotCard(active), state.config) + loot(true) * q.ownLoot + loot(false) * q.othersLoot;
}

// Shared by Challenge Rocket, Explore-into-Rocket and walking into an ambush.
function rocketBattleReasons(state, player, w) {
  const q = state.config.ai.rocket;
  const card = plotCard(activePlot(state));
  const ratio = rocketReadiness(state, player);
  const stake = plotStake(state, player);
  const blocksMission = activeQuests(player).some(({ instance }) => questLocations(instance, state.config).includes(activePlot(state).location));
  return [
    r(`beat Team Rocket "${card.title}" (stake ${Math.round(stake * 10) / 10})`, ratio >= q.readyRatio ? q.challenge + 0.8 * stake * w.fight : 0),
    r(`team ${Math.round(ratio * 100)}% of Rocket's power`, ratio >= q.readyRatio ? 0 : -(1 + (q.readyRatio - ratio) * 10) * w.caution),
    r('Rocket sits on my mission target', blocksMission && ratio >= q.readyRatio ? 2 : 0),
  ];
}

// Archetype-neutral pull toward the plot, only when the team can take it.
function towardRocket(state, player, to) {
  const active = activePlot(state);
  if (!active || rocketReadiness(state, player) < state.config.ai.rocket.readyRatio) return r('toward Team Rocket', 0);
  const q = state.config.ai.rocket;
  const blocks = worldBlocks(state);
  const targets = challengeLocations(state);
  const here = travelDistances(player, player.location, state.config, blocks);
  const there = travelDistances(player, to, state.config, blocks);
  const now = Math.min(...targets.map((t) => here[t] ?? Infinity));
  const next = Math.min(...targets.map((t) => there[t] ?? Infinity));
  if (!Number.isFinite(now) || !Number.isFinite(next)) return r('toward Team Rocket', 0);
  const pull = Math.min(q.maxPull, plotStake(state, player) * q.pullPerValue);
  return r(`toward Team Rocket "${plotCard(active).title}" (${now} → ${next} away)`, (now - next) * pull);
}

// Walking into an ambush is a free Rocket battle; a pitfall costs the rest of the turn.
function enteringPlot(state, player, to, w) {
  const active = activePlot(state);
  if (!active || active.location !== to) return [];
  const kind = plotCard(active).effect.kind;
  if (kind === 'ambush' && getLead(player)) return rocketBattleReasons(state, player, w).map((x) => ({ ...x, label: `ambush: ${x.label}` }));
  if (kind === 'pitfall') return [r('Rocket pitfall ends the turn', -1.5 * (state.turn.actionsRemaining - 1))];
  return [];
}

// ---- Phase 3A-2 battle choices ---------------------------------------------------------

// A failed throw may leave the wild Pokémon in place, and then it strikes back
// (rules.counterattackOnStay): the risk weighs more the closer the lead is to fainting.
function counterRisk(state, player, wild, ball, w) {
  if (!state.config.rules.counterattackOnStay || state.config.capture.retry === 'harsh') return [];
  const lead = getLead(player);
  const miss = 1 - throwChance(wild, ball, state.config, vigilanceSteps(state, player));
  const stay = 1 - state.config.capture.escapeDice[escapeColour(wild)].fleeFaces / 6;
  const threat = lead.hp <= 1 ? 4 : lead.hp <= 2 ? 2 : 0.6;
  return [r('it may stay and strike back', -miss * stay * threat * w.caution)];
}

// Potion / Revive replace the attack this exchange (rules.battleItems): worth
// it when the lead is about to faint, rarely otherwise.
function battleItemReasons(state, player, action, w) {
  const target = player.team.find((p) => p.uid === action.target);
  const lead = getLead(player);
  const foe = getSpecies(currentOpponent(state.encounter).species);
  if (freeBattleHealing(state.config)) return freeBattleItemReasons(state, player, action, target, lead, foe, w);
  const noAttack = r('no attack this exchange', -1);
  // Build 3.3 (battleTempo 'v2'): the Super Potion too, as the exchange
  if (action.item === 'potion' || action.item === 'superpotion') {
    if (target !== lead) return [r('heal the bench mid-battle', -1), noAttack];
    const missing = Math.min(state.config.items[action.item].heal, target.maxHp - target.hp);
    const danger = lead.hp <= 1 ? 3 : lead.hp <= 2 && foe.attack >= 1 ? 2 : 0;
    return [r(`heals the lead +${missing}`, missing * 0.5 * w.rest), r('lead about to faint', danger * w.caution), noAttack];
  }
  const power = (m) => m.maxHp + 2 * Math.max(0, getSpecies(m.species).attack);
  const stronger = lead && power(target) > power(lead);
  return [r('revive mid-battle', 0.5 * w.rest), r(stronger ? 'stronger than the lead' : 'weaker than the lead', stronger ? 1 : -1), noAttack];
}

// Gameplay P1 (rules.healingItems 'v2'): healing in battle is free, once per
// Pokémon per battle — heal the lead when it is in danger, then fight on.
function freeBattleItemReasons(state, player, action, target, lead, foe, w) {
  const power = (m) => m.maxHp + 2 * Math.max(0, getSpecies(m.species).attack);
  if (action.item === 'revive') {
    const healthy = player.team.filter((p) => p.hp > 0).length;
    const stronger = lead && power(target) > power(lead);
    return [r('revive mid-battle (free)', healthy <= 1 && lead.hp <= 2 ? 6 : stronger ? 2 : -1)];
  }
  if (target !== lead) return [r('heal the bench after the battle', -2)];
  const heal = state.config.items[action.item].heal;
  const missing = Math.min(heal, target.maxHp - target.hp);
  // Free and once per battle: heal a hurt lead before the next blow, without waste.
  const danger = lead.hp <= 1 ? 8 : lead.hp <= 2 && foe.attack >= 1 ? 6 : hpFraction(lead) <= 0.6 && missing >= heal ? 5 : 0;
  if (!danger) return [r('lead not in danger', -1)];
  return [r(`heals the lead +${missing} (free)`, missing * 0.8 * w.rest), r('lead in danger', danger * w.caution), r(`wastes ${heal - missing}`, -(heal - missing) * 0.5)];
}

// ---- Macro 01: Professor Oak's Research Jobs and emergency kit --------------------------
// The AI sends the Box first (those Pokémon are idle anyway), then the weakest
// team Pokémon — never the starter's line or the lead if it can help it.

const monPower = (m) => m.maxHp + 2 * Math.max(0, getSpecies(m.species).attack) + (m.growth ?? 0) * 0.3;

function oakJobReasons(state, player, job) {
  const spec = jobSpec(state, job);
  const value = spec.reward.reduce((sum, x) => sum + (x.type === 'money' ? x.amount : price(x.type === 'pokeballs' ? 'pokeball' : x.type, state.config) * x.amount), 0);
  const idle = player.reserve.filter((p) => p.hp > 0).length;
  const fromTeam = Math.max(0, spec.size - idle);
  const healthyTeam = player.team.filter((p) => p.hp > 0).length;
  const left = healthyTeam - fromTeam; // healthy Pokémon the team keeps
  const poor = player.money < state.config.economy.pokeball * 2;
  return [
    r(`Research Job ${job}: ${value} money-equivalent`, value * 1.4),
    r(`${fromTeam} team Pokémon away ${spec.turns} turns, ${left} stay`, -fromTeam * (left >= 3 ? 0.5 : left === 2 ? 1 : 2.5)),
    r('money is short', poor ? 3 : 0),
  ];
}

function oakPickReasons(player, uid) {
  const inBox = player.reserve.find((p) => p.uid === uid);
  if (inBox) return [r('an idle Pokémon from the Box', 3 - monPower(inBox) * 0.05)];
  const mon = player.team.find((p) => p.uid === uid);
  return [
    r(`${getSpecies(mon.species).name} from the team`, -monPower(mon) * 0.2),
    r('starter line stays', isStarterLine(player, mon) ? -5 : 0),
    r('the lead stays', mon === getLead(player) ? -2 : 0),
  ];
}

// Toward Professor Oak's emergency kit when it would rescue the player (no
// ball, no money): as strong as a fainted team's pull to a Poké Stop, toward
// the nearest place that gives it. Research Jobs pull nobody — a detour for
// +1 money cost the AI badges in the Macro 01 simulation; the AI starts a job
// only when it is in Pallet Town anyway.
// Build 3.3 E4: an open hunt — toward its place (known with a clue; else the region)
// when the team has balls and is ready for a strong Pokémon.
function huntHere(state, player) {
  const h = state.hunts?.active;
  return Boolean(h) && h.place === player.location && huntOpenFor(state, player) && ballCount(player) > 0;
}
function towardHunt(state, player, to) {
  const h = state.hunts?.active;
  if (!h || !huntOpenFor(state, player) || ballCount(player) === 0) return [];
  const targets = player.clues.includes(h.id) ? [h.place] : huntDef(state.config, h.id).region;
  const blocks = worldBlocks(state);
  const here = travelDistances(player, player.location, state.config, blocks);
  const there = travelDistances(player, to, state.config, blocks);
  const now = Math.min(...targets.map((t) => here[t] ?? Infinity));
  const next = Math.min(...targets.map((t) => there[t] ?? Infinity));
  if (!Number.isFinite(now) || !Number.isFinite(next) || now > 6) return [];
  return [r(`toward the rare hunt (${now} → ${next} away)`, (now - next) * (player.clues.includes(h.id) ? 5 : 2))];
}

// Build 3.3 E3: toward the place the next quest-book step needs (a visit, an Explore, a key
// item to bring, a quest challenge) or, when done, where its reward is collected.
// Only the steps still open count; a quest challenge only once the team is ready for it
// (E5: a challenge the AI would not fight must not hold it at that place).
function bookTargets(state, player, a) {
  const q = bookQuest(a.questId);
  if (isDone(a)) return q.claimAt === 'pokeStop' ? pokeStopPlaces(state.config) : [q.claimAt];
  const places = [];
  q.stages[a.stage].objectives.forEach((o, i) => {
    if (objectiveProgress(player, a, o, i) >= objectiveTarget(o)) return;
    if (['visit', 'explore', 'bring', 'encounter'].includes(o.kind)) places.push(o.place); // C4: the expedition's encounter place
    else if (o.kind === 'challenge' && challengeRatio(state, player, o) >= state.config.ai.gym.readyRatio) places.push(o.place);
    // E5: a trial's catch goal — the places whose own (signature) species has the type
    else if (a.gym && o.kind === 'catch' && o.types && state.config.rules.localPools === 'v2') places.push(...signaturePlacesOf(o.types));
  });
  return places;
}
const challengeRatio = (state, player, spec) => {
  const row = spec.teams[Math.min(3, player.badges.length + 1) - 1];
  return powerAgainst(state, player, row) / rowPower(row);
};
const signaturePlacesOf = (types) => Object.entries(LOCAL_POOLS).filter(([, t]) => t.signature.some((s) => getSpecies(s).types.some((x) => types.includes(x)))).map(([id]) => id);
// E5: one gym trial at a time — the one with the most steps done, then the nearest (like
// one gym target): several trials pulling apart would leave the AI between them.
function focusTrial(state, player, here) {
  const open = (player.questBook.trials ?? []).filter((t) => !isDone(t) && !player.badges.includes(t.gym));
  const done = (t) => bookQuest(t.questId).stages[t.stage].objectives.filter((o, i) => objectiveProgress(player, t, o, i) >= objectiveTarget(o)).length;
  const near = (t) => Math.min(Infinity, ...bookTargets(state, player, t).map((p) => here[p] ?? Infinity));
  const best = open.map((t) => ({ t, done: done(t), near: near(t) })).filter((x) => Number.isFinite(x.near)).sort((x, y) => y.done - x.done || x.near - y.near || (x.t.occ < y.t.occ ? -1 : 1))[0];
  return best ? [best.t] : [];
}

// Build 3.3 E3 / E5: an Explore here is a quest-book step (an Explore goal, or a trial's
// catch goal at a place whose own species has the type).
function bookExploreHere(state, player) {
  if (!usesQuestBook(state.config) || !player.questBook) return [];
  const entries = [...player.questBook.active, ...(player.questBook.trials ?? [])].filter((a) => !isDone(a));
  const hit = entries.find((a) => {
    const objs = bookQuest(a.questId).stages[a.stage].objectives;
    return objs.some((o, i) => objectiveProgress(player, a, o, i) < objectiveTarget(o) && (
      (o.kind === 'explore' && o.place === player.location) ||
      (o.kind === 'encounter' && o.place === player.location && a.lost?.[i]) || // C4: R2 — a new trail
      (a.gym && o.kind === 'catch' && o.types && state.config.rules.localPools === 'v2' && signaturePlacesOf(o.types).includes(player.location) && totalBalls(player) > 0)));
  });
  return hit ? [r(`quest ${hit.occ}: its step is here`, 4)] : [];
}
function towardBook(state, player, to) {
  if (!usesQuestBook(state.config) || !player.questBook) return [];
  const blocks = worldBlocks(state);
  const here = travelDistances(player, player.location, state.config, blocks);
  const entries = [...player.questBook.active, ...focusTrial(state, player, here)];
  if (!entries.length) return [];
  const there = travelDistances(player, to, state.config, blocks);
  return entries.map((a) => {
    const targets = bookTargets(state, player, a);
    if (!targets.length) return r(`quest ${a.occ}`, 0);
    const now = Math.min(...targets.map((t) => here[t] ?? Infinity));
    const next = Math.min(...targets.map((t) => there[t] ?? Infinity));
    if (!Number.isFinite(now) || !Number.isFinite(next)) return r(`quest ${a.occ}`, 0);
    return r(`quest ${a.occ} (${now} → ${next} away)`, (now - next) * (isDone(a) ? 4 : 3));
  });
}

function towardOak(state, player, to) {
  const cfg = state.config;
  const kit = cfg.rules.oakKit && !player.oakKitUsed && needsKit(state, player);
  if (!kit) return [];
  const blocks = worldBlocks(state);
  const here = travelDistances(player, player.location, cfg, blocks);
  const there = travelDistances(player, to, cfg, blocks);
  const places = Object.keys(here).filter((id) => kitPlace(state, id));
  const now = Math.min(...places.map((id) => here[id] ?? Infinity));
  const next = Math.min(...places.map((id) => there[id] ?? Infinity));
  if (!Number.isFinite(now) || !Number.isFinite(next)) return [];
  return [r(`toward Professor Oak's emergency kit (${now} → ${next} away)`, (now - next) * 8)];
}

// ---- Gameplay P1: the shop and Oak's Box -------------------------------------------

function pokeStopMissionReasons(player) {
  return activeQuests(player)
    .filter(({ instance, quest }) => quest.kind === 'visitPokeStops' && !instance.visited.includes(player.location))
    .map(({ quest }) => r(`mission "${quest.title}"`, 2));
}

// Worth selling (> 1 beats leaving the shop): stones nobody in the team needs,
// medicine beyond a field kit; never balls. Buying stops at 1–2 Potions and
// only wants needed stones, so the AI never buys back what it sells.
function sellValue(state, player, id) {
  if (!state.config.rules.selling || itemCount(player, id) <= 0) return 0;
  const kind = ITEMS[id]?.kind;
  if (kind === 'ball') return -5;
  if (kind === 'evolution') return player.team.some((p) => growthEdge(p)?.item === id) ? -3 : 1.3; // (an Eevee's stones: growthEdge without rules = no branch — the AI keeps its old view)
  if (id === 'potion') return itemCount(player, id) > 3 ? 1.1 : -3;
  if (id === 'superpotion') return itemCount(player, id) > 2 ? 1.1 : -3;
  if (id === 'revive') return itemCount(player, id) > 2 ? 1.05 : -3;
  return -3;
}

// The new Pokémon against the one that would leave the team for the Box.
function boxSwapReasons(player, incoming, out) {
  const power = (m) => m.maxHp + 2 * Math.max(0, getSpecies(m.species).attack) + (m.growth ?? 0) * 0.3;
  const gain = power(incoming) - power(out);
  return [
    r(`${getSpecies(incoming.species).name} vs ${getSpecies(out.species).name}`, gain * 0.4 - 1),
    r('starter line stays', isStarterLine(player, out) ? -5 : 0),
    r('fainted newcomer', incoming.hp === 0 ? -2 : 0),
  ];
}

// Leave a trainer battle that is going badly (rules.trainerRetreat): our
// healthy power against what the trainer still has; the price counts a little,
// and with several items on offer the cheapest is given.
function retreatReasons(state, player, action, w) {
  const enc = state.encounter;
  const left = enc.trainer.pokemonTeam.slice(enc.index).filter((m) => m.hp > 0);
  const theirs = left.reduce((sum, m) => sum + m.hp + 2 * Math.max(0, getSpecies(m.species).attack), 0);
  const ratio = powerAgainst(state, player, left.map((m) => m.species)) / Math.max(1, theirs);
  const cost = player.money > 0 ? 1 : action.item ? price(action.item, state.config) : 0;
  return [
    r(`our power ${ratio.toFixed(2)} × theirs`, ratio < 0.7 ? (0.7 - ratio) * 12 * w.caution : -3),
    r(cost ? `costs ${action.item ? `a ${ITEMS[action.item].name}` : '1 money'}` : 'nothing to leave', -0.3 * cost),
  ];
}

// ---- gyms and the League ------------------------------------------------------------
// Readiness = own healthy power against these opponents (HP + 2 × (attack +
// average type modifier)) / their power (HP + 2 × attack). It uses current HP,
// so a hurt team heals before it challenges.

// fullHp: as the team will be after a full heal (a Poké Stop at the destination).
function powerAgainst(state, player, opponents, fullHp = false) {
  return player.team.filter((p) => fullHp || p.hp > 0).reduce((sum, p) => {
    const s = getSpecies(p.species);
    const mods = opponents.map((id) => typeModifier(attackTypeOf(s), getSpecies(id).types, state.config));
    const mod = mods.reduce((a, b) => a + b, 0) / mods.length;
    return sum + (fullHp ? p.maxHp : p.hp) + 2 * Math.max(0, s.attack + mod);
  }, 0);
}

// Build 3.3 correction C3: a chain is one attempt with no Poké Stop inside it — the
// AI measures its team (HP as it is now, or full after a heal on the way) against
// EVERY Pokémon of the attempt: the gym's trainer(s) and the leader (rules
// gymChallenge 'v2'), the four League v2 members (rules leagueChallenge 'v2'). The
// healing it carries counts too: between the battles items are free. Older games
// keep the leader's row alone and no item term (the same seeds play as before).
function itemReserveHp(state, player) {
  const team = player.team;
  if (!team.length) return 0;
  const avgMax = team.reduce((a, p) => a + p.maxHp, 0) / team.length;
  const hp = healingItems(state.config).reduce((sum, id) => sum + itemCount(player, id) * (id === 'revive' ? avgMax * (state.config.items.revive.hpFraction ?? 1) : state.config.items[id].heal), 0);
  return Math.min(hp, team.reduce((a, p) => a + p.maxHp, 0)); // never more than the team can hold
}

function gymReadiness(state, player, gym, fullHp = false) {
  if (usesGymChain(state.config)) {
    const row = chainOpponents(state, { kind: 'gym', gymId: gym.id, tier: gymTier(state, player) }).flatMap((o) => o.team);
    return (powerAgainst(state, player, row, fullHp) + itemReserveHp(state, player)) / rowPower(row);
  }
  const row = gymRow(gym, gymTier(state, player), state.config);
  return powerAgainst(state, player, row, fullHp) / rowPower(row);
}

function tripAtFullHp(state, location) {
  return Boolean(state.config.ai.pullReadinessAtFullHp) && hasPokeStop(location, state.config);
}

// Nearest gym (without the badge) the AI is ready for; ties → better readiness.
// Once it has enough badges for the League it stops hunting gyms: extra badges
// only pay money, so it trains for the League instead.
function gymTarget(state, player) {
  if (!gymsEnabled(state) || player.badges.length >= state.config.gyms.badgesForLeague) return null;
  const q = state.config.ai.gym;
  const dist = travelDistances(player, player.location, state.config, worldBlocks(state));
  const unlocked = (g) => { const u = gymUnlock(state, player, g.id); return u.ok || (u.missing.length === 1 && u.missing[0] === 'trial' && !player.knownTrials?.includes(g.id)); }; // E5: go and learn an unknown trial
  const ready = GYMS.filter((g) => !hasBadge(player, g.id) && unlocked(g) && !placeClosedNow(state, g.city) && dist[g.city] !== undefined) // Build 3.3: credentials (hometown); C2: not a closed city
    .map((g) => ({ gym: g, ratio: gymReadiness(state, player, g, tripAtFullHp(state, g.city)), d: dist[g.city] }))
    .filter((t) => t.ratio >= q.readyRatio)
    .sort((a, b) => a.d - b.d || b.ratio - a.ratio);
  return ready[0] ?? null;
}

function towardGym(state, player, to) {
  const target = gymTarget(state, player);
  if (!target || target.d === 0) return r('toward a gym', 0);
  const there = travelDistances(player, to, state.config, worldBlocks(state))[target.gym.city];
  if (there === undefined) return r('toward a gym', 0);
  return r(`toward ${target.gym.leader}'s gym (${target.d} → ${there} away)`, (target.d - there) * state.config.ai.gym.pull);
}

function gymChallengeReasons(state, player, w) {
  const q = state.config.ai.gym;
  const gym = gymHere(state, player);
  const ratio = gymReadiness(state, player, gym);
  const missing = player.team.reduce((sum, p) => sum + p.maxHp - p.hp, 0);
  const enough = player.badges.length >= state.config.gyms.badgesForLeague;
  return [
    r(`${gym.badge} (tier ${gymTier(state, player)}, team ${Math.round(ratio * 100)}% of ${usesGymChain(state.config) ? 'the whole chain' : 'the leader'})`, ratio >= q.readyRatio ? q.challenge : -(1 + (q.readyRatio - ratio) * 10) * w.caution),
    r('already has enough badges for the League', enough ? -q.challenge + 1 : 0),
    // At a hub with 2 actions left: heal (1 action), then challenge (1 action).
    r('heal at the Poké Stop first', hasPokeStop(player.location, state.config) && missing >= 2 && state.turn.actionsRemaining >= 2 ? -q.challenge : 0),
  ];
}

function leagueRemaining(state, player) {
  if (usesLeagueChallenge(state.config)) return chainOpponents(state, { kind: 'league' }).flatMap((o) => o.team); // C3: all four, every time
  const start = leagueStartStage(state, player);
  return LEAGUE.stages.flatMap((_, i) => (i >= start ? leagueStageTeam(state, i) : []));
}

function leagueReadiness(state, player, fullHp = false) {
  const rest = leagueRemaining(state, player);
  const items = usesLeagueChallenge(state.config) ? itemReserveHp(state, player) : 0; // C3: free between the four battles
  return (powerAgainst(state, player, rest, fullHp) + items) / rowPower(rest);
}

function leagueEligible(state, player) {
  return gymsEnabled(state) && !player.league.champion && player.badges.length >= state.config.gyms.badgesForLeague;
}

function towardLeague(state, player, to) {
  if (!leagueEligible(state, player) || leagueReadiness(state, player, tripAtFullHp(state, LEAGUE.location)) < state.config.ai.league.readyRatio) return r('toward the League', 0);
  const blocks = worldBlocks(state);
  const now = travelDistances(player, player.location, state.config, blocks)[LEAGUE.location];
  const next = travelDistances(player, to, state.config, blocks)[LEAGUE.location];
  if (now === undefined || next === undefined) return r('toward the League', 0);
  return r(`toward the League (${now} → ${next} away)`, (now - next) * state.config.ai.league.pull);
}

function leagueChallengeReasons(state, player, w) {
  const q = state.config.ai.league;
  // Final week: no later turn to prepare for — try the League if it's legal.
  if (state.endgame?.status === 'finalWeek') return [r('final week: last chance to become Champion', 30)];
  const ratio = leagueReadiness(state, player);
  const missing = player.team.reduce((sum, p) => sum + p.maxHp - p.hp, 0);
  return [
    r(`League Challenge (team ${Math.round(ratio * 100)}% of what's left)`, ratio >= q.readyRatio ? q.challenge : -(1 + (q.readyRatio - ratio) * 10) * w.caution),
    r('heal at the Poké Stop first', missing >= 2 && state.turn.actionsRemaining >= 2 ? -q.challenge : 0),
  ];
}

function effectValue(player, lead, e, w) {
  switch (e.type) {
    case 'money': return e.amount;
    case 'pokeballs': return 1.5 * e.amount;
    case 'healLead': return lead ? Math.min(e.amount, lead.maxHp - lead.hp) * w.rest : 0;
    case 'healTeam': return player.team.reduce((s, p) => s + Math.min(e.amount, p.maxHp - p.hp), 0) * w.rest;
    case 'damageLead': return -1.5 * e.amount * w.caution;
    case 'actions': return 2 * e.amount;
    case 'wildEncounter': return (totalBalls(player) > 0 ? 2 : 0.5) * w.catch;
    case 'trainerBattle': return 1 * w.fight;
    case 'item': return 1.5 * e.amount; // bonus 14.10 (rules.eventPack): a Potion / a Great Ball, like a Poké Ball
    default: return 0;
  }
}
