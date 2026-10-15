// Biomes a location can expose. A location may list several; when exploring a
// mixed location the player picks one before the encounter is generated.
export const BIOMES = {
  grass: { name: 'Grass', icon: '🌿' },
  forest: { name: 'Forest', icon: '🌲' },
  water: { name: 'Water / Lake', icon: '💧' },
  sea: { name: 'Sea', icon: '🌊' },
  beach: { name: 'Beach', icon: '🏖️' },
  cave: { name: 'Cave', icon: '🪨' },
  haunted: { name: 'Haunted', icon: '👻' },
  city: { name: 'City', icon: '🏙️' },
  air: { name: 'Air / Flying', icon: '🪶' },
};

export const BIOME_IDS = Object.keys(BIOMES);
