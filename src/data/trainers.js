// Trainer archetypes used by the trainer generator (engine/trainerEngine.js).
//   biomes  where this archetype shows up (falls back to any archetype)
//   types   preferred Pokémon types for its team
//   names   name pool; canonical Gen 1 trainer names where useful
// Generated trainers have the shape { name, archetype, difficulty, pokemonTeam, reward }.
export const TRAINER_ARCHETYPES = [
  { id: 'bug-catcher', name: 'Bug Catcher', biomes: ['forest', 'grass'], types: ['bug'], names: ['Rick', 'Doug', 'Sammy', 'Colton'] },
  { id: 'youngster', name: 'Youngster', biomes: ['grass', 'city'], types: ['normal'], names: ['Joey', 'Ben', 'Calvin', 'Dan'] },
  { id: 'lass', name: 'Lass', biomes: ['grass', 'city'], types: ['normal', 'grass'], names: ['Janice', 'Sally', 'Robin', 'Haley'] },
  { id: 'hiker', name: 'Hiker', biomes: ['cave', 'grass'], types: ['rock', 'ground'], names: ['Marcos', 'Franklin', 'Nob', 'Wayne'] },
  { id: 'fisherman', name: 'Fisherman', biomes: ['water', 'sea', 'beach'], types: ['water'], names: ['Ned', 'Chip', 'Hank', 'Elliot'] },
  { id: 'sailor', name: 'Sailor', biomes: ['sea', 'beach', 'city'], types: ['water', 'fighting'], names: ['Edmond', 'Trevor', 'Leonard', 'Duncan'] },
  { id: 'camper', name: 'Camper', biomes: ['grass', 'forest'], types: ['normal', 'ground', 'fire'], names: ['Liam', 'Shane', 'Ethan', 'Ricky'] },
  { id: 'picnicker', name: 'Picnicker', biomes: ['grass', 'forest', 'water'], types: ['grass', 'normal', 'water'], names: ['Diana', 'Nancy', 'Isabelle', 'Kelsey'] },
  { id: 'scientist', name: 'Scientist', biomes: ['city', 'cave'], types: ['electric', 'poison'], names: ['Ted', 'Connor', 'Jerry', 'Jose'] },
  { id: 'psychic', name: 'Psychic', biomes: ['city'], types: ['psychic'], names: ['Johan', 'Tyron', 'Cameron', 'Preston'] },
  { id: 'channeler', name: 'Channeler', biomes: ['haunted'], types: ['ghost'], names: ['Hope', 'Patricia', 'Carly', 'Paula'] },
  { id: 'biker', name: 'Biker', biomes: ['city', 'grass'], types: ['poison'], names: ['Jared', 'Malik', 'Isaac', 'Gerald'] },
  { id: 'bird-keeper', name: 'Bird Keeper', biomes: ['air', 'grass'], types: ['flying'], names: ['Sebastian', 'Perry', 'Robert', 'Donald'] },
  { id: 'swimmer', name: 'Swimmer', biomes: ['sea', 'beach', 'water'], types: ['water'], names: ['Luis', 'Richard', 'Reece', 'Matthew'] },
];

export const TRAINER_ARCHETYPES_BY_ID = Object.fromEntries(TRAINER_ARCHETYPES.map((t) => [t.id, t]));
