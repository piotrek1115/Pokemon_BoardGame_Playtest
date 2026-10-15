// Gyms, badges and the League (Milestone B, step 5 — V1 "Open Gyms").
// Six land gyms, challenged in any order. Difficulty follows the challenger's
// own badge count (CONFIG.gyms.tierByBadges): 0 badges → tier 1, 1 → tier 2,
// 2+ → tier 3. Rosters are versioned (`rosters: { v1, … }`, switch
// CONFIG.rules.gymRoster): a game keeps the rosters it started with, so its
// history replays exactly (read them through gymEngine.gymTiers / gymRow).
// Roster v1 (Phase 2) follows the same pattern on every gym card:
//   tier 1  A          one Stage-1 Pokémon
//   tier 2  A + B      two Stage-1 Pokémon
//   tier 3  A′ + B′    the evolved (Stage-2) forms of A and B
// Normal species stats, no HP boosts (tested).
// Roster v2 (3A-3, DQ-44 / DQ-83; new P1 games — PROVISIONAL CONTENT, current
// 74-species roster only): 2 / 3 / 3 Pokémon.
//   tier 1  A + B        two Stage-1 Pokémon of the gym's type
//   tier 2  A + B + C    one more (a second of the same species where the
//                        roster has no third one of that type)
//   tier 3  three evolved / stronger forms, the leader's signature Pokémon last
// Row powers (Σ HP + 2 × attack): T1 9–11, T2 12–16, T3 24–28.
//
//   rewards              the badge's thematic item by reward version
//                        (CONFIG.rules.gymReward): v1 none (badge + money),
//                        v2 one existing item (3A-3, DQ-83 — PROVISIONAL CONTENT)
//
//   leader / leaderNote  gym-specific leader. Brock and Misty are player
//                        characters (DQ-11), so their home gyms are run by
//                        Flint (Brock's dad) and the Sensational Sisters.
//   grants               a travel capability the badge gives for good: only
//                        the Soul Badge (Koga) → water travel (DQ-48, closes DQ-16)
//
// Viridian Gym (Giovanni) and Cinnabar Gym (Blaine) are not in the base set.
//
// Build 3.3 B33-3 (rules.gymChallenge 'v2', DQ-118): a gym is a chain — gym
// trainer(s), then the leader, in one challenge. `chain.v1` lists each gym's
// trainers in order; a game fields the first CONFIG.gyms.chainTrainers of them
// (PROVISIONAL DEV DEFAULT: 1 — the count is not approved, ChatGPT handoff
// 13.10.2026 00:11). Rows by tier like the leader's, smaller and of the gym's
// type; PROVISIONAL CONTENT. A gym trainer pays nothing (no money, no item).

