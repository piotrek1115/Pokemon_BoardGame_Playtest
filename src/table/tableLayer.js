// The Table Layer: cards placed on top of the board for every interaction —
// explore, wild encounters and every battle (trainer, Team Rocket, gym,
// League) card vs card with the DQ-71 switch, catching, the Rocket plot card
// and Meowth's loot, the Poké Stop tray, event cards, the League intermission
// and the final results. Pure HTML strings; all copy in Polish.
import { getSpecies } from '../data/pokemon.js';
import { BIOMES } from '../data/biomes.js';
import { GYMS_BY_ID, LEAGUE } from '../data/gyms.js';
import { getLocation } from '../data/locations.js';
import { getLegalActions, restHeal } from '../engine/turnEngine.js';
import { currentPlayer, getLead } from '../engine/gameState.js';
import { currentOpponent, freeBattleHealing, healedThisBattle, moveOf, usesSignature } from '../engine/combatEngine.js';
import { catchDieChance, escapeColour, sureGreatBall, throwDie, vigilanceSteps } from '../engine/captureEngine.js';
import { usesTemperament } from '../engine/temperamentEngine.js';
import { TEMPERAMENT_PL, temperamentOf } from '../data/temperament.js';
import { chainOpponents, gymChallengeBlocker, gymHere, gymRewardItem, gymRow, gymTier, hasBadge, leagueChallengeBlocker, leagueHere, leagueStageTeam, leagueStartStage, usesGymChain, usesLeagueChallenge } from '../engine/gymEngine.js';
import { activePlot, plotCard, rocketTeam } from '../engine/rocketEngine.js';
import { signatureSpecies } from '../engine/localPoolEngine.js';
import { usesFatigue } from '../engine/fatigueEngine.js';
import { pokeStopV2, price, sellPrice, sellableItems, shopStock } from '../engine/pokeStopEngine.js';
import { creditKey, growthOptions, growthRules, usesGrowth } from '../engine/growthEngine.js';
import { ITEMS } from '../data/items.js';
import { healingItems, itemCount, itemTargets } from '../engine/itemEngine.js';
import { canSwapQuests, questReward, questSwapUsedThisTurn } from '../engine/questEngine.js';
import { QUESTS_BY_ID } from '../data/quests.js';
import { HALL_OF_FAME } from '../engine/endgameEngine.js';
import { gymMatchups } from '../ui/gymPanel.js';
import { actAttr, esc } from '../ui/dom.js';
import { DEX_STATES, classDots, setClassTable, badgeCase, dexState, dexTile, itemIc, itemToken, missionCard, pokemonCard, REWARD_TOKEN_TYPES, rewardTokens, rocketPlotCard, speciesCard, superballSvg, trainerBadge, teamDot } from './cards.js';
import { POKEMON, attackTypeOf } from '../data/pokemon.js';
import { typeHint } from './typeHint.js';
import { JOURNAL_SECTIONS, activityKind, journal } from './journal.js';
import { basicMoveOf, knownMove, statusOf, usesCombatMoves } from '../engine/combatMoves.js';
import { STATUS_DEFINITIONS } from '../combat2/statuses.js';
import { ballSvg, gi, typeIcon } from './icons.js';
import { catchDieHtml, catchDieLabel, d6Html, escapeDieHtml, escapeDieLabel, pokeballSvg, renderPrompt, windSvg } from './dice.js';
import { ballOptions } from './flow.js';
import { BALL_PL, BIOME_PL, CATCH_DIE, ESCAPE_DIE, ITEM_PL, RARITY_PL, TYPE_PL, d6Purpose, turnsPl } from './i18n.js';
import { JOB_IDS, RESEARCH_REWARDS, atOakLab, usesOakJobs, usesOakKit, usesResearch } from '../engine/oakEngine.js';
import { rocketPlacesPl } from './board.js';
import { TOKENS, avatarToken, characterToken, gymTokenId, leagueTokenId, opponentTokenId, playerToken, rocketTokenId } from './tokens.js';
import { hasFirstStrike } from '../engine/initiativeEngine.js';
import { DECIDED_BY_PL, GYM_NOTE_PL, HOF_PL, LEADER_PL, LEAGUE_STAGE_PL, bookStepPl, eventPl, keyItemPl, placeName, plotPl, rewardPl, thingPl, trainerPl } from './content-pl.js';
import { sceneArtFor } from '../data/sceneArt.js';
import { tradeProblem } from '../engine/tradeEngine.js';
import { achievementPoints, achievementProgress } from '../engine/achievementEngine.js';
import { ACHIEVEMENT_CATEGORIES_PL } from '../data/achievements.js';
import { bookQuest, objectiveProgress, objectiveTarget, rewardLines } from '../engine/questBookEngine.js';

const btn = (action, label, cls = '', disabled = false) => `<button class="${cls}" ${actAttr(action)}${disabled ? ' disabled' : ''}>${label}</button>`;
const uiBtn = (cmd, label, cls = '', extra = '') => `<button class="${cls}" data-ui="${cmd}" ${extra}>${label}</button>`;

const BLOCKER_PL = [
  [/first badge must come from another gym/, 'Najpierw zdobądź odznakę w innej sali — potem możesz tu wrócić.'],
  [/Gym is closed right now/, 'Sala jest teraz zamknięta — wróć, gdy miasto znów będzie otwarte.'],
  [/asks for its trial first/, 'Najpierw próba sali — jej kroki są poniżej i w księdze zadań.'],
  [/League is closed right now/, 'Liga jest teraz zamknięta — wróć, gdy droga znów będzie otwarta.'],
  [/already have/, 'Masz już tę odznakę.'],
  [/one Gym Challenge per turn/, 'Tylko jedno wyzwanie sali na turę.'],
  [/one League Challenge per turn/, 'Tylko jedno wyzwanie Ligi na turę.'],
  [/fainted/, 'Wszystkie Pokémony zemdlały — najpierw ulecz drużynę.'],
  [/No action left/, 'Brak akcji w tej turze.'],
  [/Needs (\d+) badges \(has (\d+)\)/, (m) => `Potrzeba ${m[1]} odznak (masz ${m[2]}).`],
  [/already Champion/, 'Już jesteś Mistrzem.'],
];
export function blockerPl(text) {
  if (!text) return '';
  for (const [re, pl] of BLOCKER_PL) {
    const m = re.exec(text);
    if (m) return typeof pl === 'function' ? pl(m) : pl;
  }
  return text;
}

const leaderPl = (gym) => LEADER_PL[gym.leader] ?? gym.leader;

// ---- Build 3.3 B33-3: the chain of a gym / League v2 challenge ----------------
// One opponent of the chain (gymEngine.chainOpponents): its Polish name and token.
const chainName = (o) => (o.archetype ? trainerPl(o).name : o.leader ? leaderPl(GYMS_BY_ID[o.gymId]) : o.champion ? LEAGUE_STAGE_PL.lance : o.name);
const chainToken = (o, size) => characterToken(o.archetype ?? (o.leader ? gymTokenId(o.gymId) : leagueTokenId(o.name)), { size });
// The whole chain as tokens: beaten ones ticked, the current one marked — no numbers.
function chainStrip(view, c, stage = c.stage ?? -1) {
  const steps = chainOpponents(view, c).map((o, i) => `<span class="chain-step${i < stage ? ' done' : i === stage ? ' now' : ''}" title="${esc(chainName(o))}">${chainToken(o, 'xs')}${i < stage ? '<i>✓</i>' : ''}</span>`);
  return `<div class="chain-strip">${steps.join('<span class="chain-arrow">➜</span>')}</div>`;
}

// ---- combat pieces ----------------------------------------------------------

function modValue(mods, label) {
  return mods.find((m) => m.label === label)?.value ?? 0;
}
const signed = (v) => (v > 0 ? `+${v}` : v < 0 ? `−${-v}` : '0');

// One attack as a line (Build 2.4, Piotr's form): the die with its bonus on it
// (ATK + type, „+1”), „= 5”, then the hearts it took in pink-red (💥 −1 ❤) or a
// miss. The parts of the bonus are in the tooltip.
export function attackRow(a, { rolling = false } = {}) {
  const atk = getSpecies(a.attacker).name;
  const def = getSpecies(a.defender).name;
  const atkMod = modValue(a.modifiers, 'Attack');
  const typeMod = modValue(a.modifiers, 'Type');
  // bonus 2 (rules.signatureMoves): a move's +N is its own tag („✨ +2 Piorun”); a shell's −N on the damage says so
  const move = a.modifiers.find((m) => m.label !== 'Attack' && m.label !== 'Type');
  // PLAYTEST_007 2C: the attack's strength on the die, the TYPE on its own chip — the card's form (typeHint.js)
  const typeChip = typeMod ? `<b class="type-chip ${typeMod > 0 ? 'good' : 'bad'}" title="przewaga typu">${gi(`type.${attackTypeOf(getSpecies(a.attacker))}`)} ${signed(typeMod)}</b>` : '';
  const die = d6Html(rolling ? null : a.raw, { small: true, rolling });
  const result = a.damage > 0 ? `<b class="dmg">💥 −${a.damage} ❤</b>` : '<b class="miss">💨 pudło</b>';
  const moveName = a.move ? ` · <b class="atk-move">${a.move.slot === 'powerful' ? '💥' : a.move.slot === 'special' ? '✨' : '⚔️'} ${esc(a.move.pl)}</b>` : ''; // Combat MVP
  if (a.fixed) return `<div class="atk-row${a.kind === 'player' ? ' mine' : ''}"><div class="atk-who">${esc(atk)} ➜ ${esc(def)}${moveName}</div><div class="atk-math"><span class="op">bez rzutu</span>${result}</div></div>`;
  return `
    <div class="atk-row${a.kind === 'player' ? ' mine' : ''}">
      <div class="atk-who">${esc(atk)} ➜ ${esc(def)}${moveName}</div>
      <div class="atk-math"><span class="die-wrap">${die}${!rolling && atkMod ? `<b class="die-bonus ${atkMod > 0 ? 'good' : 'bad'}" title="siła ataku ${signed(atkMod)}">${signed(atkMod)}</b>` : ''}</span>${!rolling ? typeChip : ''}${!rolling && move ? `<b class="die-bonus good" title="${esc(move.label)}">✨ ${signed(move.value)}</b>` : ''}${rolling ? '' : `<span class="op">=</span><b class="atk-total">${a.total}</b>${result}`}</div>
      ${!rolling && a.guarded ? `<div class="small muted">✨ ${esc(a.guardLabel ?? '')}: −${a.guarded} ❤ mniej.</div>` : ''}
      ${!rolling && a.natural1 ? `<div class="small muted">${a.missFace ? `Potężny ruch pudłuje na 1–2 (${a.missFace}).` : 'Jedynka zawsze chybia.'}</div>` : ''}
      ${!rolling && a.natural6Boost ? '<div class="small muted">Szóstka zawsze trafia.</div>' : ''}
    </div>`;
}

// The latest exchange of blows (kept by the controller from the last reveal).
function lastExchange(ui) {
  const attacks = ui.exchange ?? [];
  if (!attacks.length) return '<div class="exchange empty"><span class="die-ghost">🎲</span></div>';
  return `<div class="exchange">${attacks.map((a) => attackRow(a)).join('')}</div>`;
}

function opponentLabel(enc, config) {
  if (enc.kind === 'wild') return 'Dziki Pokémon';
  // AUD-07: whose Pokémon it is by its species (Jessie's Ekans / Arbok, James's
  // Koffing / Weezing, Meowth) — never by its place in the team
  if (enc.kind === 'rocket') return TOKENS[rocketTokenId(enc.trainer.pokemonTeam[enc.index]?.species, config)]?.name ?? 'Team Rocket';
  if (enc.kind === 'league') return enc.v2 ? enc.trainer.name : LEAGUE.stages[enc.stage].trainers[enc.index] ?? LEAGUE.stages[enc.stage].trainers[0];
  if (enc.kind === 'gym' && enc.trainer.archetype) return trainerPl(enc.trainer).name; // B33-3: the gym's trainer
  if (enc.kind === 'trainer') return trainerPl(enc.trainer).name;
  return enc.trainer.owners?.[enc.index] ?? enc.trainer.name;
}

const RULES_PL = {
  wild: 'Możesz walczyć, rzucić ball, zmienić Pokémona albo uciec.',
  trainer: 'Z walki z trenerem nie można uciec ani łapać jego Pokémonów.',
  rocket: 'Z walki z Team Rocket nie można uciec. Przegrana: Meowth coś zabierze na kartę spisku.',
  gym: 'Bez ucieczki, balli i przedmiotów. Przegrana nic nie kosztuje.',
  league: 'Bez ucieczki i balli. Przedmioty tylko w przerwie między etapami.',
};
// Phase 3A-2 battle loop (rules.counterattackOnStay / battleItems / trainerRetreat).
// 3A-2.5: the dock shows the choices; the line keeps only the special rule.
const RULES_LOOP_PL = {
  wild: 'Uwaga: jeśli Pokémon wyrwie się z balla i zostanie — od razu kontratakuje.',
  trainer: 'Pokémonów trenera nie łapiesz. Wycofanie: −💰1 (bez pieniędzy — jeden przedmiot).',
  rocket: 'Bez ucieczki. Przegrana: Meowth zabierze coś na kartę spisku.',
  gym: 'Bez ucieczki i balli; Potion / Revive zamiast ataku. Przegrana nic nie kosztuje.',
  league: 'Bez ucieczki i balli; Potion / Revive zamiast ataku.',
};
// Gameplay P1 (DQ-91): healing in battle is free (no attack lost), once per Pokémon.
const RULES_P1_PL = {
  ...RULES_LOOP_PL,
  gym: 'Bez ucieczki i balli; leczenie nie zabiera ataku (raz na Pokémona). Przegrana nic nie kosztuje.',
  league: 'Bez ucieczki i balli; leczenie nie zabiera ataku (raz na Pokémona).',
};
// Build 3.3 (DQ-113): healing in battle is the exchange again — the opponent answers, no limit per Pokémon.
const RULES_TEMPO_PL = {
  ...RULES_LOOP_PL,
  gym: 'Bez ucieczki i balli; leczenie zamiast ataku — przeciwnik odpowiada. Przegrana nic nie kosztuje.',
  league: 'Bez ucieczki i balli; leczenie zamiast ataku — przeciwnik odpowiada.',
};
const rulesLine = (view, kind) => (freeBattleHealing(view.config) ? RULES_P1_PL : view.config.rules.battleTempo === 'v2' ? RULES_TEMPO_PL : view.config.rules.battleItems ? RULES_LOOP_PL : RULES_PL)[kind] ?? '';

