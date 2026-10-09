// Phase 3 rule switches (docs/PHASE_3_POST_PLAYTEST_REDESIGN.md).
//
// Every rule Phase 3A changes sits behind one switch in CONFIG.rules. A game
// keeps the switches it was created with (they live in state.config), so a game
// started before a change plays on exactly as it began. Saves from before Phase
// 3 (schema 12) are migrated to the 'phase2' ruleset below: the Phase 2 game,
// byte for byte. The simulator's Phase 2 baseline uses the same ruleset
// (`npm run simulate -- --rules phase2`).
//
// Each 3A slice that implements a rule adds its value to SUPPORTED and flips
// the switch in CONFIG.rules for new games; PHASE2_RULES never changes.

// Every switch at the value the game had before Phase 3A.
export const PHASE2_RULES = Object.freeze({
  ruleset: 'phase2', // label only: which rules this game was started under
  evolution: 'stars', // 'stars': shared Evolution Stars (DQ-22 / DQ-35) → 3A-1 'growth' per Pokémon (DQ-74…79)
  questRewards: 'v1', // data/quests.js reward set → 3A-1 'v2' without ⭐ (DQ-87)
  counterattackOnStay: false, // 3A-2: a wild Pokémon that stays after a failed throw strikes back (DQ-80)
  battleItems: false, // 3A-2: Potion / Revive replace the attack in battle (DQ-81)
  trainerRetreat: false, // 3A-2: run from a trainer battle with a light penalty (DQ-82)
  gymRoster: 'v1', // data/gyms.js gym rosters (1/2/2) → 3A-3 'v2' (2/3/3)
  gymReward: 'v1', // badge + money (+ ⭐ with stars) → 3A-3 thematic item (DQ-83)
  leagueRoster: 'v1', // data/gyms.js League teams → 3A-3 review (DQ-83)
  rocketMobility: 'v1', // plots stay until beaten → 3A-4 plot age / relocation (DQ-84)
  travelNetwork: 'v1', // canonical map edges → 3A-5 Underground Paths (DQ-85)
});

// Values this engine can play, per switch.
export const SUPPORTED = Object.freeze({
  ruleset: ['phase2', 'phase3a'],
  evolution: ['stars', 'growth'],
  questRewards: ['v1', 'v2'],
  counterattackOnStay: [false, true],
  battleItems: [false, true],
  trainerRetreat: [false, true],
  gymRoster: ['v1'],
  gymReward: ['v1'],
  leagueRoster: ['v1'],
  rocketMobility: ['v1'],
  travelNetwork: ['v1'],
});

// Why these switches can't be played here (a newer version of the game made
// them), or null when they can.
export function rulesProblem(rules) {
  if (!rules || typeof rules !== 'object') return 'no rule switches';
  for (const [key, value] of Object.entries(rules)) {
    if (!Object.hasOwn(SUPPORTED, key)) return `unknown rule switch "${key}"`;
    if (!SUPPORTED[key].includes(value)) return `rule ${key} = ${JSON.stringify(value)} is not supported by this version`;
  }
  const missing = Object.keys(SUPPORTED).filter((key) => !Object.hasOwn(rules, key));
  return missing.length ? `missing rule switches: ${missing.join(', ')}` : null;
}

export function validateRules(config) {
  const problem = rulesProblem(config.rules);
  if (problem) throw new Error(`Rules: ${problem}`);
}

// A copy of `config` that plays the named ruleset: 'phase2' (the Phase 2
// baseline) or 'current' (CONFIG.rules as passed in, unchanged).
export function withRuleset(config, name) {
  const copy = structuredClone(config);
  if (name === 'phase2') copy.rules = { ...PHASE2_RULES };
  else if (name !== 'current') throw new Error(`Unknown ruleset: ${name} (phase2 | current)`);
  validateRules(copy);
  return copy;
}

export function isPhase2Game(state) {
  return state.config.rules.ruleset === 'phase2';
}

// Data that changed between rule versions holds { v1: …, v2: … }; the game's
// switch names the version it plays with, so a saved game keeps its data.
export function pickVersion(table, version, what) {
  if (!table || !Object.hasOwn(table, version)) throw new Error(`No ${what} for version ${version}`);
  return table[version];
}
