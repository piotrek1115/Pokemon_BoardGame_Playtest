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
// rules.growthFainted — what fainting does to a battle's Growth:
//   false     nothing (Build 2 … Build 3.1; DQ-75);
//   true      the DQ-92 SOFT experiment (rejected 09.10.2026, kept for a save made
//             with it): no Growth for an opponent the Pokémon fainted against —
//             per opposing Pokémon; a revived one can earn again from the next;
//   'battle'  DQ-105 (Piotr, Playtest 004 — new games): a Pokémon that fainted
//             in THIS battle gets none of its new Growth — every opponent, a catch,
//             a cocoon's share too; a Revive does not lift it. Growth earned before
//             the battle is never taken away. Settled when the battle ends.
// rules.evolutionGrowth — how much Growth an edge needs (growthNeeded below):
//   'v1' the species data (Build 2 … Build 3.1), 'v2' every edge +1 (DQ-106,
//   Piotr: evolutions came too fast). The species data never changes, so an
//   older game keeps its thresholds; the engine, the table and the Studio all
//   read the threshold through growthNeeded / growthEdge(pokemon, rules).
// rules.fatigue (Macro 02 M02-2, fatigueEngine.js): a battle an Explore found at
//   a tired or exhausted place (encounter.fatigue ≥ 1) gives no Growth at all —
//   a wild Pokémon defeated, a catch after a fight, a random trainer, a cocoon's
//   share. Settled when the battle ends: every award is lost (reason 'tired').
// Phase 2 (star) games have none of this: every hook is a no-op there, so their
// states, logs and replays stay exactly as before.
import { BRANCH_EVOLUTIONS, getSpecies } from '../data/pokemon.js';
import { log } from './log.js';
import { currentPlayer } from './gameState.js';
import { getLocation } from '../data/locations.js';
import { battleGivesNoGrowth } from './fatigueEngine.js';
import { classExp } from '../data/powerClass.js';

export function usesGrowth(state) {
  return state.config.rules.evolution === 'growth';
}

export function emptyGrowthStats() {
  return { defeated: 0, generated: 0, assigned: 0, chosen: 0, cocoon: 0, fromCatch: 0, lost: 0, lostReady: 0, lostFinal: 0 };
}

// Build 3.3 E1 (B33-2, rules.exp): EXP thresholds — PROVISIONAL candidates (spec §5.4),
// all on top of v2 (the species data + 1), rounded up:
//   'T1' every edge × 2;  'T2' a stage-1 edge × 2, a stage-2 edge × 2.5;
//   'T3' a cocoon edge (partyVictory) × 1.5, every other × 2.5;
//   'T0' every edge × 1.5 — added after the first A/B (13.10): with a mean of ~1.7–1.8
//        EXP per award, T1–T3 halved the evolutions; T0 keeps training at least as fast.
const EXP_THRESHOLDS = {
  T0: () => 1.5,
  T1: () => 2,
  T2: (edge) => (getSpecies(edge.to).stage - 1 >= 2 ? 2.5 : 2),
  T3: (edge) => (edge.mode === 'partyVictory' ? 1.5 : 2.5),
};

// The Growth an evolution edge needs in a game with these rules (the one resolver).
export function growthNeeded(edge, rules) {
  if (!edge) return null;
  const v = rules?.evolutionGrowth;
  if (EXP_THRESHOLDS[v]) return Math.ceil((edge.growth + 1) * EXP_THRESHOLDS[v](edge));
  return edge.growth + (v === 'v2' ? 1 : 0);
}

// The Pokémon's current evolution edge ({ to, growth, mode, item? }) or null,
// its `growth` the threshold of THIS game (pass the game's rules).
export function growthEdge(pokemon, rules) {
  // bonus 14.10 (rules.eeveeBranch): a branching species grows toward its branches' common threshold (the first edge)
  const edge = getSpecies(pokemon.species).evolution ?? (rules?.eeveeBranch === 'v1' ? BRANCH_EVOLUTIONS[pokemon.species]?.[0] : null) ?? null;
  return edge && rules?.evolutionGrowth && rules.evolutionGrowth !== 'v1' ? { ...edge, growth: growthNeeded(edge, rules) } : edge;
}

// Every edge this Pokémon may take (a branching species: one per form; else its one edge, or none).
export function growthEdges(pokemon, rules) {
  const branches = rules?.eeveeBranch === 'v1' ? BRANCH_EVOLUTIONS[pokemon.species] : null;
  if (!branches) return growthEdge(pokemon, rules) ? [growthEdge(pokemon, rules)] : [];
  return branches.map((edge) => (rules?.evolutionGrowth && rules.evolutionGrowth !== 'v1' ? { ...edge, growth: growthNeeded(edge, rules) } : edge));
}

