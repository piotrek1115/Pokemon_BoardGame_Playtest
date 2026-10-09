// Browser save slot with a safety net (Phase 3A-0). A save this version of the
// game can't load is never overwritten silently:
//   - it is first copied to a backup key (`<key>.backup.<n>`, same text kept once);
//   - a save written by a NEWER version (later schema, or rule switches this
//     version can't play) also stays where it is, and autosave is off for the
//     session — reloading the game online updates it and the save loads again;
//   - a corrupt save may be replaced by a new game only once its backup exists;
//     if the backup can't be written (storage full), autosave is off too;
//   - a slot change (new key per save generation) keeps older builds away from
//     saves they can't read: they only ever see their own slot (`legacyKey`).
// Storage is passed in: window.localStorage in the browser, a fake in tests.
import { SaveError } from '../engine/gameState.js';

export const MAX_BACKUPS = 20;

// → { state, raw, problem, canSave, from }. `problem` is null or { reason:
// 'newer' | 'corrupt', message, schema, backupKey }; `canSave` false means: keep
// autosave off for this session; `from` is the key the save came from.
//
// `legacyKey`: an older slot this version only READS (once, when its own slot
// is empty) and never writes. Builds from before a slot change keep reading
// their old slot, so they can never meet — and wipe — a save they can't load.
export function loadSave(storage, key, deserialize, { legacyKey = null } = {}) {
  const own = loadSlot(storage, key, deserialize);
  if (own.state || own.problem || !legacyKey) return own;
  const legacy = loadSlot(storage, legacyKey, deserialize);
  if (!legacy.state && !legacy.problem) return own;
  return { ...legacy, canSave: own.canSave }; // only `key` is ever written: the legacy save can't be hurt
}

function loadSlot(storage, key, deserialize) {
  let raw;
  try {
    raw = storage.getItem(key);
  } catch {
    return { state: null, raw: null, problem: null, canSave: false, from: null }; // no storage: nothing to protect, nothing to write
  }
  if (raw === null) return { state: null, raw: null, problem: null, canSave: true, from: null };
  try {
    return { state: deserialize(raw), raw, problem: null, canSave: true, from: key };
  } catch (err) {
    return { state: null, raw, from: key, ...keepUnreadable(storage, key, raw, err) };
  }
}

// The save `raw` could not be used (failed to load, or loaded but could not be
// shown): back it up and say whether the slot may be written again.
export function keepUnreadable(storage, key, raw, err) {
  const reason = err instanceof SaveError ? err.reason : 'corrupt';
  const backupKey = backup(storage, key, raw);
  return {
    problem: { reason, message: String(err?.message ?? err), schema: err?.schema ?? null, backupKey },
    canSave: reason !== 'newer' && backupKey !== null,
  };
}

function backup(storage, key, raw) {
  try {
    for (let n = 1; n <= MAX_BACKUPS; n++) {
      const slot = `${key}.backup.${n}`;
      const existing = storage.getItem(slot);
      if (existing === raw) return slot;
      if (existing === null) {
        storage.setItem(slot, raw);
        return storage.getItem(slot) === raw ? slot : null;
      }
    }
  } catch {
    /* storage full or unavailable */
  }
  return null;
}

// → true when written.
export function writeSave(storage, key, text) {
  try {
    storage.setItem(key, text);
    return true;
  } catch {
    return false;
  }
}

export function backupKeys(storage, key) {
  const keys = [];
  try {
    for (let n = 1; n <= MAX_BACKUPS; n++) if (storage.getItem(`${key}.backup.${n}`) !== null) keys.push(`${key}.backup.${n}`);
  } catch {
    /* storage unavailable */
  }
  return keys;
}
