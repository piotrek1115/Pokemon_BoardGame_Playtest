// Build 3.3 E2 — Economy 3.0 (B33-4, docs/BUILD_3_3_SPEC.md §12). Every number and
// list here is PROVISIONAL dev content behind its own rule switch; older games
// never read it.
//
// rules.shopStock 'regional': what a Poké Stop sells depends on the city. Every
// Stop keeps the basics; a few add their own (Celadon's Department Store —
// the stones, Silph Co. in Saffron and the League's Stop — Ultra Balls). The
// Moon Stone is never sold here (DEC-19 open: Pewter's gym and Hikers' loot are
// its sources in this candidate). Older games: the same stock everywhere.
export const SHOP_STOCK = {
  regional: {
    base: ['pokeball', 'superball', 'potion', 'superpotion', 'revive'],
    extra: {
      'celadon-city': ['firestone', 'waterstone', 'thunderstone', 'leafstone', 'ultraball'],
      'saffron-city': ['ultraball'],
      'indigo-plateau': ['ultraball'],
    },
  },
};

// rules.loot 'v1': after a won battle with a random trainer that pays (not at an
// exhausted place), a loot d6. 1–4 nothing; 5 a Poké Ball; 6 the trainer class's
// item. At a tired place only a 6 counts. Stones from loot: at most
// `stoneCap` per player per game (the ledger in player.loot).
// EREV — stone sources, a MEASUREMENT switch (rules.stoneSources; DEV stays false = the
// regional shops alone). PROVISIONAL places, faces and caps:
//   'explore' (B) an Explore at a stone place (not exhausted) rolls a stone d6 on its own
//                 stream: a 6 finds the place's stone — once per player per place;
//   'quests'  (C) five quest-book quests pay a stone as an extra line;
//   'mixed'   (D) both, limited: at most `mixedFindCap` finds per player, and a quest's
//                 stone only the first time that quest is collected.
export const STONE_SOURCES = {
  finds: { 'mt-moon': 'moonstone', 'power-plant': 'thunderstone', 'route-24': 'waterstone', 'safari-zone': 'leafstone', 'route-8': 'firestone' },
  findFace: 6,
  mixedFindCap: 2,
  questStones: { 'oak-water': 'waterstone', 'vermilion-spark': 'thunderstone', 'oak-habitats': 'leafstone', 'nugget-bridge': 'firestone', 'mt-moon-fossil': 'moonstone' },
};

export const TRAINER_LOOT = {
  v1: {
    common: 'pokeball',
    byClass: {
      hiker: 'moonstone', camper: 'firestone', scientist: 'thunderstone',
      swimmer: 'superpotion', fisherman: 'superpotion', biker: 'superpotion',
      sailor: 'potion', lass: 'potion', picnicker: 'potion',
      youngster: 'pokeball', 'bug-catcher': 'pokeball',
      psychic: 'revive', channeler: 'revive', 'bird-keeper': 'superball',
    },
    stoneCap: 2,
  },
};
