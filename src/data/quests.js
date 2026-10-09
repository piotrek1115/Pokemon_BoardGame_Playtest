// Mission cards (Step 3, DQ-29: "Two Mission Cards" + travel cards).
// One shared deck (DQ-30); each player holds up to CONFIG.quests.maxActive missions.
//
//   kind     what completes it (see engine/questEngine.js; counting rules DQ-31):
//            catch          catch a wild Pokémon matching `target`
//            defeatTrainer  win a trainer battle (optionally in certain places)
//            winFlawless    win a trainer battle with none of your Pokémon fainting
//            explore        spend an Explore action matching `target` (any dice outcome)
//            visit          arrive at the destination by moving there
//            evolve         evolve any Pokémon
//            visitPokeStops visit `count` different Poké Stops
//            exploreLocations  explore in `count` different locations
//            ('deliver' is reserved for later — no parcel content in v0.3)
//   target   { types, rarities, biomes, locations, locationTypes } — all optional, all must match
//            `generate` picks a reachable town/city at least
//            CONFIG.quests.destinationMinDistance steps away when the card is drawn.
//   scope    global | travel. Travel cards need movement across Kanto (a
//            destination, or different stops / biomes); only they may award ⭐,
//            and they pay a small travel premium (DQ-32): global ≈ 2–3,
//            travel ≈ 3–4 in CONFIG.quests.rewardValue money-equivalents (tested).
//   count    how many times (default 1)
//   reward   [{ type: money | pokeballs | superball | potion | revive | stars, amount }]
//   rewardByVersion  { v2: reward } — the reward under CONFIG.rules.questRewards
//            'v2' (Phase 3A Growth games: missions never give ⭐ or Growth,
//            DQ-87; same money-equivalent). Read rewards through
//            questEngine.questReward(quest, config).
//
// Givers are canonical NPCs; Brock and Misty are never givers (DQ-11).

