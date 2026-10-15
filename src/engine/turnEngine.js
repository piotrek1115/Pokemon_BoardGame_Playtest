// Turn engine: the only way to change a game. Humans (UI) and the AI both call
// dispatch(); it rejects anything not in getLegalActions() without touching
// state, so the AI and the UI can never bypass the rules.
//
// Phases:
//   turn       spend actions: move / explore / rest (cost 1), setLead / endTurn (free)
//   encounter  resolve a wild or trainer encounter: fight / throwBall / run (free;
//              the Explore action that started it already paid the cost —
//              ACCEPTED v0.1, DQ-03)
//   event      pick one of the pending event's choices
//   shop       inside a Poké Stop (the visit cost 1 action — with a full heal
//              in Phase 2 / Build 2 games, without one in Gameplay P1 games):
//              buy / sell (P1) / swapQuest (once per visit) / leaveShop, all free
//   loot       after losing to Team Rocket, Meowth wants an item: giveLoot
//   league     League intermission after beating the Elite Four: useItem /
//              setLead (free), then continueLeague → Champion Lance
//   challenge  Build 3.3 B33-3 (rules.gymChallenge / leagueChallenge 'v2'): the
//              intermission between the battles of a gym chain or League v2 —
//              useItem / setLead (free), then continueChallenge (the next
//              battle) or quitChallenge (the attempt ends; state.challenge)
//   over       the game has ended (endgameEngine.js): no actions at all
//
// Gyms (gymEngine.js): challengeGym costs 1 action in a gym city, max 1 per
// turn; challengeLeague costs 1 action at Indigo Plateau with enough badges,
// max 1 per turn. Both start encounters (kinds 'gym' / 'league'): fight only.
//
// Playtest 004 (rules.leadPick, DQ-107): before a battle against a trainer, a
// leader, Team Rocket or a League stage, the player picks who starts it — free
// (leadPickEngine.js): a challenge first opens state.battlePrep (chooseLead
// starts it, cancelBattle calls it off — nothing spent); a battle that found
// the player starts with encounter.leadPick (chooseLead).
//
// Team Rocket (rocketEngine.js): challengeRocket costs 1 action at a plot;
// plots can also start a Rocket battle on Explore / on entering (no extra
// cost), close a place or an edge, or stop catching. Rocket battles are
// encounters of kind 'rocket': fight only.
//
// Free actions in the turn phase: setLead, useItem (Potion / Revive),
// evolve (Phase 2: spends Evolution Stars, one stage per Pokémon per turn;
// Growth games: on the Pokémon's own Growth, one evolution per player turn),
// endTurn.
//
// Growth games (growthEngine.js): when a battle ends with a Growth that two or
// more Pokémon could take, assignGrowth {target} comes first, whatever the
// phase; the turn doesn't pass until it is settled.
//
// Gameplay P1 (schema 15, each rule behind its own switch, DQ-89…95):
//   pokeStop 'v2'     pokeStopHeal (1 action, full team heal) and pokeStopShop
//                     (1 action, the shop) instead of visitPokeStop
//   selling           sell {item} in the shop (free, half the price)
//   rest 'v2'         Rest heals 1
//   healingItems 'v2' Super Potion; useItem in battle is free (no attack lost,
//                     no strike back), once per Pokémon per battle
//   oakBox            after a catch with a full team: boxKeep {target} /
//                     boxSend first (like assignGrowth); in a Poké Stop city,
//                     free: boxIn {target, swap?} / boxOut {target}
//   vigilance         catches make the place's Pokémon warier (captureEngine)
//   growthFainted     EXPERIMENT (off in every ruleset): no Growth for an
//                     opponent the Pokémon fainted against (DQ-92 SOFT)
//
// Phase 3B Macro 01 (each rule behind its own switch):
//   pokeStops 'v2'/'v3'  more Poké Stops (data/pokeStops.js)
//   oakJobs           in Pallet Town: oakJob {job} (free) opens the pick, then
//                     oakJobPick {target} … (free; the last pick starts the job
//                     for 1 action) or oakJobCancel — pending like boxChoice
//   oakKit            in Pallet Town: oakKit (free, once per game)
//   catchDice 'v2'    the green Catch Die (captureEngine)
//   explorePools 'v2' a MIXED place: explore without a biome (encounterEngine)
//
// Phase 3B Macro 02 M02-2 (rules.fatigue, fatigueEngine.js): an Explore reads
// the player's fatigue here first, its battle (or the event it found) carries
// that level, and the count rises by 1 when the Explore has been dispatched;
// every count falls at the week start (advanceTurn).
//
// A move must follow a canonical edge AND meet that edge's travel requirements
// (travelEngine.js) and not be closed by a Team Rocket plot. Debug
// meta-actions (debugForceRolls, debugSetCapability, debugRocketPlot,
// debugToggleBadge) are never
// offered as legal actions but are recorded so replays stay exact.
import { exploreMode, getLocation, locationBiomes } from '../data/locations.js';
import { CAPABILITIES } from '../data/travelConnections.js';
import { getSpecies } from '../data/pokemon.js';
import { EVENTS_BY_ID } from '../data/events.js';
import { log } from './log.js';
import { canBeHealed, currentPlayer, getLead, hasHealthyPokemon, heal } from './gameState.js';
import { appearWild, endEncounter, explore, exploreMixed } from './encounterEngine.js';
import { canSwitchTo, fightRound, moveOf, moveReady, freeBattleHealing, healedThisBattle, opponentStrikes, retreat, retreatOptions, switchPokemon, tempoBattleHealing, useBattleItem } from './combatEngine.js';
import { moveAvailable } from './combatMoves.js';
import { settleEntries } from './initiativeEngine.js';
import { legalMoves, worldBlocks } from './graphEngine.js';
import { throwBall, vigilanceOnMove } from './captureEngine.js';
import { chooseEventOption, legalEventChoices } from './eventEngine.js';
import { getEdgeMeta, isBlocked, missingRequirements, networkAdjacent } from './travelEngine.js';
import { BALL_IDS, ITEMS } from '../data/items.js';
import { healingItems, itemCount, itemTargets, useItem } from './itemEngine.js';
import {
  buyableItems, buyItem, canHealAtPokeStop, hasPokeStop, healAtPokeStop, leaveShop, openShop, pokeStopV2, sellItem, sellableItems, visitPokeStop,
} from './pokeStopEngine.js';
import { boxChoiceOptions, boxIn, boxOut, boxSwapOptions, keepCaught, sendCaughtToOak } from './boxEngine.js';
import { cancelJob, draftOptions, oakActions, oakTurnStart, openJob, pickForJob, takeKit } from './oakEngine.js';
import { evolvablePokemon, evolve, evolveBlocker, evolveOptions, evolutionTarget } from './evolutionEngine.js';
import { growthEdges } from './growthEngine.js';
import { assignGrowth, growthOptions } from './growthEngine.js';
import { canSwapQuests, questSwapUsedThisTurn, recordQuestEvent, swapQuest } from './questEngine.js';
import { QUESTS_BY_ID } from '../data/quests.js';
import { ROCKET_PLOTS_BY_ID } from '../data/rocketPlots.js';
import {
  activePlot, canChallengeRocket, catchBlocked, debugSetPlot, exploreFindsRocket, giveLoot, plotCard,
  rocketOnArrive, rocketWeekStart, startRocketBattle,
} from './rocketEngine.js';
import { GYMS_BY_ID } from '../data/gyms.js';
import {
  canChallengeGym, canChallengeLeague, continueChallenge, continueLeague, debugToggleBadge, quitChallenge, gymChallengeBlocker, leagueChallengeBlocker,
  recordIntermissionItem, startGymBattle, startLeague,
} from './gymEngine.js';
import { endOfWeekEndsGame, gameOver } from './endgameEngine.js';
import { cancelBattlePrep, leadPickDue, leadPickOptions, openBattlePrep, pickLead } from './leadPickEngine.js';
import { noteLocalExplore } from './localPoolEngine.js';
import { fatigueWeekStart, placeFatigue, raiseFatigue, stampBattle } from './fatigueEngine.js';
import { abandonQuest, bookActions, bookEvent, claimQuest, startQuestChallenge, startQuestEncounter, takeQuest } from './questBookEngine.js';
import { rumourEvent } from './rumourEngine.js';
import { agreeToTrade, cancelTrade, openTrade, pickForTrade, tradeActions } from './tradeEngine.js';
import { acceptDuel, cancelDuel, challengeToDuel, duelAttack, pickForDuel, pvpActions, yieldDuel } from './pvpEngine.js';
import { canFish, fish } from './fishingEngine.js';
import { noteRest, restBonus } from './traitEngine.js';
import { checkAchievements } from './achievementEngine.js';
import { exploreFindsHunt, huntTurnStart, startHuntEncounter } from './huntEngine.js';
import { stoneFind } from './lootEngine.js';

