// One Kanto day 14.10 — PvP 1v1, a FRIENDLY DUEL (rules.pvp 'v1'; ChatGPT canonical full-day handoff G6).
// Two HUMAN players at the same exact place (no Poké Stop needed), one Pokémon each:
//   pvpChallenge {with}    the player whose turn it is challenges another human player there (free, once a turn)
//   pvpAccept {by}         the challenged player says yes …
//   pvpCancel              … or „nie teraz” — either side, any time before the first attack: nothing changes
//   pvpPick {by, target}   each side picks one healthy Pokémon from the team; the second pick starts the duel
//   pvpAttack {by}         the side whose move it is attacks — the battle resolver every battle uses
//                          (combatEngine.performAttack: d6 + attack + type → damage; the attacker's own die,
//                          so a physical die at the table); the sides take turns until one Pokémon faints
//   pvpYield {by}          the side whose move it is gives up (the other wins; such a win never qualifies)
// Initiative: a ⚡ First Strike Pokémon (rules.initiative) against one without it moves first; otherwise the
// CHALLENGED side moves first (the challenger picked the moment).
// A FRIENDLY duel: no capture, no loot, no EXP / Growth, no money; afterwards both Pokémon get back the HP they
// had before the duel (a duel never leaves a team fainted). Only the stats change: stats.pvp
// { duels, wins, losses, qualifiedWins, lastQualified }. ANTI-FARM: a win QUALIFIES (it counts for the
// achievements FIRST WIN / HAT TRICK) at most once per opponent per week — so two players reach a Hat Trick
// in three weeks of the game, never in one evening of re-challenging. AI players never duel.
import { getSpecies } from '../data/pokemon.js';
import { log } from './log.js';
import { currentPlayer } from './gameState.js';
import { moveReady, performAttack } from './combatEngine.js';
import { hasFirstStrike } from './initiativeEngine.js';

export const usesPvp = (config) => config.rules.pvp === 'v1';
const human = (p) => p.controller !== 'ai';
const byId = (state, id) => state.players.find((p) => p.id === id);
const healthy = (p) => p.team.filter((m) => m.hp > 0);
const other = (d, id) => (id === d.a ? d.b : d.a);
const monOf = (state, d, id) => byId(state, id).team.find((m) => m.uid === d.pick[id]);
const pvpStats = (p) => (p.stats.pvp ??= { duels: 0, wins: 0, losses: 0, qualifiedWins: 0, lastQualified: {} });

// The players the current player may challenge now.
export function duelPartners(state) {
  if (!usesPvp(state.config) || state.pvp || state.trade || state.phase !== 'turn' || state.turn.dueled) return [];
  const me = currentPlayer(state);
  if (!human(me) || !healthy(me).length) return [];
  return state.players.filter((p) => p.id !== me.id && human(p) && p.location === me.location && healthy(p).length > 0);
}

export function pvpActions(state) {
  if (!usesPvp(state.config)) return [];
  const d = state.pvp;
  if (!d) return duelPartners(state).map((p) => ({ type: 'pvpChallenge', with: p.id }));
  if (d.stage === 'ask') return [{ type: 'pvpAccept', by: d.b }, { type: 'pvpCancel' }];
  if (d.stage === 'pick') {
    const out = [{ type: 'pvpCancel' }];
    for (const id of [d.a, d.b]) for (const m of healthy(byId(state, id))) if (d.pick[id] !== m.uid) out.push({ type: 'pvpPick', by: id, target: m.uid });
    return out;
  }
  const mover = monOf(state, d, d.next);
  return [{ type: 'pvpAttack', by: d.next }, ...(moveReady(state.config, mover, d.used ?? []) ? [{ type: 'pvpMove', by: d.next }] : []), { type: 'pvpYield', by: d.next }]; // bonus 2: a signature move
}

export function challengeToDuel(state, withId) {
  const me = currentPlayer(state);
  state.turn.dueled = true; // one challenge per turn of the challenger, answered or not
  state.pvp = { a: me.id, b: withId, place: me.location, stage: 'ask', pick: { [me.id]: null, [withId]: null }, hp: {}, next: null, attacks: 0 };
  log(state, 'action', `⚔️ ${me.name} challenges ${byId(state, withId).name} to a friendly duel.`, { pvp: { event: 'challenge', a: me.id, b: withId } });
}

export function acceptDuel(state) {
  const d = state.pvp;
  d.stage = 'pick';
  log(state, 'action', `⚔️ ${byId(state, d.b).name} accepts — each picks one Pokémon.`, { pvp: { event: 'accept' } });
}

