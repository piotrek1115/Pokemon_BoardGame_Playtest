// Build 3.3 E3 — Questbook 2.0 (B33-5 + M02-3; docs/BUILD_3_3_SPEC.md §11.1, Macro 02
// §3). ONE quest engine (engine/questBookEngine.js) for Oak contracts, people's
// quests and — later — Gym Trials (E5). Played only with rules.questBook 'v2'; the
// old two mission cards (rules.quests) stay as they are, next to it.
//
// A definition never changes; a player's attempt at it is an OCCURRENCE
// ('<id>#<n>', engine) with its own progress, credits and payouts.
//   giver    'oak' | 'npc'           — who gives it (the table's token / text)
//   takeAt   'pokeStop' | <place>    — where it can be taken (free)
//   claimAt  'pokeStop' | <place>    — where its reward is collected (free)
//   unlock   { badges }              — from how many badges it is offered
//   repeat   'never' | { cooldownWeeks, maxPerGame }
//   stages   [{ objectives: [...], gives?: { keyItem } }] — in order; the objectives
//            of one stage in any order
//   reward   [{ type: money | pokeballs | <item id> | pokemon (species) | clue, otherwise? }]
//            `otherwise` (rules.bookRewards 'v2'): what the line pays when the game cannot
//            use it — a clue with no hunt to come (EREV-01)
// Objective kinds: visit {place} · explore {place, times} · catch {types?, count} ·
// seeSignature {places} · defeatTrainer {count} · defeatRocket {count} ·
// challenge {place, name, archetype, teams: [tier1, tier2, tier3]} — a guaranteed
// battle at the place („Wyzwanie z misji”), never a random roll · bring {keyItem,
// place} · wait {ownTurns}.
//
// CONTENT IS A PROVISIONAL DEV SAMPLE (7 quests; Macro 02's 12-quest library stays
// in the backlog). The fossil pilot revives the Old Amber at the PEWTER museum —
// the place is open (DEC-09); Cinnabar's lab is not built.
export const QUEST_BOOK = {
  v1: [
    {
      id: 'oak-water', giver: 'oak', takeAt: 'pokeStop', claimAt: 'pokeStop', repeat: { cooldownWeeks: 6, maxPerGame: 2 },
      stages: [{ objectives: [{ kind: 'catch', types: ['water'], count: 2 }, { kind: 'defeatTrainer', count: 2 }] }],
      reward: [{ type: 'ultraball', amount: 1 }, { type: 'money', amount: 3 }],
    },
    {
      id: 'oak-rocket', giver: 'oak', takeAt: 'pokeStop', claimAt: 'pokeStop', repeat: 'never',
      stages: [{ objectives: [{ kind: 'defeatRocket', count: 1 }] }],
      // EREV-01: with no hunt to come (hunts off, or all done / clued) the clue line pays 3 money — PROVISIONAL
      reward: [{ type: 'ultraball', amount: 1 }, { type: 'clue', amount: 1, otherwise: { type: 'money', amount: 3 } }],
    },
    {
      id: 'oak-habitats', giver: 'oak', takeAt: 'pokeStop', claimAt: 'pokeStop', repeat: 'never',
      stages: [{ objectives: [{ kind: 'seeSignature', places: 3 }] }],
      reward: [{ type: 'potion', amount: 1 }, { type: 'superpotion', amount: 1 }],
    },
    {
      id: 'oak-parcel', giver: 'oak', takeAt: 'viridian-city', claimAt: 'pallet-town', repeat: 'never',
      stages: [{ objectives: [{ kind: 'visit', place: 'pallet-town' }] }],
      reward: [{ type: 'pokeballs', amount: 2 }],
    },
    {
      id: 'mt-moon-fossil', giver: 'npc', takeAt: 'pewter-city', claimAt: 'pewter-city', repeat: 'never',
      stages: [
        { objectives: [{ kind: 'explore', place: 'mt-moon', times: 2 }], gives: { keyItem: 'oldAmber' } },
        { objectives: [{ kind: 'bring', keyItem: 'oldAmber', place: 'pewter-city' }] },
        { objectives: [{ kind: 'wait', ownTurns: 2 }] },
      ],
      reward: [{ type: 'pokemon', species: 'aerodactyl' }],
    },
    {
      id: 'nugget-bridge', giver: 'npc', takeAt: 'cerulean-city', claimAt: 'cerulean-city', repeat: 'never', unlock: { badges: 1 },
      stages: [{
        objectives: [{
          kind: 'challenge', place: 'route-24', name: 'Bridge Captain', archetype: 'camper',
          teams: [['rattata', 'pidgey'], ['raticate', 'pidgeotto'], ['raticate', 'pidgeotto', 'primeape']],
        }],
      }],
      reward: [{ type: 'money', amount: 3 }, { type: 'superball', amount: 1 }],
    },
    {
      id: 'vermilion-spark', giver: 'npc', takeAt: 'vermilion-city', claimAt: 'vermilion-city', repeat: 'never',
      stages: [{ objectives: [{ kind: 'catch', types: ['electric'], count: 1 }] }],
      reward: [{ type: 'superpotion', amount: 1 }, { type: 'money', amount: 2 }],
    },
  ],
};

