// GameState: a plain, JSON-serializable object owned by the engine.
// The UI only reads it and sends actions through turnEngine.dispatch().
import { CONFIG } from '../config.js';
import { CHARACTERS_BY_ID } from '../data/characters.js';
import { BOARD_TOPOLOGIES, getLocation, isLocationEnabled, topologyOf } from '../data/locations.js';
import { getSpecies } from '../data/pokemon.js';
import { createRng } from './rng.js';
import { giveMoves, rollKnownMoves, usesCombatMoves } from './combatMoves.js';
import { log } from './log.js';
import { emptyQuestStats, refillQuests, setupQuests } from './questEngine.js';
import { QUESTS, QUESTS_BY_ID } from '../data/quests.js';
import { emptyRocketStats, setupRocket } from './rocketEngine.js';
import { emptyGymStats, emptyLeagueState } from './gymEngine.js';
import { emptyEndgame, hallOfFame } from './endgameEngine.js';
import { emptyCaptureStats } from './captureEngine.js';
import { P1_OFF, PHASE2_RULES, rulesProblem, validateRules } from '../rules.js';
import { emptyGrowthStats } from './growthEngine.js';
import { migrateTopology } from './topologyEngine.js';
import { emptyOakStats } from './oakEngine.js';
import { setupHunts } from './huntEngine.js';
import { setupTrials, usesTrials } from './questBookEngine.js';
import { setupRumours } from './rumourEngine.js';
import { setupAchievements } from './achievementEngine.js';
import { setupStones } from './lootEngine.js';

export const SCHEMA_VERSION = 16;

// Why a save can't be loaded: 'corrupt' (not a readable game save) or 'newer'
// (written by a newer version of the game: a later schema, or rule switches
// this version can't play). The table keeps such saves instead of overwriting
// them (src/ui/saveSlot.js).
export class SaveError extends Error {
  constructor(reason, message, details = {}) {
    super(message);
    this.name = 'SaveError';
    this.reason = reason;
    Object.assign(this, details);
  }
}

export function createGame({ seed, players, config = CONFIG }) {
  const cfg = structuredClone(config);
  validateRules(cfg);
  validateSetup(players, cfg);
  const setupPlayers = players.map((p) => ({
    character: p.character,
    controller: p.controller ?? 'human',
    aiArchetype: p.aiArchetype ?? cfg.ai.defaultArchetype,
  }));

  const state = {
    schemaVersion: SCHEMA_VERSION,
    seed: String(seed),
    setup: { seed: String(seed), players: setupPlayers },
    config: cfg,
    rng: createRng(seed),
    // evolved: uids this turn; gym / League Challenge: max 1 of each per turn
    turn: { round: 1, playerIndex: 0, actionsRemaining: cfg.actionsPerTurn, evolved: [], gymChallenged: false, leagueChallenged: false },
    phase: 'turn', // turn | encounter | event | shop | loot | league (intermission) | challenge (B33-3 intermission) | over
    encounter: null,
    pendingEvent: null,
    shop: null, // { location, questSwaps } while a player is inside a Poké Stop
    questRng: null, // separate stream for mission shuffles / destinations
    questDeck: null, // { draw: [questId], discard: [questId] }
    rocketRng: null, // separate stream for Rocket week-start rolls / plot deck
    rocket: null, // { deck, active: { plotId, location, step, spawnedRound, loot, record } | null, pendingLoot, plots }
    players: [],
    nextUid: 1,
    log: [],
    history: [], // every dispatched action, in order — enough to replay the game
    debug: { forcedRolls: [] },
    dice: { queue: [] }, // physical dice entered by the players (enterDice), consumed per CONFIG.dice.mode
    endgame: emptyEndgame(), // { status: playing | finalWeek | over, finalWeek, champions, winners, reason, decidedBy, hallOfFame }
  };
  // Growth games (rules.evolution 'growth'): a Growth award waiting for the
  // player's pick after a battle (growthEngine). Phase 2 games don't have it.
  if (cfg.rules.evolution === 'growth') state.growthChoice = null;
  // Oak's Box games (rules.oakBox, DQ-95): a catch with a full team waits for
  // „Do drużyny” / „Wyślij do Oaka” (oakBox.js). Older games don't have it.
  if (cfg.rules.oakBox) state.boxChoice = null;
  // Professor Oak's Research Jobs (rules.oakJobs, Macro 01): the job being put
  // together (oakJob → oakJobPick …) waits like Oak's Box choice.
  if (cfg.rules.oakJobs) state.oakJobDraft = null;
  // Playtest 004 (rules.leadPick, DQ-107): a challenge waiting for its lead pick.
  if (cfg.rules.leadPick) state.battlePrep = null;
  // Build 3.3 B33-3 (rules.gymChallenge / leagueChallenge 'v2'): the gym chain or
  // League v2 attempt in progress — { kind, gymId?, tier?, stage, total, startedRound }.
  if (cfg.rules.gymChallenge === 'v2' || cfg.rules.leagueChallenge === 'v2') state.challenge = null;
  // Build 3.3 E3: every battle's id (encounter.seq) — a quest credits a battle once.
  if (cfg.rules.questBook === 'v2') state.battleSeq = 0;
  // One Kanto day 14.10 (rules.trading): a trade being agreed — { a, b, place, pick, agree }
  if (cfg.rules.trading === 'v1') state.trade = null;
  // One Kanto day 14.10 (rules.pvp): a friendly duel — { a, b, place, stage, pick, hp, next, attacks }
  if (cfg.rules.pvp === 'v1') state.pvp = null;
  state.players = setupPlayers.map((p) => createPlayer(state, p));

  log(state, 'system', `New game · seed ${state.seed} · ${state.players.map((p) => `${p.name} (${p.controller === 'ai' ? `AI ${p.aiArchetype}` : 'human'})`).join(', ')}`);
  setupQuests(state);
  setupRocket(state);
  setupHunts(state); // Build 3.3 E4 (rules.hunts)
  setupTrials(state); // Build 3.3 E5 (rules.gymTrials)
  setupRumours(state); // PLAYTEST_006 C5 (rules.rumours, DEV pilot)
  setupAchievements(state); // One Kanto day 14.10 (rules.achievements)
  setupStones(state); // EREV (rules.stoneSources, a measurement)
  log(state, 'turn', `=== Week 1 === ${state.players[0].name}'s turn at ${getLocation(state.players[0].location).name}`);
  return state;
}

