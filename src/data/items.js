// Items sold at Poké Stops. Prices live in CONFIG.economy, effects in
// CONFIG.items; this file only names them.
//   kind: ball       thrown during a wild encounter
//         medicine   used for free during your turn, outside encounters
//         evolution  an Evolution Stone, consumed when a Pokémon evolves on an
//                    edge that needs it (data/pokemon.js `evolution.item`; Phase
//                    3A Growth games only, DQ-78)
export const ITEMS = {
  pokeball: { name: 'Poké Ball', icon: '🔴', kind: 'ball' },
  superball: { name: 'Super Ball', icon: '🔵', kind: 'ball' },
  potion: { name: 'Potion', icon: '🧪', kind: 'medicine' },
  revive: { name: 'Revive', icon: '✨', kind: 'medicine' },
  thunderstone: { name: 'Thunder Stone', icon: '⚡', kind: 'evolution' },
  waterstone: { name: 'Water Stone', icon: '💧', kind: 'evolution' },
  firestone: { name: 'Fire Stone', icon: '🔥', kind: 'evolution' },
  leafstone: { name: 'Leaf Stone', icon: '🍃', kind: 'evolution' },
  moonstone: { name: 'Moon Stone', icon: '🌙', kind: 'evolution' },
};

export const ITEM_IDS = Object.keys(ITEMS);
export const BALL_IDS = ITEM_IDS.filter((id) => ITEMS[id].kind === 'ball');
export const STONE_IDS = ITEM_IDS.filter((id) => ITEMS[id].kind === 'evolution');
