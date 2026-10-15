// COMBAT 2.0 (from the isolated prototype; used by the MVP — rules.combatMoves 'mvp1', dev-1510-combat). SPECIES_LEARNSETS and TM_COMPATIBILITY.
//
// The SPECIES defines the possibilities; an INSTANCE knows 0, 1 or 2 of them (knownMoves.js).
// Written per EVOLUTION FAMILY (data/pokemon.js `family`), so a line shares its moves and a later stage only ADDS
// options (an entry [move, minStage] opens at that stage). That makes evolution carry-over safe by construction:
// whatever a Pokémon knows is still in its evolved form's learnset (tested for every edge, Eevee's three included).
//   basic     the family's basic attack (always available; its type is the user's attack type — today's attack)
//   special   the Special options, in order — the FIRST one is what a starter / a caught Pokémon knows (rule §5.4)
//   powerful  the Powerful options, in order (may be empty: cocoons, Magikarp, the first bug stages)
//   forms     Eevee only: extra options of one branch form (Vaporeon / Jolteon / Flareon)
import { POKEMON, EEVEE_FORMS } from '../data/pokemon.js';
import { MOVE_DEFINITIONS } from './moves.js';

export const FAMILY_MOVES = Object.freeze({
  bulbasaur: { basic: 'vineWhip', special: ['absorb', 'poisonPowder', ['sleepPowder', 2]], powerful: ['razorLeaf', ['solarBeam', 3]] },
  charmander: { basic: 'scratch', special: ['ember', 'smokescreen'], powerful: ['flamethrower', ['fireBlast', 3], ['wingAttack', 3]] },
  squirtle: { basic: 'tackle', special: ['withdraw', 'tailWhip'], powerful: ['bubbleBeam', ['skullBash', 2], ['hydroPump', 3]] },
  caterpie: { basic: 'tackle', special: ['stringShot', ['harden', 2], ['sleepPowder', 3], ['stunSpore', 3]], powerful: [['wingAttack', 3]] },
  weedle: { basic: 'hornAttack', special: ['poisonSting', ['harden', 2], ['focusEnergy', 3]], powerful: [['twineedle', 3], ['pinMissile', 3]] },
  pidgey: { basic: 'gust', special: ['sandAttack', 'quickAttack'], powerful: ['wingAttack', ['skyAttack', 3]] },
  rattata: { basic: 'tackle', special: ['quickAttack', 'tailWhip'], powerful: ['hyperFang'] },
  spearow: { basic: 'peck', special: ['leer', 'growl'], powerful: ['furyAttack', ['drillPeck', 2]] },
  pikachu: { basic: 'thundershock', special: ['thunderWave', 'quickAttack'], powerful: ['thunderbolt', ['thunder', 2]] },
  clefairy: { basic: 'pound', special: ['sing', 'defenseCurl'], powerful: ['doubleSlap', ['bodySlam', 2]] },
  zubat: { basic: 'bite', special: ['leechLife', 'supersonic'], powerful: ['wingAttack'] },
  oddish: { basic: 'leafage', special: ['poisonPowder', 'stunSpore', 'sleepPowder'], powerful: ['petalDance', ['solarBeam', 3]] },
  diglett: { basic: 'scratch', special: ['sandAttack'], powerful: ['dig', ['earthquake', 2]] },
  meowth: { basic: 'scratch', special: ['growl', ['screech', 2]], powerful: ['payDay', ['slash', 2]] },
  psyduck: { basic: 'confusion', special: ['tailWhip'], powerful: ['surf', ['hydroPump', 2]] },
  growlithe: { basic: 'bite', special: ['ember', 'leer'], powerful: ['flamethrower', ['fireBlast', 2]] },
  poliwag: { basic: 'bubble', special: ['hypnosis', 'doubleTeam'], powerful: ['bubbleBeam', ['bodySlam', 2], ['submission', 3]] },
  abra: { basic: 'confusion', special: ['reflect'], powerful: ['psybeam', ['psychic', 3]] },
  tentacool: { basic: 'wrap', special: ['poisonSting', 'supersonic'], powerful: ['bubbleBeam', ['hydroPump', 2]] },
  geodude: { basic: 'tackle', special: ['defenseCurl'], powerful: ['rockSlide', ['earthquake', 3]] },
  slowpoke: { basic: 'headbutt', special: ['growl', ['withdraw', 2]], powerful: ['surf', ['psychic', 2]] },
  magnemite: { basic: 'thundershock', special: ['sonicBoom', 'thunderWave'], powerful: ['thunderbolt'] },
  seel: { basic: 'headbutt', special: ['growl'], powerful: ['takeDown', ['auroraBeam', 2], ['iceBeam', 2]] },
  gastly: { basic: 'astonish', special: ['lick', 'nightShade', ['hypnosis', 2]], powerful: ['sludge', ['shadowBall', 2]] },
  onix: { basic: 'rockThrow', special: ['harden', 'screech'], powerful: ['rockSlide', 'dig'] },
  krabby: { basic: 'viceGrip', special: ['harden', 'leer'], powerful: ['crabhammer'] },
  staryu: { basic: 'waterGun', special: ['harden', 'swift'], powerful: ['bubbleBeam', ['psychic', 2], ['hydroPump', 2]] },
  scyther: { basic: 'furyCutter', special: ['swordsDance', 'doubleTeam'], powerful: ['slash', 'wingAttack'] },
  magikarp: { basic: 'tackle', special: ['splash', ['leer', 2]], powerful: [['hydroPump', 2], ['hyperBeam', 2]] },
  lapras: { basic: 'waterGun', special: ['sing'], powerful: ['iceBeam', 'hydroPump'] },
  eevee: {
    basic: 'tackle', special: ['sandAttack', 'tailWhip'], powerful: ['takeDown'],
    forms: {
      vaporeon: { special: ['withdraw'], powerful: ['hydroPump', 'surf'] },
      jolteon: { special: ['thunderWave'], powerful: ['thunderbolt', 'thunder'] },
      flareon: { special: ['ember'], powerful: ['flamethrower', 'fireBlast'] },
    },
  },
  aerodactyl: { basic: 'bite', special: ['supersonic'], powerful: ['wingAttack', 'rockSlide'] },
  ekans: { basic: 'wrap', special: ['poisonSting', 'glare', 'leer'], powerful: ['acid', ['sludge', 2]] },
  koffing: { basic: 'tackle', special: ['smog', 'smokescreen'], powerful: ['sludge'] },
  sandshrew: { basic: 'scratch', special: ['sandAttack', ['swordsDance', 2]], powerful: ['slash', 'dig'] },
  nidoranf: { basic: 'scratch', special: ['poisonSting', 'tailWhip'], powerful: ['furySwipes', ['bodySlam', 3], ['earthquake', 3]] },
  nidoranm: { basic: 'hornAttack', special: ['poisonSting', 'leer'], powerful: ['furyAttack', ['earthquake', 3]] },
  vulpix: { basic: 'tackle', special: ['fireSpin', 'tailWhip'], powerful: ['flamethrower', ['fireBlast', 2]] },
  jigglypuff: { basic: 'pound', special: ['sing', 'defenseCurl'], powerful: ['doubleSlap', ['doubleEdge', 2]] },
  paras: { basic: 'scratch', special: ['stunSpore', 'leechLife', ['spore', 2]], powerful: ['slash'] },
  venonat: { basic: 'tackle', special: ['poisonPowder', 'supersonic', ['sleepPowder', 2]], powerful: ['psybeam'] },
  mankey: { basic: 'karateChop', special: ['leer', 'seismicToss'], powerful: ['thrash', ['crossChop', 2]] },
  machop: { basic: 'karateChop', special: ['focusEnergy', 'seismicToss'], powerful: ['submission', ['megaPunch', 2]] },
  bellsprout: { basic: 'vineWhip', special: ['poisonPowder', 'sleepPowder', 'stunSpore'], powerful: ['razorLeaf', ['acid', 2]] },
  ponyta: { basic: 'tackle', special: ['ember', 'tailWhip'], powerful: ['stomp', ['fireBlast', 2]] },
  farfetchd: { basic: 'peck', special: ['swordsDance', 'sandAttack'], powerful: ['slash'] },
  doduo: { basic: 'peck', special: ['growl'], powerful: ['drillPeck', ['triAttack', 2]] },
  grimer: { basic: 'pound', special: ['poisonGas', 'harden'], powerful: ['sludge'] },
  shellder: { basic: 'tackle', special: ['withdraw', 'supersonic'], powerful: ['clamp', ['auroraBeam', 2]] },
  drowzee: { basic: 'pound', special: ['hypnosis'], powerful: ['psybeam', ['psychic', 2]] },
  voltorb: { basic: 'tackle', special: ['sonicBoom', 'screech'], powerful: ['thunderbolt'] },
  exeggcute: { basic: 'barrage', special: ['hypnosis', 'reflect', 'stunSpore'], powerful: ['eggBomb', ['solarBeam', 2]] },
  cubone: { basic: 'boneClub', special: ['growl', 'leer'], powerful: ['bonemerang', ['thrash', 2]] },
  lickitung: { basic: 'wrap', special: ['lick', 'defenseCurl'], powerful: ['stomp', 'slam'] },
  rhyhorn: { basic: 'hornAttack', special: ['tailWhip'], powerful: ['stomp', ['earthquake', 2], ['rockSlide', 2]] },
  chansey: { basic: 'pound', special: ['sing', 'defenseCurl'], powerful: ['doubleEdge', 'eggBomb'] },
  tangela: { basic: 'vineWhip', special: ['absorb', 'sleepPowder', 'stunSpore'], powerful: ['slam'] },
  kangaskhan: { basic: 'cometPunch', special: ['leer'], powerful: ['megaPunch'] },
  horsea: { basic: 'bubble', special: ['smokescreen', 'leer'], powerful: ['bubbleBeam', ['hydroPump', 2]] },
  goldeen: { basic: 'peck', special: ['tailWhip', 'supersonic'], powerful: ['waterfall', ['furyAttack', 2]] },
  electabuzz: { basic: 'thundershock', special: ['thunderWave', 'leer'], powerful: ['thunderPunch', 'thunder'] },
  magmar: { basic: 'pound', special: ['ember', 'smokescreen'], powerful: ['firePunch', 'flamethrower'] },
  pinsir: { basic: 'viceGrip', special: ['harden', 'swordsDance'], powerful: ['slash'] },
  tauros: { basic: 'hornAttack', special: ['tailWhip', 'leer'], powerful: ['stomp', 'takeDown'] },
});

