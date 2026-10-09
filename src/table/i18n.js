// Polish family copy for the digital tabletop. Species, places, leaders and
// mission texts come from the data files (English for now).
export const RARITY_PL = { common: 'Pospolity', rare: 'Rzadki', superRare: 'Bardzo rzadki' };

export const TYPE_PL = {
  normal: 'Normalny', fire: 'Ognisty', water: 'Wodny', electric: 'Elektryczny', grass: 'Trawiasty', ice: 'Lodowy',
  fighting: 'Walczący', poison: 'Trujący', ground: 'Ziemny', flying: 'Latający', psychic: 'Psychiczny',
  bug: 'Robak', rock: 'Skalny', ghost: 'Duch', dragon: 'Smok',
};

export const BIOME_PL = {
  grass: 'Trawa', forest: 'Las', water: 'Jezioro', sea: 'Morze', beach: 'Plaża', cave: 'Jaskinia',
  haunted: 'Nawiedzone', city: 'Miasto', air: 'Niebo',
};

export const OUTCOME_PL = {
  nothing: 'Cisza… nic się nie dzieje',
  event: 'Wydarzenie!',
  trainer: 'Trener wyzywa cię!',
  pokemon: 'Dziki Pokémon!',
  pokemonBonus: 'Dziki Pokémon! (+1 do rzadkości)',
};

export const DICE_MODE_PL = {
  playerDice: { name: 'Kości gracza', hint: 'Rzucasz fizycznie: atak i kostka łapania. Resztę rzuca gra.' },
  allPhysical: { name: 'Wszystkie fizyczne', hint: 'Każdy rzut wpisujecie z prawdziwych kości, także za świat i AI.' },
  digital: { name: 'Cyfrowe', hint: 'Gra rzuca wszystkimi kośćmi.' },
};

// Catch Dice: colour + secondary identity (● = Poké Ball faces).
export const CATCH_DIE = {
  blue: { name: 'Niebieska', icon: '🔵', dots: '●●●', word: 'łatwa' },
  purple: { name: 'Fioletowa', icon: '🟣', dots: '●●', word: 'średnia' },
  magenta: { name: 'Magenta', icon: '🩷', dots: '●', word: 'trudna' },
};

// Escape Dice: colour + secondary identity (🌬️ = flee faces).
export const ESCAPE_DIE = {
  red: { name: 'Czerwona', icon: '🔴', wind: '🌬️🌬️🌬️', flee: 3, zone: 'czerwona strefa' },
  yellow: { name: 'Żółta', icon: '🟡', wind: '🌬️🌬️', flee: 2, zone: 'żółta strefa' },
  green: { name: 'Zielona', icon: '🟢', wind: '🌬️', flee: 1, zone: 'zielona strefa' },
};

export const BALL_PL = { pokeball: 'Poké Ball', superball: 'Super Ball' };
// Canonical item names stay (DQ-73), stones included.
export const ITEM_PL = {
  pokeball: 'Poké Ball', superball: 'Super Ball', potion: 'Potion', revive: 'Revive',
  thunderstone: 'Thunder Stone', waterstone: 'Water Stone', firestone: 'Fire Stone', leafstone: 'Leaf Stone', moonstone: 'Moon Stone',
};

export function stageLabel(stage) {
  return ['', 'I', 'II', 'III'][stage] ?? String(stage);
}

// What a d6 is for, from the engine's roll label.
export function d6Purpose(label) {
  if (label === 'Encounter') return 'Eksploracja';
  if (label === 'Rarity') return 'Rzadkość';
  if (label === 'Team Rocket') return 'Team Rocket — początek tygodnia';
  if (/Meowth/i.test(label)) return 'Meowth';
  if (/difficulty/i.test(label)) return 'Trudność trenera';
  if (label === 'Trainer type') return 'Rodzaj trenera';
  const m = /^(.+) attacks (.+)$/.exec(label);
  if (m) return `Atak: ${m[1]} → ${m[2]}`;
  return label;
}

export const D6_FACE = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

export function plural(n, one, few, many) {
  if (n === 1) return one;
  const d = n % 10;
  const t = n % 100;
  return d >= 2 && d <= 4 && (t < 12 || t > 14) ? few : many;
}
