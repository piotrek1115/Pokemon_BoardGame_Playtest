// Playable characters (base game). Goh is reserved for a later expansion.
// Brock, Misty and Gary are player characters and must not also act as
// independent NPCs (see DQ-11 for the gym-leader conflict).
// Starters: ACCEPTED v0.1 (DQ-01); all four are 4 HP / +1 for parity.
export const CHARACTERS = [
  { id: 'ash', name: 'Ash', starter: 'pikachu', color: '#e5483b' },
  { id: 'misty', name: 'Misty', starter: 'staryu', color: '#2f7fe0' },
  { id: 'brock', name: 'Brock', starter: 'geodude', color: '#b07a2a' },
  { id: 'gary', name: 'Gary', starter: 'squirtle', color: '#7b4fd6' },
];

export const CHARACTERS_BY_ID = Object.fromEntries(CHARACTERS.map((c) => [c.id, c]));
