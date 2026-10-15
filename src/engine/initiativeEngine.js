// Build 3.3 B33-1 — First Strike ⚡ „Szybkie wejście” (rules.initiative 'fsB';
// DEC-12, Piotr 13.10.2026; docs/BUILD_3_3_SPEC.md §8).
//
// The base rule: in every exchange the player's choice resolves first, then the
// opponent answers. A ⚡ Pokémon gains its side ONE unanswered action on its
// FIRST entry into a battle — at the opening, when a trainer sends it out after
// a KO, as a free replacement or by a paid switch:
// - an opponent's ⚡ Pokémon strikes once before the player's next choice;
// - the player's ⚡ Pokémon: its first exchange gets no answer (the attack is not
//   countered, an item / a stay is not punished); by a paid switch, the switch
//   itself is not answered (the opponent does not strike the newcomer).
// Both active Pokémon ⚡ → no advantage (it cancels). At most once per Pokémon
// per battle: `encounter.fs.entered` remembers every entry, so a switch back or
// a reload never triggers it again.
//
// Entries are settled by `settleEntries` right after every dispatched action
// (turnEngine), after the action's own bookkeeping — so the opening strike of a
// battle found while exploring, the next trainer Pokémon and a replacement are
// all resolved inside the same dispatch and saved resolved. A paid switch is
// settled inside switchPokemon (the strike it skips is part of that exchange).
// Games without the switch never get `encounter.fs`.
import { TRAITS } from '../data/traits.js';
import { getSpecies } from '../data/pokemon.js';
import { pickVersion } from '../rules.js';
import { log } from './log.js';
import { currentPlayer, getLead } from './gameState.js';

export function usesInitiative(config) {
  return config.rules.initiative === 'fsB';
}

// The list a game reads: its rule's version, or a measurement list chosen in
// CONFIG.firstStrike.list (correction C6 — tools only, never a default).
export function hasTrait(mon, trait, config) {
  if (!mon || !usesInitiative(config)) return false;
  if (mon.traits?.includes(trait)) return true; // Build 3.3 E4: an exceptional (hunted) Pokémon has ⚡ of its own
  const version = (trait === 'firstStrike' && config.firstStrike?.list) || config.rules.initiative;
  return pickVersion(TRAITS[trait], version, `${trait} trait list`).includes(mon.species);
}

export const hasFirstStrike = (mon, config) => hasTrait(mon, 'firstStrike', config);

function fsState(enc) {
  return (enc.fs ??= { entered: { player: [], opponent: [] }, unanswered: null });
}

const opponentKey = (enc) => (enc.kind === 'wild' ? 0 : enc.index);
const opponentOf = (enc) => (enc.kind === 'wild' ? enc.pokemon : enc.trainer.pokemonTeam[enc.index]);
const nameOf = (mon) => getSpecies(mon.species).name;

// Is the player's FS advantage waiting for `uid`'s next exchange? Spends it
// either way (the first exchange is used, answered or not); the caller logs the
// skipped answer.
export function consumeUnanswered(state, uid) {
  const fs = state.encounter?.fs;
  if (!fs?.unanswered) return false;
  const mine = fs.unanswered === uid;
  fs.unanswered = null;
  return mine;
}

// A paid switch: is this exchange unanswered (the newcomer's ⚡ entry, or the
// outgoing Pokémon's waiting advantage spent on the switch)? Records the entry.
export function switchUnanswered(state, outgoing, incoming) {
  if (!usesInitiative(state.config) || !state.encounter) return false;
  const enc = state.encounter;
  const fs = fsState(enc);
  const waiting = fs.unanswered && fs.unanswered === outgoing?.uid;
  fs.unanswered = null;
  const first = !fs.entered.player.includes(incoming.uid);
  if (first) fs.entered.player.push(incoming.uid);
  const foe = opponentOf(enc);
  if (first && hasFirstStrike(incoming, state.config)) {
    if (hasFirstStrike(foe, state.config)) {
      log(state, 'combat', `⚡ ${nameOf(incoming)} and ${nameOf(foe)} are both quick — no one gets ahead.`, { firstStrike: { event: 'cancel', uid: incoming.uid } });
    } else {
      log(state, 'combat', `⚡ ${nameOf(incoming)} comes in fast — ${nameOf(foe)} has no time to strike.`, { firstStrike: { event: 'switchIn', uid: incoming.uid } });
      return true;
    }
  }
  if (waiting) {
    log(state, 'combat', `⚡ The switch was too quick — ${nameOf(foe)} has no time to strike.`, { firstStrike: { event: 'unanswered', uid: outgoing.uid } });
    return true;
  }
  return false;
}

// Settle every entry not yet seen in the current battle (after a dispatch).
// `strike(state, why)` is combatEngine.opponentStrikes (passed in to keep the
// modules apart). Returns quietly when the rule is off or no battle runs.
export function settleEntries(state, strike) {
  for (let guard = 0; guard < 12; guard++) {
    const enc = state.encounter;
    if (!enc || state.phase !== 'encounter' || enc.leadPick || !usesInitiative(state.config)) return;
    const player = currentPlayer(state);
    const lead = getLead(player);
    const foe = opponentOf(enc);
    if (!lead || !foe) return;
    const fs = fsState(enc);
    if (fs.unanswered && fs.unanswered !== lead.uid) fs.unanswered = null; // its Pokémon left the field
    const newFoe = !fs.entered.opponent.includes(opponentKey(enc));
    const newLead = !fs.entered.player.includes(lead.uid);
    if (!newFoe && !newLead) return;
    if (newFoe) fs.entered.opponent.push(opponentKey(enc));
    if (newLead) fs.entered.player.push(lead.uid);
    const foeFast = newFoe && hasFirstStrike(foe, state.config);
    const leadFast = newLead && hasFirstStrike(lead, state.config);
    if (foeFast && hasFirstStrike(lead, state.config)) {
      log(state, 'combat', `⚡ ${nameOf(foe)} and ${nameOf(lead)} are both quick — no one gets ahead.`, { firstStrike: { event: 'cancel', opponent: foe.species, uid: lead.uid } });
    } else if (leadFast && hasFirstStrike(foe, state.config)) {
      log(state, 'combat', `⚡ ${nameOf(lead)} and ${nameOf(foe)} are both quick — no one gets ahead.`, { firstStrike: { event: 'cancel', opponent: foe.species, uid: lead.uid } });
    } else if (foeFast) {
      log(state, 'combat', `⚡ ${nameOf(foe)} is quick and strikes first!`, { firstStrike: { event: 'opponent', opponent: foe.species } });
      strike(state, 'firstStrike'); // may knock the lead out → the next entry is settled in the next loop
      continue;
    } else if (leadFast) {
      fs.unanswered = lead.uid;
      log(state, 'combat', `⚡ ${nameOf(lead)} is quick — its first move gets no answer.`, { firstStrike: { event: 'player', uid: lead.uid } });
    }
  }
}
