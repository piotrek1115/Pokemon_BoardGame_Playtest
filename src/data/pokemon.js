// Kanto Pokémon content (Gen 1 only): 129 species — the prototype's 74 (38
// original species plus the evolved forms of their families, covering every
// biome x rarity) and WAVE1, the 55 of Macro 02 M02-1 (12.10.2026). The shape
// is meant to scale to the full Kanto dex.
//
//   hp         card HP (small integers, icon-friendly)
//   attack     attack modifier added to the d6 attack roll
//   types      Gen 1 types; the first one is the attack type unless `attackType` is set
//   rarity     common | rare | superRare. In evolution families it follows the
//              stage, like the physical deck (stage 1 x3, stage 2 x2, stage 3 x1):
//              stage 1 Common, stage 2 Rare, stage 3 Super Rare (DQ-24, tested).
//              Pokémon without an evolution keep a content-defined rarity.
//   rarityException  id of the accepted design decision that lets this form
//              deviate from the stage rule (e.g. Gyarados Super Rare, DQ-28)
//   biomes     where the species can spawn (may be several)
//   family     evolution family id (id of the stage-1 form)
//   stage      1..3 within the family
//   evolution  the evolution edge, absent on final forms (and forms not modelled yet):
//              { to, growth, mode, item? }
//                to      next species id (`evolvesTo` is derived from it)
//                growth  Growth this Pokémon needs on this edge (Phase 3A, rules
//                        evolution 'growth'; DQ-74…79). The Phase 2 star model
//                        ignores it and pays CONFIG.evolution.starCost by stage.
//                mode    'participation' (Growth from battles it took part in) |
//                        'partyVictory' (cocoons: may also take one Growth of a
//                        won battle just by being in the active team, DQ-77)
//                item    evolution item consumed on evolving (stones, DQ-78)
//              Values are a content table per edge, not a formula. Bands as
//              a guide: FAST 2 + 2 (Caterpie, Weedle); COMPANION 4 + 6 (Bulbasaur,
//              Charmander, Squirtle and — DQ-01 starter parity — Geodude), the
//              starters Pikachu / Staryu 6 + stone; STANDARD ~3–5 by family.
//   wild       optional; false = never spawns or joins trainer teams. Unused —
//              kept as a content lever (e.g. legendaries later).
//
// Stats are working values for testing, not final balance.

