// Encounter engine: the Explore roll and what it produces (nothing / event /
// trainer / wild Pokémon). Wild spawns filter the species pool by biome, then
// by rarity. All tables come from CONFIG; all rolls are logged.
//
// Mixed exploration (Macro 01, rules.explorePools 'v2', a place whose
// `explore` is 'mixed'): one Explore searches the whole place. A wild Pokémon
// comes from the species of all its biomes together — each species once, in
// data order — with the rarity roll and its fallback as before; the
// encounter's biome is the first of the place's biomes the species lives in
// (for missions and the table). A trainer or an event needs one biome: one of
// the place's biomes is drawn for it ('Area').
//
// Local pools (Macro 02 M02-1, rules.localPools 'v2'): a place with a table in
// data/pools.js spawns only its own species — the rarity roll picks the pool,
// signature species weigh 2, the others 1 (weightedPick 'Spawn') — and its
// third eligible Explore is a guaranteed signature encounter (localPoolEngine).
//
// Exploration fatigue (Macro 02 M02-2, rules.fatigue): the Explore passes the
// level it read (fatigueEngine); at an exhausted place the encounter roll's
// „Pokémon” on CONFIG.fatigue.quietFaces is „Cisza” — the same roll, no new
// draw. The guaranteed signature encounter has no roll, so it is never „Cisza”.
import { POKEMON, getSpecies, isWild, RARITY_LABELS } from '../data/pokemon.js';
import { BIOMES } from '../data/biomes.js';
import { getLocation, locationBiomes } from '../data/locations.js';
import { TYPE_ICONS } from '../data/types.js';
import { d6, pick, weightedPick } from './rng.js';
import { log } from './log.js';
import { createPokemonInstance, currentPlayer, markSeen } from './gameState.js';
import { generateTrainer } from './trainerEngine.js';
import { drawEvent } from './eventEngine.js';
import { awardStars } from './evolutionEngine.js';
import { settleGrowth, usesGrowth } from './growthEngine.js';
import { recordQuestEvent } from './questEngine.js';
import { recordWildEncounter } from './captureEngine.js';
import { markLeadPick } from './leadPickEngine.js';
import { localPool, noteSighting, poolWeight, resolveLocalPool, signatureDue } from './localPoolEngine.js';
import { quietFace } from './fatigueEngine.js';
import { ballCount } from './itemEngine.js';
import { afterBattle } from './traitEngine.js';

export const OUTCOME_LABELS = {
  nothing: 'Nothing',
  event: 'Event',
  trainer: 'Trainer',
  pokemon: 'Wild Pokémon',
  pokemonBonus: 'Wild Pokémon + rarity bonus',
};

export function encounterOutcomeFromRoll(roll, config) {
  for (const [outcome, faces] of Object.entries(config.encounters)) {
    if (faces.includes(roll)) return outcome;
  }
  throw new Error(`No encounter outcome configured for d6=${roll}`);
}

export function rarityFromRoll(roll, config) {
  for (const [rarity, faces] of Object.entries(config.rarity)) {
    if (faces.includes(roll)) return rarity;
  }
  throw new Error(`No rarity configured for d6=${roll}`);
}

export function speciesFor(biome, rarity) {
  return POKEMON.filter((p) => isWild(p) && p.biomes.includes(biome) && p.rarity === rarity);
}

// The species of several biomes together, each once (a mixed place).
export function speciesForBiomes(biomes, rarity) {
  return POKEMON.filter((p) => isWild(p) && p.rarity === rarity && p.biomes.some((b) => biomes.includes(b)));
}

// Pool for a biome + rolled rarity, falling back per CONFIG.rarityFallback when
// the biome has no species of that rarity.
export function resolveSpawnPool(biome, rolledRarity, config) {
  return resolveMixedPool([biome], rolledRarity, config);
}

export function resolveMixedPool(biomes, rolledRarity, config) {
  for (const rarity of config.rarityFallback[rolledRarity]) {
    const pool = speciesForBiomes(biomes, rarity);
    if (pool.length) return { rarity, pool, fellBack: rarity !== rolledRarity };
  }
  return { rarity: null, pool: [], fellBack: true };
}

