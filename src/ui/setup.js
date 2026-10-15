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

// One Kanto (PT006-10, Piotr 13–14.10.2026): ONE new-game mode, „Pokémon Kanto — Przygoda”
// (CONFIG as it is: rules.gameMode 'adventure'). No Family / Sandbox choice for players.
//
// Unfinished systems stay DEV pilots — feature by feature, never a second product mode; a
// developer turns them on with the table's URL (`?dev=hunts,trials`) and the settings name them.
//   hunts   — rare hunts (3 own turns each), Build 3.3 E4
//   trials  — Gym Trials, one SHORT trial (mix 'oneShort'), Build 3.3 E5
//   expedition — the first Rare Expedition (Scyther: an encounter step, retry R2), PLAYTEST_006 C4
//   rumours — Kanto Rumours & Opportunities (a small seeded set), PLAYTEST_006 C5
export const DEV_PILOTS = ['hunts', 'trials', 'expedition', 'rumours'];

export function applyDevPilots(config, pilots = []) {
  if (pilots.includes('hunts')) {
    config.rules.hunts = 'pilot';
    config.hunts = { ...config.hunts, clock: 'ownTurns', length: 3 };
  }
  if (pilots.includes('trials')) {
    config.rules.gymTrials = 'pilot';
    config.gymTrials = { ...config.gymTrials, mix: 'oneShort' };
  }
  if (pilots.includes('expedition')) config.rules.expeditions = 'pilot';
  if (pilots.includes('rumours')) config.rules.rumours = 'pilot';
  return config;
}

// One Kanto day 14.10 (ChatGPT canonical full-day handoff G1): the EVENING DEV RULESET — ONE versioned set of
// candidates for the family playtest, on every NEW game of this DEV build (both new-game paths of the table).
// Its values stay CANDIDATES (docs: DONE DEV / PILOT, never RELEASED); the public Build 3.3 is frozen, and
// every older save keeps its own rules. Rare hunts and Gym Trials stay off (only `?dev=hunts,trials`).
//   `?dev=base`  a new game WITHOUT it (the plain One Kanto adventure, for comparison)
//   `?dev=gymD`  the same set with the themed gyms (PT006-07 variant D) instead of B — a comparison game
// Every set is FROZEN once a build plays it (its saves keep its id and switches): a change is a new set.
//   dev-1410   the evening of 14.10 (ChatGPT: APPROVED FOR FAMILY PLAYTEST, freeze 3107ee2)
//   dev-1410b  bonus 14.10: + fishing with the Old Rod (rules.fishing 'v1') + 8 more trophies (achievements 'v2')
//              + six more explore events (eventPack 'b4h')
//   dev-1410c  bonus 2, 14.10: + Eevee's branching evolution (eeveeBranch 'v1') + the pilots below when ready
const DEV_1410 = Object.freeze({ expeditions: 'pilot', rumours: 'pilot', gymTeams: 'B', greatBall: 'G1', iconicWild: 'd6', oakResearch: 'v1', trading: 'v1', achievements: 'v1', pvp: 'v1', questPack: 'day14' });
export const RULESETS = Object.freeze({
  'dev-1410': Object.freeze({ id: 'dev-1410', rules: DEV_1410 }),
  'dev-1410b': Object.freeze({ id: 'dev-1410b', rules: Object.freeze({ ...DEV_1410, achievements: 'v2', fishing: 'v1', eventPack: 'b4h' }) }),
  'dev-1410c': Object.freeze({ id: 'dev-1410c', rules: Object.freeze({ ...DEV_1410, achievements: 'v2', fishing: 'v1', eventPack: 'b4h', eeveeBranch: 'v1', characterTraits: 'pilot', signatureMoves: 'pilot' }) }),
  // PLAYTEST_007 night shift (Build 3.5 DEV, 15.10): dev-1410c (the public Build 3.4 game) + the player picks who comes
  // in after a KO (koPick 'v1'). The quest / rumour reasons, the ⚡ order on the table and the notices are UI only.
  'dev-1510': Object.freeze({ id: 'dev-1510', rules: Object.freeze({ ...DEV_1410, achievements: 'v2', fishing: 'v1', eventPack: 'b4h', eeveeBranch: 'v1', characterTraits: 'pilot', signatureMoves: 'pilot', koPick: 'v1' }) }),
  // Combat MVP (ChatGPT „COMBAT 2.0 — EMERGENCY PLAYABLE MVP”, Piotr 15.10): dev-1510 + the moves and statuses
  // (combatMoves 'mvp1'). The signature-move pilot gives way to it here (one move system at a time); dev-1510 keeps it.
  'dev-1510-combat': Object.freeze({ id: 'dev-1510-combat', rules: Object.freeze({ ...DEV_1410, achievements: 'v2', fishing: 'v1', eventPack: 'b4h', eeveeBranch: 'v1', characterTraits: 'pilot', signatureMoves: false, koPick: 'v1', combatMoves: 'mvp1' }) }),
});
export const ADVENTURE_DEV = RULESETS['dev-1510']; // what a new game of this DEV build plays (Build 3.5 DEV candidate)
//   `?dev=1410` / `?dev=1410b` / `?dev=1410c`  a frozen earlier set instead (a comparison / fallback game; 1410c = Build 3.4)
//   `?dev=combat`  the Combat MVP set dev-1510-combat (its own LAN package opens with it — build-tablet --dev combat)
export const ADVENTURE_OPTIONS = ['base', 'gymD', '1410', '1410b', '1410c', 'combat'];