export const QUESTS = [
  // ---- global (10): ~2–3 money-equivalent -------------------------------------
  { id: 'oak-water', giver: 'Prof. Oak', icon: '💧', title: 'Water survey', text: 'Catch any Water Pokémon.', kind: 'catch', target: { types: ['water'] }, scope: 'global', reward: [{ type: 'pokeballs', amount: 1 }, { type: 'money', amount: 1 }] },
  { id: 'oak-flying', giver: 'Prof. Oak', icon: '🪶', title: 'Bird watching', text: 'Catch any Flying Pokémon.', kind: 'catch', target: { types: ['flying'] }, scope: 'global', reward: [{ type: 'pokeballs', amount: 1 }] },
  { id: 'bug-catcher', giver: 'Bug Catcher Rick', icon: '🐛', title: 'Bug collection', text: 'Catch a Bug Pokémon.', kind: 'catch', target: { types: ['bug'] }, scope: 'global', reward: [{ type: 'potion', amount: 1 }] },
  { id: 'oak-two', giver: 'Prof. Oak', icon: '📕', title: 'Two new friends', text: 'Catch 2 Pokémon.', kind: 'catch', target: {}, count: 2, scope: 'global', reward: [{ type: 'pokeballs', amount: 1 }, { type: 'money', amount: 1 }] },
  { id: 'oak-rare', giver: 'Prof. Oak', icon: '💎', title: 'Rare sighting', text: 'Catch a Rare or Super Rare Pokémon.', kind: 'catch', target: { rarities: ['rare', 'superRare'] }, scope: 'global', reward: [{ type: 'money', amount: 3 }] },
  { id: 'jenny-trainer', giver: 'Officer Jenny', icon: '⚔️', title: 'Training day', text: 'Win a trainer battle.', kind: 'defeatTrainer', target: {}, scope: 'global', reward: [{ type: 'money', amount: 2 }] },
  { id: 'joy-flawless', giver: 'Nurse Joy', icon: '💗', title: 'Nobody gets hurt', text: 'Win a trainer battle without any of your Pokémon fainting.', kind: 'winFlawless', target: {}, scope: 'global', reward: [{ type: 'potion', amount: 1 }] },
  { id: 'joy-evolve', giver: 'Nurse Joy', icon: '✨', title: 'Growing up', text: 'Evolve any Pokémon.', kind: 'evolve', target: {}, scope: 'global', reward: [{ type: 'money', amount: 2 }] },
  { id: 'hiker-cave', giver: 'Hiker Marcos', icon: '🪨', title: 'Into the dark', text: 'Explore a cave.', kind: 'explore', target: { biomes: ['cave'] }, scope: 'global', reward: [{ type: 'pokeballs', amount: 1 }] },
  { id: 'swimmer-sea', giver: 'Swimmer Luis', icon: '🌊', title: 'Sea breeze', text: 'Explore the sea or a beach.', kind: 'explore', target: { biomes: ['sea', 'beach'] }, scope: 'global', reward: [{ type: 'pokeballs', amount: 1 }, { type: 'money', amount: 1 }] },

  // ---- travel (8): ~3–4 money-equivalent; 3 of them award ⭐ -------------------
  // Fixed destinations are spread over the whole map (W, NW, N, NE, E, S) so
  // missions pull players into every region, not just one side (DQ-32).
  { id: 'ranger-forest', giver: 'Forest Ranger', icon: '🌲', title: 'Forest friends', text: 'Catch a Pokémon in Viridian Forest.', kind: 'catch', target: { locations: ['viridian-forest'] }, scope: 'travel', reward: [{ type: 'superball', amount: 1 }] },
  { id: 'scout-victory', giver: 'League Scout', icon: '🏔️', title: 'Road to the League', text: 'Explore Victory Road.', kind: 'explore', target: { locations: ['victory-road'] }, scope: 'travel', reward: [{ type: 'pokeballs', amount: 1 }, { type: 'money', amount: 2 }] },
  { id: 'collector-mtmoon', giver: 'Fossil Collector', icon: '🌙', title: 'Moon stones', text: 'Explore Mt. Moon.', kind: 'explore', target: { locations: ['mt-moon'] }, scope: 'travel', reward: [{ type: 'stars', amount: 1 }, { type: 'money', amount: 1 }], rewardByVersion: { v2: [{ type: 'superball', amount: 1 }] } },
  { id: 'bill-cottage', giver: 'Bill', icon: '🏠', title: "Bill's invitation", text: "Visit Bill's Cottage.", kind: 'visit', target: { locations: ['bills-cottage'] }, scope: 'travel', reward: [{ type: 'pokeballs', amount: 1 }, { type: 'money', amount: 2 }] },
  { id: 'fuji-lavender', giver: 'Mr. Fuji', icon: '👻', title: 'Visit Mr. Fuji', text: 'Go to Lavender Town.', kind: 'visit', target: { locations: ['lavender-town'] }, scope: 'travel', reward: [{ type: 'potion', amount: 1 }, { type: 'money', amount: 1 }] },
  { id: 'warden-safari', giver: 'Safari Warden', icon: '🦒', title: 'Safari day', text: 'Catch a Pokémon in the Safari Zone.', kind: 'catch', target: { locations: ['safari-zone'] }, scope: 'travel', reward: [{ type: 'stars', amount: 1 }, { type: 'money', amount: 1 }], rewardByVersion: { v2: [{ type: 'pokeballs', amount: 1 }, { type: 'money', amount: 2 }] } },
  { id: 'jenny-patrol', giver: 'Officer Jenny', icon: '🚓', title: 'Long patrol', text: 'Travel to a faraway town or city.', kind: 'visit', target: { generate: { locationTypes: ['town', 'city'] } }, scope: 'travel', reward: [{ type: 'stars', amount: 1 }], rewardByVersion: { v2: [{ type: 'potion', amount: 1 }] } },
  { id: 'oak-field', giver: 'Prof. Oak', icon: '🧭', title: 'Field research', text: 'Explore in 3 different places.', kind: 'exploreLocations', target: {}, count: 3, scope: 'travel', reward: [{ type: 'superball', amount: 1 }] },
];

export const QUESTS_BY_ID = Object.fromEntries(QUESTS.map((q) => [q.id, q]));

export const QUEST_KINDS = ['catch', 'defeatTrainer', 'winFlawless', 'explore', 'visit', 'evolve', 'visitPokeStops', 'exploreLocations'];
export const QUEST_REWARD_TYPES = ['money', 'pokeballs', 'superball', 'potion', 'revive', 'stars'];
