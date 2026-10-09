// Catching. A ball is spent on every throw; throwing never provokes a
// counter-attack (DQ-65). How the throw is resolved is CONFIG.capture.system:
//
//   symbolic  (standard, DQ-68) roll a coloured Catch Die — no arithmetic:
//             the rarity picks the base die (Common 🔵 blue 3/6, Rare 🟣 purple
//             2/6, Super Rare 🩷 magenta 1/6 Poké Ball faces); the HP colour
//             (yellow 1 step, green 2) and a Super Ball (1 step) make it easier
//             along magenta → purple → blue; steps past blue give one reroll
//   classic   (old baseline) d6 + HP bonus + ball bonus ≥ the rarity target
//
// What a failed throw does is CONFIG.capture.retry (DQ-61):
//   harsh         A — the Pokémon flees at once (the rule before the digital prototype)
//   escapeDice    B — standard: roll the Escape Die of the Pokémon's current
//                 HP colour; 🌬️ = it flees, ○ = it stays and you may throw again
//   secondChance  C — like B, but the first failed throw while the Pokémon is
//                 in its yellow or green zone always stays (once per encounter)
//
// HP colours come from the HP bar itself (no separate tracker): the 1st HP
// slot is green, the remaining slots split into yellow (lower) and red (upper),
// red getting the extra slot when the count is odd. The current HP slot's
// colour picks the Escape Die (red 3/6 flee, yellow 2/6, green 1/6) and, in
// the symbolic system, how much easier the Catch Die gets.
import { getSpecies, RARITY_LABELS } from '../data/pokemon.js';
import { d6, rollCatchDie, rollEscapeDie } from './rng.js';
import { log } from './log.js';
import { ITEMS } from '../data/items.js';
import { addCaughtPokemon, currentPlayer } from './gameState.js';
import { addItem, itemCount } from './itemEngine.js';
import { endEncounter } from './encounterEngine.js';
import { wildCaught } from './growthEngine.js';
import { opponentStrikes } from './combatEngine.js';

export const ESCAPE_COLOURS = ['red', 'yellow', 'green'];
// Catch Dice from hardest to easiest.
export const CATCH_LADDER = ['magenta', 'purple', 'blue'];

export function captureTarget(rarity, config) {
  const target = config.capture.target[rarity];
  if (target == null) throw new Error(`No capture target for rarity ${rarity}`);
  return target;
}

// Classic: exactly 1 HP gives the larger bonus; it does not stack with the 50%
// bonus (ACCEPTED v0.1, DQ-06).
export function captureBonus(pokemon, config) {
  if (pokemon.hp === 1) return config.capture.oneHpBonus;
  if (pokemon.hp <= pokemon.maxHp / 2) return config.capture.halfHpBonus;
  return 0;
}

export function captureSucceeds(roll, bonus, target) {
  return roll + bonus >= target;
}

// Classic: extra bonus from the ball itself (Super Ball +1).
export function ballBonus(ballId, config) {
  return config.items[ballId]?.captureBonus ?? 0;
}

// Classic: probability of success on one throw.
export function captureChance(target, bonus) {
  const need = target - bonus;
  return Math.max(0, Math.min(6, 7 - need)) / 6;
}

// HP slot colours for a Pokémon with `maxHp`: index 0 = the 1st HP slot.
// 3 → G Y R · 4 → G Y R R · 5 → G Y Y R R · 6 → G Y Y R R R · 7 → G Y Y Y R R R
export function escapeZones(maxHp) {
  const yellow = Math.floor(Math.max(0, maxHp - 1) / 2);
  return Array.from({ length: maxHp }, (_, i) => (i === 0 ? 'green' : i <= yellow ? 'yellow' : 'red'));
}

// The colour of the current (last filled) HP slot.
export function escapeColour(pokemon) {
  return escapeZones(pokemon.maxHp)[Math.max(1, Math.min(pokemon.hp, pokemon.maxHp)) - 1];
}

export function fleeChance(colour, config) {
  return config.capture.escapeDice[colour].fleeFaces / 6;
}