// M02-2: the Pokémon of an exhausted place hide — this roll's „Pokémon” is „Cisza”.
function hideFromTired(state, roll, fatigue) {
  if (!quietFace(roll, fatigue, state.config)) return false;
  const player = currentPlayer(state);
  log(state, 'encounter', `The Pokémon of ${getLocation(player.location).name} hide from ${player.name} — they know them too well. All quiet.`, { fatigue: { place: player.location, level: fatigue, quiet: true } });
  return true;
}

export function explore(state, biome, { fatigue = 0 } = {}) {
  const cfg = state.config;
  const roll = d6(state, 'Encounter', (v) => OUTCOME_LABELS[encounterOutcomeFromRoll(v, cfg)]);
  if (hideFromTired(state, roll, fatigue)) return 'nothing';
  const outcome = encounterOutcomeFromRoll(roll, cfg);
  switch (outcome) {
    case 'nothing':
      log(state, 'encounter', 'All quiet. Nothing happens.');
      break;
    case 'event':
      drawEvent(state, { biome });
      break;
    case 'trainer':
      startTrainerBattle(state, biome);
      break;
    case 'pokemon':
      spawnWild(state, biome, 0);
      break;
    case 'pokemonBonus':
      spawnWild(state, biome, cfg.pokemonBonusRarity);
      break;
    default:
      throw new Error(`Unhandled encounter outcome: ${outcome}`);
  }
  return outcome;
}

// Macro 01: one Explore over every biome of a mixed place. M02-1: a place
// with a local pool spawns from it, and its third eligible Explore is the
// guaranteed signature encounter (no encounter roll).
export function exploreMixed(state, biomes, { fatigue = 0 } = {}) {
  const cfg = state.config;
  const player = currentPlayer(state);
  const place = player.location;
  const local = Boolean(localPool(place, cfg));
  if (local && signatureDue(player, place, cfg)) {
    log(state, 'encounter', `Fresh tracks! ${player.name} follows them to one of ${getLocation(place).name}'s own Pokémon.`, { signature: { place, guaranteed: true } });
    spawnLocal(state, place, 0, { signatureOnly: true });
    return 'pokemon';
  }
  const roll = d6(state, 'Encounter', (v) => OUTCOME_LABELS[encounterOutcomeFromRoll(v, cfg)]);
  if (hideFromTired(state, roll, fatigue)) return 'nothing';
  const outcome = encounterOutcomeFromRoll(roll, cfg);
  const area = () => pick(state, 'Area', biomes, (b) => BIOMES[b].name);
  switch (outcome) {
    case 'nothing':
      log(state, 'encounter', 'All quiet. Nothing happens.');
      break;
    case 'event':
      drawEvent(state, { biome: area() });
      break;
    case 'trainer':
      startTrainerBattle(state, area());
      break;
    case 'pokemon':
      if (local) spawnLocal(state, place, 0);
      else spawnWildFrom(state, biomes, 0);
      break;
    case 'pokemonBonus':
      if (local) spawnLocal(state, place, cfg.pokemonBonusRarity);
      else spawnWildFrom(state, biomes, cfg.pokemonBonusRarity);
      break;
    default:
      throw new Error(`Unhandled encounter outcome: ${outcome}`);
  }
  return outcome;
}

// A wild Pokémon here (an Explore's biome, or an event's). M02-1: a place with
// a local pool spawns from it.
export function spawnWild(state, biome, rarityBonus = 0) {
  const place = currentPlayer(state).location;
  if (localPool(place, state.config)) return spawnLocal(state, place, rarityBonus);
  return spawnWildFrom(state, [biome], rarityBonus);
}

