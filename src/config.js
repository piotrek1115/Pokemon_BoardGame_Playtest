// CONFIG is the single tuning surface for rules and balance.
// Engine code reads these values from `state.config` (a snapshot taken when a
// game is created), so saved games and simulations stay self-contained.
// Content (Pokémon, locations, trainers, events) lives in src/data/.
//
// Values the handoff spec left open carry a design-question tag, each with an
// entry in docs/DESIGN_QUESTIONS.md:
//   ACCEPTED v0.1 (DQ-nn)  agreed for the prototype, not necessarily final
//                          physical-game rules
//   PLACEHOLDER DQ-nn      still open

export const CONFIG = {
  version: '0.1.0',

  // Phase 3A rule switches for NEW games (src/rules.js). A game keeps the
  // switches it was created with; saves from before Phase 3 play the 'phase2'
  // ruleset. Each 3A slice flips its switch here when its rule is in.
  // Phase 3A-1: per-Pokémon Growth and the quest rewards without ⭐.
  // Phase 3A-2: the unified battle loop — a wild Pokémon that stays after a
  // failed throw strikes back, Potion / Revive replace the attack in any
  // battle, trainer battles can be left for a small price.
  // Gameplay P1 (schema 15, DQ-89…95): Poké Stop Leczenie / Sklep, Rest +1,
  // Super Potion and free healing in battle, no Growth after fainting, selling,
  // Professor Oak's Box, warier Pokémon after catches (provisional).
  // Phase 3B Macro 01 (after the Build 3.0 family playtest, 10.10.2026): more
  // Poké Stops, Professor Oak's Research Jobs and emergency kit, the green
  // Catch Die, mixed exploration on routes (each behind its own switch).
  rules: {
    ruleset: 'b33',
    evolution: 'growth', // 3A-1 (Phase 2: 'stars')
    questRewards: 'v2', // 3A-1 (Phase 2: 'v1')
    counterattackOnStay: true, // 3A-2 (Phase 2: false) — DQ-80
    battleItems: true, // 3A-2 (Phase 2: false) — DQ-81
    trainerRetreat: true, // 3A-2 (Phase 2: false) — DQ-82
    gymRoster: 'v2', // 3A-3: 2 / 3 / 3 Pokémon (Build 2: 'v1' — 1 / 2 / 2)
    gymReward: 'v2', // 3A-3: badge + money + one thematic item (Build 2: 'v1')
    leagueRoster: 'v2', // 3A-3 League v2 (ChatGPT 09.10 23:46): Elite Four Dewgong / Haunter / Onix, Lance Gyarados (Build 2: 'v1')
    rocketMobility: 'v2', // 3A-4: plots escape after 3 full weeks / a landed balloon after one (Build 2: 'v1' — no timer)
    travelNetwork: 'v2', // 3A-5: + Underground Paths Route 5 ↔ 6 and Route 7 ↔ 8, 1 action, free (Build 2: 'v1' — the canonical graph)
    pokeStop: 'v2', // P1 (Build 2: 'v1') — DQ-89
    rest: 'v3', // Build 3.3 stage 4 (approved): +2 HP on one Pokémon, 1 action (Build 3.2: 'v2' = +1, DQ-90; Build 2: 'v1')
    healingItems: 'v2', // P1 (Build 2: 'v1') — DQ-91
    // Playtest 004 (Piotr, 11.10.2026) — DQ-105: a Pokémon that fainted in a
    // battle gets none of that battle's NEW Growth (Growth it had stays; a Revive
    // doesn't lift it). Build 3.1: false. `true` = the old DQ-92 SOFT experiment
    // (per opponent, rejected 09.10) — kept for tests only, never a family ruleset.
    growthFainted: 'battle',
    selling: true, // P1 — DQ-94
    oakBox: true, // P1 — DQ-95
    vigilance: false, // P1 DQ-93 (Build 3.0 … M02-1: true) — M02-2: fatigue takes its Catch Die step (§6.6)
    wildTemperament: true, // wild-encounter slice (09.10): aggressive / standard / skittish (Build 2: false)
    pokeStops: 'v2', // Macro 01: every gym city has a Poké Stop (+ Pewter, Saffron) (Build 3.0: 'v1')
    oakJobs: true, // Macro 01: Professor Oak's Research Jobs in Pallet Town (Build 3.0: false)
    oakKit: true, // Macro 01: Oak's emergency kit, once per game (Build 3.0: false)
    catchDice: 'v2', // Macro 01: + the green Catch Die 4/6 (Build 3.0: 'v1')
    explorePools: 'v2', // Macro 01: routes explore one mixed pool (Build 3.0: 'v1' — a biome every time)
    evolutionGrowth: 'T0', // Build 3.3 E1: EXP thresholds = (species data + 1) × 1.5 — PROVISIONAL (Playtest 004 — DQ-106: 'v2' every evolution +1; Build 3.1: 'v1' the species data)
    leadPick: true, // Playtest 004 — DQ-107: pick a healthy lead before a trainer / gym / Rocket / League battle, free (Build 3.1: false)
    localPools: 'v2', // Macro 02 M02-1: explicit per-place pools + the signature guarantee (older: 'v1', biome pools)
    fatigue: true, // Macro 02 M02-2: exploration fatigue per player × place (CONFIG.fatigue; older: false)
    battleTempo: 'v2', // Build 3.3 B33-1 (DEC-16 B): a healing item in battle costs the exchange, the opponent answers, no per-Pokémon cap (older: 'v1')
    rocketMeowth: 'always', // Build 3.3 B33-1 (DEC-15 M1): Jessie, James and Meowth fight together in every Rocket battle (older: 'cards')
    initiative: 'fsB', // Build 3.3 B33-1 (DEC-12 FS-B): First Strike ⚡ „Szybkie wejście” — species list PROVISIONAL (data/traits.js) (older: false)
    starts: 'character', // Build 3.3 A1 (approved 23:00): Ash / Gary Pallet, Brock Pewter, Misty Cerulean (older: 'pallet' = startLocation)
    hometownGym: true, // Build 3.3 A1 (approved 23:00): Brock's / Misty's first badge from another gym (older: false)
    travelGraph: 'v2', // Build 3.3 A1 (AUD-03): missions route through the one effective graph (older: 'v1')
    gymChallenge: 'v2', // Build 3.3 B33-3: a gym = gym trainer(s) → leader, one challenge (older: 'v1' = the leader alone)
    leagueChallenge: 'v2', // Build 3.3 B33-3: Lorelei → Bruno → Agatha → Lance, full reset, no ribbon skip (older: 'v1')
    exp: 'K5', // Build 3.3 E1 (B33-2): EXP by power class (data/powerClass.js) — PROVISIONAL DEV candidate after the A/B (K5 + T0 kept the evolution pace); K4 the alternative (older: false = 1 Growth)
    gymTrials: false, // Build 3.3 E5: the Gym Trial PILOT ('pilot': Pewter / Cerulean / Vermilion) is OPT-IN — „Pilotaże (DEV)” in the new-game dialog; not in every ordinary new game until Piotr's review (handoff §6); the mix is not approved
    hunts: false, // Build 3.3 E4: the rare-hunt PILOT ('pilot') is OPT-IN — „Pilotaże (DEV)” in the new-game dialog; the clock is DEC-30, never a family default without Piotr (handoff §5)
    stoneSources: false, // EREV: extra stone sources are an A/B only — 'explore' (B) / 'quests' (C) / 'mixed' (D); the regional shops alone stay the DEV economy (older: false)
    questAbandon: 'v2', // EREV-02: a „never” quest given up can be taken again (a new attempt from the start) until one is collected — never a second reward (older: 'v1')
    bookRewards: 'v2', // EREV-01: a reward line the game cannot use (a clue with hunts off or none to come) pays its stated alternative — PROVISIONAL value (older: 'v1')
    questBook: 'v2', // Build 3.3 E3: the quest book next to the two mission cards — PROVISIONAL content (older: false)
    shopStock: 'regional', // Build 3.3 E2 (B33-4): basics everywhere + city extras — PROVISIONAL (older: 'global')
    ultraBall: true, // Build 3.3 E2: the Ultra Ball exists — PROVISIONAL price / steps (older: false)
    loot: 'v1', // Build 3.3 E2: a loot d6 after a won random-trainer battle — PROVISIONAL (older: false)
    finalRarity: 'v1', // Build 3.3 E1: wild final forms — 'R1'…'R4' are MEASUREMENT variants only (spec §6, DEC-18)
    growthCredits: true, // Build 3.3 correction C1: each gym / League opponent pays its Growth once per player across attempts (older: false)
    // One Kanto (PT006-10, Piotr 13–14.10.2026): every new game is „Pokémon Kanto — Przygoda” — no Family /
    // Sandbox choice. A label (older saves: false); its rules are Build 3.3 „rodzinna” until a change graduates.
    gameMode: 'adventure',
    // PLAYTEST_006 C3 — MEASUREMENT variants only (tools/balance-pt006.js); today's values:
    gymTeams: 'v1', // PT006-07 gym teams 'B' | 'C' | 'D'
    greatBall: 'v1', // PT006-09 a sure Great Ball on trivial Pokémon 'G1' | 'G2'
    iconicWild: false, // PT006-02 wild Charizard / Blastoise / Venusaur 'w4' | 'd6'
    // PLAYTEST_006 DEV pilots (?dev=expedition,rumours) — off in every new game:
    expeditions: false, // PT006-04 the first Rare Expedition (C4)
    rumours: false, // PT006-11 Kanto Rumours (C5)
    // One Kanto day 14.10 — the evening DEV ruleset turns these on (ui/setup.js applyAdventure); off here:
    oakResearch: false,
    trading: false,
    achievements: false,
    pvp: false,
    questPack: false,
    fishing: false, // bonus 14.10: the Old Rod (M02-4) — the next DEV ruleset dev-1410b turns it on
    eventPack: false, // bonus 14.10: six more explore events — dev-1410b
    eeveeBranch: false, // bonus 2, 14.10: Eevee's three stone forms — dev-1410c
    characterTraits: false, // bonus 2, 14.10: character traits (CHAR-01) — dev-1410c
    signatureMoves: false, // bonus 2, 14.10: signature moves pilot (DQ-88) — dev-1410c
    koPick: false, // PLAYTEST_007: the player picks who comes in after a KO — dev-1510 (Build 3.5 DEV)
    combatMoves: false, // Combat MVP (15.10): named attacks, Special / Powerful moves, statuses — dev-1510-combat only
  },

  players: { min: 1, max: 4 },
  actionsPerTurn: 2,
  startingMoney: 6,
  startingPokeballs: 3,
  startLocation: 'pallet-town', // ACCEPTED v0.1 (DQ-02)
  maxTeamSize: 6,

  map: {
    // Bill's Cottage and Unknown Dungeon are optional endpoints in the spec.
    includeOptionalNodes: true,
    // The board's topology (data/locations.js): 'kanto45' = new games since
    // Build 3.1 (DQ-104: Route 10 North / Rock Tunnel / Route 10 South);
    // 'kanto43' = the Build 3.0 family board (DQ-96: Route 2 / Viridian Forest,
    // Route 10 / Rock Tunnel, Route 23 / Victory Road merged) — its games keep it;
    // 'kanto46' (the graph before the merge) only replays old histories.
    topology: 'kanto45',
  },

  travel: {
    // Capabilities every player starts with. Edges in data/travelConnections.js
    // list the capabilities they require; adjacency alone is not enough.
    // Water routes (southern sea loop) are closed at game start; how a player
    // gains water travel is PLACEHOLDER DQ-16.
    startingCapabilities: { canTravelWater: false },
  },

  // Base encounter roll: d6 face -> outcome.
  encounters: { nothing: [1], event: [2], trainer: [3], pokemon: [4, 5], pokemonBonus: [6] },
  // `pokemonBonus` adds this to the rarity roll (capped at 6).
  pokemonBonusRarity: 1,

  // Rarity roll: d6 face -> rarity.
  rarity: { common: [1, 2, 3], rare: [4, 5], superRare: [6] },
  // When a biome has no species of the rolled rarity, try these in order. PLACEHOLDER DQ-08
  rarityFallback: {
    superRare: ['superRare', 'rare', 'common'],
    rare: ['rare', 'common', 'superRare'],
    common: ['common', 'rare', 'superRare'],
  },

  combat: {
    naturalOneMisses: true,
    // A natural 6 always deals at least this much. Without it, weak attackers at a
    // type disadvantage (e.g. Magikarp vs Magikarp) can never hit and a trainer
    // battle — which cannot be fled — never ends. ACCEPTED v0.1 (DQ-12)
    naturalSixMinDamage: 1,
    // Attack total = d6 + attack modifier + type modifier. First matching row wins.
    damageThresholds: [
      { atLeast: 9, damage: 3 },
      { atLeast: 7, damage: 2 },
      { atLeast: 5, damage: 1 },
    ],
    typeAdvantage: 1,
    typeDisadvantage: -1,
    // Dual-type defenders: per-type modifiers are summed, then clamped. PLACEHOLDER DQ-05
    typeModifierClamp: [-1, 1],
    // The opposing Pokémon strikes back after each player attack. ACCEPTED v0.1 (DQ-04)
    opponentCounterattacks: true,
  },

  capture: {
    // How a throw is resolved (DQ-68): 'symbolic' (standard: a coloured Catch
    // Die, no arithmetic) or 'classic' (the old baseline: d6 + HP bonus + ball
    // bonus vs the rarity target), kept so the two can be simulated side by side.
    system: 'symbolic',
    // Catch Dice: 6 faces, this many show a Poké Ball (caught). The rarity
    // picks the base die; each HP-zone step and the Super Ball make it one step
    // easier along magenta → purple → blue; steps past blue become one reroll
    // of the blue die (never more than maxRerolls per throw).
    catchDice: { blue: { successFaces: 3 }, purple: { successFaces: 2 }, magenta: { successFaces: 1 }, green: { successFaces: 4 } },
    // rules.catchDice 'v2' (Macro 01): the ladder gets a fourth, easiest die —
    // green 4/6 — so exactly 1 HP is visibly better than a mid-HP blue; steps
    // past green become the reroll (never more than maxRerolls).
    catchLadderV2: ['magenta', 'purple', 'blue', 'green'],
    catchDieByRarity: { common: 'blue', rare: 'purple', superRare: 'magenta' },
    hpSteps: { red: 0, yellow: 1, green: 2 },
    maxRerolls: 1,
    // Classic system only.
    target: { common: 4, rare: 5, superRare: 6 },
    halfHpBonus: 1, // at or below 50% HP
    oneHpBonus: 2, // exactly 1 HP; replaces halfHpBonus rather than stacking. ACCEPTED v0.1 (DQ-06)
    // What a failed throw does (DQ-61, digital prototype): 'harsh' (A, flees
    // at once — the old rule), 'escapeDice' (B, standard: roll the Escape Die
    // of the Pokémon's current HP colour) or 'secondChance' (C, B plus one free
    // stay in the yellow / green zone). A and C are playtest / analysis variants.
    retry: 'escapeDice',
    // Escape Dice: 6 faces, this many show 🌬️ (flee). The colour comes from
    // the HP bar: 1st slot green, the rest split yellow (lower) / red (upper).
    escapeDice: { red: { fleeFaces: 3 }, yellow: { fleeFaces: 2 }, green: { fleeFaces: 1 } },
  },

  // Who rolls (DQ-62 / DQ-63): 'digital' (the app rolls everything — the
  // simulator and the developer harness), 'playerDice' (human players roll
  // their own attack and capture dice; the world is digital — the family
  // default of the digital board) or 'allPhysical' (every die is entered).
  dice: { mode: 'digital' },

  wild: {
    runAlwaysSucceeds: true, // ACCEPTED v0.1 (DQ-04)
  },

  // Build 3.3 E3 (rules.questBook 'v2'): how many quest-book quests a player may hold at once (PROVISIONAL).
  questBook: { maxActive: 2 },
  // Build 3.3 E4 (rules.hunts 'pilot'): PROVISIONAL — clock 'ownTurns' | 'worldWeeks' | 'tableTurns' (DEC-30
  // open: Piotr said „3 tury”), its length, the weeks a hunt starts, the exceptional Pokémon's extra HP, the
  // hunt die's face without a clue.
  // Build 3.3 E5 (rules.gymTrials 'pilot'): the draw's weights per mode — PROVISIONAL (no mix is approved).
  // EREV: the mix — 'oneShort' (B: one SHORT trial at a gym drawn once; Piotr's preference for the first
  // family pilot, a TEST variant, not approved) · 'perGym' (A: each pilot gym draws by `modes`, E5) · 'one'
  // (C: one trial, SHORT or SPECIAL) · 'fair' (D: A + every character keeps an OPEN non-hometown pilot gym)
  gymTrials: { mix: 'oneShort', modes: { open: 1, short: 1, special: 1 } },
  hunts: { clock: 'ownTurns', length: 3, startWeeks: [6, 14, 22], hpBonus: 2, noClueFace: 6 },

  // Correction C6 — First Strike list (data/traits.js): null = the game's own list (rules.initiative
  // 'fsB' = the provisional pilot WITH Pikachu); 'fsB-A' / 'fsB-A2' = without a starter line.
  // EREV: new DEV games play 'fsB-A2' — ChatGPT's preferred candidate, so Pikachu is no hidden edge for
  // Ash (pilot: 18.9 ⚡ first strikes per game for Ash, 1.3–2 for the others). PROVISIONAL — not
  // approved; Piotr chooses the species. Saves keep the list they were made with (null = the pilot).
  firstStrike: { list: 'fsB-A2' },

  rest: {
    heal: 2,
    healV2: 1, // rules.rest 'v2' (Gameplay P1, DQ-90)
    healV3: 2, // rules.rest 'v3' (Build 3.3 stage 4: Rest +2 for new games, approved before the overnight batch)
    // Rest heals the injured only. Fainted Pokémon need a Poké Stop or a
    // Revive; every location can reach a Poké Stop, so this cannot softlock.
    // ACCEPTED v0.1 (DQ-07, revised for Milestone B)
    canReviveFainted: false,
  },

  trainers: {
    // PLACEHOLDER DQ-09: difficulty is rolled, not tied to location/progression yet.
    difficultyRoll: { easy: [1, 2, 3], medium: [4, 5], hard: [6] },
    teamSize: { easy: 1, medium: 2, hard: 3 },
    allowedRarities: {
      easy: ['common'],
      medium: ['common', 'rare'],
      hard: ['common', 'rare'],
    },
    reward: { easy: 2, medium: 3, hard: 4 },
    lossMoneyPenalty: 0,
  },

  // Shop prices (spec §12).
  economy: { pokeball: 2, superball: 4, ultraball: 8, potion: 3, superpotion: 5, revive: 5, thunderstone: 5, waterstone: 5, firestone: 5, leafstone: 5, moonstone: 5 },
  // Selling in the shop (rules.selling, DQ-94): ⌊rate × buy price⌋, always below
  // the buy price, so buying and selling can never make money.
  selling: { rate: 0.5 },

  // Phase 2 / Build 2 games (rules.pokeStop 'v1'): visiting a Poké Stop costs 1
  // action, the whole active team is healed to full HP (fainted Pokémon
  // included), then the player shops for free until leaving. ACCEPTED v0.4
  // (DQ-33 hubs, DQ-34 full heal; supersedes DQ-17 / DQ-18 / DQ-20).
  // Gameplay P1 games ('v2', DQ-89): Leczenie and Sklep are separate actions,
  // 1 each, no heal on entering. Only 5 strategic hubs have one
  // (data/locations.js `features`).
  pokeStop: {
    stock: ['pokeball', 'superball', 'potion', 'revive'], // full, unlimited, same everywhere — ACCEPTED v0.2 (DQ-21)
    // Growth games only (rules.evolution 'growth'): Evolution Stones on sale in
    // every Poké Stop. PLACEHOLDER CONTENT SOURCE (DQ-78): the stone mechanic is
    // final, buying them here is temporary until 3B moves them to cities / quests.
    placeholderStones: ['thunderstone', 'waterstone', 'firestone', 'leafstone', 'moonstone'],
    // rules.healingItems 'v2' (DQ-91): the Super Potion is on sale from the start.
    stockV2: ['pokeball', 'superball', 'potion', 'superpotion', 'revive'],
  },

  // Item effects. Potion / Revive are free during your turn (DQ-19). In battle:
  // Phase 2 games — never; Build 2 games — instead of the attack (DQ-81,
  // rules.battleItems); Gameplay P1 games — free, once per Pokémon per battle
  // (DQ-91, rules.healingItems 'v2').
  items: {
    superball: { captureBonus: 1, catchSteps: 1 }, // classic: +1 to the roll; symbolic: one Catch Die step easier
    ultraball: { captureBonus: 2, catchSteps: 2 }, // Build 3.3 E2 (rules.ultraBall, U1): two steps easier — the die's cap still stands (PROVISIONAL)
    potion: { heal: 2 },
    superpotion: { heal: 4 }, // rules.healingItems 'v2' (DQ-91; 💰5 is a balance placeholder)
    revive: { hpFraction: 1 }, // fainted Pokémon comes back at full HP
  },

  // Professor Oak in Pallet Town (Macro 01). Research Jobs (rules.oakJobs):
  // Pokémon from the team or the Box work for Oak while the player travels on;
  // they come back by themselves after `turns` of the owner's own turns with the
  // reward. One job at a time per player; starting it costs 1 action; the team
  // always keeps a healthy Pokémon. Emergency kit (rules.oakKit): a player with
  // no ball and less money than a Poké Ball gets 1 Poké Ball, once per game —
  // at every Poké Stop and in Pallet Town (ChatGPT 11.10 16:08: in Pallet Town
  // only it did not reduce starvation; SIMULATION.md „Phase 3B Macro 01”).
  oak: {
    location: 'pallet-town',
    jobs: {
      A: { size: 1, turns: 2, reward: [{ type: 'money', amount: 1 }] },
      B: { size: 3, turns: 3, reward: [{ type: 'money', amount: 2 }, { type: 'potion', amount: 1 }] },
    },
    jobCost: 1, // actions to start a job
    maxActiveJobs: 1,
    kit: [{ type: 'pokeballs', amount: 1 }],
    // where the kit is given: 'stop' (every Poké Stop and Oak's lab — the Macro 01
    // rule, approved 11.10) or 'lab' (Pallet Town only — the first version)
    kitWhere: 'stop',
  },

  // Warier Pokémon after catches (rules.vigilance, DQ-93 — provisional): every
  // catch in a place makes the next Catch Die there one step harder, up to
  // maxSteps; only moving to another place resets it.
  vigilance: { maxSteps: 2 },

  // Exploration fatigue (rules.fatigue, Macro 02 M02-2 — PROVISIONAL numbers,
  // docs/PHASE_3B_MACRO_02.md §6, engine/fatigueEngine.js). A player's count per
  // place, read before each Explore and raised by 1 after it; every count falls
  // by `decay` at each week start. thresholds: the count at which a place is
  // tired (no Growth from its battles, the Catch Die `catchSteps` harder) and
  // exhausted (+ a random trainer pays no money, the encounter roll's
  // `quietFaces` are „Cisza”).
  fatigue: { thresholds: [3, 5], decay: 1, catchSteps: 1, quietFaces: [4] },

  // Evolution Stars: one shared pool per player, no XP on individual Pokémon.
  // +1 star per encounter that ends in one of starOutcomes (max 1 per encounter)
  // (DQ-22). Stars are spent during your own turn, outside encounters, at no
  // action cost, to evolve an active-team Pokémon by one stage; each Pokémon
  // evolves at most one stage per turn. ACCEPTED v0.4 (DQ-35, revises DQ-22's
  // "only at a Poké Stop").
  //
  // Growth (Phase 3A, rules.evolution 'growth'; DQ-74…79) replaces the pool:
  // every opposing Pokémon defeated in battle gives 1 Growth to one Pokémon
  // that fought it (a wild one caught after a fight: 1; a first-throw catch: 0).
  // Growth counts toward the Pokémon's own evolution edge (data/pokemon.js
  // `evolution.growth`; + 1 with rules.evolutionGrowth 'v2' — growthEngine
  // growthNeeded), never above it; evolving resets it. Evolution stays
  // free, outside battle, active team only, not when fainted, and at most
  // `maxPerTurn` evolutions per player turn (any Pokémon).
  evolution: {
    starsPerEncounter: 1,
    starOutcomes: ['wildFainted', 'caught', 'trainerWon'],
    starCost: { 1: 2, 2: 3 }, // stars to evolve FROM stage 1 / stage 2
    maxStagesPerTurn: 1,
    maxPerTurn: 1, // Growth games: evolutions per player turn
    // Growth games: results that count as a won battle (cocoons, DQ-77).
    victories: ['wildFainted', 'caught', 'trainerWon', 'rocketWon', 'gymWon', 'eliteFourWon', 'leagueWon'],
  },

  // Missions (DQ-29, DQ-30, DQ-31): every player holds up to 2 mission cards
  // from one shared deck; one free swap per Poké Stop visit; generated
  // destinations are reachable and at least `destinationMinDistance` steps away.
  // ACCEPTED v0.3. Rewards live on the cards in data/quests.js.
  quests: {
    enabled: true,
    maxActive: 2,
    swapsPerPokeStopVisit: 1,
    // Gameplay P1 (rules.pokeStop 'v2'): Sklep can be visited twice in a turn,
    // but a mission is swapped at most once per player turn (ChatGPT 08.10 23:58).
    swapsPerTurn: 1,
    destinationMinDistance: 3,
    // Money-equivalent of each reward (shop prices; a star counts as 3). Used to
    // keep global cards at ~2–3 and travel cards at ~3–4 (DQ-32, tested).
    rewardValue: { money: 1, pokeballs: 2, superball: 4, potion: 3, revive: 5, stars: 3 },
  },

  // Team Rocket plots (Step 4, V3 + Meowth balloon): plot cards in
  // data/rocketPlots.js. At the start of every week from `firstWeek`, if no plot
  // is active, roll d6: a face in `spawnRoll` reveals the next plot and the
  // balloon is placed on its location. A plot stays until someone beats Rocket
  // (no timer). Week-start rolls and deck shuffles use their own RNG stream, so
  // switching Rocket off/on doesn't move the dice of the rest of the game.
  // Beating Rocket gives the card reward and returns all loot; it gives no
  // Evolution Star (DQ-27) and doesn't count for missions. ACCEPTED v0.4 (Step 4)
  rocket: {
    enabled: true,
    firstWeek: 2,
    spawnRoll: [1, 2],
    team: ['ekans', 'koffing'], // Jessie, James
    evolvedTeam: ['arbok', 'weezing'],
    evolvedFromWeek: 10,
    meowth: 'meowth', // joins on cards with `meowth: true`
    // After losing a Rocket battle, d6: what Meowth grabs onto the plot card.
    // Never debt, never the last ball, no substitute if you don't have it.
    lootRoll: { money: [1, 2], pokeball: [3, 4], item: [5], nothing: [6] },
    lootMoney: 2, // up to this much
    // rocketMobility 'v2' (3A-4, DQ-84): a stationary plot is active for this
    // many full weeks (spawn week R → R, R+1, R+2); unresolved, it escapes at
    // the start of week R + plotWeeks and a new plot appears at once.
    plotWeeks: 3,
  },

  // Gyms and the League (Step 5, V1 "Open Gyms"). Gym data and League rosters
  // live in data/gyms.js. A Gym Challenge costs 1 action (max 1 per turn) and
  // starts one battle against the leader's row for the challenger's tier:
  // tierByBadges[min(badges, length - 1)] → 0 badges tier 1, 1 → 2, 2+ → 3.
  // Win: badge + reward + starsPerBadge (no mission progress). Losing costs
  // nothing. The League Challenge at Indigo Plateau needs `badgesForLeague`
  // badges (3 = family game, 4 = Long Game). ACCEPTED Step 5 (DQ-43…DQ-50)
  gyms: {
    enabled: true,
    badgesForLeague: 3,
    reward: { money: 3 },
    // +1 Evolution Star for winning a badge — once per gym (a badge is won
    // once), nothing for a lost attempt. Gyms took the actions that grow a
    // team; this gives that growth back. ACCEPTED (DQ-45, after the DQ-51 test)
    starsPerBadge: 1,
    maxChallengesPerTurn: 1,
    tierByBadges: [1, 2, 3],
    // Build 3.3 B33-3 (rules.gymChallenge 'v2'): gym trainers before the leader.
    // PROVISIONAL DEV / PLAYTEST DEFAULT — the count is not approved (data/gyms.js `chain`).
    chainTrainers: 1,
    // Correction C5 — a MEASUREMENT variant, not a decision: 1 = each gym trainer fields only the
    // first Pokémon of its row (variant B „lighter trainer”); null = the whole row (default).
    chainTrainerPokemon: null,
  },
  league: {
    keepEliteFourRibbon: true, // lost to Lance after beating the Elite Four → next try starts at Lance (DQ-50)
    itemsBetweenStages: true, // Potions / Revives and lead changes in the intermission
    eliteFourSize: 3, // the first N of the Elite Four roster (DQ-51 test lever: 2 = Seel + Gastly)
  },

  ai: {
    defaultArchetype: 'balanced',
    // How strongly missions steer the AI. Survival stays above this: a fully
    // fainted team pulls 8 per step toward a Poké Stop, a mission at most 5.
    // Tuned with `npm run simulate -- … --compare-quests` for DQ-32: a strong,
    // archetype-independent pull toward travel targets, and no extra reason to
    // explore locally just because a global catch target lives there.
    quest: {
      destinationPull: 5, // per step closer to a fixed / generated destination
      counterPull: 3, // per step closer to a place that advances a travel counter
      finishHere: 6, // explore mission completable right here
      newPlace: 4, // "3 different places" advanced by exploring here
      catchHereGlobal: 0, // a global catch target lives in this biome (0: don't farm locally)
      catchHereDestination: 4, // at the destination of a catch mission
      catchTarget: 2, // throwing at a mission target
    },
    // Team Rocket plots. The AI goes for a plot when its healthy team is at
    // least `readyRatio` as strong as Rocket's (HP + 2 × attack); the pull per
    // step grows with what clearing pays (reward + loot, money-equivalents) and
    // stays below survival needs.
    rocket: {
      readyRatio: 0.8, // own team power / Rocket team power needed to go for it
      pullPerValue: 0.5, // per step closer, per money-equivalent at stake
      maxPull: 4,
      ownLoot: 1, // weight of my own loot on the card
      othersLoot: 0.3, // weight of other players' loot on the card
      challenge: 3, // base score of a ready Challenge Rocket
    },
    // Gyms / League. Readiness = own healthy power (HP + 2 × (attack + type
    // modifier vs the gym's Pokémon)) / the leader row's power (HP + 2 ×
    // attack). The AI heads for the nearest gym it is ready for (pull per
    // step) and, with enough badges, for the League. Pulls: survival 8 >
    // League 6 > gym 5 = missions 5 > Rocket ≤ 4.
    gym: { readyRatio: 0.8, pull: 5, challenge: 10 },
    // League readiness 0.6 (was 0.7): the AI waited too long (DQ-51 test C).
    league: { readyRatio: 0.6, pull: 6, challenge: 12 }, // vs the remaining stages' total power
    // Judge readiness for the TRIP at full HP when the destination has a Poké
    // Stop (Indigo, the 4 hub gyms): the team heals there before challenging.
    // The challenge itself still uses current HP. Fixes the post-badge stall
    // (DQ-51, E3). ACCEPTED
    pullReadinessAtFullHp: true,
    // Multipliers applied to the heuristic score components in aiEngine.js.
    // exploreNewPlace: a flat bonus for exploring a place this player has
    // never explored. The explorer walked on instead of exploring (DQ-51
    // diagnosis); with it, it goes "new place → explore it → move on". AI only.
    archetypes: {
      balanced: { explore: 1, move: 1, novelty: 1, catch: 1, fight: 1, caution: 1, rest: 1, exploreNewPlace: 0 },
      collector: { explore: 1.3, move: 0.8, novelty: 1, catch: 1.6, fight: 0.8, caution: 1, rest: 1, exploreNewPlace: 0 },
      aggressive: { explore: 1.2, move: 0.8, novelty: 0.8, catch: 0.7, fight: 1.6, caution: 0.6, rest: 0.8, exploreNewPlace: 0 },
      explorer: { explore: 0.8, move: 1.5, novelty: 1.6, catch: 1, fight: 0.9, caution: 1.1, rest: 1, exploreNewPlace: 5 },
    },
  },

  simulation: {
    maxRounds: 30, // one round = one in-world week
    maxStepsPerGame: 20000, // guard against infinite loops inside a game
  },

  // Win condition (Step 6, V1 "Simple Champion Win", DQ-53…57): the first
  // player to beat Lance is Champion; the week is finished (equal turns) and
  // anyone else who beats Lance that week shares the victory; then the game
  // is over. maxRounds above is only the simulator's horizon, not a game end.
  winCondition: {
    endsGame: true, // false only for analysis runs that follow every game to the horizon
    // Optional Time Limit (setup: off / 25 / 30). With no Champion after this
    // week: most badges → Elite Four Ribbon → most unique caught → shared.
    timeLimitWeeks: null,
  },
};
