// Gyms, badges and the League (Step 5, V1 "Open Gyms").
//
// Gym Challenge: 1 action in a gym city, max 1 per turn, needs a healthy
// Pokémon and a badge you don't have yet. One battle (encounter kind 'gym',
// the trainer flow: fight only) against the leader's row for your tier —
// your own badge count decides it (CONFIG.gyms.tierByBadges). Win: badge +
// reward money + CONFIG.gyms.starsPerBadge Evolution Stars (once per gym; Phase 2
// star games), plus the badge's capability (Soul Badge → water travel). Reward
// v2 (3A-3, rules.gymReward, DQ-83): + the gym's thematic item — once, as the
// badge can be won only once; never Growth for the badge or the item (the
// battle's Growth comes from the defeated gym Pokémon). Losing costs nothing.
// No mission progress either way.
//
// League Challenge: 1 action at Indigo Plateau with enough badges, max 1 per
// turn. Stage 1 (Elite Four) → intermission (phase 'league': items and lead
// only, damage carries over) → stage 2 (Champion Lance). Beating stage 1 earns
// the Elite Four Ribbon, so a later challenge starts at Lance. Beating Lance
// makes you Champion; what that means for the game end is Step 6.
//
// Team Rocket never affects anything here (tested).
import { GYMS_BY_ID, LEAGUE, gymInCity } from '../data/gyms.js';
import { getLocation } from '../data/locations.js';
import { getSpecies } from '../data/pokemon.js';
import { CAPABILITIES } from '../data/travelConnections.js';
import { log } from './log.js';
import { createPokemonInstance, currentPlayer, hasHealthyPokemon, markSeen } from './gameState.js';
import { endEncounter } from './encounterEngine.js';
import { awardStars } from './evolutionEngine.js';
import { onChampion } from './endgameEngine.js';
import { pickVersion } from '../rules.js';
import { usesGrowth } from './growthEngine.js';
import { addItem } from './itemEngine.js';
import { markLeadPick } from './leadPickEngine.js';
import { ITEMS } from '../data/items.js';
import { CHARACTERS_BY_ID } from '../data/characters.js';
import { worldBlocks } from './graphEngine.js';
import { trialMissing } from './questBookEngine.js';

export function gymsEnabled(state) {
  return Boolean(state.config.gyms?.enabled);
}

export function emptyGymStats() {
  return {
    attempts: [0, 0, 0], wins: [0, 0, 0], retries: 0, lost: {},
    badges: [], // [{ gym, round, tier, power }]
    eligibleRound: null, championRound: null,
    league: {
      attempts: 0, eliteFourAttempts: 0, eliteFourWins: 0, lanceAttempts: 0, lanceWins: 0,
      ribbonAttempts: 0, ribbonWins: 0, intermissionPotions: 0, intermissionRevives: 0,
    },
  };
}

export function emptyLeagueState() {
  return { ribbon: false, champion: false, championRound: null };
}

// Team power at full HP: Σ max HP + 2 × attack (the measure the AI uses).
export function teamPower(player) {
  return player.team.reduce((sum, m) => sum + m.maxHp + 2 * Math.max(0, getSpecies(m.species).attack), 0);
}

export function rowPower(speciesIds) {
  return speciesIds.reduce((sum, id) => {
    const s = getSpecies(id);
    return sum + s.hp + 2 * Math.max(0, s.attack);
  }, 0);
}

// ---- gyms ---------------------------------------------------------------------------

export function hasBadge(player, gymId) {
  return (player.badges ?? []).includes(gymId);
}

export function gymTier(state, player) {
  const tiers = state.config.gyms.tierByBadges;
  return tiers[Math.min(player.badges.length, tiers.length - 1)];
}

// The gym's tier rows in the roster version this game plays (rules.gymRoster).
export function gymTiers(gym, config) {
  return pickVersion(gym.rosters, config.rules.gymRoster, `${gym.id} gym roster`);
}

