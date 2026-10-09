// Top bar and Player Mat drawer of the digital tabletop. Pure HTML strings.
import { getLocation } from '../data/locations.js';
import { GYMS } from '../data/gyms.js';
import { POKEMON, getSpecies } from '../data/pokemon.js';
import { getLegalActions } from '../engine/turnEngine.js';
import { currentPlayer, getLead, hasHealthyPokemon } from '../engine/gameState.js';
import { evolutionTarget, evolveBlocker, starCost } from '../engine/evolutionEngine.js';
import { growthReady, usesGrowth } from '../engine/growthEngine.js';
import { ITEMS, STONE_IDS } from '../data/items.js';
import { gymHere, gymsEnabled, hasBadge, leagueHere } from '../engine/gymEngine.js';
import { hasPokeStop } from '../engine/pokeStopEngine.js';
import { itemCount } from '../engine/itemEngine.js';
import { actAttr, esc } from '../ui/dom.js';
import { DEX_STATES, badgeCase, dexState, missionCard, missionMini, pokemonCard, starTokens, superballSvg, teamDot } from './cards.js';
import { questsEnabled } from '../engine/questEngine.js';
import { plotPl } from './content-pl.js';
import { pokeballSvg } from './dice.js';
import { gi } from './icons.js';
import { itemIc } from './cards.js';
import { DICE_MODE_PL } from './i18n.js';

function actionMarkers(state) {
  const total = Math.max(state.config.actionsPerTurn, state.turn.actionsRemaining);
  return `<span class="action-markers" aria-label="Akcje: ${state.turn.actionsRemaining} z ${total}">${Array.from({ length: total }, (_, i) => `<span class="action-marker${i < state.turn.actionsRemaining ? ' on' : ''}"></span>`).join('')}</span>`;
}

function avatar(player, size = '') {
  return `<span class="avatar ${size}" style="--pc:${player.color}">${esc(player.name[0])}</span>`;
}

// Final week after the first Champion (Step 6): everyone else finishes the week.
export function finalWeekBanner(state) {
  if (state.endgame?.status !== 'finalWeek') return '';
  const champs = state.players.filter((p) => p.league?.champion).map((p) => p.name).join(' i ');
  return `<div class="final-week">👑 ${esc(champs)} — Mistrz Ligi! Ostatni tydzień: pozostali gracze kończą swoje tury.</div>`;
}

export function renderTopBar(state, ui) {
  const active = currentPlayer(state);
  const mode = DICE_MODE_PL[state.config.dice?.mode ?? 'digital'];
  const others = state.players.map((p) => `
    <button class="player-chip${p.id === active.id ? ' active' : ''}" data-ui="open-mat" data-player="${p.id}" aria-label="Plansza gracza ${esc(p.name)}">
      ${avatar(p, 'small')}<span class="chip-name">${esc(p.name)}</span>
      <span class="chip-stats">🏅${p.badges?.length ?? 0} · 📕${p.pokedex.caught.length}${p.league?.champion ? ' · 👑' : ''}</span>
    </button>`).join('');
  return `
    <div class="week-box"><span class="week-label">Tydzień</span><b>${state.turn.round}</b></div>
    <div class="turn-box" style="--pc:${active.color}">
      ${avatar(active)}
      <div><div class="turn-name"><small class="turn-label">Teraz gra</small> ${esc(active.name)}${active.controller === 'ai' ? ' <span class="tag">AI</span>' : ''}</div><div class="turn-where">📍 ${esc(getLocation(active.location).name)}</div></div>
      ${state.phase === 'over' ? '' : `<span class="act-box"><small>Akcje</small>${actionMarkers(state)}</span>`}
    </div>
    <div class="mode-box" title="${esc(mode.hint)}">🎲 ${esc(mode.name)}</div>
    <div class="chips">${others}</div>
    <button class="icon-btn" data-ui="settings" aria-label="Ustawienia">⚙️</button>
    ${finalWeekBanner(state)}`;
}