const PROTOTYPE_SPECIES = [
  { id: 'bulbasaur', dex: 1, name: 'Bulbasaur', types: ['grass', 'poison'], hp: 4, attack: 1, rarity: 'common', biomes: ['grass'], family: 'bulbasaur', stage: 1, evolution: { to: 'ivysaur', growth: 4, mode: 'participation' } },
  { id: 'charmander', dex: 4, name: 'Charmander', types: ['fire'], hp: 4, attack: 1, rarity: 'common', biomes: ['grass'], family: 'charmander', stage: 1, evolution: { to: 'charmeleon', growth: 4, mode: 'participation' } },
  { id: 'squirtle', dex: 7, name: 'Squirtle', types: ['water'], hp: 4, attack: 1, rarity: 'common', biomes: ['beach'], family: 'squirtle', stage: 1, evolution: { to: 'wartortle', growth: 4, mode: 'participation' } },
  { id: 'caterpie', dex: 10, name: 'Caterpie', types: ['bug'], hp: 2, attack: 0, rarity: 'common', biomes: ['forest'], family: 'caterpie', stage: 1, evolution: { to: 'metapod', growth: 2, mode: 'participation' } },
  { id: 'weedle', dex: 13, name: 'Weedle', types: ['bug', 'poison'], hp: 2, attack: 0, rarity: 'common', biomes: ['forest'], family: 'weedle', stage: 1, evolution: { to: 'kakuna', growth: 2, mode: 'participation' } },
  { id: 'pidgey', dex: 16, name: 'Pidgey', types: ['normal', 'flying'], attackType: 'flying', hp: 3, attack: 0, rarity: 'common', biomes: ['grass', 'forest', 'air'], family: 'pidgey', stage: 1, evolution: { to: 'pidgeotto', growth: 3, mode: 'participation' } },
  { id: 'pidgeotto', dex: 17, name: 'Pidgeotto', types: ['normal', 'flying'], attackType: 'flying', hp: 5, attack: 1, rarity: 'rare', biomes: ['grass', 'air'], family: 'pidgey', stage: 2, evolution: { to: 'pidgeot', growth: 5, mode: 'participation' } },
  { id: 'rattata', dex: 19, name: 'Rattata', types: ['normal'], hp: 3, attack: 0, rarity: 'common', biomes: ['grass', 'city'], family: 'rattata', stage: 1, evolution: { to: 'raticate', growth: 3, mode: 'participation' } },
  { id: 'spearow', dex: 21, name: 'Spearow', types: ['normal', 'flying'], attackType: 'flying', hp: 3, attack: 0, rarity: 'common', biomes: ['grass', 'air'], family: 'spearow', stage: 1, evolution: { to: 'fearow', growth: 4, mode: 'participation' } },
  { id: 'pikachu', dex: 25, name: 'Pikachu', types: ['electric'], hp: 4, attack: 1, rarity: 'common', biomes: ['forest', 'city'], family: 'pikachu', stage: 1, evolution: { to: 'raichu', growth: 6, mode: 'participation', item: 'thunderstone' } },
  { id: 'clefairy', dex: 35, name: 'Clefairy', types: ['normal'], hp: 4, attack: 0, rarity: 'common', biomes: ['cave'], family: 'clefairy', stage: 1, evolution: { to: 'clefable', growth: 3, mode: 'participation', item: 'moonstone' } },
  { id: 'zubat', dex: 41, name: 'Zubat', types: ['poison', 'flying'], hp: 3, attack: 0, rarity: 'common', biomes: ['cave', 'air'], family: 'zubat', stage: 1, evolution: { to: 'golbat', growth: 3, mode: 'participation' } },
  { id: 'oddish', dex: 43, name: 'Oddish', types: ['grass', 'poison'], hp: 3, attack: 0, rarity: 'common', biomes: ['grass', 'forest'], family: 'oddish', stage: 1, evolution: { to: 'gloom', growth: 3, mode: 'participation' } },
  { id: 'diglett', dex: 50, name: 'Diglett', types: ['ground'], hp: 2, attack: 1, rarity: 'common', biomes: ['cave'], family: 'diglett', stage: 1, evolution: { to: 'dugtrio', growth: 3, mode: 'participation' } },
  { id: 'meowth', dex: 52, name: 'Meowth', types: ['normal'], hp: 3, attack: 0, rarity: 'common', biomes: ['city'], family: 'meowth', stage: 1, evolution: { to: 'persian', growth: 3, mode: 'participation' } },
  { id: 'psyduck', dex: 54, name: 'Psyduck', types: ['water'], hp: 4, attack: 0, rarity: 'common', biomes: ['water'], family: 'psyduck', stage: 1, evolution: { to: 'golduck', growth: 4, mode: 'participation' } },
  { id: 'growlithe', dex: 58, name: 'Growlithe', types: ['fire'], hp: 4, attack: 1, rarity: 'common', biomes: ['grass', 'city'], family: 'growlithe', stage: 1, evolution: { to: 'arcanine', growth: 4, mode: 'participation', item: 'firestone' } },
  { id: 'poliwag', dex: 60, name: 'Poliwag', types: ['water'], hp: 3, attack: 0, rarity: 'common', biomes: ['water'], family: 'poliwag', stage: 1, evolution: { to: 'poliwhirl', growth: 3, mode: 'participation' } },
  { id: 'abra', dex: 63, name: 'Abra', types: ['psychic'], hp: 2, attack: 1, rarity: 'common', biomes: ['city', 'grass'], family: 'abra', stage: 1, evolution: { to: 'kadabra', growth: 4, mode: 'participation' } },
  { id: 'tentacool', dex: 72, name: 'Tentacool', types: ['water', 'poison'], hp: 3, attack: 0, rarity: 'common', biomes: ['sea', 'beach'], family: 'tentacool', stage: 1, evolution: { to: 'tentacruel', growth: 4, mode: 'participation' } },
  { id: 'geodude', dex: 74, name: 'Geodude', types: ['rock', 'ground'], hp: 4, attack: 1, rarity: 'common', biomes: ['cave'], family: 'geodude', stage: 1, evolution: { to: 'graveler', growth: 4, mode: 'participation' } },
  { id: 'slowpoke', dex: 79, name: 'Slowpoke', types: ['water', 'psychic'], hp: 5, attack: 0, rarity: 'common', biomes: ['water', 'beach'], family: 'slowpoke', stage: 1, evolution: { to: 'slowbro', growth: 4, mode: 'participation' } },
  { id: 'magnemite', dex: 81, name: 'Magnemite', types: ['electric'], hp: 3, attack: 1, rarity: 'common', biomes: ['city'], family: 'magnemite', stage: 1, evolution: { to: 'magneton', growth: 4, mode: 'participation' } },
  { id: 'seel', dex: 86, name: 'Seel', types: ['water'], hp: 5, attack: 1, rarity: 'common', biomes: ['sea'], family: 'seel', stage: 1, evolution: { to: 'dewgong', growth: 4, mode: 'participation' } },
  { id: 'gastly', dex: 92, name: 'Gastly', types: ['ghost', 'poison'], hp: 3, attack: 1, rarity: 'common', biomes: ['haunted'], family: 'gastly', stage: 1, evolution: { to: 'haunter', growth: 4, mode: 'participation' } },
  { id: 'haunter', dex: 93, name: 'Haunter', types: ['ghost', 'poison'], hp: 5, attack: 2, rarity: 'rare', biomes: ['haunted'], family: 'gastly', stage: 2, evolution: { to: 'gengar', growth: 5, mode: 'participation' } },
  { id: 'gengar', dex: 94, name: 'Gengar', types: ['ghost', 'poison'], hp: 7, attack: 3, rarity: 'superRare', biomes: ['haunted'], family: 'gastly', stage: 3 },
  { id: 'onix', dex: 95, name: 'Onix', types: ['rock', 'ground'], hp: 7, attack: 1, rarity: 'rare', biomes: ['cave'], family: 'onix', stage: 1 },
  { id: 'krabby', dex: 98, name: 'Krabby', types: ['water'], hp: 3, attack: 1, rarity: 'common', biomes: ['beach'], family: 'krabby', stage: 1, evolution: { to: 'kingler', growth: 3, mode: 'participation' } },
  { id: 'staryu', dex: 120, name: 'Staryu', types: ['water'], hp: 4, attack: 1, rarity: 'common', biomes: ['beach', 'sea'], family: 'staryu', stage: 1, evolution: { to: 'starmie', growth: 6, mode: 'participation', item: 'waterstone' } },
  { id: 'scyther', dex: 123, name: 'Scyther', types: ['bug', 'flying'], hp: 6, attack: 2, rarity: 'superRare', biomes: ['forest', 'grass'], family: 'scyther', stage: 1 },
  { id: 'magikarp', dex: 129, name: 'Magikarp', types: ['water'], hp: 2, attack: -1, rarity: 'common', biomes: ['water', 'sea'], family: 'magikarp', stage: 1, evolution: { to: 'gyarados', growth: 5, mode: 'participation' } },
  { id: 'gyarados', dex: 130, name: 'Gyarados', types: ['water', 'flying'], hp: 8, attack: 3, rarity: 'superRare', rarityException: 'DQ-28', biomes: ['water', 'sea'], family: 'magikarp', stage: 2 },
  { id: 'lapras', dex: 131, name: 'Lapras', types: ['water', 'ice'], hp: 8, attack: 2, rarity: 'superRare', biomes: ['sea'], family: 'lapras', stage: 1 },
  { id: 'eevee', dex: 133, name: 'Eevee', types: ['normal'], hp: 4, attack: 1, rarity: 'superRare', biomes: ['city'], family: 'eevee', stage: 1 },
  { id: 'aerodactyl', dex: 142, name: 'Aerodactyl', types: ['rock', 'flying'], hp: 7, attack: 2, rarity: 'superRare', biomes: ['cave', 'air'], family: 'aerodactyl', stage: 1 },

  // Evolved forms. They spawn and join trainer teams like any other species,
  // in a subset of their family's biomes (DQ-24).
  { id: 'ivysaur', dex: 2, name: 'Ivysaur', types: ['grass', 'poison'], hp: 6, attack: 2, rarity: 'rare', biomes: ['grass'], family: 'bulbasaur', stage: 2, evolution: { to: 'venusaur', growth: 6, mode: 'participation' } },
  { id: 'venusaur', dex: 3, name: 'Venusaur', types: ['grass', 'poison'], hp: 7, attack: 3, rarity: 'superRare', biomes: ['grass'], family: 'bulbasaur', stage: 3 },
  { id: 'charmeleon', dex: 5, name: 'Charmeleon', types: ['fire'], hp: 6, attack: 2, rarity: 'rare', biomes: ['grass'], family: 'charmander', stage: 2, evolution: { to: 'charizard', growth: 6, mode: 'participation' } },
  { id: 'charizard', dex: 6, name: 'Charizard', types: ['fire', 'flying'], hp: 7, attack: 3, rarity: 'superRare', biomes: ['grass'], family: 'charmander', stage: 3 },
  { id: 'wartortle', dex: 8, name: 'Wartortle', types: ['water'], hp: 6, attack: 2, rarity: 'rare', biomes: ['beach'], family: 'squirtle', stage: 2, evolution: { to: 'blastoise', growth: 6, mode: 'participation' } },
  { id: 'blastoise', dex: 9, name: 'Blastoise', types: ['water'], hp: 7, attack: 3, rarity: 'superRare', biomes: ['beach'], family: 'squirtle', stage: 3 },
  { id: 'metapod', dex: 11, name: 'Metapod', types: ['bug'], hp: 4, attack: 0, rarity: 'rare', biomes: ['forest'], family: 'caterpie', stage: 2, evolution: { to: 'butterfree', growth: 2, mode: 'partyVictory' } },
  { id: 'butterfree', dex: 12, name: 'Butterfree', types: ['bug', 'flying'], hp: 6, attack: 2, rarity: 'superRare', biomes: ['forest'], family: 'caterpie', stage: 3 },
  { id: 'kakuna', dex: 14, name: 'Kakuna', types: ['bug', 'poison'], hp: 4, attack: 0, rarity: 'rare', biomes: ['forest'], family: 'weedle', stage: 2, evolution: { to: 'beedrill', growth: 2, mode: 'partyVictory' } },
  { id: 'beedrill', dex: 15, name: 'Beedrill', types: ['bug', 'poison'], hp: 6, attack: 2, rarity: 'superRare', biomes: ['forest'], family: 'weedle', stage: 3 },
  { id: 'pidgeot', dex: 18, name: 'Pidgeot', types: ['normal', 'flying'], attackType: 'flying', hp: 7, attack: 2, rarity: 'superRare', biomes: ['air'], family: 'pidgey', stage: 3 },
  { id: 'raticate', dex: 20, name: 'Raticate', types: ['normal'], hp: 5, attack: 1, rarity: 'rare', biomes: ['grass', 'city'], family: 'rattata', stage: 2 },
  { id: 'fearow', dex: 22, name: 'Fearow', types: ['normal', 'flying'], attackType: 'flying', hp: 5, attack: 1, rarity: 'rare', biomes: ['air'], family: 'spearow', stage: 2 },
  { id: 'raichu', dex: 26, name: 'Raichu', types: ['electric'], hp: 6, attack: 2, rarity: 'rare', biomes: ['city'], family: 'pikachu', stage: 2 },
  { id: 'clefable', dex: 36, name: 'Clefable', types: ['normal'], hp: 6, attack: 1, rarity: 'rare', biomes: ['cave'], family: 'clefairy', stage: 2 },
  { id: 'golbat', dex: 42, name: 'Golbat', types: ['poison', 'flying'], hp: 5, attack: 1, rarity: 'rare', biomes: ['cave'], family: 'zubat', stage: 2 },
  { id: 'gloom', dex: 44, name: 'Gloom', types: ['grass', 'poison'], hp: 5, attack: 1, rarity: 'rare', biomes: ['forest'], family: 'oddish', stage: 2, evolution: { to: 'vileplume', growth: 4, mode: 'participation', item: 'leafstone' } },
  { id: 'vileplume', dex: 45, name: 'Vileplume', types: ['grass', 'poison'], hp: 7, attack: 2, rarity: 'superRare', biomes: ['forest'], family: 'oddish', stage: 3 },
  { id: 'dugtrio', dex: 51, name: 'Dugtrio', types: ['ground'], hp: 4, attack: 2, rarity: 'rare', biomes: ['cave'], family: 'diglett', stage: 2 },
  { id: 'persian', dex: 53, name: 'Persian', types: ['normal'], hp: 5, attack: 1, rarity: 'rare', biomes: ['city'], family: 'meowth', stage: 2 },
  { id: 'golduck', dex: 55, name: 'Golduck', types: ['water'], hp: 6, attack: 1, rarity: 'rare', biomes: ['water'], family: 'psyduck', stage: 2 },
  { id: 'arcanine', dex: 59, name: 'Arcanine', types: ['fire'], hp: 6, attack: 2, rarity: 'rare', biomes: ['grass'], family: 'growlithe', stage: 2 },
  { id: 'poliwhirl', dex: 61, name: 'Poliwhirl', types: ['water'], hp: 5, attack: 1, rarity: 'rare', biomes: ['water'], family: 'poliwag', stage: 2, evolution: { to: 'poliwrath', growth: 4, mode: 'participation', item: 'waterstone' } },
  { id: 'poliwrath', dex: 62, name: 'Poliwrath', types: ['water', 'fighting'], hp: 7, attack: 2, rarity: 'superRare', biomes: ['water'], family: 'poliwag', stage: 3 },
  { id: 'kadabra', dex: 64, name: 'Kadabra', types: ['psychic'], hp: 4, attack: 2, rarity: 'rare', biomes: ['city'], family: 'abra', stage: 2, evolution: { to: 'alakazam', growth: 5, mode: 'participation' } },
  { id: 'alakazam', dex: 65, name: 'Alakazam', types: ['psychic'], hp: 5, attack: 3, rarity: 'superRare', biomes: ['city'], family: 'abra', stage: 3 },
  { id: 'tentacruel', dex: 73, name: 'Tentacruel', types: ['water', 'poison'], hp: 5, attack: 1, rarity: 'rare', biomes: ['sea'], family: 'tentacool', stage: 2 },
  { id: 'graveler', dex: 75, name: 'Graveler', types: ['rock', 'ground'], hp: 6, attack: 2, rarity: 'rare', biomes: ['cave'], family: 'geodude', stage: 2, evolution: { to: 'golem', growth: 6, mode: 'participation' } },
  { id: 'golem', dex: 76, name: 'Golem', types: ['rock', 'ground'], hp: 7, attack: 3, rarity: 'superRare', biomes: ['cave'], family: 'geodude', stage: 3 },
  { id: 'slowbro', dex: 80, name: 'Slowbro', types: ['water', 'psychic'], hp: 7, attack: 1, rarity: 'rare', biomes: ['water'], family: 'slowpoke', stage: 2 },
  { id: 'magneton', dex: 82, name: 'Magneton', types: ['electric'], hp: 5, attack: 2, rarity: 'rare', biomes: ['city'], family: 'magnemite', stage: 2 },
  { id: 'dewgong', dex: 87, name: 'Dewgong', types: ['water', 'ice'], hp: 7, attack: 2, rarity: 'rare', biomes: ['sea'], family: 'seel', stage: 2 },
  { id: 'kingler', dex: 99, name: 'Kingler', types: ['water'], hp: 5, attack: 2, rarity: 'rare', biomes: ['beach'], family: 'krabby', stage: 2 },
  { id: 'starmie', dex: 121, name: 'Starmie', types: ['water', 'psychic'], hp: 6, attack: 2, rarity: 'rare', biomes: ['sea'], family: 'staryu', stage: 2 },

  // Jessie's Ekans / Arbok and James's Koffing / Weezing (Team Rocket, Step 4).
  // Ordinary wild species too (DQ-42): Ekans on Kanto's grass routes, Koffing
  // in polluted city spots (Pokémon Mansion, Power Plant). Only Rocket's own
  // Pokémon can't be caught — Rocket battles allow no Poké Balls.
  { id: 'ekans', dex: 23, name: 'Ekans', types: ['poison'], hp: 3, attack: 1, rarity: 'common', biomes: ['grass'], family: 'ekans', stage: 1, evolution: { to: 'arbok', growth: 3, mode: 'participation' } },
  { id: 'arbok', dex: 24, name: 'Arbok', types: ['poison'], hp: 5, attack: 2, rarity: 'rare', biomes: ['grass'], family: 'ekans', stage: 2 },
  { id: 'koffing', dex: 109, name: 'Koffing', types: ['poison'], hp: 4, attack: 0, rarity: 'common', biomes: ['city'], family: 'koffing', stage: 1, evolution: { to: 'weezing', growth: 4, mode: 'participation' } },
  { id: 'weezing', dex: 110, name: 'Weezing', types: ['poison'], hp: 6, attack: 1, rarity: 'rare', biomes: ['city'], family: 'koffing', stage: 2 },
];


