// Build 3.3 E4 — rare hunts + personal clues (rules.hunts 'pilot', data/hunts.js).
//
// The clock (CONFIG.hunts.clock — DEC-30 OPEN: Piotr said „3 tury”, not „3 weeks”):
//   'ownTurns'   every player gets `length` own turns from the hunt's start;
//   'worldWeeks' it ends `length` weeks after the week it started;
//   'tableTurns' it ends after `length` turns of the table (anyone's) — with 4
//                players someone may get no turn at all (measured in the A/B).
// A hunt starts in a scheduled week (CONFIG.hunts.startWeeks) at the turn of a
// player drawn from its own stream (state.huntRng), so the three clocks differ.
// One hunt at a time; each hunt runs once a game; whoever catches it ends it.
// State: state.hunts { active, done: [{ id, result, by?, round }], pending }; a
// player's clues: player.clues [huntId…] (personal; another's clue reveals
// nothing). The guaranteed meeting with a clue happens once per player per hunt
// (player.huntsMet); afterwards it is the hunt die, like without a clue.
import { HUNTS } from '../data/hunts.js';
import { getSpecies } from '../data/pokemon.js';
import { pickVersion } from '../rules.js';
import { createRng, d6With, randomInt } from './rng.js';
import { log } from './log.js';
import { currentPlayer } from './gameState.js';
import { appearWild } from './encounterEngine.js';
import { setClueHook } from './questBookEngine.js';

export function usesHunts(config) {
  return Boolean(config.rules.hunts);
}

export function huntDefs(config) {
  return pickVersion(HUNTS, config.rules.hunts, 'hunts');
}

export const huntDef = (config, id) => huntDefs(config).find((h) => h.id === id) ?? null;

export function setupHunts(state) {
  if (!usesHunts(state.config)) return;
  state.huntRng = createRng(`${state.seed}:hunts`);
  state.hunts = { active: null, done: [], pending: null };
  for (const p of state.players) {
    p.clues = [];
    p.huntsMet = [];
  }
}

const cfgOf = (state) => state.config.hunts;

// May this player still meet the active hunt (its clock, for them)?
export function huntOpenFor(state, player) {
  const h = state.hunts?.active;
  if (!h) return false;
  const { clock, length } = cfgOf(state);
  if (clock === 'ownTurns') return (h.turnsSeen[player.id] ?? 0) <= length && (h.turnsSeen[player.id] ?? 0) > 0;
  if (clock === 'worldWeeks') return state.turn.round < h.startRound + length;
  return h.tableTurns <= length; // 'tableTurns'
}

// The OWN turns this player still has to act on the hunt — the current one included
// when it is theirs (for the table; null when none runs). EREV-04: a player whose first
// turn of the hunt has not begun yet has all `length` of them (it used to read length + 1).
export function huntTurnsLeft(state, player) {
  const h = state.hunts?.active;
  if (!h) return null;
  const { clock, length } = cfgOf(state);
  const seat = state.players.indexOf(player);
  const now = state.turn.playerIndex;
  const mine = seat === now;
  if (clock === 'ownTurns') {
    const seen = h.turnsSeen[player.id] ?? 0;
    return Math.max(0, length - seen + (mine && seen > 0 ? 1 : 0));
  }
  if (clock === 'worldWeeks') {
    const weeks = h.startRound + length - state.turn.round; // this week included
    return Math.max(0, weeks - (seat < now ? 1 : 0)); // this week's turn already gone
  }
  // 'tableTurns': the turns of the table still to come, this one included — whose are they?
  let own = 0;
  for (let k = 0; k <= length - h.tableTurns; k++) if ((now + k) % state.players.length === seat) own += 1;
  return own;
}

function nextHunt(state) {
  return huntDefs(state.config).find((d) => !state.hunts.done.some((x) => x.id === d.id) && state.hunts.active?.id !== d.id) ?? null;
}