// PLAYTEST_006 C3 (rules.gymTeams, PT006-07) — MEASUREMENT variants of a gym's teams, never a
// default without Piotr (DEC-42). On the v2 rosters only:
//   'C'  the leader 3 / 3 / 4: tier 1 plays the tier-2 row, tier 2 the tier-3 row, tier 3 the tier-3
//        row with the tier-2 opener in front (the ace stays last);
//   'D'  THEMED rosters (data/gyms.js `themed`, ChatGPT review 14.10: no random counter-Pokémon): each gym
//        keeps its type and adds a companion from its own story (Mt. Moon's bats in Pewter, the Dojo's Machop
//        in Saffron …), so one counter type no longer beats every Pokémon of most leaders.
// ('B' and 'C' and 'D' also give the gym trainer 2 Pokémon — chainTrainerRow.)
export function gymRow(gym, tier, config) {
  const tiers = gymTiers(gym, config);
  const v = config.rules.gymTeams ?? 'v1';
  if (v === 'C' && config.rules.gymRoster === 'v2') return [tiers[1], tiers[2], [tiers[1][0], ...tiers[2]]][tier - 1];
  if (v === 'D' && config.rules.gymRoster === 'v2' && gym.themed) return gym.themed[tier - 1];
  return tiers[tier - 1];
}

// The badge's thematic item in the reward version this game plays
// (rules.gymReward): null in v1.
export function gymRewardItem(gym, config) {
  return pickVersion(gym.rewards ?? { v1: { item: null } }, config.rules.gymReward, `${gym.id} gym reward`).item;
}

export function gymHere(state, player) {
  return gymsEnabled(state) ? gymInCity(player.location) : null;
}

// ---- gym access (Build 3.3 A1, DQ-123; spec §13.7.3) -------------------------------
// Two layers, read by the engine, the table and the AI alike:
// - gymUnlock: PERMANENT credentials, each monotone (once met, never lost). Today
//   only the hometown rule (rules.hometownGym): Brock's first badge can't be
//   Pewter's, Misty's can't be Cerulean's — met by any first badge. Badge
//   thresholds, Gym Trials and the Viridian story are later hooks, not built.
// - canEnterGymNow: recomputed at every call, never stored — the player is in the
//   gym's city, the city is not closed today (graphEngine), the turn's limits, a
//   healthy Pokémon, no badge from this gym yet — plus gymUnlock.
export function gymUnlock(state, player, gymId) {
  const missing = [];
  if (state.config.rules.hometownGym && CHARACTERS_BY_ID[player.id]?.homeGym === gymId && player.badges.length === 0) missing.push('hometown');
  if (trialMissing(state, player, gymId)) missing.push('trial'); // Build 3.3 E5 (pilot): the gym's trial, once passed for good
  return { ok: missing.length === 0, missing };
}

// Is this place closed right now (today's closures — Team Rocket; later incidents)? A
// player already standing there is inside a closed place: it stops a challenge too
// (correction C2 — the gym is shut, not only the road to it).
export function placeClosedNow(state, place) {
  return Boolean(worldBlocks(state)?.locations?.includes(place));
}

export function canEnterGymNow(state, player, gymId = gymHere(state, player)?.id) {
  const gym = gymId ? GYMS_BY_ID[gymId] : null;
  const missing = [];
  if (!gym || !gymsEnabled(state)) return { ok: false, missing: ['noGym'] };
  if (player.location !== gym.city) missing.push('notHere');
  if (placeClosedNow(state, gym.city)) missing.push('closed'); // C2: also for a player already in the city
  if (hasBadge(player, gym.id)) missing.push('hasBadge');
  missing.push(...gymUnlock(state, player, gym.id).missing);
  if (state.turn.gymChallenged) missing.push('turnLimit');
  if (!hasHealthyPokemon(player)) missing.push('noHealthy');
  if (state.phase !== 'turn' || state.turn.actionsRemaining <= 0) missing.push('noAction');
  return { ok: missing.length === 0, missing };
}