export function getLegalActions(state) {
  if (gameOver(state)) return [];
  const player = currentPlayer(state);
  const cfg = state.config;

  // Growth games: after a battle, the player picks who gets a Growth before
  // anything else happens (growthEngine; only pending with 2+ candidates).
  if (state.growthChoice) return growthOptions(state).map((p) => ({ type: 'assignGrowth', target: p.uid }));
  // Gameplay P1: a catch with a full team — to the team or to Oak's Box first.
  if (state.boxChoice) return boxChoiceOptions(state);
  // Macro 01: a Research Job being put together — pick its Pokémon (or cancel) first.
  if (state.oakJobDraft) return draftOptions(state);
  // One Kanto day 14.10 (rules.trading): a trade being agreed — only its picks, agreements or cancel
  if (state.trade) return tradeActions(state);
  // One Kanto day 14.10 (rules.pvp): a friendly duel — only its answer, picks, attacks (or giving up)
  if (state.pvp) return pvpActions(state);
  // Playtest 004 (DQ-107): who starts the battle — before a challenge, or as a
  // battle's first step.
  if (state.battlePrep || state.encounter?.leadPick) return leadPickOptions(state);

  if (state.phase === 'event') {
    return legalEventChoices(state).map((choice) => ({ type: 'chooseEvent', choice }));
  }

  if (state.phase === 'loot') {
    return state.rocket.pendingLoot.options.map((item) => ({ type: 'giveLoot', item }));
  }

  // Build 3.3 B33-3: the intermission of a gym chain / League v2 — items and the
  // lead (free), then the next battle or leave (the attempt ends).
  if (state.phase === 'challenge') {
    const actions = [];
    for (const item of healingItems(cfg)) {
      for (const p of itemTargets(player, item)) actions.push({ type: 'useItem', item, target: p.uid });
    }
    player.team.forEach((p, i) => {
      if (i > 0 && p.hp > 0) actions.push({ type: 'setLead', target: p.uid });
    });
    if (hasHealthyPokemon(player)) actions.push({ type: 'continueChallenge' });
    actions.push({ type: 'quitChallenge' });
    return actions;
  }

  if (state.phase === 'league') {
    const actions = [];
    for (const item of healingItems(cfg)) {
      for (const p of itemTargets(player, item)) actions.push({ type: 'useItem', item, target: p.uid });
    }
    player.team.forEach((p, i) => {
      if (i > 0 && p.hp > 0) actions.push({ type: 'setLead', target: p.uid });
    });
    actions.push({ type: 'continueLeague' });
    return actions;
  }

  if (state.phase === 'shop') {
    return [
      ...(canSwapQuests(state, player) ? player.quests.map((q) => ({ type: 'swapQuest', target: q.questId })) : []),
      ...buyableItems(state).map((item) => ({ type: 'buy', item })),
      ...sellableItems(state).map((item) => ({ type: 'sell', item })),
      { type: 'leaveShop' },
    ];
  }

  if (state.phase === 'encounter') {
    const actions = [];
    if (hasHealthyPokemon(player)) actions.push({ type: 'fight' });
    if (moveReady(cfg, getLead(player), state.encounter.signatureUsed)) actions.push({ type: 'signature' }); // bonus 2: the line's move, once per battle
    for (const slot of ['special', 'powerful']) if (moveAvailable(state, getLead(player), slot)) actions.push({ type: 'fight', slot }); // Combat MVP: a move the lead knows, once per battle
    for (const p of player.team) if (canSwitchTo(state, player, p.uid)) actions.push({ type: 'switchPokemon', target: p.uid });
    if (state.encounter.kind === 'wild') {
      if (!catchBlocked(state, player)) {
        for (const ball of BALL_IDS) if (itemCount(player, ball) > 0) actions.push({ type: 'throwBall', ball });
      }
      actions.push({ type: 'run' });
    }
    // Phase 3A-2: Potion / Revive as the exchange in every battle; retreat from trainers.
    // Gameplay P1: healing is free in battle, once per Pokémon per battle.
    if (freeBattleHealing(cfg)) {
      for (const item of healingItems(cfg)) {
        for (const p of itemTargets(player, item)) if (!healedThisBattle(state, p.uid)) actions.push({ type: 'useItem', item, target: p.uid });
      }
    } else if (tempoBattleHealing(cfg) && hasHealthyPokemon(player)) {
      // Build 3.3 (DQ-113): the exchange, the opponent answers, no per-Pokémon limit
      for (const item of healingItems(cfg)) {
        for (const p of itemTargets(player, item)) actions.push({ type: 'useItem', item, target: p.uid });
      }
    } else if (cfg.rules.battleItems && hasHealthyPokemon(player)) {
      for (const item of ['potion', 'revive']) {
        for (const p of itemTargets(player, item)) actions.push({ type: 'useItem', item, target: p.uid });
      }
    }
    actions.push(...retreatOptions(state, player));
    return actions;
  }

  const actions = [];
  if (state.turn.actionsRemaining > 0) {
    for (const to of legalMoves(state, player)) actions.push({ type: 'move', to }); // the one effective graph (graphEngine)
    if (hasHealthyPokemon(player)) {
      // Macro 01 (rules.explorePools 'v2'): a mixed place has one Explore, no biome.
      if (exploreMode(player.location, cfg) === 'mixed') actions.push({ type: 'explore' });
      else for (const biome of locationBiomes(player.location, cfg)) actions.push({ type: 'explore', biome });
    }
    if (canFish(state, player)) actions.push({ type: 'fish' }); // bonus 14.10 (rules.fishing): „Łów” with the Old Rod
    for (const p of player.team) {
      if (canBeHealed(p, cfg)) actions.push({ type: 'rest', target: p.uid });
    }
    if (hasPokeStop(player.location, cfg)) {
      if (!pokeStopV2(state)) actions.push({ type: 'visitPokeStop' });
      else {
        if (canHealAtPokeStop(player)) actions.push({ type: 'pokeStopHeal' });
        actions.push({ type: 'pokeStopShop' });
      }
    }
    if (canChallengeRocket(state, player)) actions.push({ type: 'challengeRocket' });
    if (canChallengeGym(state, player)) actions.push({ type: 'challengeGym' });
    if (canChallengeLeague(state, player)) actions.push({ type: 'challengeLeague' });
  }
  actions.push(...oakActions(state, player)); // Macro 01: Professor Oak in Pallet Town
  actions.push(...bookActions(state, player)); // Build 3.3 E3: the quest book (take / claim / abandon / quest challenge)
  for (const item of healingItems(cfg)) {
    for (const p of itemTargets(player, item)) actions.push({ type: 'useItem', item, target: p.uid });
  }
  for (const p of evolvablePokemon(state)) {
    // bonus 14.10 (rules.eeveeBranch): a branching species — one evolve per form its stone allows
    if (growthEdges(p, cfg.rules).length > 1) for (const to of evolveOptions(state, player, p)) actions.push({ type: 'evolve', target: p.uid, to });
    else actions.push({ type: 'evolve', target: p.uid });
  }
  player.team.forEach((p, i) => {
    if (i > 0 && p.hp > 0) actions.push({ type: 'setLead', target: p.uid });
  });
  actions.push(...boxSwapOptions(state, player)); // Gameplay P1: free in a Poké Stop city
  actions.push(...tradeActions(state)); // One Kanto day 14.10: a trade with another human player here (free)
  actions.push(...pvpActions(state)); // One Kanto day 14.10: a friendly duel with another human player here (free)
  actions.push({ type: 'endTurn' });
  return actions;
}