// Build 3.3 E1 (rules.exp 'K5' | 'K4', data/powerClass.js): how much one award gives.
// Flat 1 in every older game. With EXP: 2 + (the opponent's dots − the receiver's),
// 0–4; a cocoon that did NOT fight takes a flat 1 from that same award (spec §5.5) —
// never the class difference, never a second award.
export function awardAmount(rules, mon, award) {
  if (!rules?.exp) return 1;
  if (isCocoon(mon) && !award.eligible.includes(mon.uid)) return 1;
  return classExp(award.source, mon.species, rules.exp);
}

export function canTakeGrowth(pokemon, rules) {
  const edge = growthEdge(pokemon, rules);
  return Boolean(edge) && (pokemon.growth ?? 0) < edge.growth;
}

// Enough Growth for its edge (it may still need the edge's stone).
export function growthReady(pokemon, rules) {
  const edge = growthEdge(pokemon, rules);
  return Boolean(edge) && (pokemon.growth ?? 0) >= edge.growth;
}

// The table's `growth` card option: this game's rules in a Growth game, else false.
export function growthRules(state) {
  return usesGrowth(state) ? state.config.rules : false;
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

// This team Pokémon fainted (combatEngine). DQ-92 SOFT (true): against the
// current opponent — the list starts afresh with each new opponent. DQ-105
// ('battle'): in this battle — kept until the battle ends.
export function noteFainted(state, uid) {
  const rule = state.config.rules.growthFainted;
  if (!usesGrowth(state) || !rule) return;
  const enc = state.encounter;
  const key = rule === 'battle' ? 'faintedBattle' : 'fainted';
  enc[key] ??= [];
  if (!enc[key].includes(uid)) enc[key].push(uid);
}

// The Growth for the current opponent: whoever fought it — minus, in Gameplay
// P1, whoever fainted against it (DQ-92), kept on the award for the log.
function award(enc, kind, source) {
  const fought = enc.participants ?? [];
  const out = fought.filter((uid) => enc.fainted?.includes(uid));
  return out.length ? { kind, source, eligible: fought.filter((uid) => !out.includes(uid)), fainted: out } : { kind, source, eligible: [...fought] };
}

// Build 3.3 correction C1 (rules.growthCredits): a gym or League opponent pays its
// Growth once per player — the credit is this opponent's place: the gym, the
// tier, the stage of the chain and its slot (League v2: the member and the slot).
// The credit is taken when the Growth is actually given (giveGrowth): an award lost
// to DQ-105 (the Pokémon fainted in that battle) or to a full / final form leaves
// the opponent open for a later attempt. Once given, beating the same opponent again
// after a reset trains nobody (the badge, money and items were never repeatable).
// null: no credit applies (other battles, older games).
export function creditKey(state, enc) {
  if (!state.config.rules.growthCredits) return null;
  if (enc.kind === 'gym') return `gym:${enc.gymId}:t${enc.tier}:s${enc.chainStage ?? 0}:${enc.index}`;
  if (enc.kind === 'league') return enc.v2 ? `league:${enc.member}:${enc.index}` : `league:${enc.stage}:${enc.index}`;
  if (enc.questChallenge) return `quest:${enc.questChallenge.questId}/${enc.questChallenge.stage}/${enc.index}`; // E3: a quest challenge slot
  if (enc.questEncounter) return `quest:${enc.questEncounter.occ}/encounter`; // PLAYTEST_006 C4: an expedition's Pokémon trains once (R2 retries: none)
  return null;
}

export function opponentDefeated(state, opponent) {
  if (!usesGrowth(state)) return;
  const enc = state.encounter;
  const key = creditKey(state, enc);
  if (key) {
    const player = currentPlayer(state);
    if (player.growthCredits?.includes(key)) {
      enc.participants = [];
      if (enc.fainted) enc.fainted = [];
      const s = player.stats.growth;
      s.defeated += 1;
      s.repeatNoCredit = (s.repeatNoCredit ?? 0) + 1;
      log(state, 'evolution', `No Growth: ${getSpecies(opponent.species).name} was already beaten in an earlier attempt — its training counts once.`, { growth: { event: 'noCredit', key, source: opponent.species, kind: 'defeat' } });
      return;
    }
  }
  (enc.growthAwards ??= []).push({ ...award(enc, 'defeat', opponent.species), ...(key ? { key } : {}) });
  enc.participants = [];
  if (enc.fainted) enc.fainted = [];
  const s = currentPlayer(state).stats.growth;
  s.defeated += 1;
  s.generated += 1;
}

export function wildCaught(state) {
  if (!usesGrowth(state)) return;
  const enc = state.encounter;
  if (!enc.participants?.length) return; // caught without a fight: no training
  (enc.growthAwards ??= []).push(award(enc, 'catch', enc.pokemon.species));
  const s = currentPlayer(state).stats.growth;
  s.generated += 1;
  s.fromCatch += 1;
}

// ---- settling a battle's Growth ---------------------------------------------------

// Called by endEncounter (the battle is over, the encounter already cleared).
export function settleGrowth(state, enc, result) {
  if (!usesGrowth(state) || !enc.growthAwards?.length) return;
  if (battleGivesNoGrowth(enc)) return loseTiredGrowth(state, enc); // M02-2: a tired place
  // DQ-105: whoever fainted in this battle takes none of its Growth (every award)
  if (enc.faintedBattle?.length) {
    for (const a of enc.growthAwards) {
      a.fainted = [...new Set([...(a.fainted ?? []), ...enc.faintedBattle])];
      a.eligible = a.eligible.filter((uid) => !a.fainted.includes(uid));
    }
  }
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
  // Gameplay P1 (DQ-92): never for this opponent if it fainted against it — a cocoon neither.
  return player.team.filter((p) => ids.has(p.uid) && !award.fainted?.includes(p.uid) && canTakeGrowth(p, state.config.rules) && !(isCocoon(p) && choice.cocoonsFed.includes(p.uid)));
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
  const edge = growthEdge(mon, state.config.rules);
  const amount = awardAmount(state.config.rules, mon, award); // E1: EXP (older games: 1)
  mon.growth = Math.min(edge.growth, (mon.growth ?? 0) + amount);
  if (award.key && !(player.growthCredits ??= []).includes(award.key)) player.growthCredits.push(award.key); // C1: this opponent has paid
  const s = player.stats.growth;
  s.assigned += 1;
  if (state.config.rules.exp) s.exp = (s.exp ?? 0) + amount;
  if (!auto) s.chosen += 1;
  if (isCocoon(mon)) {
    state.growthChoice.cocoonsFed.push(mon.uid);
    if (!award.eligible.includes(mon.uid)) s.cocoon += 1;
  }
  const name = getSpecies(mon.species).name;
  const ready = mon.growth >= edge.growth;
  const why = award.kind === 'catch' ? `catching ${getSpecies(award.source).name}` : `defeating ${getSpecies(award.source).name}`;
  const exp = state.config.rules.exp;
  log(state, 'evolution', `⭐ ${name} gains ${exp ? `${amount} EXP` : '1 Growth'} for ${why} (${mon.growth}/${edge.growth})${ready ? ' — ready to evolve!' : ''}`, {
    growth: { event: 'gain', uid: mon.uid, species: mon.species, growth: mon.growth, threshold: edge.growth, ready, source: award.source, kind: award.kind, auto, ...(exp ? { amount } : {}) },
  });
}

// M02-2: the whole battle's Growth is lost — the Pokémon here know this player.
function loseTiredGrowth(state, enc) {
  const player = currentPlayer(state);
  const n = enc.growthAwards.length;
  const s = player.stats.growth;
  s.lost += n;
  s.lostTired = (s.lostTired ?? 0) + n;
  const first = enc.growthAwards[0];
  log(state, 'evolution', `⭐ No Growth from this battle (${n}): the Pokémon of ${getLocation(player.location).name} know ${player.name} by now — training here gives nothing.`, {
    growth: { event: 'lost', source: first.source, kind: first.kind, reason: 'tired', count: n },
  });
}

function loseGrowth(state, player, award) {
  const s = player.stats.growth;
  const what = `${award.kind === 'catch' ? 'catching' : 'defeating'} ${getSpecies(award.source).name}`;
  // DQ-92 SOFT / DQ-105: lost because of a faint — nobody who stayed up can take
  // it, and a Pokémon that fainted (against this opponent / in this battle) could have.
  const faintedCould = award.fainted?.length ? player.team.concat(player.reserve).some((p) => award.fainted.includes(p.uid) && canTakeGrowth(p, state.config.rules)) : false;
  if (award.fainted?.length && (!award.eligible.length || faintedCould)) {
    s.lost += 1;
    s.lostFainted = (s.lostFainted ?? 0) + 1;
    const who = player.team.concat(player.reserve).filter((p) => award.fainted.includes(p.uid)).map((p) => getSpecies(p.species).name).join(', ');
    log(state, 'evolution', `⭐ The Growth for ${what} is lost: ${who} fainted ${state.config.rules.growthFainted === 'battle' ? 'in this battle' : 'against it'}.`, {
      growth: { event: 'lost', source: award.source, kind: award.kind, reason: 'fainted' },
    });
    return;
  }
  const fought = player.team.filter((p) => award.eligible.includes(p.uid));
  const reason = fought.length && fought.every((p) => !growthEdge(p)) ? 'final' : 'ready';
  s.lost += 1;
  if (reason === 'final') s.lostFinal += 1;
  else s.lostReady += 1;
  const who = fought.map((p) => getSpecies(p.species).name).join(', ') || 'nobody';
  log(state, 'evolution', `⭐ The Growth for ${what} is lost: ${who} ${reason === 'final' ? 'cannot evolve any further' : 'is already ready to evolve'}.`, {
    growth: { event: 'lost', source: award.source, kind: award.kind, reason },
  });
}