function rollRarity(state, rarityBonus) {
  const cfg = state.config;
  let total;
  d6(state, 'Rarity', (v) => {
    total = Math.min(6, v + rarityBonus);
    const label = RARITY_LABELS[rarityFromRoll(total, cfg)];
    return rarityBonus ? `+${rarityBonus} bonus = ${total} -> ${label}` : label;
  });
  return rarityFromRoll(total, cfg);
}

// M02-1: a wild Pokémon of this place's own pool (signature species only for
// the guaranteed encounter). The rarity roll and its fallback as everywhere.
// PLAYTEST_006 C3 (rules.iconicWild, PT006-02) — MEASUREMENT, never a default without Piotr (no new die
// before a weighted alternative and a paper test): Charizard / Blastoise / Venusaur, each on a route with
// no Super Rare of its own. A Super Rare roll there brings the iconic Pokémon only when 'w4' a weighted
// draw keeps it (1 : 3) or 'd6' an extra d6 shows 6 — otherwise the place's fallback, as today.
export const ICONIC_WILD = Object.freeze({ 'route-7': 'charizard', 'route-25': 'blastoise', 'route-24': 'venusaur' });

function iconicKept(state, species) {
  if (state.config.rules.iconicWild === 'd6') return d6(state, 'Iconic', (v) => (v === 6 ? `${getSpecies(species).name}!` : 'not this time')) === 6;
  return weightedPick(state, 'Iconic', [true, false], (x) => (x ? 1 : 3), (x) => (x ? getSpecies(species).name : 'the usual Pokémon'));
}

function spawnLocal(state, place, rarityBonus, { signatureOnly = false } = {}) {
  const cfg = state.config;
  const rolled = rollRarity(state, rarityBonus);
  const iconic = cfg.rules.iconicWild && rolled === 'superRare' && !signatureOnly ? ICONIC_WILD[place] : null;
  if (iconic) {
    const kept = iconicKept(state, iconic);
    log(state, 'info', `${getLocation(place).name}: the iconic ${getSpecies(iconic).name} ${kept ? 'appears!' : 'is not here this time.'}`, { iconic: { species: iconic, gate: cfg.rules.iconicWild, kept } });
    if (kept) {
      const biomes = locationBiomes(place, cfg);
      return appear(state, getSpecies(iconic), getSpecies(iconic).biomes.find((b) => biomes.includes(b)) ?? biomes[0]);
    }
  }
  const { rarity, entries, fellBack } = resolveLocalPool(place, rolled, cfg, { signatureOnly });
  const name = getLocation(place).name;
  if (!entries.length) {
    log(state, 'warn', `No Pokémon live at ${name}. Nothing appears.`);
    return null;
  }
  // PT006-01: the table shows the rarity that actually appears (data), not only the rolled one
  if (fellBack) log(state, 'warn', `No ${RARITY_LABELS[rolled]} ${signatureOnly ? 'signature ' : ''}Pokémon at ${name}; using ${RARITY_LABELS[rarity]}.`, { rarityFallback: { rolled, rarity } });
  const entry = weightedPick(state, signatureOnly ? 'Signature Pokémon' : 'Spawn', entries, (e) => poolWeight(e, cfg), (e) => e.species.name);
  const biomes = locationBiomes(place, cfg);
  return appear(state, entry.species, entry.species.biomes.find((b) => biomes.includes(b)) ?? biomes[0]);
}

function spawnWildFrom(state, biomes, rarityBonus) {
  const cfg = state.config;
  const one = biomes.length === 1;
  let total;
  d6(state, 'Rarity', (v) => {
    total = Math.min(6, v + rarityBonus);
    const label = RARITY_LABELS[rarityFromRoll(total, cfg)];
    return rarityBonus ? `+${rarityBonus} bonus = ${total} -> ${label}` : label;
  });
  const rolled = rarityFromRoll(total, cfg);
  const { rarity, pool, fellBack } = resolveMixedPool(biomes, rolled, cfg);
  const where = () => biomes.map((b) => BIOMES[b].name).join(' + ');
  if (!pool.length) {
    log(state, 'warn', one ? `No Pokémon live in biome "${biomes[0]}". Nothing appears.` : `No Pokémon live here (${where()}). Nothing appears.`);
    return null;
  }
  if (fellBack) log(state, 'warn', `No ${RARITY_LABELS[rolled]} Pokémon in ${where()}; using ${RARITY_LABELS[rarity]}.`, { rarityFallback: { rolled, rarity } });

  const species = pick(state, 'Spawn', pool, (s) => s.name);
  const biome = one ? biomes[0] : biomes.find((b) => species.biomes.includes(b));
  return appear(state, species, biome);
}