function encounterHeader(view, enc) {
  if (enc.kind === 'wild') {
    const s = getSpecies(enc.pokemon.species);
    // Macro 02 M02-1: a signature species of this place says so (its home)
    const local = signatureSpecies(currentPlayer(view).location, view.config).includes(s.id);
    return `<span class="scene-tag wild">Dziki Pokémon</span><h2>Dziki ${esc(s.name)}!</h2><span class="tag">${RARITY_PL[s.rarity]}</span>${enc.hunt ? '<span class="tag hunt">🎯 wyjątkowy — polowanie</span>' : ''}${enc.questEncounter ? '<span class="tag hunt">📜 wyprawa — złap go, nie pokonuj do zera!</span>' : ''}${enc.fishing ? '<span class="tag">🎣 na wędce</span>' : ''}${local ? `<span class="tag local">${gi('here')} tutejszy</span>` : ''}${tiredTag(enc)}`;
  }
  if (enc.kind === 'gym') {
    const gym = GYMS_BY_ID[enc.gymId];
    const chain = view.challenge ? chainStrip(view, view.challenge) : '';
    if (enc.trainer.archetype) return `<span class="scene-tag gym">Sala</span>${characterToken(enc.trainer.archetype, { size: 'm' })}<h2>${esc(trainerPl(enc.trainer).name)}</h2><span class="tag">trener sali ${esc(leaderPl(gym))}</span>${creditTag(view, enc)}${chain}`;
    return `<span class="scene-tag gym">Sala</span>${characterToken(gymTokenId(gym.id), { size: 'm' })}<h2>${esc(leaderPl(gym))} — ${esc(gym.badge)}</h2><span class="tag">poziom ${enc.tier}</span>${creditTag(view, enc)}${chain}`;
  }
  if (enc.kind === 'league' && enc.v2) {
    const member = LEAGUE.challengeV2[enc.stage];
    return `<span class="scene-tag league">Liga</span>${characterToken(opponentTokenId(enc, view.config), { size: 'm' })}<h2>${esc(member.champion ? LEAGUE_STAGE_PL.lance : `${LEAGUE_STAGE_PL.eliteFour}: ${member.trainer}`)}</h2>${creditTag(view, enc)}${view.challenge ? chainStrip(view, view.challenge) : ''}`;
  }
  if (enc.kind === 'league') {
    const stage = LEAGUE.stages[enc.stage];
    return `<span class="scene-tag league">Liga</span>${characterToken(opponentTokenId(enc, view.config), { size: 'm' })}<h2>${esc(LEAGUE_STAGE_PL[stage.id] ?? stage.name)}</h2><span class="tag">etap ${enc.stage + 1} z ${LEAGUE.stages.length}</span>`;
  }
  if (enc.kind === 'rocket') {
    const card = plotPl(activePlot(view)?.plotId ?? enc.plotId);
    const trio = enc.trainer.pokemonTeam.some((m) => m.species === view.config.rocket.meowth); // Build 3.3 M1: Meowth in every battle
    return `<span class="scene-tag rocket">Team Rocket</span><h2>${gi('rocket')} ${esc(card.title)}</h2><span class="tag">Jessie i James${trio ? ' + Meowth' : ''}</span>`;
  }
  return `<span class="scene-tag trainer">Trener</span>${trainerBadge(enc.trainer, { unpaid: (enc.fatigue ?? 0) >= 2 })}${tiredTag(enc)}`;
}

// Build 3.3 C1: this gym / League Pokémon was beaten in an earlier attempt — no training again.
function creditTag(view, enc) {
  const key = creditKey(view, enc);
  return key && currentPlayer(view).growthCredits?.includes(key) ? '<span class="tag tired lvl-1">już pokonany — bez treningu</span>' : '';
}

// M02-2: a battle of a searched place says what it does not give — no numbers.
function tiredTag(enc) {
  if (!enc.fatigue) return '';
  const what = enc.kind === 'trainer' && enc.fatigue >= 2 ? 'bez treningu i nagrody' : 'bez treningu';
  return `<span class="tag tired lvl-${enc.fatigue}">${gi('fatigue')}${enc.fatigue >= 2 ? gi('fatigue') : ''} ${what}</span>`;
}

// The opponent's team as small chips (P1.5b): who is next, who is beaten.
function rosterCards(enc) {
  // Build 2.5.1 (Piotr: „nie widać, jakie i ile Pokémonów ma trener”): every
  // Pokémon of the opponent as a token with its picture, name and HP — the one
  // fighting now highlighted, the defeated greyed out.
  if (enc.kind === 'wild') return '';
  const team = enc.trainer.pokemonTeam;
  const tokens = team.map((m, i) => `<span class="roster-mon${i === enc.index ? ' current' : ''}${m.hp === 0 ? ' down' : ''}">${teamDot(m)}<b>${esc(getSpecies(m.species).name)}</b></span>`).join('');
  const left = team.filter((m) => m.hp > 0).length;
  return `<div class="roster"><small class="roster-title">Drużyna przeciwnika: ${team.length} ${team.length === 1 ? 'Pokémon' : team.length < 5 ? 'Pokémony' : 'Pokémonów'}${left < team.length ? ` · zostało ${left}` : ''}</small><div class="roster-row">${tokens}</div></div>`;
}

function stepsText(n) {
  return n === 1 ? 'o 1 krok łatwiej' : `o ${n} kroki łatwiej`;
}

export function catchPrepPanel(view, ball, ui) {
  const opt = ballOptions(view).find((o) => o.ball === ball);
  const mon = view.encounter.pokemon;
  const s = getSpecies(mon.species);
  const die = opt.die;
  const zone = escapeColour(mon);
  const hpStep = die.steps.find((x) => x.label.endsWith('HP'));
  const ballStep = die.steps.find((x) => !x.label.endsWith('HP'));
  return `
    <div class="catch-prep">
      <h3>${ballSvg(ball, 30)} Rzut: ${BALL_PL[ball]}</h3>
      ${fullTeamNote(view)}
      <div class="prep-row"><span>Rzadkość</span><b>${RARITY_PL[s.rarity]}</b><span>kostka bazowa ${catchDieLabel(die.base)}</span></div>
      <div class="prep-row"><span>Pasek HP</span><b>${gi(`die.${zone}`)} ${mon.hp}/${mon.maxHp}</b><span>${hpStep ? stepsText(hpStep.steps) : 'bez zmian'}</span></div>
      <div class="prep-row"><span>Ball</span><b>${BALL_PL[ball]}</b><span>${ballStep ? (opt.noBonus ? 'bez dodatkowego bonusu' : stepsText(ballStep.steps)) : 'bez zmian'}</span></div>
      ${sureGreatBall(mon, ball, view.config, view.encounter) ? '<div class="prep-final"><b>✓ Pewne złapanie</b><span>łatwy Pokémon — bez rzutu kością</span></div>' : `<div class="prep-final">
        <span>Kostka łapania</span>
        ${catchDieHtml(die.colour)}
        <b>${catchDieLabel(die.colour, { reroll: die.rerolls > 0 })}</b>
        ${ui.showOdds ? `<span class="odds">${Math.round(catchDieChance(die) * 100)}%</span>` : ''}
      </div>`}
      ${opt.note ? `<p class="note">${esc(opt.note)}</p>` : ''}
      <div class="row center">
        <button class="primary big" data-ui="throw" data-ball="${ball}">🎯 Rzucaj!</button>
        ${uiBtn('cancel-catch', 'Anuluj', 'ghost')}
      </div>
    </div>`;
}

function freeItemPicker(view, player) {
  const options = getLegalActions(view).filter((a) => a.type === 'useItem');
  const label = (a) => `${itemIc(a.item)} ${ITEM_PL[a.item]}${a.item === 'revive' ? '' : ` +${view.config.items[a.item].heal} ❤`}`;
  // Every Pokémon an item could help, the ones already healed in this battle greyed out with the reason.
  const mons = player.team.filter((m) => healingItems(view.config).some((id) => itemTargets(player, id).includes(m)));
  const cards = mons.map((mon) => {
    const done = healedThisBattle(view, mon.uid);
    const btns = options.filter((a) => a.target === mon.uid).map((a) => btn(a, label(a), 'primary')).join('');
    return `<div class="pick${done ? ' done' : ''}">${pokemonCard(mon, { size: 's', growth: growthRules(view), family: true })}${done ? '<p class="act-note">Ten Pokémon był już leczony w tej walce.</p>' : btns}</div>`;
  }).join('');
  return `
    <div class="switch-panel">
      <h3>${gi('heal')} Leczenie — bez straty ataku</h3>
      <p class="small">Potem walczysz dalej jak zwykle. Każdy Pokémon: jedno leczenie na walkę.</p>
      <div class="pick-row">${cards}</div>
      <div class="row center">${uiBtn('items-close', 'Anuluj', 'ghost')}</div>
    </div>`;
}

// DQ-71: pick the Pokémon to switch in (Team Pokémon Cards).
export function switchPicker(view, free) {
  const player = currentPlayer(view);
  const options = getLegalActions(view).filter((a) => a.type === 'switchPokemon');
  const cards = options.map((a) => {
    const mon = player.team.find((m) => m.uid === a.target);
    return `<div class="pick">${pokemonCard(mon, { size: 's', growth: growthRules(view), family: true })}${matchupBadges(view, mon)}${btn(a, '🔄 Do walki!', 'primary')}</div>`;
  }).join('');
  return `
    <div class="switch-panel">
      <h3>${free ? '🔄 Darmowa zmiana' : '🔄 Zmiana Pokémona'}</h3>
      <p class="switch-rule ${free ? 'free' : 'costly'}">${free ? 'Twój Pokémon zemdlał — możesz wybrać innego. <b>Przeciwnik nie atakuje.</b>' : 'Zamiast ataku. <b>Przeciwnik zaatakuje nowego Pokémona</b> od razu po zmianie.'}</p>
      <div class="pick-row">${cards}</div>
      <div class="row center">${uiBtn('switch-close', 'Anuluj', 'ghost')}</div>
    </div>`;
}

// Phase 3A-2: Potion / Revive instead of attacking (the opponent then strikes).
// Gameplay P1 (DQ-91): healing is free and the battle goes on — once per Pokémon.
export function itemPicker(view) {
  const player = currentPlayer(view);
  if (freeBattleHealing(view.config)) return freeItemPicker(view, player);
  const options = getLegalActions(view).filter((a) => a.type === 'useItem');
  const cards = options.map((a) => {
    const mon = player.team.find((m) => m.uid === a.target);
    const label = a.item === 'revive' ? '💎 Revive' : `🧪 ${ITEM_PL[a.item]} (+${view.config.items[a.item].heal} ❤)`; // Build 3.3: the Super Potion too
    return `<div class="pick">${pokemonCard(mon, { size: 's', growth: growthRules(view), family: true })}${btn(a, label, 'primary')}</div>`;
  }).join('');
  return `
    <div class="switch-panel">
      <h3>🎒 Przedmiot zamiast ataku</h3>
      <p class="small">Potem przeciwnik zaatakuje Twojego prowadzącego.</p>
      <div class="pick-row">${cards}</div>
      <div class="row center">${uiBtn('items-close', 'Anuluj', 'ghost')}</div>
    </div>`;
}

// Leaving a battle always asks first (Macro 01, after the family playtest: a
// child's accidental „Uciekaj” lost the encounter). UI only — nothing is stored
// until „TAK”: the run action itself is the confirmation. A wild Pokémon: run;
// a trainer (3A-2): retreat for its price — with no money the player picks
// the item to leave, each item being its own „TAK”.
export function retreatPicker(view) {
  const runs = getLegalActions(view).filter((a) => a.type === 'run');
  const back = uiBtn('retreat-close', 'WRÓĆ DO WALKI', 'ghost big');
  if (view.encounter.kind === 'wild') {
    return `
    <div class="switch-panel leave-confirm" data-confirm="run">
      <h3>🏃 UCIEC Z WALKI?</h3>
      <p>Jeśli uciekniesz, ta walka się zakończy.</p>
      <div class="row center">${back}${btn(runs[0], 'TAK, UCIEKAM', 'primary big')}</div>
    </div>`;
  }
  const items = runs.filter((a) => a.item);
  if (items.length > 1) {
    const buttons = items.map((a) => `<button class="tray-item" ${actAttr(a)}><span class="tray-token">${itemToken(a.item, 48)}</span><b>${ITEM_PL[a.item]}</b><small>masz ${itemCount(currentPlayer(view), a.item)}</small></button>`).join('');
    return `
    <div class="switch-panel leave-confirm" data-confirm="retreat">
      <h3>🏃 WYCOFAĆ SIĘ Z WALKI?</h3>
      <p class="small">Jeśli się wycofasz, ta walka się zakończy. Bez pieniędzy kosztuje to jeden przedmiot — dotknij, który zostawiasz trenerowi. Ostatni ball zawsze zostaje u Ciebie.</p>
      <div class="shop-row">${buttons}</div>
      <div class="row center">${back}</div>
    </div>`;
  }
  const a = runs[0];
  const cost = a.item ? `Zostawiasz trenerowi: <b>${ITEM_PL[a.item]}</b>.` : currentPlayer(view).money > 0 ? 'Kosztuje: <b>💰 1</b>.' : 'Bez kary.';
  return `
    <div class="switch-panel leave-confirm" data-confirm="retreat">
      <h3>🏃 WYCOFAĆ SIĘ Z WALKI?</h3>
      <p>Jeśli się wycofasz, ta walka się zakończy. ${cost}</p>
      <div class="row center">${back}${btn(a, 'TAK, WYCOFUJĘ SIĘ', 'primary big')}</div>
    </div>`;
}

// The flee / retreat control: a wild Pokémon — run; a trainer (3A-2) — retreat
// for its price (a picker when several items could be left); else not offered.
// A battle choice (P1.5b): icon + short label (+ what it costs / means).
const slot = (icon, label, sub = '') => `<span class="ds-icon">${icon}</span><span class="ds-label">${label}</span>${sub ? `<small>${sub}</small>` : ''}`;

function runControl(view, legal) {
  const runs = legal.filter((a) => a.type === 'run');
  const trainer = view.encounter.kind !== 'wild';
  if (!runs.length) return trainer ? '' : `<button class="act-run" disabled>${slot('🏃', 'Uciekaj')}</button>`;
  // Macro 01: every way out asks first (retreatPicker).
  if (!trainer) return uiBtn('retreat-open', slot('🏃', 'Uciekaj'), 'act-run ghost');
  if (runs.length > 1) return uiBtn('retreat-open', slot('🏃', 'Wycofaj się', 'zostaw przedmiot'), 'act-run ghost');
  const a = runs[0];
  const price = a.item ? `zostaw: ${ITEM_PL[a.item]}` : currentPlayer(view).money > 0 ? '−💰1' : 'bez kary';
  return uiBtn('retreat-open', slot('🏃', 'Wycofaj się', price), 'act-run ghost');
}

// The balls (Build 2.4, Piotr's form): each ball on a tile coloured like the
// Catch Die it rolls (blue / purple / magenta), how many, and the die's ball
// faces of six (3/6 — the P1 preview, nothing more); tap to throw or drag onto
// the wild Pokémon.
function ballRow(view, canAct) {
  const symbolic = view.config.capture.system !== 'classic';
  const opts = ballOptions(view).filter((o) => o.ball !== 'ultraball' || o.count > 0); // E2: the Ultra Ball tile only when you have one
  if (!opts.length) return '';
  const taps = opts.map((o) => {
    const ok = o.usable && canAct && o.count > 0;
    // the die THIS ball rolls (ballOptions → throwDie, the throw's own function)
    const die = symbolic ? o.die : null;
    const reroll = die?.rerolls ? `<small class="reroll-tag" title="+ przerzut">${gi('reroll')}</small>` : '';
    // the count, then how good the die is now: its ball faces of six (the die the throw rolls)
    return `<button class="ball-tile${ok ? '' : ' muted'}${die ? ` c-${die.colour}` : ''}" data-ui="catch" data-ball="${o.ball}"${ok ? ` data-drag-ball="${o.ball}"` : ' disabled'} title="${esc(o.note || o.name)}${die ? ` — kostka ${CATCH_DIE[die.colour].name.toLowerCase()}${die.rerolls ? ' + przerzut' : ''}` : ''}" aria-label="${esc(o.name)}: ${o.count}${die ? `, szansa ${die.successFaces} z 6${die.rerolls ? ' i przerzut' : ''}` : ''}">${ballSvg(o.ball, 36)}<b class="count">×${o.count}</b>${die ? `<small class="odds">${die.successFaces}/6</small>${reroll}` : ''}</button>`;
  }).join('');
  // Gameplay P1 (DQ-93): warier Pokémon here — said before the throw, never hidden.
  // M02-2: in a game with fatigue the harder die is the searched place's (no Vigilance)
  const wary = !vigilanceSteps(view) ? ''
    : usesFatigue(view.config) ? `<div class="act-note wary tired">${gi('fatigue')} Pokémony tutaj już Cię znają — trudniej je złapać</div>`
      : `<div class="act-note wary">${gi('vigilant')} Czujne Pokémony — po złapaniu tutaj kostka łapania jest trudniejsza</div>`;
  return `${fullTeamNote(view)}${wary}<div class="ball-row">${taps}</div>`;
}

