// Playable characters (base game). Goh is reserved for a later expansion.
// Brock, Misty and Gary are player characters and must not also act as
// independent NPCs (see DQ-11 for the gym-leader conflict).
// Starters: ACCEPTED v0.1 (DQ-01); all four are 4 HP / +1 for parity.
// Build 3.3 A1 (approved 23:00, DQ-122 / DQ-123): `start` — where the character
// begins in a game with rules.starts 'character' (an older game: everyone at
// CONFIG.startLocation); `homeGym` — the gym that can't give the character's
// FIRST badge with rules.hometownGym (Flint / the Sensational Sisters stay the
// NPC leaders). No other perk: no badge, money, item or healing.
export const CHARACTERS = [
  { id: 'ash', name: 'Ash', starter: 'pikachu', color: '#e5483b', start: 'pallet-town' },
  { id: 'misty', name: 'Misty', starter: 'staryu', color: '#2f7fe0', start: 'cerulean-city', homeGym: 'cerulean' },
  { id: 'brock', name: 'Brock', starter: 'geodude', color: '#b07a2a', start: 'pewter-city', homeGym: 'pewter' },
  { id: 'gary', name: 'Gary', starter: 'squirtle', color: '#7b4fd6', start: 'pallet-town' },
];

export const CHARACTERS_BY_ID = Object.fromEntries(CHARACTERS.map((c) => [c.id, c]));
