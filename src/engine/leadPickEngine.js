// Playtest 004 — DQ-107 (rules.leadPick; Piotr, 11.10.2026): before a battle
// against a trainer — an ordinary trainer, a gym leader, Team Rocket, a League
// stage — the player picks which healthy Pokémon starts it. Free: no action, no
// counter-attack. Once the battle runs, a switch costs what it always did.
//
// Two ways in, one action (chooseLead):
// - a battle the player asks for (challengeGym / challengeLeague /
//   challengeRocket) opens state.battlePrep first: nothing has happened yet — no
//   action spent, no opponent drawn, nothing seen. chooseLead puts the Pokémon
//   in front and starts the battle exactly as the challenge always did;
//   cancelBattle calls it off (nothing spent, nothing gained);
// - a battle that finds the player (a trainer or Team Rocket while exploring, a
//   Rocket ambush, Champion Lance without the intermission) has begun: its first
//   step is the pick (encounter.leadPick). There is nothing to cancel — a
//   trainer can still be left the usual way once the battle runs.
// With one healthy Pokémon there is nothing to pick: no prep, no step. A reload
// keeps either (they are part of the save); no reward is ever given before the
// battle starts. Games without the switch never have either field.
import { getSpecies } from '../data/pokemon.js';
import { log } from './log.js';
import { currentPlayer } from './gameState.js';

const CHALLENGE_TEXT = { gym: 'gym challenge', league: 'League challenge', rocket: 'Team Rocket challenge' };

export function leadCandidates(player) {
  return player.team.filter((p) => p.hp > 0);
}

// Is a pick due before this battle (the switch is on, and there is a choice)?
export function leadPickDue(state, player = currentPlayer(state)) {
  return Boolean(state.config.rules.leadPick) && leadCandidates(player).length > 1;
}

// A battle that found the player: the pick is its first step.
export function markLeadPick(state) {
  if (leadPickDue(state)) state.encounter.leadPick = true;
}

// A battle the player asked for: get ready first (nothing spent yet).
export function openBattlePrep(state, challenge) {
  const player = currentPlayer(state);
  state.battlePrep = { challenge };
  log(state, 'action', `${player.name} gets ready for the ${CHALLENGE_TEXT[challenge]}: who starts the battle?`, { leadPick: { event: 'prep', challenge } });
}

export function leadPickPending(state) {
  return Boolean(state.battlePrep || state.encounter?.leadPick);
}

export function leadPickOptions(state) {
  const picks = leadCandidates(currentPlayer(state)).map((p) => ({ type: 'chooseLead', target: p.uid }));
  return state.battlePrep ? [...picks, { type: 'cancelBattle' }] : picks;
}

// The chosen Pokémon goes in front; the pick is done. Returns the prepared
// challenge ('gym' | 'league' | 'rocket') to start now, or null (the battle runs).
export function pickLead(state, uid) {
  const player = currentPlayer(state);
  const i = player.team.findIndex((p) => p.uid === uid);
  const [mon] = player.team.splice(i, 1);
  player.team.unshift(mon);
  const challenge = state.battlePrep?.challenge ?? null;
  const ko = state.encounter?.leadPick === 'ko'; // PLAYTEST_007 2B: the replacement after a KO (free)
  if (state.battlePrep) state.battlePrep = null;
  if (state.encounter?.leadPick) delete state.encounter.leadPick;
  if (ko) {
    state.encounter.freeSwitch = false;
    log(state, 'combat', `🔄 ${player.name} sends out ${getSpecies(mon.species).name} (free: replacing a fainted Pokémon)`, { switch: { to: mon.uid, species: mon.species, free: true, ko: true } });
    return null;
  }
  log(state, 'action', `${player.name} starts the battle with ${getSpecies(mon.species).name} (free)`, { leadPick: { event: 'pick', uid, species: mon.species } });
  return challenge;
}

export function cancelBattlePrep(state) {
  const player = currentPlayer(state);
  const { challenge } = state.battlePrep;
  state.battlePrep = null;
  log(state, 'action', `${player.name} calls off the ${CHALLENGE_TEXT[challenge]} — no action spent`, { leadPick: { event: 'cancel', challenge } });
}
