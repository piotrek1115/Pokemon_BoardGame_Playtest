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
//
// Gameplay P1 (schema 15; DQ-89…95) adds seven switches, the wild-encounter
// slice (09.10.2026) an eighth: wildTemperament. Every save made
// before schema 15 — a Phase 2 game or a Build 2 game — gets them at their old
// values (P1_OFF) when it loads, so it plays on exactly as it began; only new
// games get Gameplay P1.
//
// Phase 3B Macro 01 (10.10.2026, after the Build 3.0 family playtest) adds five
// switches — pokeStops, oakJobs, oakKit, catchDice, explorePools. A Build 3.0
// save (schema 16) has none of them: it gets their old values (M01_OFF, the
// same as PHASE2_RULES) when it loads and plays on exactly as it began; only
// new games get Macro 01. No schema bump: the new state (Oak's jobs, the
// emergency kit) exists only in games created with the switches on.
//
// Playtest 004 (11.10.2026, after the family's Build 3.1 game) adds two switches
// — evolutionGrowth, leadPick — and a third value of growthFainted ('battle').
// A Build 3.1 save has none of the new switches and growthFainted false: it
// gets PT4_OFF when it loads and plays on exactly as it began (its thresholds,
// its Growth, no lead pick); only new games get Playtest 004. No schema bump.
//
// Phase 3B Macro 02 slice M02-1 (12.10.2026) adds one switch — localPools ('v2'
// explicit per-place pools with the signature guarantee). An older save gets
// M021_OFF (biome pools). Content is NOT versioned (Piotr, 12.10 10:28: every
// family test starts a new game): the 55 new species are in every game's
// biome pools and trainer teams too, so an older save plays on with them.
// No schema bump.
//
// Slice M02-2 (12.10.2026) adds one switch — fatigue (exploration fatigue per
// player × place, engine/fatigueEngine.js) — and new games turn Vigilance off:
// fatigue takes its Catch Die step (§6.6). An older save has no fatigue switch
// and gets false; its Vigilance stays what it stored. No schema bump: the
// counters exist only in games created with the switch on.
//
// Build 3.3 (PLAYTEST_005, docs/BUILD_3_3_SPEC.md; Piotr's decisions 13.10.2026)
// adds switches slice by slice; every one is off in an older save (B33_OFF), so a
// Build 3.2 game plays on exactly as it began. Stage 1 (B33-1 combat):
// battleTempo ('v2': a healing item in battle costs the exchange and the
// opponent answers — no per-Pokémon cap, DEC-16 B), rocketMeowth ('always':
// Meowth fights with Jessie and James in every Rocket battle, DEC-15 M1),
// initiative ('fsB': First Strike „Szybkie wejście”, DEC-12). Stage 2 (A1
// sandbox foundations): starts ('character': Ash / Gary Pallet, Brock Pewter,
// Misty Cerulean), hometownGym (Brock's / Misty's first badge elsewhere — the
// gymUnlock credential), travelGraph ('v2': mission routing through the one
// effective graph, AUD-03). Stage 3 (B33-3): gymChallenge ('v2': a gym is a
// chain of gym trainer(s) → leader in one challenge, CONFIG.gyms.chainTrainers
// PROVISIONAL) and leagueChallenge ('v2': Lorelei → Bruno → Agatha → Lance, a
// full reset on a loss or exit, the ribbon never skips). Stage 4: rest 'v3'
// (Rest +2 on one chosen non-fainted Pokémon, 1 action; Build 3.2 keeps 'v2' = +1 —
// the value every Build 3.2 save stores). Correction batch (13.10): growthCredits
// (a gym / League opponent pays its Growth once per player, across attempts —
// no farming through resets). No schema bump.

