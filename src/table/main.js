// Digital tabletop entry point (Phase 1b). Holds the GameState, sends every
// player action through the engine, asks for physical dice when the dice mode
// wants them, then replays what the engine rolled as dice on the table. No
// game rules live here. Its own save slot, separate from the developer harness.
import { CONFIG } from '../config.js';
import { GYMS } from '../data/gyms.js';
import { getLocation } from '../data/locations.js';
import { CHARACTERS } from '../data/characters.js';
import { createGame, currentPlayer, deserialize, serialize } from '../engine/gameState.js';
import { dispatch } from '../engine/turnEngine.js';
import { chooseAction } from '../engine/aiEngine.js';
import { currentOpponent } from '../engine/combatEngine.js';
import { randomSeed, timeLimitOptions } from '../ui/setup.js';
import { esc } from '../ui/dom.js';
import { BoardView } from './board.js';
import { detailActions, renderHud, renderMat, renderSystemWidget, rocketPill, renderTopBar } from './hud.js';
import { renderTableLayer } from './tableLayer.js';
import { buildReveal, displayView, faceToDie, nextPhysicalNeed, outcomeSummary, reorderPlan } from './flow.js';
import { DICE_MODE_PL } from './i18n.js';
import { iconText } from './icons.js';
import { rocketPlotCard, setCardStyle } from './cards.js';
import { effectsPl, errorPl, eventPl } from './content-pl.js';
import { EVENTS_BY_ID } from '../data/events.js';
import { keepUnreadable, loadSave, writeSave } from '../ui/saveSlot.js';
import { ART_CACHE, ART_RETRY_MS, artFailures, artUrlFor, markArtFailed, markArtLoaded, retryArt, setArtSource, useArtStorage } from './art.js';
import { POKEMON } from '../data/pokemon.js';
import { createArtEditor } from './artEditor.js';
import { inspectView, pokemonDetail } from './cards.js';
import { usesGrowth } from '../engine/growthEngine.js';
import { getSpecies } from '../data/pokemon.js';

// Save slots. Schema 13+ (Phase 3) saves live in v2; builds from before Phase 3
// read only v1, so they never meet a save they can't load (the published Phase
// 2 build had no save safety net). v1 is read once — to continue a Phase 2 game
// under its own rules — and never written again.
const SAVE_KEY = 'kanto.table.v2';
const LEGACY_SAVE_KEY = 'kanto.table.v1';
const PREFS_KEY = 'kanto.table.prefs.v1';
const $ = (sel) => document.querySelector(sel);

// A table.html older than these modules (the browser's HTTP cache right after
// an update) lacks parts the game needs: refresh the page from the network and
// reload (at most twice) instead of breaking; then say what to do.
export const TABLE_PARTS = ['#topbar', '#board', '#table', '#rocket-pin', '#overlay', '#mat', '#toast', '#setup-dialog', '#setup-form', '#btn-seed', '#settings-dialog', '#inspect-dialog', '#art-editor', '#save-dialog'];
{
  const session = (() => {
    try {
      return window.sessionStorage;
    } catch {
      return null;
    }
  })();
  if (TABLE_PARTS.some((sel) => !$(sel))) {
    const tries = Number(session?.getItem('kanto.staleReload') ?? 0);
    if (tries < 2) {
      session?.setItem('kanto.staleReload', String(tries + 1));
      fetch(location.href, { cache: 'reload' }).catch(() => {}).finally(() => location.reload());
    } else {
      document.body.insertAdjacentHTML('afterbegin', '<p style="position:fixed;inset:auto 12px 12px;z-index:99;background:#fff4d6;color:#1d2433;border:2px solid #f0cf7a;border-radius:12px;padding:12px 16px;font:600 1.05rem system-ui">Gra właśnie się zaktualizowała. Zamknij ją i otwórz ponownie (z internetem).</p>');
    }
    throw new Error('table.html is older than the game modules — refreshing it');
  }
  session?.removeItem('kanto.staleReload');
}

const ui = {
  matOpen: false, matPlayer: null, panel: null, dexPlayer: null, catchPrep: null, switchPick: false, prompt: null, reveal: null, result: null,
  // diceRoll: a device with no saved choice rolls on full auto (Build 2.3); a saved choice is kept
  busy: false, hold: null, moreActions: false, confirmEnd: false, diceRoll: 'auto', exchange: [], fresh: { stars: {}, badge: {} }, aiDelay: 1100, showOdds: false, skip: false,
};
// ?autoplay: every seat is played by the AI chooser through this same table
// (dry runs, physical-dice prompts answered at random, reveals, results) — the
// full-game playability check. ?autoplay=fast shortens every pause.
const params = new URLSearchParams(location.search);
const AUTOPLAY = params.has('autoplay');
// ?art=off: every card with its fallback picture (no network) — a check of the
// offline look.
if (params.get('art') === 'off') setArtSource('off');
const SPEED = params.get('autoplay') === 'fast' ? 0.15 : AUTOPLAY ? 0.5 : 1;
// P1.5: the overlay HUD (the map is the table, widgets float over it). The old
// top bar / bottom mat stay only as a developer fallback: ?hud=legacy — never
// offered to the family. Removed after P1.5 is approved.
const LEGACY_HUD = params.get('hud') === 'legacy';
document.body.classList.add(LEGACY_HUD ? 'hud-legacy' : 'hud-overlay');
setCardStyle(LEGACY_HUD ? 'classic' : 'full');
let state = null;
let aiTimer = null;
let toastTimer = null;
// Save safety (src/ui/saveSlot.js): a save this version can't load is backed
// up and never overwritten silently; autosave stays off when that isn't safe.
const store = (() => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
})();
let saveBlocked = !store;
// Portrait crops fixed in the game (✏️): per species, in their own
// localStorage key ('pokemon.artFocus.v1'), never inside a game save.
useArtStorage(store);
let saveProblem = null;
let saveFailNoted = false;