// The buttons for the active human player's turn actions (Move = tap the map).
function actionDock(state, player, ui) {
  const legal = getLegalActions(state);
  const has = (type) => legal.some((a) => a.type === type);
  const btn = (attrs, label, { primary = false, disabled = false } = {}) => `<button class="dock-btn${primary ? ' primary' : ''}" ${attrs}${disabled ? ' disabled' : ''}>${label}</button>`;
  const items = [];
  // One terrain here: Explore rolls at once; several: pick the terrain first (3A-2.5).
  const explores = legal.filter((a) => a.type === 'explore');
  // Nobody can fight: say what to do instead of a silently greyed button.
  if (!explores.length && state.turn.actionsRemaining > 0 && !hasHealthyPokemon(player)) items.push(`<span class="dock-hint">😵 Drużyna zemdlała — idź do Poké Stopu (P)${itemCount(player, 'revive') ? ' albo użyj 💎 Revive (🎒 Drużyna)' : ''}</span>`);
  else items.push(explores.length === 1 ? btn(actAttr(explores[0]), '🌿 Eksploruj', { primary: true }) : btn('data-ui="open-explore"', '🌿 Eksploruj', { primary: true, disabled: !explores.length }));
  if (has('rest')) items.push(btn('data-ui="open-rest"', '💤 Odpocznij'));
  if (hasPokeStop(player.location)) items.push(btn(`${actAttr({ type: 'visitPokeStop' })}`, '🏪 Poké Stop', { disabled: !has('visitPokeStop') }));
  if (gymsEnabled(state) && gymHere(state, player)) items.push(btn('data-ui="open-gym"', `🏟️ Sala${hasBadge(player, gymHere(state, player).id) ? ' ✓' : ''}`));
  if (gymsEnabled(state) && leagueHere(state, player)) items.push(btn('data-ui="open-gym"', '🏆 Liga'));
  if (has('challengeRocket')) items.push(btn('data-ui="open-rocket"', '🎈 Team Rocket'));
  items.push(btn('data-ui="end-turn"', ui.confirmEnd ? 'Na pewno koniec?' : '⏭ Koniec tury', { primary: state.turn.actionsRemaining === 0 }));
  return `<div class="dock">${items.join('')}</div>`;
}

// Always on the main screen: money and Poké Balls (and badges); the other
// items only when there are some — the board stays the hero (3A-2.5).
function resourceStrip(state, player, ui) {
  const fresh = ui.fresh?.stars?.[player.id] ?? 0;
  const some = (id, icon, title) => (itemCount(player, id) > 0 ? `<span class="res" title="${title}">${icon} <b>${itemCount(player, id)}</b></span>` : '');
  return `
    <span class="res" title="Pieniądze">💰 <b>${player.money}</b></span>
    <span class="res" title="Poké Balle">${pokeballSvg(22)} <b>${player.pokeballs}</b></span>
    ${some('superball', superballSvg(22), 'Super Balle')}${some('potion', itemIc('potion'), 'Potion')}${some('revive', itemIc('revive'), 'Revive')}
    ${usesGrowth(state) ? stoneRes(player) : `<span class="res${fresh ? ' pop' : ''}" title="Gwiazdki ewolucji">⭐ <b>${player.stars ?? 0}</b></span>`}
    ${gymsEnabled(state) ? `<span class="res" title="Odznaki">🏅 <b>${player.badges.length}/${state.config.gyms.badgesForLeague}</b></span>` : ''}`;
}

// The Pokédex in four states (3A-2.5): how many of each, with the legend.
export function dexSummary(player) {
  const counts = Object.fromEntries(DEX_STATES.map((d) => [d.id, 0]));
  for (const s of POKEMON) counts[dexState(player, s.id)] += 1;
  return `<div class="dex-legend">${DEX_STATES.map((d) => `<span class="dex-state ds-${d.id}" title="${esc(d.text)}"><b>${d.icon} ${d.label}</b><i>${counts[d.id]}</i></span>`).join('')}</div>`;
}