// `lasting` (bonus 14.10): a key item that stays — never handed in by a step, never taken back when a quest is given up.
export const QUEST_BOOK_KEY_ITEMS = { oldAmber: { name: 'Old Amber' }, lostParcel: { name: 'Lost Parcel' }, portLetter: { name: 'Port Letter' }, oldRod: { name: 'Old Rod', lasting: true } };

// PLAYTEST_006 C4 — Rare Expeditions (PT006-04), DEV pilot (rules.expeditions 'pilot'; One Kanto: a
// developer URL). The first MEDIUM expedition: a guaranteed ENCOUNTER, the catch is not guaranteed.
//   encounter {place, species}   at the place, while this step is open: „Spotkanie z wyprawy” (1 action, at
//                                most once per own turn per quest) — a wild battle with that species, normal
//                                stats. Done = caught (the Pokémon is the reward: nothing to collect).
//   R2 „Nowy trop”: an encounter that ends any other way (knocked out, fled, run, your team down) sends the
//   step back to ONE Explore at that place; then the encounter is there again — no limit, each retry
//   costs 2 actions. Anti-farm: the opponent's Growth / EXP once per occurrence (growthEngine.creditKey);
//   a wild battle pays no money and no loot; `repeat: 'never'`.
// Scyther, not Aerodactyl: the fossil quest already gives an Aerodactyl (no second Aerodactyl source).
// PROVISIONAL content — the steps, the challenge team and the place are for the family test.
export const EXPEDITIONS = {
  v1: [
    {
      id: 'safari-scyther', giver: 'npc', tier: 'medium', takeAt: 'fuchsia-city', claimAt: 'fuchsia-city', repeat: 'never', rumour: 'opp-scyther', // with rumours on: found as a rumour
      stages: [
        { objectives: [{ kind: 'challenge', place: 'fuchsia-city', name: 'Safari Warden', archetype: 'camper', teams: [['venonat'], ['venonat', 'paras'], ['venomoth', 'parasect']] }] },
        { objectives: [{ kind: 'explore', place: 'safari-zone', times: 2 }, { kind: 'explore', place: 'route-12', times: 1 }] },
        { objectives: [{ kind: 'encounter', place: 'safari-zone', species: 'scyther' }] },
      ],
      reward: [],
    },
  ],
};

// One Kanto day 14.10 (rules.questPack 'day14'; ChatGPT canonical full-day handoff G2) — four quests, each with
// a NEW small step, none a copy of the 7 book quests or the 6 rumour quests:
//   observe {count}                 see `count` species new to the player's Pokédex (wild or a trainer's) since
//                                   taking it — research by looking, not catching (oak-water / vermilion-spark catch)
//   show {types, count, place}      stand at `place` with `count` DIFFERENT species of those types in the team —
//                                   a team to build, not a catch during the quest
//   give {item, count, place}       arrive at `place` holding `count` of an ordinary item: they are handed over —
//                                   spending, not a key item (bring)
//   evolve {count}                  `count` evolutions of the player's Pokémon after taking it — training
// Anti-farm: 'never' or a cooldown + maxPerGame; observe counts only species NEW to the Pokédex (finite), give
// costs more than its reward's shop value minus the Poké Ball / money on top. No RNG softlock: every step is
// reachable by moving, exploring, the shop or training, and a quest can be given up at a Poké Stop. The AI never
// takes them (aiEngine: it does not plan these steps). PROVISIONAL content and rewards.
export const QUEST_PACK = {
  day14: [
    {
      id: 'oak-field-research', pack: 'day14', giver: 'oak', takeAt: 'pokeStop', claimAt: 'pokeStop', repeat: { cooldownWeeks: 4, maxPerGame: 2 },
      stages: [{ objectives: [{ kind: 'observe', count: 3 }] }],
      reward: [{ type: 'money', amount: 3 }, { type: 'pokeballs', amount: 1 }],
    },
    {
      id: 'sailor-water-show', pack: 'day14', giver: 'npc', takeAt: 'cerulean-city', claimAt: 'vermilion-city', repeat: 'never',
      stages: [{ objectives: [{ kind: 'show', types: ['water'], count: 2, place: 'vermilion-city' }] }],
      reward: [{ type: 'superball', amount: 1 }, { type: 'money', amount: 2 }],
    },
    {
      id: 'tower-potions', pack: 'day14', giver: 'npc', takeAt: 'saffron-city', claimAt: 'lavender-town', repeat: 'never',
      stages: [{ objectives: [{ kind: 'give', item: 'potion', count: 2, place: 'lavender-town' }] }],
      reward: [{ type: 'revive', amount: 1 }, { type: 'money', amount: 2 }],
    },
    {
      id: 'celadon-evolution', pack: 'day14', giver: 'npc', takeAt: 'celadon-city', claimAt: 'celadon-city', repeat: 'never',
      stages: [{ objectives: [{ kind: 'evolve', count: 1 }] }],
      reward: [{ type: 'leafstone', amount: 1 }, { type: 'money', amount: 2 }],
    },
  ],
};