export function gymChallengeBlocker(state, player) {
  const gym = gymHere(state, player);
  if (!gym) return 'There is no gym here';
  const { missing } = canEnterGymNow(state, player, gym.id);
  if (missing.includes('hasBadge')) return `You already have the ${gym.badge}`;
  if (missing.includes('trial')) return `The ${gym.leader}'s gym asks for its trial first`;
  if (missing.includes('closed')) return `The ${getLocation(gym.city).name} Gym is closed right now — come back when the place is open again`;
  if (missing.includes('hometown')) return `${player.name}'s first badge must come from another gym — then ${gym.leader} will accept the challenge`;
  if (missing.includes('turnLimit')) return 'Only one Gym Challenge per turn';
  if (missing.includes('noHealthy')) return 'All Pokémon have fainted — heal first';
  if (missing.includes('noAction')) return 'No action left';
  return null;
}

export function canChallengeGym(state, player) {
  return gymChallengeBlocker(state, player) === null;
}

export function startGymBattle(state) {
  const player = currentPlayer(state);
  const gym = gymInCity(player.location);
  const tier = gymTier(state, player);
  state.turn.gymChallenged = true;
  const s = player.stats.gyms;
  s.attempts[tier - 1] += 1;
  if (s.lost[gym.id]) s.retries += 1;
  if (usesGymChain(state.config)) {
    // Build 3.3 B33-3: the gym's trainer(s), then the leader — one challenge
    const trainers = gymChainTrainers(gym, state.config);
    state.challenge = { kind: 'gym', gymId: gym.id, tier, stage: 0, total: trainers.length + 1, startedRound: state.turn.round };
    log(state, 'gym', `🏟️ ${player.name} takes the ${getLocation(gym.city).name} Gym Challenge — tier ${tier} (${player.badges.length} badge${player.badges.length === 1 ? '' : 's'}): ${trainers.map((t) => t.name).join(', ')}${trainers.length ? ', then ' : ''}${gym.leader}.`, { challenge: { event: 'start', kind: 'gym', gymId: gym.id, total: trainers.length + 1 } });
    return startChallengeStage(state);
  }
  return startLeaderBattle(state, gym, tier);
}

function startLeaderBattle(state, gym, tier, extra = {}) {
  const player = currentPlayer(state);
  const pokemonTeam = gymRow(gym, tier, state.config).map((id) => createPokemonInstance(state, id));
  for (const p of pokemonTeam) markSeen(player, p.species);
  state.encounter = { kind: 'gym', gymId: gym.id, tier, trainer: { name: gym.leader, pokemonTeam, reward: 0 }, index: 0, playerFainted: false, ...extra };
  state.phase = 'encounter';
  const team = pokemonTeam.map((p) => getSpecies(p.species).name).join(', ');
  log(state, 'gym', `🏟️ ${player.name} challenges ${gym.leader} at the ${getLocation(gym.city).name} Gym — tier ${tier} (${player.badges.length} badge${player.badges.length === 1 ? '' : 's'}): ${team}.`);
  return state.encounter;
}

// ---- Build 3.3 B33-3: challenge chains (rules.gymChallenge / leagueChallenge 'v2', DQ-118) ----
// One challenge action starts the whole chain; its battles are free (DQ-03).
// Between battles: an intermission (phase 'challenge') — healing items and the
// lead, no Poké Stop heal, HP and faints carry over — then „Dalej” (the next
// battle) or „Wyjdź” (the attempt ends). A lost battle ends the attempt too. The
// attempt lives in state.challenge (saved); a badge, the ribbon and anything won
// before are never taken back. A gym trainer pays nothing (no money, no item):
// a reset can't be farmed for rewards.
export function usesGymChain(config) {
  return config.rules.gymChallenge === 'v2';
}

export function usesLeagueChallenge(config) {
  return config.rules.leagueChallenge === 'v2';
}

// A gym trainer's row for a tier. CONFIG.gyms.chainTrainerPokemon (correction C5,
// a MEASUREMENT variant — not a rule): null = the whole row; 1 = only its first
// Pokémon (variant B, „a shorter first battle, not a second boss”).
export function chainTrainerRow(trainer, tier, config) {
  // PT006-07 'B' / 'C' / 'D' (measurement): the gym trainer always fields 2 Pokémon — its tier-2 row at tier 1
  const row = trainer.teams[((config.rules.gymTeams ?? 'v1') !== 'v1' ? Math.max(tier, 2) : tier) - 1];
  const n = config.gyms.chainTrainerPokemon;
  return n ? row.slice(0, n) : row;
}