// Phase 3B Macro 02 — M02-1 (12.10.2026): wave 1 of the full Kanto roster, 55
// species (docs/PHASE_3B_MACRO_02.md §2.4). PROVISIONAL stats on the same scale
// (stage 1 Common, stage 2 Rare, stage 3 Super Rare — DQ-24 / DQ-103; a species
// without an evolution keeps a content rarity), Growth per edge (+ 1 in
// evolutionGrowth 'v2' games), canon stones; trade evolutions (Machoke) evolve
// by Growth, like Kadabra / Graveler / Haunter. `biomes` drive the biome pools
// (rules.localPools 'v1') and trainers; new games explore the explicit
// per-place pools of data/pools.js.
//
// Content is current for every game (Piotr, 12.10.2026: each family test starts
// a new game — docs/conversation/2026-10-12-piotr-fresh-game-playtest-policy.md):
// an older save that plays on meets these species too.
export const WAVE1 = [
  { id: 'sandshrew', dex: 27, name: 'Sandshrew', types: ['ground'], hp: 4, attack: 1, rarity: 'common', biomes: ['grass', 'cave'], family: 'sandshrew', stage: 1, evolution: { to: 'sandslash', growth: 4, mode: 'participation' } },
  { id: 'sandslash', dex: 28, name: 'Sandslash', types: ['ground'], hp: 6, attack: 2, rarity: 'rare', biomes: ['grass'], family: 'sandshrew', stage: 2 },
  { id: 'nidoranf', dex: 29, name: 'Nidoran♀', types: ['poison'], hp: 3, attack: 0, rarity: 'common', biomes: ['grass'], family: 'nidoranf', stage: 1, evolution: { to: 'nidorina', growth: 3, mode: 'participation' } },
  { id: 'nidorina', dex: 30, name: 'Nidorina', types: ['poison'], hp: 5, attack: 1, rarity: 'rare', biomes: ['grass'], family: 'nidoranf', stage: 2, evolution: { to: 'nidoqueen', growth: 4, mode: 'participation', item: 'moonstone' } },
  { id: 'nidoqueen', dex: 31, name: 'Nidoqueen', types: ['poison', 'ground'], hp: 7, attack: 2, rarity: 'superRare', biomes: ['grass'], family: 'nidoranf', stage: 3 },
  { id: 'nidoranm', dex: 32, name: 'Nidoran♂', types: ['poison'], hp: 3, attack: 1, rarity: 'common', biomes: ['grass'], family: 'nidoranm', stage: 1, evolution: { to: 'nidorino', growth: 3, mode: 'participation' } },
  { id: 'nidorino', dex: 33, name: 'Nidorino', types: ['poison'], hp: 5, attack: 2, rarity: 'rare', biomes: ['grass'], family: 'nidoranm', stage: 2, evolution: { to: 'nidoking', growth: 4, mode: 'participation', item: 'moonstone' } },
  { id: 'nidoking', dex: 34, name: 'Nidoking', types: ['poison', 'ground'], hp: 7, attack: 3, rarity: 'superRare', biomes: ['grass'], family: 'nidoranm', stage: 3 },
  { id: 'vulpix', dex: 37, name: 'Vulpix', types: ['fire'], hp: 3, attack: 1, rarity: 'common', biomes: ['grass', 'city'], family: 'vulpix', stage: 1, evolution: { to: 'ninetales', growth: 4, mode: 'participation', item: 'firestone' } },
  { id: 'ninetales', dex: 38, name: 'Ninetales', types: ['fire'], hp: 6, attack: 2, rarity: 'rare', biomes: ['grass'], family: 'vulpix', stage: 2 },
  { id: 'jigglypuff', dex: 39, name: 'Jigglypuff', types: ['normal'], hp: 5, attack: 0, rarity: 'common', biomes: ['grass'], family: 'jigglypuff', stage: 1, evolution: { to: 'wigglytuff', growth: 3, mode: 'participation', item: 'moonstone' } },
  { id: 'wigglytuff', dex: 40, name: 'Wigglytuff', types: ['normal'], hp: 7, attack: 1, rarity: 'rare', biomes: ['grass'], family: 'jigglypuff', stage: 2 },
  { id: 'paras', dex: 46, name: 'Paras', types: ['bug', 'grass'], hp: 3, attack: 0, rarity: 'common', biomes: ['cave', 'forest'], family: 'paras', stage: 1, evolution: { to: 'parasect', growth: 3, mode: 'participation' } },
  { id: 'parasect', dex: 47, name: 'Parasect', types: ['bug', 'grass'], hp: 5, attack: 1, rarity: 'rare', biomes: ['cave', 'forest'], family: 'paras', stage: 2 },
  { id: 'venonat', dex: 48, name: 'Venonat', types: ['bug', 'poison'], hp: 3, attack: 0, rarity: 'common', biomes: ['forest', 'grass'], family: 'venonat', stage: 1, evolution: { to: 'venomoth', growth: 4, mode: 'participation' } },
  { id: 'venomoth', dex: 49, name: 'Venomoth', types: ['bug', 'poison'], hp: 5, attack: 1, rarity: 'rare', biomes: ['forest'], family: 'venonat', stage: 2 },
  { id: 'mankey', dex: 56, name: 'Mankey', types: ['fighting'], hp: 3, attack: 1, rarity: 'common', biomes: ['grass'], family: 'mankey', stage: 1, evolution: { to: 'primeape', growth: 3, mode: 'participation' } },
  { id: 'primeape', dex: 57, name: 'Primeape', types: ['fighting'], hp: 5, attack: 2, rarity: 'rare', biomes: ['grass'], family: 'mankey', stage: 2 },
  { id: 'machop', dex: 66, name: 'Machop', types: ['fighting'], hp: 4, attack: 1, rarity: 'common', biomes: ['cave', 'grass'], family: 'machop', stage: 1, evolution: { to: 'machoke', growth: 4, mode: 'participation' } },
  { id: 'machoke', dex: 67, name: 'Machoke', types: ['fighting'], hp: 6, attack: 2, rarity: 'rare', biomes: ['cave'], family: 'machop', stage: 2, evolution: { to: 'machamp', growth: 6, mode: 'participation' } },
  { id: 'machamp', dex: 68, name: 'Machamp', types: ['fighting'], hp: 7, attack: 3, rarity: 'superRare', biomes: ['cave'], family: 'machop', stage: 3 },
  { id: 'bellsprout', dex: 69, name: 'Bellsprout', types: ['grass', 'poison'], hp: 3, attack: 0, rarity: 'common', biomes: ['grass', 'forest'], family: 'bellsprout', stage: 1, evolution: { to: 'weepinbell', growth: 3, mode: 'participation' } },
  { id: 'weepinbell', dex: 70, name: 'Weepinbell', types: ['grass', 'poison'], hp: 5, attack: 1, rarity: 'rare', biomes: ['grass', 'forest'], family: 'bellsprout', stage: 2, evolution: { to: 'victreebel', growth: 4, mode: 'participation', item: 'leafstone' } },
  { id: 'victreebel', dex: 71, name: 'Victreebel', types: ['grass', 'poison'], hp: 7, attack: 2, rarity: 'superRare', biomes: ['forest'], family: 'bellsprout', stage: 3 },
  { id: 'ponyta', dex: 77, name: 'Ponyta', types: ['fire'], hp: 4, attack: 1, rarity: 'common', biomes: ['grass'], family: 'ponyta', stage: 1, evolution: { to: 'rapidash', growth: 4, mode: 'participation' } },
  { id: 'rapidash', dex: 78, name: 'Rapidash', types: ['fire'], hp: 6, attack: 2, rarity: 'rare', biomes: ['grass'], family: 'ponyta', stage: 2 },
  { id: 'farfetchd', dex: 83, name: "Farfetch'd", types: ['normal', 'flying'], attackType: 'flying', hp: 4, attack: 1, rarity: 'rare', biomes: ['grass'], family: 'farfetchd', stage: 1 },
  { id: 'doduo', dex: 84, name: 'Doduo', types: ['normal', 'flying'], attackType: 'flying', hp: 3, attack: 1, rarity: 'common', biomes: ['grass'], family: 'doduo', stage: 1, evolution: { to: 'dodrio', growth: 4, mode: 'participation' } },
  { id: 'dodrio', dex: 85, name: 'Dodrio', types: ['normal', 'flying'], attackType: 'flying', hp: 6, attack: 2, rarity: 'rare', biomes: ['grass'], family: 'doduo', stage: 2 },
  { id: 'grimer', dex: 88, name: 'Grimer', types: ['poison'], hp: 4, attack: 0, rarity: 'common', biomes: ['city'], family: 'grimer', stage: 1, evolution: { to: 'muk', growth: 4, mode: 'participation' } },
  { id: 'muk', dex: 89, name: 'Muk', types: ['poison'], hp: 7, attack: 1, rarity: 'rare', biomes: ['city'], family: 'grimer', stage: 2 },
  { id: 'shellder', dex: 90, name: 'Shellder', types: ['water'], hp: 3, attack: 0, rarity: 'common', biomes: ['sea', 'beach'], family: 'shellder', stage: 1, evolution: { to: 'cloyster', growth: 4, mode: 'participation', item: 'waterstone' } },
  { id: 'cloyster', dex: 91, name: 'Cloyster', types: ['water', 'ice'], hp: 6, attack: 2, rarity: 'rare', biomes: ['sea'], family: 'shellder', stage: 2 },
  { id: 'drowzee', dex: 96, name: 'Drowzee', types: ['psychic'], hp: 4, attack: 0, rarity: 'common', biomes: ['grass', 'city'], family: 'drowzee', stage: 1, evolution: { to: 'hypno', growth: 4, mode: 'participation' } },
  { id: 'hypno', dex: 97, name: 'Hypno', types: ['psychic'], hp: 6, attack: 1, rarity: 'rare', biomes: ['city'], family: 'drowzee', stage: 2 },
  { id: 'voltorb', dex: 100, name: 'Voltorb', types: ['electric'], hp: 3, attack: 1, rarity: 'common', biomes: ['city'], family: 'voltorb', stage: 1, evolution: { to: 'electrode', growth: 4, mode: 'participation' } },
  { id: 'electrode', dex: 101, name: 'Electrode', types: ['electric'], hp: 5, attack: 2, rarity: 'rare', biomes: ['city'], family: 'voltorb', stage: 2 },
  { id: 'exeggcute', dex: 102, name: 'Exeggcute', types: ['grass', 'psychic'], hp: 4, attack: 0, rarity: 'common', biomes: ['forest'], family: 'exeggcute', stage: 1, evolution: { to: 'exeggutor', growth: 4, mode: 'participation', item: 'leafstone' } },
  { id: 'exeggutor', dex: 103, name: 'Exeggutor', types: ['grass', 'psychic'], hp: 7, attack: 2, rarity: 'rare', biomes: ['forest'], family: 'exeggcute', stage: 2 },
  { id: 'cubone', dex: 104, name: 'Cubone', types: ['ground'], hp: 4, attack: 1, rarity: 'common', biomes: ['cave', 'haunted'], family: 'cubone', stage: 1, evolution: { to: 'marowak', growth: 4, mode: 'participation' } },
  { id: 'marowak', dex: 105, name: 'Marowak', types: ['ground'], hp: 6, attack: 2, rarity: 'rare', biomes: ['cave'], family: 'cubone', stage: 2 },
  { id: 'lickitung', dex: 108, name: 'Lickitung', types: ['normal'], hp: 6, attack: 1, rarity: 'rare', biomes: ['grass'], family: 'lickitung', stage: 1 },
  { id: 'rhyhorn', dex: 111, name: 'Rhyhorn', types: ['ground', 'rock'], hp: 5, attack: 1, rarity: 'common', biomes: ['grass', 'cave'], family: 'rhyhorn', stage: 1, evolution: { to: 'rhydon', growth: 5, mode: 'participation' } },
  { id: 'rhydon', dex: 112, name: 'Rhydon', types: ['ground', 'rock'], hp: 7, attack: 2, rarity: 'rare', biomes: ['grass', 'cave'], family: 'rhyhorn', stage: 2 },
  { id: 'chansey', dex: 113, name: 'Chansey', types: ['normal'], hp: 8, attack: 0, rarity: 'superRare', biomes: ['grass'], family: 'chansey', stage: 1 },
  { id: 'tangela', dex: 114, name: 'Tangela', types: ['grass'], hp: 6, attack: 1, rarity: 'rare', biomes: ['grass', 'forest'], family: 'tangela', stage: 1 },
  { id: 'kangaskhan', dex: 115, name: 'Kangaskhan', types: ['normal'], hp: 7, attack: 2, rarity: 'rare', biomes: ['grass'], family: 'kangaskhan', stage: 1 },
  { id: 'horsea', dex: 116, name: 'Horsea', types: ['water'], hp: 3, attack: 0, rarity: 'common', biomes: ['sea', 'water'], family: 'horsea', stage: 1, evolution: { to: 'seadra', growth: 4, mode: 'participation' } },
  { id: 'seadra', dex: 117, name: 'Seadra', types: ['water'], hp: 5, attack: 2, rarity: 'rare', biomes: ['sea'], family: 'horsea', stage: 2 },
  { id: 'goldeen', dex: 118, name: 'Goldeen', types: ['water'], hp: 3, attack: 0, rarity: 'common', biomes: ['water'], family: 'goldeen', stage: 1, evolution: { to: 'seaking', growth: 4, mode: 'participation' } },
  { id: 'seaking', dex: 119, name: 'Seaking', types: ['water'], hp: 5, attack: 1, rarity: 'rare', biomes: ['water'], family: 'goldeen', stage: 2 },
  { id: 'electabuzz', dex: 125, name: 'Electabuzz', types: ['electric'], hp: 6, attack: 2, rarity: 'rare', biomes: ['city'], family: 'electabuzz', stage: 1 },
  { id: 'magmar', dex: 126, name: 'Magmar', types: ['fire'], hp: 6, attack: 2, rarity: 'rare', biomes: ['city'], family: 'magmar', stage: 1 },
  { id: 'pinsir', dex: 127, name: 'Pinsir', types: ['bug'], hp: 6, attack: 2, rarity: 'superRare', biomes: ['forest'], family: 'pinsir', stage: 1 },
  { id: 'tauros', dex: 128, name: 'Tauros', types: ['normal'], hp: 6, attack: 2, rarity: 'rare', biomes: ['grass'], family: 'tauros', stage: 1 },
];