const entry = (e) => (Array.isArray(e) ? { move: e[0], minStage: e[1] } : { move: e, minStage: 1 });
const open = (list, stage) => list.map(entry).filter((e) => e.minStage <= stage).map((e) => e.move);

// One species' learnset: { basic, special: [ids], powerful: [ids] } (derived, frozen).
function learnsetOf(species) {
  const fam = FAMILY_MOVES[species.family];
  if (!fam) throw new Error(`No family moves for ${species.id} (family ${species.family})`);
  const form = fam.forms?.[species.id] ?? { special: [], powerful: [] };
  return Object.freeze({
    basic: fam.basic,
    special: Object.freeze([...open(fam.special, species.stage), ...form.special]),
    powerful: Object.freeze([...open(fam.powerful, species.stage), ...form.powerful]),
  });
}

// Every species of the game (the 129 of the roster + Eevee's three forms): 132 learnsets.
export const LEARNSET_SPECIES = Object.freeze([...POKEMON, ...EEVEE_FORMS]);
export const SPECIES_LEARNSETS = Object.freeze(Object.fromEntries(LEARNSET_SPECIES.map((s) => [s.id, learnsetOf(s)])));

export function learnsetFor(speciesId) {
  const l = SPECIES_LEARNSETS[speciesId];
  if (!l) throw new Error(`No learnset for ${speciesId}`);
  return l;
}

