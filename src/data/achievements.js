// One Kanto day 14.10 — ACHIEVEMENTS (rules.achievements 'v1', ACH-01 / ACH-02; audit of M02-5, SBX-12, WIN-02,
// WIN-04, SYS-19): trophies for the WHOLE game — not gym badges (they stay in the badge case), not the Hall of
// Fame (the end screen's titles). ONE registry. Each is earned once per player, read from the game state (the
// engine's own counters — never a UI animation), so a reload or a replay gives the same trophies.
//   measure   what is counted (engine/achievementEngine.js MEASURES)
//   target    how much of it
//   chainId   the chain it belongs to (one measure, tiers 1 / 2 …): a chain scores ONLY its highest earned tier —
//             FIRST WIN 10 + HAT TRICK 20 = 20, not 30 (ChatGPT review 14.10); every earned trophy stays visible
//   tier      its step in the chain
//   points    PROVISIONAL — for a future score (WIN-NEW); the end of the game does not change today
// Names and numbers are PROPOSALS for Piotr (balance data, not rules).
export const ACHIEVEMENTS = Object.freeze([
  { id: 'first-win', chainId: 'pvp-wins', category: 'pvp', name: 'FIRST WIN', pl: 'Pierwsza wygrana', text: 'Wygraj pierwszy pojedynek z innym graczem.', measure: 'pvpWins', target: 1, tier: 1, points: 10, icon: '⚔️' },
  { id: 'hat-trick', chainId: 'pvp-wins', category: 'pvp', name: 'HAT TRICK', pl: 'Hat trick', text: 'Trzy zaliczone wygrane pojedynki.', measure: 'pvpWins', target: 3, tier: 2, points: 20, icon: '⚔️' },
  { id: 'great-trade', chainId: 'trades', category: 'trading', name: 'GREAT TRADE', pl: 'Pierwsza wymiana', text: 'Wymień się Pokémonem z innym graczem.', measure: 'trades', target: 1, tier: 1, points: 10, icon: '🔄' },
  { id: 'oak-is-proud', chainId: 'oak-jobs', category: 'research', name: 'OAK IS PROUD', pl: 'Oak jest dumny', text: 'Ukończ pięć zadań badawczych u Profesora Oaka.', measure: 'oakJobs', target: 5, tier: 1, points: 15, icon: '🔬' },
  { id: 'rocket-hates-it', chainId: 'rocket-plots', category: 'rocket', name: 'ROCKET HATES IT', pl: 'Rocket tego nie znosi', text: 'Pokonaj trzy spiski Team Rocket.', measure: 'rocketPlots', target: 3, tier: 1, points: 15, icon: '🎈' },
  { id: 'explorer', chainId: 'places', category: 'exploration', name: 'EXPLORER', pl: 'Odkrywca', text: 'Odwiedź dziesięć różnych miejsc.', measure: 'places', target: 10, tier: 1, points: 10, icon: '📍' },
  { id: 'globetrotter', chainId: 'places', category: 'exploration', name: 'GLOBETROTTER', pl: 'Obieżyświat', text: 'Odwiedź dwadzieścia pięć różnych miejsc.', measure: 'places', target: 25, tier: 2, points: 20, icon: '📍' },
  { id: 'collector', chainId: 'collection', category: 'collection', name: 'POKÉMON COLLECTOR', pl: 'Kolekcjoner', text: 'Miej w Pokédexie piętnaście złapanych gatunków.', measure: 'species', target: 15, tier: 1, points: 15, icon: '📕' },
  { id: 'evolution-expert', chainId: 'evolutions', category: 'collection', name: 'EVOLUTION EXPERT', pl: 'Ekspert ewolucji', text: 'Pięć ewolucji Twoich Pokémonów.', measure: 'evolutions', target: 5, tier: 1, points: 15, icon: '✨' },
  { id: 'quest-hunter', chainId: 'quests', category: 'quests', name: 'QUEST HUNTER', pl: 'Łowca zadań', text: 'Ukończ pięć różnych zadań z księgi.', measure: 'quests', target: 5, tier: 1, points: 15, icon: '📜' },
  { id: 'champion', chainId: 'champion', category: 'champion', name: 'CHAMPION', pl: 'Mistrz Ligi', text: 'Zostań Mistrzem Ligi Pokémon.', measure: 'champion', target: 1, tier: 1, points: 30, icon: '👑' },
]);

