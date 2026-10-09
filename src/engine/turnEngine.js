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
//   shop       inside a Poké Stop (the visit cost 1 action, full heal): buy /
//              swapQuest (once per visit) / leaveShop, all free
//   loot       after losing to Team Rocket, Meowth wants an item: giveLoot
//   league     League intermission after beating the Elite Four: useItem /
//              setLead (free), then continueLeague → Champion Lance
//   over       the game has ended (endgameEngine.js): no actions at all
//
// Gyms (gymEngine.js): challengeGym costs 1 action in a gym city, max 1 per
// turn; challengeLeague costs 1 action at Indigo Plateau with enough badges,
// max 1 per turn. Both start encounters (kinds 'gym' / 'league'): fight only.
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
// A move must follow a canonical edge AND meet that edge's travel requirements
// (travelEngine.js) and not be closed by a Team Rocket plot. Debug
// meta-actions (debugForceRolls, debugSetCapability, debugRocketPlot,
// debugToggleBadge) are never
// offered as legal actions but are recorded so replays stay exact.
import { areAdjacent, getLocation } from '../data/locations.js';
import { CAPABILITIES } from '../data/travelConnections.js';
import { getSpecies } from '../data/pokemon.js';
import { EVENTS_BY_ID } from '../data/events.js';
import { log } from './log.js';
import { canBeHealed, currentPlayer, getLead, hasHealthyPokemon, heal } from './gameState.js';
import { endEncounter, explore } from './encounterEngine.js';
import { canSwitchTo, fightRound, retreat, retreatOptions, switchPokemon, useBattleItem } from './combatEngine.js';
import { throwBall } from './captureEngine.js';
import { chooseEventOption, legalEventChoices } from './eventEngine.js';
import { getEdgeMeta, isBlocked, missingRequirements, traversableNeighbors } from './travelEngine.js';
import { BALL_IDS, ITEMS } from '../data/items.js';
import { itemCount, itemTargets, useItem } from './itemEngine.js';
import { buyableItems, buyItem, hasPokeStop, leaveShop, visitPokeStop } from './pokeStopEngine.js';
import { evolvablePokemon, evolve, evolveBlocker, evolutionTarget } from './evolutionEngine.js';
import { assignGrowth, growthOptions } from './growthEngine.js';
import { canSwapQuests, recordQuestEvent, swapQuest } from './questEngine.js';
import { QUESTS_BY_ID } from '../data/quests.js';
import { ROCKET_PLOTS_BY_ID } from '../data/rocketPlots.js';
import {
  activePlot, canChallengeRocket, catchBlocked, debugSetPlot, exploreFindsRocket, giveLoot, plotCard,
  rocketBlocks, rocketOnArrive, rocketWeekStart, startRocketBattle,
} from './rocketEngine.js';
import { GYMS_BY_ID } from '../data/gyms.js';
import {
  canChallengeGym, canChallengeLeague, continueLeague, debugToggleBadge, gymChallengeBlocker, leagueChallengeBlocker,
  recordIntermissionItem, startGymBattle, startLeague,
} from './gymEngine.js';
import { endOfWeekEndsGame, gameOver } from './endgameEngine.js';

