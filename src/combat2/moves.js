// COMBAT 2.0 (from the isolated prototype, Build 3.5 night shift stage 7; used by the MVP — rules.combatMoves 'mvp1', dev-1510-combat).
// The data modules moved here from the isolated prototype (its resolver / AI / simulation stay outside the game).
// Design: docs/design/COMBAT_2_0.md.
//
// MOVE_SLOTS        the three kinds of move every Pokémon may have:
//                     basic     — always available; today's attack (d6 + attack + type), the species' attack type
//                     special   — once per battle; the same roll + one small trick (a status, drain, guard …)
//                     powerful  — once per battle; the same roll +2, but it misses on die faces 1–2
// MOVE_EFFECTS      the CLOSED list of effect kinds (a new kind is a design decision, not data)
// MOVE_DEFINITIONS  every move of the catalogue: id, English name, Polish name, slot, type, effect
import { TYPE_IDS } from '../data/types.js';
import { STATUS_IDS, STATUS_DEFINITIONS } from './statuses.js';

export const MOVE_SLOTS = Object.freeze({
  basic: Object.freeze({ pl: 'Atak', usesPerBattle: null, missFaces: Object.freeze([1]), bonus: 0 }),
  special: Object.freeze({ pl: 'Ruch specjalny', usesPerBattle: 1, missFaces: Object.freeze([1]), bonus: 0 }),
  powerful: Object.freeze({ pl: 'Potężny ruch', usesPerBattle: 1, missFaces: Object.freeze([1, 2]), bonus: 2 }),
});
export const SLOT_IDS = Object.freeze(Object.keys(MOVE_SLOTS));

// Each kind: the slots it may sit in and the legal values of its parameters.
export const MOVE_EFFECTS = Object.freeze({
  none: Object.freeze({ slots: ['basic'], params: {} }), // the plain attack
  power: Object.freeze({ slots: ['powerful'], params: {} }), // the slot's +2 / misses on 1–2, nothing else
  status: Object.freeze({ slots: ['special'], params: { status: STATUS_IDS } }), // on a hit: the status
  drain: Object.freeze({ slots: ['special'], params: {} }), // on a hit: heals the damage dealt
  guard: Object.freeze({ slots: ['special'], params: { reduce: [1] } }), // the next attack against the user −1
  boost: Object.freeze({ slots: ['special'], params: { bonus: [1] } }), // +1 on this attack's total
  fixed: Object.freeze({ slots: ['special'], params: { amount: [1] } }), // no roll: exactly 1 heart, ignores types
});
export const EFFECT_KINDS = Object.freeze(Object.keys(MOVE_EFFECTS));

const def = (id, name, pl, slot, type, effect, extra = {}) => Object.freeze({ id, name, pl, slot, type, effect: Object.freeze(effect), ...extra });
const basic = (id, name, pl) => def(id, name, pl, 'basic', null, { kind: 'none' });
const status = (id, name, pl, type, st, extra) => def(id, name, pl, 'special', type, { kind: 'status', status: st }, extra);
const special = (id, name, pl, type, effect, extra) => def(id, name, pl, 'special', type, effect, extra);
const powerful = (id, name, pl, type, extra) => def(id, name, pl, 'powerful', type, { kind: 'power' }, extra);