// Rest heals 2 in Phase 2 / Build 2 games (rules.rest 'v1'); 1 in Gameplay P1
// games ('v2', DQ-90) — Build 3.2 included; 2 again in Build 3.3 games ('v3').
export function restHeal(config) {
  if (config.rules.rest === 'v3') return config.rest.healV3; // Build 3.3: +2 again (one chosen Pokémon, 1 action)
  return config.rules.rest === 'v2' ? config.rest.healV2 : config.rest.heal;
}

export function actionKey(a) {
  const key = [a.type, a.to ?? '', a.biome ?? '', a.target ?? '', a.choice ?? '', a.item ?? '', a.ball ?? '', a.swap ?? '', a.job ?? '', a.quest ?? '', a.occ ?? ''].join('|');
  const k = a.with || a.by ? `${key}|${a.with ?? ''}|${a.by ?? ''}` : key; // One Kanto day 14.10: who trades / duels
  return a.slot ? `${k}|slot:${a.slot}` : k; // Combat MVP: which move (older actions keep their keys)
}

export function isLegal(state, action) {
  const key = actionKey(action);
  return getLegalActions(state).some((a) => actionKey(a) === key);
}

// Strip anything that is not part of the action itself (keeps history clean).
function normalizeAction(a) {
  const out = { type: a.type };
  for (const k of ['to', 'biome', 'target', 'choice', 'item', 'ball', 'swap', 'job', 'values', 'capability', 'value', 'plot', 'gym', 'quest', 'occ', 'with', 'by', 'slot']) if (a[k] !== undefined) out[k] = a[k];
  if (out.type === 'throwBall' && !out.ball) out.ball = 'pokeball'; // pre-Milestone-B histories
  return out;
}

