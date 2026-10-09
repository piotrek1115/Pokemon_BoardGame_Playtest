// Per-Pokémon Growth (Phase 3A-1, rules.evolution 'growth'; DQ-74…79).
//
// Growth is earned in battle, by the Pokémon that fought:
//   - every opposing Pokémon defeated gives 1 Growth to one Pokémon that took
//     part in the fight against THAT opponent (it attacked it, or came in by a
//     paid switch and took its hit). Participants start afresh with each new
//     opponent, so a late arrival can't collect a whole trainer team;
//   - a wild Pokémon caught after a fight gives 1 (a first-throw catch: 0);
//     a wild battle ends either defeated or caught, never both;
//   - after a won battle a cocoon (edge mode 'partyVictory') in the active team
//     may take one of that battle's Growth without fighting — at most 1 per
//     cocoon per battle, never extra Growth (DQ-77).
// A Pokémon only takes Growth it can use: it has an evolution edge and is below
// that edge's threshold — no overflow (DQ-76). Awards are settled when the
// battle ends, in the order the opponents fell: automatically when one Pokémon
// can take it, by the player's pick (assignGrowth) when several can, lost when
// none can (everyone READY or in a final form).
// Phase 2 (star) games have none of this: every hook is a no-op there, so their
// states, logs and replays stay exactly as before.
import { getSpecies } from '../data/pokemon.js';
import { log } from './log.js';
import { currentPlayer } from './gameState.js';

export function usesGrowth(state) {
  return state.config.rules.evolution === 'growth';
}

export function emptyGrowthStats() {
  return { defeated: 0, generated: 0, assigned: 0, chosen: 0, cocoon: 0, fromCatch: 0, lost: 0, lostReady: 0, lostFinal: 0 };
}

// The Pokémon's current evolution edge ({ to, growth, mode, item? }) or null.
export function growthEdge(pokemon) {
  return getSpecies(pokemon.species).evolution ?? null;
}

export function canTakeGrowth(pokemon) {
  const edge = growthEdge(pokemon);
  return Boolean(edge) && (pokemon.growth ?? 0) < edge.growth;
}

// Enough Growth for its edge (it may still need the edge's stone).
export function growthReady(pokemon) {
  const edge = growthEdge(pokemon);
  return Boolean(edge) && (pokemon.growth ?? 0) >= edge.growth;
}

export function isCocoon(pokemon) {
  return growthEdge(pokemon)?.mode === 'partyVictory';
}

// ---- battle hooks ----------------------------------------------------------------

// This team Pokémon takes part in the fight against the current opponent.
export function noteParticipant(state, uid) {
  if (!usesGrowth(state)) return;
  const enc = state.encounter;
  enc.participants ??= [];
  if (!enc.participants.includes(uid)) enc.participants.push(uid);
}

export function opponentDefeated(state, opponent) {
  if (!usesGrowth(state)) return;
  const enc = state.encounter;
  (enc.growthAwards ??= []).push({ kind: 'defeat', source: opponent.species, eligible: [...(enc.participants ?? [])] });
  enc.participants = [];
  const s = currentPlayer(state).stats.growth;
  s.defeated += 1;
  s.generated += 1;
}

export function wildCaught(state) {
  if (!usesGrowth(state)) return;
  const enc = state.encounter;
  if (!enc.participants?.length) return; // caught without a fight: no training
  (enc.growthAwards ??= []).push({ kind: 'catch', source: enc.pokemon.species, eligible: [...enc.participants] });
  const s = currentPlayer(state).stats.growth;
  s.generated += 1;
  s.fromCatch += 1;
}

// ---- settling a battle's Growth ---------------------------------------------------

// Called by endEncounter (the battle is over, the encounter already cleared).
export function settleGrowth(state, enc, result) {
  if (!usesGrowth(state) || !enc.growthAwards?.length) return;
  const player = currentPlayer(state);
  const won = state.config.evolution.victories.includes(result);
  state.growthChoice = {
    awards: enc.growthAwards,
    // A cocoon that was in the active team for the battle (not the one just caught).
    cocoons: won ? player.team.filter((p) => isCocoon(p) && p.uid !== enc.pokemon?.uid).map((p) => p.uid) : [],
    cocoonsFed: [],
  };
  continueGrowth(state);
}

function candidates(state, player, award) {
  const choice = state.growthChoice;
  const ids = new Set([...award.eligible, ...choice.cocoons]);
  return player.team.filter((p) => ids.has(p.uid) && canTakeGrowth(p) && !(isCocoon(p) && choice.cocoonsFed.includes(p.uid)));
}

// Team Pokémon the player may give the pending Growth to (a pick is only
// pending when there are at least two).
export function growthOptions(state) {
  if (!state.growthChoice) return [];
  return candidates(state, currentPlayer(state), state.growthChoice.awards[0]);
}

function continueGrowth(state) {
  const choice = state.growthChoice;
  const player = currentPlayer(state);
  while (choice.awards.length) {
    const options = candidates(state, player, choice.awards[0]);
    if (options.length > 1) return; // the player picks: assignGrowth
    const award = choice.awards.shift();
    if (options.length === 1) giveGrowth(state, player, options[0], award, true);
    else loseGrowth(state, player, award);
  }
  state.growthChoice = null;
}

export function assignGrowth(state, uid) {
  const player = currentPlayer(state);
  const award = state.growthChoice.awards.shift();
  giveGrowth(state, player, player.team.find((p) => p.uid === uid), award, false);
  continueGrowth(state);
}

function giveGrowth(state, player, mon, award, auto) {
  const edge = growthEdge(mon);
  mon.growth = Math.min(edge.growth, (mon.growth ?? 0) + 1);
  const s = player.stats.growth;
  s.assigned += 1;
  if (!auto) s.chosen += 1;
  if (isCocoon(mon)) {
    state.growthChoice.cocoonsFed.push(mon.uid);
    if (!award.eligible.includes(mon.uid)) s.cocoon += 1;
  }
  const name = getSpecies(mon.species).name;
  const ready = mon.growth >= edge.growth;
  const why = award.kind === 'catch' ? `catching ${getSpecies(award.source).name}` : `defeating ${getSpecies(award.source).name}`;
  log(state, 'evolution', `⭐ ${name} gains 1 Growth for ${why} (${mon.growth}/${edge.growth})${ready ? ' — ready to evolve!' : ''}`, {
    growth: { event: 'gain', uid: mon.uid, species: mon.species, growth: mon.growth, threshold: edge.growth, ready, source: award.source, kind: award.kind, auto },
  });
}

function loseGrowth(state, player, award) {
  const fought = player.team.filter((p) => award.eligible.includes(p.uid));
  const reason = fought.length && fought.every((p) => !growthEdge(p)) ? 'final' : 'ready';
  const s = player.stats.growth;
  s.lost += 1;
  if (reason === 'final') s.lostFinal += 1;
  else s.lostReady += 1;
  const who = fought.map((p) => getSpecies(p.species).name).join(', ') || 'nobody';
  log(state, 'evolution', `⭐ The Growth for ${award.kind === 'catch' ? 'catching' : 'defeating'} ${getSpecies(award.source).name} is lost: ${who} ${reason === 'final' ? 'cannot evolve any further' : 'is already ready to evolve'}.`, {
    growth: { event: 'lost', source: award.source, kind: award.kind, reason },
  });
}
