// Wild Pokémon temperament (wild-encounter slice, 09.10.2026; rules.wildTemperament).
// The species' temperament (data/temperament.js) decides WHEN the existing
// Escape Die is rolled — never which die (it stays the HP-colour die):
//   aggressive  never: a failed Ball leaves it in the battle (captureEngine)
//   standard    after a failed Ball (the rule before this slice)
//   skittish    after a failed Ball, and after a completed battle round — the
//               player's attack or a paid switch, with the wild response — if
//               the encounter is still on (escapeAfterRound, combatEngine)
// Never a second Escape Check for one player action: a failed Ball rolls its
// own check and its counter-attack (opponentStrikes) rolls none; a free
// replacement after a faint or a free healing item rolls none.
// Games without the switch (Phase 2, Build 2) never reach any of this: their
// failed Ball is the standard one, as before.
import { getSpecies } from '../data/pokemon.js';
import { temperamentOf } from '../data/temperament.js';
import { rollEscapeDie } from './rng.js';
import { log } from './log.js';
import { currentPlayer } from './gameState.js';
import { emptyCaptureStats, escapeColour } from './captureEngine.js';
import { endEncounter } from './encounterEngine.js';

export function usesTemperament(state) {
  return Boolean(state.config.rules.wildTemperament);
}

// The wild Pokémon's temperament in this game ('standard' when the rule is off).
export function wildTemperament(state, pokemon) {
  return usesTemperament(state) ? temperamentOf(pokemon.species) : 'standard';
}

// Per-player counters, created on first use (only in games with the rule).
export function temperamentStats(player) {
  const capture = (player.stats.capture ??= emptyCaptureStats());
  return (capture.temperament ??= {
    failedBall: { checks: 0, flees: 0 },
    afterRound: { checks: 0, flees: 0 },
    aggressiveStays: 0,
  });
}

// A skittish wild Pokémon after a completed round: the Escape Die of its HP colour.
export function escapeAfterRound(state, why) {
  const enc = state.encounter;
  if (!enc || enc.kind !== 'wild' || !usesTemperament(state)) return;
  const wild = enc.pokemon;
  if (wild.hp <= 0 || temperamentOf(wild.species) !== 'skittish') return;
  const name = getSpecies(wild.species).name;
  const colour = escapeColour(wild);
  const stats = temperamentStats(currentPlayer(state));
  stats.afterRound.checks += 1;
  log(state, 'capture', `${name} is skittish: will it run after the round?`, { temperament: { event: 'check', temperament: 'skittish', why } });
  const fate = rollEscapeDie(state, colour, 'system', { trigger: 'afterRound' });
  const escape = { die: 'escape', colour, result: fate, trigger: 'afterRound', temperament: 'skittish' };
  if (fate === 'flee') {
    stats.afterRound.flees += 1;
    log(state, 'capture', `🌬️ ${name} ran away after the round!`, { escape });
    endEncounter(state, 'fled');
    return;
  }
  log(state, 'capture', `○ ${name} stays in the battle.`, { escape });
}
