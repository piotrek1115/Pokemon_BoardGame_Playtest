// Central RNG. The generator (sfc32 seeded via cyrb128) keeps its state as four
// uint32 words inside GameState, so a game can be serialized mid-way and
// resumed with the identical random stream.
//
// Engine code must only use d6 / pick / weightedPick below: they draw from
// state.rng and write every result to the game log.
import { log } from './log.js';

function cyrb128(str) {
  let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
  for (let i = 0; i < str.length; i++) {
    const k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= h2 ^ h3 ^ h4;
  h2 ^= h1;
  h3 ^= h1;
  h4 ^= h1;
  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
}

export function createRng(seed) {
  const rng = { seed: String(seed), s: cyrb128(String(seed)), draws: 0 };
  for (let i = 0; i < 15; i++) nextUint32(rng); // warm-up
  rng.draws = 0;
  return rng;
}

export function nextUint32(rng) {
  let [a, b, c, d] = rng.s;
  let t = (a + b) | 0;
  a = b ^ (b >>> 9);
  b = (c + (c << 3)) | 0;
  c = (c << 21) | (c >>> 11);
  d = (d + 1) | 0;
  t = (t + d) | 0;
  c = (c + t) | 0;
  rng.s = [a >>> 0, b >>> 0, c >>> 0, d >>> 0];
  rng.draws += 1;
  return t >>> 0;
}

export function randomInt(rng, n) {
  return Math.floor((nextUint32(rng) / 4294967296) * n);
}

// Stateless hash -> [0, n). Used for AI tie-breaks so AI choices never consume
// the game RNG stream (keeps replays of recorded actions exact).
export function hashIndex(key, n) {
  return cyrb128(String(key))[0] % n;
}

// Dice sources (digital prototype, DQ-62 / DQ-63). Every die has a kind:
//   'player'  a roll a player makes for their own action (attack, capture)
//   'system'  the world's rolls (encounter, rarity, counter-attack, escape,
//             trainer difficulty, Meowth, Team Rocket)
// CONFIG.dice.mode decides which dice come from physical dice the players
// entered (state.dice.queue, filled by the recorded `enterDice` action):
//   digital      none — the seeded RNG rolls everything (the simulator)
//   playerDice   'player' rolls of human players
//   allPhysical  every roll
// A physical die that is needed but not queued falls back to the RNG and is
// marked `missingPhysical` in the log, so a UI dry run can ask for it first.
export function needsPhysical(state, kind) {
  const mode = state.config?.dice?.mode ?? 'digital';
  if (mode === 'allPhysical') return true;
  if (mode !== 'playerDice' || kind !== 'player') return false;
  return state.players?.[state.turn?.playerIndex]?.controller === 'human';
}

function physicalValue(state, kind, accept) {
  if (!needsPhysical(state, kind)) return undefined;
  const queue = state.dice?.queue;
  if (queue?.length && accept(queue[0])) return queue.shift();
  return undefined;
}

// Roll a d6. `describe(value)` adds the interpretation to the same log line,
// e.g. "Encounter d6: 5 -> Wild Pokémon".
// state.debug.forcedRolls (a queue) overrides the next rolls for testing.
export function d6(state, label, describe, kind = 'system') {
  let value;
  let source = 'digital';
  if (state.debug?.forcedRolls?.length) {
    value = state.debug.forcedRolls.shift();
    source = 'forced';
  } else if ((value = physicalValue(state, kind, Number.isInteger)) !== undefined) {
    source = 'physical';
  } else {
    value = randomInt(state.rng, 6) + 1;
  }
  const missingPhysical = source === 'digital' && needsPhysical(state, kind);
  const suffix = describe ? ` -> ${describe(value)}` : '';
  const tag = source === 'forced' ? ' (forced)' : source === 'physical' ? ' (physical)' : '';
  const data = { label, value, sides: 6, kind, source, forced: source !== 'digital' };
  if (missingPhysical) data.missingPhysical = true;
  log(state, 'roll', `${label} d6: ${value}${tag}${suffix}`, data);
  return value;
}

// The three Escape Dice (capture retry B / C): six faces, `fleeFaces` of them
// show 🌬️ (the Pokémon flees), the rest ○ (it stays). A physical Escape Die is
// entered as its symbol ('flee' / 'stay'), never as a number; a forced debug
// value 1–6 counts as 🌬️ when it is ≤ fleeFaces.
export const ESCAPE_SYMBOL = { flee: '🌬️', stay: '○' };
const ESCAPE_ICON = { red: '🔴', yellow: '🟡', green: '🟢' };

export function rollEscapeDie(state, colour, kind = 'system') {
  const fleeFaces = state.config.capture.escapeDice[colour].fleeFaces;
  let face = null;
  let result;
  let source = 'digital';
  if (state.debug?.forcedRolls?.length) {
    face = state.debug.forcedRolls.shift();
    result = face <= fleeFaces ? 'flee' : 'stay';
    source = 'forced';
  } else if ((result = physicalValue(state, kind, (v) => v === 'flee' || v === 'stay')) !== undefined) {
    source = 'physical';
  } else {
    face = randomInt(state.rng, 6) + 1;
    result = face <= fleeFaces ? 'flee' : 'stay';
  }
  const data = { label: 'Escape', die: 'escape', colour, fleeFaces, face, result, sides: 6, kind, source, forced: source !== 'digital' };
  if (source === 'digital' && needsPhysical(state, kind)) data.missingPhysical = true;
  const name = colour[0].toUpperCase() + colour.slice(1);
  log(state, 'roll', `${ESCAPE_ICON[colour]} ${name} Escape Die: ${ESCAPE_SYMBOL[result]}${source === 'physical' ? ' (physical)' : source === 'forced' ? ' (forced)' : ''}`, data);
  return result;
}

// The three Catch Dice (symbolic capture, DQ-68): six faces, `successFaces`
// of them show a Poké Ball (caught), the rest are blank. A physical Catch Die
// is entered as its symbol ('ball' / 'blank'); a forced debug value 1–6 counts
// as a Poké Ball on the high faces (> 6 − successFaces), so face 6 always
// catches and 1 never does — the same faces as the old 4+ / 5+ / 6 targets.
export const CATCH_SYMBOL = { ball: '◓', blank: '–' };
const CATCH_ICON = { blue: '🔵', purple: '🟣', magenta: '🩷' };

export function rollCatchDie(state, colour, { reroll = false, kind = 'player' } = {}) {
  const successFaces = state.config.capture.catchDice[colour].successFaces;
  const hit = (face) => (face > 6 - successFaces ? 'ball' : 'blank');
  let face = null;
  let result;
  let source = 'digital';
  if (state.debug?.forcedRolls?.length) {
    face = state.debug.forcedRolls.shift();
    result = hit(face);
    source = 'forced';
  } else if ((result = physicalValue(state, kind, (v) => v === 'ball' || v === 'blank')) !== undefined) {
    source = 'physical';
  } else {
    face = randomInt(state.rng, 6) + 1;
    result = hit(face);
  }
  const data = { label: reroll ? 'Catch reroll' : 'Catch', die: 'catch', colour, successFaces, face, result, reroll, sides: 6, kind, source, forced: source !== 'digital' };
  if (source === 'digital' && needsPhysical(state, kind)) data.missingPhysical = true;
  const name = colour[0].toUpperCase() + colour.slice(1);
  const tag = source === 'physical' ? ' (physical)' : source === 'forced' ? ' (forced)' : '';
  log(state, 'roll', `${CATCH_ICON[colour]} ${name} Catch Die${reroll ? ' ↻ reroll' : ''}: ${CATCH_SYMBOL[result]}${result === 'ball' ? ' Poké Ball!' : ' blank'}${tag}`, data);
  return result;
}

export function pick(state, label, items, nameOf = String) {
  if (items.length === 0) throw new Error(`pick(${label}): no options`);
  if (items.length === 1) {
    log(state, 'info', `${label}: ${nameOf(items[0])} (only option)`);
    return items[0];
  }
  const index = randomInt(state.rng, items.length);
  log(state, 'roll', `${label}: ${nameOf(items[index])} (1 of ${items.length})`, { label, index, options: items.length });
  return items[index];
}

export function weightedPick(state, label, items, weightOf, nameOf = String) {
  if (items.length === 0) throw new Error(`weightedPick(${label}): no options`);
  const weights = items.map((it) => Math.max(0, weightOf(it)));
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) throw new Error(`weightedPick(${label}): total weight is 0`);
  if (items.length === 1) {
    log(state, 'info', `${label}: ${nameOf(items[0])} (only option)`);
    return items[0];
  }
  let r = (nextUint32(state.rng) / 4294967296) * total;
  let index = 0;
  while (index < items.length - 1 && r >= weights[index]) {
    r -= weights[index];
    index += 1;
  }
  log(state, 'roll', `${label}: ${nameOf(items[index])} (weight ${weights[index]} of ${total})`, { label, index, total });
  return items[index];
}