try {
  Object.assign(ui, JSON.parse(localStorage.getItem(PREFS_KEY)) ?? {});
} catch {
  /* defaults */
}
const savePrefs = () => {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ aiDelay: ui.aiDelay, showOdds: ui.showOdds, diceRoll: ui.diceRoll }));
  } catch {
    /* storage unavailable */
  }
};

const board = new BoardView($('#board'), {
  onMove: (to) => {
    ui.panel = null;
    perform({ type: 'move', to });
  },
  onInfo: toast,
});

function toast(message) {
  const el = $('#toast');
  el.innerHTML = iconText(esc(message));
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), 3800);
}

function save() {
  if (saveBlocked || !state) return;
  if (!writeSave(store, SAVE_KEY, serialize(state)) && !saveFailNoted) {
    saveFailNoted = true; // storage full: the game still runs, the player knows
    toast('Nie udało się zapisać gry — pamięć przeglądarki jest pełna.');
  }
}

// ---- rendering --------------------------------------------------------------------

function render() {
  if (!state) return;
  if (!document.body.classList.contains('dragging')) clearDragGhosts(); // never a ghost left behind
  const view = ui.reveal?.view ?? displayView(state, ui.hold);
  const matPlayer = view.players.find((p) => p.id === ui.matPlayer) ?? currentPlayer(view);
  const layer = renderTableLayer({ state, view, ui });
  // The UI strings mark icons with emoji; iconText draws the game's icons (icons.js).
  if (LEGACY_HUD) {
    $('#topbar').innerHTML = iconText(renderTopBar(view, ui));
    $('#mat').innerHTML = iconText(renderMat(view, matPlayer, ui));
  } else {
    $('#topbar').innerHTML = iconText(renderSystemWidget(view, ui));
    $('#mat').innerHTML = iconText(renderHud(view, matPlayer, ui, { sceneOpen: layer.open }));
  }
  $('#mat').classList.toggle('open', ui.matOpen);
  $('#table').innerHTML = iconText(layer.scene);
  $('#table').classList.toggle('open', layer.open);
  $('#table').classList.toggle('wide', Boolean(layer.wide));
  $('#table').classList.toggle('battle', Boolean(layer.battle));
  $('#overlay').innerHTML = layer.overlay ? `<div class="overlay-card">${iconText(layer.overlay)}</div>` : '';
  $('#overlay').classList.toggle('show', Boolean(layer.overlay));
  $('#overlay').classList.toggle('over-table', layer.open);
  document.body.classList.toggle('table-open', layer.open);
  const pin = !LEGACY_HUD ? rocketPill(view) : view.rocket?.active ? `<button class="pin-card" data-ui="open-rocket" aria-label="Karta spisku Team Rocket">${rocketPlotCard(view, { size: 'pin' })}</button>` : '';
  $('#rocket-pin').innerHTML = iconText(pin);
  $('#rocket-pin').hidden = !pin || layer.open;
  board.render(state, { interactive: !ui.busy && !ui.prompt });
  if (!LEGACY_HUD) placeHud();
}

// ---- timing ------------------------------------------------------------------------

function sleep(ms) {
  ms *= SPEED;
  return new Promise((resolve) => {
    if (ui.skip) {
      resolve();
      return;
    }
    const t = setTimeout(resolve, ms);
    ui.skipNow = () => {
      clearTimeout(t);
      resolve();
    };
  });
}

const HOLD = { explore: 1400, rarity: 1200, attack: 1400, catch: 1300, escape: 2000, note: 1200, d6: 1100 };

function findMon(view, uid) {
  const pools = [...view.players.flatMap((p) => [...p.team, ...p.reserve]), view.encounter?.pokemon, ...(view.encounter?.trainer?.pokemonTeam ?? [])];
  return pools.find((m) => m?.uid === uid);
}

// Show the dice the engine rolled, one by one, on the pre-action copy; HP
// hearts drop when the damage is revealed.
async function playReveal(before, steps, scene, fast) {
  ui.skip = false;
  ui.reveal = { view: structuredClone(before), steps, i: 0, rolling: false, scene };
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    ui.reveal.i = i;
    if (step.type !== 'note' && !step.physical) {
      ui.reveal.rolling = true;
      render();
      await sleep(fast ? 300 : 650);
    }
    ui.reveal.rolling = false;
    if (step.type === 'attack') {
      const mon = findMon(ui.reveal.view, step.defenderUid);
      if (mon) mon.hp = step.hpAfter;
    }
    if (step.type === 'switch') {
      // The newcomer takes the lead on the table the moment the switch shows.
      const team = currentPlayer(ui.reveal.view).team;
      const i = team.findIndex((m) => m.uid === step.to);
      if (i > 0) team.unshift(...team.splice(i, 1));
    }
    render();
    await sleep((HOLD[step.type] ?? 1100) * (fast ? 0.55 : 1));
  }
  ui.reveal = null;
}

async function showResult(summary, auto) {
  auto ||= AUTOPLAY;
  ui.result = { ...summary, auto };
  render();
  if (auto) await sleep(1700);
  else await new Promise((resolve) => (ui.resultResolve = resolve));
  ui.result = null;
  ui.resultResolve = null;
}

