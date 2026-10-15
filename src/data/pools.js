// Phase 3B Macro 02 — M02-1: local pools (rules.localPools 'v2', new games).
// docs/PHASE_3B_MACRO_02.md §2.2. PROVISIONAL CONTENT — an explicit table per
// place of the board of new games (kanto45), not a biome background: a place
// spawns only the species listed here.
//
//   signature   the place's own species: weight 2 in its rarity's pool, and the
//               guaranteed encounter (the third eligible Explore, encounterEngine)
//   background  the other species living here: weight 1
//
// The rarity die picks the pool (a species' rarity is its own — DQ-24 / DQ-103);
// a rarity with nothing here falls back like every pool (CONFIG.rarityFallback).
// A species may be a signature of several neighbouring places; a place with no
// table here (an older board's place) explores the biome pools.
export const POOL_WEIGHTS = { signature: 2, background: 1 };

export const LOCAL_POOLS = {
  'pallet-town': { signature: ['squirtle', 'krabby'], background: ['pidgey', 'rattata', 'tentacool', 'wartortle'] },
  'route-1': { signature: ['pidgey', 'rattata'], background: ['spearow', 'ekans', 'raticate', 'pidgeotto'] },
  'viridian-city': { signature: ['meowth', 'growlithe'], background: ['rattata', 'pidgey', 'persian', 'raticate'] },
  'route-2': { signature: ['caterpie', 'weedle', 'pikachu'], background: ['pidgey', 'oddish', 'metapod', 'kakuna', 'butterfree', 'beedrill'] },
  'pewter-city': { signature: ['geodude', 'onix'], background: ['diglett', 'rattata', 'meowth', 'aerodactyl'] },
  'route-3': { signature: ['spearow', 'jigglypuff', 'nidoranf', 'nidoranm'], background: ['pidgey', 'rattata', 'fearow', 'wigglytuff'] },
  'mt-moon': { signature: ['zubat', 'clefairy', 'paras'], background: ['geodude', 'golbat', 'clefable', 'parasect', 'graveler'] },
  'route-4': { signature: ['sandshrew', 'mankey'], background: ['spearow', 'rattata', 'ekans', 'sandslash', 'primeape'] },
  'cerulean-city': { signature: ['psyduck', 'goldeen'], background: ['poliwag', 'meowth', 'bulbasaur', 'golduck', 'seaking'] },
  'route-24': { signature: ['bellsprout', 'oddish'], background: ['abra', 'pidgey', 'poliwag', 'charmander', 'weepinbell', 'gloom'] },
  'route-25': { signature: ['venonat', 'abra'], background: ['pidgey', 'oddish', 'krabby', 'venomoth', 'kadabra'] },
  'bills-cottage': { signature: ['slowpoke', 'staryu'], background: ['krabby', 'tentacool', 'pidgey', 'slowbro', 'starmie'] },
  'route-5': { signature: ['meowth', 'oddish'], background: ['pidgey', 'abra', 'bellsprout', 'persian', 'gloom'] },
  'saffron-city': { signature: ['abra', 'kadabra'], background: ['drowzee', 'meowth', 'rattata', 'hypno', 'alakazam'] },
  'route-6': { signature: ['poliwag', 'mankey'], background: ['pidgey', 'oddish', 'psyduck', 'poliwhirl', 'primeape'] },
  'vermilion-city': { signature: ['krabby', 'tentacool'], background: ['shellder', 'magikarp', 'pikachu', 'kingler', 'tentacruel'] },
  'route-11': { signature: ['drowzee', 'ekans'], background: ['spearow', 'rattata', 'sandshrew', 'hypno', 'arbok'] },
  'digletts-cave': { signature: ['diglett', 'dugtrio'], background: ['zubat', 'geodude', 'golbat'] },
  'route-9': { signature: ['machop', 'spearow'], background: ['rattata', 'ekans', 'sandshrew', 'machoke', 'fearow'] },
  'route-10-north': { signature: ['voltorb', 'pikachu'], background: ['poliwag', 'spearow', 'magnemite', 'electrode', 'raichu'] },
  'rock-tunnel': { signature: ['cubone', 'machop'], background: ['zubat', 'geodude', 'onix', 'golbat', 'marowak'] },
  'route-10-south': { signature: ['ekans', 'sandshrew'], background: ['rattata', 'spearow', 'voltorb', 'arbok', 'sandslash'] },
  'power-plant': { signature: ['magnemite', 'electabuzz'], background: ['voltorb', 'pikachu', 'grimer', 'magneton', 'electrode', 'muk'] },
  'lavender-town': { signature: ['gastly', 'cubone'], background: ['rattata', 'meowth', 'haunter', 'marowak', 'gengar'] },
  'route-8': { signature: ['growlithe', 'jigglypuff'], background: ['pidgey', 'rattata', 'abra', 'arcanine', 'persian'] },
  'route-7': { signature: ['vulpix', 'oddish'], background: ['pidgey', 'meowth', 'growlithe', 'ninetales', 'gloom'] },
  'celadon-city': { signature: ['grimer', 'eevee'], background: ['oddish', 'meowth', 'koffing', 'muk', 'weezing', 'gloom'] },
  'route-16': { signature: ['doduo', 'spearow'], background: ['rattata', 'pidgey', 'dodrio', 'fearow', 'raticate'] },
  'route-17': { signature: ['ponyta', 'doduo'], background: ['rattata', 'krabby', 'spearow', 'rapidash', 'dodrio'] },
  'route-18': { signature: ['ponyta', 'lickitung'], background: ['spearow', 'krabby', 'rattata', 'fearow', 'rapidash'] },
  'route-12': { signature: ['venonat', 'farfetchd'], background: ['oddish', 'tentacool', 'magikarp', 'venomoth', 'gloom'] },
  'route-13': { signature: ['venonat', 'pidgey'], background: ['oddish', 'bellsprout', 'farfetchd', 'pidgeotto', 'venomoth'] },
  'route-14': { signature: ['spearow', 'nidorino'], background: ['pidgey', 'venonat', 'oddish', 'fearow', 'pidgeotto'] },
  'route-15': { signature: ['nidoranf', 'nidorina'], background: ['pidgey', 'oddish', 'venonat', 'gloom', 'pidgeotto'] },
  'fuchsia-city': { signature: ['slowpoke', 'koffing'], background: ['goldeen', 'magikarp', 'meowth', 'slowbro', 'weezing'] },
  'safari-zone': { signature: ['exeggcute', 'rhyhorn', 'kangaskhan', 'tauros', 'scyther', 'chansey', 'pinsir'], background: ['doduo', 'nidoranf', 'nidoranm', 'paras', 'venonat', 'tangela', 'exeggutor'] },
  'route-19': { signature: ['tentacool', 'staryu'], background: ['shellder', 'horsea', 'krabby', 'tentacruel', 'starmie'] },
  'seafoam-islands': { signature: ['seel', 'shellder', 'horsea'], background: ['zubat', 'golbat', 'dewgong', 'cloyster', 'lapras'] },
  'route-20': { signature: ['staryu', 'magikarp'], background: ['tentacool', 'shellder', 'seel', 'starmie', 'gyarados'] },
  'cinnabar-island': { signature: ['ponyta', 'vulpix', 'magmar'], background: ['growlithe', 'krabby', 'koffing', 'rapidash', 'ninetales', 'arcanine'] },
  'route-21': { signature: ['tentacool', 'magikarp'], background: ['staryu', 'seel', 'horsea', 'tentacruel', 'lapras'] },
  'route-22': { signature: ['nidoranf', 'nidoranm', 'mankey'], background: ['rattata', 'spearow', 'pidgey', 'nidorina', 'nidorino', 'primeape'] },
  'route-23': { signature: ['machoke', 'graveler', 'marowak'], background: ['zubat', 'geodude', 'spearow', 'ekans', 'golbat', 'onix', 'machamp', 'golem'] },
  'unknown-dungeon': { signature: ['kadabra', 'golbat', 'graveler'], background: ['zubat', 'geodude', 'onix', 'golem', 'alakazam'] },
};