// Wild-encounter slice (A): a full team never blocks the Ball — it is said
// before the throw what a catch will lead to (Professor Oak's choice).
export function fullTeamNote(view) {
  const player = currentPlayer(view);
  if (!view.config.rules.oakBox || player.team.length < view.config.maxTeamSize) return '';
  return `<div class="act-note full-team">${gi('team.full')} <span><b>DRUŻYNA PEŁNA ${player.team.length}/${view.config.maxTeamSize}</b> Jeśli złapiesz tego Pokémona, wybierzesz, kogo wysłać do Profesora Oaka.</span></div>`;
}

// Wild-encounter slice (B + C), under the wild Pokémon's card: its temperament
// in two words, and the Catch Die a Poké Ball rolls NOW (HP, rarity, Vigilance —
// throwDie, the throw's own function), with the reroll when there is one.
export function wildInfo(view) {
  const enc = view.encounter;
  if (enc?.kind !== 'wild') return '';
  const temper = usesTemperament(view) ? temperamentOf(enc.pokemon.species) : null;
  const t = temper ? `<div class="temper t-${temper}">${gi(`temperament.${temper}`)}<b>${TEMPERAMENT_PL[temper].name}</b><small>${TEMPERAMENT_PL[temper].rule}</small></div>` : '';
  if (view.config.capture.system === 'classic') return t ? `<div class="wild-info">${t}</div>` : '';
  const die = throwDie(view, 'pokeball');
  const now = `<div class="catch-now c-${die.colour}" aria-label="Złapanie Poké Ballem teraz: kostka ${CATCH_DIE[die.colour].name.toLowerCase()}, ${die.successFaces} z 6${die.rerolls ? ' i przerzut' : ''}">
      <small>ZŁAPANIE</small><span class="cn-die">${die.successFaces}/6</span>${die.rerolls ? `<span class="cn-reroll">${gi('reroll')} + PRZERZUT</span>` : ''}</div>`;
  return `<div class="wild-info">${t}${now}</div>`;
}

// Bonus 2, 14.10 (rules.signatureMoves): the line's move next to Atakuj — „✨ Piorun”; used → „użyty”; Płomień
// before half its hearts → „od ½ ❤”. Nothing when the rule is off or the line has no move.
function moveButton(view, mon, action, used = []) {
  const move = usesSignature(view.config) ? moveOf(mon) : null;
  if (!move) return '';
  if (action) return btn(action, `✨ ${esc(move.pl)}`, 'act-move', false).replace('<button', `<button title="${esc(move.text)}"`);
  const why = (used ?? []).includes(mon.uid) ? 'użyty' : move.effect.when === 'hpHalfOrLess' ? 'od ½ ❤' : '';
  return `<button class="act-move" disabled title="${esc(move.text)}">✨ ${esc(move.pl)}${why ? ` <small>${why}</small>` : ''}</button>`;
}

// Combat MVP (rules.combatMoves 'mvp1'): the lead's moves next to its basic attack — only the moves THIS Pokémon knows;
// a used one says so; one short line of what it does and „1×” (once per battle).
const STATUS_SHORT = { poison: 'trucizna', burn: 'oparzenie', paralysis: 'paraliż', sleep: 'sen' };
function moveEffectShort(m) {
  if (m.slot === 'powerful') return '+2 · pudło na 1–2';
  const e = m.effect;
  return { status: () => `${STATUS_DEFINITIONS[e.status].icon} ${STATUS_SHORT[e.status]}`, drain: () => 'odzyskuje ❤', guard: () => `osłona −${e.reduce}`, boost: () => `+${e.bonus}`, fixed: () => `zawsze ${e.amount} ❤` }[e.kind]?.() ?? '';
}
function combatMoveButtons(view, lead, legal) {
  if (!lead) return '';
  return ['special', 'powerful'].map((slot) => {
    const m = knownMove(lead, slot);
    if (!m) return '';
    const action = legal.find((a) => a.type === 'fight' && a.slot === slot);
    const label = `${slot === 'powerful' ? '💥' : '✨'} ${esc(m.pl)} <small>${esc(moveEffectShort(m))} · ${action ? '1×' : 'użyty'}</small>`;
    return action ? btn(action, label, `act-move m-${slot}`, false).replace('<button', `<button title="${esc(m.name)}"`) : `<button class="act-move m-${slot}" disabled>${label}</button>`;
  }).join('');
}
// A status on a card in the arena (Combat MVP): its icon and name; the rule in the title.
function statusChip(view, mon) {
  const st = mon && usesCombatMoves(view.config) ? statusOf(view.encounter, mon.uid) : null;
  if (!st) return '';
  const def = STATUS_DEFINITIONS[st.id];
  return `<span class="st-chip st-${st.id}" title="${esc(def.kidPl)}">${def.icon} ${esc(def.pl)}</span>`;
}

// A battle (P1.5b compact): my card | the dice and the choices | their card.
// Each card keeps its ATK stat; a matchup badge (Build 2.3) says what its attack
// TYPE does against the other card (+1 / −1, nothing at 0); ▶ RUCH sits on the
// Pokémon whose move it is (the die on the table, else the player's, who decides). Main choices in the middle (Atakuj, the balls,
// Uciekaj); Zmiana / Przedmiot under the player's card. A picker (switch,
// item, retreat, ball) takes the whole panel until chosen or cancelled.
function sceneEncounter(view, ui, canAct, reveal = null) {
  const enc = view.encounter;
  const player = currentPlayer(view);
  const lead = getLead(player);
  const opp = currentOpponent(enc);
  const legal = canAct ? getLegalActions(view) : [];
  const has = (type) => legal.some((a) => a.type === type);
  const wild = enc.kind === 'wild';
  const anyBall = wild && ballOptions(view).some((o) => o.usable);
  const step = reveal?.steps[reveal.i] ?? null;
  const actor = !step ? 'mine' : step.type === 'attack' ? (step.kind === 'player' ? 'mine' : 'theirs') : step.type === 'escape' ? 'theirs' : ['catch', 'switch'].includes(step.type) ? 'mine' : null;
  const fight = (a, b) => ({ type: typeHint(a, b, view.config).mod }); // PLAYTEST_007 2C: the one hint path
  // no „prowadzi” pill in a battle (the player's name is over the card)
  // character tokens (tokens.js): whose Pokémon fights on each side right now
  const oppToken = opponentTokenId(enc, view.config);
  // Build 3.3 ⚡: a quick Pokémon wears the First Strike chip in battle
  const quick = (mon) => (mon && hasFirstStrike(mon, view.config) ? `<span class="fs-chip" title="Szybkie wejście: przy pierwszym wejściu do walki zyskuje jeden ruch">${gi('firstStrike')}</span>` : '');
  const leftCard = lead ? pokemonCard(lead, { size: 'l', label: player.name, ownerToken: playerToken(player, { size: 's' }) + quick(lead) + statusChip(view, lead), growth: growthRules(view), fight: fight(lead, opp), actor: actor === 'mine' }) : '<div class="pcard size-l empty-slot">brak zdrowych Pokémonów</div>';
  const rightCard = pokemonCard(opp, { size: 'l', label: opponentLabel(enc, view.config), ownerToken: (oppToken ? characterToken(oppToken, { size: 's' }) : '') + quick(opp) + statusChip(view, opp), drop: canAct && anyBall, cls: ui.dealUid === opp.uid ? 'deal' : '', fight: lead ? fight(opp, lead) : null, actor: actor === 'theirs' });
  let picker = '';
  if (ui.catchPrep && wild) picker = catchPrepPanel(view, ui.catchPrep.ball, ui);
  else if (ui.switchPick && has('switchPokemon')) picker = switchPicker(view, enc.freeSwitch);
  else if (ui.itemPick && has('useItem')) picker = itemPicker(view);
  else if (ui.retreatPick && legal.some((a) => a.type === 'run')) picker = retreatPicker(view);
  // no rules line (Build 2.4): the choices and the frames over them say it
  const head = `<div class="scene-head">${encounterHeader(view, enc)}</div>`;
  if (picker) return `<div class="scene encounter compact k-${enc.kind}">${head}<div class="picker-wrap">${picker}</div></div>`;
  const wildName = wild ? getSpecies(enc.pokemon.species).name : 'Pokémon';
  const table = step ? `${renderStep(step, { rolling: reveal.rolling, wildName, view })}${uiBtn('skip', 'Pomiń ⏩', 'ghost small skip')}` : lastExchange(ui);
  const items = view.config.rules.battleItems;
  // while the dice roll, the choices stay in place (inactive), so the panel never jumps
  const choices = canAct || step ? `
      <div class="battle-actions">
        ${(() => { const nm = usesCombatMoves(view.config) && lead ? `⚔️ ${esc(basicMoveOf(lead.species).pl)}` : '⚔️ Atakuj'; return has('fight') ? btn({ type: 'fight' }, nm, 'act-attack primary') : `<button class="act-attack" disabled>${nm}</button>`; })()}
        ${moveButton(view, lead, has('signature') ? { type: 'signature' } : null, enc.signatureUsed)}
        ${usesCombatMoves(view.config) ? combatMoveButtons(view, lead, legal) : ''}
        ${wild ? ballRow(view, canAct && !ui.catchPrep) : ''}
        ${runControl(view, legal)}
      </div>` : !step && player.controller === 'ai' ? `<div class="battle-actions"><span class="thinking">${esc(player.name)} (AI) myśli…</span></div>` : '';
  const side = canAct || step ? `
        ${has('switchPokemon') ? `<div class="act-note${enc.freeSwitch ? ' free' : ''}">${enc.freeSwitch ? 'Zmiana za darmo — bez ataku' : 'Po zmianie atakuje przeciwnik'}</div>` : ''}
        <div class="side-actions">
          ${has('switchPokemon') ? uiBtn('switch-open', slot('🔄', 'Zmiana'), `side-act${enc.freeSwitch ? ' free' : ''}`) : `<button class="side-act" disabled>${slot('🔄', 'Zmiana')}</button>`}
          ${items ? (has('useItem') ? uiBtn('items-open', slot('🎒', 'Przedmiot'), 'side-act') : `<button class="side-act" disabled>${slot('🎒', 'Przedmiot')}</button>`) : ''}
        </div>` : '';
  return `
    <div class="scene encounter compact k-${enc.kind}">
      ${head}
      <div class="arena">
        <div class="side mine">${leftCard}${side}</div>
        <div class="middle"><div class="exchange-area">${table}</div>${choices}</div>
        <div class="side theirs">${rightCard}${rosterCards(enc)}${wildInfo(view)}</div>
      </div>
    </div>`;
}

// The switch picker (Build 2.3): the type matchup only, like the badges on the
// battle cards — its attack's type against this opponent (⚔) and the opponent's
// against it (🛡); nothing when 0.
function matchupBadges(view, mon, foe = currentOpponent(view.encounter).species) {
  const mine = typeHint(mon, foe, view.config).mod; // PLAYTEST_007 2C: the one hint path
  const theirs = typeHint(foe, mon, view.config).mod;
  const badges = `${mine ? `<span class="mu ${modClass(mine)}" title="Twój atak — typ">⚔️ ${modText(mine)}</span>` : ''}${theirs ? `<span class="mu ${modClass(-theirs)}" title="Atak przeciwnika — typ">🛡 ${modText(theirs)}</span>` : ''}`;
  return badges ? `<div class="mu-badges">${badges}</div>` : '';
}

// PLAYTEST_006 PT006-12: an approved card illustration bound to this quest / event (Studio „Ilustracje kart”),
// or nothing — the card as before (a picture that fails to load removes itself: main.js).
export function sceneArtImg(kind, id) {
  const a = sceneArtFor(kind, id);
  return a ? `<img class="scene-art" src="${esc(a.url)}" alt="" loading="lazy" decoding="async" draggable="false">` : '';
}

const modText = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0');
const modClass = (n) => (n > 0 ? 'good' : n < 0 ? 'bad' : 'even');


// ---- reveal tray ------------------------------------------------------------------