function validateSetup(players, cfg) {
  if (!Array.isArray(players) || players.length < cfg.players.min || players.length > cfg.players.max) {
    throw new Error(`Player count must be ${cfg.players.min}-${cfg.players.max}`);
  }
  const seen = new Set();
  for (const p of players) {
    if (!CHARACTERS_BY_ID[p.character]) throw new Error(`Unknown character: ${p.character}`);
    if (seen.has(p.character)) throw new Error(`Character used twice: ${p.character}`);
    seen.add(p.character);
    if (p.controller && !['human', 'ai'].includes(p.controller)) throw new Error(`Unknown controller: ${p.controller}`);
    if (p.aiArchetype && !cfg.ai.archetypes[p.aiArchetype]) throw new Error(`Unknown AI archetype: ${p.aiArchetype}`);
  }
  if (!BOARD_TOPOLOGIES.includes(topologyOf(cfg))) throw new Error(`Unknown board topology: ${cfg.map.topology}`);
  if (!isLocationEnabled(cfg.startLocation, cfg)) throw new Error(`Start location disabled: ${cfg.startLocation}`);
  for (const p of players) if (!isLocationEnabled(startLocationOf(p.character, cfg), cfg)) throw new Error(`Start location disabled: ${startLocationOf(p.character, cfg)}`);
}

// Where a character begins (Build 3.3 A1, rules.starts 'character'): its own
// start; every older game: CONFIG.startLocation for everyone.
export function startLocationOf(characterId, cfg) {
  return cfg.rules.starts === 'character' ? CHARACTERS_BY_ID[characterId]?.start ?? cfg.startLocation : cfg.startLocation;
}

