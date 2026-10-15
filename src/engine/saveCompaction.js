// Build 3.3 correction C4 — a save that fits the browser (ChatGPT review R4).
//
// A saved game is the whole GameState as JSON. Almost all of it is the log
// (≈ 85 % of a long 4-player game: battle lines, dice lines, the AI's reasons)
// and, second, the AI's reasons repeated in `history`. The engine never reads
// the log: every rule reads the state itself, the log is only told (the table
// reads the entries a dispatch has just added). `history` is the source of
// truth for a replay — every action and every physical die, in order; its
// LENGTH also seeds the AI's tie-breaks, so it is never shortened.
//
// So a save keeps (compactForSave):
//   - the whole mechanical state, as it is;
//   - the whole `history` (every action, every entered die), with the AI's
//     reasons kept for the latest `aiKeep` decisions only — older ones keep the
//     archetype and the score (`compacted: true`);
//   - the latest `logKeep` log entries; `logBase` counts the entries left out
//     before them, so every entry's `seq` stays unique and monotone
//     (log.js: seq = logBase + log.length + 1).
// The left-out log is not lost information: replayGame(setup, history, config)
// plays the game again and writes every line (the AI lines of compacted
// decisions say so). The live game in memory keeps its whole log for the
// session; only what is written to storage is compacted. Older saves have no
// `logBase` (= 0) and load as before; a compacted save loads in an older build
// too (its log just numbers on from the kept lines).
//
// When the browser refuses a save (quota), the table retries with the TIGHT
// tier; if that fails too, the previous save stays as it was (a failed
// setItem changes nothing) and the player is told — see ui/saveSlot.js.

export const SAVE_TIERS = Object.freeze([
  Object.freeze({ name: 'normal', logKeep: 400, aiKeep: 200 }),
  Object.freeze({ name: 'tight', logKeep: 60, aiKeep: 0 }),
]);

// The budget a save should stay under (characters of JSON). Browsers give a site
// about 5 MB of web storage — some count UTF-16 (2 bytes a character), iPad
// Safari is not guaranteed to give that much, and the same site also keeps Piotr's
// picture crops and backups of unreadable saves. 1 M characters (≤ 2 MB) leaves a
// wide margin; tests/b33.test.js checks long 4-player games stay under it.
export const SAVE_BUDGET_CHARS = 1_000_000;

function compactAi(ai) {
  return { archetype: ai.archetype, score: ai.score, reasons: [], compacted: true, ...(ai.tiebreak ? { tiebreak: ai.tiebreak } : {}) };
}

// A copy to write to storage (the live state is never changed). Returns `state`
// itself when there is nothing to leave out.
export function compactForSave(state, { logKeep = SAVE_TIERS[0].logKeep, aiKeep = SAVE_TIERS[0].aiKeep } = {}) {
  const drop = Math.max(0, state.log.length - logKeep);
  const cut = Math.max(0, state.history.length - aiKeep);
  let history = state.history;
  for (let i = 0; i < cut; i++) {
    if (!history[i].ai || history[i].ai.compacted) continue;
    if (history === state.history) history = state.history.slice();
    history[i] = { ...history[i], ai: compactAi(history[i].ai) };
  }
  if (!drop && history === state.history) return state;
  return { ...state, log: drop ? state.log.slice(drop) : state.log, logBase: (state.logBase ?? 0) + drop, history };
}

export function serializeForSave(state, tier = SAVE_TIERS[0]) {
  return JSON.stringify(compactForSave(state, tier));
}
