// Simplified Gen 1 type chart for combat v0.1: no x2 / x0.5 multipliers.
// Each attacking type lists defender types it is strong / weak against.
// Immunities (e.g. Normal vs Ghost) are folded into "weak" on purpose.
export const TYPE_CHART = {
  normal: { strong: [], weak: ['rock', 'ghost'] },
  fire: { strong: ['grass', 'bug', 'ice'], weak: ['fire', 'water', 'rock', 'dragon'] },
  water: { strong: ['fire', 'ground', 'rock'], weak: ['water', 'grass', 'dragon'] },
  electric: { strong: ['water', 'flying'], weak: ['electric', 'grass', 'ground', 'dragon'] },
  grass: { strong: ['water', 'ground', 'rock'], weak: ['fire', 'grass', 'poison', 'flying', 'bug', 'dragon'] },
  ice: { strong: ['grass', 'ground', 'flying', 'dragon'], weak: ['fire', 'water', 'ice'] },
  fighting: { strong: ['normal', 'ice', 'rock'], weak: ['poison', 'flying', 'psychic', 'bug', 'ghost'] },
  poison: { strong: ['grass', 'bug'], weak: ['poison', 'ground', 'rock', 'ghost'] },
  ground: { strong: ['fire', 'electric', 'poison', 'rock'], weak: ['grass', 'bug', 'flying'] },
  flying: { strong: ['grass', 'fighting', 'bug'], weak: ['electric', 'rock'] },
  psychic: { strong: ['fighting', 'poison'], weak: ['psychic'] },
  bug: { strong: ['grass', 'poison', 'psychic'], weak: ['fire', 'fighting', 'flying', 'ghost'] },
  rock: { strong: ['fire', 'ice', 'flying', 'bug'], weak: ['fighting', 'ground'] },
  ghost: { strong: ['ghost', 'psychic'], weak: ['normal'] },
  dragon: { strong: ['dragon'], weak: [] },
};

export const TYPE_IDS = Object.keys(TYPE_CHART);

export const TYPE_ICONS = {
  normal: '⚪', fire: '🔥', water: '💧', electric: '⚡', grass: '🍃', ice: '❄️',
  fighting: '👊', poison: '☠️', ground: '⛰️', flying: '🪶', psychic: '🔮',
  bug: '🐛', rock: '🪨', ghost: '👻', dragon: '🐉',
};