// Symbolic: the Catch Die a throw uses. `ballEffect` says what the ball's own
// step did: 'colour' (an easier die), 'reroll' (it created the reroll) or
// 'none' (the HP colour had already reached blue + reroll).
export function catchDie(pokemon, ballId, config) {
  const cfg = config.capture;
  const base = cfg.catchDieByRarity[getSpecies(pokemon.species).rarity];
  const hpColour = escapeColour(pokemon);
  const hpSteps = cfg.hpSteps[hpColour];
  const ballSteps = config.items[ballId]?.catchSteps ?? 0;
  const top = CATCH_LADDER.length - 1;
  const start = CATCH_LADDER.indexOf(base);
  const overflow = (steps) => Math.min(cfg.maxRerolls, Math.max(0, start + steps - top));
  const colour = CATCH_LADDER[Math.min(top, start + hpSteps + ballSteps)];
  const rerolls = overflow(hpSteps + ballSteps);
  let ballEffect = null;
  if (ballSteps) ballEffect = start + hpSteps < top ? 'colour' : rerolls > overflow(hpSteps) ? 'reroll' : 'none';
  const steps = [hpSteps && { label: `${hpColour} HP`, steps: hpSteps }, ballSteps && { label: ITEMS[ballId].name, steps: ballSteps }].filter(Boolean);
  return { base, colour, successFaces: cfg.catchDice[colour].successFaces, rerolls, hpColour, steps, ballEffect };
}

// Symbolic: chance that one throw catches (a reroll is a second try with the same die).
export function catchDieChance(die) {
  const p = die.successFaces / 6;
  return die.rerolls ? 1 - (1 - p) ** (1 + die.rerolls) : p;
}

// Chance that one throw of `ballId` catches, under the game's catch system.
export function throwChance(pokemon, ballId, config) {
  if (config.capture.system === 'classic') {
    return captureChance(captureTarget(getSpecies(pokemon.species).rarity, config), captureBonus(pokemon, config) + ballBonus(ballId, config));
  }
  return catchDieChance(catchDie(pokemon, ballId, config));
}

// Chance to catch within `balls` more throws, under the retry variant (AI).
export function catchChanceWithRetries(state, pokemon, ballId, balls) {
  const cfg = state.config;
  const p = throwChance(pokemon, ballId, cfg);
  const retry = cfg.capture.retry;
  if (retry === 'harsh' || balls <= 1) return p;
  const colour = escapeColour(pokemon);
  const stay = 1 - fleeChance(colour, cfg);
  let total = 0;
  let alive = 1;
  let freePass = retry === 'secondChance' && colour !== 'red' && !state.encounter?.secondChanceUsed;
  for (let i = 0; i < balls; i++) {
    total += alive * p;
    alive *= (1 - p) * (freePass ? 1 : stay);
    freePass = false;
  }
  return total;
}

export function emptyCaptureStats() {
  const zone = () => ({
    attempts: 0, catches: 0, fails: 0, escapeRolls: 0, flees: 0, stays: 0,
    repeats: 0, // failed throws in that zone followed by another throw at the same Pokémon
    dice: { magenta: 0, purple: 0, blue: 0, blueReroll: 0 }, // Catch Die used (symbolic)
  });
  const counts = () => ({ attempts: 0, catches: 0 });
  const byRarity = () => ({ encounters: 0, catchEncounters: 0, attempts: 0, caught: 0 });
  return {
    wildEncounters: 0, catchEncounters: 0, noBallEncounters: 0, attempts: 0, catches: 0, fails: 0, flees: 0, stays: 0, secondChances: 0,
    attemptsPerEncounter: {}, // throws in an encounter -> count of encounters
    catchEncounterActions: 0, // fights + throws in encounters with at least one throw
    rerolls: { available: 0, used: 0, catches: 0 },
    byHpColour: { red: zone(), yellow: zone(), green: zone() },
    byCatchDie: { magenta: counts(), purple: counts(), blue: counts(), blueReroll: counts() },
    byRarity: { common: byRarity(), rare: byRarity(), superRare: byRarity() },
    byBall: {
      pokeball: { attempts: 0, catches: 0, rerolls: 0 },
      // what the Super Ball's step did (symbolic): an easier die, the reroll, nothing
      superball: { attempts: 0, catches: 0, rerolls: 0, colourStep: 0, rerollStep: 0, noEffect: 0 },
    },
  };
}