function itemLine(icon, label, n) {
  return `<div class="item-line${n ? '' : ' none'}"><span class="il-icon">${icon}</span><span>${label}</span><b>×${n}</b></div>`;
}

// Growth games: Evolution Stones in the bag (no shared star pool there).
function stoneRes(player) {
  return STONE_IDS.filter((id) => itemCount(player, id) > 0).map((id) => `<span class="res" title="${esc(ITEMS[id].name)}">${itemIc(id)} <b>${itemCount(player, id)}</b></span>`).join('');
}

// Buttons under one team card: lead, rest, items, evolve — only legal ones.
function teamActions(state, player, mon, legal, canAct) {
  if (!canAct) return '';
  const find = (pred) => legal.find(pred);
  const parts = [];
  const lead = find((a) => a.type === 'setLead' && a.target === mon.uid);
  if (lead) parts.push(`<button class="mini" ${actAttr(lead)}>Prowadź</button>`);
  const rest = find((a) => a.type === 'rest' && a.target === mon.uid);
  if (rest) parts.push(`<button class="mini" ${actAttr(rest)}>💤 +${state.config.rest.heal}</button>`);
  for (const item of ['potion', 'revive']) {
    const use = find((a) => a.type === 'useItem' && a.item === item && a.target === mon.uid);
    if (use) parts.push(`<button class="mini" ${actAttr(use)}>${itemIc(item)} ${item === 'potion' ? 'Potion' : 'Revive'}</button>`);
  }
  const evo = find((a) => a.type === 'evolve' && a.target === mon.uid);
  const from = getSpecies(mon.species);
  if (evo && usesGrowth(state)) {
    const item = from.evolution.item;
    parts.push(`<button class="mini evolve" ${actAttr(evo)} title="Ewolucja w: ${esc(evolutionTarget(from).name)}">✨ Ewoluuj${item ? ` ${itemIc(item)}` : ''}</button>`);
  } else if (evo) {
    parts.push(`<button class="mini evolve" ${actAttr(evo)}>✨ ${esc(evolutionTarget(from).name)} ⭐${starCost(from, state.config)}</button>`);
  } else if (usesGrowth(state) && state.phase === 'turn' && growthReady(mon) && mon.hp > 0) {
    // READY but not now: say why (a stone to buy, or the one evolution this turn is used).
    const why = evolveBlocker(state, player, mon) ?? '';
    const item = from.evolution.item;
    parts.push(`<button class="mini evolve" disabled title="${/Stone/.test(why) ? `Potrzebny ${esc(ITEMS[item].name)}` : 'Jedna ewolucja na turę'}">${/Stone/.test(why) ? `brak ${itemIc(item)}` : 'w nast. turze'}</button>`);
  }
  return parts.join('');
}

