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
  rules: {
    ruleset: 'phase3a',
    evolution: 'growth', // 3A-1 (Phase 2: 'stars')
    questRewards: 'v2', // 3A-1 (Phase 2: 'v1')
    counterattackOnStay: true, // 3A-2 (Phase 2: false) — DQ-80
    battleItems: true, // 3A-2 (Phase 2: false) — DQ-81
    trainerRetreat: true, // 3A-2 (Phase 2: false) — DQ-82
    gymRoster: 'v1', // 3A-3 → 'v2'
    gymReward: 'v1', // 3A-3 → 'v2'
    leagueRoster: 'v1', // 3A-3 (after the balance review)
    rocketMobility: 'v1', // 3A-4 → 'v2'
    travelNetwork: 'v1', // 3A-5 → 'v2'
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
    catchDice: { blue: { successFaces: 3 }, purple: { successFaces: 2 }, magenta: { successFaces: 1 } },
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

  rest: {
    heal: 2,
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
  economy: { pokeball: 2, superball: 4, potion: 3, revive: 5, thunderstone: 5, waterstone: 5, firestone: 5, leafstone: 5, moonstone: 5 },

  // Visiting a Poké Stop costs 1 action: the whole active team is healed to full
  // HP (fainted Pokémon included), then the player shops for free until leaving.
  // Only 5 strategic hubs have one (data/locations.js `features`). ACCEPTED v0.4
  // (DQ-33 hubs, DQ-34 full heal; supersedes DQ-17 / DQ-18 / DQ-20).
  pokeStop: {
    stock: ['pokeball', 'superball', 'potion', 'revive'], // full, unlimited, same everywhere — ACCEPTED v0.2 (DQ-21)
    // Growth games only (rules.evolution 'growth'): Evolution Stones on sale in
    // every Poké Stop. PLACEHOLDER CONTENT SOURCE (DQ-78): the stone mechanic is
    // final, buying them here is temporary until 3B moves them to cities / quests.
    placeholderStones: ['thunderstone', 'waterstone', 'firestone', 'leafstone', 'moonstone'],
  },

  // Item effects. Potion / Revive are used for free during your turn, never
  // inside an encounter. ACCEPTED v0.1 (DQ-19)
  items: {
    superball: { captureBonus: 1, catchSteps: 1 }, // classic: +1 to the roll; symbolic: one Catch Die step easier
    potion: { heal: 2 },
    revive: { hpFraction: 1 }, // fainted Pokémon comes back at full HP
  },

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
  // `evolution.growth`), never above it; evolving resets it. Evolution stays
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