// P1.5b dice on this device: a fair d6 mapped onto the die the game asks for (flow.faceToDie).
function rollFor(need) {
  return faceToDie(need, 1 + (crypto.getRandomValues(new Uint32Array(1))[0] % 6), state.config);
}

function askDice(need, cancellable) {
  return new Promise((resolve) => {
    ui.prompt = { need, cancellable, resolve, tap: ui.diceRoll === 'tap' };
    render();
    if (AUTOPLAY) {
      const pick = (xs) => xs[Math.floor(Math.random() * xs.length)];
      const value = need.type === 'catch' ? pick(['ball', 'blank']) : need.type === 'escape' ? pick(['stay', 'flee']) : pick([1, 2, 3, 4, 5, 6]);
      setTimeout(() => resolve(value), 500 * SPEED);
    }
  });
}

// Explore that ended back on the board: show what was found.
function exploreSummary(state, action, from) {
  if (action.type !== 'explore' || state.phase !== 'turn') return null;
  const drawn = state.log.slice(from).find((e) => e.data?.event && e.data.choice === undefined);
  if (drawn) {
    const e = eventPl(drawn.data.event);
    return { tone: 'neutral', title: `❗ ${e.title}`, text: `${e.text} ${effectsPl(EVENTS_BY_ID[drawn.data.event].effects ?? [])}`.trim() };
  }
  if (state.log.slice(from).some((e) => e.data?.rocket)) return null;
  return { tone: 'neutral', title: 'Cisza…', text: 'Nic się nie dzieje. Może następnym razem!' };
}

function markFresh(before, after) {
  for (const p of after.players) {
    const b = before.players.find((x) => x.id === p.id);
    if ((p.stars ?? 0) > (b.stars ?? 0)) ui.fresh.stars[p.id] = p.stars - b.stars;
    const badge = p.badges?.find((x) => !b.badges?.includes(x));
    if (badge) ui.fresh.badge[p.id] = badge;
  }
  setTimeout(() => {
    ui.fresh = { stars: {}, badge: {} };
    render();
  }, 2600);
}

// ---- the one way to act ----------------------------------------------------------------

async function perform(action, meta) {
  if (!state || ui.busy) return;
  const actor = currentPlayer(state);
  const ai = actor.controller === 'ai' || AUTOPLAY;
  if (actor.controller === 'ai' && !meta?.ai) {
    toast(`Teraz gra ${actor.name} (AI).`);
    return;
  }
  ui.busy = true;
  ui.confirmEnd = false;
  const turnBefore = { playerIndex: state.turn.playerIndex, round: state.turn.round };
  try {
    // Physical dice first: dry runs say which die the engine needs next.
    // P1.5b: 'auto' rolls them at once, 'tap' on the player's tap (rollFor) —
    // entered like real dice, so the save and the replay stay exact.
    const entered = [];
    let rolledHere = false;
    for (let need = nextPhysicalNeed(state, action, entered); need; need = nextPhysicalNeed(state, action, entered)) {
      const auto = ui.diceRoll === 'auto' && !AUTOPLAY;
      const value = auto ? rollFor(need) : await askDice(need, !ai);
      ui.prompt = null;
      if (value === null) return;
      if (auto || ui.rolledByTap) rolledHere = true;
      ui.rolledByTap = false;
      entered.push(value);
    }
    const before = structuredClone(state);
    if (entered.length) dispatch(state, { type: 'enterDice', values: entered });
    const from = state.log.length;
    const result = dispatch(state, action, meta);
    if (!result.ok) {
      toast(errorPl(result.error));
      return;
    }
    save();
    ui.catchPrep = null;
    ui.switchPick = false;
    ui.itemPick = false;
    ui.retreatPick = false;
    if (!['useItem', 'setLead', 'evolve'].includes(action.type)) ui.panel = null;
    ui.moreActions = false;
    const steps = buildReveal(state, from);
    const attacks = steps.filter((s) => s.type === 'attack');
    const scene = before.phase === 'encounter' ? 'encounter' : action.type === 'explore' ? 'explore' : null;
    // A card just placed on the table is dealt in (once, not on every render).
    const opp = state.phase === 'encounter' ? currentOpponent(state.encounter) : null;
    const prevOpp = before.phase === 'encounter' ? currentOpponent(before.encounter) : null;
    if (opp && opp.uid !== prevOpp?.uid) {
      ui.dealUid = opp.uid;
      setTimeout(() => (ui.dealUid = null), 800);
    }
    // Dice the game rolled here (auto / tap) roll on the table like digital ones.
    if (steps.length) await playReveal(before, rolledHere ? steps.map((x) => (x.physical ? { ...x, physical: false } : x)) : steps, scene, ai);
    if (attacks.length) ui.exchange = attacks;
    else if (action.type === 'throwBall') ui.exchange = [];
    if (state.phase !== 'encounter') ui.exchange = [];
    markFresh(before, state);
    const summary = outcomeSummary(before, state, action) ?? exploreSummary(state, action, from);
    const passed = state.phase !== 'over' && (state.turn.playerIndex !== turnBefore.playerIndex || state.turn.round !== turnBefore.round);
    if (summary) {
      // The result belongs to the player who acted: keep their HUD until it is
      // closed, then say whose turn it is (P0: "the money went to the next player").
      ui.hold = passed ? turnBefore : null;
      await showResult(summary, ai);
      ui.hold = null;
      if (passed) {
        const next = currentPlayer(state);
        await showResult({ tone: 'neutral', title: `Tura: ${next.name}`, text: next.controller === 'ai' ? `${next.name} (AI) gra…` : 'Teraz Twój ruch!', handoff: next.color }, true);
      }
    }
  } finally {
    ui.busy = false;
    ui.hold = null;
    ui.prompt = null;
    ui.reveal = null;
    ui.skip = false;
    render();
    scheduleAi();
  }
}

