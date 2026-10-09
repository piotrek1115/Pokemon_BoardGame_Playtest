// Polish presentation layer for the family tabletop: player-facing content by
// stable id (missions, events, trainers, Team Rocket plots, gyms, League,
// Hall of Fame) and formatters for rewards / effects. Ids, data files and the
// engine stay untouched; the developer harness keeps English.
// Canonical proper names stay: Pokémon, Kanto places, characters, Team Rocket,
// gym leaders, badge names.
import { QUESTS_BY_ID } from '../data/quests.js';
import { EVENTS_BY_ID } from '../data/events.js';
import { ROCKET_PLOTS_BY_ID } from '../data/rocketPlots.js';
import { TRAINER_ARCHETYPES_BY_ID } from '../data/trainers.js';

export const QUEST_PL = {
  'oak-water': { giver: 'Prof. Oak', title: 'Wodne badania', text: 'Złap dowolnego Pokémona wodnego.' },
  'oak-flying': { giver: 'Prof. Oak', title: 'Obserwacja ptaków', text: 'Złap dowolnego Pokémona latającego.' },
  'bug-catcher': { giver: 'Łapacz robaków Rick', title: 'Kolekcja robaków', text: 'Złap Pokémona typu robak.' },
  'oak-two': { giver: 'Prof. Oak', title: 'Dwóch nowych przyjaciół', text: 'Złap 2 Pokémony.' },
  'oak-rare': { giver: 'Prof. Oak', title: 'Rzadki okaz', text: 'Złap rzadkiego albo bardzo rzadkiego Pokémona.' },
  'jenny-trainer': { giver: 'Oficer Jenny', title: 'Dzień treningu', text: 'Wygraj walkę z trenerem.' },
  'joy-flawless': { giver: 'Siostra Joy', title: 'Nikt nie ucierpi', text: 'Wygraj walkę z trenerem tak, by żaden twój Pokémon nie zemdlał.' },
  'joy-evolve': { giver: 'Siostra Joy', title: 'Rośniemy!', text: 'Ewoluuj dowolnego Pokémona.' },
  'hiker-cave': { giver: 'Wędrowiec Marcos', title: 'W ciemność', text: 'Eksploruj jaskinię.' },
  'swimmer-sea': { giver: 'Pływak Luis', title: 'Morska bryza', text: 'Eksploruj morze albo plażę.' },
  'ranger-forest': { giver: 'Leśniczy', title: 'Leśni przyjaciele', text: 'Złap Pokémona w Viridian Forest.' },
  'scout-victory': { giver: 'Zwiadowca Ligi', title: 'Droga do Ligi', text: 'Eksploruj Victory Road.' },
  'collector-mtmoon': { giver: 'Kolekcjoner skamielin', title: 'Kamienie księżycowe', text: 'Eksploruj Mt. Moon.' },
  'bill-cottage': { giver: 'Bill', title: 'Zaproszenie od Billa', text: 'Odwiedź Bill’s Cottage.' },
  'fuji-lavender': { giver: 'Pan Fuji', title: 'Wizyta u pana Fuji', text: 'Idź do Lavender Town.' },
  'warden-safari': { giver: 'Strażnik Safari', title: 'Dzień na safari', text: 'Złap Pokémona w Safari Zone.' },
  'jenny-patrol': { giver: 'Oficer Jenny', title: 'Długi patrol', text: 'Dotrzyj do dalekiego miasta.' },
  'oak-field': { giver: 'Prof. Oak', title: 'Badania terenowe', text: 'Eksploruj w 3 różnych miejscach.' },
};

export const EVENT_PL = {
  'found-pokeball': { title: 'Błyszczące znalezisko!', text: 'Coś czerwono-białego błyszczy w trawie. To Poké Ball!' },
  'dropped-coins': { title: 'Dziura w kieszeni', text: 'Ojej! Moneta toczy się do rowu.' },
  'berry-bush': { title: 'Krzak jagód', text: 'Znajdujesz krzak pełen dojrzałych jagód Oran.', choices: ['Nakarm prowadzącego Pokémona (+2 ❤)', 'Sprzedaj jagody (+1 💰)'] },
  'rustling-grass': { title: 'Szelest w trawie', text: 'Coś dużego porusza się w wysokiej trawie…' },
  'friendly-hiker': { title: 'Zmęczony wędrowiec', text: 'Wędrowiec prosi o pomoc w niesieniu ciężkiego plecaka.', choices: ['Pomóż mu (+2 💰, prowadzący −1 ❤)', 'Pomachaj i idź dalej'] },
  'sudden-rain': { title: 'Nagła ulewa', text: 'Leje jak z cebra! Czekasz pod drzewem i tracisz czas.' },
  shortcut: { title: 'Sekretny skrót', text: 'Miejscowe dziecko pokazuje ci ukrytą ścieżkę.' },
  'nurse-joy': { title: 'Siostra Joy na obchodzie', text: 'Siostra Joy sprawdza, jak czują się twoje Pokémony.' },
  'lost-pokemon': { title: 'Zagubiony Pokémon', text: 'Mały Pokémon wygląda na zagubionego i trochę przestraszonego.', choices: ['Pomóż mu znaleźć rodzinę (+1 💰)', 'Spróbuj się zaprzyjaźnić (dziki Pokémon)'] },
  'old-man-deal': { title: 'Staruszek z workiem', text: '„Poké Ball na zbyciu, młody trenerze? Tylko 1 moneta!”', choices: ['Kup Poké Ball (−1 💰)', 'Nie, dziękuję'] },
};