export function renderMat(state, player, ui) {
  const active = currentPlayer(state);
  const isActive = player.id === active.id;
  const human = player.controller === 'human';
  const canAct = isActive && human && ['turn', 'league'].includes(state.phase) && !ui.busy;
  const legal = canAct ? getLegalActions(state) : [];
  const lead = getLead(player);
  const team = Array.from({ length: state.config.maxTeamSize }, (_, i) => {
    const mon = player.team[i];
    if (!mon) return '<div class="pcard size-s empty-slot">wolne miejsce</div>';
    return pokemonCard(mon, { size: 's', lead: mon === lead, growth: usesGrowth(state), family: true, actions: teamActions(state, player, mon, legal, canAct) });
  }).join('');
  const freshStars = ui.fresh?.stars?.[player.id] ?? 0;
  const maxQuests = state.config.quests?.maxActive ?? 2;
  const quests = Array.from({ length: maxQuests }, (_, i) => missionCard(player.quests?.[i], { config: state.config })).join('');
  const toggleLabel = `🎒 Drużyna${isActive ? '' : ` ${esc(player.name)}`}`;
  return `
    <div class="mat-bar" style="--pc:${player.color}">
      <button class="mat-toggle team-btn" data-ui="toggle-mat" aria-expanded="${ui.matOpen}" aria-label="${ui.matOpen ? 'Zamknij' : 'Otwórz'}: drużyna, przedmioty, odznaki, misje i Pokédex — ${esc(player.name)}">${avatar(player)}<span class="tb-label"><b>${toggleLabel}</b><small>${ui.matOpen ? 'zamknij' : 'misje · Pokédex'}</small></span><span class="chev">${ui.matOpen ? '▼' : '▲'}</span></button>
      <button class="team-dots" data-ui="toggle-mat" aria-label="Stan drużyny ${esc(player.name)}">${player.team.map((m) => teamDot(m, { lead: m === lead })).join('')}</button>
      <div class="res-strip">${resourceStrip(state, player, ui)}</div>
      ${isActive && human && state.phase === 'turn' && !ui.busy && !state.growthChoice ? actionDock(state, player, ui) : `<div class="dock-note">${isActive && !human ? `${esc(player.name)} (AI) gra…` : isActive && state.growthChoice ? '⭐ Wybierz, kto dostaje punkt treningu' : isActive ? '' : `Tura: ${esc(active.name)}`}</div>`}
    </div>
    <div class="mat-body"${ui.matOpen ? '' : ' hidden'}>
      <section class="mat-sec team"><h4>👥 Drużyna${isActive ? '' : ` — ${esc(player.name)}`} <span class="muted">${player.team.length}/${state.config.maxTeamSize}${player.reserve.length ? ` · 📦 rezerwa ${player.reserve.length}` : ''}</span>${usesGrowth(state) ? '<span class="hint">⭐ Punkty treningu ma każdy Pokémon na swojej karcie. <b>GOTOWY</b> → ✨ Ewoluuj (jedna ewolucja na turę; czasem potrzebny kamień).</span>' : ''}<button class="ghost mh-close" data-ui="toggle-mat">▼ Zamknij</button></h4>
        <div class="team-row">${team}</div>
      </section>
      <section class="mat-sec items"><h4>🎒 Przedmioty</h4>
        ${itemLine('💰', 'Pieniądze', player.money)}
        ${itemLine(pokeballSvg(22), 'Poké Ball', player.pokeballs)}
        ${itemLine(superballSvg(22), 'Super Ball', itemCount(player, 'superball'))}
        ${itemLine('🧪', 'Potion', itemCount(player, 'potion'))}
        ${itemLine(itemIc('revive'), 'Revive', itemCount(player, 'revive'))}
        ${usesGrowth(state) ? STONE_IDS.filter((id) => itemCount(player, id) > 0).map((id) => itemLine(itemIc(id), esc(ITEMS[id].name), itemCount(player, id))).join('') : ''}
        ${usesGrowth(state) ? '' : `<div class="star-pool" title="Gwiazdki ewolucji — wspólne dla drużyny">${starTokens(player.stars ?? 0, { fresh: freshStars })}</div>`}
      </section>
      ${gymsEnabled(state) ? `<section class="mat-sec badges"><h4>🏅 Odznaki <span class="muted">${player.badges.length}/${state.config.gyms.badgesForLeague} do Ligi</span></h4>${badgeCase(state, player, { fresh: ui.fresh?.badge?.[player.id] })}</section>` : ''}
      ${questsEnabled(state) ? `<section class="mat-sec missions"><h4>📜 Aktywne misje <span class="count">${player.quests?.length ?? 0}/${maxQuests}</span></h4><div class="mission-row">${quests}</div></section>` : ''}
      <section class="mat-sec dex"><h4>📕 Pokédex</h4>${dexSummary(player)}<button class="dex-btn" data-ui="open-dex" data-player="${player.id}">📕 Otwórz Pokédex</button></section>
    </div>`;
}

export { avatar };