function captureStats(player) {
  return (player.stats.capture ??= emptyCaptureStats());
}

const COLOUR_NAME = { red: '🔴 Red', yellow: '🟡 Yellow', green: '🟢 Green' };
const DIE_NAME = { blue: '🔵 Blue', purple: '🟣 Purple', magenta: '🩷 Magenta' };

// Classic: d6 + bonuses vs the rarity target.
function classicThrow(state, player, wild, species, ballId, colour, attempt) {
  const target = captureTarget(species.rarity, state.config);
  const hpBonus = captureBonus(wild, state.config);
  const ball = ballBonus(ballId, state.config);
  const bonus = hpBonus + ball;
  log(state, 'capture', `${player.name} throws a ${ITEMS[ballId].name} at ${species.name} (${RARITY_LABELS[species.rarity]}, needs ${target}+). ${ITEMS[ballId].name}s left: ${itemCount(player, ballId)}`);
  let raw;
  d6(state, 'Capture', (v) => {
    raw = v;
    const parts = `${hpBonus ? ` +${hpBonus} HP bonus` : ''}${ball ? ` +${ball} ball` : ''}`;
    return `${v}${parts ? `${parts} = ${v + bonus}` : ''} vs ${target}+ -> ${captureSucceeds(v, bonus, target) ? 'caught' : 'broke free'}`;
  }, 'player');
  const success = captureSucceeds(raw, bonus, target);
  return {
    success,
    result: {
      die: 'capture', system: 'classic', raw, total: raw + bonus, need: target, ball: ballId, colour, attempt,
      modifiers: [hpBonus && { label: wild.hp === 1 ? '1 HP' : 'low HP', value: hpBonus }, ball && { label: ITEMS[ballId].name, value: ball }].filter(Boolean),
      result: success ? 'caught' : 'brokeFree',
    },
  };
}

// Symbolic: roll the Catch Die; a blank with a reroll available is rolled once more.
function symbolicThrow(state, player, wild, species, ballId, colour, attempt, stats) {
  const die = catchDie(wild, ballId, state.config);
  log(state, 'capture', `${player.name} throws a ${ITEMS[ballId].name} at ${species.name} (${RARITY_LABELS[species.rarity]} · ❤ ${wild.hp}/${wild.maxHp} ${COLOUR_NAME[colour]}) → ${DIE_NAME[die.colour]} Catch Die${die.rerolls ? ' + ↻ 1 reroll' : ''}. ${ITEMS[ballId].name}s left: ${itemCount(player, ballId)}`);
  const rolls = [rollCatchDie(state, die.colour)];
  if (rolls[0] === 'blank' && die.rerolls) rolls.push(rollCatchDie(state, die.colour, { reroll: true }));
  const success = rolls.at(-1) === 'ball';

  const key = die.rerolls ? `${die.colour}Reroll` : die.colour;
  stats.byCatchDie[key].attempts += 1;
  stats.byHpColour[colour].dice[key] += 1;
  if (success) stats.byCatchDie[key].catches += 1;
  if (die.rerolls) {
    stats.rerolls.available += 1;
    stats.byBall[ballId].rerolls += 1;
  }
  if (rolls.length > 1) {
    stats.rerolls.used += 1;
    if (success) stats.rerolls.catches += 1;
  }
  if (die.ballEffect) stats.byBall[ballId][{ colour: 'colourStep', reroll: 'rerollStep', none: 'noEffect' }[die.ballEffect]] += 1;
  return {
    success,
    result: {
      die: 'catch', system: 'symbolic', base: die.base, colour: die.colour, successFaces: die.successFaces, steps: die.steps,
      reroll: die.rerolls > 0, rolls, ball: ballId, hpColour: colour, attempt, result: success ? 'caught' : 'brokeFree',
    },
  };
}

