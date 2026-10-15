// PLAYTEST_006 C5 — Kanto Rumours & Opportunities, the first small pilot (rules.rumours 'pilot'; spec:
// docs/playtest/PLAYTEST_006 R0–R14; data/rumours.js). A discovery / availability LAYER over the one
// Questbook — it never runs a quest, it only says who may take one:
//   AVAILABLE IN THE WORLD  state.rumours.schedule — each opportunity's weeks, drawn once at createGame from
//                           the seed by its own hash stream (the game's dice are untouched);
//   DISCOVERED              player.rumours.heard[id] — per player: { week, from };
//   ACCEPTED                not stored here — the player has the quest's occurrence in the quest book.
// Its weeks decide only when an opportunity can be taken; a quest once taken never expires (the Questbook).
// Variant C (provisional): a player who heard a rumour keeps it until the quest is taken; an unheard,
// closed opportunity returns once. Discovery: arriving at the start place (always) or a Poké Stop in the
// rumour's reach (at most RUMOURS.perTurn new rumours per own turn). Anti-softlock: an opportunity whose
// start or quest places a player cannot reach on land is never scheduled.
import { OPPORTUNITIES, RUMOURS } from '../data/rumours.js';
import { EXPEDITIONS, RUMOUR_QUESTS } from '../data/questBook.js';
import { getLocation } from '../data/locations.js';
import { hashIndex } from './rng.js';
import { log } from './log.js';
import { hasPokeStop } from './pokeStopEngine.js';
import { travelDistances } from './travelEngine.js';

export function usesRumours(config) {
  return config.rules.rumours === 'pilot' && config.rules.questBook === 'v2';
}

// The opportunities of THIS game: one that opens a pilot's quest only when that pilot is on (`needsRule`).
export const rumourDefs = (config = null) => OPPORTUNITIES.v1.filter((o) => !o.needsRule || (config && config.rules[o.needsRule]));
export const rumourDef = (id) => OPPORTUNITIES.v1.find((o) => o.id === id) ?? null;
export const rumourQuest = (id) => RUMOUR_QUESTS.v1.find((q) => q.rumour === id) ?? EXPEDITIONS.v1.find((q) => q.rumour === id) ?? null;

// Every place an opportunity needs: its start and every place of its quest.
function placesOf(def) {
  const q = rumourQuest(def.id);
  const steps = (q?.stages ?? []).flatMap((st) => st.objectives).map((o) => o.place).filter(Boolean);
  return [...new Set([def.start, ...steps, ...(q ? [q.claimAt] : [])])];
}

// Anti-softlock: reachable on land (no capability) from every player's start.
export function opportunityValid(state, def) {
  return state.players.every((p) => {
    const d = travelDistances({ ...p, capabilities: {} }, p.location, state.config);
    return placesOf(def).every((pl) => d[pl] !== undefined);
  });
}

// Once, at createGame: the world schedule (its own hash stream).
export function setupRumours(state) {
  if (!usesRumours(state.config)) return;
  const k = RUMOURS.fresh;
  const fresh = [];
  const schedule = [];
  const blocked = [];
  for (const def of [...rumourDefs(state.config)].sort((a, b) => a.appearsIn[0] - b.appearsIn[0] || (a.id < b.id ? -1 : 1))) {
    if (!opportunityValid(state, def)) {
      blocked.push(def.id);
      continue;
    }
    let w = def.appearsIn[0] + hashIndex(`${state.seed}:rumour:${def.id}`, def.appearsIn[1] - def.appearsIn[0] + 1);
    // at most K fresh at a time — over its whole open span, not only its first week
    const busy = (t) => fresh.filter((f) => t >= f.from && t < f.to).length;
    while (Array.from({ length: def.openWeeks }, (_, d) => busy(w + d)).some((n) => n >= k)) w += 1;
    fresh.push({ from: w, to: w + def.openWeeks });
    const back = w + def.openWeeks + RUMOURS.returnGap;
    schedule.push({ id: def.id, appears: w, closes: w + def.openWeeks, returns: back, returnCloses: back + def.openWeeks });
  }
  state.rumours = { v: 1, schedule, blocked };
  for (const p of state.players) p.rumours = { heard: {}, lastHeardRound: null };
  log(state, 'system', `Kanto rumours: ${schedule.map((x) => `${x.id} from week ${x.appears}`).join(', ')}${blocked.length ? ` (not this game: ${blocked.join(', ')})` : ''}.`, { rumours: { event: 'schedule', schedule } });
}