export function renderStep(step, { rolling = false, wildName = 'Pokémon', view = null } = {}) {
  const roll = rolling && !step.physical;
  switch (step.type) {
    case 'explore':
      return `<div class="tray explore-flip${roll ? '' : ' flipped'}"><div class="tray-title">Karta eksploracji</div>${d6Html(roll ? null : step.value, { rolling: roll })}${roll ? '' : `<div class="tray-result">${esc(step.outcome)}</div>`}</div>`;
    case 'rarity':
      return `<div class="tray"><div class="tray-title">Rzadkość</div>${d6Html(roll ? null : step.value, { rolling: roll })}${roll ? '' : `<div class="tray-result r-${step.rarity}">${'◆'.repeat({ common: 1, rare: 2, superRare: 3 }[step.rarity])} ${esc(step.label)}${step.total !== step.value ? ` <small>(${step.value} +1)</small>` : ''}</div>${step.rolled ? `<div class="tray-note">${'◆'.repeat({ common: 1, rare: 2, superRare: 3 }[step.rolled])} — tu takich nie ma</div>` : ''}`}</div>`;
    case 'firstStrike':
      return `<div class="tray"><div class="tray-title">${gi('firstStrike')} Szybkie wejście</div><div class="tray-result">${esc(step.text)}</div></div>`;
    case 'attack': {
      // Phase 3A-2: the opponent's response when the player did not attack.
      const why = step.after === 'stay' ? `<div class="tray-title big">${esc(wildName.toUpperCase())} ZOSTAJE — I KONTRATAKUJE!</div>` : step.after === 'item' ? '<div class="tray-title">Przeciwnik atakuje</div>' : step.after === 'firstStrike' ? `<div class="tray-title">${gi('firstStrike')} Atakuje pierwszy!</div>` : '';
      return `<div class="tray">${why}${attackRow(step, { rolling: roll })}</div>`;
    }
    case 'catch': {
      const text = roll ? '' : step.face === 'ball' ? `<div class="tray-result good">${pokeballSvg(28)} Poké Ball!</div>` : '<div class="tray-result">Puste…</div>';
      return `<div class="tray"><div class="tray-title">${step.reroll ? '↻ Przerzut — ' : ''}Kostka łapania ${catchDieLabel(step.colour)}</div>${catchDieHtml(step.colour, { face: roll ? null : step.face, rolling: roll })}${text}</div>`;
    }
    case 'escape': {
      const d = ESCAPE_DIE[step.colour];
      const text = roll ? '' : step.face === 'flee' ? `<div class="tray-result bad">${windSvg(30)} ${esc(wildName.toUpperCase())} UCIEKŁ!</div>` : `<div class="tray-result good">${esc(wildName.toUpperCase())} ZOSTAJE!</div>`;
      // wild-encounter slice: a skittish Pokémon's roll after the round, not after a Ball
      const title = step.trigger === 'afterRound' ? `${esc(wildName.toUpperCase())} JEST PŁOCHLIWY — UCIEKNIE?` : `${esc(wildName.toUpperCase())} SIĘ WYRWAŁ!`;
      return `<div class="tray escape-moment"><div class="tray-title big">${title}</div>
        <div class="tray-sub">Aktualne HP: ${gi(`die.${step.colour}`)} ${d.zone}</div>
        <div class="tray-title">Kostka ucieczki ${escapeDieLabel(step.colour)}</div>${escapeDieHtml(step.colour, { face: roll ? null : step.face, rolling: roll })}${text}</div>`;
    }
    case 'growth': {
      const name = getSpecies(step.species ?? step.source).name;
      const source = getSpecies(step.source).name;
      if (step.event === 'gain' && step.amount !== undefined) {
        // Build 3.3 E1: EXP by power class — how much, and why (stronger opponents teach more)
        if (step.amount === 0) return `<div class="tray growth-moment"><div class="tray-title">⭐ Bez treningu</div><div class="tray-result">${esc(name)}: ${step.growth}/${step.threshold}</div><div class="tray-sub">${esc(source)} był dużo słabszy — słabszy przeciwnik nic nie uczy.</div></div>`;
        return `<div class="tray growth-moment"><div class="tray-title">⭐ Trening +${step.amount}!</div><div class="tray-result good">${esc(name)}: ${step.growth}/${step.threshold}${step.ready ? ' — GOTOWY DO EWOLUCJI!' : ''}</div><div class="tray-sub">Za ${step.kind === 'catch' ? 'złapanie' : 'pokonanie'}: ${esc(source)} ${classDots(step.source)}</div></div>`;
      }
      if (step.event === 'noCredit') return `<div class="tray growth-moment"><div class="tray-title">⭐ Bez treningu</div><div class="tray-sub">${esc(source)} był już pokonany — trening tylko za pierwszym razem.</div></div>`; // Build 3.3 C1
      if (step.event === 'lost' && step.reason === 'tired') return `<div class="tray growth-moment tired"><div class="tray-title">${gi('fatigue')} Bez treningu tutaj</div><div class="tray-sub">Pokémony tutaj już Cię znają. Trening tu nic nie da — ruszaj dalej!</div></div>`;
      if (step.event === 'lost') return `<div class="tray growth-moment"><div class="tray-title">⭐ Punkt treningu przepada</div><div class="tray-sub">Za ${step.kind === 'catch' ? 'złapanie' : 'pokonanie'}: ${esc(source)} — ${step.reason === 'fainted' ? 'zemdlał w walce z nim — bez treningu' : step.reason === 'final' ? 'ten Pokémon już nie ewoluuje' : 'Pokémon jest już gotowy do ewolucji'}.</div></div>`;
      return `<div class="tray growth-moment"><div class="tray-title">⭐ Punkt treningu!</div><div class="tray-result good">${esc(name)}: ${step.growth}/${step.threshold}${step.ready ? ' — GOTOWY DO EWOLUCJI!' : ''}</div><div class="tray-sub">Za ${step.kind === 'catch' ? 'złapanie' : 'pokonanie'}: ${esc(source)}</div></div>`;
    }
    case 'switch':
      return `<div class="tray"><div class="tray-title">🔄 Zmiana Pokémona</div><div class="tray-result good">Do walki wchodzi ${esc(getSpecies(step.species).name)}!</div><div class="tray-sub">${step.free ? 'Za darmo — poprzedni zemdlał.' : 'Bez ataku w tej rundzie.'}</div></div>`;
    case 'plot':
      return `<div class="tray rocket-moment"><div class="tray-title big rocket">🎈 Team Rocket knuje spisek!</div>${view?.rocket?.active ? rocketPlotCard(view, { size: 's' }) : ''}</div>`;
    case 'drift':
      return `<div class="tray rocket-moment"><div class="tray-title">🎈 Balon Team Rocket leci</div><div class="tray-result">${esc(getLocation(step.from).name)} → ${esc(getLocation(step.to).name)}${step.landed ? ' i ląduje!' : ''}</div></div>`;
    case 'rocketBattle':
      return `<div class="tray rocket-moment"><div class="tray-title big rocket">„Przygotujcie się na kłopoty!”</div><div class="tray-result">${{ challenge: 'Wyzywasz Team Rocket!', explore: 'Tu jest tylko Team Rocket!', ambush: 'Zasadzka!' }[step.trigger] ?? 'Team Rocket!'}</div></div>`;
    case 'loot':
      return `<div class="tray rocket-moment"><div class="tray-title">😼 Meowth zabiera</div><div class="loot-fly"><span class="fly-token">${itemToken(step.item, 48)}</span><span class="fly-arrow">➜ 🎈</span></div><div class="tray-sub">${esc(thingPl(step.item, step.amount))} — leży na karcie spisku. Wróci, gdy ktoś pokona Team Rocket.</div></div>`;
    case 'lootBack':
      return `<div class="tray rocket-moment"><div class="tray-title">🎒 Łup wraca</div><div class="loot-fly back"><span class="fly-arrow">🎈 ➜</span><span class="fly-token">${itemToken(step.item, 48)}</span></div><div class="tray-sub">${esc(step.ownerName)} odzyskuje: ${esc(thingPl(step.item, step.amount))}</div></div>`;
    case 'rocketEscaped':
      // 3A-4: the plot clock ran out — nobody gets the reward, the loot goes home
      return `<div class="tray rocket-moment"><div class="tray-title big rocket">TEAM ROCKET UCIEKŁ!</div><div class="tray-sub">${step.loot ? 'Skradzione rzeczy wracają do właścicieli.' : 'Nikt nie zdobył nagrody za ten spisek.'}</div></div>`;
    case 'blastOff':
      return '<div class="tray rocket-moment blast"><div class="tray-title big rocket">Team Rocket znowu odlatuje! ✨</div></div>';
    case 'pitfall':
      return '<div class="tray rocket-moment"><div class="tray-title big rocket">🕳 Dół Team Rocket!</div><div class="tray-result">Twoja tura się kończy.</div></div>';
    case 'event': {
      const e = eventPl(step.event);
      return `<div class="tray event-moment">${sceneArtImg('event', step.event)}<div class="tray-title">Wydarzenie</div><h3>${esc(e.title)}</h3><p>${esc(e.text)}</p>${step.effects ? `<div class="tray-result">${esc(step.effects)}</div>` : ''}</div>`;
    }
    case 'eventChoice':
      return `<div class="tray event-moment"><div class="tray-title">Wybór</div><div class="tray-result">${esc(step.label)}</div>${step.effects ? `<div class="tray-sub">${esc(step.effects)}</div>` : ''}</div>`;
    case 'note':
      return `<div class="tray"><div class="tray-result good">${esc(step.text)}</div></div>`;
    default: {
      const meaning = !roll && step.meaning ? `<div class="tray-result">${esc(step.meaning)}</div>` : '';
      const title = step.label === 'Meowth grabs' ? 'Meowth — co zabierze?' : d6Purpose(step.label);
      return `<div class="tray"><div class="tray-title">${esc(title)}</div>${d6Html(roll ? null : step.value, { rolling: roll })}${meaning}</div>`;
    }
  }
}

// ---- other scenes -------------------------------------------------------------------

// Family flow (3A-2.5): EKSPLORUJ → the terrain (only where there is a
// choice) → the roll → what was found. No simulator decks or counters here.
function sceneExplore(view, ui, canAct) {
  const player = currentPlayer(view);
  const legal = canAct ? getLegalActions(view).filter((a) => a.type === 'explore') : [];
  // Macro 01: a mixed place has one Explore without a biome (the HUD sends it straight away)
  const choices = legal.map((a) => (a.biome ? btn(a, `${gi(`biome.${a.biome}`)} ${BIOME_PL[a.biome] ?? BIOMES[a.biome].name}`, 'primary big') : btn(a, '🌿 Eksploruj', 'primary big'))).join('');
  return `
    <div class="scene explore">
      <div class="scene-head"><span class="scene-tag">Eksploracja</span><h2>📍 ${esc(placeName(player.location))}</h2><span class="tag">1 akcja</span></div>
      ${ui.reveal ? '<p class="center explore-roll">🎲 Co tu znajdziesz?</p>' : `<p class="center">Gdzie szukasz? Wybierz teren — kość pokaże, co znajdziesz: nic, wydarzenie, trenera albo dzikiego Pokémona.</p>
      <div class="row center">${choices || '<span class="muted">Tu nie da się eksplorować.</span>'}${uiBtn('close-panel', 'Zamknij', 'ghost')}</div>`}
    </div>`;
}

function sceneRest(view, canAct) {
  const player = currentPlayer(view);
  const rests = canAct ? getLegalActions(view).filter((a) => a.type === 'rest') : [];
  const cards = rests.map((a) => {
    const mon = player.team.find((m) => m.uid === a.target);
    return `<div class="pick">${pokemonCard(mon, { size: 'm', growth: growthRules(view), family: true })}${btn(a, `💤 +${restHeal(view.config)} ❤`, 'primary')}</div>`;
  }).join('');
  return `<div class="scene rest"><div class="scene-head"><span class="scene-tag">Odpoczynek</span><h2>Kto odpoczywa?</h2><span class="tag">1 akcja</span></div><div class="pick-row">${cards || '<span class="muted">Nikt nie potrzebuje odpoczynku.</span>'}</div><div class="row center">${uiBtn('close-panel', 'Zamknij', 'ghost')}</div></div>`;
}

function typeChips(types) {
  return types.map((t) => `<span class="type-chip" style="--tc:var(--t-${t})">${gi(`type.${t}`)} ${TYPE_PL[t]}</span>`).join(' ') || '—';
}

// B33-3: who waits in the gym — its trainer(s), then the leader, each with its row.
function gymChainPreview(view, gym, tier) {
  const steps = chainOpponents(view, { kind: 'gym', gymId: gym.id, tier }).map((o) => `
    <div class="league-stage chain-stage">
      <b>${chainToken(o, 'xs')} ${esc(chainName(o))}</b>
      <div class="roster-cards">${o.team.map((id) => speciesCard(id, { size: 'xs' })).join('')}</div>
    </div>`);
  return `<div class="chain-preview">${steps.join('<div class="league-break-mark">➜ bez Poké Stopu</div>')}</div>`;
}

// B33-3 League v2: Lorelei → Bruno → Agatha → Lance in one challenge.
function leagueCardV2(view, player, canAct) {
  const legal = canAct && getLegalActions(view).some((a) => a.type === 'challengeLeague');
  const need = view.config.gyms.badgesForLeague;
  const stages = chainOpponents(view, { kind: 'league' }).map((o) => `
    <div class="league-stage">
      <b>${chainToken(o, 'xs')} ${esc(chainName(o))}</b>
      <div class="roster-cards">${o.team.map((id) => speciesCard(id, { size: 'xs' })).join('')}</div>
    </div>`).join(`<div class="league-break-mark">⏸ przerwa: ${healingItems(view.config).map((id) => ITEM_PL[id]).join(' / ')} / zmiana prowadzącego — bez Poké Stopu</div>`);
  return `
    <div class="gym-card league">
      <div class="gym-top"><span class="gym-icon">🏆</span><div><h2>Liga Pokémon — Indigo Plateau</h2><div>Wymagane: ${need} odznaki · masz ${player.badges.length}${player.league.ribbon ? ' · 🎀 Wstęga Elitarnej Czwórki' : ''}</div></div></div>
      ${badgeCase(view, player)}
      ${stages}
      <p class="small muted">Jedno wyzwanie: Lorelei, Bruno, Agatha, potem Lance. Pokonasz trójkę → 🎀 Wstęga do gabloty. Przegrana albo wyjście: następnym razem znowu od Lorelei. Pokonasz Lance’a → zostajesz Mistrzem i gra kończy się po tym tygodniu.</p>
      <div class="row center">${canAct && !player.league.champion ? btn({ type: 'challengeLeague' }, '🏆 Wyzwij Ligę (1 akcja)', 'primary big', !legal) : ''}${uiBtn('close-panel', 'Zamknij', 'ghost')}</div>
      ${canAct && !legal && !player.league.champion ? `<p class="note">${esc(blockerPl(leagueChallengeBlocker(view, player)))}</p>` : ''}
    </div>`;
}

function leagueCard(view, player, canAct) {
  if (usesLeagueChallenge(view.config)) return leagueCardV2(view, player, canAct);
  const start = leagueStartStage(view, player);
  const legal = canAct && getLegalActions(view).some((a) => a.type === 'challengeLeague');
  const need = view.config.gyms.badgesForLeague;
  const stages = LEAGUE.stages.map((stage, i) => `
    <div class="league-stage${i === start ? ' mine' : ''}">
      <b>Etap ${i + 1}: ${esc(LEAGUE_STAGE_PL[stage.id] ?? stage.name)}</b>${i === start && start > 0 ? ' <span class="tag">tu zaczynasz (🎀)</span>' : ''}
      <div class="roster-cards">${leagueStageTeam(view, i).map((id, j) => `<div class="named-card"><small>${characterToken(leagueTokenId(stage.trainers[j] ?? stage.trainers[0]), { size: 'xs' })}${esc(stage.trainers[j] ?? stage.trainers[0])}</small>${speciesCard(id, { size: 'xs' })}</div>`).join('')}</div>
    </div>`).join(`<div class="league-break-mark">⏸ przerwa: ${healingItems(view.config).map((id) => ITEM_PL[id]).join(' / ')} / zmiana prowadzącego — bez pełnego leczenia</div>`);
  return `
    <div class="gym-card league">
      <div class="gym-top"><span class="gym-icon">🏆</span><div><h2>Liga Pokémon — Indigo Plateau</h2><div>Wymagane: ${need} odznaki · masz ${player.badges.length}${player.league.ribbon ? ' · 🎀 Wstęga Elitarnej Czwórki' : ''}</div></div></div>
      ${badgeCase(view, player)}
      ${stages}
      <p class="small muted">Pokonasz Elitarną Czwórkę → dostajesz 🎀 Wstęgę: następnym razem zaczynasz od Lance’a. Pokonasz Lance’a → zostajesz Mistrzem i gra kończy się po tym tygodniu.</p>
      <div class="row center">${canAct && !player.league.champion ? btn({ type: 'challengeLeague' }, '🏆 Wyzwij Ligę (1 akcja)', 'primary big', !legal) : ''}${uiBtn('close-panel', 'Zamknij', 'ghost')}</div>
      ${canAct && !legal && !player.league.champion ? `<p class="note">${esc(blockerPl(leagueChallengeBlocker(view, player)))}</p>` : ''}
    </div>`;
}

export function sceneGym(view, canAct) {
  const player = currentPlayer(view);
  const gym = gymHere(view, player);
  if (gym) {
    const tier = gymTier(view, player);
    const owned = hasBadge(player, gym.id);
    const { strong, weak } = gymMatchups(gym, view.config);
    const legal = canAct && getLegalActions(view).some((a) => a.type === 'challengeGym');
    const cfg = view.config.gyms;
    const note = GYM_NOTE_PL[gym.id];
    return `
      <div class="scene gym-scene">
        <div class="gym-card">
          <div class="gym-top"><span class="gym-icon">${typeIcon(gym.type)}</span>${characterToken(gymTokenId(gym.id), { size: 'l' })}<div><h2>Sala w ${esc(getLocation(gym.city).name)}</h2><div>Lider: <b>${esc(leaderPl(gym))}</b>${note ? ` <small>(${esc(note)})</small>` : ''} · Odznaka: <b>${esc(gym.badge)}</b>${owned ? ' ✓' : ''}</div></div><span class="tag">poziom ${tier} (${player.badges.length} ${player.badges.length === 1 ? 'odznaka' : 'odznak'})</span></div>
          ${usesGymChain(view.config) ? gymChainPreview(view, gym, tier) : `<div class="roster-cards">${gymRow(gym, tier, view.config).map((id) => speciesCard(id, { size: 's' })).join('')}</div>`}
          ${trialBox(view, player, gym)}
          <div class="guide"><span>💪 Silne tu: ${typeChips(strong)}</span><span>🛡️ Słabe tu: ${typeChips(weak)}</span></div>
          <div class="rewards">Nagroda: <b>${gi(`type.${gym.type}`)} odznaka</b> · 💰${cfg.reward.money}${gymRewardItem(gym, view.config) ? ` · <b class="reward-item">${itemToken(gymRewardItem(gym, view.config), 22)} ${esc(ITEM_PL[gymRewardItem(gym, view.config)])}</b>` : ''}${cfg.starsPerBadge && !usesGrowth(view) ? ` · ⭐${cfg.starsPerBadge}` : usesGrowth(view) ? (view.config.rules.growthCredits ? ' · ⭐ trening raz za każdego Pokémona' : ' · ⭐ trening za każdego pokonanego Pokémona') : ''}${gym.grants ? ' · 🌊 pływanie' : ''}</div>
          <p class="small muted">${rulesLine(view, 'gym')} ${usesGymChain(view.config) ? 'Najpierw trener sali, potem lider — między walkami bez Poké Stopu. Wyjście albo przegrana: następnym razem od początku.' : 'Spróbujesz znowu w kolejnej turze.'}</p>
          <div class="row center">${owned ? '<b>Masz już tę odznakę.</b>' : canAct ? btn({ type: 'challengeGym' }, usesGymChain(view.config) ? '🏟️ Wyzwij salę (1 akcja)' : '🏟️ Wyzwij lidera (1 akcja)', 'primary big', !legal) : ''}${uiBtn('close-panel', 'Zamknij', 'ghost')}</div>
          ${!owned && canAct && !legal ? `<p class="note">${esc(blockerPl(gymChallengeBlocker(view, player)))}</p>` : ''}
        </div>
      </div>`;
  }
  if (leagueHere(view, player)) return `<div class="scene gym-scene">${leagueCard(view, player, canAct)}</div>`;
  return '';
}