// ==== P1.5: the overlay HUD — the map is the table, the UI floats over it ===========
// Four widgets over a full-viewport board: the system widget (top-right: week,
// Pokédex, settings, the other players), the active player (bottom-left: a
// fixed-size summary — never grows with the team), the floating actions
// (bottom-right) and the player popup (team 3 × 2, missions, items, badges).
// The legacy top bar / bottom mat above stay for ?hud=legacy.

const ballIcon = (id) => (id === 'superball' ? superballSvg(16) : pokeballSvg(16));

export function renderSystemWidget(state, ui) {
  const active = currentPlayer(state);
  const others = state.players.filter((p) => p.id !== active.id)
    .map((p) => `<button class="sq sys-player" style="--pc:${p.color}" data-ui="open-mat" data-player="${p.id}" aria-label="Plansza gracza ${esc(p.name)}">${esc(p.name[0])}${p.league?.champion ? '<i class="crown-mini">👑</i>' : ''}</button>`).join('');
  return `
    <div class="sys">
      <span class="week glass" aria-label="Tydzień ${state.turn.round}">TYDZIEŃ ${state.turn.round}</span>
      <div class="sys-row">
        <button class="sq glass" data-ui="open-dex" data-player="${active.id}" aria-label="Pokédex">📕</button>
        <button class="sq glass" data-ui="settings" aria-label="Ustawienia">⚙️</button>
        ${others}
      </div>
      ${finalWeekBanner(state)}
    </div>`;
}

// One HP bar, no hearts beside it.
function hpBar(mon) {
  const pct = Math.round((Math.max(0, mon.hp) / mon.maxHp) * 100);
  const zone = mon.hp <= 0 ? 'out' : pct > 60 ? 'green' : pct > 30 ? 'yellow' : 'red';
  return `<span class="pw-hp z-${zone}" role="img" aria-label="HP ${mon.hp} z ${mon.maxHp}"><i style="width:${pct}%"></i></span>`;
}

// The player's resources as round coins with an outline (Build 2.4): money and
// balls — the Super Ball only when there is one.
function resCoins(player) {
  const coin = (icon, n, title) => `<span class="coin" title="${title}"><i>${icon}</i><b>${n}</b></span>`;
  return coin('💰', player.money, 'Pieniądze') + coin(ballIcon('pokeball'), player.pokeballs, 'Poké Balle') + (itemCount(player, 'superball') > 0 ? coin(ballIcon('superball'), itemCount(player, 'superball'), 'Super Balle') : '');
}
function actionDots(state, player) {
  const active = currentPlayer(state);
  if (player.id !== active.id || state.phase === 'over') return '';
  const n = Math.max(state.config.actionsPerTurn, state.turn.actionsRemaining);
  return `<span class="pw-acts" aria-label="Akcje: ${state.turn.actionsRemaining}">${Array.from({ length: n }, (_, i) => `<i class="${i < state.turn.actionsRemaining ? 'on' : ''}"></i>`).join('')}</span>`;
}
// A Pokémon as a token (Build 2.4): the round portrait, its name over the
// token's lower edge, the HP bar under the name.
function monToken(mon, lead) {
  const s = getSpecies(mon.species);
  return `<span class="mt${lead ? ' lead' : ''}${mon.hp <= 0 ? ' fainted' : ''}">${teamDot(mon)}<b class="mt-name">${esc(s.name)}</b>${hpBar(mon)}</span>`;
}