// Every switch at the value the game had before Phase 3A.
export const PHASE2_RULES = Object.freeze({
  ruleset: 'phase2', // label only: which rules this game was started under
  evolution: 'stars', // 'stars': shared Evolution Stars (DQ-22 / DQ-35) → 3A-1 'growth' per Pokémon (DQ-74…79)
  questRewards: 'v1', // data/quests.js reward set → 3A-1 'v2' without ⭐ (DQ-87)
  counterattackOnStay: false, // 3A-2: a wild Pokémon that stays after a failed throw strikes back (DQ-80)
  battleItems: false, // 3A-2: Potion / Revive replace the attack in battle (DQ-81)
  trainerRetreat: false, // 3A-2: run from a trainer battle with a light penalty (DQ-82)
  gymRoster: 'v1', // data/gyms.js gym rosters (1/2/2) → 3A-3 'v2' (2/3/3, DQ-44 / DQ-83)
  gymReward: 'v1', // badge + money (+ ⭐ with stars) → 3A-3 'v2': + one thematic item (DQ-83)
  leagueRoster: 'v1', // data/gyms.js League teams → 3A-3 'v2' (Elite Four ≥ tier-3 gyms, DQ-83)
  rocketMobility: 'v1', // plots stay until beaten → 3A-4 'v2': plot age, escape and relocation (DQ-84)
  travelNetwork: 'v1', // the canonical map edges → 3A-5 'v2': + Underground Paths Route 5 ↔ 6 and 7 ↔ 8 (DQ-85)
  pokeStop: 'v1', // 1 action: full heal + the shop → P1 'v2': Leczenie and Sklep, 1 action each (DQ-89)
  rest: 'v1', // Rest +2 HP → P1 'v2': +1 HP (DQ-90) → Build 3.3 'v3': +2 HP on one chosen non-fainted Pokémon again (B33 stage 4, approved)
  healingItems: 'v1', // Potion / Revive (in battle: instead of the attack) → P1 'v2': + Super Potion, free in battle, 1 per Pokémon per battle (DQ-91)
  growthFainted: false, // true = the DQ-92 SOFT experiment (per opponent, rejected 09.10) → Playtest 004 'battle': no new Growth from a battle the Pokémon fainted in (DQ-105)
  selling: false, // P1: sell for half the price in the shop (DQ-94)
  oakBox: false, // P1: the reserve is Professor Oak's Box — a choice on a full-team catch, free swaps in Poké Stop cities (DQ-95)
  vigilance: false, // P1 (provisional balance): catches in one place make its Pokémon warier (DQ-93)
  wildTemperament: false, // wild-encounter slice: species temperament decides when the Escape Die is rolled (data/temperament.js)
  pokeStops: 'v1', // the 6 Poké Stop hubs → Macro 01 'v2': + Pewter, Saffron (every gym city) · 'v3': + Lavender, Cinnabar too (data/pokeStops.js)
  oakJobs: false, // Macro 01: Professor Oak's Research Jobs in Pallet Town (engine/oakEngine.js)
  oakKit: false, // Macro 01: Oak's emergency kit — 1 Poké Ball, once per game, for a player with no ball and no money for one
  catchDice: 'v1', // magenta 1/6 · purple 2/6 · blue 3/6 → Macro 01 'v2': + green 4/6 (exactly 1 HP visibly better)
  explorePools: 'v1', // pick a biome on every Explore → Macro 01 'v2': per place MIXED / CHOOSE / SINGLE (data/locations.js `explore`)
  evolutionGrowth: 'v1', // the Growth an evolution needs: the species data → Playtest 004 'v2': every edge +1 (DQ-106; growthEngine growthNeeded)
  leadPick: false, // Playtest 004: before a trainer / gym / Rocket / League battle the player picks a healthy lead, free (DQ-107)
  localPools: 'v1', // biome pools → M02-1 'v2': explicit per-place pools + the signature guarantee (data/pools.js)
  fatigue: false, // M02-2: exploration fatigue per player × place (engine/fatigueEngine.js); replaces vigilance in new games
  battleTempo: 'v1', // healing in battle per healingItems → Build 3.3 'v2': it costs the exchange, the opponent answers, no per-Pokémon cap (DQ-113)
  rocketMeowth: 'cards', // Meowth only on the plot cards marked `meowth` → Build 3.3 'always': the trio in every Rocket battle (DQ-115)
  initiative: false, // no First Strike → Build 3.3 'fsB': ⚡ „Szybkie wejście” on a Pokémon's first entry into a battle (DQ-114, engine/initiativeEngine.js)
  starts: 'pallet', // everyone starts at CONFIG.startLocation → Build 3.3 'character': each character's own start (data/characters.js, DQ-122)
  hometownGym: false, // → Build 3.3 true: Brock's / Misty's first badge must come from another gym (gymEngine.gymUnlock, DQ-123)
  travelGraph: 'v1', // missions route on the bare network → Build 3.3 'v2': through the one effective graph with today's closures (engine/graphEngine.js, AUD-03, DQ-121)
  gymChallenge: 'v1', // a gym = one battle with the leader → Build 3.3 'v2': gym trainer(s) → leader in one challenge, intermissions, a loss / exit resets the attempt (DQ-118)
  leagueChallenge: 'v1', // Elite Four (one battle) → Lance, the ribbon skips the Elite Four → Build 3.3 'v2': Lorelei → Bruno → Agatha → Lance, full reset, the ribbon never skips (DQ-118)
  gymTrials: false, // gyms open as before → Build 3.3 E5 'pilot': a trial drawn once for Pewter / Cerulean / Vermilion (OPEN / SHORT / SPECIAL; data/gymTrials.js, PROVISIONAL; needs questBook 'v2')
  hunts: false, // no rare hunts → Build 3.3 E4 'pilot': 3 curated hunts + personal clues (huntEngine.js; the clock is CONFIG.hunts.clock — DEC-30 open)
  stoneSources: false, // stones from shops, gym rewards and loot only → EREV MEASUREMENT 'explore' | 'quests' | 'mixed' (data/economy3.js STONE_SOURCES; never a default without Piotr)
  questAbandon: 'v1', // a „never” quest given up is gone for the game → EREV-02 'v2': it can be taken again as a new attempt (a new occurrence, from the start) until one is collected; the attempt's key items go back (questBookEngine.canTake / abandonQuest)
  bookRewards: 'v1', // a quest pays its reward lines as written → EREV-01 'v2': a line the game cannot use pays its stated alternative (a clue with no hunt to come → `otherwise`; questBookEngine.rewardLines)
  questBook: false, // only the two mission cards → Build 3.3 E3 'v2': + the quest book (Oak contracts, people's quests, quest challenges; questBookEngine.js, PROVISIONAL content)
  shopStock: 'global', // every Poké Stop sells the same → Build 3.3 E2 'regional': basics everywhere + city extras (data/economy3.js, PROVISIONAL)
  ultraBall: false, // → Build 3.3 E2 true: the Ultra Ball exists (regional shops, Rocket plot rewards; +2 Catch Die steps, never sure)
  loot: false, // → Build 3.3 E2 'v1': a loot d6 after a won random-trainer battle (lootEngine.js, PROVISIONAL)
  finalRarity: 'v1', // wild final forms as in the pools → E1 MEASUREMENT variants 'R1' | 'R2' | 'R3' | 'R4' (spec §6, localPoolEngine.isOrdinaryFinal; never a default without Piotr)
  exp: false, // every award = 1 Growth → Build 3.3 E1 'K5' | 'K4': EXP = 2 + (opponent's power class − receiver's), 0–4; a cocoon that did not fight 1 (data/powerClass.js, PROVISIONAL)
  growthCredits: false, // every defeat of a gym / League Pokémon pays Growth → Build 3.3 true: once per player per opponent across attempts (correction C1, growthEngine.creditKey)
  // PLAYTEST_006 C3 (14.10.2026) — MEASUREMENT switches only (tools/balance-pt006.js), never a default without Piotr:
  gymTeams: 'v1', // gym teams as in Build 3.3 → 'B' the gym trainer fields 2 Pokémon · 'C' B + the leader 3 / 3 / 4 · 'D' B + one coverage Pokémon (PT006-07, DEC-42)
  greatBall: 'v1', // the Great Ball is one Catch Die step → 'G1' a sure catch of a trivial Pokémon (common, 1 power dot) · 'G2' the same below full HP; never a hunted one (PT006-09)
  // PLAYTEST_006 DEV pilots (One Kanto: a developer URL, never a player's mode):
  expeditions: false, // → 'pilot': Rare Expeditions — the first medium expedition (an `encounter` quest step, retry R2 „Nowy trop”; PT006-04, C4)
  rumours: false, // → 'pilot': Kanto Rumours & Opportunities — a small seeded set of opportunities discovered at Poké Stops (PT006-11, C5)
  // One Kanto day 14.10 (DEV, the evening ruleset — ui/setup.js applyAdventure; never a default without Piotr):
  oakResearch: false, // Oak's jobs pay as today → 'v1': „Oak bada nowe gatunki” — full pay only for species new to the player's research ledger (DEC-43)
  trading: false, // → 'v1': two human players at the same Poké Stop swap one Pokémon each, both agree (MP-01)
  achievements: false, // → 'v1': trophies across the whole game (ACH-01), earned once, from the game state · 'v2' (bonus 14.10): + 8 early / mid trophies
  pvp: false, // → 'v1': a voluntary 1-vs-1 duel of two human players at the same place (MP-02)
  questPack: false, // → 'day14': four new quests with new small steps (observe / show / give) (DAY-02)
  eventPack: false, // → 'b4h' (bonus 14.10): six more explore events (a backpack, a lost trainer, tracks, a bully, a stash, a local's rumour)
  signatureMoves: false, // → 'pilot' (bonus 2, 14.10, DQ-88): the four starter lines' moves, once per battle (data/signatureMoves.js)
  characterTraits: false, // → 'pilot' (bonus 2, 14.10, CHAR-01): one small power per character (data/characterTraits.js)
  eeveeBranch: false, // → 'v1' (bonus 2, 14.10): Eevee → Vaporeon / Jolteon / Flareon by the stone (data/pokemon.js BRANCH_EVOLUTIONS)
  fishing: false, // → 'v1' (bonus 14.10, M02-4 / DAY-03): the Old Rod (the sailor's quest reward, a lasting key item) and „Łów” at a place with water
  iconicWild: false, // Charizard / Blastoise / Venusaur never wild → 'w4' / 'd6': each on its route on a Super Rare roll, kept with weight ¼ / an extra d6 = 6 (PT006-02)
  koPick: false, // after a KO the next healthy Pokémon steps in (a free switch allowed) → PLAYTEST_007 'v1': a human player PICKS who comes in (encounter.leadPick 'ko'; the AI as before)
  combatMoves: false, // one attack per Pokémon → 'mvp1' (Combat MVP, 15.10, dev-1510-combat): named basic attacks, a Special / Powerful move an instance may know (once per battle), the S1 statuses in the arena (engine/combatMoves.js)
  gameMode: false, // label only, like `ruleset`: a game started before One Kanto (Build 3.3 „rodzinna” / „sandbox (pilotaż)” and older) → 'adventure': the one new-game mode „Pokémon Kanto — Przygoda” (PT006-10, Piotr 13–14.10.2026)
});