export const appearWild = (state, species, biome) => appear(state, species, biome); // Build 3.3 E4 (huntEngine)

function appear(state, species, biome) {
  const wild = createPokemonInstance(state, species.id);
  const player = currentPlayer(state);
  markSeen(player, species.id);
  noteSighting(player, species.id, player.location, state.config); // M02-1 games only
  const ballsAtStart = ballCount(player);
  state.encounter = { kind: 'wild', biome, pokemon: wild, playerFainted: false, throws: 0, fights: 0, captureFails: 0, ballsAtStart };
  state.phase = 'encounter';
  log(state, 'encounter', `A wild ${species.name} appears! ${RARITY_LABELS[species.rarity]} · ❤${species.hp} · ⚔${species.attack >= 0 ? '+' : ''}${species.attack} · ${species.types.map((t) => TYPE_ICONS[t]).join('')}`);
  return wild;
}

export function startTrainerBattle(state, biome) {
  const trainer = generateTrainer(state, biome);
  const player = currentPlayer(state);
  for (const p of trainer.pokemonTeam) markSeen(player, p.species);
  state.encounter = { kind: 'trainer', biome, trainer, index: 0, playerFainted: false };
  state.phase = 'encounter';
  markLeadPick(state); // Playtest 004 (DQ-107): who starts it — the battle's first step
  const team = trainer.pokemonTeam.map((p) => getSpecies(p.species).name).join(', ');
  log(state, 'encounter', `${trainer.name} challenges ${player.name}! (${trainer.difficulty}, team: ${team}, reward ${trainer.reward})`);
  return trainer;
}

// Every encounter ends here exactly once, so the Evolution Star award (max 1 per
// encounter; Phase 2 star games) or the battle's Growth (Growth games), and the
// catch / trainer-win mission events live here too.
export function endEncounter(state, result) {
  const enc = state.encounter;
  const player = currentPlayer(state);
  state.encounter = null;
  state.phase = 'turn';
  if (enc.kind === 'wild') recordWildEncounter(player, enc);
  if (usesGrowth(state)) settleGrowth(state, enc, result);
  else if (state.config.evolution.starOutcomes.includes(result)) awardStars(state, state.config.evolution.starsPerEncounter, result);
  afterBattle(state, player, enc, result); // bonus 2, 14.10 (rules.characterTraits): Ash
  if (result === 'caught' && enc.fishing) player.stats.fishing.caught += 1; // bonus 14.10: FISHING ROOKIE
  if (result === 'caught') {
    recordQuestEvent(state, player, { kind: 'catch', species: enc.pokemon.species, location: player.location, biome: enc.biome, ...(enc.questEncounter ? { questEncounter: enc.questEncounter } : {}) });
  } else if (enc.questEncounter) {
    recordQuestEvent(state, player, { kind: 'questEncounterLost', questEncounter: enc.questEncounter, result }); // PLAYTEST_006 C4: R2 „Nowy trop”
  } else if (result === 'trainerWon') {
    recordQuestEvent(state, player, { kind: 'trainerWin', location: player.location, biome: enc.biome, flawless: !enc.playerFainted, ...(enc.seq != null ? { battleSeq: enc.seq } : {}), ...(enc.questChallenge ? { questChallenge: enc.questChallenge } : {}) });
  } else if (result === 'rocketWon' && enc.seq != null) {
    recordQuestEvent(state, player, { kind: 'rocketWin', location: player.location, battleSeq: enc.seq }); // Build 3.3 E3
  }
  return result;
}
