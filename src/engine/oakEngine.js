// Professor Oak in Pallet Town (Phase 3B Macro 01, after the Build 3.0 family
// playtest: a reliable, non-random way out of „no balls, no money”).
//
// Research Jobs (rules.oakJobs). In Pallet Town a player may send Pokémon on a
// job for Professor Oak and travel on; they come back by themselves.
//   Job A  1 Pokémon, 2 of the owner's turns, +1 money
//   Job B  3 Pokémon, 3 of the owner's turns, +2 money and a Potion
// (CONFIG.oak.jobs). Starting a job costs 1 action; one job at a time per
// player. Choosing the Pokémon is a short pending step, like Oak's Box choice:
// oakJob {job} opens it (free), oakJobPick {target} picks one Pokémon at a time
// (free), oakJobCancel closes it (free); the last pick starts the job and spends
// the action. A Pokémon may come from the team or the Box, never a fainted one,
// and the team always keeps at least one healthy Pokémon.
// While away, a Pokémon is in neither the team nor the Box: it keeps its uid,
// species, HP, Growth — every field — and gets nothing (no heal, no Growth, no
// evolution). Time is the owner's turns, not actions: the job counts down at
// the start of each of the owner's turns (2 → „wraca za 2 tury”) and at 0 the
// Pokémon come back with the reward — to where they came from (the team, or
// the Box when the team is full) — before the owner does anything else.
// Oak's Box can also be used in Pallet Town (his lab) in these games.
//
// Emergency kit (rules.oakKit). A player with no Poké Ball or Super Ball and
// less money than one Poké Ball costs gets 1 Poké Ball — free, once per game
// (oakKit) — at any Poké Stop or in Pallet Town (CONFIG.oak.kitWhere 'stop',
// approved 11.10; 'lab' = Pallet Town only). A recovery, not an income.
import { getSpecies } from '../data/pokemon.js';
import { getLocation } from '../data/locations.js';
import { ITEMS } from '../data/items.js';
import { log } from './log.js';
import { currentPlayer } from './gameState.js';
import { addItem, ballCount, itemCount } from './itemEngine.js';
import { hasPokeStop } from './pokeStopEngine.js';

export const JOB_IDS = ['A', 'B'];

export function usesOakJobs(state) {
  return Boolean(state.config.rules.oakJobs);
}

export function usesOakKit(state) {
  return Boolean(state.config.rules.oakKit);
}

export function atOakLab(state, player) {
  return player.location === state.config.oak?.location;
}

// Oak's lab is open here for this player (jobs and the Box in Pallet Town).
export function oakLabHere(state, player) {
  return usesOakJobs(state) && atOakLab(state, player);
}

export function emptyOakStats() {
  return { jobs: { A: 0, B: 0 }, returned: 0, money: 0, items: 0, kit: 0 };
}

function oakStats(player) {
  return (player.stats.oak ??= emptyOakStats());
}

const name = (mon) => getSpecies(mon.species).name;

export function jobSpec(state, job) {
  const spec = state.config.oak.jobs[job];
  if (!spec) throw new Error(`No Oak job ${job}`);
  return spec;
}

// ---- who may go ---------------------------------------------------------------------------

// Pokémon that may still be picked, given the picks so far: not fainted, and a
// team Pokémon only while the team keeps a healthy one besides it.
export function jobCandidates(state, player, picked = []) {
  const taken = new Set(picked);
  const healthyTeamLeft = player.team.filter((p) => p.hp > 0 && !taken.has(p.uid)).length;
  return [
    ...player.team.filter((p) => p.hp > 0 && !taken.has(p.uid) && healthyTeamLeft > 1).map((p) => ({ uid: p.uid, from: 'team' })),
    ...player.reserve.filter((p) => p.hp > 0 && !taken.has(p.uid)).map((p) => ({ uid: p.uid, from: 'box' })),
  ];
}

// How many Pokémon could go at most (the team keeps one healthy).
function assignable(player) {
  const team = player.team.filter((p) => p.hp > 0).length;
  return player.reserve.filter((p) => p.hp > 0).length + Math.max(0, team - 1);
}