function scheduleAi() {
  clearTimeout(aiTimer);
  if (!state || state.phase === 'over' || ui.busy || (currentPlayer(state).controller !== 'ai' && !AUTOPLAY)) return;
  aiTimer = setTimeout(stepAi, AUTOPLAY ? 400 * SPEED : ui.aiDelay);
}

function stepAi() {
  if (!state || ui.busy || (currentPlayer(state).controller !== 'ai' && !AUTOPLAY)) return;
  const decision = chooseAction(state);
  if (!decision) {
    toast('AI nie ma ruchu.');
    return;
  }
  perform(decision.action, { ai: decision.ai });
}

// ---- input ---------------------------------------------------------------------------

document.addEventListener('click', (e) => {
  const dice = e.target.closest('[data-dice]');
  if (dice && ui.prompt) {
    const v = dice.dataset.dice;
    if (v === 'roll') ui.rolledByTap = true;
    ui.prompt.resolve(v === 'roll' ? rollFor(ui.prompt.need) : /^\d$/.test(v) ? Number(v) : v);
    return;
  }
  const edit = e.target.closest('[data-art-edit]');
  if (edit) {
    artEditor.open(edit.dataset.artEdit, edit.dataset.artShape);
    return;
  }
  const actEl = e.target.closest('[data-act]');
  if (actEl && !actEl.disabled) {
    // a quick action of the Pokémon detail: the detail closes, the table shows the result
    if (inspectDialog.contains(actEl)) inspectDialog.close();
    perform(JSON.parse(actEl.dataset.act));
    return;
  }
  const el = e.target.closest('[data-ui]');
  // Tapping a Pokémon card (not a button on it) opens the inspect view.
  const card = !el && e.target.closest('[data-inspect], [data-inspect-species]');
  if (card) {
    openInspect(card.dataset.inspect, card.dataset.inspectSpecies);
    return;
  }
  if (!el || el.disabled) return;
  const cmd = el.dataset.ui;
  switch (cmd) {
    case 'toggle-mat':
      ui.matOpen = !ui.matOpen;
      if (!ui.matOpen) ui.matPlayer = null;
      break;
    case 'more-actions':
      ui.moreActions = !ui.moreActions;
      break;
    case 'open-mat':
      ui.matPlayer = el.dataset.player;
      ui.matOpen = true;
      break;
    case 'open-explore':
    case 'open-gym':
    case 'open-rest':
    case 'open-rocket':
      ui.panel = cmd.slice(5);
      ui.matOpen = false;
      break;
    case 'switch-open':
      ui.switchPick = true;
      ui.catchPrep = null;
      break;
    case 'switch-close':
      ui.switchPick = false;
      break;
    case 'items-open':
      ui.itemPick = true;
      ui.switchPick = false;
      ui.retreatPick = false;
      ui.catchPrep = null;
      break;
    case 'items-close':
      ui.itemPick = false;
      break;
    case 'retreat-open':
      ui.retreatPick = true;
      ui.itemPick = false;
      ui.switchPick = false;
      ui.catchPrep = null;
      break;
    case 'retreat-close':
      ui.retreatPick = false;
      break;
    case 'open-dex':
      ui.panel = 'dex';
      ui.dexPlayer = el.dataset.player;
      ui.matOpen = false;
      break;
    case 'close-panel':
      ui.panel = null;
      break;
    case 'end-turn':
      if (state.turn.actionsRemaining > 0 && !ui.confirmEnd) {
        ui.confirmEnd = true;
        setTimeout(() => {
          ui.confirmEnd = false;
          render();
        }, 3500);
        toast(`Masz jeszcze ${state.turn.actionsRemaining} ${state.turn.actionsRemaining === 1 ? 'akcję' : 'akcje'}. Dotknij jeszcze raz, by zakończyć turę.`);
        break;
      }
      perform({ type: 'endTurn' });
      return;
    case 'catch':
      // Full auto (P1.5b): the ball is thrown at once, no extra „Rzucaj!”.
      if (ui.diceRoll === 'auto') {
        perform({ type: 'throwBall', ball: el.dataset.ball });
        return;
      }
      ui.catchPrep = { ball: el.dataset.ball };
      ui.switchPick = false;
      break;
    case 'cancel-catch':
      ui.catchPrep = null;
      break;
    case 'throw':
      perform({ type: 'throwBall', ball: el.dataset.ball });
      return;
    case 'badge-info': {
      // Build 2.5.1: which badges this player has, and which gyms are left.
      const owner = state.players.find((p) => p.id === el.dataset.player) ?? currentPlayer(state);
      const has = GYMS.filter((g) => owner.badges.includes(g.id)).map((g) => g.badge);
      const left = GYMS.filter((g) => !owner.badges.includes(g.id)).map((g) => `${g.badge} (${getLocation(g.city).name})`);
      toast(`${has.length ? `Masz: ${has.join(', ')}.` : 'Jeszcze żadnej odznaki.'}${left.length ? ` Do zdobycia: ${left.join(', ')}.` : ' Wszystkie odznaki!'}`);
      return;
    }
    case 'dismiss-result':
      ui.resultResolve?.();
      return;
    case 'skip':
      ui.skip = true;
      ui.skipNow?.();
      return;
    case 'cancel-prompt':
      ui.prompt?.resolve(null);
      return;
    case 'settings':
      openSettings();
      return;
    case 'new-game':
      openSetup();
      return;
    default:
      return;
  }
  render();
});

