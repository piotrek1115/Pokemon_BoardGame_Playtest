// The Table Layer: cards placed on top of the board for every interaction —
// explore, wild encounters and every battle (trainer, Team Rocket, gym,
// League) card vs card with the DQ-71 switch, catching, the Rocket plot card
// and Meowth's loot, the Poké Stop tray, event cards, the League intermission
// and the final results. Pure HTML strings; all copy in Polish.
import { getSpecies } from '../data/pokemon.js';
import { BIOMES } from '../data/biomes.js';
import { GYMS_BY_ID, LEAGUE } from '../data/gyms.js';
import { getLocation } from '../data/locations.js';
import { getLegalActions } from '../engine/turnEngine.js';
import { currentPlayer, getLead } from '../engine/gameState.js';
import { currentOpponent, typeMatchup } from '../engine/combatEngine.js';
import { catchDie, catchDieChance, escapeColour } from '../engine/captureEngine.js';
import { gymChallengeBlocker, gymHere, gymRow, gymTier, hasBadge, leagueChallengeBlocker, leagueHere, leagueStageTeam, leagueStartStage } from '../engine/gymEngine.js';
import { activePlot, challengeLocations } from '../engine/rocketEngine.js';
import { price, shopStock } from '../engine/pokeStopEngine.js';
import { growthOptions, usesGrowth } from '../engine/growthEngine.js';
import { ITEMS } from '../data/items.js';
import { itemCount } from '../engine/itemEngine.js';
import { canSwapQuests } from '../engine/questEngine.js';
import { HALL_OF_FAME } from '../engine/endgameEngine.js';
import { gymMatchups } from '../ui/gymPanel.js';
import { actAttr, esc } from '../ui/dom.js';
import { DEX_STATES, badgeCase, dexState, dexTile, itemToken, missionCard, pokemonCard, rocketPlotCard, speciesCard, superballSvg, trainerBadge, trainerPortrait, teamDot } from './cards.js';
import { POKEMON } from '../data/pokemon.js';
import { gi, typeIcon } from './icons.js';
import { catchDieHtml, catchDieLabel, d6Html, escapeDieHtml, escapeDieLabel, pokeballSvg, renderPrompt, windSvg } from './dice.js';
import { ballOptions } from './flow.js';
import { BALL_PL, BIOME_PL, CATCH_DIE, ESCAPE_DIE, ITEM_PL, RARITY_PL, TYPE_PL, d6Purpose } from './i18n.js';
import { DECIDED_BY_PL, GYM_NOTE_PL, HOF_PL, LEADER_PL, LEAGUE_STAGE_PL, eventPl, plotPl, thingPl, trainerPl } from './content-pl.js';

const btn = (action, label, cls = '', disabled = false) => `<button class="${cls}" ${actAttr(action)}${disabled ? ' disabled' : ''}>${label}</button>`;
const uiBtn = (cmd, label, cls = '', extra = '') => `<button class="${cls}" data-ui="${cmd}" ${extra}>${label}</button>`;

const BLOCKER_PL = [
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
  const bonus = atkMod + typeMod;
  const die = d6Html(rolling ? null : a.raw, { small: true, rolling });
  const result = a.damage > 0 ? `<b class="dmg">💥 −${a.damage} ❤</b>` : '<b class="miss">💨 pudło</b>';
  return `
    <div class="atk-row${a.kind === 'player' ? ' mine' : ''}">
      <div class="atk-who">${esc(atk)} ➜ ${esc(def)}</div>
      <div class="atk-math"><span class="die-wrap">${die}${!rolling && bonus ? `<b class="die-bonus ${bonus > 0 ? 'good' : 'bad'}" title="atak ${signed(atkMod)}, typ ${signed(typeMod)}">${signed(bonus)}</b>` : ''}</span>${rolling ? '' : `<span class="op">=</span><b class="atk-total">${a.total}</b>${result}`}</div>
      ${!rolling && a.natural1 ? '<div class="small muted">Jedynka zawsze chybia.</div>' : ''}
      ${!rolling && a.natural6Boost ? '<div class="small muted">Szóstka zawsze trafia.</div>' : ''}
    </div>`;
}