// meta.ai: { score, reasons, tiebreak } from aiEngine — logged and stored in history.
export function dispatch(state, rawAction, meta = {}) {
  const action = normalizeAction(rawAction);
  const player = currentPlayer(state);
  if (gameOver(state)) return { ok: false, error: 'The game is over' };

  if (action.type === 'debugForceRolls') {
    const values = action.values ?? [];
    if (!values.every((v) => Number.isInteger(v) && v >= 1 && v <= 6)) return { ok: false, error: 'Forced rolls must be integers 1-6' };
    state.debug.forcedRolls.push(...values);
    state.history.push({ player: player.id, action });
    log(state, 'warn', `Debug: next d6 roll(s) forced to ${values.join(', ')}`);
    return { ok: true };
  }

  // Physical dice the players rolled, in the order the app asked for them
  // (numbers 1–6, or 'flee' / 'stay' for an Escape Die). Recorded in history,
  // so a game with physical dice replays exactly.
  if (action.type === 'enterDice') {
    const values = action.values ?? [];
    const SYMBOLS = { ball: '◓', blank: '–', flee: '🌬️', stay: '○' };
    if (!values.length || !values.every((v) => (Number.isInteger(v) && v >= 1 && v <= 6) || (typeof v === 'string' && Object.hasOwn(SYMBOLS, v)))) {
      return { ok: false, error: 'Dice must be 1–6, ball / blank for a Catch Die, or flee / stay for an Escape Die' };
    }
    state.dice.queue.push(...values);
    state.history.push({ player: player.id, action });
    log(state, 'action', `🎲 Physical dice: ${values.map((v) => SYMBOLS[v] ?? v).join(', ')}`);
    return { ok: true };
  }

  if (action.type === 'debugSetCapability') {
    if (!CAPABILITIES[action.capability] || typeof action.value !== 'boolean') {
      return { ok: false, error: `Unknown capability "${action.capability}" or non-boolean value` };
    }
    player.capabilities[action.capability] = action.value;
    state.history.push({ player: player.id, action });
    log(state, 'warn', `Debug: ${player.name} ${CAPABILITIES[action.capability].name} ${action.value ? 'ON' : 'OFF'}`);
    return { ok: true };
  }

  if (action.type === 'debugRocketPlot') {
    if (!state.config.rocket?.enabled) return { ok: false, error: 'Team Rocket is off in this game' };
    if (action.plot && !ROCKET_PLOTS_BY_ID[action.plot]) return { ok: false, error: `Unknown Rocket plot "${action.plot}"` };
    if (state.phase !== 'turn') return { ok: false, error: 'Finish the current encounter first' };
    state.history.push({ player: player.id, action });
    log(state, 'warn', `Debug: ${action.plot ? `reveal Rocket plot "${ROCKET_PLOTS_BY_ID[action.plot].title}"` : 'remove the Rocket plot'}`);
    debugSetPlot(state, action.plot);
    return { ok: true };
  }

  if (action.type === 'debugToggleBadge') {
    if (!GYMS_BY_ID[action.gym]) return { ok: false, error: `Unknown gym "${action.gym}"` };
    if (state.phase !== 'turn') return { ok: false, error: 'Finish the current encounter first' };
    state.history.push({ player: player.id, action });
    log(state, 'warn', `Debug: ${player.name} ${player.badges.includes(action.gym) ? 'loses' : 'gets'} the ${GYMS_BY_ID[action.gym].badge}`);
    debugToggleBadge(state, action.gym);
    return { ok: true };
  }

  if (!isLegal(state, action)) {
    return { ok: false, error: explainIllegal(state, action) };
  }

  const entry = { player: player.id, action };
  if (meta.ai) entry.ai = meta.ai;
  state.history.push(entry);
  if (meta.ai) log(state, 'ai', formatAiDecision(state, player, action, meta.ai), meta.ai);

  HANDLERS[action.type](state, action, player);
  // Build 3.3 ⚡ First Strike: settle the battle's new entries inside this dispatch
  settleEntries(state, opponentStrikes);

  if (state.phase === 'turn' && state.turn.actionsRemaining <= 0 && !state.growthChoice && !state.boxChoice && !state.oakJobDraft && !state.trade && !state.pvp) advanceTurn(state);
  checkAchievements(state); // One Kanto day 14.10 (rules.achievements): earned once, from the state
  // Build 3.3 E3: a battle that began in this dispatch gets its id (a quest credits it once)
  if (state.battleSeq != null && state.encounter && state.encounter.seq == null) state.encounter.seq = ++state.battleSeq;
  return { ok: true };
}

// A challenge starts its battle (now, or after the lead pick — DQ-107).
const CHALLENGES = {
  gym(state) {
    state.turn.actionsRemaining -= 1;
    startGymBattle(state);
  },
  league(state) {
    state.turn.actionsRemaining -= 1;
    startLeague(state);
  },
  rocket(state) {
    state.turn.actionsRemaining -= 1;
    startRocketBattle(state, 'challenge');
  },
};

