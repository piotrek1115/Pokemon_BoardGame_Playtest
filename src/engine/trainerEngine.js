// Trainer generator: data-driven trainers built from archetypes in
// data/trainers.js and difficulty tables in CONFIG.trainers.
import { TRAINER_ARCHETYPES } from '../data/trainers.js';
import { POKEMON, isWild } from '../data/pokemon.js';
import { d6, pick } from './rng.js';
import { createPokemonInstance } from './gameState.js';

export function difficultyFromRoll(roll, config) {
  for (const [difficulty, faces] of Object.entries(config.trainers.difficultyRoll)) {
    if (faces.includes(roll)) return difficulty;
  }
  throw new Error(`No trainer difficulty configured for d6=${roll}`);
}

export function archetypesForBiome(biome) {
  const local = TRAINER_ARCHETYPES.filter((a) => a.biomes.includes(biome));
  return local.length ? local : TRAINER_ARCHETYPES;
}

// Species the trainer may use: archetype types first, then the biome, then anything
// of an allowed rarity.
export function trainerSpeciesPool(archetype, biome, rarities) {
  const allowed = POKEMON.filter((p) => isWild(p) && rarities.includes(p.rarity));
  const typed = allowed.filter((p) => p.types.some((t) => archetype.types.includes(t)));
  if (typed.length) return typed;
  const local = allowed.filter((p) => p.biomes.includes(biome));
  if (local.length) return local;
  return allowed;
}

export function generateTrainer(state, biome) {
  const cfg = state.config;
  const archetype = pick(state, 'Trainer type', archetypesForBiome(biome), (a) => a.name);
  const name = pick(state, 'Trainer name', archetype.names);
  const difficulty = difficultyFromRoll(d6(state, 'Trainer difficulty', (v) => difficultyFromRoll(v, cfg)), cfg);
  const pool = trainerSpeciesPool(archetype, biome, cfg.trainers.allowedRarities[difficulty]);
  const pokemonTeam = [];
  for (let i = 0; i < cfg.trainers.teamSize[difficulty]; i++) {
    const species = pick(state, `Trainer Pokémon ${i + 1}`, pool, (s) => s.name);
    pokemonTeam.push(createPokemonInstance(state, species.id));
  }
  return {
    name: `${archetype.name} ${name}`,
    archetype: archetype.id,
    difficulty,
    pokemonTeam,
    reward: cfg.trainers.reward[difficulty],
  };
}