function sceneRocket(view, canAct) {
  const active = activePlot(view);
  if (!active) return `<div class="scene"><p>Team Rocket teraz nic nie knuje.</p><div class="row center">${uiBtn('close-panel', 'Zamknij', 'ghost')}</div></div>`;
  const legal = canAct && getLegalActions(view).some((a) => a.type === 'challengeRocket');
  const where = rocketPlacesPl(view, currentPlayer(view));
  return `
    <div class="scene rocket-scene">
      ${rocketPlotCard(view, { size: 'l' })}
      <p class="center small">Wyzwanie Team Rocket (1 akcja) możliwe w: <b>${esc(where)}</b>.</p>
      <div class="row center">${legal ? btn({ type: 'challengeRocket' }, '🎈 Wyzwij Team Rocket (1 akcja)', 'primary big') : ''}${uiBtn('close-panel', 'Zamknij', 'ghost')}</div>
    </div>`;
}

function sceneEvent(view, canAct) {
  const e = eventPl(view.pendingEvent.id);
  const legal = new Set(canAct ? getLegalActions(view).map((a) => a.choice) : []);
  const choices = e.choices.map((c, i) => `<button class="choice-card" ${actAttr({ type: 'chooseEvent', choice: i })}${legal.has(i) ? '' : ' disabled'}><b>${esc(c.label)}</b>${legal.has(i) ? '' : '<small>teraz niedostępne</small>'}</button>`).join('');
  return `<div class="scene event"><div class="event-card">${sceneArtImg('event', view.pendingEvent.id)}<span class="scene-tag">Wydarzenie</span><h2>${esc(e.title)}</h2><p class="event-text">${esc(e.text)}</p><div class="choice-cards">${canAct ? choices : '<span class="thinking">Wybór…</span>'}</div></div></div>`;
}

function sceneShop(view, canAct) {
  if (pokeStopV2(view)) return sceneShopV2(view, canAct);
  const player = currentPlayer(view);
  const legal = canAct ? getLegalActions(view) : [];
  const buyable = new Set(legal.filter((a) => a.type === 'buy').map((a) => a.item));
  const tray = shopStock(view).map((id) => {
    const cost = price(id, view.config);
    const ok = buyable.has(id);
    // Evolution Stones are sold here only for now (DQ-78: placeholder source until 3B).
    const stone = ITEMS[id].kind === 'evolution';
    return `<button class="tray-item${ok ? '' : ' cant'}${stone ? ' stone' : ''}" ${actAttr({ type: 'buy', item: id })}${canAct && ok ? '' : ' disabled'}>
      <span class="tray-token">${itemToken(id, 54)}</span><b>${ITEM_PL[id]}</b><span class="price-tag">💰${cost}</span><small>masz ${itemCount(player, id)}${stone ? ' · kamień ewolucji (tymczasowo w sklepie)' : ''}</small></button>`;
  }).join('');
  const swap = canAct && canSwapQuests(view, player);
  const missions = (player.quests ?? []).map((q) => missionCard(q, { config: view.config, actions: swap ? btn({ type: 'swapQuest', target: q.questId }, '🔄 Wymień tę misję', 'mini') : '' })).join('');
  const team = player.team.map((m) => `<span class="heal-chip">${esc(getSpecies(m.species).name)} <b>${'♥'.repeat(m.hp)}</b></span>`).join('');
  return `
    <div class="scene shop">
      <div class="scene-head"><span class="scene-tag">Poké Stop</span><h2>🏪 Poké Stop</h2><span class="wallet">💰 ${player.money}</span></div>
      <div class="healed">💖 Drużyna wyleczona do pełna! ${team}</div>
      <div class="shop-tray">${tray}</div>
      <p class="small center">Dotknij żeton, żeby kupić. Zakupy nie kosztują akcji, dopóki jesteś w środku.</p>
      ${missions ? `<h3>Misje ${swap ? '<small>— możesz wymienić jedną za darmo</small>' : '<small>— wymiana już wykorzystana</small>'}</h3><div class="mission-row">${missions}</div>` : ''}
      <div class="row center">${canAct ? btn({ type: 'leaveShop' }, '🚪 Wyjdź z Poké Stopu', 'primary big') : ''}</div>
    </div>`;
}

// Gameplay P1 (DQ-89 / DQ-94): Sklep — 1 action for the whole visit, no heal;
// buy and sell any number of things; the mission swap.
function sceneShopV2(view, canAct) {
  const player = currentPlayer(view);
  const legal = canAct ? getLegalActions(view) : [];
  const buyable = new Set(legal.filter((a) => a.type === 'buy').map((a) => a.item));
  const tray = shopStock(view).map((id) => {
    const ok = buyable.has(id);
    const stone = ITEMS[id].kind === 'evolution';
    return `<button class="tray-item${ok ? '' : ' cant'}${stone ? ' stone' : ''}" ${actAttr({ type: 'buy', item: id })}${canAct && ok ? '' : ' disabled'}>
      <span class="tray-token">${itemToken(id, 54)}</span><b>${ITEM_PL[id]}</b><span class="price-tag">KUP 💰${price(id, view.config)}</span><small>masz ${itemCount(player, id)}${stone ? ' · kamień ewolucji' : ''}</small></button>`;
  }).join('');
  const sellable = new Set(canAct ? sellableItems(view) : []);
  const owned = Object.keys(view.config.economy).filter((id) => ITEMS[id] && itemCount(player, id) > 0 && sellPrice(id, view.config) > 0);
  const sellTray = view.config.rules.selling && owned.length ? owned.map((id) => {
    const ok = sellable.has(id);
    const lastBall = ITEMS[id].kind === 'ball' && !ok;
    return `<button class="tray-item sell${ok ? '' : ' cant'}" ${actAttr({ type: 'sell', item: id })}${canAct && ok ? '' : ' disabled'}>
      <span class="tray-token">${itemToken(id, 44)}</span><b>${ITEM_PL[id]}</b><span class="price-tag sell">SPRZEDAJ 💰${sellPrice(id, view.config)}</span><small>${lastBall ? 'ostatni ball zostaje' : `masz ${itemCount(player, id)}`}</small></button>`;
  }).join('') : '';
  const swap = canAct && canSwapQuests(view, player);
  const missions = (player.quests ?? []).map((q) => missionCard(q, { config: view.config, actions: swap ? btn({ type: 'swapQuest', target: q.questId }, '🔄 Wymień tę misję', 'mini') : '' })).join('');
  // one swap per player turn, even with two Sklep visits
  const swapNote = questSwapUsedThisTurn(view) ? '<small>— misję można wymienić raz na turę</small>' : swap ? '<small>— możesz wymienić jedną za darmo</small>' : '';
  return `
    <div class="scene shop">
      <div class="scene-head"><span class="scene-tag">Poké Stop</span><h2>${gi('shop')} Sklep</h2><span class="tag">1 akcja</span><span class="wallet">💰 ${player.money}</span></div>
      <h3>Kup</h3>
      <div class="shop-tray">${tray}</div>
      ${sellTray ? `<h3>Sprzedaj <small>— za połowę ceny</small></h3><div class="shop-tray sell">${sellTray}</div>` : ''}
      <p class="small center">Kupuj i sprzedawaj, ile chcesz — cała wizyta w sklepie to jedna akcja. Leczenie to osobna akcja.</p>
      ${missions ? `<h3>Misje ${swapNote}</h3><div class="mission-row">${missions}</div>` : ''}
      <div class="row center">${canAct ? btn({ type: 'leaveShop' }, '🚪 Wyjdź ze sklepu', 'primary big') : ''}</div>
    </div>`;
}

// Gameplay P1 (DQ-95): a catch with a full team — to the team (pick who goes
// to Oak's Box) or to Professor Oak.
function sceneBoxChoice(view, canAct) {
  const player = currentPlayer(view);
  const caught = player.reserve.find((m) => m.uid === view.boxChoice.uid);
  const name = getSpecies(caught.species).name;
  const cards = player.team.map((mon) => `<div class="pick">${pokemonCard(mon, { size: 's', growth: growthRules(view), family: true })}${canAct ? btn({ type: 'boxKeep', target: mon.uid }, `${gi('box')} Do Boxu`, '') : ''}</div>`).join('');
  return `
    <div class="scene box-pick">
      <div class="scene-head"><span class="scene-tag">Box Oaka</span><h2>Drużyna jest pełna!</h2></div>
      <div class="box-new">${pokemonCard(caught, { size: 'm', growth: growthRules(view), family: true })}
        <div><p><b>${esc(name)}</b> — co dalej?</p>
          ${canAct ? btn({ type: 'boxSend' }, `${gi('send-to-oak')} Wyślij do Oaka`, 'primary big') : `<span class="thinking">${esc(player.name)} wybiera…</span>`}</div></div>
      <h3>…albo Do drużyny: kto jedzie do Boxu Oaka?</h3>
      <div class="pick-row">${cards}</div>
    </div>`;
}

// Macro 01: Professor Oak's lab in Pallet Town — the emergency kit, the
// Research Jobs (A / B), the job running now. Kid-simple: what goes, for how
// long, what comes back.
const JOB_PL = { A: 'Zadanie A', B: 'Zadanie B' };
const jobRewardPl = (reward) => reward.map((r) => (r.type === 'money' ? `💰${r.amount}` : `${itemIc(r.type === 'pokeballs' ? 'pokeball' : r.type)} ${ITEM_PL[r.type === 'pokeballs' ? 'pokeball' : r.type]}`)).join(' + ');
// One Kanto day 14.10 (rules.oakResearch): what a job pays — new species for Oak or a repeat
const researchPl = (job) => (job === 'A' ? `nowy gatunek dla Oaka: ${jobRewardPl(RESEARCH_REWARDS.A.fresh)} · już badany: ${jobRewardPl(RESEARCH_REWARDS.A.repeat)}` : `co najmniej 2 nowe gatunki: ${jobRewardPl(RESEARCH_REWARDS.B.fresh)} · inaczej: ${jobRewardPl(RESEARCH_REWARDS.B.repeat)}`);
const jobPayPl = (view, job, spec) => (usesResearch(view) ? researchPl(job) : jobRewardPl(spec.reward));

function sceneOak(view, canAct) {
  const player = currentPlayer(view);
  const legal = canAct ? getLegalActions(view) : [];
  const kit = legal.some((a) => a.type === 'oakKit')
    ? `<div class="oak-kit">${gi('oak.kit')}<div><b>Nie masz balli ani pieniędzy?</b><p>Awaryjny Poké Ball — raz na grę.</p></div>${btn({ type: 'oakKit' }, 'Weź awaryjny Poké Ball', 'primary big')}</div>`
    : usesOakKit(view) && player.oakKitUsed ? '<p class="small muted center">Awaryjny Poké Ball: już wykorzystany.</p>' : '';
  const job = player.oakJob;
  const now = job
    ? `<div class="oak-away">${gi('oak.away')}<div><b>W pracy u Oaka:</b> ${job.pokemon.map((m) => esc(getSpecies(m.species).name)).join(', ')}</div><span class="tag">wracają za ${turnsPl(job.turnsLeft)}</span></div>`
    : '';
  // the jobs live in Pallet Town only (the kit may also come at a Poké Stop: oak.kitWhere 'stop')
  const cards = usesOakJobs(view) && atOakLab(view, player) ? JOB_IDS.map((id) => {
    const spec = view.config.oak.jobs[id];
    const ok = legal.some((a) => a.type === 'oakJob' && a.job === id);
    const why = !canAct ? '' : job ? 'Masz już zadanie u Oaka.' : view.turn.actionsRemaining < view.config.oak.jobCost ? 'Brak akcji w tej turze.' : `Potrzebujesz ${spec.size} zdrowych Pokémonów — drużyna zatrzymuje jednego.`;
    return `<div class="oak-job${ok ? '' : ' muted'}"><h3>${JOB_PL[id]}</h3><p>${spec.size} ${spec.size === 1 ? 'Pokémon' : 'Pokémony'} · ${turnsPl(spec.turns)}</p><p class="reward">Nagroda: ${jobPayPl(view, id, spec)}</p>
      ${canAct ? btn({ type: 'oakJob', job: id }, spec.size === 1 ? 'Wybierz Pokémona' : 'Wybierz Pokémony', 'primary', !ok) : ''}${ok || !why ? '' : `<small>${esc(why)}</small>`}</div>`;
  }).join('') : '';
  return `
    <div class="scene oak">
      <div class="scene-head"><span class="scene-tag">${esc(placeName(player.location))}</span><h2>🔬 Profesor Oak</h2>${cards ? `<span class="tag">zadanie: ${view.config.oak.jobCost} akcja</span>` : ''}</div>
      ${kit}${now}
      ${cards ? `<div class="oak-jobs">${cards}</div>
      <p class="small center">Pokémony pracują, a Ty podróżujesz dalej. Wracają same — do drużyny albo do Boxu. W pracy nie leczą się i nie trenują.</p>` : ''}
      <div class="row center">${uiBtn('close-panel', 'Zamknij', 'ghost')}</div>
    </div>`;
}

// One Kanto day 14.10 (rules.achievements): 🏆 a player's trophies — earned (✓ and the week), the rest with
// their progress, by category; the points (provisional, for a future score). A tab per player (default: whose turn).
function sceneTrophies(view, playerId = null) {
  const player = view.players.find((p) => p.id === playerId) ?? currentPlayer(view);
  if (!player.achievements) return '';
  const rows = achievementProgress(player, view.config);
  const byCat = Object.entries(ACHIEVEMENT_CATEGORIES_PL).map(([cat, label]) => {
    const list = rows.filter((a) => a.category === cat);
    if (!list.length) return '';
    return `<div class="trophy-cat"><h3>${esc(label)}</h3>${list.map((a) => `<div class="trophy${a.earned != null ? ' earned' : ''}"><span class="trophy-icon">${a.earned != null ? '🏆' : a.icon}</span><div><b>${esc(a.name)}</b> <small>${esc(a.pl)}</small><p class="small">${esc(a.text)}</p></div><span class="trophy-state">${a.earned != null ? `✓ tydz. ${a.earned}` : `${a.value} / ${a.target}`}</span></div>`).join('')}</div>`;
  }).join('');
  const tabs = view.players.length > 1 ? `<div class="row center trophy-tabs">${view.players.map((p) => `<button class="${p.id === player.id ? 'primary' : 'ghost'} small" data-ui="open-trophies" data-player="${esc(p.id)}">${avatarToken(p, 'small')} ${esc(p.name)} · ${p.achievements ? achievementPoints(p, view.config) : 0} pkt</button>`).join('')}</div>` : '';
  return `<div class="scene trophies-scene"><div class="scene-head"><span class="scene-tag">Osiągnięcia</span><h2>🏆 ${esc(player.name)}</h2><span class="tag">${achievementPoints(player, view.config)} pkt</span></div>
    ${tabs}<div class="trophy-grid">${byCat}</div>
    <p class="small center muted">Punkty są na próbę — dziś nie zmieniają końca gry.</p>
    <div class="row center">${uiBtn('close-panel', 'Zamknij', 'ghost')}</div></div>`;
}