// `type: null` (basic moves only) = the user's attack type (data/pokemon.js attackTypeOf) — today's rule.
// `alsoTypes` / `alsoFamilies`: the few canonical crossovers allowed beyond „the species' types or normal”
// (powders on Bug Pokémon, Hypnosis on Gastly / Poliwag, Leech Life on Zubat, Lick on Lickitung, Psybeam on Venonat).
const LIST = [
  // ---- BASIC (always available; the name is flavour — the attack is today's Atakuj) ----
  basic('tackle', 'Tackle', 'Szarża'),
  basic('scratch', 'Scratch', 'Drapnięcie'),
  basic('pound', 'Pound', 'Klepnięcie'),
  basic('peck', 'Peck', 'Dziobnięcie'),
  basic('gust', 'Gust', 'Podmuch'),
  basic('bite', 'Bite', 'Ugryzienie'),
  basic('vineWhip', 'Vine Whip', 'Bicz z pnączy'),
  basic('leafage', 'Leafage', 'Liście'),
  basic('waterGun', 'Water Gun', 'Wodny strzał'),
  basic('bubble', 'Bubble', 'Bąbelki'),
  basic('thundershock', 'Thundershock', 'Iskra'),
  basic('confusion', 'Confusion', 'Konfuzja'),
  basic('astonish', 'Astonish', 'Straszenie'),
  basic('hornAttack', 'Horn Attack', 'Atak rogiem'),
  basic('karateChop', 'Karate Chop', 'Cios karate'),
  basic('rockThrow', 'Rock Throw', 'Rzut kamieniem'),
  basic('boneClub', 'Bone Club', 'Cios kością'),
  basic('wrap', 'Wrap', 'Owinięcie'),
  basic('headbutt', 'Headbutt', 'Główka'),
  basic('viceGrip', 'Vice Grip', 'Szczypce'),
  basic('furyCutter', 'Fury Cutter', 'Seria cięć'),
  basic('barrage', 'Barrage', 'Ostrzał'),
  basic('cometPunch', 'Comet Punch', 'Seria ciosów'),

  // ---- SPECIAL: a status on a hit ----
  status('poisonSting', 'Poison Sting', 'Trujące żądło', 'poison', 'poison'),
  status('poisonPowder', 'Poison Powder', 'Trujący pyłek', 'poison', 'poison'),
  status('poisonGas', 'Poison Gas', 'Trujący gaz', 'poison', 'poison'),
  status('smog', 'Smog', 'Smog', 'poison', 'poison'),
  status('ember', 'Ember', 'Żar', 'fire', 'burn'),
  status('fireSpin', 'Fire Spin', 'Ognisty wir', 'fire', 'burn'),
  status('thunderWave', 'Thunder Wave', 'Fala elektryczna', 'electric', 'paralysis'),
  status('stunSpore', 'Stun Spore', 'Paraliżujący pyłek', 'grass', 'paralysis', { alsoTypes: ['bug'] }),
  status('glare', 'Glare', 'Groźne spojrzenie', 'normal', 'paralysis'),
  status('lick', 'Lick', 'Liźnięcie', 'ghost', 'paralysis', { alsoFamilies: ['lickitung'] }),
  status('sleepPowder', 'Sleep Powder', 'Usypiający pyłek', 'grass', 'sleep', { alsoTypes: ['bug'] }),
  status('spore', 'Spore', 'Zarodniki', 'grass', 'sleep'),
  status('sing', 'Sing', 'Kołysanka', 'normal', 'sleep'),
  status('hypnosis', 'Hypnosis', 'Hipnoza', 'psychic', 'sleep', { alsoFamilies: ['gastly', 'poliwag'] }),
  // ---- SPECIAL: drain / guard / boost / fixed ----
  special('absorb', 'Absorb', 'Wysysanie', 'grass', { kind: 'drain' }),
  special('leechLife', 'Leech Life', 'Pijawka', 'bug', { kind: 'drain' }, { alsoFamilies: ['zubat'] }),
  special('withdraw', 'Withdraw', 'Skorupa', 'water', { kind: 'guard', reduce: 1 }),
  special('harden', 'Harden', 'Utwardzenie', 'normal', { kind: 'guard', reduce: 1 }),
  special('defenseCurl', 'Defense Curl', 'Zwinięcie w kulkę', 'normal', { kind: 'guard', reduce: 1 }),
  special('growl', 'Growl', 'Warknięcie', 'normal', { kind: 'guard', reduce: 1 }),
  special('sandAttack', 'Sand Attack', 'Piasek w oczy', 'normal', { kind: 'guard', reduce: 1 }),
  special('smokescreen', 'Smokescreen', 'Zasłona dymna', 'normal', { kind: 'guard', reduce: 1 }),
  special('stringShot', 'String Shot', 'Lepka nić', 'bug', { kind: 'guard', reduce: 1 }),
  special('reflect', 'Reflect', 'Odbicie', 'psychic', { kind: 'guard', reduce: 1 }),
  special('supersonic', 'Supersonic', 'Ultradźwięki', 'normal', { kind: 'guard', reduce: 1 }),
  special('doubleTeam', 'Double Team', 'Sobowtóry', 'normal', { kind: 'guard', reduce: 1 }),
  special('splash', 'Splash', 'Plusk', 'normal', { kind: 'guard', reduce: 1 }),
  special('quickAttack', 'Quick Attack', 'Szybki atak', 'normal', { kind: 'boost', bonus: 1 }),
  special('focusEnergy', 'Focus Energy', 'Skupienie', 'normal', { kind: 'boost', bonus: 1 }),
  special('swordsDance', 'Swords Dance', 'Taniec mieczy', 'normal', { kind: 'boost', bonus: 1 }),
  special('leer', 'Leer', 'Groźny wzrok', 'normal', { kind: 'boost', bonus: 1 }),
  special('tailWhip', 'Tail Whip', 'Machnięcie ogonem', 'normal', { kind: 'boost', bonus: 1 }),
  special('screech', 'Screech', 'Pisk', 'normal', { kind: 'boost', bonus: 1 }),
  special('nightShade', 'Night Shade', 'Nocny cień', 'ghost', { kind: 'fixed', amount: 1 }),
  special('seismicToss', 'Seismic Toss', 'Rzut sejsmiczny', 'fighting', { kind: 'fixed', amount: 1 }),
  special('sonicBoom', 'Sonic Boom', 'Grom dźwiękowy', 'normal', { kind: 'fixed', amount: 1 }),
  special('swift', 'Swift', 'Gwiezdny pocisk', 'normal', { kind: 'fixed', amount: 1 }),

  // ---- POWERFUL (+2, misses on 1–2) ----
  powerful('takeDown', 'Take Down', 'Taran', 'normal'),
  powerful('doubleEdge', 'Double-Edge', 'Wielki taran', 'normal'),
  powerful('hyperFang', 'Hyper Fang', 'Mega kieł', 'normal'),
  powerful('hyperBeam', 'Hyper Beam', 'Hiperpromień', 'normal'),
  powerful('skullBash', 'Skull Bash', 'Twarda czaszka', 'normal'),
  powerful('stomp', 'Stomp', 'Tupnięcie', 'normal'),
  powerful('furySwipes', 'Fury Swipes', 'Wściekłe pazury', 'normal'),
  powerful('furyAttack', 'Fury Attack', 'Wściekłe dźgnięcia', 'normal'),
  powerful('payDay', 'Pay Day', 'Deszcz monet', 'normal'),
  powerful('eggBomb', 'Egg Bomb', 'Jajeczna bomba', 'normal'),
  powerful('slam', 'Slam', 'Trzaśnięcie', 'normal'),
  powerful('slash', 'Slash', 'Cięcie', 'normal'),
  powerful('megaPunch', 'Mega Punch', 'Mega cios', 'normal'),
  powerful('doubleSlap', 'Double Slap', 'Podwójne klepnięcie', 'normal'),
  powerful('bodySlam', 'Body Slam', 'Przygniecenie', 'normal'),
  powerful('triAttack', 'Tri Attack', 'Potrójny atak', 'normal'),
  powerful('thrash', 'Thrash', 'Szał', 'normal'),
  powerful('flamethrower', 'Flamethrower', 'Miotacz ognia', 'fire'),
  powerful('fireBlast', 'Fire Blast', 'Wielki ogień', 'fire'),
  powerful('firePunch', 'Fire Punch', 'Ognisty cios', 'fire'),
  powerful('bubbleBeam', 'Bubble Beam', 'Bąbelkowy promień', 'water'),
  powerful('hydroPump', 'Hydro Pump', 'Hydropompa', 'water'),
  powerful('surf', 'Surf', 'Fala', 'water'),
  powerful('crabhammer', 'Crabhammer', 'Krabi młot', 'water'),
  powerful('waterfall', 'Waterfall', 'Wodospad', 'water'),
  powerful('clamp', 'Clamp', 'Zacisk', 'water'),
  powerful('thunderbolt', 'Thunderbolt', 'Piorun', 'electric'),
  powerful('thunder', 'Thunder', 'Grom', 'electric'),
  powerful('thunderPunch', 'Thunder Punch', 'Elektryczny cios', 'electric'),
  powerful('razorLeaf', 'Razor Leaf', 'Ostre liście', 'grass'),
  powerful('solarBeam', 'Solar Beam', 'Promień słońca', 'grass'),
  powerful('petalDance', 'Petal Dance', 'Taniec płatków', 'grass'),
  powerful('iceBeam', 'Ice Beam', 'Lodowy promień', 'ice'),
  powerful('auroraBeam', 'Aurora Beam', 'Promień zorzy', 'ice'),
  powerful('submission', 'Submission', 'Zapasy', 'fighting'),
  powerful('crossChop', 'Cross Chop', 'Krzyżowy cios', 'fighting'),
  powerful('sludge', 'Sludge', 'Szlam', 'poison'),
  powerful('acid', 'Acid', 'Kwas', 'poison'),
  powerful('dig', 'Dig', 'Kopanie', 'ground'),
  powerful('earthquake', 'Earthquake', 'Trzęsienie ziemi', 'ground'),
  powerful('bonemerang', 'Bonemerang', 'Kościany bumerang', 'ground'),
  powerful('wingAttack', 'Wing Attack', 'Cios skrzydłem', 'flying'),
  powerful('drillPeck', 'Drill Peck', 'Wiertło', 'flying'),
  powerful('skyAttack', 'Sky Attack', 'Atak z nieba', 'flying'),
  powerful('psybeam', 'Psybeam', 'Psychopromień', 'psychic', { alsoFamilies: ['venonat'] }),
  powerful('psychic', 'Psychic', 'Moc umysłu', 'psychic'),
  powerful('twineedle', 'Twineedle', 'Podwójne żądło', 'bug'),
  powerful('pinMissile', 'Pin Missile', 'Grad igieł', 'bug'),
  powerful('rockSlide', 'Rock Slide', 'Lawina kamieni', 'rock'),
  powerful('shadowBall', 'Shadow Ball', 'Kula cienia', 'ghost'),
];