function createPlayer(state, setup) {
  const cfg = state.config;
  const character = CHARACTERS_BY_ID[setup.character];
  const starter = createPokemonInstance(state, character.starter);
  if (usesCombatMoves(cfg)) starter.moves = rollKnownMoves(starter.species, 'starter', starter.uid); // its family's first Special
  const start = startLocationOf(character.id, cfg);
  return {
    id: character.id,
    name: character.name,
    color: character.color,
    controller: setup.controller,
    aiArchetype: setup.aiArchetype,
    location: start,
    previousLocation: null,
    money: cfg.startingMoney,
    pokeballs: cfg.startingPokeballs,
    items: { superball: 0, potion: 0, revive: 0 },
    stars: 0, // shared Evolution Stars pool (Phase 2 games; stays 0 in Growth games)
    stats: { starsEarned: 0, starsSpent: 0, evolutions: 0, quests: emptyQuestStats(), rocket: emptyRocketStats(), gyms: emptyGymStats(), capture: emptyCaptureStats(), ...(cfg.rules.evolution === 'growth' ? { growth: emptyGrowthStats() } : {}), ...(cfg.rules.oakJobs || cfg.rules.oakKit ? { oak: emptyOakStats() } : {}) },
    badges: [], // gym ids, in the order earned
    league: emptyLeagueState(), // { ribbon, champion, championRound }
    quests: [], // active missions: { questId, progress, acquiredRound, destination?, visited?, places? }
    capabilities: { ...cfg.travel.startingCapabilities },
    team: [starter],
    reserve: [],
    pokedex: { seen: [starter.species], caught: [starter.species], evolved: [] },
    visited: [start],
    exploreCounts: {},
    // rules.vigilance (DQ-93): how wary the Pokémon of one place are after this
    // player's catches there (captureEngine.vigilanceSteps).
    ...(cfg.rules.vigilance ? { vigilance: { location: null, steps: 0 } } : {}),
    // Macro 01 (oakEngine.js): Pokémon away on a Research Job, the emergency kit.
    ...(cfg.rules.oakJobs ? { oakJob: null } : {}),
    ...(cfg.rules.oakKit ? { oakKitUsed: false } : {}),
    // Macro 02 M02-1 (rules.localPools 'v2', localPoolEngine.js): the signature
    // guarantee's count per place, the places where a signature was met, and
    // where each species was seen in the wild (Pokédex hints).
    ...(cfg.rules.localPools === 'v2' ? { signature: { explores: {}, seen: [] }, seenAt: {} } : {}),
    // Macro 02 M02-2 (rules.fatigue, fatigueEngine.js): this player's
    // exploration fatigue per place ({ [place]: count }, no zeros).
    ...(cfg.rules.fatigue ? { fatigue: {} } : {}),
    // Build 3.3 correction C1 (rules.growthCredits, growthEngine.creditKey): the gym /
    // League opponents whose Growth this player already received — once each.
    ...(cfg.rules.growthCredits ? { growthCredits: [] } : {}),
    // Build 3.3 E3 (rules.questBook 'v2', questBookEngine.js): the quest book and its records.
    ...(cfg.rules.questBook === 'v2' ? { questBook: { active: [], keyItems: [], ...(usesTrials(cfg) ? { trials: [] } : {}) }, questRecords: { occ: {}, byQuest: {} } } : {}),
    // Build 3.3 E5 (rules.gymTrials 'pilot'): the gyms whose trial this player knows / passed.
    ...(usesTrials(cfg) ? { knownTrials: [], trialsDone: [] } : {}),
  };
}

export function createPokemonInstance(state, speciesId) {
  const species = getSpecies(speciesId);
  const pokemon = { uid: `pk${state.nextUid++}`, species: species.id, hp: species.hp, maxHp: species.hp };
  // Growth games: the Pokémon's own progress toward its evolution edge. It
  // belongs to this instance — kept in the reserve, reset by evolving.
  if (state.config.rules.evolution === 'growth') pokemon.growth = 0;
  giveMoves(state, pokemon, 'wild'); // Combat MVP: what THIS Pokémon knows — decided now, by its uid (never re-rolled)
  return pokemon;
}

export function currentPlayer(state) {
  return state.players[state.turn.playerIndex];
}

// The lead is the first team Pokémon that has not fainted.
export function getLead(player) {
  return player.team.find((p) => p.hp > 0) ?? null;
}

export function hasHealthyPokemon(player) {
  return getLead(player) !== null;
}

export function canBeHealed(pokemon, config, allowRevive = config.rest.canReviveFainted) {
  return pokemon.hp < pokemon.maxHp && (pokemon.hp > 0 || allowRevive);
}

// Returns the HP actually restored.
export function heal(pokemon, amount, allowRevive) {
  if (pokemon.hp === 0 && !allowRevive) return 0;
  const before = pokemon.hp;
  pokemon.hp = Math.min(pokemon.maxHp, pokemon.hp + amount);
  return pokemon.hp - before;
}

