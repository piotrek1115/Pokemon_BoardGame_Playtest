// Phase 3B Macro 02 — M02-1 (rules.localPools 'v2', new games): every place
// explores its own explicit pool (data/pools.js), its signature species are
// guaranteed within a bounded number of Explores, and the Pokédex says where to
// look. docs/PHASE_3B_MACRO_02.md §2.2 – §2.3.
//
// The signature guarantee (a bounded route, not a conditional draw):
// - An ELIGIBLE Explore is an Explore action at a place that has a local pool
//   with a signature species of the game's roster, by a player who has not yet
//   met one of that place's signature species in the wild there.
// - `player.signature.explores[place]` counts the eligible Explores that have
//   resolved — whatever they found (nothing, an event, a trainer, a Pokémon,
//   Team Rocket); `player.signature.seen` lists the places where the player met
//   a signature species (drawn naturally or guaranteed).
// - The THIRD eligible Explore (two already counted) does not roll the
//   encounter die: it is a wild encounter with a signature species. The rarity
//   die is rolled as usual (the rarity bonus too); the species comes from the
//   place's signature list of that rarity, falling back like every pool
//   (CONFIG.rarityFallback) to the nearest rarity that has one.
// - Team Rocket first: where a plot makes exploring find only Team Rocket, that
//   Explore is a Rocket battle (it still counts). The plot is visible, can be
//   challenged, and leaves on its clock.
// - Fatigue (M02-2, not yet built): the guaranteed Explore is still an Explore
//   (it will read and raise fatigue like any); its outcome is never turned into
//   „Cisza”; fatigue's Growth rules still apply to the battle.
// Older games (localPools 'v1') never reach any of this: no counters, no extra
// draws, the same RNG consumption as before.
import { LOCAL_POOLS, POOL_WEIGHTS } from '../data/pools.js';
import { getSpecies } from '../data/pokemon.js';
import { isLocationEnabled } from '../data/locations.js';

export const SIGNATURE_GUARANTEE_AFTER = 2; // eligible Explores before the guaranteed one

export function usesLocalPools(config) {
  return config.rules.localPools === 'v2';
}

// This place's explicit pool in this game, or null (older games; a place with no table).
export function localPool(place, config) {
  if (!usesLocalPools(config)) return null;
  return LOCAL_POOLS[place] ?? null;
}

// Build 3.3 E1 (spec §6, group G1): an ORDINARY final form — the last form of its line
// (no evolution), stage 2+, Rare. The 34 background finals behind „1.3 finals caught
// a game”. rules.finalRarity — MEASUREMENT variants only (Piotr chooses, DEC-18):
//   'v1' as today; 'R1' a background G1 final weighs ½; 'R2' a Super Rare roll at a
//   place without one falls back to Common (not Rare); 'R3' a G1 final keeps its
//   encounters but rolls the Super Rare Catch Die (captureEngine); 'R4' G1 finals
//   leave the background pools (a signature species always stays).
export function isOrdinaryFinal(species) {
  return !species.evolution && species.stage >= 2 && species.rarity === 'rare';
}

// The place's species of one rarity: [{ species, signature }].
export function localPoolEntries(place, rarity, config, { signatureOnly = false } = {}) {
  const pool = localPool(place, config);
  if (!pool) return [];
  const r4 = config.rules.finalRarity === 'R4';
  const entries = [
    ...pool.signature.map((id) => ({ species: getSpecies(id), signature: true })),
    ...(signatureOnly ? [] : pool.background.map((id) => ({ species: getSpecies(id), signature: false })).filter((e) => !(r4 && isOrdinaryFinal(e.species)))),
  ];
  return entries.filter((e) => e.species.rarity === rarity);
}

const R2_FALLBACK = { superRare: ['superRare', 'common', 'rare'] };

export function resolveLocalPool(place, rolledRarity, config, opts = {}) {
  const order = (config.rules.finalRarity === 'R2' && R2_FALLBACK[rolledRarity]) || config.rarityFallback[rolledRarity];
  for (const rarity of order) {
    const entries = localPoolEntries(place, rarity, config, opts);
    if (entries.length) return { rarity, entries, fellBack: rarity !== rolledRarity };
  }
  return { rarity: null, entries: [], fellBack: true };
}

export function poolWeight(entry, config = null) {
  if (entry.signature) return POOL_WEIGHTS.signature;
  return config?.rules.finalRarity === 'R1' && isOrdinaryFinal(entry.species) ? POOL_WEIGHTS.background / 2 : POOL_WEIGHTS.background;
}

// Every species this place can spawn in this game (any rarity), signature first.
export function placeSpecies(place, config) {
  const pool = localPool(place, config);
  if (!pool) return [];
  return [...new Set([...pool.signature, ...pool.background])].map(getSpecies);
}

export function signatureSpecies(place, config) {
  const pool = localPool(place, config);
  return pool ? [...pool.signature] : [];
}

// ---- the guarantee -----------------------------------------------------------

function eligible(player, place, config) {
  return Boolean(player.signature) && signatureSpecies(place, config).length > 0 && !player.signature.seen.includes(place);
}

// Is this player's Explore here the guaranteed one?
export function signatureDue(player, place, config) {
  return eligible(player, place, config) && (player.signature.explores[place] ?? 0) >= SIGNATURE_GUARANTEE_AFTER;
}

// An Explore here has resolved (whatever it found): count it while still eligible.
export function noteLocalExplore(player, place, config) {
  if (!eligible(player, place, config)) return;
  player.signature.explores[place] = (player.signature.explores[place] ?? 0) + 1;
}

// A wild Pokémon appeared here: the Pokédex hint, and a signature met.
export function noteSighting(player, speciesId, place, config) {
  if (!player.seenAt) return;
  const at = (player.seenAt[speciesId] ??= []);
  if (!at.includes(place)) at.push(place);
  if (player.signature && signatureSpecies(place, config).includes(speciesId) && !player.signature.seen.includes(place)) player.signature.seen.push(place);
}

// ---- Pokédex hints -------------------------------------------------------------

// Where this player should look for a species they know (ChatGPT 12.10 — M02-1
// correction 2), on the game's own board, each place once:
//   home     where it is a signature species (emphasized),
//   habitat  the other places whose pool has it (its background places),
//   seen     where this player met it in the wild, if neither of the above;
//   met      every place (on this board) where this player met it — a home or
//            habitat place met is marked on its own chip instead of repeated.
// Nothing for a species the player has not met yet (no spoilers) or in older
// games. Reads only — never changes the game.
export function whereToFind(player, speciesId, config) {
  if (!usesLocalPools(config) || !player.pokedex.seen.includes(speciesId)) return null;
  const onBoard = Object.entries(LOCAL_POOLS).filter(([id]) => isLocationEnabled(id, config));
  const home = onBoard.filter(([, pool]) => pool.signature.includes(speciesId)).map(([id]) => id);
  const habitat = onBoard.filter(([id, pool]) => pool.background.includes(speciesId) && !home.includes(id)).map(([id]) => id);
  const met = [...new Set(player.seenAt?.[speciesId] ?? [])].filter((id) => isLocationEnabled(id, config));
  const seen = met.filter((id) => !home.includes(id) && !habitat.includes(id));
  return { home, habitat, seen, met };
}
