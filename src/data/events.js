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

// Bonus 14.10 (rules.eventPack 'b4h', the DEV ruleset dev-1410b): six more explore events, each a different idea
// from the ten above (audit: a found Poké Ball, a hiker's backpack to carry, rustling grass, a lost Pokémon …):
// a backpack to give back, a lost trainer, strange tracks, a bully on the road, a hidden stash, a resident's
// rumour (the Rumours layer). Two small new effects: item {item, amount} and rumour (hear one open opportunity).
// Not every one ends in a battle; every reward is small and comes from an Explore (fatigue-limited) — no farm,
// no softlock (each has a „walk on” choice or no cost). Without the switch the draw is exactly as before.
export const EVENT_PACK = {
  b4h: [
    {
      id: 'lost-backpack', title: 'Lost backpack', text: 'A backpack lies by the path — the tag says it belongs to a hiker just ahead.',
      category: ['choice', 'resource'],
      choices: [
        { label: 'Bring it back (a Potion as thanks)', effects: [{ type: 'item', item: 'potion', amount: 1 }] },
        { label: 'Leave it where it is', effects: [] },
      ],
      weight: 2,
    },
    {
      id: 'lost-trainer', title: 'Lost trainer', text: 'A young trainer has lost the way. "Thanks! Want a practice battle?"',
      category: ['choice', 'trainer'],
      choices: [
        { label: 'Show the way and battle (a trainer battle)', requires: { hasHealthyPokemon: true }, effects: [{ type: 'trainerBattle' }] },
        { label: 'Show the way and walk on', effects: [] },
      ],
      weight: 2,
    },
    {
      id: 'strange-tracks', title: 'Strange tracks', text: 'Huge footprints lead away from the path…',
      category: ['choice', 'pokemon'],
      conditions: { hasHealthyPokemon: true },
      choices: [
        { label: 'Follow the tracks (a wild Pokémon, rarity +2)', requires: { hasHealthyPokemon: true }, effects: [{ type: 'wildEncounter', rarityBonus: 2 }] },
        { label: 'Better not', effects: [] },
      ],
      weight: 1,
    },
    {
      id: 'road-bully', title: 'Bully on the road', text: 'A rude trainer is bothering a traveller!',
      category: ['choice', 'trainer'],
      choices: [
        { label: 'Stand up to them (a trainer battle)', requires: { hasHealthyPokemon: true }, effects: [{ type: 'trainerBattle' }] },
        { label: 'Fetch Officer Jenny (+1 money from the traveller)', effects: [{ type: 'money', amount: 1 }] },
      ],
      weight: 2,
    },
    {
      id: 'hidden-stash', title: 'Hidden stash', text: "Under a flat stone: a trainer's forgotten stash!",
      category: ['positive', 'resource'],
      effects: [{ type: 'item', item: 'superball', amount: 1 }],
      weight: 1,
    },
    {
      id: 'local-rumour', title: "A local's tale", text: 'A local tells you what people are talking about in Kanto…',
      category: ['positive', 'rumour'],
      conditions: { locationTypes: ['city', 'town'] },
      effects: [{ type: 'rumour' }],
      weight: 2,
    },
  ],
};
export const EVENTS_BY_ID = Object.fromEntries([...EVENTS, ...EVENT_PACK.b4h].map((e) => [e.id, e]));