const HANDLERS = {
  move(state, action, player) {
    const from = player.location;
    player.previousLocation = from;
    player.location = action.to;
    if (!player.visited.includes(action.to)) player.visited.push(action.to);
    vigilanceOnMove(state, player); // Gameplay P1: a new place, unwary Pokémon
    state.turn.actionsRemaining -= 1; // every edge costs 1 action (travelConnections.js contract)
    const via = getEdgeMeta(from, action.to, state.config).traversal;
    log(state, 'action', `${player.name} moves ${getLocation(from).name} → ${getLocation(action.to).name}${via === 'land' ? '' : ` (${via})`}`);
    recordQuestEvent(state, player, { kind: 'arrive', location: action.to });
    rocketOnArrive(state, player);
  },
  explore(state, action, player) {
    state.turn.actionsRemaining -= 1;
    player.exploreCounts[player.location] = (player.exploreCounts[player.location] ?? 0) + 1;
    // Macro 01: no biome = the whole mixed place (every biome counts for missions).
    const biomes = action.biome === undefined ? locationBiomes(player.location, state.config) : null;
    log(state, 'action', `${player.name} explores ${getLocation(player.location).name} (${biomes ? `everywhere: ${biomes.join(', ')}` : action.biome})`);
    recordQuestEvent(state, player, { kind: 'explore', location: player.location, biome: action.biome, ...(biomes ? { biomes } : {}) });
    const place = player.location;
    const fatigue = placeFatigue(player, place, state.config); // M02-2: read first
    if (fatigue) log(state, 'encounter', `The Pokémon of ${getLocation(place).name} know ${player.name} by now (${fatigue === 1 ? 'tired' : 'exhausted'} place): no Growth from battles here.`, { fatigue: { place, level: fatigue } });
    if (exploreFindsRocket(state, player)) startRocketBattle(state, 'explore');
    else if (exploreFindsHunt(state, player)) startHuntEncounter(state, player); // Build 3.3 E4
    else if (biomes) exploreMixed(state, biomes, { fatigue });
    else explore(state, action.biome, { fatigue });
    stampBattle(state, fatigue); // the wild Pokémon / random trainer this Explore found (never Team Rocket)
    if (fatigue && state.pendingEvent) state.pendingEvent.fatigue = fatigue; // …or the battle of its event
    stoneFind(state, player, place, fatigue); // EREV measurement (rules.stoneSources): a stone place's find, its own stream
    noteLocalExplore(player, place, state.config); // M02-1: the signature guarantee's count (localPoolEngine)
    raiseFatigue(player, place, state.config); // M02-2: then +1, whatever it found
  },
  challengeRocket(state) {
    if (leadPickDue(state)) openBattlePrep(state, 'rocket');
    else CHALLENGES.rocket(state);
  },
  giveLoot(state, action) {
    giveLoot(state, action.item);
  },
  challengeGym(state) {
    if (leadPickDue(state)) openBattlePrep(state, 'gym');
    else CHALLENGES.gym(state);
  },
  challengeLeague(state) {
    if (leadPickDue(state)) openBattlePrep(state, 'league');
    else CHALLENGES.league(state);
  },
  chooseLead(state, action) {
    const challenge = pickLead(state, action.target);
    if (challenge) CHALLENGES[challenge](state);
  },
  cancelBattle(state) {
    cancelBattlePrep(state);
  },
  continueLeague(state) {
    continueLeague(state);
  },
  continueChallenge(state) {
    continueChallenge(state);
  },
  takeQuest(state, action) {
    takeQuest(state, action.quest);
  },
  abandonQuest(state, action) {
    abandonQuest(state, action.occ);
  },
  claimQuest(state, action) {
    claimQuest(state, action.occ);
  },
  questChallenge(state, action) {
    startQuestChallenge(state, action.occ);
  },
  tradeOpen(state, action) {
    openTrade(state, action.with);
  },
  tradePick(state, action) {
    pickForTrade(state, action.by, action.target);
  },
  tradeAgree(state, action) {
    agreeToTrade(state, action.by);
  },
  tradeCancel(state) {
    cancelTrade(state);
  },
  fish(state, action, player) {
    fish(state, player);
  },
  pvpChallenge(state, action) {
    challengeToDuel(state, action.with);
  },
  pvpAccept(state) {
    acceptDuel(state);
  },
  pvpCancel(state) {
    cancelDuel(state);
  },
  pvpPick(state, action) {
    pickForDuel(state, action.by, action.target);
  },
  pvpAttack(state, action) {
    duelAttack(state, action.by);
  },
  pvpMove(state, action) {
    duelAttack(state, action.by, true); // bonus 2: the attacker's signature move, once per duel
  },
  pvpYield(state, action) {
    yieldDuel(state, action.by);
  },
  questEncounter(state, action) {
    // PLAYTEST_006 C4: the expedition's wild Pokémon, tagged as the quest's encounter
    const meet = startQuestEncounter(state, action.occ);
    appearWild(state, meet.species, meet.biome);
    state.encounter.questEncounter = meet.tag;
  },
  quitChallenge(state) {
    quitChallenge(state);
  },
  rest(state, action, player) {
    const pokemon = player.team.find((p) => p.uid === action.target);
    state.turn.actionsRemaining -= 1;
    const healed = heal(pokemon, restHeal(state.config) + restBonus(state, player), state.config.rest.canReviveFainted); // bonus 2: Brock +1
    log(state, 'action', `${player.name} rests: ${getSpecies(pokemon.species).name} +${healed} HP (❤ ${pokemon.hp}/${pokemon.maxHp})`);
    noteRest(state, player);
  },
  setLead(state, action, player) {
    const i = player.team.findIndex((p) => p.uid === action.target);
    const [pokemon] = player.team.splice(i, 1);
    player.team.unshift(pokemon);
    log(state, 'action', `${player.name} puts ${getSpecies(pokemon.species).name} in the lead`);
  },
  endTurn(state, action, player) {
    const unused = state.turn.actionsRemaining;
    state.turn.actionsRemaining = 0;
    log(state, 'action', `${player.name} ends the turn${unused ? ` (${unused} action${unused > 1 ? 's' : ''} unused)` : ''}`);
  },
  visitPokeStop(state, action, player) {
    state.turn.actionsRemaining -= 1;
    visitPokeStop(state);
  },
  pokeStopHeal(state) {
    state.turn.actionsRemaining -= 1;
    healAtPokeStop(state);
  },
  pokeStopShop(state) {
    state.turn.actionsRemaining -= 1;
    openShop(state);
  },
  buy(state, action) {
    buyItem(state, action.item);
  },
  sell(state, action) {
    sellItem(state, action.item);
  },
  boxKeep(state, action) {
    keepCaught(state, action.target);
  },
  boxSend(state) {
    sendCaughtToOak(state);
  },
  boxIn(state, action) {
    boxIn(state, action.target, action.swap);
  },
  boxOut(state, action) {
    boxOut(state, action.target);
  },
  oakJob(state, action) {
    openJob(state, action.job);
  },
  oakJobPick(state, action) {
    pickForJob(state, action.target);
  },
  oakJobCancel(state) {
    cancelJob(state);
  },
  oakKit(state) {
    takeKit(state);
  },
  evolve(state, action) {
    evolve(state, action.target, action.to ?? null); // bonus 14.10: `to` = the chosen form of a branching species
  },
  assignGrowth(state, action) {
    assignGrowth(state, action.target);
  },
  swapQuest(state, action, player) {
    swapQuest(state, player, action.target);
  },
  leaveShop(state) {
    leaveShop(state);
  },
  useItem(state, action, player) {
    if (state.phase === 'league' || state.phase === 'challenge') recordIntermissionItem(state, player, action.item);
    if (state.phase === 'encounter') useBattleItem(state, action.item, action.target);
    else useItem(state, action.item, action.target);
  },
  fight(state, action) {
    fightRound(state, null, action.slot ?? null); // Combat MVP: { slot: 'special' | 'powerful' }
  },
  signature(state, action, player) {
    fightRound(state, moveOf(getLead(player))); // bonus 2 (rules.signatureMoves): instead of Atakuj
  },
  switchPokemon(state, action) {
    switchPokemon(state, action.target);
  },
  throwBall(state, action) {
    throwBall(state, action.ball);
  },
  run(state, action, player) {
    if (state.encounter.kind === 'trainer') {
      retreat(state, action.item);
      return;
    }
    const wild = getSpecies(state.encounter.pokemon.species);
    log(state, 'encounter', `${player.name} runs away from the wild ${wild.name}.`);
    endEncounter(state, 'ran');
  },
  chooseEvent(state, action) {
    chooseEventOption(state, action.choice);
  },
};