// Separate, named streams (e.g. state.questRng) keep card shuffles from shifting
// the dice stream: adding missions doesn't change which Pokémon a seed spawns.
// Entries carry `stream` and `draws` so every draw stays accounted for in the log.
export function shuffleWith(state, streamKey, label, items) {
  const rng = state[streamKey];
  const out = [...items];
  let draws = 0;
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomInt(rng, i + 1);
    draws += 1;
    [out[i], out[j]] = [out[j], out[i]];
  }
  log(state, 'roll', `${label}: shuffled ${out.length} cards`, { label, stream: streamKey, draws });
  return out;
}

export function pickWith(state, streamKey, label, items, nameOf = String) {
  if (items.length === 0) throw new Error(`pickWith(${label}): no options`);
  if (items.length === 1) {
    log(state, 'info', `${label}: ${nameOf(items[0])} (only option)`);
    return items[0];
  }
  const index = randomInt(state[streamKey], items.length);
  log(state, 'roll', `${label}: ${nameOf(items[index])} (1 of ${items.length})`, { label, stream: streamKey, index, options: items.length, draws: 1 });
  return items[index];
}

// d6 on a named stream (e.g. state.rocketRng). Debug forced rolls only steer the
// main dice stream, so they never land on a week-start check by accident. In
// All-physical mode the players' die is used instead.
export function d6With(state, streamKey, label, describe, kind = 'system') {
  let value = physicalValue(state, kind, Number.isInteger);
  const source = value === undefined ? 'digital' : 'physical';
  if (value === undefined) value = randomInt(state[streamKey], 6) + 1;
  const suffix = describe ? ` -> ${describe(value)}` : '';
  const data = { label, value, sides: 6, stream: streamKey, draws: source === 'digital' ? 1 : 0, kind, source };
  if (source === 'digital' && needsPhysical(state, kind)) data.missingPhysical = true;
  log(state, 'roll', `${label} d6: ${value}${source === 'physical' ? ' (physical)' : ''}${suffix}`, data);
  return value;
}