export function gymChainTrainers(gym, config) {
  return pickVersion(gym.chain, 'v1', `${gym.id} gym chain`).slice(0, config.gyms.chainTrainers ?? 1);
}

// Every opponent of a chain in order — `c` is state.challenge, or a preview
// ({ kind: 'gym', gymId, tier } / { kind: 'league' }) for a card before it starts.
// Each: { name, team: [species], archetype? (a gym trainer), leader?, gymId?, member?, champion? }.
export function chainOpponents(state, c) {
  if (c.kind === 'league') return LEAGUE.challengeV2.map((m) => ({ name: m.trainer, team: m.team, member: m.id, champion: Boolean(m.champion) }));
  const gym = GYMS_BY_ID[c.gymId];
  const trainers = gymChainTrainers(gym, state.config).map((t) => ({ name: t.name, archetype: t.archetype, team: chainTrainerRow(t, c.tier, state.config) }));
  return [...trainers, { name: gym.leader, leader: true, gymId: gym.id, team: gymRow(gym, c.tier, state.config) }];
}

function challengeStats(player) {
  return (player.stats.gyms.chain ??= { gymTrainerWins: 0, gymResets: 0, leagueResets: 0, quits: 0, attempts: 0 });
}

// Start the battle of the attempt's current stage.
function startChallengeStage(state) {
  const c = state.challenge;
  const player = currentPlayer(state);
  challengeStats(player);
  if (c.kind === 'league') return startLeagueMember(state, c.stage);
  const gym = GYMS_BY_ID[c.gymId];
  const trainers = gymChainTrainers(gym, state.config);
  if (c.stage < trainers.length) {
    const t = trainers[c.stage];
    const pokemonTeam = chainTrainerRow(t, c.tier, state.config).map((id) => createPokemonInstance(state, id));
    for (const p of pokemonTeam) markSeen(player, p.species);
    state.encounter = { kind: 'gym', gymId: gym.id, tier: c.tier, chainStage: c.stage, trainer: { name: t.name, archetype: t.archetype, pokemonTeam, reward: 0 }, index: 0, playerFainted: false };
    state.phase = 'encounter';
    log(state, 'gym', `🏟️ ${t.name} steps up for ${gym.leader} (${c.stage + 1} of ${c.total}): ${pokemonTeam.map((p) => getSpecies(p.species).name).join(', ')}.`);
    return state.encounter;
  }
  return startLeaderBattle(state, gym, c.tier, { chainStage: c.stage });
}

// The intermission → the next battle of the attempt.
export function continueChallenge(state) {
  state.challenge.stage += 1;
  startChallengeStage(state);
}

// „Wyjdź” in an intermission: the attempt ends (a badge / ribbon won stays).
export function quitChallenge(state) {
  const player = currentPlayer(state);
  const c = state.challenge;
  challengeStats(player).quits += 1;
  state.challenge = null;
  state.phase = 'turn';
  log(state, 'gym', `${player.name} leaves the ${c.kind === 'league' ? 'League' : GYMS_BY_ID[c.gymId].leader + "'s gym"} — next time the challenge starts from the beginning.`, { challenge: { event: 'quit', kind: c.kind } });
}

function chainEnds(state, why) {
  const player = currentPlayer(state);
  const c = state.challenge;
  if (!c) return;
  if (why === 'lost') challengeStats(player)[c.kind === 'league' ? 'leagueResets' : 'gymResets'] += 1;
  state.challenge = null;
}