export function markSeen(player, speciesId) {
  if (!player.pokedex.seen.includes(speciesId)) player.pokedex.seen.push(speciesId);
}

export function addCaughtPokemon(state, player, pokemon) {
  const toTeam = player.team.length < state.config.maxTeamSize;
  (toTeam ? player.team : player.reserve).push(pokemon);
  markSeen(player, pokemon.species);
  if (!player.pokedex.caught.includes(pokemon.species)) player.pokedex.caught.push(pokemon.species);
  return toTeam ? 'team' : 'reserve';
}

export function pokemonLabel(pokemon) {
  const s = getSpecies(pokemon.species);
  return `${s.name} ❤${pokemon.hp}/${pokemon.maxHp}`;
}

export function serialize(state) {
  return JSON.stringify(state);
}

// `{ topology: 'keep' }` (tests and tools only): leave a pre-merge game on its
// old graph, to prove the old rules still play exactly as their own engine did.
export function deserialize(json, { topology = 'migrate' } = {}) {
  let state;
  try {
    state = typeof json === 'string' ? JSON.parse(json) : json;
  } catch (err) {
    throw new SaveError('corrupt', `Not a saved game: ${err.message}`);
  }
  if (!state || typeof state !== 'object' || !Number.isInteger(state.schemaVersion) || state.schemaVersion < 1) {
    throw new SaveError('corrupt', 'Not a saved game: no save schema');
  }
  if (state.schemaVersion > SCHEMA_VERSION) {
    throw new SaveError('newer', `Saved by a newer version of the game (save schema ${state.schemaVersion}; this version reads up to ${SCHEMA_VERSION})`, { schema: state.schemaVersion });
  }
  if (state.schemaVersion === 1) migrateV1(state);
  if (state.schemaVersion === 2) migrateV2(state);
  if (state.schemaVersion === 3) migrateV3(state);
  if (state.schemaVersion === 4) migrateV4(state);
  if (state.schemaVersion === 5) migrateV5(state);
  if (state.schemaVersion === 6) migrateV6(state);
  if (state.schemaVersion === 7) migrateV7(state);
  if (state.schemaVersion === 8) migrateV8(state);
  if (state.schemaVersion === 9) migrateV9(state);
  if (state.schemaVersion === 10) migrateV10(state);
  if (state.schemaVersion === 11) migrateV11(state);
  if (state.schemaVersion === 12) migrateV12(state);
  if (state.schemaVersion === 13) migrateV13(state);
  if (state.schemaVersion === 14) migrateV14(state);
  if (state.schemaVersion === 15) migrateV15(state);
  if (state.schemaVersion !== SCHEMA_VERSION) {
    throw new SaveError('corrupt', `Unsupported save schema ${state.schemaVersion} (expected ${SCHEMA_VERSION})`, { schema: state.schemaVersion });
  }
  // A switch added by a later 3A slice is missing from saves made before it:
  // those games were played without that rule, i.e. with its Phase 2 value.
  const rules = (state.config.rules ??= {});
  for (const [key, value] of Object.entries(PHASE2_RULES)) if (!Object.hasOwn(rules, key)) rules[key] = value;
  const problem = rulesProblem(rules);
  if (problem) throw new SaveError('newer', `Saved by a newer version of the game: ${problem}`, { schema: state.schemaVersion });
  if (!BOARD_TOPOLOGIES.includes(topologyOf(state.config))) throw new SaveError('newer', `Saved by a newer version of the game: board topology ${state.config.map?.topology}`, { schema: state.schemaVersion });
  if (topology !== 'keep') migrateTopology(state);
  // C4 (saveCompaction.js): log entries left out of a compacted save — a count, nothing else.
  if (state.logBase !== undefined && !(Number.isInteger(state.logBase) && state.logBase >= 0)) delete state.logBase;
  return state;
}

// v1 had no travel requirements: every canonical edge was open. Old saves keep
// those rules (all capabilities on) so their recorded history still replays.
function migrateV1(state) {
  const all = Object.fromEntries(Object.keys(CONFIG.travel.startingCapabilities).map((k) => [k, true]));
  state.config.travel = { startingCapabilities: { ...all } };
  for (const p of state.players) p.capabilities = { ...all };
  state.schemaVersion = 2;
}

