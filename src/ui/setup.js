// New-game dialog: pick 1-4 characters, human or AI (with archetype), and a seed.
import { CHARACTERS } from '../data/characters.js';
import { esc } from './dom.js';

export function randomSeed() {
  return `KANTO-${Math.floor(10000 + Math.random() * 90000)}`;
}

// Optional Time Limit (Step 6, DQ-60): off by default. Recommended options
// depend on the player count: with 1–2 players a 25-week limit would end most
// games by the timeout (62% in simulation), so only 30 is offered there.
// (The engine still accepts any number of weeks.)
export function timeLimitOptions(playerCount) {
  return playerCount <= 2 ? [null, 30] : [null, 25, 30];
}

const LIMIT_LABEL = (w) => (w === null ? 'Off — play until a Champion' : `${w} weeks`);

function checkedPlayers(form) {
  return CHARACTERS.filter((c) => form.elements[`on-${c.id}`]?.checked).length;
}

// (Re)fill the Time limit select for the current number of players, keeping
// the choice when it is still offered (otherwise Off).
export function renderTimeLimitOptions(form, preferred = form.elements.timeLimit.value === '' ? null : Number(form.elements.timeLimit.value)) {
  const options = timeLimitOptions(checkedPlayers(form));
  const value = options.includes(preferred) ? preferred : null;
  form.elements.timeLimit.innerHTML = options.map((w) => `<option value="${w ?? ''}"${w === value ? ' selected' : ''}>${LIMIT_LABEL(w)}</option>`).join('');
}

export function defaultSetup() {
  return {
    seed: randomSeed(),
    timeLimitWeeks: null,
    players: [
      { character: 'ash', controller: 'human' },
      { character: 'gary', controller: 'ai', aiArchetype: 'balanced' },
    ],
  };
}

export function renderSetupForm(form, setup, archetypes) {
  const byChar = Object.fromEntries(setup.players.map((p) => [p.character, p]));
  const rows = CHARACTERS.map((c) => {
    const p = byChar[c.id];
    return `
      <tr>
        <td><label><input type="checkbox" name="on-${c.id}"${p ? ' checked' : ''}> <span class="chip" style="background:${c.color}"></span>${esc(c.name)}</label></td>
        <td><select name="ctl-${c.id}">
          <option value="human"${p?.controller !== 'ai' ? ' selected' : ''}>Human</option>
          <option value="ai"${p?.controller === 'ai' ? ' selected' : ''}>AI</option>
        </select></td>
        <td><select name="arch-${c.id}">${archetypes.map((a) => `<option value="${a}"${(p?.aiArchetype ?? 'balanced') === a ? ' selected' : ''}>${a}</option>`).join('')}</select></td>
      </tr>`;
  }).join('');
  form.querySelector('.setup-rows').innerHTML = rows;
  form.elements.seed.value = setup.seed;
  renderTimeLimitOptions(form, setup.timeLimitWeeks ?? null);
}

export function readSetupForm(form) {
  const players = CHARACTERS.filter((c) => form.elements[`on-${c.id}`]?.checked).map((c) => ({
    character: c.id,
    controller: form.elements[`ctl-${c.id}`].value,
    aiArchetype: form.elements[`arch-${c.id}`].value,
  }));
  const limit = form.elements.timeLimit.value === '' ? null : Number(form.elements.timeLimit.value);
  return { seed: form.elements.seed.value.trim() || randomSeed(), players, timeLimitWeeks: timeLimitOptions(players.length).includes(limit) ? limit : null };
}