export function gymWon(state) {
  const player = currentPlayer(state);
  const enc = state.encounter;
  if (state.challenge && enc.chainStage !== undefined && enc.chainStage < state.challenge.total - 1) {
    // B33-3: a gym trainer beaten — no money, no item; the intermission, then the next battle
    challengeStats(player).gymTrainerWins += 1;
    log(state, 'gym', `${player.name} beats ${enc.trainer.name}! Next: ${state.challenge.stage + 1 < state.challenge.total - 1 ? gymChainTrainers(GYMS_BY_ID[enc.gymId], state.config)[state.challenge.stage + 1].name : GYMS_BY_ID[enc.gymId].leader} — no Poké Stop on the way: damage stays.`, { challenge: { event: 'stageWon', kind: 'gym', stage: enc.chainStage } });
    endEncounter(state, 'gymWon');
    state.phase = 'challenge';
    return;
  }
  chainEnds(state, 'won');
  const gym = GYMS_BY_ID[enc.gymId];
  const cfg = state.config.gyms;
  player.badges.push(gym.id);
  player.money += cfg.reward.money;
  const s = player.stats.gyms;
  s.wins[enc.tier - 1] += 1;
  s.badges.push({ gym: gym.id, round: state.turn.round, tier: enc.tier, power: teamPower(player) });
  if (player.badges.length >= cfg.badgesForLeague && s.eligibleRound === null) s.eligibleRound = state.turn.round;
  log(state, 'gym', `🏅 ${player.name} beats ${gym.leader} and wins the ${gym.badge}! (+${cfg.reward.money} money, ${player.badges.length} badge${player.badges.length === 1 ? '' : 's'})`);
  // Phase 2 star games only: in Growth games the gym's Growth comes from the
  // leader's Pokémon defeated in the battle, never from the badge (DQ-83).
  if (cfg.starsPerBadge && !usesGrowth(state)) awardStars(state, cfg.starsPerBadge, 'gymWon');
  const item = gymRewardItem(gym, state.config);
  if (item) {
    addItem(player, item, 1);
    log(state, 'gym', `🎁 ${gym.leader} also gives ${player.name} a ${ITEMS[item].name}.`, { gymReward: { gym: gym.id, item } });
  }
  if (gym.grants && !player.capabilities[gym.grants]) {
    player.capabilities[gym.grants] = true;
    log(state, 'gym', `${CAPABILITIES[gym.grants].icon} The ${gym.badge} lets ${player.name} use ${CAPABILITIES[gym.grants].name.toLowerCase()} from now on.`);
  }
  if (player.badges.length === cfg.badgesForLeague) log(state, 'gym', `🏆 ${player.name} can now take the League Challenge at Indigo Plateau!`);
  endEncounter(state, 'gymWon');
}

export function gymLost(state) {
  const player = currentPlayer(state);
  const gym = GYMS_BY_ID[state.encounter.gymId];
  const s = player.stats.gyms;
  s.lost[gym.id] = (s.lost[gym.id] ?? 0) + 1;
  const chain = Boolean(state.challenge);
  chainEnds(state, 'lost');
  log(state, 'encounter', `All of ${player.name}'s Pokémon fainted. ${state.encounter.trainer.name} wins — nothing is lost, try again on another turn${chain ? ' (the gym challenge starts from the beginning)' : ''}.`);
  endEncounter(state, 'gymLost');
}

// ---- League ---------------------------------------------------------------------------

export function leagueHere(state, player) {
  return gymsEnabled(state) && player.location === LEAGUE.location;
}

export function leagueChallengeBlocker(state, player) {
  if (!leagueHere(state, player)) return 'The League is at Indigo Plateau';
  if (player.league.champion) return `${player.name} is already Champion`;
  if (placeClosedNow(state, LEAGUE.location)) return 'The League is closed right now — come back when the place is open again';
  const need = state.config.gyms.badgesForLeague;
  if (player.badges.length < need) return `Needs ${need} badges (has ${player.badges.length})`;
  if (state.turn.leagueChallenged) return 'Only one League Challenge per turn';
  if (!hasHealthyPokemon(player)) return 'All Pokémon have fainted — heal first';
  if (state.phase !== 'turn' || state.turn.actionsRemaining <= 0) return 'No action left';
  return null;
}

export function canChallengeLeague(state, player) {
  return leagueChallengeBlocker(state, player) === null;
}