export const TRAINER_PL = {
  'bug-catcher': { name: 'Łapacz robaków', icon: '🐛' }, youngster: { name: 'Młodzik', icon: '🧢' }, lass: { name: 'Dziewczyna', icon: '🎀' },
  hiker: { name: 'Wędrowiec', icon: '🥾' }, fisherman: { name: 'Wędkarz', icon: '🎣' }, sailor: { name: 'Marynarz', icon: '⚓' },
  camper: { name: 'Obozowicz', icon: '⛺' }, picnicker: { name: 'Piknikowiczka', icon: '🧺' }, scientist: { name: 'Naukowiec', icon: '🔬' },
  psychic: { name: 'Medium', icon: '🔮' }, channeler: { name: 'Wróżka', icon: '🕯️' }, biker: { name: 'Motocyklista', icon: '🏍️' },
  'bird-keeper': { name: 'Hodowca ptaków', icon: '🪶' }, swimmer: { name: 'Pływak', icon: '🏊' },
};

export const DIFFICULTY_PL = { easy: { name: 'łatwy', stars: '★☆☆' }, medium: { name: 'średni', stars: '★★☆' }, hard: { name: 'trudny', stars: '★★★' } };

export const PLOT_PL = {
  'tower-ghosts': { title: 'Duchy z Pokémon Tower', flavor: 'Buu! To tylko Jessie w prześcieradle… i Meowth w przebraniu ducha.', text: 'Eksploracja w Lavender Town trafia tylko na Team Rocket.' },
  'fossil-thieves': { title: 'Złodzieje skamielin', flavor: 'James wykopuje Kamienie Księżycowe i skamieliny na sprzedaż.', text: 'Eksploracja w Mt. Moon trafia tylko na Team Rocket.' },
  'safari-poachers': { title: 'Kłusownicy w Safari', flavor: 'Wielka sieć Meowtha rozciągnięta nad wysoką trawą.', text: 'W Safari Zone nie da się łapać, dopóki ktoś nie pokona Team Rocket.' },
  'route9-ambush': { title: 'Zasadzka na Route 9', flavor: '„Przygotujcie się na kłopoty!” — zza krzaków.', text: 'Wejście na Route 9 ze zdrowym Pokémonem zaczyna walkę z Team Rocket.' },
  'diglett-cave-in': { title: 'Zawał w Diglett’s Cave', flavor: 'Wielkie wiertło Rocketów zawaliło tunel.', text: 'Nikt nie wejdzie do Diglett’s Cave. Wyzwij Team Rocket z Route 2 albo Route 11.' },
  'route6-roadblock': { title: 'Blokada na Route 6', flavor: '„Bramka” Team Rocket na środku drogi.', text: 'Wejście na Route 6 ze zdrowym Pokémonem zaczyna walkę z Team Rocket.' },
  'cycling-road': { title: 'Blokada Cycling Road', flavor: 'Dawny gang motocyklowy Jessie zaparkował w poprzek Cycling Road.', text: 'Droga między Route 16 a Route 17 jest zamknięta. Wyzwij Team Rocket z Route 16 albo Route 17.' },
  'route22-pitfall': { title: 'Dół na Route 22', flavor: '„Wykopaliśmy dziurę!” — pułapka ukryta pod liśćmi.', text: 'Wejście na Route 22 to wpadnięcie do dołu: twoja tura się kończy.' },
  'balloon-getaway': { title: 'Team Rocket ucieka!', flavor: 'Balon-Meowth odlatuje z workiem skradzionych Poké Balli.', text: 'Na początku każdego tygodnia balon przesuwa się o 1 pole wzdłuż strzałki i ląduje na Route 15. Eksploracja tam, gdzie jest balon, trafia tylko na Team Rocket.' },
};

export const GYM_NOTE_PL = { pewter: 'tata Brocka', cerulean: 'siostry Misty: Daisy, Violet i Lily' };
export const LEADER_PL = { 'Sensational Sisters': 'Sensacyjne Siostry' };
export const LEAGUE_STAGE_PL = { eliteFour: 'Elitarna Czwórka', lance: 'Mistrz Lance' };