// Bonus 14.10 (rules.achievements 'v2', the next DEV ruleset): the 11 above + 8 trophies of the EARLY and MIDDLE
// game, each from a real engine counter (never a tap): the first wild catch, the first places, a team of 4, the
// first Research Job back, the first win over Team Rocket, the first quest, the first Super Rare met, the first
// Pokémon caught on the Old Rod. Chains get a lower tier (FIRST STEPS → EXPLORER → GLOBETROTTER, RESEARCH
// ASSISTANT → OAK IS PROUD, QUEST STARTER → QUEST HUNTER) — still one score per chain: its highest tier earned.
// 'v1' games (dev-1410) keep the list above exactly.
const by = (id) => ACHIEVEMENTS.find((a) => a.id === id);
export const ACHIEVEMENTS_V2 = Object.freeze([
  { id: 'first-catch', chainId: 'wild-catches', category: 'collection', name: 'FIRST CATCH', pl: 'Pierwsze złapanie', text: 'Złap pierwszego dzikiego Pokémona.', measure: 'wildCatches', target: 1, tier: 1, points: 5, icon: '🎯' },
  { id: 'first-steps', chainId: 'places', category: 'exploration', name: 'FIRST STEPS', pl: 'Pierwsze kroki', text: 'Odwiedź trzy różne miejsca.', measure: 'places', target: 3, tier: 1, points: 5, icon: '👣' },
  { ...by('explorer'), tier: 2 },
  { ...by('globetrotter'), tier: 3 },
  { id: 'team-builder', chainId: 'team-size', category: 'collection', name: 'TEAM BUILDER', pl: 'Drużyna', text: 'Miej w drużynie cztery Pokémony.', measure: 'teamSize', target: 4, tier: 1, points: 5, icon: '👥' },
  { id: 'research-assistant', chainId: 'oak-jobs', category: 'research', name: 'RESEARCH ASSISTANT', pl: 'Asystent Oaka', text: 'Pierwsze zadanie badawcze u Profesora Oaka ukończone.', measure: 'oakJobs', target: 1, tier: 1, points: 5, icon: '🔬' },
  { ...by('oak-is-proud'), tier: 2 },
  { id: 'rocket-trouble', chainId: 'rocket-wins', category: 'rocket', name: 'ROCKET TROUBLE', pl: 'Kłopoty dla Rocket', text: 'Pierwsza wygrana walka z Team Rocket.', measure: 'rocketWins', target: 1, tier: 1, points: 5, icon: '🎈' },
  by('rocket-hates-it'),
  { id: 'quest-starter', chainId: 'quests', category: 'quests', name: 'QUEST STARTER', pl: 'Pierwsze zadanie', text: 'Ukończ pierwsze zadanie z księgi.', measure: 'quests', target: 1, tier: 1, points: 5, icon: '📜' },
  { ...by('quest-hunter'), tier: 2 },
  { id: 'rare-discovery', chainId: 'super-rare', category: 'exploration', name: 'RARE DISCOVERY', pl: 'Rzadkie odkrycie', text: 'Spotkaj pierwszego bardzo rzadkiego dzikiego Pokémona.', measure: 'superRareMet', target: 1, tier: 1, points: 10, icon: '◆' },
  { id: 'fishing-rookie', chainId: 'fishing', category: 'fishing', name: 'FISHING ROOKIE', pl: 'Młody wędkarz', text: 'Złap pierwszego Pokémona na Starą wędkę.', measure: 'fishCaught', target: 1, tier: 1, points: 10, icon: '🎣' },
  by('first-win'), by('hat-trick'), by('great-trade'), by('collector'), by('evolution-expert'), by('champion'),
].map((a) => Object.freeze(a)));
export const ACHIEVEMENT_SETS = Object.freeze({ v1: ACHIEVEMENTS, v2: ACHIEVEMENTS_V2 });
// Every trophy of every set (a note on the table finds its name by id).
export const ALL_ACHIEVEMENTS = Object.freeze([...ACHIEVEMENTS, ...ACHIEVEMENTS_V2.filter((a) => !ACHIEVEMENTS.some((b) => b.id === a.id))]);

export const ACHIEVEMENT_CATEGORIES_PL = { pvp: 'Pojedynki', trading: 'Wymiana', research: 'Badania', rocket: 'Team Rocket', exploration: 'Podróże', collection: 'Kolekcja', quests: 'Zadania', fishing: 'Wędkowanie', champion: 'Liga' };