// One Kanto day 14.10 (rules.pvp): a friendly duel — the challenge, one Pokémon each, then the battle table
// (the same arena as every battle: two cards, the dice in the middle; the side whose move it is attacks).
function sceneDuel(view, ui, canAct, reveal = null) {
  const d = view.pvp;
  const legal = canAct ? getLegalActions(view) : [];
  const name = (id) => view.players.find((x) => x.id === id).name;
  const head = (title) => `<div class="scene-head"><span class="scene-tag">Pojedynek</span><h2>${title}</h2><span class="tag">bez akcji</span></div>`;
  const rule = '<p class="small center muted">Pojedynek na niby: bez łapania i bez nagród. Po walce Pokémony wracają do zdrowia.</p>';
  if (d.stage === 'ask') {
    const accept = legal.find((a) => a.type === 'pvpAccept');
    return `<div class="scene trade-scene">${head(`⚔️ ${esc(name(d.a))} wyzywa ${esc(name(d.b))}!`)}
      <p class="trade-summary">Jeden Pokémon na jednego.</p>${rule}
      <div class="row center">${accept ? btn(accept, `✓ ${esc(name(d.b))}: przyjmuję!`, 'primary') : ''}${legal.some((a) => a.type === 'pvpCancel') ? btn({ type: 'pvpCancel' }, 'Nie teraz', 'ghost') : ''}</div></div>`;
  }
  if (d.stage === 'pick') {
    const side = (id) => {
      const p = view.players.find((x) => x.id === id);
      const card = (m) => {
        const a = legal.find((x) => x.type === 'pvpPick' && x.by === id && x.target === m.uid);
        const chosen = d.pick[id] === m.uid;
        return `<div class="pick${chosen ? ' chosen' : ''}">${pokemonCard(m, { size: 's', growth: growthRules(view), family: true })}${chosen ? '<b class="ok">✓ wybrany</b>' : a ? btn(a, 'Ten walczy', 'mini') : ''}</div>`;
      };
      return `<div class="trade-side"><h3>${avatarToken(p, 'small')} ${esc(p.name)}</h3><div class="pick-row">${p.team.filter((m) => m.hp > 0).map(card).join('')}</div></div>`;
    };
    return `<div class="scene trade-scene">${head('⚔️ Kto walczy?')}<div class="trade-sides">${side(d.a)}${side(d.b)}</div>${rule}
      <div class="row center">${legal.some((a) => a.type === 'pvpCancel') ? btn({ type: 'pvpCancel' }, 'Anuluj', 'ghost') : ''}</div></div>`;
  }
  const [pa, pb] = [d.a, d.b].map((id) => view.players.find((x) => x.id === id));
  const [ma, mb] = [pa, pb].map((p) => p.team.find((m) => m.uid === d.pick[p.id]));
  const step = reveal?.steps[reveal.i] ?? null;
  const mover = step?.type === 'attack' ? (step.attackerUid === ma.uid ? pa.id : pb.id) : step ? null : d.next;
  // PLAYTEST_007 2C: the type hint as in every battle — or hidden at the table's wish (⚙️ „Pojedynki: przewaga typów”);
  // the types still count in the roll either way (the math is the engine's)
  const fight = (x, y) => (ui.duelHints === false ? null : { type: typeHint(x, y, view.config).mod });
  const card = (p, m, foe) => pokemonCard(m, { size: 'l', label: p.name, ownerToken: playerToken(p, { size: 's' }), growth: growthRules(view), fight: fight(m, foe), actor: mover === p.id });
  const table = step ? `${renderStep(step, { rolling: reveal.rolling, view })}${uiBtn('skip', 'Pomiń ⏩', 'ghost small skip')}` : lastExchange(ui);
  const attack = legal.find((a) => a.type === 'pvpAttack');
  const give = legal.find((a) => a.type === 'pvpYield');
  const nextMon = d.next === pa.id ? ma : mb;
  const choices = `<div class="battle-actions">${attack ? btn(attack, `⚔️ ${esc(name(attack.by))}: atakuj!`, 'act-attack primary') : `<button class="act-attack" disabled>⚔️ ${esc(name(d.next))}: atakuj!</button>`}
      ${moveButton(view, nextMon, legal.find((a) => a.type === 'pvpMove') ?? null, d.used)}
      ${give ? btn(give, 'Poddaję się', 'ghost small') : ''}</div>`;
  return `<div class="scene encounter compact k-duel"><div class="scene-head"><span class="scene-tag">Pojedynek</span><h2>⚔️ ${esc(pa.name)} kontra ${esc(pb.name)}</h2></div>
    <div class="arena">
      <div class="side mine">${card(pa, ma, mb)}</div>
      <div class="middle"><div class="exchange-area">${table}</div>${choices}</div>
      <div class="side theirs">${card(pb, mb, ma)}</div>
    </div></div>`;
}

// One Kanto day 14.10 (rules.trading): two players at one Poké Stop swap one Pokémon each. One device, both
// sides on screen: each picks „Daję tego”, both see the summary, both tap „Zgoda” — or anyone „Anuluj”.
function sceneTrade(view) {
  const t = view.trade;
  const legal = getLegalActions(view);
  const side = (id) => {
    const p = view.players.find((x) => x.id === id);
    const picks = legal.filter((a) => a.type === 'tradePick' && a.by === id);
    const card = (m) => {
      const a = picks.find((x) => x.target === m.uid);
      const chosen = t.pick[id] === m.uid;
      return `<div class="pick${chosen ? ' chosen' : ''}">${pokemonCard(m, { size: 's', growth: growthRules(view), family: true })}<small>${p.team.includes(m) ? 'drużyna' : 'Box'}</small>${chosen ? '<b class="ok">✓ wybrany</b>' : a ? btn(a, 'Daję tego', 'mini') : ''}</div>`;
    };
    return `<div class="trade-side"><h3>${avatarToken(p, 'small')} ${esc(p.name)}</h3><div class="pick-row">${[...p.team, ...p.reserve].map(card).join('')}</div></div>`;
  };
  const name = (id) => view.players.find((x) => x.id === id).name;
  const mon = (id) => [...view.players.find((x) => x.id === id).team, ...view.players.find((x) => x.id === id).reserve].find((m) => m.uid === t.pick[id]);
  const summary = mon(t.a) && mon(t.b) ? `<p class="trade-summary"><b>${esc(name(t.a))}</b> daje <b>${esc(getSpecies(mon(t.a).species).name)}</b> ↔ <b>${esc(name(t.b))}</b> daje <b>${esc(getSpecies(mon(t.b).species).name)}</b></p>` : '<p class="trade-summary muted">Każdy wybiera jednego Pokémona.</p>';
  const problem = mon(t.a) && mon(t.b) ? tradeProblem(view) : null;
  const agree = (id) => (t.agree[id] ? `<span class="tag ok">✓ ${esc(name(id))} się zgadza</span>` : (legal.find((a) => a.type === 'tradeAgree' && a.by === id) ? btn({ type: 'tradeAgree', by: id }, `✓ ${esc(name(id))}: zgoda`, 'primary') : ''));
  return `<div class="scene trade-scene"><div class="scene-head"><span class="scene-tag">Poké Stop</span><h2>🔄 Wymiana Pokémonów</h2><span class="tag">bez akcji</span></div>
    ${summary}${problem ? `<p class="small center bad">Nie da się: ${esc(problem === `${name(t.a)} would have no healthy Pokémon in the team` || problem === `${name(t.b)} would have no healthy Pokémon in the team` ? 'ktoś zostałby bez zdrowego Pokémona w drużynie' : 'oboje muszą stać w tym samym Poké Stopie')}</p>` : ''}
    <div class="row center">${agree(t.a)}${agree(t.b)}${btn({ type: 'tradeCancel' }, 'Anuluj', 'ghost')}</div>
    <div class="trade-sides">${side(t.a)}${side(t.b)}</div>
    <p class="small center muted">Wymiana nic nie kosztuje. Pokémon przechodzi cały — z HP i treningiem.</p></div>`;
}

// Macro 01: who goes on the Research Job — one tap per Pokémon; the last one starts it.
function sceneOakDraft(view, canAct) {
  const player = currentPlayer(view);
  const draft = view.oakJobDraft;
  const spec = view.config.oak.jobs[draft.job];
  const picks = canAct ? getLegalActions(view).filter((a) => a.type === 'oakJobPick') : [];
  const all = [...player.team, ...player.reserve];
  const chosen = draft.picked.map((uid) => all.find((m) => m.uid === uid)).filter(Boolean);
  const card = (a) => {
    const mon = all.find((m) => m.uid === a.target);
    const from = player.team.includes(mon) ? 'z drużyny' : 'z Boxu';
    const fresh = usesResearch(view) && !(player.oakStudied ?? []).includes(mon.species) ? ' · 🔬 nowy dla Oaka' : '';
    return `<div class="pick">${pokemonCard(mon, { size: 's', growth: growthRules(view), family: true })}<small>${from}${fresh}</small>${btn(a, 'Do pracy', 'primary')}</div>`;
  };
  return `
    <div class="scene oak-pick">
      <div class="scene-head"><span class="scene-tag">Profesor Oak</span><h2>🔬 ${JOB_PL[draft.job]}: kto idzie do pracy?</h2><span class="tag">${draft.picked.length}/${spec.size}</span></div>
      ${chosen.length ? `<p class="center">Idą: <b>${chosen.map((m) => esc(getSpecies(m.species).name)).join(', ')}</b></p>` : ''}
      <div class="pick-row">${canAct ? picks.map(card).join('') : `<span class="thinking">${esc(player.name)} wybiera…</span>`}</div>
      <p class="small center">Ostatni wybór zaczyna zadanie (${view.config.oak.jobCost} akcja). Wracają za ${turnsPl(spec.turns)} z nagrodą: ${jobPayPl(view, draft.job, spec)}. Drużyna zatrzymuje zdrowego Pokémona.</p>
      <div class="row center">${canAct ? btn({ type: 'oakJobCancel' }, 'Anuluj', 'ghost') : ''}</div>
    </div>`;
}

function sceneLoot(view, canAct) {
  const opts = canAct ? getLegalActions(view).filter((a) => a.type === 'giveLoot') : [];
  const player = currentPlayer(view);
  return `
    <div class="scene loot">
      <div class="event-card">
        <span class="scene-tag rocket">Team Rocket</span><h2>😼 Meowth chce przedmiot!</h2>
        <p>Wybierz, co oddasz. Trafi na kartę spisku i wróci, gdy ktoś pokona Team Rocket.</p>
        <div class="shop-tray">${opts.map((a) => `<button class="tray-item" ${actAttr(a)}><span class="tray-token">${itemToken(a.item, 54)}</span><b>${ITEM_PL[a.item] ?? a.item}</b><small>masz ${itemCount(player, a.item)}</small></button>`).join('') || '<span class="thinking">Wybór…</span>'}</div>
        ${rocketPlotCard(view, { size: 's' })}
      </div>
    </div>`;
}

function sceneLeague(view, canAct) {
  const player = currentPlayer(view);
  const lance = LEAGUE.stages[1];
  const legal = canAct ? getLegalActions(view) : [];
  const cards = player.team.map((m) => {
    const acts = legal.filter((a) => (a.type === 'useItem' || a.type === 'setLead') && a.target === m.uid)
      .map((a) => btn(a, a.type === 'setLead' ? 'Prowadź' : `${itemIc(a.item)} ${ITEM_PL[a.item]}`, 'mini')).join(''); // every healing item of this game (Gameplay P1: + Super Potion)
    // PT006-06: the type +/- against the next opponent's first Pokémon, as before the first battle
    return `<div class="card-with-actions">${pokemonCard(m, { size: 's', lead: m === getLead(player), growth: growthRules(view), family: true })}${m.hp > 0 ? matchupBadges(view, m, leagueStageTeam(view, 1)[0]) : ''}<div class="pcard-actions">${acts}</div></div>`;
  }).join('');
  return `
    <div class="scene league-break">
      <div class="event-card">
        <span class="scene-tag league">Liga — przerwa</span><h2>🎀 Elitarna Czwórka pokonana!</h2>
        <p><b>Bez pełnego leczenia:</b> obrażenia zostają. Możesz użyć ${healingItems(view.config).map((id) => ITEM_PL[id]).join(' / ')} i wybrać prowadzącego. Potem ${esc(LEAGUE_STAGE_PL.lance)} i ${esc(leagueStageTeam(view, 1).map((id) => getSpecies(id).name).join(', '))}.</p>
        <div class="team-row center">${cards}</div>
        <div class="row center">${canAct ? btn({ type: 'continueLeague' }, '👑 Dalej: walka z Lance’em', 'primary big') : '<span class="thinking">Przygotowania…</span>'}</div>
      </div>
    </div>`;
}

// Build 3.3 B33-3: the intermission of a gym chain / League v2 — no Poké Stop,
// damage stays; items and the lead, then the next battle or leave (the attempt
// starts over next time).
function sceneChallenge(view, canAct) {
  const player = currentPlayer(view);
  const c = view.challenge;
  const all = chainOpponents(view, c);
  const beaten = all[c.stage];
  const next = all[c.stage + 1];
  const legal = canAct ? getLegalActions(view) : [];
  const cards = player.team.map((m) => {
    const acts = legal.filter((a) => (a.type === 'useItem' || a.type === 'setLead') && a.target === m.uid)
      .map((a) => btn(a, a.type === 'setLead' ? 'Prowadź' : `${itemIc(a.item)} ${ITEM_PL[a.item]}`, 'mini')).join('');
    // PT006-06: the type +/- against the next opponent's first Pokémon — before every trainer and the leader
    return `<div class="card-with-actions">${pokemonCard(m, { size: 's', lead: m === getLead(player), growth: growthRules(view), family: true })}${m.hp > 0 && next ? matchupBadges(view, m, next.team[0]) : ''}<div class="pcard-actions">${acts}</div></div>`;
  }).join('');
  const league = c.kind === 'league';
  const ribbon = league && next?.champion;
  const go = legal.some((a) => a.type === 'continueChallenge');
  return `
    <div class="scene league-break challenge-break">
      <div class="event-card">
        <span class="scene-tag ${league ? 'league' : 'gym'}">${league ? 'Liga — przerwa' : 'Sala — przerwa'}</span>
        <h2>${ribbon ? '🎀 Elitarna Czwórka pokonana!' : `Wygrana z: ${esc(chainName(beaten))}!`}</h2>
        ${chainStrip(view, c, c.stage + 1)}
        <p><b>Bez Poké Stopu:</b> obrażenia zostają. Możesz użyć ${healingItems(view.config).map((id) => ITEM_PL[id]).join(' / ')} i wybrać prowadzącego.</p>
        <div class="team-row center">${cards}</div>
        <div class="next-up">${chainToken(next, 's')}<b>Dalej: ${esc(chainName(next))}</b><div class="roster-cards">${next.team.map((id) => speciesCard(id, { size: 'xs' })).join('')}</div></div>
        <div class="row center">${canAct ? `${go ? btn({ type: 'continueChallenge' }, `${league && next.champion ? '👑' : league ? '🏆' : '🏟️'} Dalej: ${esc(chainName(next))}`, 'primary big') : ''}${btn({ type: 'quitChallenge' }, '🚪 Wyjdź', 'ghost')}` : '<span class="thinking">Przygotowania…</span>'}</div>
        ${canAct ? `<p class="small muted">Wyjście albo przegrana: następnym razem ${league ? 'Liga' : 'sala'} od początku.${ribbon ? ' Wstęga zostaje w gablocie.' : ''}</p>` : ''}
      </div>
    </div>`;
}