// A League stage's full team in the roster version this game plays
// (rules.leagueRoster).
export function leagueRoster(state, index) {
  const stage = LEAGUE.stages[index];
  return pickVersion(stage.teams, state.config.rules.leagueRoster, `${stage.id} League team`);
}

// The team a League stage fields; the Elite Four can be shortened by
// CONFIG.league.eliteFourSize (a DQ-51 test lever).
export function leagueStageTeam(state, index) {
  const team = leagueRoster(state, index);
  return index === 0 ? team.slice(0, state.config.league.eliteFourSize ?? team.length) : team;
}

// Stages still to beat for this player (index into LEAGUE.stages).
export function leagueStartStage(state, player) {
  if (usesLeagueChallenge(state.config)) return 0; // B33-3: the ribbon never skips (review C6)
  return player.league.ribbon && state.config.league.keepEliteFourRibbon ? 1 : 0;
}

export function startLeague(state) {
  const player = currentPlayer(state);
  state.turn.leagueChallenged = true;
  if (usesLeagueChallenge(state.config)) {
    // B33-3: Lorelei → Bruno → Agatha → Lance, one challenge, an intermission after each
    const s = player.stats.gyms.league;
    s.attempts += 1;
    state.challenge = { kind: 'league', stage: 0, total: LEAGUE.challengeV2.length, startedRound: state.turn.round };
    log(state, 'gym', `🏆 ${player.name} takes the League Challenge: ${LEAGUE.challengeV2.map((m) => m.trainer).join(' → ')}!`, { challenge: { event: 'start', kind: 'league', total: LEAGUE.challengeV2.length } });
    startChallengeStage(state);
    return;
  }
  const stage = leagueStartStage(state, player);
  const s = player.stats.gyms.league;
  s.attempts += 1;
  if (stage === 1) s.ribbonAttempts += 1;
  log(state, 'gym', `🏆 ${player.name} takes the League Challenge${stage === 1 ? ' — the Elite Four Ribbon goes straight to Lance' : ''}!`);
  startLeagueStage(state, stage, stage === 1);
}

function startLeagueStage(state, index, fromRibbon = false) {
  const player = currentPlayer(state);
  const stage = LEAGUE.stages[index];
  const pokemonTeam = leagueStageTeam(state, index).map((id) => createPokemonInstance(state, id));
  for (const p of pokemonTeam) markSeen(player, p.species);
  const s = player.stats.gyms.league;
  if (index === 0) s.eliteFourAttempts += 1;
  else s.lanceAttempts += 1;
  state.encounter = {
    kind: 'league', stage: index, fromRibbon, biome: null, index: 0, playerFainted: false,
    trainer: { name: stage.name, owners: stage.trainers.length === leagueRoster(state, index).length ? stage.trainers : null, pokemonTeam, reward: 0 },
  };
  state.phase = 'encounter';
  const team = pokemonTeam.map((p, i) => `${stage.trainers[i] ?? stage.trainers[0]}'s ${getSpecies(p.species).name}`).join(', ');
  log(state, 'gym', `${stage.name}: ${team}.`);
}

export function leagueStageWon(state) {
  const player = currentPlayer(state);
  const enc = state.encounter;
  const s = player.stats.gyms.league;
  if (enc.v2 && !LEAGUE.challengeV2[enc.stage].champion) {
    // B33-3: a member beaten → the intermission; the third one earns the ribbon (recorded, never a skip)
    const ribbon = LEAGUE.challengeV2[enc.stage + 1]?.champion;
    if (ribbon) {
      s.eliteFourWins += 1;
      player.league.ribbon = true;
    }
    log(state, 'gym', `${player.name} beats ${enc.trainer.name}!${ribbon ? ' 🎀 The Elite Four Ribbon (a record — it never skips a battle).' : ''} Intermission: items and the lead, no Poké Stop — then ${LEAGUE.challengeV2[enc.stage + 1].trainer}.`, { challenge: { event: 'stageWon', kind: 'league', stage: enc.stage, ribbon: Boolean(ribbon) } });
    endEncounter(state, ribbon ? 'eliteFourWon' : 'gymWon');
    state.phase = 'challenge';
    return;
  }
  if (enc.v2) chainEnds(state, 'won');
  if (enc.stage === 0) {
    s.eliteFourWins += 1;
    player.league.ribbon = true;
    endEncounter(state, 'eliteFourWon');
    log(state, 'gym', `🎀 ${player.name} beats the Elite Four and earns the Elite Four Ribbon! Intermission: use Potions / Revives and set the lead — then Champion Lance.`);
    if (state.config.league.itemsBetweenStages) state.phase = 'league'; // the lead is set in the intermission
    else {
      startLeagueStage(state, 1);
      markLeadPick(state); // DQ-107: no intermission — Lance's battle starts with the pick
    }
    return;
  }
  s.lanceWins += 1;
  if (enc.fromRibbon) s.ribbonWins += 1;
  player.league.champion = true;
  player.league.championRound = state.turn.round;
  player.stats.gyms.championRound = state.turn.round;
  log(state, 'gym', `👑 ${player.name} beats Champion Lance and becomes the Pokémon League Champion!`);
  onChampion(state, player); // final week; the Champion's turn ends (Step 6)
  endEncounter(state, 'leagueWon');
}