// Drag a ball token onto the wild Pokémon card (tap = the same throw panel).
// Build 2.5.1 (Piotr: a Super Ball stayed on the table in a frame after a
// throw): the ghost appears only once the finger really moves, the listeners
// live on the document (the tile may be redrawn under the finger) and every
// way out removes it; render() clears any ghost left behind.
document.addEventListener('pointerdown', (e) => {
  const token = e.target.closest('[data-drag-ball]');
  if (!token || ui.busy) return;
  e.preventDefault();
  const ball = token.dataset.dragBall;
  const pointer = e.pointerId;
  const start = { x: e.clientX, y: e.clientY };
  let ghost = null;
  let over = null;
  const onMove = (ev) => {
    if (ev.pointerId !== pointer) return;
    if (!ghost) {
      if (Math.hypot(ev.clientX - start.x, ev.clientY - start.y) <= 8) return;
      ghost = token.cloneNode(true);
      ghost.classList.add('drag-ghost');
      ghost.removeAttribute('data-drag-ball');
      document.body.append(ghost);
      document.body.classList.add('dragging');
    }
    ghost.style.left = `${ev.clientX}px`;
    ghost.style.top = `${ev.clientY}px`;
    const target = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('[data-drop]') ?? null;
    if (target !== over) {
      over?.classList.remove('hover');
      over = target;
      over?.classList.add('hover');
    }
  };
  const finish = (ev, cancelled) => {
    if (ev.pointerId !== pointer) return;
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', onUp);
    document.removeEventListener('pointercancel', onCancel);
    const moved = Boolean(ghost);
    clearDragGhosts();
    over?.classList.remove('hover');
    if (!moved) return; // a tap: the tile's own click (data-ui="catch") handles it
    dragEndedAt = Date.now(); // a drag: the click that may follow must not act again
    if (!cancelled && over) {
      if (ui.diceRoll === 'auto') {
        perform({ type: 'throwBall', ball });
        return;
      }
      ui.catchPrep = { ball };
      render();
    }
  };
  const onUp = (ev) => finish(ev, false);
  const onCancel = (ev) => finish(ev, true);
  document.addEventListener('pointermove', onMove);
  document.addEventListener('pointerup', onUp);
  document.addEventListener('pointercancel', onCancel);
});

function clearDragGhosts() {
  for (const g of document.querySelectorAll('.drag-ghost')) g.remove();
  document.body.classList.remove('dragging');
}

// Build 2.4: drag a card in the player popup onto another place to change the
// team order (the first healthy Pokémon is the active one) — flow.reorderPlan:
// the existing free setLead, no new rule, replay-safe.
let dragEndedAt = 0;
document.addEventListener('click', (e) => {
  if (Date.now() - dragEndedAt < 300) {
    e.stopPropagation();
    e.preventDefault();
  }
}, true);
document.addEventListener('pointerdown', (e) => {
  const cell = e.target.closest('[data-drag-mon]');
  if (!cell || ui.busy || e.target.closest('button')) return;
  const start = { x: e.clientX, y: e.clientY };
  let ghost = null;
  let over = null;
  const onMove = (ev) => {
    if (!ghost) {
      if (Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < 10) return;
      ghost = cell.querySelector('.pcard').cloneNode(true);
      ghost.classList.add('drag-ghost', 'mon-ghost');
      document.body.append(ghost);
      cell.classList.add('dragging-from');
    }
    ghost.style.left = `${ev.clientX}px`;
    ghost.style.top = `${ev.clientY}px`;
    const target = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.tg-cell[data-slot]') ?? null;
    if (target !== over) {
      over?.classList.remove('drop-here');
      over = target !== cell ? target : null;
      over?.classList.add('drop-here');
    }
  };
  const finish = () => {
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', finish);
    document.removeEventListener('pointercancel', finish);
    if (!ghost) return;
    ghost.remove();
    cell.classList.remove('dragging-from');
    over?.classList.remove('drop-here');
    dragEndedAt = Date.now();
    if (over) moveMon(cell.dataset.uid, Number(over.dataset.slot));
  };
  document.addEventListener('pointermove', onMove);
  document.addEventListener('pointerup', finish);
  document.addEventListener('pointercancel', finish);
});

async function moveMon(uid, to) {
  const plan = reorderPlan(currentPlayer(state).team, uid, to);
  if (!plan) return;
  if (plan.blocked) {
    toast('Omdlały Pokémon nie może iść przed zdrowe — najpierw go ulecz.');
    return;
  }
  for (const action of plan.actions) await perform(action);
}

// ---- setup and settings ----------------------------------------------------------------

const setupDialog = $('#setup-dialog');
const setupForm = $('#setup-form');
const ARCHETYPES = Object.keys(CONFIG.ai.archetypes);
const ARCHETYPE_PL = { balanced: 'zrównoważony', collector: 'kolekcjoner', aggressive: 'wojownik', explorer: 'odkrywca' };

