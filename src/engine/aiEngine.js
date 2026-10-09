// AI opponent: transparent heuristic scoring over getLegalActions(). No LLM.
// Every candidate gets a list of reasons (+/- contributions); the best score
// wins and the reasons are written to the log via dispatch(meta.ai).
// Archetypes (balanced / collector / aggressive / explorer) are weight sets in
// CONFIG.ai.archetypes. Ties are broken with a stateless hash so AI decisions
// never consume the game RNG.
import { POKEMON, attackTypeOf, getSpecies, isWild } from '../data/pokemon.js';
import { LOCATIONS, getLocation, getNeighbors, isLocationEnabled } from '../data/locations.js';
import { EVENTS_BY_ID } from '../data/events.js';
import { hashIndex } from './rng.js';
import { currentPlayer, getLead } from './gameState.js';
import { getLegalActions } from './turnEngine.js';
import { catchChanceWithRetries, escapeColour, throwChance } from './captureEngine.js';
import { currentOpponent, typeModifier } from './combatEngine.js';
import { canTraverse } from './travelEngine.js';
import { hasPokeStop, price } from './pokeStopEngine.js';
import { itemCount } from './itemEngine.js';
import { evolutionTarget, starCost } from './evolutionEngine.js';
import { QUESTS_BY_ID } from '../data/quests.js';
import { CHARACTERS_BY_ID } from '../data/characters.js';
import { ITEMS } from '../data/items.js';
import { growthEdge } from './growthEngine.js';
import { placeMatches, questDistance, questLocations, speciesMatches } from './questEngine.js';
import { travelDistances } from './travelEngine.js';
import { GYMS, LEAGUE } from '../data/gyms.js';
import { gymHere, gymRow, gymTier, gymsEnabled, hasBadge, leagueStageTeam, leagueStartStage, rowPower } from './gymEngine.js';
import { activePlot, catchBlocked, challengeLocations, exploreFindsRocket, lootValue, plotCard, plotRewardValue, rocketBlocks, rocketTeam } from './rocketEngine.js';

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

function hpFraction(p) {
  return p ? p.hp / p.maxHp : 0;
}

function totalBalls(player) {
  return itemCount(player, 'pokeball') + itemCount(player, 'superball');
}