// EREV-02: what „Porzuć” means, said before the tap.
function dropNote(view, player, a, q) {
  const keys = (player.questRecords.occ[a.occ]?.keys ?? []).filter((k) => player.questBook.keyItems.includes(k));
  const back = keys.length ? ` ${keys.map(keyItemPl).join(', ')} wraca.` : '';
  if (q.repeat !== 'never' || view.config.rules.questAbandon === 'v2') return `Porzucone zadanie możesz wziąć znowu — zaczniesz od początku.${back}`;
  return 'Porzucone zadanie nie wróci w tej grze.';
}

// Build 3.3 E5: a pilot gym's trial on its card — open, the steps (with progress), or passed.
function trialBox(view, player, gym) {
  const entry = view.gymTrials?.byGym[gym.id];
  if (!entry || !player.knownTrials) return '';
  if (entry.mode === 'open') return '<div class="trial-box open">🏟️ Próba sali: <b>bez próby</b> — sala otwarta.</div>';
  if (player.trialsDone.includes(gym.id)) return '<div class="trial-box done">🏟️ Próba sali: <b>zaliczona ✓</b></div>';
  const t = (player.questBook.trials ?? []).find((x) => x.gym === gym.id);
  if (!t) return '<div class="trial-box">🏟️ Próba sali: ???</div>';
  const q = bookQuest(t.questId);
  const steps = q.stages[t.stage]?.objectives.map((o, i) => {
    const d = objectiveProgress(player, t, o, i);
    const n = objectiveTarget(o);
    return `<li class="${d >= n ? 'done' : ''}">${d >= n ? '✓ ' : ''}${esc(bookStepPl(o, d, n).replace('Wyzwanie z misji', 'Wyzwanie z próby'))}</li>`;
  }).join('') ?? '';
  return `<div class="trial-box ${entry.mode}">🏟️ Próba sali (${entry.mode === 'short' ? 'krótka' : 'specjalna'}):<ul class="book-steps">${steps}</ul></div>`;
}

// Build 3.3 E3: the quest book — your quests (the next step, its place, the reward),
// what can be taken here, the quest challenge, collecting the reward. Kid-simple: one
// sentence per step, the place, icons for the reward.
// PLAYTEST_007 stage 4: a place in the Journal → the map shows it (the Pokédex's „Gdzie szukać”, M02-1) and the bar
// offers „📖 Wróć do Dziennika” (main.js locate-place). „Każdy Poké Stop” is no one place: said, not pointed at.
function placeBtn(place, activityId) {
  if (!place || place === 'pokeStop') return place === 'pokeStop' ? '<span class="j-place any">📍 każdy Poké Stop</span>' : '';
  return `<button class="j-place" data-ui="locate-place" data-place="${esc(place)}" data-journal="${esc(activityId)}" aria-label="Pokaż na mapie: ${esc(placeName(place))}">📍 ${esc(placeName(place))}</button>`;
}
// „Porzuć” is destructive: the first tap asks, the second (the engine's legal action) gives up
function abandonBtns(ui, drop) {
  if (!drop) return '';
  return ui.confirmAbandon === drop.occ
    ? `${btn(drop, 'Na pewno porzucić?', 'ghost small danger')}${uiBtn('journal-abandon-cancel', 'Nie', 'ghost small')}`
    : uiBtn('journal-abandon', 'Porzuć', 'ghost small', `data-occ="${esc(drop.occ)}"`);
}

// PLAYTEST_008 (Piotr 15.10): ONE tile for every activity of the Journal — a quest of the book, a mission card, an
// expedition, a rumour, an offer, a finished one. The full card art on the left (3 : 4, never a thumbnail); on the
// right, as tall as the card: the kind in the frame's top-left corner (its colour), the status top right (green
// „Aktywna”), the title, and always the same rows in the same words — Opis · Cel · Dokąd (a place → the map) · Nagroda.
const TILE_STATUS = { accepted: ['on', 'Aktywna'], inProgress: ['on', 'Aktywna'], ready: ['ready', 'Gotowa — odbierz'], heard: ['new', 'Usłyszana'], available: ['new', 'Do wzięcia'], completed: ['off', 'Ukończona'], abandoned: ['off', 'Porzucona'] };
const TILE_ACT = { claimQuest: '🎁 Odbierz nagrodę', questChallenge: '⚔️ Wyzwanie z misji (1 akcja)', questEncounter: '📍 Spotkanie z wyprawy (1 akcja)', takeQuest: '📜 Weź zadanie' };
const REWARD_TOKENS = REWARD_TOKEN_TYPES;
const tileKind = (e) => { const k = activityKind(e); return [k.cls, k.label, k.icon]; }; // journal.ACTIVITY_KINDS (the HUD's too)
// the reward as everywhere: the item tokens; in words only what has no token (a Pokémon, a clue, a key item, an encounter)
function tileReward(view, player, e) {
  if (e.sourceSystem === 'missionCard') return rewardTokens(questReward(QUESTS_BY_ID[e.questId], view.config).filter((r) => r.type !== 'stars'));
  const q = bookQuest(e.questId);
  const lines = q ? rewardLines(view, player, q) : [];
  if (!lines.length) return e.rewardPreview ? esc(e.rewardPreview) : '—';
  const words = lines.filter((r) => !REWARD_TOKENS.has(r.type));
  return `${rewardTokens(lines.filter((r) => REWARD_TOKENS.has(r.type)))}${words.length ? ` <span>${esc(rewardPl(words))}</span>` : ''}`;
}
function tileGoal(player, e) {
  if (e.completionStatus === 'ready') return '✓ Gotowe — odbierz nagrodę';
  if (e.section === 'done') return esc(e.nextStep);
  if (e.sourceSystem === 'rumour') return esc(e.nextStep); // heard: first take it there (its steps: „Szczegóły”)
  const now = e.objectives.filter((o) => o.stage === 'now');
  const keys = (player.questRecords?.occ[e.occ]?.keys ?? []).filter((k) => player.questBook?.keyItems.includes(k));
  const items = now.map((o) => `<span class="jt-obj${o.done ? ' done' : ''}">${o.done ? '✓ ' : ''}${esc(o.text)}</span>`).join('');
  return `${items}${keys.length ? `<span class="jt-obj">${gi('bag')} ${esc(keys.map(keyItemPl).join(', '))}</span>` : ''}`;
}
export function activityTile(view, ui, player, e) {
  const [kind, kindLabel, icon] = tileKind(e);
  const [st, stLabel] = TILE_STATUS[e.completionStatus] ?? ['', ''];
  const art = e.cardArt ? sceneArtFor(e.cardArt.kind, e.cardArt.id) : null;
  const pic = art ? `<img src="${esc(art.url)}" alt="" loading="lazy" decoding="async" draggable="false">` : `<span class="jt-fallback" aria-hidden="true">${icon}</span>`;
  const row = (label, body) => `<div class="jt-row"><small>${label}</small><div>${body}</div></div>`;
  const where = e.section === 'done' ? '—' : (e.destination ? placeBtn(e.destination, e.activityId) : 'dowolne miejsce');
  const acts = e.availableActions.filter((a) => TILE_ACT[a.type]).map((a) => btn(a, TILE_ACT[a.type], 'primary')).join('');
  const drop = e.availableActions.find((a) => a.type === 'abandonQuest');
  const asking = drop && ui.confirmAbandon === drop.occ;
  const q = e.questId && e.sourceSystem !== 'missionCard' ? bookQuest(e.questId) : null;
  const sub = [e.giver ? `od: ${e.giver}` : '', e.stages > 1 && ['accepted', 'inProgress'].includes(e.completionStatus) ? `etap ${e.currentStage}/${e.stages}` : ''].filter(Boolean).join(' · ');
  return `<article class="j-tile k-${kind} st-${st || 'none'}">
    <span class="jt-kind">${kindLabel}</span>${stLabel ? `<span class="jt-status">${stLabel}</span>` : ''}
    <div class="jt-art">${pic}</div>
    <div class="jt-info">
      <h4 class="jt-title">${esc(e.title)}</h4>${sub ? `<small class="jt-giver">${esc(sub)}</small>` : ''}
      <div class="jt-rows">${row('Opis', e.description && e.sourceSystem !== 'missionCard' ? esc(e.description) : '—')}${row('Cel', tileGoal(player, e))}${row('Dokąd', where)}${row('Nagroda', tileReward(view, player, e))}</div>
      ${e.blockedReason && e.blockedCode !== 'goTo' ? `<p class="book-now wait">${esc(e.blockedReason)}</p>` : ''}
      ${asking && q ? `<p class="book-drop muted">${esc(dropNote(view, player, player.questBook.active.find((x) => x.occ === drop.occ), q))}</p>` : ''}
      <div class="jt-acts">${acts}${abandonBtns(ui, drop)}${uiBtn('journal-open', 'Szczegóły ›', 'ghost small', `data-id="${esc(e.activityId)}"`)}</div>
    </div>
  </article>`;
}

// The TRAINER JOURNAL (PLAYTEST_007 stage 4 — the quest book grown into the one place for every activity; a read-only
// projection: table/journal.js). All sections by default, a tab filters; a card opens its detail (ui.journalPick).
// PLAYTEST_008: every list is made of the same tile (activityTile).
function sceneBook(view, ui, canAct) {
  const player = currentPlayer(view);
  if (!player.questBook) return ''; // older games have no quest book
  const legal = canAct ? getLegalActions(view) : [];
  const act = (type, key, val) => legal.find((a) => a.type === type && a[key] === val);
  const J = journal(view, player);
  const byId = new Map(J.entries.map((e) => [e.activityId, e]));
  if (ui.journalPick && byId.has(ui.journalPick)) return journalDetail(view, ui, byId.get(ui.journalPick), act);
  const tiles = (section, pred = () => true) => J.entries.filter((e) => e.section === section && pred(e)).map((e) => activityTile(view, ui, player, e));
  const mineList = tiles('mine');
  const expList = tiles('expeditions');
  const rumourList_ = tiles('rumours');
  const hereList = tiles('available', (e) => e.availableActions.length > 0);
  const doneList = tiles('done');
  const fightFor = (gymId) => { const t = (player.questBook.trials ?? []).find((x) => x.gym === gymId); const f = t && act('questChallenge', 'occ', t.occ); return f ? `<div class="row">${btn(f, '⚔️ Wyzwanie z próby (1 akcja)', 'primary')}</div>` : ''; };
  // E5: the trials this player knows (pilot gyms), with ??? for those not yet visited
  const trials = view.gymTrials ? Object.keys(view.gymTrials.byGym).map((gymId) => {
    const g = GYMS_BY_ID[gymId];
    const known = player.knownTrials.includes(gymId);
    return `<div class="book-card trial"><div class="book-head"><b>Sala w ${esc(getLocation(g.city).name)}</b><small>${esc(leaderPl(g))}</small></div>${known ? trialBox(view, player, g) : '<div class="trial-box">🏟️ ??? — odwiedź miasto, by poznać próbę</div>'}${fightFor(gymId)}</div>`;
  }).join('') : '';
  // the sections (PLAYTEST_007 stage 4): all by default; a tab shows one — each tab counts the cards it shows
  const counts = { mine: mineList.length, expeditions: expList.length, rumours: rumourList_.length, available: hereList.length, done: doneList.length };
  const count = (key) => counts[key];
  const tab = ui.journalTab ?? 'all';
  const show = (key) => tab === 'all' || tab === key;
  const tabs = [{ key: 'all', label: 'Wszystko' }, ...JOURNAL_SECTIONS].map((t) => `<button class="j-tab${tab === t.key ? ' on' : ''}" data-ui="journal-tab" data-tab="${t.key}">${t.label}${t.key === 'all' ? '' : ` <small>${count(t.key)}</small>`}</button>`).join('');
  const L = J.limits;
  const limits = `Misje z księgi ${L.book.used}/${L.book.max} · plotka / wyprawa ${L.rumour.used}/${L.rumour.max} · karty misji ${L.cards.used}/${L.cards.max}`;
  const section = (key, title, list, empty) => (show(key) ? `<h3>${title}</h3>${list.length ? `<div class="j-tiles">${list.join('')}</div>` : `<p class="muted small">${empty}</p>`}` : '');
  return `<div class="scene book-scene journal"><div class="scene-head"><span class="scene-tag">Dziennik Trenera</span><h2>${esc(player.name)}</h2><small class="j-limits">${limits}</small></div>
    <div class="j-tabs" role="tablist">${tabs}</div>
    ${section('mine', 'Moje misje', mineList, 'Nie masz misji — weź je w Poké Stopie.')}
    ${trials && show('mine') ? `<h3>Próby sal</h3><div class="book-cards">${trials}</div>` : ''}
    ${section('expeditions', 'Wyprawy', expList, 'Żadnej wyprawy — o wyprawach mówią plotki.')}
    ${section('rumours', 'Plotki', rumourList_, 'Jeszcze żadnej plotki — słychać je w Poké Stopach.')}
    ${section('available', 'Dostępne tutaj', hereList, 'Tutaj nie ma zadań do wzięcia.')}
    ${section('done', 'Ukończone i porzucone', doneList, 'Jeszcze nic.')}
    <div class="row center">${uiBtn('close-panel', 'Zamknij', 'ghost')}</div></div>`;
}

// PLAYTEST_007 stage 4: one activity, large — the picture on one side; the name, what it is, every step (done ✓,
// now, later), the reward, the next step and the places on the other; the engine's legal actions only.
function journalDetail(view, ui, e, act) {
  const player = currentPlayer(view);
  const [kind, kindLabel, icon] = tileKind(e); // PLAYTEST_008: the tile's kind, status and rows, large
  const [st, stLabel] = TILE_STATUS[e.completionStatus] ?? ['', ''];
  const art = e.cardArt ? sceneArtFor(e.cardArt.kind, e.cardArt.id) : null;
  const pic = art ? `<img class="j-art" src="${esc(art.url)}" alt="" draggable="false">` : `<div class="j-art fallback" aria-hidden="true">${icon}</div>`;
  const objectives = e.objectives.map((o) => `<li class="j-obj ${o.stage}${o.done ? ' done' : ''}">${o.done ? '✓ ' : o.stage === 'later' ? '… ' : ''}${esc(o.text)}${o.place && o.stage !== 'past' && !o.done ? ` ${placeBtn(o.place, e.activityId)}` : ''}</li>`).join('');
  const acts = e.availableActions.filter((a) => TILE_ACT[a.type]).map((a) => btn(a, TILE_ACT[a.type], 'primary')).join('');
  const drop = e.availableActions.find((a) => a.type === 'abandonQuest');
  const row = (label, body) => `<div class="jt-row"><small>${label}</small><div>${body}</div></div>`;
  const sub = [e.giver ? `od: ${e.giver}` : '', e.stages > 1 ? `etap ${e.currentStage}/${e.stages}` : ''].filter(Boolean).join(' · ');
  return `<div class="scene book-scene journal-detail"><div class="scene-head"><span class="scene-tag">Dziennik Trenera</span><h2>${esc(e.title)}</h2>${uiBtn('journal-back', '← Lista', 'ghost small')}</div>
    <div class="j-detail j-tile k-${kind} st-${st || 'none'}"><span class="jt-kind">${kindLabel}</span>${stLabel ? `<span class="jt-status">${stLabel}</span>` : ''}${pic}<div class="j-info">
      ${sub ? `<small class="jt-giver">${esc(sub)}</small>` : ''}
      <div class="jt-rows">${row('Opis', e.description && e.sourceSystem !== 'missionCard' ? `<span class="j-desc">${esc(e.description)}</span>` : '—')}${row('Cel', objectives ? `<ol class="j-objectives">${objectives}</ol>` : esc(e.nextStep))}${row('Dokąd', e.destination ? placeBtn(e.destination, e.activityId) : e.section === 'done' ? '—' : 'dowolne miejsce')}${row('Nagroda', tileReward(view, player, e))}</div>
      ${e.blockedReason && e.blockedCode !== 'goTo' ? `<p class="book-now wait">${esc(e.blockedReason)}</p>` : ''}
      <div class="row">${acts}${abandonBtns(ui, drop)}</div>
    </div></div></div>`;
}

