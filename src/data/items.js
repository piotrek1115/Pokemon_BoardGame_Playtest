// Items sold at Poké Stops. Prices live in CONFIG.economy, effects in
// CONFIG.items; this file only names them.
//   kind: ball       thrown during a wild encounter
//         medicine   used for free during your turn (in battle: by the game's
//                    rules — never / instead of the attack / free, see CONFIG.items)
//         evolution  an Evolution Stone, consumed when a Pokémon evolves on an
//                    edge that needs it (data/pokemon.js `evolution.item`; Phase
//                    3A Growth games only, DQ-78)
export const ITEMS = {
  pokeball: { name: 'Poké Ball', icon: '🔴', kind: 'ball' },
  // Playtest 004 (DQ-108): the family table calls it Great Ball (table/i18n.js). This
  // English name is in the log of every saved game, so it stays (replays stay exact).
  superball: { name: 'Super Ball', icon: '🔵', kind: 'ball' },
  // Build 3.3 E2 (B33-4, rules.ultraBall): a stronger ball — never a sure catch (the cap stays).
  // Only games with the switch can get one (regional shops, rewards).
  ultraball: { name: 'Ultra Ball', icon: '🟡', kind: 'ball' },
  potion: { name: 'Potion', icon: '🧪', kind: 'medicine' },
  superpotion: { name: 'Super Potion', icon: '🧪', kind: 'medicine' }, // Gameplay P1 games only (rules.healingItems 'v2')
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