const entry = (state, id) => state.rumours?.schedule.find((x) => x.id === id) ?? null;

// Open in the world this week (its first weeks or its one return).
export function openInWorld(state, id, week = state.turn.round) {
  const e = entry(state, id);
  return Boolean(e) && ((week >= e.appears && week < e.closes) || (week >= e.returns && week < e.returnCloses));
}

const taken = (player, questId) => Object.keys(player.questRecords?.occ ?? {}).some((occ) => occ.startsWith(`${questId}#`));

// May this player take the opportunity's quest (variant C: heard = kept; else open in the world)?
export function rumourOpenFor(state, player, id) {
  if (!usesRumours(state.config) || !entry(state, id)) return false;
  if (player.rumours?.heard[id]) return state.turn.round >= entry(state, id).appears;
  return openInWorld(state, id);
}

// The rumours this player heard, with their state for the table: 'go' (take it at its start), 'taken' (an
// occurrence exists). PLAYTEST_007 stage 1 — `phase` says WHICH: 'heard' (not taken yet) · 'active' (in the book
// now) · 'done' (collected) · 'abandoned' (given up; the rumour is kept, so it can be taken again where allowed).
// „Heard” ≠ „taken” ≠ „done”: the book showed „✓ W księdze” for a quest given up or finished.
export function rumourList(state, player) {
  if (!usesRumours(state.config) || !player.rumours) return [];
  return Object.entries(player.rumours.heard).map(([id, h]) => {
    const def = rumourDef(id);
    return { id, start: def.start, quest: def.quest, week: h.week, from: h.from, status: taken(player, def.quest) ? 'taken' : 'go', phase: questPhase(player, def.quest) };
  }).sort((a, b) => a.week - b.week || (a.id < b.id ? -1 : 1));
}

function questPhase(player, questId) {
  if (player.questBook?.active.some((a) => a.questId === questId)) return 'active';
  const occs = Object.entries(player.questRecords?.occ ?? {}).filter(([occ]) => occ.startsWith(`${questId}#`)).map(([, r]) => r);
  if (!occs.length) return 'heard';
  return occs.some((r) => r.claimedRound != null) ? 'done' : 'abandoned';
}

// Bonus 14.10 (rules.eventPack, „A local's tale”): this player hears one opportunity open in the world now that they
// have neither heard nor taken — the first in the data's order (no draw). null when there is none.
export function hearFromEvent(state, player) {
  if (!usesRumours(state.config) || !player.rumours) return null;
  const def = rumourDefs(state.config).find((d) => !player.rumours.heard[d.id] && openInWorld(state, d.id) && !taken(player, d.quest));
  if (!def) return null;
  hear(state, player, def, 'event');
  return def;
}

function hear(state, player, def, from) {
  player.rumours.heard[def.id] = { week: state.turn.round, from };
  if (from !== 'local') player.rumours.lastHeardRound = state.turn.round;
  log(state, 'quest', `📜 ${player.name} hears a rumour: ${def.id} — ${getLocation(def.start).name}${from === 'local' ? ' (right here)' : ''}.`, { rumour: { event: 'heard', id: def.id, start: def.start, quest: def.quest, from, player: player.id } });
}

// Called for every quest event (questEngine.recordQuestEvent): an arrival or the start of an own turn.
export function rumourEvent(state, player, event) {
  if (!usesRumours(state.config) || !player.rumours || !['arrive', 'turnStart'].includes(event.kind)) return;
  const here = event.location ?? player.location;
  const fresh = (def) => !player.rumours.heard[def.id] && openInWorld(state, def.id) && !taken(player, def.quest);
  // the start place itself: always (a rumour on the spot)
  for (const def of rumourDefs(state.config)) if (def.start === here && fresh(def)) hear(state, player, def, 'local');
  // a Poké Stop in reach: the oldest open one, at most RUMOURS.perTurn per own turn
  if (!hasPokeStop(here, state.config) || player.rumours.lastHeardRound === state.turn.round) return;
  const dist = travelDistances(player, here, state.config);
  const inReach = (def) => def.hear === 'anyStop' || (dist[def.start] ?? Infinity) <= def.hear.region;
  const next = rumourDefs(state.config).filter((def) => fresh(def) && inReach(def)).sort((a, b) => entry(state, a.id).appears - entry(state, b.id).appears || (a.id < b.id ? -1 : 1))[0];
  if (next) hear(state, player, next, `pokeStop:${here}`);
}