// v2 had no Poké Stops or items. Old saves gain them (new options only, so their
// history still replays) but keep their own rest rule.
function migrateV2(state) {
  state.config.pokeStop = { ...structuredClone(CONFIG.pokeStop), ...state.config.pokeStop };
  state.config.items ??= structuredClone(CONFIG.items);
  state.config.economy ??= structuredClone(CONFIG.economy);
  for (const p of state.players) p.items ??= { superball: 0, potion: 0, revive: 0 };
  state.shop ??= null;
  state.schemaVersion = 3;
}

// v3 kept an (always 0) xp per Pokémon. v4 replaces it with a player star pool.
function migrateV3(state) {
  state.config.evolution = structuredClone(CONFIG.evolution);
  const strip = (mons) => mons.forEach((m) => delete m.xp);
  for (const p of state.players) {
    strip(p.team);
    strip(p.reserve);
    p.stars ??= 0;
    p.stats ??= { starsEarned: 0, starsSpent: 0, evolutions: 0 };
  }
  if (state.encounter?.pokemon) strip([state.encounter.pokemon]);
  if (state.encounter?.trainer) strip(state.encounter.trainer.pokemonTeam);
  if (state.shop) state.shop.evolved ??= [];
  state.schemaVersion = 4;
}

// v4 had no missions. Old saves get the mission deck and two cards per player
// from now on (the quest stream is separate, so their dice are untouched).
function migrateV4(state) {
  state.config.quests = structuredClone(CONFIG.quests);
  for (const p of state.players) {
    p.quests = [];
    p.stats.quests = emptyQuestStats();
  }
  if (state.shop) state.shop.questSwaps ??= 0;
  if (state.encounter) state.encounter.playerFainted ??= false;
  setupQuests(state);
  state.schemaVersion = 5;
}

// v5 → v6: mission scopes renamed destination → travel, the deck changed
// (cards removed / added). Drop unknown cards, add new ones to the bottom of the
// deck, rename stats, top hands back up to 2.
function migrateV5(state) {
  state.config.quests = { ...structuredClone(CONFIG.quests), ...state.config.quests, rewardValue: structuredClone(CONFIG.quests.rewardValue) };
  const known = (id) => Boolean(QUESTS_BY_ID[id]);
  const inPlay = new Set();
  for (const p of state.players) {
    p.quests = p.quests.filter((q) => known(q.questId));
    for (const q of p.quests) inPlay.add(q.questId);
    const s = p.stats.quests;
    s.acquiredTravel = s.acquiredTravel ?? s.acquiredDestination ?? 0;
    s.completedTravel = s.completedTravel ?? s.completedDestination ?? 0;
    delete s.acquiredDestination;
    delete s.completedDestination;
  }
  const deck = state.questDeck;
  deck.draw = deck.draw.filter(known);
  deck.discard = deck.discard.filter(known);
  for (const id of [...deck.draw, ...deck.discard]) inPlay.add(id);
  deck.draw.push(...QUESTS.map((q) => q.id).filter((id) => !inPlay.has(id)));
  state.schemaVersion = 6;
  for (const p of state.players) refillQuests(state, p);
}

// v6 → v7: Poké Stops are 5 hubs with a full heal; evolution happens during the
// turn (one stage per Pokémon per turn) instead of inside a Poké Stop. The hub
// list is map data, so old histories with visits to removed stops won't replay.
function migrateV6(state) {
  state.config.pokeStop = structuredClone(CONFIG.pokeStop);
  state.config.evolution = structuredClone(CONFIG.evolution);
  state.turn.evolved ??= [];
  if (state.shop) delete state.shop.evolved;
  state.schemaVersion = 7;
}

// v7 had no Team Rocket. Like missions in v4 → v5, old saves get the plot deck from
// now on; Rocket rolls use their own stream, so the saved dice are untouched.
function migrateV7(state) {
  state.config.rocket = structuredClone(CONFIG.rocket);
  state.config.ai.rocket = structuredClone(CONFIG.ai.rocket);
  for (const p of state.players) p.stats.rocket ??= emptyRocketStats();
  setupRocket(state);
  state.schemaVersion = 8;
}