export function getLegalActions(state) {
  if (gameOver(state)) return [];
  const player = currentPlayer(state);
  const cfg = state.config;

  // Growth games: after a battle, the player picks who gets a Growth before
  // anything else happens (growthEngine; only pending with 2+ candidates).
  if (state.growthChoice) return growthOptions(state).map((p) => ({ type: 'assignGrowth', target: p.uid }));

  if (state.phase === 'event') {
    return legalEventChoices(state).map((choice) => ({ type: 'chooseEvent', choice }));
  }

  if (state.phase === 'loot') {
    return state.rocket.pendingLoot.options.map((item) => ({ type: 'giveLoot', item }));
  }

  if (state.phase === 'league') {
    const actions = [];
    for (const item of ['potion', 'revive']) {
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
      { type: 'leaveShop' },
    ];
  }

  if (state.phase === 'encounter') {
    const actions = [];
    if (hasHealthyPokemon(player)) actions.push({ type: 'fight' });
    for (const p of player.team) if (canSwitchTo(state, player, p.uid)) actions.push({ type: 'switchPokemon', target: p.uid });
    if (state.encounter.kind === 'wild') {
      if (!catchBlocked(state, player)) {
        for (const ball of BALL_IDS) if (itemCount(player, ball) > 0) actions.push({ type: 'throwBall', ball });
      }
      actions.push({ type: 'run' });
    }
    // Phase 3A-2: Potion / Revive as the exchange in every battle; retreat from trainers.
    if (cfg.rules.battleItems && hasHealthyPokemon(player)) {
      for (const item of ['potion', 'revive']) {
        for (const p of itemTargets(player, item)) actions.push({ type: 'useItem', item, target: p.uid });
      }
    }
    actions.push(...retreatOptions(state, player));
    return actions;
  }

  const actions = [];
  if (state.turn.actionsRemaining > 0) {
    for (const to of traversableNeighbors(player, cfg, rocketBlocks(state))) actions.push({ type: 'move', to });
    if (hasHealthyPokemon(player)) {
      for (const biome of getLocation(player.location).biomes) actions.push({ type: 'explore', biome });
    }
    for (const p of player.team) {
      if (canBeHealed(p, cfg)) actions.push({ type: 'rest', target: p.uid });
    }
    if (hasPokeStop(player.location)) actions.push({ type: 'visitPokeStop' });
    if (canChallengeRocket(state, player)) actions.push({ type: 'challengeRocket' });
    if (canChallengeGym(state, player)) actions.push({ type: 'challengeGym' });
    if (canChallengeLeague(state, player)) actions.push({ type: 'challengeLeague' });
  }
  for (const item of ['potion', 'revive']) {
    for (const p of itemTargets(player, item)) actions.push({ type: 'useItem', item, target: p.uid });
  }
  for (const p of evolvablePokemon(state)) actions.push({ type: 'evolve', target: p.uid });
  player.team.forEach((p, i) => {
    if (i > 0 && p.hp > 0) actions.push({ type: 'setLead', target: p.uid });
  });
  actions.push({ type: 'endTurn' });
  return actions;
}

export function actionKey(a) {
  return [a.type, a.to ?? '', a.biome ?? '', a.target ?? '', a.choice ?? '', a.item ?? '', a.ball ?? ''].join('|');
}

export function isLegal(state, action) {
  const key = actionKey(action);
  return getLegalActions(state).some((a) => actionKey(a) === key);
}

// Strip anything that is not part of the action itself (keeps history clean).
function normalizeAction(a) {
  const out = { type: a.type };
  for (const k of ['to', 'biome', 'target', 'choice', 'item', 'ball', 'values', 'capability', 'value', 'plot', 'gym']) if (a[k] !== undefined) out[k] = a[k];
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

  if (state.phase === 'turn' && state.turn.actionsRemaining <= 0 && !state.growthChoice) advanceTurn(state);
  return { ok: true };
}