export function advanceTurn(state) {
  // Wrapping to a new week: the final week (or a Time Limit) ends the game here,
  // before the week counter moves and before any week-start system runs.
  if ((state.turn.playerIndex + 1) % state.players.length === 0 && endOfWeekEndsGame(state)) return;
  state.turn.playerIndex = (state.turn.playerIndex + 1) % state.players.length;
  if (state.turn.playerIndex === 0) state.turn.round += 1;
  state.turn.actionsRemaining = state.config.actionsPerTurn;
  state.turn.evolved = [];
  state.turn.gymChallenged = false;
  state.turn.leagueChallenged = false;
  delete state.turn.questSwaps; // Gameplay P1: the mission swap limit is per turn
  delete state.turn.questChallenged; // Build 3.3 E3: one quest challenge per quest per own turn
  delete state.turn.questEncountered; // PLAYTEST_006 C4: one expedition encounter per quest per own turn
  delete state.turn.traded; // One Kanto day 14.10: one trade per turn of the player who proposes it
  delete state.turn.dueled; // … and one duel challenge per turn
  const next = currentPlayer(state);
  const week = state.turn.playerIndex === 0 ? `=== Week ${state.turn.round} === ` : '';
  log(state, 'turn', `${week}${next.name}'s turn at ${getLocation(next.location).name}`);
  if (state.turn.playerIndex === 0) {
    fatigueWeekStart(state); // M02-2: every count falls
    rocketWeekStart(state);
  }
  oakTurnStart(state, next); // Macro 01: a Research Job counts the owner's turns
  bookEvent(state, next, { kind: 'turnStart' }); // Build 3.3 E3: a quest's „wait” counts own turns
  rumourEvent(state, next, { kind: 'turnStart', location: next.location }); // PLAYTEST_006 C5: a rumour where you stand
  huntTurnStart(state, next); // Build 3.3 E4: a hunt starts / counts its clock
}