// Every turn start (turnEngine.advanceTurn), and the first turn (createGame).
export function huntTurnStart(state, player) {
  if (!usesHunts(state.config)) return;
  const hs = state.hunts;
  const { startWeeks, length, clock } = cfgOf(state);
  if (state.turn.playerIndex === 0 && !hs.active && !hs.pending && startWeeks.includes(state.turn.round) && nextHunt(state)) {
    hs.pending = { week: state.turn.round, at: randomInt(state.huntRng, state.players.length) };
  }
  if (hs.pending && hs.pending.week === state.turn.round && hs.pending.at === state.turn.playerIndex && !hs.active) {
    const def = nextHunt(state);
    hs.pending = null;
    if (def) {
      hs.active = { id: def.id, species: def.species, place: def.place, startRound: state.turn.round, startIndex: state.turn.playerIndex, turnsSeen: {}, tableTurns: 0 };
      log(state, 'event', `🎯 A rare hunt begins: an exceptional ${getSpecies(def.species).name} has been seen around ${def.region.join(' / ')}!`, { hunt: { event: 'start', id: def.id, species: def.species } });
    }
  }
  const h = hs.active;
  if (!h) return;
  h.tableTurns += 1;
  h.turnsSeen[player.id] = (h.turnsSeen[player.id] ?? 0) + 1;
  const expired = clock === 'ownTurns'
    ? h.turnsSeen[player.id] > length && state.players.every((p) => (h.turnsSeen[p.id] ?? 0) >= length)
    : clock === 'worldWeeks' ? state.turn.round >= h.startRound + length : h.tableTurns > length;
  if (expired) endHunt(state, 'expired');
}

function endHunt(state, result, by = null) {
  const h = state.hunts.active;
  state.hunts.done.push({ id: h.id, result, ...(by ? { by } : {}), round: state.turn.round });
  state.hunts.active = null;
  log(state, 'event', result === 'caught' ? `🎯 The hunt is over: ${by} caught the exceptional ${getSpecies(h.species).name}!` : `🎯 The exceptional ${getSpecies(h.species).name} has gone — the hunt is over.`, { hunt: { event: result, id: h.id } });
}

// An Explore at the hunt's place: with a clue (and no meeting yet) a sure meeting;
// otherwise the hunt die — a 6 meets it. Called before the ordinary Explore.
export function exploreFindsHunt(state, player) {
  if (!usesHunts(state.config)) return false;
  const h = state.hunts.active;
  if (!h || h.place !== player.location || !huntOpenFor(state, player)) return false;
  if (player.clues.includes(h.id) && !player.huntsMet.includes(h.id)) return true;
  return d6With(state, 'huntRng', 'Hunt', (v) => (v >= cfgOf(state).noClueFace ? 'the exceptional Pokémon!' : 'not here now')) >= cfgOf(state).noClueFace;
}

export function startHuntEncounter(state, player) {
  const h = state.hunts.active;
  const species = getSpecies(h.species);
  const wild = appearWild(state, species, species.biomes[0]);
  wild.maxHp += cfgOf(state).hpBonus;
  wild.hp = wild.maxHp;
  wild.exceptional = true;
  wild.traits = ['firstStrike'];
  state.encounter.hunt = h.id;
  if (!player.huntsMet.includes(h.id)) player.huntsMet.push(h.id);
  log(state, 'encounter', `🎯 It is the exceptional ${species.name}! (+${cfgOf(state).hpBonus} HP, ⚡, harder to catch)`, { hunt: { event: 'met', id: h.id } });
}

// captureEngine: the hunted Pokémon was caught → the hunt ends for everyone.
export function huntCaught(state, player, enc) {
  if (enc?.hunt && state.hunts?.active?.id === enc.hunt) endHunt(state, 'caught', player.name);
}

// A clue (a quest reward): the active hunt, or the next one to come.
export function giveClue(state, player, source = 'quest') {
  if (!usesHunts(state.config)) {
    log(state, 'quest', `${player.name} hears a rumour (no hunts in this game).`);
    return null;
  }
  const target = state.hunts.active ?? nextHunt(state);
  if (!target) return null;
  if (!player.clues.includes(target.id)) player.clues.push(target.id);
  log(state, 'quest', `🔎 ${player.name} gets a clue about a rare Pokémon (${source}).`, { hunt: { event: 'clue', id: target.id, by: player.id } });
  return target.id;
}

// EREV-01: a clue helps this player only when a hunt is running or to come that they have
// no clue for and have not met yet (otherwise the quest pays its stated alternative).
export function clueUseful(state, player) {
  if (!usesHunts(state.config)) return false;
  const target = state.hunts.active ?? nextHunt(state);
  return Boolean(target) && !player.clues.includes(target.id) && !player.huntsMet.includes(target.id);
}

setClueHook((state, player) => giveClue(state, player, 'quest'), clueUseful);