function hofTitles(view) {
  return (view.endgame.hallOfFame?.titles ?? []).map((t) => {
    const def = HALL_OF_FAME.find((h) => h.id === t.id);
    const pl = HOF_PL[t.id] ?? { title: def?.title ?? t.id, measure: '' };
    const holders = t.holders.map((id) => view.players.find((p) => p.id === id).name).join(' i ');
    return `<div class="hof-card${t.holders.length ? '' : ' empty'}"><span class="hof-icon">${def?.icon ?? '🏅'}</span><b>${esc(pl.title)}</b><small>${esc(pl.measure)}</small><div class="hof-holder">${holders ? esc(holders) : 'nikt'}${t.holders.length && t.best ? ` <small>(${t.best})</small>` : ''}</div></div>`;
  }).join('');
}

function sceneOver(view) {
  const end = view.endgame;
  const winners = end.winners.map((id) => view.players.find((p) => p.id === id));
  const titlesOf = (id) => (end.hallOfFame?.titles ?? []).filter((t) => t.holders.includes(id)).map((t) => HALL_OF_FAME.find((h) => h.id === t.id)?.icon ?? '🏅').join(' ');
  const reason = end.reason === 'champion'
    ? `${winners.length > 1 ? 'Wspólni Mistrzowie Ligi Pokémon' : 'Mistrz Ligi Pokémon'}!`
    : `Koniec czasu (tydzień ${view.config.winCondition.timeLimitWeeks}). Rozstrzygnęło: ${DECIDED_BY_PL[end.decidedBy] ?? end.decidedBy}.`;
  const results = view.players.map((p) => {
    const won = end.winners.includes(p.id);
    return `
      <div class="result-card${won ? ' winner' : ''}" style="--pc:${p.color}">
        <div class="rc-head">${avatarToken(p)}<b>${esc(p.name)}</b>${won ? '<span class="crown">👑</span>' : ''}</div>
        ${badgeCase(view, p)}
        <div class="rc-stats"><span title="złapane">📕 ${p.pokedex.caught.length}</span><span title="misje">📜 ${p.stats.quests?.completed ?? 0}</span><span title="spiski">🎈 ${p.stats.rocket?.cleared ?? 0}</span><span title="odznaki">🏅 ${p.badges.length}</span></div>
        <div class="rc-titles">${titlesOf(p.id) || '<small class="muted">bez tytułu</small>'}</div>
      </div>`;
  }).join('');
  return `
    <div class="scene over">
      <div class="end-banner"><div class="end-crown">👑</div><h2>${esc(winners.map((w) => w.name).join(' i '))}</h2><p>${esc(reason)}</p></div>
      <div class="result-row">${results}</div>
      <h3 class="center">Galeria sław</h3>
      <div class="hof-row">${hofTitles(view)}</div>
      <p class="small center">Tytuły to wspomnienie przygody — nie punkty. Nie zmieniają zwycięzcy.</p>
      <div class="row center">${uiBtn('new-game', 'Nowa gra', 'primary big')}</div>
    </div>`;
}

// Phase 3A-2.5: every Kanto Pokémon in one of four states (???, WIDZIANY,
// ZŁAPANY, EWOLUOWANY) with the legend and counts — so a child sees at once
// what the Pokédex is for: meet them, catch them, evolve them.
function sceneDex(view, playerId) {
  const player = view.players.find((p) => p.id === playerId) ?? currentPlayer(view);
  const species = [...POKEMON].sort((a, b) => a.dex - b.dex);
  const counts = Object.fromEntries(DEX_STATES.map((d) => [d.id, 0]));
  for (const s of species) counts[dexState(player, s.id)] += 1;
  const legend = DEX_STATES.map((d) => `<span class="dex-state ds-${d.id}"><b>${d.icon} ${d.label}</b><small>${esc(d.text)}</small><i>${counts[d.id]}</i></span>`).join('');
  return `
    <div class="scene dex">
      <div class="scene-head"><span class="scene-tag">Pokédex</span><h2>📕 Pokédex: ${esc(player.name)}</h2><span class="tag">${counts.caught + counts.evolved} / ${species.length} w kolekcji</span>${uiBtn('close-panel', 'Zamknij', 'ghost dex-close')}</div>
      <p class="dex-intro">Twoja kolekcja Pokémonów. Spotkaj je w drodze ${gi('dex.seen')}, złap Poké Ballem ${gi('dex.caught')} albo zdobądź przez ewolucję ✨ — zbierz wszystkie!</p>
      <div class="dex-legend wide">${legend}</div>
      <div class="dex-tiles">${species.map((s) => dexTile(player, s.id)).join('')}</div>
    </div>`;
}

function resultBanner(result, auto) {
  const w = result.wallet;
  const wallet = w ? `<p class="wallet-line">${avatarToken(w, 'small')}<b>${esc(w.name)}</b> · 💰 ${w.from} → <b>${w.to}</b> <span class="delta${w.to < w.from ? ' minus' : ''}">(${w.to > w.from ? '+' : '−'}${Math.abs(w.to - w.from)})</span></p>` : '';
  return `<div class="result-banner tone-${result.tone}${result.handoff ? ' handoff' : ''}"${result.handoff ? ` style="--pc:${result.handoff}"` : ''}><h2>${esc(result.title)}</h2>${result.text ? `<p>${esc(result.text)}</p>` : ''}${wallet}${result.badge ? `<div class="badge-fly">${typeIcon(GYMS_BY_ID[result.badge].type)}</div>` : ''}${result.item ? `<div class="item-fly">${itemToken(result.item, 48)}<b>${esc(ITEM_PL[result.item])}</b></div>` : ''}${result.ribbon ? '<div class="badge-fly">🎀</div>' : ''}${auto ? '' : uiBtn('dismiss-result', 'Dalej ▶', 'primary big')}</div>`;
}

// What the Table Layer shows now. `view` is the state to draw (the pre-action
// copy while a reveal plays), `state` the live one.
// Playtest 004 (DQ-107): who the coming battle is against — before a challenge
// the team it will meet (built from the same data as the battle), else the
// battle's own; `first` is the Pokémon the lead faces.
function leadPickFoe(view) {
  const player = currentPlayer(view);
  const prep = view.battlePrep;
  if (!prep) {
    const enc = view.encounter;
    // PLAYTEST_007 2B: the pick after a KO happens in any battle — a wild one has no trainer team
    if (enc.kind === 'wild') return { kind: 'wild', team: [enc.pokemon.species], token: null, name: `Dziki ${getSpecies(enc.pokemon.species).name}` };
    return { kind: enc.kind, team: enc.trainer.pokemonTeam.map((m) => m.species), token: opponentTokenId(enc, view.config), name: opponentLabel(enc, view.config) };
  }
  if (prep.challenge === 'gym') {
    const gym = gymHere(view, player);
    if (usesGymChain(view.config)) { // B33-3: the chain opens with the gym's trainer
      const first = chainOpponents(view, { kind: 'gym', gymId: gym.id, tier: gymTier(view, player) })[0];
      return { kind: 'gym', team: first.team, token: first.archetype ?? gymTokenId(gym.id), name: chainName(first) };
    }
    return { kind: 'gym', team: gymRow(gym, gymTier(view, player), view.config), token: gymTokenId(gym.id), name: leaderPl(gym) };
  }
  if (prep.challenge === 'league') {
    if (usesLeagueChallenge(view.config)) { // B33-3: always Lorelei first
      const first = chainOpponents(view, { kind: 'league' })[0];
      return { kind: 'league', team: first.team, token: leagueTokenId(first.name), name: chainName(first) };
    }
    const i = leagueStartStage(view, player);
    const stage = LEAGUE.stages[i];
    return { kind: 'league', team: leagueStageTeam(view, i), token: leagueTokenId(stage.trainers[0]), name: LEAGUE_STAGE_PL[stage.id] ?? stage.name };
  }
  const team = rocketTeam(view, plotCard(activePlot(view)));
  return { kind: 'rocket', team, token: rocketTokenId(team[0], view.config), name: 'Team Rocket' };
}

const LEAD_TAG_PL = { trainer: 'Trener', gym: 'Sala', league: 'Liga', rocket: 'Team Rocket', wild: 'Dziki Pokémon' };

// Playtest 004 (DQ-107): before a battle against a trainer, a leader, Team
// Rocket or a League stage — who starts it. One tap: that Pokémon goes first
// and the battle begins; free, the opponent does not strike. A challenge can
// still be called off here („Wróć”: no action spent).
function sceneLeadPick(view, canAct) {
  const player = currentPlayer(view);
  const lead = getLead(player);
  const foe = leadPickFoe(view);
  // PLAYTEST_007 2B: after a KO the pick faces the opponent standing NOW (not the team's first)
  const ko = view.encounter?.leadPick === 'ko';
  const nowAt = ko && view.encounter.kind !== 'wild' ? view.encounter.index : 0;
  const first = foe.team[nowAt];
  const picks = canAct ? getLegalActions(view).filter((a) => a.type === 'chooseLead') : [];
  const healthy = player.team.filter((m) => m.hp > 0);
  const card = (mon) => {
    const a = picks.find((x) => x.target === mon.uid);
    return `<div class="pick">${pokemonCard(mon, { size: 's', lead: mon === lead, growth: growthRules(view), family: true })}${matchupBadges(view, mon, first)}${a ? btn(a, '⚔️ Do walki!', 'primary') : ''}</div>`;
  };
  const roster = foe.team.map((id, i) => `<div class="named-card${i === nowAt ? ' first' : ''}">${speciesCard(id, { size: 'xs' })}</div>`).join('');
  const fainted = ko ? player.team.find((m) => m.hp <= 0) : null;
  return `
    <div class="scene lead-pick k-${foe.kind}">
      <div class="scene-head"><span class="scene-tag ${foe.kind}">${LEAD_TAG_PL[foe.kind]}</span>${foe.token ? characterToken(foe.token, { size: 'm' }) : ''}<h2>${ko ? `${esc(getSpecies(fainted?.species ?? lead.species).name)} zemdlał — kto teraz walczy?` : 'Kto zaczyna walkę?'}</h2></div>
      <div class="lp-foe"><small>${esc(foe.name)}</small><div class="roster-cards">${roster}</div></div>
      <div class="switch-panel">
        <p class="switch-rule free">${ko ? 'Za darmo — <b>wybierz, kto wchodzi do walki.</b>' : 'Za darmo — <b>przeciwnik jeszcze nie atakuje.</b>'}</p>
        <div class="pick-row">${canAct ? healthy.map(card).join('') : `<span class="thinking">${esc(player.name)} wybiera…</span>`}</div>
        ${view.battlePrep && canAct ? `<div class="row center">${btn({ type: 'cancelBattle' }, 'Wróć', 'ghost')}</div>` : ''}
      </div>
    </div>`;
}

// Growth games: after a battle, who gets the training point (only the
// Pokémon that fought — or a cocoon in the team after a win — and can use it).
function sceneGrowth(view, canAct) {
  const player = currentPlayer(view);
  const award = view.growthChoice.awards[0];
  const left = view.growthChoice.awards.length;
  const cards = growthOptions(view).map((mon) => `<div class="pick">${pokemonCard(mon, { size: 'm', growth: true, family: true })}${canAct ? btn({ type: 'assignGrowth', target: mon.uid }, `⭐ ${esc(getSpecies(mon.species).name)}`, 'primary') : ''}</div>`).join('');
  return `
    <div class="scene growth-pick">
      <div class="scene-head"><span class="scene-tag">Trening</span><h2>⭐ Kto zdobywa punkt treningu?</h2><span class="tag">${left > 1 ? `jeszcze ${left} punkty` : 'ostatni punkt'}</span></div>
      <p class="small center">Za ${award.kind === 'catch' ? 'złapanie' : 'pokonanie'}: <b>${esc(getSpecies(award.source).name)}</b>. Wybierz jednego z Pokémonów, które brały udział w walce.</p>
      <div class="pick-row">${canAct ? cards : `${cards}<span class="thinking">${esc(player.name)} wybiera…</span>`}</div>
    </div>`;
}

export function renderTableLayer({ state, view, ui }) {
  setClassTable(view.config.rules.exp); // E1: power-class dots on the cards of an EXP game
  const player = currentPlayer(view);
  const canAct = player.controller === 'human' && !ui.busy && !ui.prompt;
  let scene = '';
  const sceneName = ui.reveal?.scene ?? null;
  if (view.growthChoice && !ui.reveal) scene = sceneGrowth(view, canAct);
  else if (view.boxChoice && !ui.reveal) scene = sceneBoxChoice(view, canAct);
  else if (view.oakJobDraft && !ui.reveal) scene = sceneOakDraft(view, canAct);
  else if (view.trade && !ui.reveal) scene = sceneTrade(view);
  else if (view.pvp) scene = sceneDuel(view, ui, canAct && !ui.reveal, ui.reveal?.scene === 'duel' ? ui.reveal : null);
  else if ((view.battlePrep || view.encounter?.leadPick) && !ui.reveal) scene = sceneLeadPick(view, canAct);
  else if (view.phase === 'encounter') scene = sceneEncounter(view, ui, canAct && !ui.reveal, ui.reveal?.scene === 'encounter' ? ui.reveal : null);
  else if (view.phase === 'event') scene = sceneEvent(view, canAct);
  else if (view.phase === 'shop') scene = sceneShop(view, canAct);
  else if (view.phase === 'loot') scene = sceneLoot(view, canAct);
  else if (view.phase === 'league') scene = sceneLeague(view, canAct);
  else if (view.phase === 'challenge') scene = sceneChallenge(view, canAct);
  else if (view.phase === 'over' && !ui.reveal && !ui.result) scene = sceneOver(view);
  else if (sceneName === 'explore' || ui.panel === 'explore') scene = sceneExplore(view, ui, canAct);
  else if (ui.panel === 'gym') scene = sceneGym(view, canAct);
  else if (ui.panel === 'rest') scene = sceneRest(view, canAct);
  else if (ui.panel === 'rocket') scene = sceneRocket(view, canAct);
  else if (ui.panel === 'oak') scene = sceneOak(view, canAct);
  else if (ui.panel === 'book') scene = sceneBook(view, ui, canAct);
  else if (ui.panel === 'trophies') scene = sceneTrophies(view, ui.trophyPlayer);
  else if (ui.panel === 'dex') scene = sceneDex(view, ui.dexPlayer);

  let overlay = '';
  if (ui.prompt) overlay = renderPrompt(ui.prompt.need, { tap: ui.prompt.tap }) + (ui.prompt.cancellable ? `<div class="row center">${uiBtn('cancel-prompt', 'Wróć', 'ghost')}</div>` : '');
  else if (ui.reveal && !(view.phase === 'encounter' && ui.reveal.scene === 'encounter') && !(view.pvp && ui.reveal.scene === 'duel')) {
    const step = ui.reveal.steps[ui.reveal.i];
    const wildName = ui.reveal.view.encounter?.kind === 'wild' ? getSpecies(ui.reveal.view.encounter.pokemon.species).name : 'Pokémon';
    overlay = step ? renderStep(step, { rolling: ui.reveal.rolling, wildName, view: state }) + uiBtn('skip', 'Pomiń ⏩', 'ghost small skip') : '';
  } else if (ui.result) overlay = resultBanner(ui.result, ui.result.auto);

  return { open: Boolean(scene), scene, overlay, wide: scene.includes('<div class="scene dex">'), battle: scene.includes('<div class="scene encounter') };
}