export function canStartJob(state, player, job) {
  return usesOakJobs(state) && state.phase === 'turn' && atOakLab(state, player) && !player.oakJob && !state.oakJobDraft
    && state.turn.actionsRemaining >= state.config.oak.jobCost && assignable(player) >= jobSpec(state, job).size;
}

// The turn-phase actions in Pallet Town.
export function oakActions(state, player) {
  const actions = [];
  if (usesOakJobs(state)) for (const job of JOB_IDS) if (canStartJob(state, player, job)) actions.push({ type: 'oakJob', job });
  if (canTakeKit(state, player)) actions.push({ type: 'oakKit' });
  return actions;
}

// ---- the pending pick ---------------------------------------------------------------------

export function draftOptions(state) {
  const draft = state.oakJobDraft;
  if (!draft) return [];
  const player = currentPlayer(state);
  return [...jobCandidates(state, player, draft.picked).map((c) => ({ type: 'oakJobPick', target: c.uid })), { type: 'oakJobCancel' }];
}

export function openJob(state, job) {
  const player = currentPlayer(state);
  const spec = jobSpec(state, job);
  state.oakJobDraft = { job, picked: [] };
  log(state, 'action', `${player.name} talks to Professor Oak about Research Job ${job}: ${spec.size} Pokémon for ${spec.turns} turns.`, { oak: { event: 'draft', job } });
}

export function cancelJob(state) {
  const player = currentPlayer(state);
  state.oakJobDraft = null;
  log(state, 'action', `${player.name} changes their mind — no Research Job this time.`, { oak: { event: 'cancel' } });
}

export function pickForJob(state, uid) {
  const player = currentPlayer(state);
  const draft = state.oakJobDraft;
  draft.picked.push(uid);
  if (draft.picked.length >= jobSpec(state, draft.job).size) beginJob(state, player);
}

function beginJob(state, player) {
  const { job, picked } = state.oakJobDraft;
  const spec = jobSpec(state, job);
  const from = {};
  const pokemon = picked.map((uid) => {
    const inTeam = player.team.find((p) => p.uid === uid);
    from[uid] = inTeam ? 'team' : 'box';
    return inTeam ?? player.reserve.find((p) => p.uid === uid);
  });
  player.team = player.team.filter((p) => !picked.includes(p.uid));
  player.reserve = player.reserve.filter((p) => !picked.includes(p.uid));
  player.oakJob = { job, turnsLeft: spec.turns, startedRound: state.turn.round, pokemon, from };
  state.oakJobDraft = null;
  state.turn.actionsRemaining -= state.config.oak.jobCost;
  oakStats(player).jobs[job] += 1;
  log(state, 'action', `${player.name} sends ${pokemon.map(name).join(', ')} on Professor Oak's Research Job ${job} — back in ${spec.turns} turns with ${rewardText(spec.reward)}.`, { oak: { event: 'start', job, uids: [...picked], turns: spec.turns } });
}

// ---- One Kanto day 14.10: „Oak bada nowe gatunki” (rules.oakResearch 'v1', DEC-43 candidate) -------------
// The pay depends on the player's research ledger (player.oakStudied — the species Oak has already studied
// from THIS player), read when the job comes back; the ledger is written only then (a completed job, never
// at the start): Job A — a new species 💰3, a repeat 💰1; Job B — at least 2 new distinct species 💰5 + a Poké
// Ball, otherwise 💰2. One pay per job (the job ends with it). The ledger never touches Oak's Box.
export const RESEARCH_REWARDS = Object.freeze({
  A: { fresh: [{ type: 'money', amount: 3 }], repeat: [{ type: 'money', amount: 1 }], need: 1 },
  B: { fresh: [{ type: 'money', amount: 5 }, { type: 'pokeballs', amount: 1 }], repeat: [{ type: 'money', amount: 2 }], need: 2 },
});
export const usesResearch = (state) => state.config.rules.oakResearch === 'v1';