// The Gameplay P1 switches at their values before schema 15.
export const P1_OFF = Object.freeze({
  pokeStop: 'v1', rest: 'v1', healingItems: 'v1', growthFainted: false, selling: false, oakBox: false, vigilance: false,
  wildTemperament: false,
});

// The Macro 01 switches at their values before Macro 01 (Build 3.0, schema 16).
export const M01_OFF = Object.freeze({ pokeStops: 'v1', oakJobs: false, oakKit: false, catchDice: 'v1', explorePools: 'v1' });

// The Playtest 004 switches at their values before Playtest 004 (Build 3.1).
export const PT4_OFF = Object.freeze({ growthFainted: false, evolutionGrowth: 'v1', leadPick: false });

// The M02-1 switches at their values before Macro 02 (every older game).
export const M021_OFF = Object.freeze({ localPools: 'v1' });

// The M02-2 switches at their values before M02-2 (the M02-1 game): no fatigue,
// Vigilance on — vigilance is not new, every save since schema 15 stores it.
export const M022_OFF = Object.freeze({ fatigue: false, vigilance: true });

// The PLAYTEST_006 switches (measurement variants and DEV pilots) at their values before them — every older
// game, and the default of a new one.
export const PT6_OFF = Object.freeze({ gymTeams: 'v1', greatBall: 'v1', iconicWild: false, expeditions: false, rumours: false, oakResearch: false, trading: false, achievements: false, pvp: false, questPack: false, fishing: false, eventPack: false, eeveeBranch: false, characterTraits: false, signatureMoves: false });

