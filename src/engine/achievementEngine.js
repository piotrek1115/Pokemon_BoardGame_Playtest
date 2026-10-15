// One Kanto day 14.10 — ACHIEVEMENTS (rules.achievements 'v1'; data/achievements.js). After every action
// (turnEngine.dispatch) each player's measures are read from the game state — the engine's own counters — and
// any achievement whose target is reached is earned ONCE: player.achievements.earned[id] = the week. Idempotent
// (earned stays earned, a reload / replay reads the same state), per player, offline. Points are provisional
// data for a future score; the game's end does not use them.
import { ACHIEVEMENT_SETS } from '../data/achievements.js';
import { log } from './log.js';

export const usesAchievements = (config) => Boolean(ACHIEVEMENT_SETS[config.rules.achievements]);
// The trophies of this game: 'v1' (dev-1410) or 'v2' (bonus 14.10: + 8 early / middle ones). No config = 'v1'.
export const achievementList = (config = null) => ACHIEVEMENT_SETS[config?.rules.achievements] ?? ACHIEVEMENT_SETS.v1;

// What each measure counts, from the state (no UI counters).
export const MEASURES = {
  pvpWins: (p) => p.stats.pvp?.qualifiedWins ?? 0, // only QUALIFIED wins (pvpEngine — anti-farm)
  trades: (p) => p.stats.trades ?? 0,
  oakJobs: (p) => p.stats.oak?.returned ?? 0, // completed Research Jobs
  rocketPlots: (p) => p.stats.rocket?.cleared ?? 0, // each plot is cleared once, by one player
  places: (p) => (p.visited ?? []).length,
  species: (p) => p.pokedex.caught.length,
  evolutions: (p) => p.stats.evolutions ?? 0,
  quests: (p) => Object.values(p.questRecords?.byQuest ?? {}).filter((q) => q.completed > 0).length, // DIFFERENT quests
  champion: (p) => (p.league?.champion ? 1 : 0),
  // bonus 14.10 ('v2'): real engine counters only
  wildCatches: (p) => p.stats.capture?.catches ?? 0, // wild Pokémon caught (captureEngine)
  teamSize: (p) => p.team.length,
  rocketWins: (p) => p.stats.rocket?.wins ?? 0, // battles won against Team Rocket
  superRareMet: (p) => p.stats.capture?.byRarity?.superRare?.encounters ?? 0, // wild Super Rare encounters (captureEngine)
  fishCaught: (p) => p.stats.fishing?.caught ?? 0, // caught on the Old Rod (fishingEngine)
};

export function setupAchievements(state) {
  if (!usesAchievements(state.config)) return;
  for (const p of state.players) p.achievements = { earned: {} };
}

export function achievementProgress(player, config = null) {
  return achievementList(config).map((a) => ({ ...a, value: Math.min(a.target, MEASURES[a.measure](player)), earned: player.achievements?.earned[a.id] ?? null }));
}

// Provisional points: per chain only the highest earned tier counts (data/achievements.js chainId).
export function achievementPoints(player, config = null) {
  const best = {};
  for (const a of achievementList(config)) if (player.achievements?.earned[a.id] != null && a.tier > (best[a.chainId]?.tier ?? 0)) best[a.chainId] = a;
  return Object.values(best).reduce((sum, a) => sum + a.points, 0);
}

export function checkAchievements(state) {
  if (!usesAchievements(state.config)) return;
  for (const p of state.players) {
    if (!p.achievements) continue;
    for (const a of achievementList(state.config)) {
      if (p.achievements.earned[a.id] != null || MEASURES[a.measure](p) < a.target) continue;
      p.achievements.earned[a.id] = state.turn.round;
      log(state, 'achievement', `🏆 ${p.name} earns ${a.name}!`, { achievement: { id: a.id, player: p.id } });
    }
  }
}