export function describeAction(state, action) {
  const player = currentPlayer(state);
  const mon = (uid) => getSpecies(player.team.find((p) => p.uid === uid).species).name;
  switch (action.type) {
    case 'move': return `MOVE -> ${getLocation(action.to).name}`;
    case 'explore': return action.biome ? `EXPLORE -> ${action.biome}` : 'EXPLORE (the whole place)';
    case 'rest': return `REST -> ${mon(action.target)}`;
    case 'setLead': return `SET LEAD -> ${mon(action.target)}`;
    case 'chooseLead': return `START WITH -> ${mon(action.target)}`;
    case 'cancelBattle': return 'CALL OFF THE CHALLENGE';
    case 'endTurn': return 'END TURN';
    case 'visitPokeStop': return 'VISIT POKÉ STOP';
    case 'pokeStopHeal': return 'POKÉ STOP: HEAL THE TEAM';
    case 'pokeStopShop': return 'POKÉ STOP: SHOP';
    case 'buy': return `BUY -> ${ITEMS[action.item].name}`;
    case 'sell': return `SELL -> ${ITEMS[action.item].name}`;
    case 'boxKeep': return `KEEP THE CATCH, BOX -> ${mon(action.target)}`;
    case 'boxSend': return 'SEND THE CATCH TO PROFESSOR OAK';
    case 'boxIn': {
      const inMon = getSpecies(player.reserve.find((p) => p.uid === action.target).species).name;
      return `FROM THE BOX -> ${inMon}${action.swap ? ` (for ${mon(action.swap)})` : ''}`;
    }
    case 'boxOut': return `TO THE BOX -> ${mon(action.target)}`;
    case 'oakJob': return `PROFESSOR OAK: RESEARCH JOB ${action.job}`;
    case 'oakJobPick': {
      const m = [...player.team, ...player.reserve].find((p) => p.uid === action.target);
      return `RESEARCH JOB -> ${getSpecies(m.species).name}`;
    }
    case 'oakJobCancel': return 'NO RESEARCH JOB';
    case 'oakKit': return "TAKE PROFESSOR OAK'S EMERGENCY KIT";
    case 'evolve': {
      const from = getSpecies(player.team.find((p) => p.uid === action.target).species);
      return `EVOLVE -> ${from.name} into ${getSpecies(action.to ?? evolutionTarget(from).id).name}`;
    }
    case 'leaveShop': return 'LEAVE POKÉ STOP';
    case 'swapQuest': return `SWAP MISSION -> ${QUESTS_BY_ID[action.target].title}`;
    case 'useItem': return `USE ${ITEMS[action.item].name.toUpperCase()} -> ${mon(action.target)}`;
    case 'fight': return 'FIGHT';
    case 'switchPokemon': return `SWITCH -> ${mon(action.target)}`;
    case 'assignGrowth': return `GROWTH -> ${mon(action.target)}`;
    case 'throwBall': return `THROW ${ITEMS[action.ball].name.toUpperCase()}`;
    case 'run': return state.encounter?.kind === 'trainer' ? `RETREAT${action.item ? ` (leaves a ${ITEMS[action.item].name})` : ''}` : 'RUN';
    case 'chooseEvent': return `CHOOSE -> ${EVENTS_BY_ID[state.pendingEvent.id].choices[action.choice].label}`;
    case 'challengeRocket': return `CHALLENGE ROCKET -> ${plotCard(activePlot(state)).title}`;
    case 'giveLoot': return `GIVE MEOWTH -> ${ITEMS[action.item].name}`;
    case 'challengeGym': return `GYM CHALLENGE -> ${getLocation(player.location).name}`;
    case 'challengeLeague': return 'LEAGUE CHALLENGE';
    case 'continueLeague': return 'FACE CHAMPION LANCE';
    case 'continueChallenge': return 'NEXT BATTLE OF THE CHALLENGE';
    case 'quitChallenge': return 'LEAVE THE CHALLENGE';
    case 'takeQuest': return `TAKE QUEST ${action.quest}`;
    case 'abandonQuest': return `GIVE UP ${action.occ}`;
    case 'claimQuest': return `CLAIM ${action.occ}`;
    case 'questChallenge': return `QUEST CHALLENGE ${action.occ}`;
    case 'questEncounter': return `QUEST ENCOUNTER ${action.occ}`;
    case 'tradeOpen': return `TRADE WITH ${action.with}`;
    case 'tradePick': return `TRADE: ${action.by} OFFERS ${action.target}`;
    case 'tradeAgree': return `TRADE: ${action.by} AGREES`;
    case 'tradeCancel': return 'TRADE CALLED OFF';
    case 'fish': return 'FISH (the Old Rod)';
    case 'signature': return 'SIGNATURE MOVE';
    case 'pvpMove': return `DUEL: ${action.by} USES THE SIGNATURE MOVE`;
    case 'pvpChallenge': return `DUEL CHALLENGE TO ${action.with}`;
    case 'pvpAccept': return `DUEL: ${action.by} ACCEPTS`;
    case 'pvpCancel': return 'NO DUEL';
    case 'pvpPick': return `DUEL: ${action.by} PICKS ${action.target}`;
    case 'pvpAttack': return `DUEL: ${action.by} ATTACKS`;
    case 'pvpYield': return `DUEL: ${action.by} GIVES UP`;
    default: return action.type.toUpperCase();
  }
}