// What a job of these species would pay this player now (the table shows it before the job starts).
export function researchReward(player, job, speciesIds) {
  const studied = player.oakStudied ?? [];
  const fresh = [...new Set(speciesIds)].filter((sp) => !studied.includes(sp));
  const r = RESEARCH_REWARDS[job];
  return { reward: fresh.length >= r.need ? r.fresh : r.repeat, fresh };
}

// ---- the job runs on the owner's turns -------------------------------------------------------

// Called at the start of every turn for the player whose turn it is.
export function oakTurnStart(state, player) {
  const job = player.oakJob;
  if (!job) return;
  job.turnsLeft -= 1;
  if (job.turnsLeft > 0) return;
  const spec = jobSpec(state, job.job);
  const back = [];
  for (const mon of job.pokemon) {
    const toTeam = job.from[mon.uid] === 'team' && player.team.length < state.config.maxTeamSize;
    (toTeam ? player.team : player.reserve).push(mon);
    back.push(`${name(mon)}${toTeam ? '' : ' (to the Box)'}`);
  }
  const s = oakStats(player);
  const research = usesResearch(state) ? researchReward(player, job.job, job.pokemon.map((m) => m.species)) : null;
  const reward = research ? research.reward : spec.reward;
  for (const r of reward) {
    if (r.type === 'money') {
      player.money += r.amount;
      s.money += r.amount;
    } else {
      addItem(player, r.type === 'pokeballs' ? 'pokeball' : r.type, r.amount);
      s.items += r.amount;
    }
  }
  s.returned += 1;
  if (research) player.oakStudied = [...new Set([...(player.oakStudied ?? []), ...job.pokemon.map((m) => m.species)])]; // only now: a completed job
  player.oakJob = null;
  log(state, 'action', `🔬 Back from Professor Oak's Research Job ${job.job}: ${back.join(', ')}. ${player.name} gets ${rewardText(reward)}${research ? (research.fresh.length ? ` (new for Oak: ${research.fresh.map((id) => getSpecies(id).name).join(', ')})` : ' (Oak has studied these already)') : ''}.`, { oak: { event: 'return', job: job.job, uids: job.pokemon.map((m) => m.uid), reward, ...(research ? { fresh: research.fresh } : {}) } });
}

// ---- the emergency kit ----------------------------------------------------------------------

export function needsKit(state, player) {
  return ballCount(player) === 0 && player.money < state.config.economy.pokeball;
}

// Where the kit can be taken: Professor Oak's lab, and with CONFIG.oak.kitWhere
// 'stop' (the rule since 11.10) every Poké Stop too.
export function kitPlace(state, location) {
  return location === state.config.oak?.location || (state.config.oak?.kitWhere === 'stop' && hasPokeStop(location, state.config));
}

export function canTakeKit(state, player) {
  return usesOakKit(state) && state.phase === 'turn' && kitPlace(state, player.location) && !player.oakKitUsed && needsKit(state, player);
}

export function takeKit(state) {
  const player = currentPlayer(state);
  for (const r of state.config.oak.kit) {
    if (r.type === 'money') player.money += r.amount;
    else addItem(player, r.type === 'pokeballs' ? 'pokeball' : r.type, r.amount);
  }
  player.oakKitUsed = true;
  oakStats(player).kit += 1;
  log(state, 'action', `🎒 Professor Oak helps ${player.name} out: ${rewardText(state.config.oak.kit)} — once per game.`, { oak: { event: 'kit' } });
}

export function rewardText(reward) {
  return reward.map((r) => (r.type === 'money' ? `+${r.amount} money` : `+${r.amount} ${ITEMS[r.type === 'pokeballs' ? 'pokeball' : r.type].name}${r.amount > 1 ? 's' : ''}`)).join(', ');
}

// For logs and the table: where a player's Pokémon on a job are.
export function jobPokemon(player) {
  return player.oakJob?.pokemon ?? [];
}

export function labName(state) {
  return getLocation(state.config.oak.location).name;
}