function renderLimitOptions() {
  const n = CHARACTERS.filter((c) => setupForm.elements[`on-${c.id}`].checked).length;
  const current = setupForm.elements.timeLimit.value;
  setupForm.elements.timeLimit.innerHTML = timeLimitOptions(n).map((w) => `<option value="${w ?? ''}"${String(w ?? '') === current ? ' selected' : ''}>${w === null ? 'Bez limitu — do Mistrza Ligi' : `${w} tygodni`}</option>`).join('');
}

function openSetup() {
  const prev = state?.setup;
  const players = prev?.players ?? [{ character: 'ash', controller: 'human' }, { character: 'misty', controller: 'human' }];
  const byChar = Object.fromEntries(players.map((p) => [p.character, p]));
  setupForm.querySelector('.setup-players').innerHTML = CHARACTERS.map((c) => {
    const p = byChar[c.id];
    return `<div class="setup-player" style="--pc:${c.color}">
      <label class="pick-player"><input type="checkbox" name="on-${c.id}"${p ? ' checked' : ''}><span class="avatar" style="--pc:${c.color}">${esc(c.name[0])}</span>${esc(c.name)}</label>
      <select name="ctl-${c.id}"><option value="human"${p?.controller !== 'ai' ? ' selected' : ''}>Gracz</option><option value="ai"${p?.controller === 'ai' ? ' selected' : ''}>AI</option></select>
      <select name="arch-${c.id}">${ARCHETYPES.map((a) => `<option value="${a}"${(p?.aiArchetype ?? 'balanced') === a ? ' selected' : ''}>${ARCHETYPE_PL[a] ?? a}</option>`).join('')}</select>
    </div>`;
  }).join('');
  const mode = state?.config.dice?.mode ?? 'playerDice';
  setupForm.querySelector('.setup-modes').innerHTML = Object.entries(DICE_MODE_PL).map(([id, m]) => `<label class="mode-opt"><input type="radio" name="mode" value="${id}"${id === mode ? ' checked' : ''}><b>${m.name}</b><small>${m.hint}</small></label>`).join('');
  setupForm.elements.seed.value = randomSeed();
  renderLimitOptions();
  setupDialog.showModal();
}

setupForm.addEventListener('change', (e) => {
  if (e.target.name?.startsWith('on-')) renderLimitOptions();
});
setupForm.addEventListener('submit', (e) => {
  if (e.submitter?.value !== 'start') return;
  e.preventDefault();
  const players = CHARACTERS.filter((c) => setupForm.elements[`on-${c.id}`].checked).map((c) => ({
    character: c.id, controller: setupForm.elements[`ctl-${c.id}`].value, aiArchetype: setupForm.elements[`arch-${c.id}`].value,
  }));
  if (!players.length) {
    toast('Wybierz przynajmniej jednego gracza.');
    return;
  }
  const config = structuredClone(CONFIG);
  config.dice.mode = setupForm.elements.mode.value;
  const limit = setupForm.elements.timeLimit.value;
  config.winCondition.timeLimitWeeks = limit === '' ? null : Number(limit);
  startGame({ seed: setupForm.elements.seed.value.trim() || randomSeed(), players, config });
  setupDialog.close();
});
$('#btn-seed').addEventListener('click', () => (setupForm.elements.seed.value = randomSeed()));

function startGame({ seed, players, config }) {
  clearTimeout(aiTimer);
  try {
    state = createGame({ seed, players, config });
  } catch (err) {
    toast(err.message);
    return;
  }
  Object.assign(ui, { matOpen: false, matPlayer: null, panel: null, catchPrep: null, prompt: null, reveal: null, result: null, busy: false, exchange: [] });
  save();
  render();
  scheduleAi();
}

