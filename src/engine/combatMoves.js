// COMBAT MVP (rules.combatMoves 'mvp1' — the ruleset dev-1510-combat only; ChatGPT „COMBAT 2.0 — EMERGENCY PLAYABLE
// MVP”, Piotr 15.10.2026). The Combat 2.0 data (src/combat2: 110 moves, 132 learnsets, the S1 statuses) inside TODAY's
// battle (combatEngine) — no second combat engine:
//   basic     every Pokémon's attack has its learnset's name („Iskra”, „Drapnięcie” …); the roll is today's
//   special   once per battle, if THIS Pokémon knows one: the same roll + its trick (a status on a hit, drain, guard,
//             +1, or exactly 1 heart without a roll)
//   powerful  once per battle, if it knows one: the roll +2, but it misses on 1–2
// What an instance knows is decided ONCE, when it is created, from its uid (no unseeded randomness, no re-roll on a reload) and
// stored on it (`mon.moves`); a starter knows its family's first Special; a wild / trainer Pokémon MAY know one Special
// and, more rarely, one Powerful (an evolved or rarer one more often) — so two Pikachu can differ.
// Statuses live in the ARENA only (encounter.status[uid]): they go with a switch, a faint, a Potion or the battle's end;
// they never knock out (S1: the tick stops at 1 heart). Older rulesets: none of this (the switch is missing = off).
import { getSpecies } from '../data/pokemon.js';
import { getMove, moveText } from '../combat2/moves.js';
import { learnsetFor } from '../combat2/learnsets.js';
import { STATUS_DEFINITIONS, applyStatus, beforeAttack, cureStatus, endOfRound, statusBlocker, statusRules } from '../combat2/statuses.js';
import { d6, hashIndex } from './rng.js';
import { log } from './log.js';

export const usesCombatMoves = (config) => config?.rules?.combatMoves === 'mvp1';
export const SLOT_PL = Object.freeze({ basic: 'Atak', special: 'Ruch specjalny', powerful: 'Potężny ruch' });
const RULES = statusRules('S1');
const RARITY_STEP = { common: 0, rare: 1, superRare: 2 };

// The basic attack's move (its name) for a species.
export const basicMoveOf = (speciesId) => getMove(learnsetFor(speciesId).basic);

// What a new Pokémon knows: { special, powerful } (move ids or null). `origin`: 'starter' | 'wild' (also a trainer's
// Pokémon) | 'none'. Decided by its uid — the same uid always knows the same.
export function rollKnownMoves(speciesId, origin, uid) {
  const l = learnsetFor(speciesId);
  const s = getSpecies(speciesId);
  const known = { special: null, powerful: null };
  if (origin === 'none') return known;
  if (origin === 'starter') {
    known.special = l.special[0] ?? null;
    return known;
  }
  const h = (key, n) => hashIndex(`${uid}|${speciesId}|${key}`, n);
  const step = (s.stage - 1) + (RARITY_STEP[s.rarity] ?? 0);
  if (l.special.length && h('has-special', 100) < 45 + 15 * step) known.special = l.special[h('special', l.special.length)];
  if (l.powerful.length && h('has-powerful', 100) < 10 + 15 * step) known.powerful = l.powerful[h('powerful', l.powerful.length)];
  return known;
}

// Give a Pokémon its moves (once). Nothing when the rule is off or it already has them.
export function giveMoves(state, mon, origin = 'wild') {
  if (usesCombatMoves(state.config) && mon && !mon.moves) mon.moves = rollKnownMoves(mon.species, origin, mon.uid);
  return mon;
}

export function knownMove(mon, slot) {
  const id = mon?.moves?.[slot];
  return id ? getMove(id) : null;
}
export const movesUsed = (enc, uid) => enc?.movesUsed?.[uid] ?? [];
// The move of `slot` this Pokémon may use now in this battle (known, not used yet), or null.
export function moveAvailable(state, mon, slot) {
  if (!usesCombatMoves(state.config) || !state.encounter || !mon || mon.hp <= 0 || slot === 'basic') return null;
  const m = knownMove(mon, slot);
  return m && !movesUsed(state.encounter, mon.uid).includes(slot) ? m : null;
}
export function markUsed(enc, uid, slot) {
  ((enc.movesUsed ??= {})[uid] ??= []).push(slot);
}
export const moveCardText = (m) => moveText(m);

// The modifiers of an attack with move `m` (performAttack's `mods`): powerful +2 / misses on 1–2; boost +1.
export function attackMods(m) {
  if (!m) return null;
  if (m.slot === 'powerful') return { bonus: 2, label: m.pl, missFaces: [1, 2] };
  if (m.effect.kind === 'boost') return { bonus: m.effect.bonus, label: m.pl };
  return null;
}