// v8 had no gyms or League. Old saves get them from now on: no badges, no
// ribbon. Indigo Plateau's Poké Stop is map data.
function migrateV8(state) {
  state.config.gyms = structuredClone(CONFIG.gyms);
  state.config.league = structuredClone(CONFIG.league);
  state.config.ai.gym = structuredClone(CONFIG.ai.gym);
  state.config.ai.league = structuredClone(CONFIG.ai.league);
  state.turn.gymChallenged ??= false;
  state.turn.leagueChallenged ??= false;
  for (const p of state.players) {
    p.badges ??= [];
    p.league ??= emptyLeagueState();
    p.stats.gyms ??= emptyGymStats();
  }
  state.schemaVersion = 9;
}

// v9 had no win condition (the UI game went on after a Champion). The first
// Champion week decides: still running → final week; already over → the game
// is over with that week's Champions as winners.
function migrateV9(state) {
  state.config.winCondition = structuredClone(CONFIG.winCondition);
  delete state.config.simulation.endOnChampion;
  state.endgame = emptyEndgame();
  const crowned = state.players.filter((p) => p.league?.champion);
  if (crowned.length) {
    const week = Math.min(...crowned.map((p) => p.league.championRound));
    const champions = crowned.filter((p) => p.league.championRound === week).map((p) => p.id);
    Object.assign(state.endgame, { finalWeek: week, champions });
    if (state.turn.round > week) {
      Object.assign(state.endgame, { status: 'over', reason: 'champion', winners: [...champions], hallOfFame: hallOfFame(state) });
      state.phase = 'over';
      state.encounter = null;
    } else {
      state.endgame.status = 'finalWeek';
    }
  }
  state.schemaVersion = 10;
}

// v10 had no capture retry and no dice modes. Old saves keep the rule they were
// played under (a failed throw flees: 'harsh') and digital dice, so their
// histories replay exactly.
function migrateV10(state) {
  const fled = state.config.capture.failedCaptureFlees !== false;
  delete state.config.capture.failedCaptureFlees;
  state.config.capture.retry = fled ? 'harsh' : 'escapeDice';
  state.config.capture.escapeDice = structuredClone(CONFIG.capture.escapeDice);
  state.config.dice = { mode: 'digital' };
  state.dice = { queue: [] };
  for (const p of state.players) p.stats.capture ??= emptyCaptureStats();
  state.schemaVersion = 11;
}

// v11 (an interim phase-1a build) threw with the classic d6 rule. Old saves keep
// it ('classic') so their histories replay exactly; they get the Catch Dice
// config for reference and the fuller capture stats (counted from now on).
function migrateV11(state) {
  const cap = state.config.capture;
  cap.system = 'classic';
  for (const key of ['catchDice', 'catchDieByRarity', 'hpSteps', 'maxRerolls']) cap[key] = structuredClone(CONFIG.capture[key]);
  state.config.items.superball.catchSteps = CONFIG.items.superball.catchSteps;
  for (const p of state.players) p.stats.capture = emptyCaptureStats();
  state.schemaVersion = 12;
}

// v12 is the Phase 2 game. Phase 3 changes its rules behind switches
// (src/rules.js); a v12 save gets every switch at its Phase 2 value — the
// 'phase2' ruleset — so the game goes on exactly as it was played and its
// history replays exactly. Shared Evolution Stars are never converted into
// per-Pokémon Growth (DQ-86). Only the config changes.
function migrateV12(state) {
  state.config.rules = { ...PHASE2_RULES };
  state.schemaVersion = 13;
}

// v13 (Phase 3A-0) could only play the star model: a v13 save is a star game
// and stays one (no Growth is added, Stars stay authoritative). v14 brings
// per-Pokémon Growth for games created with rules.evolution 'growth'.
function migrateV13(state) {
  state.schemaVersion = 14;
}

// v15 brings Gameplay P1 (DQ-89…95) behind seven switches. A v14 save — a
// Phase 2 game or the family's Build 2 game — gets every one of them at its
// old value: the game goes on exactly as it was played (Poké Stop with the
// heal, Rest +2, items instead of the attack, Growth after a faint, no
// selling, the reserve, no wary Pokémon) and its history replays exactly.
function migrateV14(state) {
  state.config.rules = { ...state.config.rules, ...P1_OFF };
  state.schemaVersion = 15;
}

// v16 is the family board (DQ-96): three pairs of places merged. Every save
// before it was played on the old graph ('kanto46'); deserialize then moves
// it to the board through topologyEngine.migrateTopology (the one boundary).
// The rule switches stay exactly as they were.
function migrateV15(state) {
  state.config.map = { ...state.config.map, topology: 'kanto46' };
  state.schemaVersion = 16;
}