const HANDLERS = {
  move(state, action, player) {
    const from = player.location;
    player.previousLocation = from;
    player.location = action.to;
    if (!player.visited.includes(action.to)) player.visited.push(action.to);
    state.turn.actionsRemaining -= 1;
    const via = getEdgeMeta(from, action.to).traversal;
    log(state, 'action', `${player.name} moves ${getLocation(from).name} → ${getLocation(action.to).name}${via === 'land' ? '' : ` (${via})`}`);
    recordQuestEvent(state, player, { kind: 'arrive', location: action.to });
    rocketOnArrive(state, player);
  },
  explore(state, action, player) {
    state.turn.actionsRemaining -= 1;
    player.exploreCounts[player.location] = (player.exploreCounts[player.location] ?? 0) + 1;
    log(state, 'action', `${player.name} explores ${getLocation(player.location).name} (${action.biome})`);
    recordQuestEvent(state, player, { kind: 'explore', location: player.location, biome: action.biome });
    if (exploreFindsRocket(state, player)) startRocketBattle(state, 'explore');
    else explore(state, action.biome);
  },
  challengeRocket(state) {
    state.turn.actionsRemaining -= 1;
    startRocketBattle(state, 'challenge');
  },
  giveLoot(state, action) {
    giveLoot(state, action.item);
  },
  challengeGym(state) {
    state.turn.actionsRemaining -= 1;
    startGymBattle(state);
  },
  challengeLeague(state) {
    state.turn.actionsRemaining -= 1;
    startLeague(state);
  },
  continueLeague(state) {
    continueLeague(state);
  },
  rest(state, action, player) {
    const pokemon = player.team.find((p) => p.uid === action.target);
    state.turn.actionsRemaining -= 1;
    const healed = heal(pokemon, state.config.rest.heal, state.config.rest.canReviveFainted);
    log(state, 'action', `${player.name} rests: ${getSpecies(pokemon.species).name} +${healed} HP (❤ ${pokemon.hp}/${pokemon.maxHp})`);
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
  buy(state, action) {
    buyItem(state, action.item);
  },
  evolve(state, action) {
    evolve(state, action.target);
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
    if (state.phase === 'league') recordIntermissionItem(state, player, action.item);
    if (state.phase === 'encounter') useBattleItem(state, action.item, action.target);
    else useItem(state, action.item, action.target);
  },
  fight(state) {
    fightRound(state);
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
  const next = currentPlayer(state);
  const week = state.turn.playerIndex === 0 ? `=== Week ${state.turn.round} === ` : '';
  log(state, 'turn', `${week}${next.name}'s turn at ${getLocation(next.location).name}`);
  if (state.turn.playerIndex === 0) rocketWeekStart(state);
}

export function describeAction(state, action) {
  const player = currentPlayer(state);
  const mon = (uid) => getSpecies(player.team.find((p) => p.uid === uid).species).name;
  switch (action.type) {
    case 'move': return `MOVE -> ${getLocation(action.to).name}`;
    case 'explore': return `EXPLORE -> ${action.biome}`;
    case 'rest': return `REST -> ${mon(action.target)}`;
    case 'setLead': return `SET LEAD -> ${mon(action.target)}`;
    case 'endTurn': return 'END TURN';
    case 'visitPokeStop': return 'VISIT POKÉ STOP';
    case 'buy': return `BUY -> ${ITEMS[action.item].name}`;
    case 'evolve': {
      const from = getSpecies(player.team.find((p) => p.uid === action.target).species);
      return `EVOLVE -> ${from.name} into ${evolutionTarget(from).name}`;
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
    default: return action.type.toUpperCase();
  }
}

function formatAiDecision(state, player, action, ai) {
  const reasons = ai.reasons.length
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
    const blocks = rocketBlocks(state);
    if (areAdjacent(player.location, action.to, state.config) && isBlocked(blocks, player.location, action.to)) {
      return `${from} → ${target} is closed by Team Rocket ("${plotCard(activePlot(state)).title}")`;
    }
    if (areAdjacent(player.location, action.to, state.config)) {
      const missing = missingRequirements(player, player.location, action.to).map((c) => CAPABILITIES[c].name.toLowerCase());
      return `${from} → ${target} is a ${getEdgeMeta(player.location, action.to).traversal} route and needs ${missing.join(' + ')}`;
    }
    return `${from} → ${target} is not a connection on the Kanto graph`;
  }
  if (state.growthChoice && action.type !== 'assignGrowth') return 'Choose who gets the Growth first';
  if (action.type === 'assignGrowth') return state.growthChoice ? 'That Pokémon cannot take this Growth' : 'No Growth to hand out';
  if (state.phase !== 'turn' && ['move', 'explore', 'rest', 'endTurn', 'setLead', 'visitPokeStop', 'useItem', 'evolve', 'challengeRocket', 'challengeGym', 'challengeLeague'].includes(action.type)) {
    if (state.phase === 'loot') return 'Pick the item Meowth takes first';
    if (state.phase === 'league') return 'League intermission: use items, set your lead, then face Champion Lance';
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
  if (action.type === 'visitPokeStop') return `There is no Poké Stop in ${getLocation(player.location).name}`;
  if (action.type === 'buy') return `Can't buy ${ITEMS[action.item]?.name ?? action.item} here or can't afford it`;
  if (action.type === 'swapQuest') return state.phase === 'shop' ? 'Only one mission swap per Poké Stop visit' : 'Missions can only be swapped inside a Poké Stop';
  if (action.type === 'evolve') {
    const mon = player.team.find((p) => p.uid === action.target);
    return mon ? `${getSpecies(mon.species).name} can't evolve now: ${evolveBlocker(state, player, mon)}` : 'No such team Pokémon';
  }
  if (action.type === 'useItem') return `Can't use ${ITEMS[action.item]?.name ?? action.item} on that Pokémon right now`;
  if (action.type === 'rest' && player.team.find((p) => p.uid === action.target)?.hp === 0) return 'Resting cannot revive a fainted Pokémon — visit a Poké Stop or use a Revive';
  if (action.type === 'explore' && !getLead(player)) return 'All Pokémon have fainted — visit a Poké Stop or use a Revive before exploring';
  return `Action "${action.type}" is not legal right now (phase: ${state.phase})`;
}