// The PLAYTEST_007 switches (Build 3.5 DEV, dev-1510) at their values before them — every older game.
export const PT7_OFF = Object.freeze({ koPick: false, combatMoves: false });

// The Build 3.3 switches at their values before Build 3.3 (every older game).
export const B33_OFF = Object.freeze({ battleTempo: 'v1', rocketMeowth: 'cards', initiative: false, starts: 'pallet', hometownGym: false, travelGraph: 'v1', gymChallenge: 'v1', leagueChallenge: 'v1', growthCredits: false, exp: false, finalRarity: 'v1', shopStock: 'global', ultraBall: false, loot: false, questBook: false, hunts: false, gymTrials: false, bookRewards: 'v1', questAbandon: 'v1', stoneSources: false });

// The family's Build 2 game (3A-1 Growth + the 3A-2 battle loop, schema 14):
// the baseline Gameplay P1 is compared with.
export const BUILD2_RULES = Object.freeze({
  ...PHASE2_RULES,
  ruleset: 'phase3a',
  evolution: 'growth',
  questRewards: 'v2',
  counterattackOnStay: true,
  battleItems: true,
  trainerRetreat: true,
  ...P1_OFF,
});

// Values this engine can play, per switch.
export const SUPPORTED = Object.freeze({
  ruleset: ['phase2', 'phase3a', 'p1', 'm01', 'p4', 'm02', 'b33'],
  evolution: ['stars', 'growth'],
  questRewards: ['v1', 'v2'],
  counterattackOnStay: [false, true],
  battleItems: [false, true],
  trainerRetreat: [false, true],
  gymRoster: ['v1', 'v2'],
  gymReward: ['v1', 'v2'],
  leagueRoster: ['v1', 'v2'],
  rocketMobility: ['v1', 'v2'],
  travelNetwork: ['v1', 'v2'],
  pokeStop: ['v1', 'v2'],
  rest: ['v1', 'v2', 'v3'],
  healingItems: ['v1', 'v2'],
  growthFainted: [false, true, 'battle'],
  selling: [false, true],
  oakBox: [false, true],
  vigilance: [false, true],
  wildTemperament: [false, true],
  pokeStops: ['v1', 'v2', 'v3'],
  oakJobs: [false, true],
  oakKit: [false, true],
  catchDice: ['v1', 'v2'],
  explorePools: ['v1', 'v2'],
  evolutionGrowth: ['v1', 'v2', 'T0', 'T1', 'T2', 'T3'],
  leadPick: [false, true],
  localPools: ['v1', 'v2'],
  fatigue: [false, true],
  battleTempo: ['v1', 'v2'],
  rocketMeowth: ['cards', 'always'],
  initiative: [false, 'fsB'],
  starts: ['pallet', 'character'],
  hometownGym: [false, true],
  travelGraph: ['v1', 'v2'],
  gymChallenge: ['v1', 'v2'],
  leagueChallenge: ['v1', 'v2'],
  growthCredits: [false, true],
  exp: [false, 'K5', 'K4'],
  finalRarity: ['v1', 'R1', 'R2', 'R3', 'R4'],
  shopStock: ['global', 'regional'],
  ultraBall: [false, true],
  loot: [false, 'v1'],
  questBook: [false, 'v2'],
  bookRewards: ['v1', 'v2'],
  questAbandon: ['v1', 'v2'],
  stoneSources: [false, 'explore', 'quests', 'mixed'],
  hunts: [false, 'pilot'],
  gymTrials: [false, 'pilot'],
  gymTeams: ['v1', 'B', 'C', 'D'],
  greatBall: ['v1', 'G1', 'G2'],
  iconicWild: [false, 'w4', 'd6'],
  expeditions: [false, 'pilot'],
  rumours: [false, 'pilot'],
  oakResearch: [false, 'v1'],
  trading: [false, 'v1'],
  achievements: [false, 'v1', 'v2'],
  pvp: [false, 'v1'],
  questPack: [false, 'day14'],
  fishing: [false, 'v1'],
  eventPack: [false, 'b4h'],
  eeveeBranch: [false, 'v1'],
  characterTraits: [false, 'pilot'],
  signatureMoves: [false, 'pilot'],
  gameMode: [false, 'adventure'],
  koPick: [false, 'v1'],
  combatMoves: [false, 'mvp1'],
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

// The family's Build 3.0 game (Phase 3A complete, schema 16): the baseline
// Macro 01 is compared with.
export const BUILD30_RULES = Object.freeze({
  ...PHASE2_RULES,
  ruleset: 'p1',
  evolution: 'growth',
  questRewards: 'v2',
  counterattackOnStay: true,
  battleItems: true,
  trainerRetreat: true,
  gymRoster: 'v2',
  gymReward: 'v2',
  leagueRoster: 'v2',
  rocketMobility: 'v2',
  travelNetwork: 'v2',
  pokeStop: 'v2',
  rest: 'v2',
  healingItems: 'v2',
  growthFainted: false,
  selling: true,
  oakBox: true,
  vigilance: true,
  wildTemperament: true,
  ...M01_OFF,
});

// The family's Build 3.1 game (Macro 01, LIVE 11.10.2026): the baseline
// Playtest 004 is compared with. It plays on the board of new games (kanto45).
export const BUILD31_RULES = Object.freeze({
  ...BUILD30_RULES,
  ruleset: 'm01',
  pokeStops: 'v2',
  oakJobs: true,
  oakKit: true,
  catchDice: 'v2',
  explorePools: 'v2',
  ...PT4_OFF,
});

// The Playtest 004 game (DQ-105 … DQ-108, approved technically 11.10.2026, not
// published): the baseline M02-1 is compared with. The board of new games.
export const P4_RULES = Object.freeze({
  ...BUILD31_RULES,
  ruleset: 'p4',
  growthFainted: 'battle',
  evolutionGrowth: 'v2',
  leadPick: true,
  ...M021_OFF,
  ...M022_OFF,
});

// The M02-1 game (local pools v2 and wave 1, approved 12.10.2026, not
// published): the baseline M02-2 is compared with.
export const M021_RULES = Object.freeze({
  ...P4_RULES,
  ruleset: 'm02',
  localPools: 'v2',
});

// The M02-2 game — Family Playtest Build 3.2 (LIVE 12.10.2026): the baseline
// Build 3.3 is compared with.
export const BUILD32_RULES = Object.freeze({
  ...M021_RULES,
  fatigue: true,
  vigilance: false,
  ...B33_OFF,
});

// A copy of `config` that plays the named ruleset: 'phase2' (the Phase 2
// baseline), 'build2' (the family's Build 2 game, before Gameplay P1),
// 'build30' (the family's Build 3.0 game, before Macro 01), 'build31' (the
// family's Build 3.1 game, before Playtest 004), 'p4' (Playtest 004, before
// Macro 02 M02-1), 'm021' (M02-1, before fatigue), 'build32' (Build 3.2, before
// Build 3.3) or 'current' (CONFIG.rules as passed in, unchanged).
export function withRuleset(config, name) {
  const copy = structuredClone(config);
  if (name === 'phase2') copy.rules = { ...PHASE2_RULES };
  else if (name === 'build2') copy.rules = { ...BUILD2_RULES };
  else if (name === 'build30') copy.rules = { ...BUILD30_RULES };
  else if (name === 'build31') copy.rules = { ...BUILD31_RULES };
  else if (name === 'p4') copy.rules = { ...P4_RULES };
  else if (name === 'm021') copy.rules = { ...M021_RULES };
  else if (name === 'build32') copy.rules = { ...BUILD32_RULES };
  else if (name !== 'current') throw new Error(`Unknown ruleset: ${name} (phase2 | build2 | build30 | build31 | p4 | m021 | build32 | current)`);
  // An older game plays on the board it had: the Build 3.0 family board (games
  // saved before the merge move to it when they load) — DQ-104. Build 3.1 has
  // the board of new games already (kanto45).
  if (!['current', 'build31', 'p4', 'm021', 'build32'].includes(name)) copy.map = { ...copy.map, topology: 'kanto43' };
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