// Bonus 2, 14.10 (rules.eeveeBranch 'v1', the DEV ruleset dev-1410c): Eevee's three Kanto forms. NOT in the roster
// list POKEMON (the 129 of every pool, trainer team, power-class table, Pokédex page and data check stay as they
// are) — only in the lookup (getSpecies): they exist only by evolving an Eevee, and are never wild (`wild: false`,
// no biome). The Pokédex page does not list them yet (a pilot limit). Stats PROVISIONAL (like Raichu / Arcanine);
// rarity Super Rare like Eevee (DQ-24: rarity follows the line). No Johto forms.
export const EEVEE_FORMS = [
  { id: 'vaporeon', dex: 134, name: 'Vaporeon', types: ['water'], hp: 7, attack: 2, rarity: 'superRare', biomes: [], wild: false, family: 'eevee', stage: 2 },
  { id: 'jolteon', dex: 135, name: 'Jolteon', types: ['electric'], hp: 6, attack: 2, rarity: 'superRare', biomes: [], wild: false, family: 'eevee', stage: 2 },
  { id: 'flareon', dex: 136, name: 'Flareon', types: ['fire'], hp: 6, attack: 2, rarity: 'superRare', biomes: [], wild: false, family: 'eevee', stage: 2 },
];

// Every species, the prototype's first (their order is kept).
export const POKEMON = [...PROTOTYPE_SPECIES, ...WAVE1];