// May this species ever know `moveId` (in its slot)?
export function speciesCanKnow(speciesId, moveId) {
  const m = MOVE_DEFINITIONS[moveId];
  if (!m || m.slot === 'basic') return false;
  return learnsetFor(speciesId)[m.slot].includes(moveId);
}

// Type consistency (the learnset rule): a Special / Powerful move is of one of the species' types, or Normal, or
// one of its listed canonical crossovers (alsoTypes / alsoFamilies).
export function typeConsistent(species, move) {
  if (move.slot === 'basic') return true;
  return species.types.includes(move.type) || move.type === 'normal'
    || (move.alsoTypes ?? []).some((t) => species.types.includes(t)) || (move.alsoFamilies ?? []).includes(species.family);
}

// ---- TMs ------------------------------------------------------------------------------------------------
// A TM teaches ONE move, and only to a species whose learnset already holds it: a TM opens no new possibility,
// it is just another way in (SPECIES = possibilities). Not an item of data/items.js yet — a future content line.
export const TM_DEFINITIONS = Object.freeze({
  tm01: Object.freeze({ id: 'tm01', move: 'takeDown', pl: 'Płyta TM: Taran' }),
  tm02: Object.freeze({ id: 'tm02', move: 'bodySlam', pl: 'Płyta TM: Przygniecenie' }),
  tm03: Object.freeze({ id: 'tm03', move: 'thunderbolt', pl: 'Płyta TM: Piorun' }),
  tm04: Object.freeze({ id: 'tm04', move: 'flamethrower', pl: 'Płyta TM: Miotacz ognia' }),
  tm05: Object.freeze({ id: 'tm05', move: 'bubbleBeam', pl: 'Płyta TM: Bąbelkowy promień' }),
  tm06: Object.freeze({ id: 'tm06', move: 'earthquake', pl: 'Płyta TM: Trzęsienie ziemi' }),
  tm07: Object.freeze({ id: 'tm07', move: 'psychic', pl: 'Płyta TM: Moc umysłu' }),
  tm08: Object.freeze({ id: 'tm08', move: 'rockSlide', pl: 'Płyta TM: Lawina kamieni' }),
  tm09: Object.freeze({ id: 'tm09', move: 'thunderWave', pl: 'Płyta TM: Fala elektryczna' }),
  tm10: Object.freeze({ id: 'tm10', move: 'sleepPowder', pl: 'Płyta TM: Usypiający pyłek' }),
  tm11: Object.freeze({ id: 'tm11', move: 'seismicToss', pl: 'Płyta TM: Rzut sejsmiczny' }),
  tm12: Object.freeze({ id: 'tm12', move: 'reflect', pl: 'Płyta TM: Odbicie' }),
});

// TM id → the species ids it can teach (derived from the learnsets, never hand-listed).
export const TM_COMPATIBILITY = Object.freeze(Object.fromEntries(Object.values(TM_DEFINITIONS).map((tm) => [
  tm.id, Object.freeze(LEARNSET_SPECIES.filter((s) => speciesCanKnow(s.id, tm.move)).map((s) => s.id)),
])));