export function applyAdventure(config, options = []) {
  if (options.includes('base')) return config;
  const set = options.includes('1410') ? RULESETS['dev-1410'] : options.includes('1410b') ? RULESETS['dev-1410b'] : options.includes('1410c') ? RULESETS['dev-1410c'] : options.includes('combat') ? RULESETS['dev-1510-combat'] : ADVENTURE_DEV;
  Object.assign(config.rules, set.rules);
  if (options.includes('gymD')) config.rules.gymTeams = 'D';
  config.devRuleset = set.id;
  return config;
}

// The DEV pilots a game plays (for the settings): the hand-picked pilots, then the evening set's parts.
export function devPilotsOf(config) {
  const r = config?.rules ?? {};
  return [
    r.hunts === 'pilot' && 'hunts', r.gymTrials === 'pilot' && 'trials', r.expeditions === 'pilot' && 'expedition', r.rumours === 'pilot' && 'rumours',
    r.oakResearch === 'v1' && 'oakResearch', r.trading === 'v1' && 'trading', r.pvp === 'v1' && 'pvp', r.achievements === 'v1' && 'achievements', r.questPack === 'day14' && 'questPack', r.fishing === 'v1' && 'fishing', r.eventPack === 'b4h' && 'eventPack', r.combatMoves === 'mvp1' && 'combatMoves', r.eeveeBranch === 'v1' && 'eeveeBranch', r.characterTraits === 'pilot' && 'characterTraits', r.signatureMoves === 'pilot' && 'signatureMoves', r.koPick === 'v1' && 'koPick', r.achievements === 'v2' && 'achievementsV2',
    r.gymTeams && r.gymTeams !== 'v1' && `gym${r.gymTeams}`, r.greatBall && r.greatBall !== 'v1' && 'greatBall', r.iconicWild && 'iconicWild',
  ].filter(Boolean);
}

// Build 3.3 family playtest (ChatGPT EREV review, 13.10): the two test configurations the
// public Build 3.3 offered — 'family' (no pilots) and 'sandbox' (hunts + one SHORT trial).
// LEGACY since One Kanto: kept so tests and tools can make such a game; the table no longer
// offers it. A legacy configuration is the Build 3.3 game: rules.gameMode false.
export const GAME_VARIANTS = ['family', 'sandbox'];

export function applyVariant(config, variant) {
  config.rules.gameMode = false;
  return variant === 'sandbox' ? applyDevPilots(config, ['hunts', 'trials']) : config;
}

// Which configuration a game (or a save) plays — for the settings („Ta gra: …”):
// 'adventure' (One Kanto), 'family' / 'sandbox' (a Build 3.3 save, its own rules) or 'older'.
export function variantOf(config) {
  const r = config?.rules ?? {};
  if (r.gameMode === 'adventure') return 'adventure';
  if (r.ruleset !== 'b33') return 'older';
  return r.hunts === 'pilot' || r.gymTrials === 'pilot' ? 'sandbox' : 'family';
}
