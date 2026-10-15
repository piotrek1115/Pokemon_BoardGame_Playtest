// Wild Pokémon temperament (wild-encounter slice, 09.10.2026; rules.wildTemperament).
// PROVISIONAL CONTENT — an explicit, reviewable table for the current roster,
// not derived from type or rarity. Every species not listed is STANDARD.
//
//   aggressive  never flees: after a failed Ball no Escape Die, it stays (and
//               strikes back where rules.counterattackOnStay applies)
//   standard    the Escape Die after a failed Ball (the rule before this slice)
//   skittish    standard + the Escape Die after a completed battle round
//               (the player's attack or a paid switch and the wild response)
//
// The Escape Die itself is unchanged (red / yellow / green by HP); temperament
// only decides WHEN it is rolled. Max one Escape Check per player action.
export const TEMPERAMENTS = ['aggressive', 'standard', 'skittish'];

export const TEMPERAMENT_PL = {
  aggressive: { name: 'AGRESYWNY', rule: 'nie ucieka' },
  standard: { name: 'STANDARDOWY', rule: 'może uciec po nieudanym Ballu' },
  skittish: { name: 'PŁOCHLIWY', rule: 'może uciec po rundzie walki' },
};

// Why each one is not STANDARD (Pokédex / anime character, the judgment to review):
export const TEMPERAMENT_BY_SPECIES = {
  // AGGRESSIVE — territorial, hostile, combative
  spearow: 'aggressive', // flies in to defend its territory, attacks in flocks
  fearow: 'aggressive', // the same, bigger and meaner
  beedrill: 'aggressive', // swarms to attack whoever comes near the nest
  arbok: 'aggressive', // intimidates and strikes; does not back off
  growlithe: 'aggressive', // barks and bites to drive intruders off its territory
  gyarados: 'aggressive', // famously violent, rampages
  scyther: 'aggressive', // fierce blade fighter
  aerodactyl: 'aggressive', // ferocious ancient hunter
  // wave 1 (M02-1, rules.roster 'v2' games only) — PROVISIONAL
  mankey: 'aggressive', // flies into a rage at anything
  primeape: 'aggressive', // chases whoever angered it, never lets go
  tauros: 'aggressive', // charges with its tails whipping
  rhyhorn: 'aggressive', // charges in a straight line at anything
  rhydon: 'aggressive', // the same, armoured
  nidoking: 'aggressive', // smashes with its tail, fierce
  kangaskhan: 'aggressive', // protects its young fiercely
  pinsir: 'aggressive', // grips and won't let go

  // SKITTISH — evasive, timid, flees or hides
  pidgey: 'skittish', // docile, kicks up sand and avoids a fight
  clefairy: 'skittish', // shy, rarely seen, hides from people
  clefable: 'skittish', // very shy, runs from people
  diglett: 'skittish', // vanishes underground
  oddish: 'skittish', // buries itself in the ground
  abra: 'skittish', // teleports away
  chansey: 'skittish', // rare and elusive, runs from people (Safari)
  ponyta: 'skittish', // gallops away
  rapidash: 'skittish', // the fastest runner of the plains
};

// A species' temperament ('standard' when it has none — no crash on missing data).
export function temperamentOf(speciesId) {
  const t = TEMPERAMENT_BY_SPECIES[speciesId];
  return TEMPERAMENTS.includes(t) ? t : 'standard';
}
