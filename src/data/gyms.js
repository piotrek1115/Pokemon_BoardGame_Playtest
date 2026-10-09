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
//
//   leader / leaderNote  gym-specific leader. Brock and Misty are player
//                        characters (DQ-11), so their home gyms are run by
//                        Flint (Brock's dad) and the Sensational Sisters.
//   grants               a travel capability the badge gives for good: only
//                        the Soul Badge (Koga) → water travel (DQ-48, closes DQ-16)
//
// Viridian Gym (Giovanni) and Cinnabar Gym (Blaine) are not in the base set.

export const GYMS = [
  { id: 'pewter', city: 'pewter-city', leader: 'Flint', leaderNote: "Brock's dad", type: 'rock', icon: '🪨', badge: 'Boulder Badge', rosters: { v1: [['geodude'], ['geodude', 'diglett'], ['graveler', 'dugtrio']] } },
  { id: 'cerulean', city: 'cerulean-city', leader: 'Sensational Sisters', leaderNote: "Misty's sisters Daisy, Violet and Lily", type: 'water', icon: '💧', badge: 'Cascade Badge', rosters: { v1: [['staryu'], ['staryu', 'psyduck'], ['starmie', 'golduck']] } },
  { id: 'vermilion', city: 'vermilion-city', leader: 'Lt. Surge', type: 'electric', icon: '⚡', badge: 'Thunder Badge', rosters: { v1: [['pikachu'], ['pikachu', 'magnemite'], ['raichu', 'magneton']] } },
  { id: 'celadon', city: 'celadon-city', leader: 'Erika', type: 'grass', icon: '🌿', badge: 'Rainbow Badge', rosters: { v1: [['bulbasaur'], ['bulbasaur', 'oddish'], ['ivysaur', 'gloom']] } },
  { id: 'saffron', city: 'saffron-city', leader: 'Sabrina', type: 'psychic', icon: '🔮', badge: 'Marsh Badge', rosters: { v1: [['abra'], ['abra', 'slowpoke'], ['kadabra', 'slowbro']] } },
  { id: 'fuchsia', city: 'fuchsia-city', leader: 'Koga', type: 'poison', icon: '☠️', badge: 'Soul Badge', grants: 'canTravelWater', rosters: { v1: [['koffing'], ['koffing', 'gastly'], ['weezing', 'haunter']] } },
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
export const LEAGUE = {
  location: 'indigo-plateau',
  stages: [
    { id: 'eliteFour', name: 'Elite Four', trainers: ['Lorelei', 'Agatha', 'Bruno'], teams: { v1: ['seel', 'gastly', 'onix'] } },
    { id: 'lance', name: 'Champion Lance', trainers: ['Lance'], teams: { v1: ['gyarados'] } },
  ],
};