// Bonus 14.10 (rules.eeveeBranch 'v1'): a branching evolution — one Growth threshold, the STONE chooses the form
// (Water Stone → Vaporeon, Thunder Stone → Jolteon, Fire Stone → Flareon). Eevee's own data has no `evolution`
// edge, so a game without the switch keeps Eevee a final form (as before).
export const BRANCH_EVOLUTIONS = Object.freeze({
  eevee: Object.freeze([
    Object.freeze({ to: 'vaporeon', growth: 4, mode: 'participation', item: 'waterstone' }),
    Object.freeze({ to: 'jolteon', growth: 4, mode: 'participation', item: 'thunderstone' }),
    Object.freeze({ to: 'flareon', growth: 4, mode: 'participation', item: 'firestone' }),
  ]),
});

// One source of truth: evolvesTo comes from the evolution edge.
for (const p of [...POKEMON, ...EEVEE_FORMS]) p.evolvesTo = p.evolution?.to ?? null;

export const POKEMON_BY_ID = Object.fromEntries([...POKEMON, ...EEVEE_FORMS].map((p) => [p.id, p]));

export const RARITIES = ['common', 'rare', 'superRare'];
export const RARITY_LABELS = { common: 'Common', rare: 'Rare', superRare: 'Super Rare' };

export function getSpecies(id) {
  const s = POKEMON_BY_ID[id];
  if (!s) throw new Error(`Unknown Pokémon species: ${id}`);
  return s;
}

export function isWild(species) {
  return species.wild !== false;
}

export function attackTypeOf(species) {
  return species.attackType ?? species.types[0];
}
