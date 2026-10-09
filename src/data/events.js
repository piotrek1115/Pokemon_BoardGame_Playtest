// Event content: { id, title, text, category, conditions, choices, effects, weight }.
// An event either resolves immediately (`effects`) or asks for a choice
// (`choices`, each with its own `effects` and optional `requires`).
//
// Conditions / requires (all optional, all must hold):
//   biomes: [..]          explored biome is one of these
//   locationTypes: [..]   current location type is one of these
//   minMoney, minPokeballs
//   teamInjured: true     at least one team Pokémon below max HP
//   leadInjured: true     lead Pokémon below max HP
//   hasHealthyPokemon: true
//
// Effects (applied in order, see engine/eventEngine.js):
//   money, pokeballs, healLead, healTeam, damageLead, actions  { amount }
//   wildEncounter { rarityBonus }   trainerBattle {}
//
// Milestone A ships ~10 test events; target is ~30 (Rocket events arrive in B).
export const EVENTS = [
  {
    id: 'found-pokeball',
    title: 'Shiny find!',
    text: 'Something red and white glints in the grass. A Poké Ball!',
    category: ['positive', 'resource'],
    effects: [{ type: 'pokeballs', amount: 1 }],
    weight: 3,
  },
  {
    id: 'dropped-coins',
    title: 'Hole in your pocket',
    text: 'Oops! A coin rolls away into a ditch.',
    category: ['negative', 'resource'],
    conditions: { minMoney: 1 },
    effects: [{ type: 'money', amount: -1 }],
    weight: 2,
  },
  {
    id: 'berry-bush',
    title: 'Berry bush',
    text: 'You find a bush full of ripe Oran Berries.',
    category: ['choice', 'positive', 'resource'],
    choices: [
      { label: 'Feed your lead Pokémon (+2 HP)', requires: { leadInjured: true }, effects: [{ type: 'healLead', amount: 2 }] },
      { label: 'Sell the berries (+1 money)', effects: [{ type: 'money', amount: 1 }] },
    ],
    weight: 3,
  },
  {
    id: 'rustling-grass',
    title: 'Rustling grass',
    text: 'Something big is moving in the tall grass…',
    category: ['pokemon'],
    conditions: { biomes: ['grass', 'forest'], hasHealthyPokemon: true },
    effects: [{ type: 'wildEncounter', rarityBonus: 1 }],
    weight: 3,
  },
  {
    id: 'friendly-hiker',
    title: 'Tired hiker',
    text: 'A hiker asks for help carrying his heavy backpack.',
    category: ['choice', 'trainer'],
    choices: [
      { label: 'Help him (+2 money, lead Pokémon −1 HP)', requires: { hasHealthyPokemon: true }, effects: [{ type: 'money', amount: 2 }, { type: 'damageLead', amount: 1 }] },
      { label: 'Wave and walk on', effects: [] },
    ],
    weight: 2,
  },
  {
    id: 'sudden-rain',
    title: 'Sudden rain',
    text: 'Pouring rain! You wait under a tree and lose time.',
    category: ['negative', 'environment'],
    effects: [{ type: 'actions', amount: -1 }],
    weight: 2,
  },
  {
    id: 'shortcut',
    title: 'Secret shortcut',
    text: 'A local kid shows you a hidden path.',
    category: ['positive', 'travel'],
    effects: [{ type: 'actions', amount: 1 }],
    weight: 2,
  },
  {
    id: 'nurse-joy',
    title: 'Nurse Joy on her rounds',
    text: 'Nurse Joy checks on your Pokémon.',
    category: ['positive', 'resource'],
    conditions: { locationTypes: ['city', 'town'], teamInjured: true },
    effects: [{ type: 'healTeam', amount: 2 }],
    weight: 2,
  },
  {
    id: 'lost-pokemon',
    title: 'Lost Pokémon',
    text: 'A small Pokémon looks lost and a little scared.',
    category: ['choice', 'pokemon'],
    choices: [
      { label: 'Help it find its family (+1 money)', effects: [{ type: 'money', amount: 1 }] },
      { label: 'Try to befriend it (wild encounter)', requires: { hasHealthyPokemon: true }, effects: [{ type: 'wildEncounter', rarityBonus: 0 }] },
    ],
    weight: 2,
  },
  {
    id: 'old-man-deal',
    title: 'Old man with a sack',
    text: '"Spare Poké Ball, young trainer? Just 1 coin!"',
    category: ['choice', 'resource'],
    choices: [
      { label: 'Buy a Poké Ball (−1 money)', requires: { minMoney: 1 }, effects: [{ type: 'money', amount: -1 }, { type: 'pokeballs', amount: 1 }] },
      { label: 'No, thanks', effects: [] },
    ],
    weight: 2,
  },
];

export const EVENTS_BY_ID = Object.fromEntries(EVENTS.map((e) => [e.id, e]));