export const GYMS = [
  // Pewter: Moon Stone — the stone from Mt. Moon, the next cave on the road; the rock gym gives a stone.
  { id: 'pewter', city: 'pewter-city', leader: 'Flint', leaderNote: "Brock's dad", type: 'rock', icon: '🪨', badge: 'Boulder Badge',
    rosters: { v1: [['geodude'], ['geodude', 'diglett'], ['graveler', 'dugtrio']], v2: [['geodude', 'diglett'], ['geodude', 'diglett', 'geodude'], ['dugtrio', 'graveler', 'onix']] },
    chain: { v1: [{ archetype: 'hiker', name: 'Hiker Marcos', teams: [['diglett'], ['geodude', 'sandshrew'], ['graveler', 'sandslash']] },
      { archetype: 'camper', name: 'Camper Liam', teams: [['sandshrew'], ['diglett', 'geodude'], ['onix', 'graveler']] }] },
    themed: [['geodude', 'zubat'], ['geodude', 'zubat', 'onix'], ['graveler', 'golbat', 'onix']], // PT006-07 'D' (candidate): Mt. Moon's cave bats beside the rocks
    rewards: { v1: { item: null }, v2: { item: 'moonstone' } } },
  // Cerulean: Water Stone — the water gym; it evolves Staryu (Misty's own line). Krabby / Kingler, not
  // Seel / Dewgong: Seel is Lorelei's in the League.
  { id: 'cerulean', city: 'cerulean-city', leader: 'Sensational Sisters', leaderNote: "Misty's sisters Daisy, Violet and Lily", type: 'water', icon: '💧', badge: 'Cascade Badge',
    rosters: { v1: [['staryu'], ['staryu', 'psyduck'], ['starmie', 'golduck']], v2: [['staryu', 'psyduck'], ['staryu', 'psyduck', 'krabby'], ['golduck', 'kingler', 'starmie']] },
    chain: { v1: [{ archetype: 'swimmer', name: 'Swimmer Luis', teams: [['goldeen'], ['horsea', 'staryu'], ['seaking', 'poliwhirl']] },
      { archetype: 'picnicker', name: 'Picnicker Diana', teams: [['poliwag'], ['psyduck', 'goldeen'], ['poliwhirl', 'seaking']] }] },
    themed: [['staryu', 'tentacool'], ['staryu', 'tentacool', 'psyduck'], ['starmie', 'tentacruel', 'golduck']], // PT006-07 'D' (candidate): the sea of Cerulean Cape — jellyfish in the show
    rewards: { v1: { item: null }, v2: { item: 'waterstone' } } },
  // Vermilion: Thunder Stone — the electric gym; it evolves Pikachu. The roster has only two Electric
  // lines, so tier 2 / 3 field a second Magnemite / Magneton.
  { id: 'vermilion', city: 'vermilion-city', leader: 'Lt. Surge', type: 'electric', icon: '⚡', badge: 'Thunder Badge',
    rosters: { v1: [['pikachu'], ['pikachu', 'magnemite'], ['raichu', 'magneton']], v2: [['pikachu', 'magnemite'], ['pikachu', 'magnemite', 'magnemite'], ['magneton', 'magneton', 'raichu']] },
    chain: { v1: [{ archetype: 'scientist', name: 'Scientist Ted', teams: [['voltorb'], ['voltorb', 'magnemite'], ['electrode', 'magnemite']] },
      { archetype: 'sailor', name: 'Sailor Edmond', teams: [['magnemite'], ['pikachu', 'voltorb'], ['magnemite', 'electrode']] }] },
    themed: [['pikachu', 'farfetchd'], ['pikachu', 'magnemite', 'farfetchd'], ['raichu', 'magneton', 'farfetchd']], // PT006-07 'D' (candidate): the port's Farfetch'd (Vermilion's trade in Red / Blue)
    rewards: { v1: { item: null }, v2: { item: 'thunderstone' } } },
  // Celadon: Leaf Stone — the grass gym; it evolves Gloom into Erika's Vileplume.
  { id: 'celadon', city: 'celadon-city', leader: 'Erika', type: 'grass', icon: '🌿', badge: 'Rainbow Badge',
    rosters: { v1: [['bulbasaur'], ['bulbasaur', 'oddish'], ['ivysaur', 'gloom']], v2: [['bulbasaur', 'oddish'], ['bulbasaur', 'oddish', 'oddish'], ['gloom', 'ivysaur', 'vileplume']] },
    chain: { v1: [{ archetype: 'lass', name: 'Lass Janice', teams: [['bellsprout'], ['oddish', 'bellsprout'], ['weepinbell', 'gloom']] },
      { archetype: 'picnicker', name: 'Picnicker Nancy', teams: [['oddish'], ['bellsprout', 'oddish'], ['gloom', 'tangela']] }] },
    themed: [['oddish', 'exeggcute'], ['bulbasaur', 'oddish', 'exeggcute'], ['gloom', 'exeggutor', 'vileplume']], // PT006-07 'D' (candidate): Erika's garden: palm-tree Exeggutor; still weak to fire (a grass gym)
    rewards: { v1: { item: null }, v2: { item: 'leafstone' } } },
  // Saffron: Super Ball — Saffron is the home of Silph Co., the ball maker (no psychic stone exists).
  { id: 'saffron', city: 'saffron-city', leader: 'Sabrina', type: 'psychic', icon: '🔮', badge: 'Marsh Badge',
    rosters: { v1: [['abra'], ['abra', 'slowpoke'], ['kadabra', 'slowbro']], v2: [['abra', 'slowpoke'], ['abra', 'slowpoke', 'abra'], ['slowbro', 'kadabra', 'alakazam']] },
    chain: { v1: [{ archetype: 'psychic', name: 'Psychic Johan', teams: [['drowzee'], ['drowzee', 'abra'], ['hypno', 'kadabra']] },
      { archetype: 'psychic', name: 'Psychic Tyron', teams: [['abra'], ['slowpoke', 'drowzee'], ['kadabra', 'hypno']] }] },
    themed: [['abra', 'machop'], ['abra', 'slowpoke', 'machop'], ['slowbro', 'machoke', 'alakazam']], // PT006-07 'D' (candidate): the Fighting Dojo next door
    rewards: { v1: { item: null }, v2: { item: 'superball' } } },
  // Fuchsia: Super Potion — no poison-themed item exists; the Soul Badge already gives water travel,
  // so the item is a plain useful one.
  { id: 'fuchsia', city: 'fuchsia-city', leader: 'Koga', type: 'poison', icon: '☠️', badge: 'Soul Badge', grants: 'canTravelWater',
    rosters: { v1: [['koffing'], ['koffing', 'gastly'], ['weezing', 'haunter']], v2: [['koffing', 'gastly'], ['koffing', 'gastly', 'zubat'], ['golbat', 'haunter', 'weezing']] },
    chain: { v1: [{ archetype: 'biker', name: 'Biker Jared', teams: [['grimer'], ['koffing', 'zubat'], ['muk', 'golbat']] },
      { archetype: 'scientist', name: 'Scientist Connor', teams: [['koffing'], ['grimer', 'zubat'], ['golbat', 'muk']] }] },
    themed: [['koffing', 'venonat'], ['koffing', 'venonat', 'gastly'], ['weezing', 'venomoth', 'haunter']], // PT006-07 'D' (candidate): Koga's poison moths
    rewards: { v1: { item: null }, v2: { item: 'superpotion' } } },
];