const settingsDialog = $('#settings-dialog');
function openSettings() {
  settingsDialog.querySelector('[name="aiDelay"]').value = String(ui.aiDelay);
  settingsDialog.querySelector('[name="showOdds"]').checked = ui.showOdds;
  settingsDialog.querySelector('.seed').textContent = state?.seed ?? '—';
  const status = settingsDialog.querySelector('.save-status');
  status.hidden = !saveBlocked;
  status.textContent = saveProblem?.reason === 'newer' ? 'Zapisywanie wyłączone w tej sesji: w przeglądarce czeka zapis z nowszej wersji gry (odśwież stronę z internetem).' : 'Zapisywanie wyłączone w tej sesji.';
  let art = settingsDialog.querySelector('.art-status');
  if (!art) {
    art = document.createElement('p');
    art.className = 'small muted art-status';
    settingsDialog.querySelector('.seed').closest('p').after(art);
  }
  renderDiceSetting();
  art.textContent = '';
  artPackStatus().then((s) => (art.textContent = s ? `Obrazki Pokémonów zapisane na tym urządzeniu: ${s.have} / ${s.total}${s.have < s.total && navigator.onLine ? ' (pobieram w tle…)' : ''}` : ''));
  settingsDialog.showModal();
}
// P1.5b: how this device rolls the dice the game asks the players for. The
// game's dice mode (chosen for a new game) decides which rolls are asked at all.
const DICE_ROLL_PL = {
  auto: { name: '⚡ Pełny automat', hint: 'Wybierasz akcję — gra od razu rzuca i pokazuje wynik.' },
  tap: { name: '🎲 Cyfrowe — kliknij rzut', hint: 'Gra rzuca kością, gdy dotkniesz „Rzuć!”.' },
  physical: { name: '✋ Fizyczne kości', hint: 'Rzucacie prawdziwą kością i wpisujecie wynik.' },
};
function renderDiceSetting() {
  let box = settingsDialog.querySelector('.dice-setting');
  if (!box) {
    box = document.createElement('fieldset');
    box.className = 'dice-setting';
    settingsDialog.querySelector('h2').after(box);
  }
  const allDigital = state?.config.dice.mode === 'digital';
  box.innerHTML = iconText(`<legend>Rzuty kośćmi</legend>${Object.entries(DICE_ROLL_PL).map(([id, m]) => `<label class="mode-opt"><input type="radio" name="diceRoll" value="${id}"${ui.diceRoll === id ? ' checked' : ''}><b>${m.name}</b><small>${m.hint}</small></label>`).join('')}
    <p class="small muted">${allDigital ? 'W tej grze wszystkie rzuty robi gra (tryb „Cyfrowe” z nowej gry): „Pełny automat” rzuca ballem od razu, bez „Rzucaj!”.' : `Tryb tej gry: ${esc(DICE_MODE_PL[state?.config.dice.mode]?.name ?? '—')} — ustawienie dotyczy rzutów, o które gra prosi graczy.`}</p>`);
}
settingsDialog.addEventListener('change', (e) => {
  if (e.target.name === 'diceRoll') ui.diceRoll = e.target.value;
  if (e.target.name === 'aiDelay') ui.aiDelay = Number(e.target.value);
  if (e.target.name === 'showOdds') ui.showOdds = e.target.checked;
  savePrefs();
  render();
});
settingsDialog.addEventListener('click', (e) => {
  const cmd = e.target.closest('[data-settings]')?.dataset.settings;
  if (cmd === 'new') {
    settingsDialog.close();
    openSetup();
  } else if (cmd === 'export' && state) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([serialize(state)], { type: 'application/json' }));
    a.download = `kanto-stol-${state.seed}-tydzien${state.turn.round}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  } else if (cmd === 'close') settingsDialog.close();
});

// ---- Pokémon artwork and the inspect view -------------------------------------------

// A picture that can't load (offline, blocked, missing) hides itself and the
// card keeps its fallback; art.js remembers it so later renders skip it. A
// loaded one hides the fallback icon. (Load / error events don't bubble:
// listen in the capture phase.)
document.addEventListener('error', (e) => {
  const img = e.target;
  if (!(img instanceof HTMLImageElement) || !img.classList.contains('art')) return;
  markArtFailed(img.getAttribute('src'));
  scheduleArtRetry();
  img.parentElement?.classList.remove('has-art');
  img.remove();
}, true);
document.addEventListener('load', (e) => {
  const img = e.target;
  if (!(img instanceof HTMLImageElement) || !img.classList.contains('art')) return;
  markArtLoaded(img.getAttribute('src'));
  img.parentElement?.classList.add('has-art');
}, true);

// A failed picture is tried again (Post-playtest Build 2, P0): one redraw when
// the retry time is up, and at once when the device comes back online.
let artRetryTimer = null;
function scheduleArtRetry() {
  if (artRetryTimer) return;
  artRetryTimer = setTimeout(() => {
    artRetryTimer = null;
    if (artFailures()) render();
  }, ART_RETRY_MS + 100);
}
window.addEventListener('online', () => {
  retryArt();
  render();
  prefetchArt();
});

// The device-side art pack: after the game has started, every Pokémon's picture
// is fetched in the background into the service worker's cache (a few at a time,
// never blocking play), so pictures survive bad Wi-Fi and work offline. Only
// where the service worker runs (the installed / HTTPS build).
let prefetching = false;
async function prefetchArt() {
  if (prefetching || !navigator.onLine || !navigator.serviceWorker?.controller || !('caches' in window)) return;
  prefetching = true;
  try {
    const cache = await caches.open(ART_CACHE);
    for (const url of new Set(POKEMON.map((s) => artUrlFor(s)).filter(Boolean))) {
      if (!navigator.onLine) break;
      if (await cache.match(url)) continue;
      try {
        const response = await fetch(url, { mode: 'cors', credentials: 'omit' });
        if (response.ok) await cache.put(url, response);
      } catch {
        // offline again / a dropped request: the next start (or 'online') tries again
      }
      await new Promise((r) => setTimeout(r, 150));
    }
  } finally {
    prefetching = false;
  }
}
async function artPackStatus() {
  if (!('caches' in window)) return null;
  try {
    const cache = await caches.open(ART_CACHE);
    const urls = new Set(POKEMON.map((s) => artUrlFor(s)).filter(Boolean));
    let have = 0;
    for (const url of urls) if (await cache.match(url)) have += 1;
    return { have, total: urls.size };
  } catch {
    return null;
  }
}

const inspectDialog = $('#inspect-dialog');

function findPokemon(uid) {
  for (const p of state.players) {
    const mon = [...p.team, ...p.reserve].find((m) => m.uid === uid);
    if (mon) return { mon, owner: p.name };
  }
  const enc = state.encounter;
  const foes = enc ? (enc.kind === 'wild' ? [enc.pokemon] : enc.trainer.pokemonTeam) : [];
  const mon = foes.find((m) => m.uid === uid);
  return mon ? { mon, owner: null } : null;
}

let inspected = null;

function openInspect(uid, speciesId) {
  if (!state) return;
  inspected = { uid, speciesId };
  const found = uid ? findPokemon(uid) : null;
  const target = found ?? (speciesId ? { mon: { species: speciesId, hp: getSpecies(speciesId).hp, maxHp: getSpecies(speciesId).hp }, owner: null } : null);
  if (!target) return;
  inspectDialog.querySelector('.inspect-body').innerHTML = iconText(LEGACY_HUD
    ? inspectView(target.mon, { growth: usesGrowth(state), config: state.config, owner: target.owner })
    : pokemonDetail(target.mon, { growth: usesGrowth(state), config: state.config, owner: target.owner, actions: detailActions(state, target.mon, { busy: ui.busy }) }));
  inspectDialog.classList.toggle('compact', !LEGACY_HUD);
  if (!inspectDialog.open) inspectDialog.showModal();
}

inspectDialog.addEventListener('click', (e) => {
  if (e.target === inspectDialog || e.target.closest('[data-inspect-close]')) inspectDialog.close();
});

// A crop saved or reset in the editor: redraw the table and the open inspect
// view, so every portrait of that species changes at once.
const artEditor = createArtEditor($('#art-editor'), {
  onChange: () => {
    render();
    if (inspectDialog.open && inspected) openInspect(inspected.uid, inspected.speciesId);
  },
  toast,
});

// ---- boot ------------------------------------------------------------------------------

// A saved game this version can't use: explain, offer the backup as a file, never overwrite.
const SAVE_PROBLEM_PL = {
  newer: '<b>Ta zapisana gra pochodzi z nowszej wersji gry</b> i ta wersja nie umie jej wczytać. Nic nie zostało nadpisane. Połącz tablet z internetem i odśwież stronę — gra się zaktualizuje i wczyta zapis. Możesz też zagrać teraz, ale ta sesja nie będzie zapisywana.',
  corrupt: '<b>Nie udało się wczytać zapisanej gry.</b> Kopia zapisu została zachowana w przeglądarce — możesz ją też pobrać jako plik. Zaczynamy nową grę.',
  noBackup: '<b>Nie udało się wczytać zapisanej gry ani zrobić jej kopii</b> (pamięć przeglądarki jest pełna?). Stary zapis zostaje nienaruszony, a ta sesja nie będzie zapisywana. Pobierz kopię zapisu jako plik.',
};
const saveDialog = $('#save-dialog');
let unreadableRaw = null;

function showSaveProblem(problem) {
  const kind = problem.reason === 'newer' ? 'newer' : problem.backupKey ? 'corrupt' : 'noBackup';
  saveDialog.querySelector('.save-problem').innerHTML = `<p>${SAVE_PROBLEM_PL[kind]}</p><p class="muted small">${esc(problem.message)}${problem.backupKey ? ` · kopia: <code>${esc(problem.backupKey)}</code>` : ''}</p>`;
  saveDialog.querySelector('[data-save="reload"]').hidden = kind !== 'newer';
  saveDialog.showModal();
}

saveDialog.addEventListener('click', (e) => {
  const cmd = e.target.closest('[data-save]')?.dataset.save;
  if (cmd === 'download' && unreadableRaw) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([unreadableRaw], { type: 'application/json' }));
    a.download = `kanto-stol-kopia-zapisu-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  } else if (cmd === 'reload') location.reload();
  else if (cmd === 'ok') {
    saveDialog.close();
    if (!AUTOPLAY) openSetup();
  }
});