// The latest exchange of blows (kept by the controller from the last reveal).
function lastExchange(ui) {
  const attacks = ui.exchange ?? [];
  if (!attacks.length) return '<div class="exchange empty"><span class="die-ghost">🎲</span></div>';
  return `<div class="exchange">${attacks.map((a) => attackRow(a)).join('')}</div>`;
}

function opponentLabel(enc) {
  if (enc.kind === 'wild') return 'Dziki Pokémon';
  if (enc.kind === 'rocket') return ['Jessie', 'James', 'Meowth'][enc.index] ?? 'Team Rocket';
  if (enc.kind === 'league') return LEAGUE.stages[enc.stage].trainers[enc.index] ?? LEAGUE.stages[enc.stage].trainers[0];
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
const rulesLine = (view, kind) => (view.config.rules.battleItems ? RULES_LOOP_PL : RULES_PL)[kind] ?? '';

function encounterHeader(view, enc) {
  if (enc.kind === 'wild') {
    const s = getSpecies(enc.pokemon.species);
    return `<span class="scene-tag wild">Dziki Pokémon</span><h2>Dziki ${esc(s.name)}!</h2><span class="tag">${RARITY_PL[s.rarity]}</span>`;
  }
  if (enc.kind === 'gym') {
    const gym = GYMS_BY_ID[enc.gymId];
    return `<span class="scene-tag gym">Sala</span>${trainerPortrait({ gymId: gym.id }, gi(`type.${gym.type}`))}<h2>${esc(leaderPl(gym))} — ${esc(gym.badge)}</h2><span class="tag">poziom ${enc.tier}</span>`;
  }
  if (enc.kind === 'league') {
    const stage = LEAGUE.stages[enc.stage];
    return `<span class="scene-tag league">Liga</span>${trainerPortrait({ leagueName: opponentLabel(enc) }, '🏆')}<h2>${esc(LEAGUE_STAGE_PL[stage.id] ?? stage.name)}</h2><span class="tag">etap ${enc.stage + 1} z ${LEAGUE.stages.length}</span>`;
  }
  if (enc.kind === 'rocket') {
    const card = plotPl(activePlot(view)?.plotId ?? enc.plotId);
    return `<span class="scene-tag rocket">Team Rocket</span><h2>${gi('rocket')} ${esc(card.title)}</h2><span class="tag">Jessie i James${card.meowth ? ' + Meowth' : ''}</span>`;
  }
  return `<span class="scene-tag trainer">Trener</span>${trainerBadge(enc.trainer)}`;
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
      <h3>${ball === 'superball' ? superballSvg(30) : pokeballSvg(30)} Rzut: ${BALL_PL[ball]}</h3>
      <div class="prep-row"><span>Rzadkość</span><b>${RARITY_PL[s.rarity]}</b><span>kostka bazowa ${catchDieLabel(die.base)}</span></div>
      <div class="prep-row"><span>Pasek HP</span><b>${gi(`die.${zone}`)} ${mon.hp}/${mon.maxHp}</b><span>${hpStep ? stepsText(hpStep.steps) : 'bez zmian'}</span></div>
      <div class="prep-row"><span>Ball</span><b>${BALL_PL[ball]}</b><span>${ballStep ? (opt.noBonus ? 'bez dodatkowego bonusu' : stepsText(ballStep.steps)) : 'bez zmian'}</span></div>
      <div class="prep-final">
        <span>Kostka łapania</span>
        ${catchDieHtml(die.colour)}
        <b>${catchDieLabel(die.colour, { reroll: die.rerolls > 0 })}</b>
        ${ui.showOdds ? `<span class="odds">${Math.round(catchDieChance(die) * 100)}%</span>` : ''}
      </div>
      ${opt.note ? `<p class="note">${esc(opt.note)}</p>` : ''}
      <div class="row center">
        <button class="primary big" data-ui="throw" data-ball="${ball}">🎯 Rzucaj!</button>
        ${uiBtn('cancel-catch', 'Anuluj', 'ghost')}
      </div>
    </div>`;
}

// DQ-71: pick the Pokémon to switch in (Team Pokémon Cards).
export function switchPicker(view, free) {
  const player = currentPlayer(view);
  const options = getLegalActions(view).filter((a) => a.type === 'switchPokemon');
  const cards = options.map((a) => {
    const mon = player.team.find((m) => m.uid === a.target);
    return `<div class="pick">${pokemonCard(mon, { size: 's', growth: usesGrowth(view), family: true })}${matchupBadges(view, mon)}${btn(a, '🔄 Do walki!', 'primary')}</div>`;
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
export function itemPicker(view) {
  const player = currentPlayer(view);
  const options = getLegalActions(view).filter((a) => a.type === 'useItem');
  const cards = options.map((a) => {
    const mon = player.team.find((m) => m.uid === a.target);
    return `<div class="pick">${pokemonCard(mon, { size: 's', growth: usesGrowth(view), family: true })}${btn(a, a.item === 'potion' ? `🧪 Potion (+${view.config.items.potion.heal} ❤)` : '💎 Revive', 'primary')}</div>`;
  }).join('');
  return `
    <div class="switch-panel">
      <h3>🎒 Przedmiot zamiast ataku</h3>
      <p class="small">Potem przeciwnik zaatakuje Twojego prowadzącego.</p>
      <div class="pick-row">${cards}</div>
      <div class="row center">${uiBtn('items-close', 'Anuluj', 'ghost')}</div>
    </div>`;
}

// Phase 3A-2: leaving a trainer battle — with no money, the player picks what to leave.
export function retreatPicker(view) {
  const options = getLegalActions(view).filter((a) => a.type === 'run' && a.item);
  const buttons = options.map((a) => `<button class="tray-item" ${actAttr(a)}><span class="tray-token">${itemToken(a.item, 48)}</span><b>${ITEM_PL[a.item]}</b><small>masz ${itemCount(currentPlayer(view), a.item)}</small></button>`).join('');
  return `
    <div class="switch-panel">
      <h3>🏃 Co zostawiasz trenerowi?</h3>
      <p class="small">Bez pieniędzy wycofanie kosztuje jeden przedmiot. Ostatni ball zawsze zostaje u Ciebie.</p>
      <div class="shop-row">${buttons}</div>
      <div class="row center">${uiBtn('retreat-close', 'Zostaję w walce', 'ghost')}</div>
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
  if (!trainer) return btn(runs[0], slot('🏃', 'Uciekaj'), 'act-run ghost');
  if (runs.length > 1) return uiBtn('retreat-open', slot('🏃', 'Wycofaj się', 'zostaw przedmiot'), 'act-run ghost');
  const a = runs[0];
  const price = a.item ? `zostaw: ${ITEM_PL[a.item]}` : currentPlayer(view).money > 0 ? '−💰1' : 'bez kary';
  return btn(a, slot('🏃', 'Wycofaj się', price), 'act-run ghost');
}

// The balls (Build 2.4, Piotr's form): each ball on a tile coloured like the
// Catch Die it rolls (blue / purple / magenta), how many, and the die's ball
// faces of six (3/6 — the P1 preview, nothing more); tap to throw or drag onto
// the wild Pokémon.
function ballRow(view, canAct) {
  const wild = view.encounter.pokemon;
  const symbolic = view.config.capture.system !== 'classic';
  const opts = ballOptions(view).filter((o) => o.ball === 'pokeball' || o.ball === 'superball');
  if (!opts.length) return '';
  const taps = opts.map((o) => {
    const ok = o.usable && canAct && o.count > 0;
    const die = symbolic ? catchDie(wild, o.ball, view.config) : null;
    // the count, then how good the die is now: its ball faces of six (the die the throw rolls)
    return `<button class="ball-tile${ok ? '' : ' muted'}${die ? ` c-${die.colour}` : ''}" data-ui="catch" data-ball="${o.ball}"${ok ? ` data-drag-ball="${o.ball}"` : ' disabled'} title="${esc(o.note || o.name)}${die ? ` — kostka ${CATCH_DIE[die.colour].name.toLowerCase()}` : ''}" aria-label="${esc(o.name)}: ${o.count}${die ? `, szansa ${die.successFaces} z 6` : ''}">${o.ball === 'superball' ? superballSvg(36) : pokeballSvg(36)}<b class="count">×${o.count}</b>${die ? `<small class="odds">${die.successFaces}/6</small>` : ''}</button>`;
  }).join('');
  return `<div class="ball-row">${taps}</div>`;
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
  const fight = (a, b) => ({ type: typeMatchup(getSpecies(a.species), getSpecies(b.species), view.config) });
  // no „prowadzi” pill in a battle (the player's name is over the card)
  const leftCard = lead ? pokemonCard(lead, { size: 'l', label: player.name, growth: usesGrowth(view), fight: fight(lead, opp), actor: actor === 'mine' }) : '<div class="pcard size-l empty-slot">brak zdrowych Pokémonów</div>';
  const rightCard = pokemonCard(opp, { size: 'l', label: opponentLabel(enc), drop: canAct && anyBall, cls: ui.dealUid === opp.uid ? 'deal' : '', fight: lead ? fight(opp, lead) : null, actor: actor === 'theirs' });
  let picker = '';
  if (ui.catchPrep && wild) picker = catchPrepPanel(view, ui.catchPrep.ball, ui);
  else if (ui.switchPick && has('switchPokemon')) picker = switchPicker(view, enc.freeSwitch);
  else if (ui.itemPick && has('useItem')) picker = itemPicker(view);
  else if (ui.retreatPick && legal.some((a) => a.type === 'run' && a.item)) picker = retreatPicker(view);
  // no rules line (Build 2.4): the choices and the frames over them say it
  const head = `<div class="scene-head">${encounterHeader(view, enc)}</div>`;
  if (picker) return `<div class="scene encounter compact k-${enc.kind}">${head}<div class="picker-wrap">${picker}</div></div>`;
  const wildName = wild ? getSpecies(enc.pokemon.species).name : 'Pokémon';
  const table = step ? `${renderStep(step, { rolling: reveal.rolling, wildName, view })}${uiBtn('skip', 'Pomiń ⏩', 'ghost small skip')}` : lastExchange(ui);
  const items = view.config.rules.battleItems;
  // while the dice roll, the choices stay in place (inactive), so the panel never jumps
  const choices = canAct || step ? `
      <div class="battle-actions">
        ${has('fight') ? btn({ type: 'fight' }, '⚔️ Atakuj', 'act-attack primary') : '<button class="act-attack" disabled>⚔️ Atakuj</button>'}
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
        <div class="side theirs">${rightCard}${rosterCards(enc)}</div>
      </div>
    </div>`;
}

// The switch picker (Build 2.3): the type matchup only, like the badges on the
// battle cards — its attack's type against this opponent (⚔) and the opponent's
// against it (🛡); nothing when 0.
function matchupBadges(view, mon) {
  const opp = currentOpponent(view.encounter);
  const ms = getSpecies(mon.species);
  const os = getSpecies(opp.species);
  const mine = typeMatchup(ms, os, view.config);
  const theirs = typeMatchup(os, ms, view.config);
  const badges = `${mine ? `<span class="mu ${modClass(mine)}" title="Twój atak — typ">⚔️ ${modText(mine)}</span>` : ''}${theirs ? `<span class="mu ${modClass(-theirs)}" title="Atak przeciwnika — typ">🛡 ${modText(theirs)}</span>` : ''}`;
  return badges ? `<div class="mu-badges">${badges}</div>` : '';
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
      return `<div class="tray"><div class="tray-title">Rzadkość</div>${d6Html(roll ? null : step.value, { rolling: roll })}${roll ? '' : `<div class="tray-result r-${step.rarity}">${'◆'.repeat({ common: 1, rare: 2, superRare: 3 }[step.rarity])} ${esc(step.label)}${step.total !== step.value ? ` <small>(${step.value} +1)</small>` : ''}</div>`}</div>`;
    case 'attack': {
      // Phase 3A-2: the opponent's response when the player did not attack.
      const why = step.after === 'stay' ? `<div class="tray-title big">${esc(wildName.toUpperCase())} ZOSTAJE — I KONTRATAKUJE!</div>` : step.after === 'item' ? '<div class="tray-title">Przeciwnik atakuje</div>' : '';
      return `<div class="tray">${why}${attackRow(step, { rolling: roll })}</div>`;
    }
    case 'catch': {
      const text = roll ? '' : step.face === 'ball' ? `<div class="tray-result good">${pokeballSvg(28)} Poké Ball!</div>` : '<div class="tray-result">Puste…</div>';
      return `<div class="tray"><div class="tray-title">${step.reroll ? '↻ Przerzut — ' : ''}Kostka łapania ${catchDieLabel(step.colour)}</div>${catchDieHtml(step.colour, { face: roll ? null : step.face, rolling: roll })}${text}</div>`;
    }
    case 'escape': {
      const d = ESCAPE_DIE[step.colour];
      const text = roll ? '' : step.face === 'flee' ? `<div class="tray-result bad">${windSvg(30)} ${esc(wildName.toUpperCase())} UCIEKŁ!</div>` : `<div class="tray-result good">${esc(wildName.toUpperCase())} ZOSTAJE!</div>`;
      return `<div class="tray escape-moment"><div class="tray-title big">${esc(wildName.toUpperCase())} SIĘ WYRWAŁ!</div>
        <div class="tray-sub">Aktualne HP: ${gi(`die.${step.colour}`)} ${d.zone}</div>
        <div class="tray-title">Kostka ucieczki ${escapeDieLabel(step.colour)}</div>${escapeDieHtml(step.colour, { face: roll ? null : step.face, rolling: roll })}${text}</div>`;
    }
    case 'growth': {
      const name = getSpecies(step.species ?? step.source).name;
      const source = getSpecies(step.source).name;
      if (step.event === 'lost') return `<div class="tray growth-moment"><div class="tray-title">⭐ Punkt treningu przepada</div><div class="tray-sub">Za ${step.kind === 'catch' ? 'złapanie' : 'pokonanie'}: ${esc(source)} — ${step.reason === 'final' ? 'ten Pokémon już nie ewoluuje' : 'Pokémon jest już gotowy do ewolucji'}.</div></div>`;
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
    case 'blastOff':
      return '<div class="tray rocket-moment blast"><div class="tray-title big rocket">Team Rocket znowu odlatuje! ✨</div></div>';
    case 'pitfall':
      return '<div class="tray rocket-moment"><div class="tray-title big rocket">🕳 Dół Team Rocket!</div><div class="tray-result">Twoja tura się kończy.</div></div>';
    case 'event': {
      const e = eventPl(step.event);
      return `<div class="tray event-moment"><div class="tray-title">Wydarzenie</div><h3>${esc(e.title)}</h3><p>${esc(e.text)}</p>${step.effects ? `<div class="tray-result">${esc(step.effects)}</div>` : ''}</div>`;
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
  const choices = legal.map((a) => btn(a, `${gi(`biome.${a.biome}`)} ${BIOME_PL[a.biome] ?? BIOMES[a.biome].name}`, 'primary big')).join('');
  return `
    <div class="scene explore">
      <div class="scene-head"><span class="scene-tag">Eksploracja</span><h2>📍 ${esc(getLocation(player.location).name)}</h2><span class="tag">1 akcja</span></div>
      ${ui.reveal ? '<p class="center explore-roll">🎲 Co tu znajdziesz?</p>' : `<p class="center">Gdzie szukasz? Wybierz teren — kość pokaże, co znajdziesz: nic, wydarzenie, trenera albo dzikiego Pokémona.</p>
      <div class="row center">${choices || '<span class="muted">Tu nie da się eksplorować.</span>'}${uiBtn('close-panel', 'Zamknij', 'ghost')}</div>`}
    </div>`;
}

function sceneRest(view, canAct) {
  const player = currentPlayer(view);
  const rests = canAct ? getLegalActions(view).filter((a) => a.type === 'rest') : [];
  const cards = rests.map((a) => {
    const mon = player.team.find((m) => m.uid === a.target);
    return `<div class="pick">${pokemonCard(mon, { size: 'm', growth: usesGrowth(view), family: true })}${btn(a, `💤 +${view.config.rest.heal} ❤`, 'primary')}</div>`;
  }).join('');
  return `<div class="scene rest"><div class="scene-head"><span class="scene-tag">Odpoczynek</span><h2>Kto odpoczywa?</h2><span class="tag">1 akcja</span></div><div class="pick-row">${cards || '<span class="muted">Nikt nie potrzebuje odpoczynku.</span>'}</div><div class="row center">${uiBtn('close-panel', 'Zamknij', 'ghost')}</div></div>`;
}

function typeChips(types) {
  return types.map((t) => `<span class="type-chip" style="--tc:var(--t-${t})">${gi(`type.${t}`)} ${TYPE_PL[t]}</span>`).join(' ') || '—';
}

function leagueCard(view, player, canAct) {
  const start = leagueStartStage(view, player);
  const legal = canAct && getLegalActions(view).some((a) => a.type === 'challengeLeague');
  const need = view.config.gyms.badgesForLeague;
  const stages = LEAGUE.stages.map((stage, i) => `
    <div class="league-stage${i === start ? ' mine' : ''}">
      <b>Etap ${i + 1}: ${esc(LEAGUE_STAGE_PL[stage.id] ?? stage.name)}</b>${i === start && start > 0 ? ' <span class="tag">tu zaczynasz (🎀)</span>' : ''}
      <div class="roster-cards">${leagueStageTeam(view, i).map((id, j) => `<div class="named-card"><small>${esc(stage.trainers[j] ?? stage.trainers[0])}</small>${speciesCard(id, { size: 'xs' })}</div>`).join('')}</div>
    </div>`).join('<div class="league-break-mark">⏸ przerwa: Potion / Revive / zmiana prowadzącego — bez pełnego leczenia</div>');
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
          <div class="gym-top"><span class="gym-icon">${typeIcon(gym.type)}</span><div><h2>Sala w ${esc(getLocation(gym.city).name)}</h2><div>Lider: <b>${esc(leaderPl(gym))}</b>${note ? ` <small>(${esc(note)})</small>` : ''} · Odznaka: <b>${esc(gym.badge)}</b>${owned ? ' ✓' : ''}</div></div><span class="tag">poziom ${tier} (${player.badges.length} ${player.badges.length === 1 ? 'odznaka' : 'odznak'})</span></div>
          <div class="roster-cards">${gymRow(gym, tier, view.config).map((id) => speciesCard(id, { size: 's' })).join('')}</div>
          <div class="guide"><span>💪 Silne tu: ${typeChips(strong)}</span><span>🛡️ Słabe tu: ${typeChips(weak)}</span></div>
          <div class="rewards">Nagroda: <b>${gi(`type.${gym.type}`)} odznaka</b> · 💰${cfg.reward.money}${cfg.starsPerBadge && !usesGrowth(view) ? ` · ⭐${cfg.starsPerBadge}` : usesGrowth(view) ? ' · ⭐ trening za każdego pokonanego Pokémona' : ''}${gym.grants ? ' · 🌊 pływanie' : ''}</div>
          <p class="small muted">${rulesLine(view, 'gym')} Spróbujesz znowu w kolejnej turze.</p>
          <div class="row center">${owned ? '<b>Masz już tę odznakę.</b>' : canAct ? btn({ type: 'challengeGym' }, '🏟️ Wyzwij lidera (1 akcja)', 'primary big', !legal) : ''}${uiBtn('close-panel', 'Zamknij', 'ghost')}</div>
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
  const where = challengeLocations(view).map((id) => getLocation(id).name).join(', ');
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
  return `<div class="scene event"><div class="event-card"><span class="scene-tag">Wydarzenie</span><h2>${esc(e.title)}</h2><p class="event-text">${esc(e.text)}</p><div class="choice-cards">${canAct ? choices : '<span class="thinking">Wybór…</span>'}</div></div></div>`;
}

function sceneShop(view, canAct) {
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
      .map((a) => btn(a, a.type === 'setLead' ? 'Prowadź' : a.item === 'potion' ? '🧪 Potion' : '💎 Revive', 'mini')).join('');
    return `<div class="card-with-actions">${pokemonCard(m, { size: 's', lead: m === getLead(player), growth: usesGrowth(view), family: true })}<div class="pcard-actions">${acts}</div></div>`;
  }).join('');
  return `
    <div class="scene league-break">
      <div class="event-card">
        <span class="scene-tag league">Liga — przerwa</span><h2>🎀 Elitarna Czwórka pokonana!</h2>
        <p><b>Bez pełnego leczenia:</b> obrażenia zostają. Możesz użyć Potion / Revive i wybrać prowadzącego. Potem ${esc(LEAGUE_STAGE_PL.lance)} i ${esc(leagueStageTeam(view, 1).map((id) => getSpecies(id).name).join(', '))}.</p>
        <div class="team-row center">${cards}</div>
        <div class="row center">${canAct ? btn({ type: 'continueLeague' }, '👑 Dalej: walka z Lance’em', 'primary big') : '<span class="thinking">Przygotowania…</span>'}</div>
      </div>
    </div>`;
}

function hofTitles(view) {
  return (view.endgame.hallOfFame?.titles ?? []).map((t) => {
    const def = HALL_OF_FAME.find((h) => h.id === t.id);
    const pl = HOF_PL[t.id] ?? { title: def?.title ?? t.id, measure: '' };
    const holders = t.holders.map((id) => view.players.find((p) => p.id === id).name).join(' i ');
    return `<div class="hof-card${t.holders.length ? '' : ' empty'}"><span class="hof-icon">${def?.icon ?? '🏅'}</span><b>${esc(pl.title)}</b><small>${esc(pl.measure)}</small><div class="hof-holder">${holders ? esc(holders) : 'nikt'}${t.value ? ` <small>(${t.value})</small>` : ''}</div></div>`;
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
        <div class="rc-head"><span class="avatar" style="--pc:${p.color}">${esc(p.name[0])}</span><b>${esc(p.name)}</b>${won ? '<span class="crown">👑</span>' : ''}</div>
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
  const wallet = w ? `<p class="wallet-line"><span class="avatar small" style="--pc:${w.color}">${esc(w.name[0])}</span><b>${esc(w.name)}</b> · 💰 ${w.from} → <b>${w.to}</b> <span class="delta${w.to < w.from ? ' minus' : ''}">(${w.to > w.from ? '+' : '−'}${Math.abs(w.to - w.from)})</span></p>` : '';
  return `<div class="result-banner tone-${result.tone}${result.handoff ? ' handoff' : ''}"${result.handoff ? ` style="--pc:${result.handoff}"` : ''}><h2>${esc(result.title)}</h2>${result.text ? `<p>${esc(result.text)}</p>` : ''}${wallet}${result.badge ? `<div class="badge-fly">${typeIcon(GYMS_BY_ID[result.badge].type)}</div>` : ''}${result.ribbon ? '<div class="badge-fly">🎀</div>' : ''}${auto ? '' : uiBtn('dismiss-result', 'Dalej ▶', 'primary big')}</div>`;
}

// What the Table Layer shows now. `view` is the state to draw (the pre-action
// copy while a reveal plays), `state` the live one.
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
  const player = currentPlayer(view);
  const canAct = player.controller === 'human' && !ui.busy && !ui.prompt;
  let scene = '';
  const sceneName = ui.reveal?.scene ?? null;
  if (view.growthChoice && !ui.reveal) scene = sceneGrowth(view, canAct);
  else if (view.phase === 'encounter') scene = sceneEncounter(view, ui, canAct && !ui.reveal, ui.reveal?.scene === 'encounter' ? ui.reveal : null);
  else if (view.phase === 'event') scene = sceneEvent(view, canAct);
  else if (view.phase === 'shop') scene = sceneShop(view, canAct);
  else if (view.phase === 'loot') scene = sceneLoot(view, canAct);
  else if (view.phase === 'league') scene = sceneLeague(view, canAct);
  else if (view.phase === 'over' && !ui.reveal && !ui.result) scene = sceneOver(view);
  else if (sceneName === 'explore' || ui.panel === 'explore') scene = sceneExplore(view, ui, canAct);
  else if (ui.panel === 'gym') scene = sceneGym(view, canAct);
  else if (ui.panel === 'rest') scene = sceneRest(view, canAct);
  else if (ui.panel === 'rocket') scene = sceneRocket(view, canAct);
  else if (ui.panel === 'dex') scene = sceneDex(view, ui.dexPlayer);

  let overlay = '';
  if (ui.prompt) overlay = renderPrompt(ui.prompt.need, { tap: ui.prompt.tap }) + (ui.prompt.cancellable ? `<div class="row center">${uiBtn('cancel-prompt', 'Wróć', 'ghost')}</div>` : '');
  else if (ui.reveal && !(view.phase === 'encounter' && ui.reveal.scene === 'encounter')) {
    const step = ui.reveal.steps[ui.reveal.i];
    const wildName = ui.reveal.view.encounter?.kind === 'wild' ? getSpecies(ui.reveal.view.encounter.pokemon.species).name : 'Pokémon';
    overlay = step ? renderStep(step, { rolling: ui.reveal.rolling, wildName, view: state }) + uiBtn('skip', 'Pomiń ⏩', 'ghost small skip') : '';
  } else if (ui.result) overlay = resultBanner(ui.result, ui.result.auto);

  return { open: Boolean(scene), scene, overlay, wide: scene.includes('<div class="scene dex">'), battle: scene.includes('<div class="scene encounter') };
}
