// Encounter engine: the Explore roll and what it produces (nothing / event /
// trainer / wild Pokémon). Wild spawns filter the species pool by biome, then
// by rarity. All tables come from CONFIG; all rolls are logged.
import { POKEMON, getSpecies, isWild, RARITY_LABELS } from '../data/pokemon.js';
import { BIOMES } from '../data/biomes.js';
import { TYPE_ICONS } from '../data/types.js';
import { d6, pick } from './rng.js';
import { log } from './log.js';
import { createPokemonInstance, currentPlayer, markSeen } from './gameState.js';
import { generateTrainer } from './trainerEngine.js';
import { drawEvent } from './eventEngine.js';
import { awardStars } from './evolutionEngine.js';
import { settleGrowth, usesGrowth } from './growthEngine.js';
import { recordQuestEvent } from './questEngine.js';
import { recordWildEncounter } from './captureEngine.js';

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

// Pool for a biome + rolled rarity, falling back per CONFIG.rarityFallback when
// the biome has no species of that rarity.
export function resolveSpawnPool(biome, rolledRarity, config) {
  for (const rarity of config.rarityFallback[rolledRarity]) {
    const pool = speciesFor(biome, rarity);
    if (pool.length) return { rarity, pool, fellBack: rarity !== rolledRarity };
  }
  return { rarity: null, pool: [], fellBack: true };
}

export function explore(state, biome) {
  const cfg = state.config;
  const roll = d6(state, 'Encounter', (v) => OUTCOME_LABELS[encounterOutcomeFromRoll(v, cfg)]);
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

export function spawnWild(state, biome, rarityBonus = 0) {
  const cfg = state.config;
  let total;
  d6(state, 'Rarity', (v) => {
    total = Math.min(6, v + rarityBonus);
    const label = RARITY_LABELS[rarityFromRoll(total, cfg)];
    return rarityBonus ? `+${rarityBonus} bonus = ${total} -> ${label}` : label;
  });
  const rolled = rarityFromRoll(total, cfg);
  const { rarity, pool, fellBack } = resolveSpawnPool(biome, rolled, cfg);
  if (!pool.length) {
    log(state, 'warn', `No Pokémon live in biome "${biome}". Nothing appears.`);
    return null;
  }
  if (fellBack) log(state, 'warn', `No ${RARITY_LABELS[rolled]} Pokémon in ${BIOMES[biome].name}; using ${RARITY_LABELS[rarity]}.`);

  const species = pick(state, 'Spawn', pool, (s) => s.name);
  const wild = createPokemonInstance(state, species.id);
  const player = currentPlayer(state);
  markSeen(player, species.id);
  const ballsAtStart = player.pokeballs + (player.items?.superball ?? 0);
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
  if (result === 'caught') {
    recordQuestEvent(state, player, { kind: 'catch', species: enc.pokemon.species, location: player.location, biome: enc.biome });
  } else if (result === 'trainerWon') {
    recordQuestEvent(state, player, { kind: 'trainerWin', location: player.location, biome: enc.biome, flawless: !enc.playerFainted });
  }
  return result;
}
