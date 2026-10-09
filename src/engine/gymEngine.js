// Gyms, badges and the League (Step 5, V1 "Open Gyms").
//
// Gym Challenge: 1 action in a gym city, max 1 per turn, needs a healthy
// Pokémon and a badge you don't have yet. One battle (encounter kind 'gym',
// the trainer flow: fight only) against the leader's row for your tier —
// your own badge count decides it (CONFIG.gyms.tierByBadges). Win: badge +
// reward money + CONFIG.gyms.starsPerBadge Evolution Stars (once per gym),
// plus the badge's capability (Soul Badge → water travel). Losing costs
// nothing. No mission progress either way.
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

export function gymRow(gym, tier, config) {
  return gymTiers(gym, config)[tier - 1];
}

export function gymHere(state, player) {
  return gymsEnabled(state) ? gymInCity(player.location) : null;
}

export function gymChallengeBlocker(state, player) {
  const gym = gymHere(state, player);
  if (!gym) return 'There is no gym here';
  if (hasBadge(player, gym.id)) return `You already have the ${gym.badge}`;
  if (state.turn.gymChallenged) return 'Only one Gym Challenge per turn';
  if (!hasHealthyPokemon(player)) return 'All Pokémon have fainted — heal first';
  if (state.phase !== 'turn' || state.turn.actionsRemaining <= 0) return 'No action left';
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
  const pokemonTeam = gymRow(gym, tier, state.config).map((id) => createPokemonInstance(state, id));
  for (const p of pokemonTeam) markSeen(player, p.species);
  const s = player.stats.gyms;
  s.attempts[tier - 1] += 1;
  if (s.lost[gym.id]) s.retries += 1;
  state.encounter = { kind: 'gym', gymId: gym.id, tier, trainer: { name: gym.leader, pokemonTeam, reward: 0 }, index: 0, playerFainted: false };
  state.phase = 'encounter';
  const team = pokemonTeam.map((p) => getSpecies(p.species).name).join(', ');
  log(state, 'gym', `🏟️ ${player.name} challenges ${gym.leader} at the ${getLocation(gym.city).name} Gym — tier ${tier} (${player.badges.length} badge${player.badges.length === 1 ? '' : 's'}): ${team}.`);
  return state.encounter;
}

export function gymWon(state) {
  const player = currentPlayer(state);
  const enc = state.encounter;
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
  log(state, 'encounter', `All of ${player.name}'s Pokémon fainted. ${gym.leader} wins — nothing is lost, try again on another turn.`);
  endEncounter(state, 'gymLost');
}

// ---- League ---------------------------------------------------------------------------

export function leagueHere(state, player) {
  return gymsEnabled(state) && player.location === LEAGUE.location;
}

export function leagueChallengeBlocker(state, player) {
  if (!leagueHere(state, player)) return 'The League is at Indigo Plateau';
  if (player.league.champion) return `${player.name} is already Champion`;
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
  return player.league.ribbon && state.config.league.keepEliteFourRibbon ? 1 : 0;
}

export function startLeague(state) {
  const player = currentPlayer(state);
  state.turn.leagueChallenged = true;
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
  if (enc.stage === 0) {
    s.eliteFourWins += 1;
    player.league.ribbon = true;
    endEncounter(state, 'eliteFourWon');
    log(state, 'gym', `🎀 ${player.name} beats the Elite Four and earns the Elite Four Ribbon! Intermission: use Potions / Revives and set the lead — then Champion Lance.`);
    if (state.config.league.itemsBetweenStages) state.phase = 'league';
    else startLeagueStage(state, 1);
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
  const stage = LEAGUE.stages[state.encounter.stage];
  if (!state.config.league.keepEliteFourRibbon) player.league.ribbon = false;
  const keep = state.encounter.stage === 1 && player.league.ribbon;
  log(state, 'encounter', `All of ${player.name}'s Pokémon fainted. ${stage.name} wins${keep ? ' — the Elite Four Ribbon stays: next time, straight to Lance' : ''}.`);
  endEncounter(state, 'leagueLost');
}

// Intermission → stage 2.
export function continueLeague(state) {
  startLeagueStage(state, 1);
}

export function recordIntermissionItem(state, player, item) {
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
