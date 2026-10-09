// Dice for the digital tabletop: d6 with pips, the three Catch Dice and the
// three Escape Dice. Colour is never the only identity: a Catch Die also shows
// its Poké Ball faces as dots (●●● / ●● / ●), an Escape Die its wind faces
// (🌬️🌬️🌬️ / 🌬️🌬️ / 🌬️). Pure HTML strings.
import { esc } from '../ui/dom.js';
import { CATCH_DIE, D6_FACE, ESCAPE_DIE, d6Purpose } from './i18n.js';
import { gi, pokeballSvg } from './icons.js';

export { pokeballSvg };

// Wind (flee) symbol: three gusts, drawn so it stays readable on every die colour.
export function windSvg(size = 22, colour = 'currentColor') {
  return `<svg class="wind-svg" viewBox="0 0 32 24" width="${size}" height="${Math.round((size * 24) / 32)}" aria-hidden="true" fill="none" stroke="${colour}" stroke-width="3" stroke-linecap="round">
    <path d="M3 7h16a4 4 0 1 0-4-4"/><path d="M3 13h23a4 4 0 1 1-4 4"/><path d="M3 19h11"/></svg>`;
}

export function windMarks(n, opts) {
  return `<span class="wind-marks" aria-label="${n} × wiatr">${Array.from({ length: n }, () => windSvg(opts?.size ?? 18, opts?.colour)).join('')}</span>`;
}

const PIPS = { 1: [5], 2: [1, 9], 3: [1, 5, 9], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] };

export function d6Html(value, { rolling = false, small = false } = {}) {
  const pips = rolling || !value ? '' : Array.from({ length: 9 }, (_, i) => `<i class="${PIPS[value].includes(i + 1) ? 'on' : ''}"></i>`).join('');
  return `<div class="die d6${rolling ? ' rolling' : ''}${small ? ' small' : ''}" aria-label="${rolling ? 'kostka się toczy' : `wynik ${value}`}"><div class="pips">${pips || (rolling ? '<b>?</b>' : '')}</div></div>`;
}

// The Catch Die's name with its secondary identity: "🔵 Niebieska ●●●".
export function catchDieLabel(colour, { reroll = false } = {}) {
  const d = CATCH_DIE[colour];
  return `<span class="die-label c-${colour}">${gi(`die.${colour}`)} ${d.name} <b class="dots">${d.dots}</b>${reroll ? ' <span class="reroll-mark">↻ 1 przerzut</span>' : ''}</span>`;
}

export function escapeDieLabel(colour) {
  const d = ESCAPE_DIE[colour];
  return `<span class="die-label e-${colour}">${gi(`die.${colour}`)} ${d.name} ${windMarks(d.flee)}</span>`;
}

// face: 'ball' | 'blank' | null (not rolled yet)
export function catchDieHtml(colour, { face = null, rolling = false, small = false } = {}) {
  const d = CATCH_DIE[colour];
  const content = rolling ? '<b>?</b>' : face === 'ball' ? pokeballSvg(small ? 26 : 40) : face === 'blank' ? '<span class="blank-face"></span>' : '';
  return `<div class="die catch c-${colour}${rolling ? ' rolling' : ''}${small ? ' small' : ''}" aria-label="Kostka łapania ${d.name} ${d.dots.length} z 6">
    <div class="face">${content}</div><div class="die-id">${d.dots}</div></div>`;
}

// face: 'flee' | 'stay' | null
export function escapeDieHtml(colour, { face = null, rolling = false, small = false } = {}) {
  const d = ESCAPE_DIE[colour];
  const content = rolling ? '<b>?</b>' : face === 'flee' ? `<span class="wind-face">${windSvg(small ? 20 : 38, '#1d2433')}</span>` : face === 'stay' ? '<span class="blank-face"></span>' : '';
  return `<div class="die escape e-${colour}${rolling ? ' rolling' : ''}${small ? ' small' : ''}" aria-label="Kostka ucieczki ${d.name} ${d.flee} z 6">
    <div class="face">${content}</div><div class="die-id">${windMarks(d.flee, { size: small ? 9 : 14, colour: '#fff' })}</div></div>`;
}

// A physical die the game is waiting for, from the engine's roll entry data.
export function describeNeed(data, player) {
  const who = data.kind === 'player' ? `Rzuca ${player.name}${player.controller === 'ai' ? ' (AI) — rzuć za niego' : ''}` : 'Rzut świata — rzuć za grę';
  if (data.die === 'catch') return { type: 'catch', colour: data.colour, reroll: Boolean(data.reroll), who };
  if (data.die === 'escape') return { type: 'escape', colour: data.colour, who };
  return { type: 'd6', purpose: d6Purpose(data.label), who };
}

// The "enter your physical die" panel. `tap` (P1.5b, dice setting „Cyfrowe —
// kliknij rzut”): one big „Rzuć!” — the game rolls that die on the tap.
export function renderPrompt(need, { tap = false } = {}) {
  if (tap) {
    const die = need.type === 'catch' ? catchDieHtml(need.colour) : need.type === 'escape' ? escapeDieHtml(need.colour) : d6Html(null, { small: false });
    const title = need.type === 'catch' ? `${need.reroll ? '↻ Przerzut! ' : ''}Kostka łapania ${catchDieLabel(need.colour)}` : need.type === 'escape' ? `Kostka ucieczki ${escapeDieLabel(need.colour)}` : `🎲 ${esc(need.purpose)}`;
    return `
      <div class="prompt tap">
        <div class="prompt-who">${esc(need.who)}</div>
        <h3>${title}</h3>
        <div class="prompt-die">${die}</div>
        <button class="primary big roll-btn" data-dice="roll">🎲 Rzuć!</button>
      </div>`;
  }
  if (need.type === 'catch') {
    return `
      <div class="prompt">
        <div class="prompt-who">${esc(need.who)}</div>
        <h3>${need.reroll ? '↻ Przerzut! ' : ''}Rzuć kostką łapania ${catchDieLabel(need.colour)}</h3>
        <div class="prompt-die">${catchDieHtml(need.colour)}</div>
        <p>Co wypadło?</p>
        <div class="choice-row">
          <button class="big-choice" data-dice="ball">${pokeballSvg(36)} Poké Ball</button>
          <button class="big-choice" data-dice="blank"><span class="blank-face"></span> Puste</button>
        </div>
      </div>`;
  }
  if (need.type === 'escape') {
    return `
      <div class="prompt">
        <div class="prompt-who">${esc(need.who)}</div>
        <h3>Rzuć kostką ucieczki ${escapeDieLabel(need.colour)}</h3>
        <div class="prompt-die">${escapeDieHtml(need.colour)}</div>
        <p>Co wypadło?</p>
        <div class="choice-row">
          <button class="big-choice" data-dice="stay"><span class="blank-face"></span> Puste — zostaje</button>
          <button class="big-choice" data-dice="flee"><span class="wind-face">${windSvg(32)}</span> Wiatr — ucieka</button>
        </div>
      </div>`;
  }
  return `
    <div class="prompt">
      <div class="prompt-who">${esc(need.who)}</div>
      <h3>🎲 Rzuć zwykłą kostką k6</h3>
      <p class="prompt-purpose">${esc(need.purpose)}</p>
      <div class="d6-row">${[1, 2, 3, 4, 5, 6].map((v) => `<button class="d6-btn" data-dice="${v}" aria-label="${v}">${d6Html(v, { small: true })}<span>${v}</span></button>`).join('')}</div>
    </div>`;
}

export { D6_FACE };
