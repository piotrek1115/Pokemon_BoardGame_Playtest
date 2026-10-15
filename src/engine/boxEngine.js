// Professor Oak's Box (Gameplay P1, rules.oakBox, DQ-95). The Box is the
// player's existing reserve — no second storage:
//   - a catch with a full team (6) waits for the player's choice
//     (state.boxChoice): „Do drużyny” — the new Pokémon joins the team and a
//     team Pokémon of the player's pick goes to the Box (boxKeep {target}) —
//     or „Wyślij do Oaka” (boxSend): the new Pokémon stays in the Box;
//   - in a city with a Poké Stop, during the turn, Pokémon move between the
//     team and the Box for free (no action): boxIn {target, swap?} brings one
//     from the Box (with a full team, `swap` goes to the Box in its place),
//     boxOut {target} sends a team Pokémon to the Box (the team keeps one);
//   - the Box never heals; every Pokémon keeps its HP, Growth and form;
//   - Macro 01 (rules.oakJobs): Professor Oak's lab in Pallet Town is a Box
//     place too.
// Games before schema 15 keep the old reserve: a full-team catch goes there
// automatically and nothing moves back.
import { getSpecies } from '../data/pokemon.js';
import { log } from './log.js';
import { currentPlayer } from './gameState.js';
import { hasPokeStop } from './pokeStopEngine.js';
import { oakLabHere } from './oakEngine.js';

export function usesOakBox(state) {
  return Boolean(state.config.rules.oakBox);
}

const name = (mon) => getSpecies(mon.species).name;

// ---- the catch with a full team -----------------------------------------------------

// Called after a catch that went to the Box because the team was full.
export function offerBoxChoice(state, caught) {
  if (!usesOakBox(state)) return;
  state.boxChoice = { uid: caught.uid };
  log(state, 'capture', `The team is full: ${name(caught)} joins the team (pick who goes to Professor Oak) or goes to Professor Oak's Box.`, { box: { event: 'choice', uid: caught.uid, species: caught.species } });
}

export function boxChoiceOptions(state) {
  if (!state.boxChoice) return [];
  return [...currentPlayer(state).team.map((p) => ({ type: 'boxKeep', target: p.uid })), { type: 'boxSend' }];
}

// „Do drużyny”: the caught Pokémon takes the place of `outUid`, which goes to the Box.
export function keepCaught(state, outUid) {
  const player = currentPlayer(state);
  const caught = player.reserve.find((p) => p.uid === state.boxChoice.uid);
  const i = player.team.findIndex((p) => p.uid === outUid);
  const out = player.team[i];
  player.team[i] = caught;
  player.reserve = player.reserve.filter((p) => p !== caught).concat(out);
  state.boxChoice = null;
  log(state, 'action', `${player.name} keeps ${name(caught)} in the team; ${name(out)} goes to Professor Oak's Box.`, { box: { event: 'keep', in: caught.uid, out: out.uid } });
}

// „Wyślij do Oaka”: the caught Pokémon stays in the Box.
export function sendCaughtToOak(state) {
  const player = currentPlayer(state);
  const caught = player.reserve.find((p) => p.uid === state.boxChoice.uid);
  state.boxChoice = null;
  log(state, 'action', `${player.name} sends ${name(caught)} to Professor Oak's Box.`, { box: { event: 'send', uid: caught.uid } });
}

// ---- free swaps in a Poké Stop city -----------------------------------------------------

export function canUseBox(state, player) {
  return usesOakBox(state) && state.phase === 'turn' && (hasPokeStop(player.location, state.config) || oakLabHere(state, player));
}

export function boxSwapOptions(state, player) {
  if (!canUseBox(state, player)) return [];
  const actions = [];
  const full = player.team.length >= state.config.maxTeamSize;
  for (const mon of player.reserve) {
    if (!full) actions.push({ type: 'boxIn', target: mon.uid });
    else for (const out of player.team) actions.push({ type: 'boxIn', target: mon.uid, swap: out.uid });
  }
  if (player.team.length > 1) for (const mon of player.team) actions.push({ type: 'boxOut', target: mon.uid });
  return actions;
}

export function boxIn(state, uid, swapUid) {
  const player = currentPlayer(state);
  const mon = player.reserve.find((p) => p.uid === uid);
  player.reserve = player.reserve.filter((p) => p !== mon);
  if (swapUid) {
    const i = player.team.findIndex((p) => p.uid === swapUid);
    const out = player.team[i];
    player.team[i] = mon;
    player.reserve.push(out);
    log(state, 'action', `${player.name} swaps at Professor Oak's: ${name(mon)} joins the team, ${name(out)} goes to the Box.`, { box: { event: 'swap', in: mon.uid, out: out.uid } });
    return;
  }
  player.team.push(mon);
  log(state, 'action', `${player.name} takes ${name(mon)} from Professor Oak's Box into the team.`, { box: { event: 'in', in: mon.uid } });
}

export function boxOut(state, uid) {
  const player = currentPlayer(state);
  const mon = player.team.find((p) => p.uid === uid);
  player.team = player.team.filter((p) => p !== mon);
  player.reserve.push(mon);
  log(state, 'action', `${player.name} sends ${name(mon)} to Professor Oak's Box.`, { box: { event: 'out', out: mon.uid } });
}