export const MOVE_DEFINITIONS = Object.freeze(Object.fromEntries(LIST.map((m) => [m.id, m])));
export const MOVE_IDS = Object.freeze(LIST.map((m) => m.id));

export function getMove(id) {
  const m = MOVE_DEFINITIONS[id];
  if (!m) throw new Error(`Unknown move: ${id}`);
  return m;
}

// Why this move definition is invalid (null when it is valid). The tests run it on every move.
export function moveProblem(m) {
  if (!m || typeof m !== 'object') return 'not an object';
  if (!/^[a-z][A-Za-z]*$/.test(m.id)) return `bad id ${m.id}`;
  if (typeof m.name !== 'string' || !m.name || typeof m.pl !== 'string' || !m.pl) return `${m.id}: names`;
  if (!MOVE_SLOTS[m.slot]) return `${m.id}: unknown slot ${m.slot}`;
  if (m.slot === 'basic' ? m.type !== null : !TYPE_IDS.includes(m.type)) return `${m.id}: bad type ${m.type}`;
  const kind = MOVE_EFFECTS[m.effect?.kind];
  if (!kind) return `${m.id}: unknown effect ${m.effect?.kind}`;
  if (!kind.slots.includes(m.slot)) return `${m.id}: effect ${m.effect.kind} not allowed in slot ${m.slot}`;
  for (const key of Object.keys(m.effect)) if (key !== 'kind' && !Object.hasOwn(kind.params, key)) return `${m.id}: unknown parameter ${key}`;
  for (const [key, legal] of Object.entries(kind.params)) if (!legal.includes(m.effect[key])) return `${m.id}: ${key} = ${m.effect[key]} not in ${legal}`;
  for (const t of m.alsoTypes ?? []) if (!TYPE_IDS.includes(t)) return `${m.id}: alsoTypes ${t}`;
  return null;
}

// The kid-simple one-sentence card text (Polish), generated from the effect — never hand-typed per move.
export function moveText(m) {
  const e = m.effect;
  switch (e.kind) {
    case 'none': return 'Zwykły atak.';
    case 'power': return 'Atak +2, ale pudłuje na 1 i 2. Raz na walkę.';
    case 'status': return `Atak; gdy trafi — ${STATUS_DEFINITIONS[e.status].onHitPl}. Raz na walkę.`;
    case 'drain': return 'Atak; odzyskuje tyle serc, ile zada. Raz na walkę.';
    case 'guard': return `Atak; następny cios w niego zada ${e.reduce} mniej. Raz na walkę.`;
    case 'boost': return `Atak +${e.bonus}. Raz na walkę.`;
    case 'fixed': return `Bez rzutu: zawsze ${e.amount} serce. Raz na walkę.`;
    default: throw new Error(`no text for ${e.kind}`);
  }
}