export function leagueStageLost(state) {
  const player = currentPlayer(state);
  if (state.encounter.v2) {
    chainEnds(state, 'lost');
    log(state, 'encounter', `All of ${player.name}'s Pokémon fainted. ${state.encounter.trainer.name} wins — the next League Challenge starts again with ${LEAGUE.challengeV2[0].trainer}.`, { challenge: { event: 'reset', kind: 'league' } });
    endEncounter(state, 'leagueLost');
    return;
  }
  const stage = LEAGUE.stages[state.encounter.stage];
  if (!state.config.league.keepEliteFourRibbon) player.league.ribbon = false;
  const keep = state.encounter.stage === 1 && player.league.ribbon;
  log(state, 'encounter', `All of ${player.name}'s Pokémon fainted. ${stage.name} wins${keep ? ' — the Elite Four Ribbon stays: next time, straight to Lance' : ''}.`);
  endEncounter(state, 'leagueLost');
}

// B33-3: one League member's battle (index into LEAGUE.challengeV2).
function startLeagueMember(state, index) {
  const player = currentPlayer(state);
  const member = LEAGUE.challengeV2[index];
  const pokemonTeam = member.team.map((id) => createPokemonInstance(state, id));
  for (const p of pokemonTeam) markSeen(player, p.species);
  const s = player.stats.gyms.league;
  if (member.champion) s.lanceAttempts += 1;
  else if (index === 0) s.eliteFourAttempts += 1;
  state.encounter = {
    kind: 'league', v2: true, stage: index, member: member.id, fromRibbon: false, biome: null, index: 0, playerFainted: false,
    trainer: { name: member.trainer, owners: member.team.map(() => member.trainer), pokemonTeam, reward: 0 },
  };
  state.phase = 'encounter';
  log(state, 'gym', `${member.champion ? 'Champion ' : 'Elite Four '}${member.trainer} (${index + 1} of ${LEAGUE.challengeV2.length}): ${pokemonTeam.map((p) => getSpecies(p.species).name).join(', ')}.`);
  return state.encounter;
}

// Intermission → stage 2.
export function continueLeague(state) {
  startLeagueStage(state, 1);
}

export function recordIntermissionItem(state, player, item) {
  if (state.phase === 'challenge') {
    // B33-3: items between the battles of a chain (gym or League v2)
    const c = challengeStats(player);
    c.items = (c.items ?? 0) + 1;
    return;
  }
  const s = player.stats.gyms.league;
  if (item === 'potion') s.intermissionPotions += 1;
  if (item === 'revive') s.intermissionRevives += 1;
}

// Debug: give or take a badge (granted capabilities stay).
export function debugToggleBadge(state, gymId) {
  const player = currentPlayer(state);
  if (hasBadge(player, gymId)) player.badges = player.badges.filter((id) => id !== gymId);
  else {
    player.badges.push(gymId);
    const gym = GYMS_BY_ID[gymId];
    if (gym.grants) player.capabilities[gym.grants] = true;
  }
}