// The player widget (Build 2.4, Piotr's layout): the hero token is the core —
// the coins (money, balls) above it, the action dots left of it, the name
// beside it — and under it a small plate with every Pokémon as a token. Tap →
// the player popup. In a battle / scene: the hero token and the coins only.
export function playerWidget(state, player, ui, { collapsed = false } = {}) {
  const hero = (size = '') => `<span class="hero-token ${size}" style="--pc:${player.color}">${esc(player.name[0])}</span>`;
  if (collapsed) return `<button class="pw glass collapsed" style="--pc:${player.color}" data-ui="toggle-mat" aria-label="Drużyna i przedmioty: ${esc(player.name)}">${hero('small')}<span class="pw-res">${resCoins(player)}</span></button>`;
  const lead = getLead(player);
  return `
    <button class="pw" style="--pc:${player.color}" data-ui="toggle-mat" aria-label="Otwórz planszę gracza: ${esc(player.name)}">
      <span class="pw-res">${resCoins(player)}</span>
      <span class="pw-mid">${actionDots(state, player)}${hero()}<span class="pw-name"><b>${esc(player.name.toUpperCase())}</b>${player.controller === 'ai' ? '<small class="tag">AI</small>' : ''}</span></span>
      <span class="pw-plate glass${player.team.length > 3 ? ' big-team' : ''}" style="--cols:${Math.min(3, Math.max(1, player.team.length))}">${player.team.map((m) => monToken(m, m === lead)).join('') || '<small>brak Pokémonów</small>'}</span>
    </button>`;
}

// Contextual actions (max 3 + •••) over 🌿 Eksploruj / ⏭ Koniec.
export function floatingActions(state, player, ui) {
  const active = currentPlayer(state);
  if (player.id !== active.id) return '';
  if (active.controller !== 'human') return `<div class="fab"><span class="fab-note glass" style="--pc:${active.color}">${esc(active.name)} (AI) gra…</span></div>`;
  if (state.growthChoice) return `<div class="fab"><span class="fab-note glass">⭐ Wybierz, kto dostaje punkt treningu</span></div>`;
  if (state.phase !== 'turn' || ui.busy) return '';
  const legal = getLegalActions(state);
  const has = (type) => legal.some((a) => a.type === type);
  const chips = [];
  if (hasPokeStop(active.location)) chips.push(`<button class="chip glass" ${actAttr({ type: 'visitPokeStop' })}${has('visitPokeStop') ? '' : ' disabled'}>🏪 Poké Stop</button>`);
  if (gymsEnabled(state) && gymHere(state, active)) chips.push(`<button class="chip glass" data-ui="open-gym">🏟️ Sala${hasBadge(active, gymHere(state, active).id) ? ' ✓' : ''}</button>`);
  if (gymsEnabled(state) && leagueHere(state, active)) chips.push('<button class="chip glass" data-ui="open-gym">🏆 Liga</button>');
  if (has('rest')) chips.push('<button class="chip glass" data-ui="open-rest">💤 Odpocznij</button>');
  if (has('challengeRocket')) chips.push('<button class="chip glass" data-ui="open-rocket">🎈 Rocket</button>');
  const shown = ui.moreActions || chips.length <= 3 ? chips : [...chips.slice(0, 3), '<button class="chip glass more" data-ui="more-actions" aria-label="Więcej akcji">•••</button>'];
  const explores = legal.filter((a) => a.type === 'explore');
  const main = !explores.length && state.turn.actionsRemaining > 0 && !hasHealthyPokemon(active)
    ? `<span class="fab-hint glass">😵 Drużyna zemdlała — idź do Poké Stopu (P)${itemCount(active, 'revive') ? ' albo użyj 💎 Revive (dotknij swojego widgetu)' : ''}</span>`
    : explores.length === 1 ? `<button class="fab-main" ${actAttr(explores[0])}>🌿 Eksploruj</button>` : `<button class="fab-main" data-ui="open-explore"${explores.length ? '' : ' disabled'}>🌿 Eksploruj</button>`;
  return `
    <div class="fab">
      ${shown.length ? `<div class="fab-chips">${shown.join('')}</div>` : ''}
      <div class="fab-row"><button class="fab-end glass${state.turn.actionsRemaining === 0 ? ' now' : ''}" data-ui="end-turn">${ui.confirmEnd ? 'Na pewno koniec?' : '⏭ Koniec'}</button>${main}</div>
    </div>`;
}

