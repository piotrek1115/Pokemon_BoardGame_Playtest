// PLAYTEST_006 C5 — Kanto Rumours & Opportunities, the first small pilot (PT006-11; spec: PLAYTEST_006
// R0–R14). DEV pilot (rules.rumours 'pilot'; One Kanto: ?dev=rumours). A discovery / availability LAYER
// over the one Questbook: an opportunity is a world fact (when it can be taken), a rumour is what one
// player heard; the quest itself lives in the quest book (data/questBook.js RUMOUR_QUESTS, `rumour: id`).
//   quest      the quest book quest it opens (taken at its start place)
//   start      where it is taken — the place a rumour points to (a marker on the map)
//   hear       'anyStop' (every Poké Stop) or { region: steps } (Poké Stops that near the start place)
//   appearsIn  the weeks it may APPEAR in (drawn once per game from the seed, its own hash stream)
//   openWeeks  how long it is open for a player who has not heard of it; it returns once, 8 weeks later
// PROVISIONAL (Piotr's review): K = 2 fresh at a time, variant C (a rumour heard is kept until taken),
// one rumour per own turn, 6 opportunities — all on quest steps the engine already has (anti-softlock:
// land places only, no random Rocket plot, no Surf, no missing gym).
export const RUMOURS = {
  fresh: 2, // K: at most this many fresh (newly appeared) opportunities at a time
  returnGap: 8, // weeks before an unheard, closed opportunity returns (once)
  perTurn: 1, // new rumours a player hears per own turn (at the start place: always)
  maxActive: 1, // quest-book slot of its own (not one of the 2 ordinary ones)
};

export const OPPORTUNITIES = {
  v1: [
    { id: 'opp-parcel', category: 'short', quest: 'viridian-parcel', start: 'viridian-city', hear: { region: 4 }, appearsIn: [3, 8], openWeeks: 5 },
    { id: 'opp-courier', category: 'short', quest: 'vermilion-courier', start: 'vermilion-city', hear: { region: 4 }, appearsIn: [6, 14], openWeeks: 5 },
    { id: 'opp-bill', category: 'story', quest: 'bill-teleporter', start: 'bills-cottage', hear: { region: 6 }, appearsIn: [8, 18], openWeeks: 6 },
    { id: 'opp-power-plant', category: 'regional', quest: 'power-plant-fault', start: 'power-plant', hear: { region: 6 }, appearsIn: [10, 18], openWeeks: 4 },
    { id: 'opp-lavender', category: 'regional', quest: 'lavender-fog', start: 'lavender-town', hear: { region: 6 }, appearsIn: [12, 22], openWeeks: 4 },
    { id: 'opp-celadon-rocket', category: 'rocket', quest: 'celadon-rocket', start: 'celadon-city', hear: 'anyStop', appearsIn: [14, 24], openWeeks: 4 },
    // One Kanto day 14.10 (G1): the Rare Expedition is FOUND as a rumour when both pilots are on — one quest, no
    // duplicate (data/questBook.js EXPEDITIONS `rumour: 'opp-scyther'`); `needsRule`: only in games that have it
    { id: 'opp-scyther', category: 'medium', quest: 'safari-scyther', start: 'fuchsia-city', hear: { region: 6 }, appearsIn: [8, 16], openWeeks: 6, needsRule: 'expeditions' },
  ],
};