function formatAiDecision(state, player, action, ai) {
  const reasons = ai.compacted ? 'not kept in the save (C4)' : ai.reasons.length
    ? ai.reasons.map((r) => `${r.value >= 0 ? '+' : ''}${round1(r.value)} ${r.label}`).join(', ')
    : 'no preference';
  const tie = ai.tiebreak ? ` (tie-break among ${ai.tiebreak})` : '';
  return `${player.name} selected ${describeAction(state, action)}\nreason: ${reasons}\nscore = ${round1(ai.score)}${tie}`;
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

function explainIllegal(state, action) {
  const player = currentPlayer(state);
  if (action.type === 'move' && state.phase === 'turn' && state.turn.actionsRemaining > 0) {
    let target;
    try {
      target = getLocation(action.to).name;
    } catch {
      return `Unknown location "${action.to}"`;
    }
    const from = getLocation(player.location).name;
    const blocks = worldBlocks(state); // the one effective graph's closures
    // The game's travel network (3A-5): a shortcut edge is a connection too.
    const adjacent = networkAdjacent(player.location, action.to, state.config);
    if (adjacent && isBlocked(blocks, player.location, action.to)) {
      return `${from} → ${target} is closed by Team Rocket ("${plotCard(activePlot(state)).title}")`;
    }
    if (adjacent) {
      const missing = missingRequirements(player, player.location, action.to, state.config).map((c) => CAPABILITIES[c].name.toLowerCase());
      return `${from} → ${target} is a ${getEdgeMeta(player.location, action.to, state.config).traversal} route and needs ${missing.join(' + ')}`;
    }
    return `${from} → ${target} is not a connection on this game's Kanto travel network`;
  }
  if (state.growthChoice && action.type !== 'assignGrowth') return 'Choose who gets the Growth first';
  if (state.battlePrep && !['chooseLead', 'cancelBattle'].includes(action.type)) return 'Pick who starts the battle first (or call it off)';
  if (state.encounter?.leadPick && action.type !== 'chooseLead') return 'Pick who starts the battle first';
  if (action.type === 'chooseLead') return state.battlePrep || state.encounter?.leadPick ? 'Only a healthy team Pokémon can start the battle' : 'No battle is about to start';
  if (action.type === 'cancelBattle') return 'Only a challenge you are getting ready for can be called off';
  if (state.oakJobDraft && !['oakJobPick', 'oakJobCancel'].includes(action.type)) return 'Pick the Pokémon for the Research Job first (or cancel it)';
  if (['oakJob', 'oakJobPick', 'oakJobCancel'].includes(action.type)) return !state.config.rules.oakJobs ? 'This game has no Research Jobs' : action.type === 'oakJobPick' ? "That Pokémon can't go: it has fainted, is not yours, is already picked, or the team needs a healthy Pokémon" : `A Research Job needs Professor Oak's lab in ${getLocation(state.config.oak.location).name}, a free action, no job already running and enough healthy Pokémon (the team keeps one)`;
  if (action.type === 'oakKit') return !state.config.rules.oakKit ? 'This game has no emergency kit' : `Professor Oak's emergency kit: in ${getLocation(state.config.oak.location).name}, once per game, with no ball and too little money for one`;
  if (state.boxChoice && !['boxKeep', 'boxSend'].includes(action.type)) return 'The team is full: keep the new Pokémon (pick who goes to the Box) or send it to Professor Oak first';
  if (['boxIn', 'boxOut'].includes(action.type)) return state.config.rules.oakBox ? "Pokémon move between the team and Professor Oak's Box only in a city with a Poké Stop, during your turn" : "This game has no Professor Oak's Box";
  if (action.type === 'sell') return state.phase === 'shop' ? "Can't sell that: not yours, not for sale, or your last ball" : 'Selling happens in the Poké Stop shop';
  if (action.type === 'useItem' && state.phase === 'encounter' && freeBattleHealing(state.config) && healedThisBattle(state, action.target)) return 'This Pokémon was already healed in this battle (one healing item per Pokémon per battle)';
  if (action.type === 'assignGrowth') return state.growthChoice ? 'That Pokémon cannot take this Growth' : 'No Growth to hand out';
  if (state.phase !== 'turn' && ['move', 'explore', 'fish', 'rest', 'endTurn', 'setLead', 'visitPokeStop', 'pokeStopHeal', 'pokeStopShop', 'useItem', 'evolve', 'challengeRocket', 'challengeGym', 'challengeLeague'].includes(action.type)) {
    if (state.phase === 'loot') return 'Pick the item Meowth takes first';
    if (state.phase === 'league') return 'League intermission: use items, set your lead, then face Champion Lance';
    if (state.phase === 'challenge') return 'Challenge intermission: use items, set your lead, then the next battle (or leave)';
    return state.phase === 'shop' ? 'Leave the Poké Stop first' : `Finish the current ${state.phase} first`;
  }
  if (action.type === 'challengeGym') return `Can't challenge a gym: ${gymChallengeBlocker(state, player)}`;
  if (action.type === 'challengeLeague') return `Can't take the League Challenge: ${leagueChallengeBlocker(state, player)}`;
  if (action.type === 'throwBall' && ['gym', 'league'].includes(state.encounter?.kind)) return "Gym and League Pokémon can't be caught";
  if (action.type === 'challengeRocket') {
    if (!activePlot(state)) return 'There is no Team Rocket plot right now';
    if (!getLead(player)) return 'All Pokémon have fainted — heal before challenging Team Rocket';
    return `Team Rocket can't be challenged from ${getLocation(player.location).name}`;
  }
  if (action.type === 'throwBall' && state.encounter?.kind === 'rocket') return "Team Rocket's Pokémon can't be caught";
  if (action.type === 'throwBall' && state.encounter?.kind === 'wild' && catchBlocked(state, player)) return `No catching here: "${plotCard(activePlot(state)).title}"`;
  if (action.type === 'visitPokeStop') return pokeStopV2(state) ? 'This game has two Poké Stop actions: Leczenie (pokeStopHeal) and Sklep (pokeStopShop)' : `There is no Poké Stop in ${getLocation(player.location).name}`;
  if (action.type === 'pokeStopHeal') return !pokeStopV2(state) ? 'This game heals on visitPokeStop' : hasPokeStop(player.location, state.config) ? 'Nobody in the team needs healing' : `There is no Poké Stop in ${getLocation(player.location).name}`;
  if (action.type === 'pokeStopShop') return !pokeStopV2(state) ? 'This game shops on visitPokeStop' : `There is no Poké Stop in ${getLocation(player.location).name}`;
  if (action.type === 'buy') return `Can't buy ${ITEMS[action.item]?.name ?? action.item} here or can't afford it`;
  if (action.type === 'swapQuest') return state.phase !== 'shop' ? 'Missions can only be swapped inside a Poké Stop' : questSwapUsedThisTurn(state) ? 'Only one mission swap per turn' : 'Only one mission swap per Poké Stop visit';
  if (action.type === 'evolve') {
    const mon = player.team.find((p) => p.uid === action.target);
    return mon ? `${getSpecies(mon.species).name} can't evolve now: ${evolveBlocker(state, player, mon)}` : 'No such team Pokémon';
  }
  if (action.type === 'useItem') return `Can't use ${ITEMS[action.item]?.name ?? action.item} on that Pokémon right now`;
  if (action.type === 'rest' && player.team.find((p) => p.uid === action.target)?.hp === 0) return 'Resting cannot revive a fainted Pokémon — visit a Poké Stop or use a Revive';
  if (action.type === 'explore' && !getLead(player)) return 'All Pokémon have fainted — visit a Poké Stop or use a Revive before exploring';
  if (action.type === 'fish') return 'Fishing needs the Old Rod, a place with water, an action left and a healthy Pokémon'; // bonus 14.10
  return `Action "${action.type}" is not legal right now (phase: ${state.phase})`;
}
