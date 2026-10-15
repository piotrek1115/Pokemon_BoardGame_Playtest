// One Kanto bonus 14.10 — FISHING with the OLD ROD (rules.fishing 'v1'; M02-4 / DAY-03; PHASE_3B_MACRO_02 §9 key
// items, §2.2 the fishing pool). PROVISIONAL numbers — a playtest candidate, never a default without Piotr.
//   rod      the lasting key item (data/questBook.js QUEST_BOOK_KEY_ITEMS — the ONE key-item list, no second
//            inventory): never used up, never Meowth's loot, never lost by giving up a quest
//   rodFrom  the quest whose reward it is: the sailor („Marynarz lubi wodne Pokémony”, QUEST_PACK day14)
//   bite     the faces of the player's own d6 (a physical die at the table) on which something bites
//   pools    by the place's water: fresh water ('water' biome) / the sea ('sea'); a place with both: both.
//            Species checked against data/pokemon.js — Magikarp (water, sea), Poliwag / Goldeen (water),
//            Krabby (beach) and Tentacool (sea, beach) only from the sea. No Surf: only places on the land
//            graph a player already stands on.
export const FISHING = {
  v1: {
    rod: 'oldRod',
    rodFrom: 'sailor-water-show',
    bite: [3, 4, 5, 6],
    pools: {
      water: [{ species: 'magikarp', weight: 3 }, { species: 'poliwag', weight: 2 }, { species: 'goldeen', weight: 1 }],
      sea: [{ species: 'magikarp', weight: 3 }, { species: 'krabby', weight: 2 }, { species: 'tentacool', weight: 1 }],
    },
  },
};
