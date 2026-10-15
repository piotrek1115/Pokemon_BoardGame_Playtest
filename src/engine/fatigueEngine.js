// Phase 3B Macro 02 — M02-2 (rules.fatigue, new games): exploration fatigue,
// per player × place. docs/PHASE_3B_MACRO_02.md §6.
//
// The contract (§6.2) — one counter, read and raised by the ACTION, never by
// the modules that pay a reward:
// - READ FIRST. An Explore (and, when it comes with the Old Rod — M02-4, a
//   fishing try) reads `player.fatigue[place]` before anything happens. That
//   level is the level of everything the action produces: the encounter roll,
//   the wild battle, the catch, a random trainer — and of the battle an event
//   of this Explore starts. It is stamped on the battle (`encounter.fatigue`)
//   and on a pending event (`pendingEvent.fatigue`), so a save in the middle
//   reloads with it and nothing is read twice.
// - THEN +1. The count rises by 1 when the action has been dispatched,
//   whatever it found (a Pokémon, a trainer, an event, Team Rocket, nothing).
//   One action = one +1: a fight followed by a catch is still one Explore.
// - WEEKLY DECAY. At the start of each week (the round number grows, before
//   the first player's turn, the moment of Team Rocket's week start) every count
//   of every player drops by CONFIG.fatigue.decay (min 0). Moving away and back
//   changes nothing.
//
// Levels (CONFIG.fatigue.thresholds, the count BEFORE the action):
//   0 fresh      as without fatigue
//   1 tired      no Growth from the battle (a wild Pokémon defeated, a catch
//                after a fight, a random trainer); the Catch Die one step
//                harder (Vigilance's job — a game with fatigue has no Vigilance)
//   2 exhausted  as tired + a random trainer pays no money, and the encounter
//                roll's „Pokémon” on CONFIG.fatigue.quietFaces is „Cisza”
// Never touched (§6.4): the signature guarantee (its Explore reads and raises
// the count, but it is never turned into „Cisza” and never leaves the
// signature list), Team Rocket, gyms, the League, events' own effects, the
// Pokédex, quests (a catch or a trainer win still counts), another player's
// count. No random draw anywhere: the RNG streams are those of M02-1.
// Older games (no rules.fatigue) never reach any of this.
export const FATIGUE_LEVELS = ['fresh', 'tired', 'exhausted'];

export function usesFatigue(config) {
  return config.rules.fatigue === true;
}

export function fatigueCount(player, place) {
  return player.fatigue?.[place] ?? 0;
}

export function levelForCount(count, config) {
  const [tired, exhausted] = config.fatigue.thresholds;
  return count >= exhausted ? 2 : count >= tired ? 1 : 0;
}

// The level an action of this player here would read now (0 without fatigue).
export function placeFatigue(player, place, config) {
  if (!usesFatigue(config)) return 0;
  return levelForCount(fatigueCount(player, place), config);
}

// The action has been dispatched: +1 here.
export function raiseFatigue(player, place, config) {
  if (!usesFatigue(config)) return;
  player.fatigue[place] = fatigueCount(player, place) + 1;
}

// The week start: every count of every player falls (a zero is removed).
export function fatigueWeekStart(state) {
  if (!usesFatigue(state.config)) return;
  const decay = state.config.fatigue.decay;
  for (const p of state.players) {
    for (const [place, n] of Object.entries(p.fatigue)) {
      if (n > decay) p.fatigue[place] = n - decay;
      else delete p.fatigue[place];
    }
  }
}

// ---- what a level does --------------------------------------------------------

// A battle this action produced (wild or a random trainer): stamped with the level.
export function stampBattle(state, level) {
  const enc = state.encounter;
  if (level > 0 && enc && (enc.kind === 'wild' || enc.kind === 'trainer')) enc.fatigue = level;
}

// The encounter roll's „Pokémon” becomes „Cisza” at an exhausted place.
export function quietFace(roll, level, config) {
  return level >= 2 && config.fatigue.quietFaces.includes(roll);
}

// No Growth from this battle (a tired or exhausted place).
export function battleGivesNoGrowth(enc) {
  return (enc?.fatigue ?? 0) >= 1;
}

// A random trainer here pays no money (an exhausted place).
export function trainerPaysNothing(enc) {
  return (enc?.fatigue ?? 0) >= 2;
}

// The Catch Die steps harder in this battle.
export function fatigueCatchSteps(enc, config) {
  return (enc?.fatigue ?? 0) >= 1 ? config.fatigue.catchSteps : 0;
}