export const GYMS_BY_ID = Object.fromEntries(GYMS.map((g) => [g.id, g]));

export function gymInCity(locationId) {
  return GYMS.find((g) => g.city === locationId) ?? null;
}

// The League at Indigo Plateau: a 2-stage final (DQ-47). Stage 1 is one battle
// against three Elite Four members; then an intermission (items and lead only,
// damage carries over); stage 2 is Champion Lance. Beating stage 1 earns the
// Elite Four Ribbon: a later League Challenge starts directly at Lance (DQ-50).
// Gary is a player character, so he is never the NPC Champion. Teams are
// versioned like gym rosters (switch CONFIG.rules.leagueRoster; read them
// through gymEngine.leagueStageTeam).
// v2 (3A-3 League audit; activated for new P1 games by ChatGPT 09.10.2026
// 23:46 — PROVISIONAL CONTENT until the fuller Kanto roster): the Elite Four
// at least as strong as every tier-3 gym of roster v2 (29 ≥ 24–28), Lance one
// Gyarados as before; the League again > 1.5 × a tier-3 gym. Build 2 / Phase 2
// / older saves keep v1 (docs/SIMULATION.md „3A-3”).
export const LEAGUE = {
  location: 'indigo-plateau',
  // Build 3.3 B33-3 — League Challenge v2 (rules.leagueChallenge 'v2', review C6,
  // DQ-118): four battles in one challenge — Lorelei → Bruno → Agatha → Champion
  // Lance — an intermission after each (items, lead; no Poké Stop heal), a loss or
  // „Wyjdź” restarts at Lorelei, the Elite Four Ribbon is recorded but never skips.
  // PROVISIONAL CONTENT: each member fields today's League v2 Pokémon of theirs.
  challengeV2: [
    { id: 'lorelei', trainer: 'Lorelei', team: ['dewgong'] },
    { id: 'bruno', trainer: 'Bruno', team: ['onix'] },
    { id: 'agatha', trainer: 'Agatha', team: ['haunter'] },
    { id: 'lance', trainer: 'Lance', team: ['gyarados'], champion: true },
  ],
  stages: [
    { id: 'eliteFour', name: 'Elite Four', trainers: ['Lorelei', 'Agatha', 'Bruno'], teams: { v1: ['seel', 'gastly', 'onix'], v2: ['dewgong', 'haunter', 'onix'] } },
    { id: 'lance', name: 'Champion Lance', trainers: ['Lance'], teams: { v1: ['gyarados'], v2: ['gyarados'] } },
  ],
};