// ?fresh (developer / autoplay) deliberately starts over without loading.
const loaded = params.has('fresh') || !store ? { state: null, raw: null, problem: null, canSave: Boolean(store) } : loadSave(store, SAVE_KEY, deserialize, { legacyKey: LEGACY_SAVE_KEY });
if (loaded.state) {
  try {
    state = loaded.state;
    render();
    toast(loaded.from === LEGACY_SAVE_KEY ? 'Wznowiono grę sprzed aktualizacji — toczy się dalej według dotychczasowych zasad.' : 'Wznowiono ostatnią grę przy stole.');
    scheduleAi();
  } catch (err) {
    state = null; // loads but can't be shown: same safety net
    Object.assign(loaded, keepUnreadable(store, loaded.from, loaded.raw, err), loaded.from === LEGACY_SAVE_KEY ? { canSave: true } : {});
  }
}
if (loaded.problem) {
  saveProblem = loaded.problem;
  unreadableRaw = loaded.raw;
  saveBlocked = !loaded.canSave;
}
if (!state) {
  const config = structuredClone(CONFIG);
  config.dice.mode = 'playerDice';
  startGame({ seed: params.get('seed') ?? randomSeed(), players: [{ character: 'ash', controller: 'human' }, { character: 'misty', controller: 'human' }], config });
  if (saveProblem) showSaveProblem(saveProblem);
  else if (!AUTOPLAY) openSetup();
}

// The device-side art pack fills in the background once the service worker
// runs the page — after the game is already on screen.
navigator.serviceWorker?.addEventListener('controllerchange', () => setTimeout(prefetchArt, 4000));
if (navigator.serviceWorker?.controller) setTimeout(prefetchArt, 4000);

// P1.5: the board's rectangle on screen (contain) as CSS variables, so the
// widgets anchor to the map's free corners at every screen size.
function placeHud() {
  const aspect = board.aspect || 6036 / 4168;
  const w = window.innerWidth;
  const h = window.innerHeight;
  const mw = Math.min(w, h * aspect);
  const mh = mw / aspect;
  const root = document.documentElement.style;
  root.setProperty('--mx', `${(w - mw) / 2}px`);
  root.setProperty('--my', `${(h - mh) / 2}px`);
  root.setProperty('--mw', `${mw}px`);
  root.setProperty('--mh', `${mh}px`);
}
placeHud();
window.addEventListener('resize', placeHud);