// The quick actions of the Pokémon detail (P1.5b, tap a card): only the legal
// ones, only for the player whose turn it is; ✏️ Kadr always.
export function detailActions(state, mon, { busy = false } = {}) {
  const player = state.players.find((p) => p.team.includes(mon));
  const active = currentPlayer(state);
  const s = getSpecies(mon.species);
  const canAct = Boolean(player) && player.id === active.id && player.controller === 'human' && ['turn', 'league'].includes(state.phase) && !busy;
  const legal = canAct ? getLegalActions(state) : [];
  const find = (pred) => legal.find(pred);
  const acts = [];
  if (canAct) {
    const evo = find((a) => a.type === 'evolve' && a.target === mon.uid);
    if (evo) acts.push(`<button class="primary" ${actAttr(evo)}>✨ Ewoluuj → ${esc(evolutionTarget(s).name)}${usesGrowth(state) && s.evolution?.item ? ` ${itemIc(s.evolution.item)}` : ''}</button>`);
    for (const item of ['potion', 'revive']) {
      const use = find((a) => a.type === 'useItem' && a.item === item && a.target === mon.uid);
      if (use) acts.push(`<button ${actAttr(use)}>${itemIc(item)} ${item === 'potion' ? 'Potion' : 'Revive'}</button>`);
    }
    const rest = find((a) => a.type === 'rest' && a.target === mon.uid);
    if (rest) acts.push(`<button ${actAttr(rest)}>💤 Odpocznij +${state.config.rest.heal} <small>(1 akcja)</small></button>`);
    if (!evo && usesGrowth(state) && state.phase === 'turn' && growthReady(mon) && mon.hp > 0) {
      const why = evolveBlocker(state, player, mon) ?? '';
      acts.push(`<button disabled>${/Stone/.test(why) ? `✨ potrzebny ${itemIc(s.evolution.item)} ${esc(ITEMS[s.evolution.item].name)}` : '✨ ewolucja w następnej turze'}</button>`);
    }
  }
  return acts.join('');
}

// The player popup (Build 2.4, Piotr's layout): the big hero token in the top
// left corner and the board unfolding under it — the team as cards (empty slots
// show what is missing; the active Pokémon has the gold frame and AKTYWNY; drag
// a card to change the order, tap it for the detail) — missions beside it,
// items under the missions. No counters, no money / badge pills in the header.
export function playerPopup(state, player, ui) {
  const active = currentPlayer(state);
  const isActive = player.id === active.id;
  const lead = getLead(player);
  const canOrder = isActive && player.controller === 'human' && ['turn', 'league'].includes(state.phase) && !ui.busy && player.team.length > 1;
  const cells = Array.from({ length: state.config.maxTeamSize }, (_, i) => {
    const mon = player.team[i];
    if (!mon) return '<div class="tg-cell empty" aria-label="wolne miejsce"></div>';
    return `<div class="tg-cell${mon === lead ? ' lead' : ''}" data-uid="${esc(mon.uid)}" data-slot="${i}"${canOrder ? ' data-drag-mon' : ''}>${mon === lead ? '<span class="tg-active">AKTYWNY</span>' : ''}${pokemonCard(mon, { size: 'm', lead: mon === lead, growth: usesGrowth(state), family: true, edit: true })}</div>`;
  }).join('');
  const maxQuests = state.config.quests?.maxActive ?? 2;
  const items = [['💰', 'Pieniądze', player.money], [ballIcon('pokeball'), 'Poké Ball', player.pokeballs], [ballIcon('superball'), 'Super Ball', itemCount(player, 'superball')], ['🧪', 'Potion', itemCount(player, 'potion')], [itemIc('revive'), 'Revive', itemCount(player, 'revive')],
    ...(usesGrowth(state) ? STONE_IDS.filter((id) => itemCount(player, id) > 0).map((id) => [itemIc(id), ITEMS[id].name, itemCount(player, id)]) : []),
    ...(player.reserve.length ? [['📦', 'Rezerwa', player.reserve.length]] : [])];
  return `
    <div class="pop-scrim" data-ui="toggle-mat" aria-hidden="true"></div>
    <div class="popup glass-strong" style="--pc:${player.color}" role="dialog" aria-label="Plansza gracza ${esc(player.name)}">
      <header><span class="hero-token big" style="--pc:${player.color}">${esc(player.name[0])}</span>${actionDots(state, player)}<div><b class="pn">${esc(player.name)}</b>${isActive ? '' : ' <span class="tag">podgląd</span>'}<small>📍 ${esc(getLocation(player.location).name)}${player.capabilities?.canTravelWater ? ' · 🌊' : ''}</small></div>
        <button class="x" data-ui="toggle-mat" aria-label="Zamknij">✕</button></header>
      <div class="pop-body">
        <section class="pop-team"><div class="team-grid">${cells}</div></section>
        <aside>
          ${questsEnabled(state) ? `<section class="pop-box"><h4>MISJE</h4><div class="mq-col">${Array.from({ length: maxQuests }, (_, i) => missionMini(player.quests?.[i], { config: state.config })).join('')}</div></section>` : ''}
          <section class="pop-box"><h4>PRZEDMIOTY</h4><div class="it-grid">${items.map(([icon, name, n]) => `<div class="it${n ? '' : ' zero'}" title="${esc(name)}"><span>${icon}</span><b>${n}</b></div>`).join('')}</div>
            ${usesGrowth(state) ? '' : `<div class="star-pool" title="Gwiazdki ewolucji">${starTokens(player.stars ?? 0)}</div>`}</section>
          ${gymsEnabled(state) ? popupBadges(player) : ''}
        </aside>
      </div>
    </div>`;
}

