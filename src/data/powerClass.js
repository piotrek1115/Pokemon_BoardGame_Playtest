// Build 3.3 E1 (B33-2, docs/BUILD_3_3_SPEC.md §5.5): every species has a printed
// POWER CLASS — dots on its card (●), the same on paper and on the tablet. EXP for
// a defeated opponent = 2 + (its dots − your dots), from 0 to 4 (a small lookup
// card at the table). The class is read, never computed at the table.
//
// Its source is the species' strength S = HP + 2 × attack (the AI's and the gym
// rosters' power), cut into fixed bands. Two candidate tables — PROVISIONAL, Piotr
// chooses after a paper test (DEC-07): K5 (1–5 dots) and K4 (1–4 dots).
// `bands[i]` = the highest S of class i + 1.
import { POKEMON, getSpecies } from './pokemon.js';

export const POWER_CLASS_TABLES = Object.freeze({
  K5: Object.freeze([3, 6, 9, 11, 14]),
  K4: Object.freeze([4, 8, 11, 14]),
});

export function strengthOf(species) {
  return species.hp + 2 * Math.max(0, species.attack);
}

export function powerClass(speciesId, table) {
  const bands = POWER_CLASS_TABLES[table];
  if (!bands) throw new Error(`No power class table ${table}`);
  const s = strengthOf(getSpecies(speciesId));
  const i = bands.findIndex((top) => s <= top);
  return (i < 0 ? bands.length - 1 : i) + 1;
}

export const maxPowerClass = (table) => POWER_CLASS_TABLES[table].length;

// EXP for defeating (or catching after a fight) `opponent` with `receiver`.
export function classExp(opponentId, receiverId, table) {
  return Math.max(0, Math.min(4, 2 + powerClass(opponentId, table) - powerClass(receiverId, table)));
}

// Every species' class (tests, the Studio, docs).
export function classTable(table) {
  return Object.fromEntries(POKEMON.map((p) => [p.id, powerClass(p.id, table)]));
}