export const HOF_PL = {
  pokedexMaster: { title: 'Mistrz Pokédexu', measure: 'najwięcej złapanych gatunków' },
  rocketBuster: { title: 'Pogromca Rocketów', measure: 'najwięcej pokonanych spisków' },
  missionAce: { title: 'As misji', measure: 'najwięcej wykonanych misji' },
  gymHero: { title: 'Bohater sal', measure: 'najwięcej odznak' },
};

export const DECIDED_BY_PL = { badges: 'liczba odznak', ribbon: 'Wstęga Elitarnej Czwórki', caught: 'liczba złapanych gatunków', shared: 'remis — wspólne zwycięstwo' };

// ---- lookups with English fallback -------------------------------------------------

export function questPl(id) {
  const q = QUESTS_BY_ID[id];
  return { ...q, ...(QUEST_PL[id] ?? {}) };
}

export function eventPl(id) {
  const e = EVENTS_BY_ID[id];
  const pl = EVENT_PL[id] ?? {};
  return { ...e, title: pl.title ?? e.title, text: pl.text ?? e.text, choices: (e.choices ?? []).map((c, i) => ({ ...c, label: pl.choices?.[i] ?? c.label })) };
}

export function plotPl(id) {
  const p = ROCKET_PLOTS_BY_ID[id];
  return { ...p, ...(PLOT_PL[id] ?? {}) };
}

// "Youngster Joey" → { name: 'Młodzik Joey', icon }
export function trainerPl(trainer) {
  const arch = TRAINER_ARCHETYPES_BY_ID[trainer.archetype];
  const pl = TRAINER_PL[trainer.archetype];
  if (!arch || !pl) return { name: trainer.name, icon: '🧢' };
  return { name: `${pl.name} ${trainer.name.slice(arch.name.length + 1)}`, icon: pl.icon };
}

const THING = {
  money: (n) => `💰${n}`,
  pokeballs: (n) => `${n} × Poké Ball`, pokeball: (n) => `${n} × Poké Ball`,
  superball: (n) => `${n} × Super Ball`, potion: (n) => `${n} × Potion`, revive: (n) => `${n} × Revive`,
  thunderstone: (n) => `${n} × Thunder Stone`, waterstone: (n) => `${n} × Water Stone`, firestone: (n) => `${n} × Fire Stone`,
  leafstone: (n) => `${n} × Leaf Stone`, moonstone: (n) => `${n} × Moon Stone`,
  stars: (n) => `⭐${n}`,
};

export function thingPl(type, amount = 1) {
  return (THING[type] ?? ((n) => `${n} × ${type}`))(amount);
}

export function rewardPl(reward) {
  return reward.map((r) => thingPl(r.type, r.amount)).join(' + ');
}

// What an event's effects do, in family language.
export function effectsPl(effects) {
  return effects.map((e) => {
    switch (e.type) {
      case 'money': return e.amount >= 0 ? `+💰${e.amount}` : `−💰${-e.amount}`;
      case 'pokeballs': return `${e.amount >= 0 ? '+' : '−'}${Math.abs(e.amount)} Poké Ball`;
      case 'healLead': return `prowadzący +${e.amount} ❤`;
      case 'healTeam': return `cała drużyna +${e.amount} ❤`;
      case 'damageLead': return `prowadzący −${e.amount} ❤`;
      case 'actions': return e.amount >= 0 ? `+${e.amount} akcja` : `−${-e.amount} akcja`;
      case 'wildEncounter': return 'dziki Pokémon!';
      case 'trainerBattle': return 'walka z trenerem!';
      default: return e.type;
    }
  }).join(', ');
}

// Engine refusal messages → Polish (family toast); unknown ones get a generic line.
const ERRORS_PL = [
  [/Not your turn|AI's turn/i, 'Teraz nie twoja kolej.'],
  [/Can't buy|afford/i, 'Za mało pieniędzy.'],
  [/can't be caught/i, 'Tego Pokémona nie można złapać.'],
  [/No (Poké Balls|.*s left)/i, 'Brak balli.'],
  [/Choose who gets the Growth first/i, 'Najpierw wybierz, kto dostaje punkt treningu.'],
  [/needs (\d+) Growth \(has (\d+)\)/i, 'Ten Pokémon potrzebuje więcej punktów treningu ⭐.'],
  [/needs a (\w+ Stone)/i, 'Do tej ewolucji potrzebny jest kamień ewolucji (kupisz go w Poké Stopie).'],
  [/one evolution per turn/i, 'Jedna ewolucja na turę — ten Pokémon ewoluuje w następnej turze.'],
];
export function errorPl(message) {
  for (const [re, pl] of ERRORS_PL) if (re.test(message ?? '')) return pl;
  return 'Tego nie można teraz zrobić.';
}