// Build 2.5.1 (Piotr: „nie mogę sprawdzić, jakie mam odznaki”): every gym's
// badge in the popup — the earned ones in the gym's type colour; a tap on the
// row names them (one big touch target, the slots are small).
function popupBadges(player) {
  const slots = GYMS.map((g) => {
    const has = player.badges.includes(g.id);
    return `<span class="badge-slot${has ? ' earned' : ''}" title="${esc(g.badge)}">${has ? gi(`type.${g.type}`) : ''}</span>`;
  }).join('');
  const extra = `${player.league?.ribbon ? `<span class="ribbon" title="Wstęga Elitarnej Czwórki">${gi('ribbon')}</span>` : ''}${player.league?.champion ? `<span class="crown" title="Mistrz Ligi">${gi('champion')}</span>` : ''}`;
  return `<section class="pop-box badges"><h4>ODZNAKI <small>${player.badges.length}/${GYMS.length}</small></h4><button class="badge-case" data-ui="badge-info" data-player="${esc(player.id)}" aria-label="Odznaki: ${player.badges.length} z ${GYMS.length}">${slots}${extra}</button></section>`;
}

export function renderHud(state, player, ui, { sceneOpen = false } = {}) {
  const active = currentPlayer(state);
  const collapsed = state.phase === 'encounter' || sceneOpen;
  return `
    <div class="hud-bl">${playerWidget(state, active, ui, { collapsed })}</div>
    <div class="hud-br">${sceneOpen ? '' : floatingActions(state, active, ui)}</div>
    ${ui.matOpen ? playerPopup(state, player, ui) : ''}`;
}

// The Team Rocket plot as a small pill in the map's right strip — the full card opens on tap.
export function rocketPill(state) {
  const active = state.rocket?.active;
  if (!active) return '';
  const card = plotPl(active.plotId);
  const loot = active.loot.length ? ` · łupy ${active.loot.length}` : '';
  return `<button class="rocket glass" data-ui="open-rocket" aria-label="Karta spisku Team Rocket: ${esc(card.title)}"><span class="rk-icon">${gi('rocket')}</span><span><b>Team Rocket</b><small>📍 ${esc(getLocation(active.location).name)}${loot}</small></span></button>`;
}
