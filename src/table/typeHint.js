// PLAYTEST_007 stage 2C (PT007-06 / PT007-22): the ONE place the table turns the engine's type math into a hint.
// The math stays in the engine — combatEngine.typeMatchup, the very function every attack's total uses — so a hint
// can never disagree with a roll. The table shows it the same way in every battle (wild, trainer, Team Rocket, gym,
// League, a quest's challenge, a friendly duel): the ATTACK type's icon and ±N, green / red, nothing when 0 (the
// Build 2.4 card form). The dice row shows the type on its own chip in that same form, never summed into the
// attack's strength (that sum hid the type: „+1 attack, −1 type” showed nothing).
import { attackTypeOf, getSpecies } from '../data/pokemon.js';
import { typeMatchup } from '../engine/combatEngine.js';

const speciesOf = (x) => getSpecies(typeof x === 'string' ? x : x.species);

// { mod, type }: the attacker's type bonus against the defender (−2…+2), and the attack type (its icon).
export function typeHint(attacker, defender, config) {
  const a = speciesOf(attacker);
  return { mod: typeMatchup(a, speciesOf(defender), config), type: attackTypeOf(a) };
}