export function cancelDuel(state) {
  const d = state.pvp;
  state.pvp = null;
  log(state, 'action', `⚔️ No duel between ${byId(state, d.a).name} and ${byId(state, d.b).name} — nothing changes.`, { pvp: { event: 'cancel' } });
}

export function pickForDuel(state, by, uid) {
  const d = state.pvp;
  d.pick[by] = uid;
  const mon = byId(state, by).team.find((m) => m.uid === uid);
  log(state, 'action', `⚔️ ${byId(state, by).name} picks ${getSpecies(mon.species).name}.`, { pvp: { event: 'pick', by, uid } });
  if (!d.pick[d.a] || !d.pick[d.b]) return;
  const ma = monOf(state, d, d.a);
  const mb = monOf(state, d, d.b);
  d.hp = { [ma.uid]: ma.hp, [mb.uid]: mb.hp }; // given back after the duel
  const qa = hasFirstStrike(ma, state.config);
  const qb = hasFirstStrike(mb, state.config);
  d.next = qa && !qb ? d.a : d.b;
  d.stage = 'fight';
  for (const id of [d.a, d.b]) pvpStats(byId(state, id)).duels += 1;
  log(state, 'action', `⚔️ Duel! ${getSpecies(ma.species).name} vs ${getSpecies(mb.species).name} — ${byId(state, d.next).name} moves first${qa !== qb ? ' (⚡)' : ''}.`, { pvp: { event: 'start', first: d.next, quick: qa !== qb } });
}

// `withMove` (bonus 2, rules.signatureMoves): the attacker's line move — +N, drain, or a guard against the foe's next attack.
export function duelAttack(state, by, withMove = false) {
  const d = state.pvp;
  const foe = other(d, by);
  const mine = monOf(state, d, by);
  const theirs = monOf(state, d, foe);
  const move = withMove ? moveReady(state.config, mine, d.used ?? []) : null;
  if (move) {
    (d.used ??= []).push(mine.uid);
    log(state, 'combat', `✨ ${getSpecies(mine.species).name} uses ${move.name}!`, { sigMove: { uid: mine.uid, move: move.id, species: mine.species, pvp: true } });
  }
  const guard = d.guard?.uid === theirs.uid ? d.guard : null; // the foe's Skorupa from its last move
  if (guard) delete d.guard;
  const mods = { ...(move?.effect.kind === 'attack' ? { bonus: move.effect.bonus, label: move.pl } : {}), ...(guard ? { reduce: guard.reduce, guardLabel: guard.label } : {}) };
  const hit = performAttack(state, mine, theirs, 'player', { pvp: true }, Object.keys(mods).length ? mods : null);
  if (move?.effect.kind === 'drain' && hit.damage) mine.hp = Math.min(mine.maxHp, mine.hp + hit.damage);
  if (move?.effect.kind === 'guard') d.guard = { uid: mine.uid, reduce: move.effect.reduce, label: move.pl };
  d.attacks += 1;
  if (theirs.hp <= 0) endDuel(state, by, false);
  else d.next = foe;
}

export function yieldDuel(state, by) {
  log(state, 'action', `⚔️ ${byId(state, by).name} gives up the duel.`, { pvp: { event: 'yield', by } });
  endDuel(state, other(state.pvp, by), true);
}

function endDuel(state, winnerId, yielded) {
  const d = state.pvp;
  const loserId = other(d, winnerId);
  const winner = byId(state, winnerId);
  const loser = byId(state, loserId);
  const ws = pvpStats(winner);
  const ls = pvpStats(loser);
  ws.wins += 1;
  ls.losses += 1;
  const qualified = !yielded && ws.lastQualified[loserId] !== state.turn.round;
  if (qualified) {
    ws.qualifiedWins += 1;
    ws.lastQualified[loserId] = state.turn.round;
  }
  for (const id of [d.a, d.b]) {
    const mon = monOf(state, d, id);
    if (mon) mon.hp = d.hp[mon.uid]; // a friendly duel: both Pokémon as before it
  }
  state.pvp = null;
  log(state, 'action', `⚔️ ${winner.name} wins the duel${qualified ? '' : yielded ? ' (given up — not counted)' : ' (not counted again this week)'}! Both Pokémon are back to how they were.`, { pvp: { event: 'end', winner: winnerId, loser: loserId, qualified, yielded } });
}
