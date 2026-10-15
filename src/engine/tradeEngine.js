// One Kanto day 14.10 — PLAYER TRADING (rules.trading 'v1', MP-01; ChatGPT canonical full-day handoff G4).
// Two HUMAN players at the same exact place with a Poké Stop swap one Pokémon each, both agreeing.
//   tradeOpen {with}          the player whose turn it is opens a trade with another human player there (free)
//   tradePick {by, target}    each side picks one of its own Pokémon — team or Oak's Box (a new pick undoes
//                             both agreements: nobody agrees to an offer that changed)
//   tradeAgree {by}           each side agrees to the summary; the second agreement makes the swap
//   tradeCancel               either side, any time before the swap: nothing changes
// The swap is ATOMIC: each Pokémon instance (uid, species, HP, Growth, every field) moves whole into the place the
// other one left (team slot ↔ team slot / Box), so team and Box limits hold by construction; nothing is copied,
// nothing is lost. Refused if it would leave a team without a healthy Pokémon. No action is spent — a social
// rule both can use in the physical game („wymiana nic nie kosztuje, raz na turę gracza, który ją proponuje”);
// the other player's actions are never touched. Pokémon away on Oak's research are in neither team nor Box,
// so they cannot be traded. AI players never trade.
import { getSpecies } from '../data/pokemon.js';
import { log } from './log.js';
import { currentPlayer, markSeen } from './gameState.js';
import { hasPokeStop } from './pokeStopEngine.js';

export const usesTrading = (config) => config.rules.trading === 'v1';
const human = (p) => p.controller !== 'ai';
const byId = (state, id) => state.players.find((p) => p.id === id);
const owned = (p) => [...p.team, ...p.reserve];

// The players the current player may open a trade with now.
export function tradePartners(state) {
  if (!usesTrading(state.config) || state.trade || state.phase !== 'turn' || state.turn.traded) return [];
  const me = currentPlayer(state);
  if (!human(me) || !hasPokeStop(me.location, state.config) || owned(me).length === 0) return [];
  return state.players.filter((p) => p.id !== me.id && human(p) && p.location === me.location && owned(p).length > 0);
}

export function tradeActions(state) {
  if (!usesTrading(state.config)) return [];
  const t = state.trade;
  if (!t) return tradePartners(state).map((p) => ({ type: 'tradeOpen', with: p.id }));
  const out = [{ type: 'tradeCancel' }];
  for (const id of [t.a, t.b]) {
    for (const m of owned(byId(state, id))) if (t.pick[id] !== m.uid) out.push({ type: 'tradePick', by: id, target: m.uid });
    if (t.pick[t.a] && t.pick[t.b] && !t.agree[id] && !tradeProblem(state)) out.push({ type: 'tradeAgree', by: id });
  }
  return out;
}

export function openTrade(state, withId) {
  const me = currentPlayer(state);
  state.trade = { a: me.id, b: withId, place: me.location, pick: { [me.id]: null, [withId]: null }, agree: { [me.id]: false, [withId]: false } };
  log(state, 'action', `🔄 ${me.name} proposes a Pokémon trade to ${byId(state, withId).name}.`, { trade: { event: 'open', a: me.id, b: withId } });
}

export function pickForTrade(state, by, uid) {
  const t = state.trade;
  t.pick[by] = uid;
  t.agree[t.a] = false;
  t.agree[t.b] = false;
  const mon = owned(byId(state, by)).find((m) => m.uid === uid);
  log(state, 'action', `🔄 ${byId(state, by).name} offers ${getSpecies(mon.species).name}.`, { trade: { event: 'pick', by, uid } });
}

// Why the swap cannot happen now (null when it can).
export function tradeProblem(state) {
  const t = state.trade;
  if (!t) return 'no trade';
  const a = byId(state, t.a);
  const b = byId(state, t.b);
  if (a.location !== t.place || b.location !== t.place) return 'both players must stand at the same Poké Stop';
  const ma = owned(a).find((m) => m.uid === t.pick[t.a]);
  const mb = owned(b).find((m) => m.uid === t.pick[t.b]);
  if (!ma || !mb) return 'each player picks one of their own Pokémon';
  for (const [p, out, inn] of [[a, ma, mb], [b, mb, ma]]) {
    if (!p.team.includes(out)) continue;
    const healthyLeft = p.team.filter((m) => m !== out && m.hp > 0).length + (inn.hp > 0 ? 1 : 0);
    if (healthyLeft === 0) return `${p.name} would have no healthy Pokémon in the team`;
  }
  return null;
}

export function agreeToTrade(state, by) {
  const t = state.trade;
  t.agree[by] = true;
  log(state, 'action', `🔄 ${byId(state, by).name} agrees.`, { trade: { event: 'agree', by } });
  if (t.agree[t.a] && t.agree[t.b]) swap(state);
}

export function cancelTrade(state) {
  const t = state.trade;
  state.trade = null;
  log(state, 'action', `🔄 The trade between ${byId(state, t.a).name} and ${byId(state, t.b).name} is called off — nothing changes.`, { trade: { event: 'cancel' } });
}

function swap(state) {
  const t = state.trade;
  const a = byId(state, t.a);
  const b = byId(state, t.b);
  const where = (p, uid) => {
    const i = p.team.findIndex((m) => m.uid === uid);
    return i >= 0 ? { list: p.team, i } : { list: p.reserve, i: p.reserve.findIndex((m) => m.uid === uid) };
  };
  const wa = where(a, t.pick[t.a]);
  const wb = where(b, t.pick[t.b]);
  const ma = wa.list[wa.i];
  const mb = wb.list[wb.i];
  wa.list[wa.i] = mb; // the whole instance moves — nothing copied, nothing lost
  wb.list[wb.i] = ma;
  for (const [p, m] of [[a, mb], [b, ma]]) {
    markSeen(p, m.species);
    if (!p.pokedex.caught.includes(m.species)) p.pokedex.caught.push(m.species);
    p.stats.trades = (p.stats.trades ?? 0) + 1;
  }
  state.trade = null;
  state.turn.traded = true; // one trade per turn of the player who proposes it
  log(state, 'action', `🔄 Trade! ${a.name} gets ${getSpecies(mb.species).name}, ${b.name} gets ${getSpecies(ma.species).name}.`, { trade: { event: 'done', a: a.id, b: b.id, uids: [ma.uid, mb.uid] } });
}