// Steps to the nearest Poké Stop over edges this player can travel.
function distanceToPokeStop(player, from, config, blocks) {
  const dist = { [from]: 0 };
  const queue = [from];
  while (queue.length) {
    const at = queue.shift();
    if (hasPokeStop(at)) return dist[at];
    for (const to of getNeighbors(at, config)) {
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
    const edge = growthEdge(p);
    if (edge?.item && (p.growth ?? 0) >= edge.growth && itemCount(player, edge.item) === 0 && player.money >= price(edge.item, config)) return edge.item;
  }
  return null;
}

// Growth games: the starter's evolution line is the one the player cares about most.
function isStarterLine(player, pokemon) {
  const starter = CHARACTERS_BY_ID[player.id]?.starter;
  return Boolean(starter) && getSpecies(starter).family === getSpecies(pokemon.species).family;
}

function stoneReasons(player, id) {
  const needers = player.team.filter((p) => growthEdge(p)?.item === id);
  if (!needers.length) return [r(`no team Pokémon needs a ${ITEMS[id].name}`, -2)];
  if (itemCount(player, id) >= needers.length) return [r(`already carrying a ${ITEMS[id].name}`, -2)];
  const left = Math.min(...needers.map((p) => growthEdge(p).growth - (p.growth ?? 0)));
  return [r(`${ITEMS[id].name}: ${left ? `${left} Growth to go` : 'ready to evolve'}`, left <= 0 ? 4 : left === 1 ? 2.5 : left === 2 ? 1 : -0.5)];
}

export function scoreAction(state, player, action, w) {
  const lead = getLead(player);
  switch (action.type) {
    case 'move': {
      const to = getLocation(action.to);
      const here = player.exploreCounts[player.location] ?? 0;
      const newSpecies = Math.max(0, ...to.biomes.map((b) => uncaughtShare(player, b)));
      return [
        r('base move', 1 * w.move),
        r('unvisited location', player.visited.includes(action.to) ? 0 : 3 * w.novelty),
        r('uncaught species there', 1.5 * newSpecies * w.novelty),
        r(`explored here ${here}×`, here >= 2 ? 1 * w.move : 0),
        r('backtracking', action.to === player.previousLocation ? -2 : 0),
        r('nothing to explore there', to.biomes.length ? 0 : -1),
        towardPokeStop(state, player, action.to),
        ...towardQuests(state, player, action.to, w),
        towardRocket(state, player, action.to),
        ...enteringPlot(state, player, action.to, w),
        towardGym(state, player, action.to),
        towardLeague(state, player, action.to),
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
    case 'swapQuest': {
      const instance = player.quests.find((q) => q.questId === action.target);
      const quest = QUESTS_BY_ID[action.target];
      const d = questDistance(player, instance, state.config);
      if (!Number.isFinite(d)) return [r(`mission "${quest.title}" is unreachable`, 6)];
      if (d >= 7) return [r(`mission "${quest.title}" is ${d} steps away`, 1.5)];
      return [r(`keep mission "${quest.title}"`, -1)];
    }
    case 'evolve': {
      // Evolve before shopping; prefer the lead, then the biggest stat jump.
      const target = player.team.find((p) => p.uid === action.target);
      const from = getSpecies(target.species);
      const to = evolutionTarget(from);
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
        // Poké Stops are far apart (DQ-33): keep a small field kit of 2 Potions + 1 Revive.
        case 'potion': return [r(`carrying ${itemCount(player, 'potion')} Potions`, (itemCount(player, 'potion') === 0 ? 1.25 : itemCount(player, 'potion') === 1 ? 1.1 : 0.2) * w.rest)];
        case 'revive': return [r(`carrying ${itemCount(player, 'revive')} Revives`, (itemCount(player, 'revive') === 0 && left >= 1 ? 1.05 : 0.1) * w.rest)];
        default: return ITEMS[action.item]?.kind === 'evolution' ? stoneReasons(player, action.item) : [];
      }
    }
    case 'assignGrowth': {
      // Growth games: closest to evolving first, then the starter's line, then the stronger next form.
      const mon = player.team.find((p) => p.uid === action.target);
      const edge = growthEdge(mon);
      const left = edge.growth - (mon.growth ?? 0);
      const to = getSpecies(edge.to);
      return [
        r(`${left} Growth from evolving`, 4 / left),
        r('starter line', isStarterLine(player, mon) ? 1.5 : 0),
        r(`next form ${to.name}`, (to.hp + 2 * to.attack) * 0.1),
      ];
    }
    case 'leaveShop':
      return [r('done shopping', 1)];
    case 'challengeRocket':
      return rocketBattleReasons(state, player, w);
    case 'challengeGym':
      return gymChallengeReasons(state, player, w);
    case 'challengeLeague':
      return leagueChallengeReasons(state, player, w);
    case 'continueLeague':
      // Items and lead changes first (they score higher when useful), then Lance.
      return [r('face Champion Lance', 0.5)];
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
      const missing = Math.min(state.config.items.potion.heal, target.maxHp - target.hp);
      return [r(`heals ${missing}`, missing * w.rest), r('badly hurt, free action', hpFraction(target) <= 0.5 ? 5 : 0)];
    }
    case 'explore': {
      const here = player.exploreCounts[player.location] ?? 0;
      // Exploring here only finds Team Rocket: it's a challenge in disguise.
      if (exploreFindsRocket(state, player)) return [...rocketBattleReasons(state, player, w), ...exploreQuestReasons(state, player, action.biome, w)];
      const noCatch = catchBlocked(state, player) ? 0 : 1;
      return [
        r('base explore', 2 * w.explore),
        r('uncaught in biome', 3 * uncaughtShare(player, action.biome) * w.explore * noCatch),
        r('not explored here yet', here === 0 ? 2 * w.explore : 0),
        r('new place: explore it before moving on', here === 0 ? w.exploreNewPlace ?? 0 : 0),
        r(`explored here ${here}×`, -1 * here),
        r('lead hurt', lead.hp < lead.maxHp ? -(1 - hpFraction(lead)) * 6 * w.caution : 0),
        r('no Poké Balls', totalBalls(player) === 0 ? -1 * w.catch : 0),
        ...exploreQuestReasons(state, player, action.biome, w),
      ];
    }
    case 'rest': {
      const target = player.team.find((p) => p.uid === action.target);
      const missing = Math.min(target.maxHp - target.hp, state.config.rest.heal);
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
    case 'switchPokemon':
      // DQ-71: the AI keeps its lead for now (simulations stay comparable).
      return [r('AI does not switch in battle yet', -5)];
    case 'endTurn':
      return [r('wastes remaining actions', -0.5 * state.turn.actionsRemaining)];
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
        r('pricier ball', action.ball === 'superball' ? -0.8 : 0),
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
  const fixed = questLocations(instance);
  if (fixed.length) return { targets: fixed, pull: q.destinationPull };
  if (quest.kind === 'visitPokeStops') {
    return { targets: LOCATIONS.filter((l) => hasPokeStop(l.id) && !instance.visited.includes(l.id)).map((l) => l.id), pull: q.counterPull };
  }
  if (quest.kind === 'exploreLocations') {
    // Any new place counts; the AI prefers places it has never explored.
    const open = LOCATIONS.filter((l) => isLocationEnabled(l.id, state.config) && l.biomes.length && !instance.places.includes(l.id));
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
  const blocks = rocketBlocks(state);
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

function exploreQuestReasons(state, player, biome, w) {
  const q = state.config.ai.quest;
  const place = { location: player.location, biome };
  return activeQuests(player).flatMap(({ instance, quest }) => {
    // Finishing a mission on the spot beats wandering off to the next one.
    if (quest.kind === 'explore' && placeMatches(quest, instance, place)) return [r(`mission "${quest.title}" done by exploring`, q.finishHere)];
    if (quest.kind === 'exploreLocations' && !instance.places.includes(player.location)) return [r(`mission "${quest.title}": new place`, q.newPlace)];
    if (quest.kind === 'catch' && placeMatches(quest, instance, place) && speciesInBiome(biome, quest.target)) {
      const atDestination = questLocations(instance).includes(player.location);
      return [r(`mission "${quest.title}": target lives here`, (atDestination ? q.catchHereDestination : q.catchHereGlobal) * w.catch)];
    }
    return [];
  });
}

function catchQuestBonus(state, player, speciesId, w) {
  const place = { location: player.location };
  return activeQuests(player)
    .filter(({ instance, quest }) => quest.kind === 'catch' && speciesMatches(quest.target, speciesId) && placeMatches(quest, instance, { ...place, biome: undefined }))
    .map(({ quest }) => r(`mission "${quest.title}"`, state.config.ai.quest.catchTarget * w.catch));
}

function towardPokeStop(state, player, to) {
  const need = pokeStopNeed(player, state.config);
  if (!need) return r('toward Poké Stop', 0);
  const blocks = rocketBlocks(state);
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
  const blocksMission = activeQuests(player).some(({ instance }) => questLocations(instance).includes(activePlot(state).location));
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
  const blocks = rocketBlocks(state);
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
  const miss = 1 - throwChance(wild, ball, state.config);
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
  const noAttack = r('no attack this exchange', -1);
  if (action.item === 'potion') {
    if (target !== lead) return [r('heal the bench mid-battle', -1), noAttack];
    const missing = Math.min(state.config.items.potion.heal, target.maxHp - target.hp);
    const danger = lead.hp <= 1 ? 3 : lead.hp <= 2 && foe.attack >= 1 ? 2 : 0;
    return [r(`heals the lead +${missing}`, missing * 0.5 * w.rest), r('lead about to faint', danger * w.caution), noAttack];
  }
  const power = (m) => m.maxHp + 2 * Math.max(0, getSpecies(m.species).attack);
  const stronger = lead && power(target) > power(lead);
  return [r('revive mid-battle', 0.5 * w.rest), r(stronger ? 'stronger than the lead' : 'weaker than the lead', stronger ? 1 : -1), noAttack];
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

function gymReadiness(state, player, gym, fullHp = false) {
  const row = gymRow(gym, gymTier(state, player), state.config);
  return powerAgainst(state, player, row, fullHp) / rowPower(row);
}

function tripAtFullHp(state, location) {
  return Boolean(state.config.ai.pullReadinessAtFullHp) && hasPokeStop(location);
}

// Nearest gym (without the badge) the AI is ready for; ties → better readiness.
// Once it has enough badges for the League it stops hunting gyms: extra badges
// only pay money, so it trains for the League instead.
function gymTarget(state, player) {
  if (!gymsEnabled(state) || player.badges.length >= state.config.gyms.badgesForLeague) return null;
  const q = state.config.ai.gym;
  const dist = travelDistances(player, player.location, state.config, rocketBlocks(state));
  const ready = GYMS.filter((g) => !hasBadge(player, g.id) && dist[g.city] !== undefined)
    .map((g) => ({ gym: g, ratio: gymReadiness(state, player, g, tripAtFullHp(state, g.city)), d: dist[g.city] }))
    .filter((t) => t.ratio >= q.readyRatio)
    .sort((a, b) => a.d - b.d || b.ratio - a.ratio);
  return ready[0] ?? null;
}

function towardGym(state, player, to) {
  const target = gymTarget(state, player);
  if (!target || target.d === 0) return r('toward a gym', 0);
  const there = travelDistances(player, to, state.config, rocketBlocks(state))[target.gym.city];
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
    r(`${gym.badge} (tier ${gymTier(state, player)}, team ${Math.round(ratio * 100)}% of the leader)`, ratio >= q.readyRatio ? q.challenge : -(1 + (q.readyRatio - ratio) * 10) * w.caution),
    r('already has enough badges for the League', enough ? -q.challenge + 1 : 0),
    // At a hub with 2 actions left: heal (1 action), then challenge (1 action).
    r('heal at the Poké Stop first', hasPokeStop(player.location) && missing >= 2 && state.turn.actionsRemaining >= 2 ? -q.challenge : 0),
  ];
}

function leagueRemaining(state, player) {
  const start = leagueStartStage(state, player);
  return LEAGUE.stages.flatMap((_, i) => (i >= start ? leagueStageTeam(state, i) : []));
}

function leagueReadiness(state, player, fullHp = false) {
  const rest = leagueRemaining(state, player);
  return powerAgainst(state, player, rest, fullHp) / rowPower(rest);
}

function leagueEligible(state, player) {
  return gymsEnabled(state) && !player.league.champion && player.badges.length >= state.config.gyms.badgesForLeague;
}

function towardLeague(state, player, to) {
  if (!leagueEligible(state, player) || leagueReadiness(state, player, tripAtFullHp(state, LEAGUE.location)) < state.config.ai.league.readyRatio) return r('toward the League', 0);
  const blocks = rocketBlocks(state);
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
    default: return 0;
  }
}