export function throwBall(state, ballId = 'pokeball') {
  const player = currentPlayer(state);
  const enc = state.encounter;
  const wild = enc.pokemon;
  const species = getSpecies(wild.species);
  const colour = escapeColour(wild);
  const stats = captureStats(player);
  const zone = stats.byHpColour[colour];
  enc.throws = (enc.throws ?? 0) + 1;
  enc.freeSwitch = false;
  stats.attempts += 1;
  zone.attempts += 1;
  stats.byRarity[species.rarity].attempts += 1;
  stats.byBall[ballId].attempts += 1;
  if (enc.stayedIn) stats.byHpColour[enc.stayedIn].repeats += 1;
  enc.stayedIn = null;

  addItem(player, ballId, -1);
  const { success, result } = state.config.capture.system === 'classic'
    ? classicThrow(state, player, wild, species, ballId, colour, enc.throws)
    : symbolicThrow(state, player, wild, species, ballId, colour, enc.throws, stats);

  if (success) {
    stats.catches += 1;
    zone.catches += 1;
    stats.byRarity[species.rarity].caught += 1;
    stats.byBall[ballId].catches += 1;
    const where = addCaughtPokemon(state, player, wild);
    log(state, 'capture', `Gotcha! ${species.name} was caught${where === 'reserve' ? ' and sent to the reserve (team is full)' : ''}.`, { capture: result });
    wildCaught(state); // Growth games: 1 Growth if it was fought first
    endEncounter(state, 'caught');
    return true;
  }

  stats.fails += 1;
  zone.fails += 1;
  enc.captureFails = (enc.captureFails ?? 0) + 1;
  log(state, 'capture', `${species.name} broke free! (❤ ${wild.hp}/${wild.maxHp}: ${COLOUR_NAME[colour]} zone)`, { capture: result });
  // What the failed throw leads to: 'flee' or 'stay'.
  const retry = state.config.capture.retry;
  const freePass = retry === 'secondChance' && colour !== 'red' && !enc.secondChanceUsed;
  let fate;
  if (retry === 'harsh') fate = 'flee';
  else if (freePass) {
    enc.secondChanceUsed = true;
    stats.secondChances += 1;
    fate = 'stay';
  } else {
    zone.escapeRolls += 1;
    fate = rollEscapeDie(state, colour, 'system');
  }
  const escape = { die: 'escape', colour, result: fate, secondChance: freePass };
  if (fate === 'flee') {
    stats.flees += 1;
    zone.flees += 1;
    log(state, 'capture', retry === 'harsh' ? `${species.name} fled!` : `🌬️ ${species.name} ran away!`, { escape });
    endEncounter(state, 'fled');
  } else {
    stats.stays += 1;
    zone.stays += 1;
    enc.stayedIn = colour;
    log(state, 'capture', escape.secondChance ? `${species.name} stays — a second chance! Throw again?` : `○ ${species.name} stays! Throw again?`, { escape });
    // Phase 3A-2 (rules.counterattackOnStay, DQ-80): it strikes back at once,
    // then the full battle choice comes back (a new throw is a new decision).
    if (state.config.rules.counterattackOnStay) opponentStrikes(state, 'stay');
  }
  return false;
}

// Called by endEncounter for every wild encounter: per-encounter capture stats.
export function recordWildEncounter(player, enc) {
  const stats = captureStats(player);
  const rarity = getSpecies(enc.pokemon.species).rarity;
  stats.wildEncounters += 1;
  stats.byRarity[rarity].encounters += 1;
  if (enc.ballsAtStart === 0) stats.noBallEncounters += 1;
  const throws = enc.throws ?? 0;
  if (!throws) return;
  stats.catchEncounters += 1;
  stats.byRarity[rarity].catchEncounters += 1;
  stats.attemptsPerEncounter[throws] = (stats.attemptsPerEncounter[throws] ?? 0) + 1;
  stats.catchEncounterActions += throws + (enc.fights ?? 0);
}