// PLAYTEST_006 C5 — the quests of the Rumours pilot (data/rumours.js OPPORTUNITIES): taken only by a player
// for whom its opportunity is open (rumourEngine.rumourOpenFor) — heard at a Poké Stop, or found at the start
// place. Existing steps only (visit / explore / challenge / bring / wait). PROVISIONAL content and rewards.
export const RUMOUR_QUESTS = {
  v1: [
    {
      id: 'viridian-parcel', rumour: 'opp-parcel', giver: 'npc', takeAt: 'viridian-city', claimAt: 'pewter-city', repeat: 'never',
      stages: [
        { objectives: [{ kind: 'explore', place: 'viridian-city', times: 1 }], gives: { keyItem: 'lostParcel' } }, // find it
        { objectives: [{ kind: 'bring', keyItem: 'lostParcel', place: 'pewter-city' }] },
      ],
      reward: [{ type: 'money', amount: 2 }, { type: 'potion', amount: 1 }],
    },
    {
      id: 'vermilion-courier', rumour: 'opp-courier', giver: 'npc', takeAt: 'vermilion-city', claimAt: 'saffron-city', repeat: 'never',
      stages: [
        { objectives: [{ kind: 'explore', place: 'vermilion-city', times: 1 }], gives: { keyItem: 'portLetter' } }, // find the sailor
        { objectives: [{ kind: 'bring', keyItem: 'portLetter', place: 'saffron-city' }] },
      ],
      reward: [{ type: 'superball', amount: 1 }],
    },
    {
      id: 'bill-teleporter', rumour: 'opp-bill', giver: 'npc', takeAt: 'bills-cottage', claimAt: 'bills-cottage', repeat: 'never',
      stages: [
        { objectives: [{ kind: 'explore', place: 'route-25', times: 1 }] },
        { objectives: [{ kind: 'visit', place: 'bills-cottage' }] },
        { objectives: [{ kind: 'wait', ownTurns: 1 }] },
      ],
      reward: [{ type: 'money', amount: 2 }, { type: 'superpotion', amount: 1 }],
    },
    {
      id: 'power-plant-fault', rumour: 'opp-power-plant', giver: 'npc', takeAt: 'power-plant', claimAt: 'power-plant', repeat: 'never',
      stages: [{
        objectives: [
          { kind: 'explore', place: 'power-plant', times: 1 },
          { kind: 'challenge', place: 'power-plant', name: 'Engineer', archetype: 'scientist', teams: [['voltorb'], ['voltorb', 'magnemite'], ['electrode', 'magneton']] },
        ],
      }],
      reward: [{ type: 'thunderstone', amount: 1 }, { type: 'money', amount: 2 }],
    },
    {
      id: 'lavender-fog', rumour: 'opp-lavender', giver: 'npc', takeAt: 'lavender-town', claimAt: 'lavender-town', repeat: 'never',
      stages: [{
        objectives: [
          { kind: 'explore', place: 'lavender-town', times: 2 },
          { kind: 'challenge', place: 'lavender-town', name: 'Channeler', archetype: 'channeler', teams: [['gastly'], ['gastly', 'gastly'], ['haunter', 'gastly']] },
        ],
      }],
      reward: [{ type: 'revive', amount: 1 }, { type: 'money', amount: 2 }],
    },
    {
      id: 'celadon-rocket', rumour: 'opp-celadon-rocket', giver: 'npc', takeAt: 'celadon-city', claimAt: 'celadon-city', repeat: 'never',
      stages: [{
        objectives: [{ kind: 'challenge', place: 'celadon-city', name: 'Game Corner Rocket', archetype: 'jessie', teams: [['ekans', 'koffing'], ['arbok', 'koffing'], ['arbok', 'weezing']] }],
      }],
      reward: [{ type: 'ultraball', amount: 1 }, { type: 'money', amount: 3 }],
    },
  ],
};