// ---- statuses: in the arena only -----------------------------------------------------------------------------------
export const statusOf = (enc, uid) => enc?.status?.[uid] ?? null;
function side(enc, mon) {
  return { mon, status: statusOf(enc, mon.uid) };
}
function keep(enc, s) {
  if (s.status) (enc.status ??= {})[s.mon.uid] = s.status;
  else if (enc.status) delete enc.status[s.mon.uid];
}
// A status die: the world's roll (seeded — the same game always rolls the same; never asked of a player).
const statusDie = (state, mon) => (purpose) => {
  let v;
  d6(state, `Status: ${getSpecies(mon.species).name}: ${purpose}`, (x) => { // the table says it in its note (flow.js)
    v = x;
    return String(x);
  }, 'system');
  return v;
};

// A move's status on a hit. Returns the status id when it landed, else null (immune, already one, fainted).
export function tryStatus(state, target, statusId) {
  const enc = state.encounter;
  const s = side(enc, target);
  const why = statusBlocker(target, getSpecies(target.species), s.status, statusId);
  if (why) {
    log(state, 'combat', `${getSpecies(target.species).name}: no ${statusId} (${why}).`, { status: { event: 'blocked', uid: target.uid, species: target.species, id: statusId, why } });
    return null;
  }
  applyStatus(s, statusId);
  keep(enc, s);
  log(state, 'combat', `${STATUS_DEFINITIONS[statusId].icon} ${getSpecies(target.species).name} — ${STATUS_DEFINITIONS[statusId].name}!`, { status: { event: 'applied', uid: target.uid, species: target.species, id: statusId } });
  return statusId;
}

// Before `mon` attacks: sleep / paralysis. Returns true when it attacks.
export function statusLetsAttack(state, mon) {
  const enc = state.encounter;
  if (!usesCombatMoves(state.config) || !enc || !statusOf(enc, mon.uid)) return true;
  const s = side(enc, mon);
  const r = beforeAttack(s, RULES, statusDie(state, mon));
  keep(enc, s);
  if (r.event) log(state, 'combat', `${getSpecies(mon.species).name}: ${r.event}${r.roll ? ` (${r.roll})` : ''}`, { status: { event: r.event, uid: mon.uid, species: mon.species, roll: r.roll } });
  return r.attacks;
}

// The end of an exchange: poison / burn tick on whoever is still in the arena (never the last heart).
export function statusEndOfRound(state, mons) {
  const enc = state.encounter;
  if (!usesCombatMoves(state.config) || !enc) return;
  for (const mon of mons) {
    if (!mon || mon.hp <= 0 || !statusOf(enc, mon.uid)) continue;
    const s = side(enc, mon);
    const id = s.status.id;
    const r = endOfRound(s, RULES, statusDie(state, mon));
    keep(enc, s);
    if (r.lost || r.roll !== null || r.wornOff) log(state, 'combat', `${STATUS_DEFINITIONS[id].icon} ${getSpecies(mon.species).name}: −${r.lost} HP${r.wornOff ? ' (wears off)' : ''}`, { status: { event: 'tick', uid: mon.uid, species: mon.species, id, lost: r.lost, roll: r.roll, wornOff: r.wornOff, hpAfter: mon.hp, maxHp: mon.maxHp } });
  }
}

// A switch, a faint, a Potion: the status goes.
export function clearStatus(state, mon, reason) {
  const enc = state.encounter;
  if (!enc || !mon || !statusOf(enc, mon.uid)) return;
  const s = side(enc, mon);
  const gone = cureStatus(s, reason);
  keep(enc, s);
  log(state, 'combat', `${getSpecies(mon.species).name}: ${gone.id} cured (${reason}).`, { status: { event: 'cured', uid: mon.uid, species: mon.species, id: gone.id, reason } });
}

// The opponent's choice (an NPC / wild Pokémon): one fixed rule, no die (the prototype's AI, on today's battle):
// its Special when it is worth it now, its Powerful when the target has 2 hearts or more, else the basic attack.
export function opponentSlot(state, opp, target) {
  const sp = moveAvailable(state, opp, 'special');
  if (sp) {
    const e = sp.effect;
    const worth = {
      status: () => !statusOf(state.encounter, target.uid) && !getSpecies(target.species).types.some((t) => STATUS_DEFINITIONS[e.status].immuneTypes.includes(t)),
      drain: () => opp.hp < opp.maxHp,
      guard: () => opp.hp * 2 <= opp.maxHp,
      boost: () => true,
      fixed: () => target.hp === 1 || getSpecies(opp.species).attack <= 0,
    }[e.kind];
    if (worth?.()) return 'special';
  }
  if (moveAvailable(state, opp, 'powerful') && target.hp >= 2) return 'powerful';
  return 'basic';
}
