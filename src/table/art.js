// Pokémon artwork for the table (Phase 3A-1.5) — one place for where the
// pictures come from and how they are framed. Purely visual: the engine never
// imports it, and every card renders the same size with or without a picture
// (type-coloured background + initial underneath, see cards.js).
//
// Source: switch ART.source to change every card at once (a local art pack or
// our own illustrations later only need a new entry in SOURCES). 'off' draws
// the fallback everywhere (also: table.html?art=off).
// Remote pictures are kept on the device (Post-playtest Build 2, P0): the
// service worker answers them cache-first from ART_CACHE (kept across builds),
// main.js fetches the whole roster into it in the background after the first
// online start, and a failed picture is tried again — never hidden for the rest
// of the game. Offline before any picture was stored: the fallback shows and the
// game plays the same.
const SOURCES = {
  // PokéAPI's mirror of the official artwork, 475 × 475 PNG, keyed by the
  // National Pokédex number (species.dex).
  pokeapi: (species) => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${species.dex}.png`,
  off: () => null,
};

export const ART = { source: 'pokeapi' };
// The device-side art pack (service worker cache), shared with sw.js.
export const ART_CACHE = 'kanto-art-v1';

export function setArtSource(name) {
  if (!Object.hasOwn(SOURCES, name)) throw new Error(`Unknown art source: ${name}`);
  ART.source = name;
}

// The picture's address for this source, whatever happened to it before.
export function artUrlFor(species) {
  if (!species || !Number.isInteger(species.dex) || species.dex < 1) return null;
  return SOURCES[ART.source](species) ?? null;
}

export function pokemonArtUrl(species) {
  const url = artUrlFor(species);
  return url && !recentlyFailed(url) ? url : null;
}

// ---- trainer portraits (Build 2.3) -----------------------------------------------------
// One source: the FireRed / LeafGreen trainer pictures of pret/pokefirered,
// pinned to a commit (the URL never changes), 64 × 64. Presentation only: our
// trainer archetypes / gym ids / League names stay the source of truth, this is
// their picture. No mapping, a 404, offline → the class icon stays (the same
// failure memo and retry as the Pokémon artwork; the service worker keeps a
// picture once used, nothing is prefetched). Team Rocket (Jessie / James /
// Meowth) and the gym leaders with no FRLG picture (Flint, the Sensational
// Sisters) keep their icons.
export const TRAINER_ART_BASE = 'https://raw.githubusercontent.com/pret/pokefirered/037335f4c725d7c9aecdac87066f2002b4bd7e14/graphics/trainers/front_pics/';
// archetype id (data/trainers.js) → picture; psychic / swimmer: our name pools are boys' names
export const TRAINER_SPRITES = {
  'bug-catcher': 'bug_catcher', youngster: 'youngster', lass: 'lass', hiker: 'hiker', fisherman: 'fisherman',
  sailor: 'sailor', camper: 'camper', picnicker: 'picnicker', scientist: 'scientist', psychic: 'psychic_m',
  channeler: 'channeler', biker: 'biker', 'bird-keeper': 'bird_keeper', swimmer: 'swimmer_m',
};
// gym id (data/gyms.js) and League trainer name → picture
export const LEADER_SPRITES = { vermilion: 'leader_lt_surge', celadon: 'leader_erika', saffron: 'leader_sabrina', fuchsia: 'leader_koga' };
export const LEAGUE_SPRITES = { Lorelei: 'elite_four_lorelei', Agatha: 'elite_four_agatha', Bruno: 'elite_four_bruno', Lance: 'elite_four_lance' };

// { archetype } | { gymId } | { leagueName } → the picture's URL, or null (keep the icon).
export function trainerArtUrl({ archetype = null, gymId = null, leagueName = null } = {}) {
  if (ART.source === 'off') return null;
  const key = (archetype && TRAINER_SPRITES[archetype]) || (gymId && LEADER_SPRITES[gymId]) || (leagueName && LEAGUE_SPRITES[leagueName]) || null;
  const url = key ? `${TRAINER_ART_BASE}${key}_front_pic.png` : null;
  return url && !recentlyFailed(url) ? url : null;
}

// Pictures that failed to load (offline, blocked, a dropped request): for
// ART_RETRY_MS later renders go straight to the fallback instead of asking
// again, then the picture is tried again (retryArt: at once, e.g. back
// online). A transient failure never hides a Pokémon for the rest of the game.
// Pictures already loaded once hide the fallback from the first frame; until
// then (slow network) the fallback icon stays visible under the loading picture.
export const ART_RETRY_MS = 30000;
const failed = new Map(); // url → time of the failure
const loaded = new Set();
let clock = () => Date.now();
export function useArtClock(now) {
  clock = now;
}
function recentlyFailed(url) {
  const at = failed.get(url);
  if (at === undefined) return false;
  if (clock() - at < ART_RETRY_MS) return true;
  failed.delete(url);
  return false;
}
export function markArtFailed(url) {
  failed.set(url, clock());
}
export function retryArt() {
  failed.clear();
}
export function artFailures() {
  return failed.size;
}
export function markArtLoaded(url) {
  loaded.add(url);
}
export function artLoaded(url) {
  return loaded.has(url);
}

// Portrait crops (UI metadata, not game content): the point of the artwork to
// keep in view — x, y in % of the picture, between the face and the middle of
// the body — and how far to zoom in over a plain cover crop. One crop per
// species serves every shape: the full-art cards of P1.5 (team grid about
// square, battle card 3 : 4), the rows of a family card, the family strip and
// the team dots. Retuned for the full-art cards (P1.5 ART_FOCUS pass): a light
// zoom, so the card shows the Pokémon, not one eye. Species missing here use
// DEFAULT_FOCUS (their face sits near the middle-top of the artwork). These are
// the code defaults; a crop fixed in the game (✏️) overrides them.
export const DEFAULT_FOCUS = { x: 50, y: 38, scale: 1.1 };
export const ART_FOCUS = {
  bulbasaur: { x: 36, y: 46, scale: 1.15 },
  ivysaur: { x: 62, y: 50, scale: 1.15 },
  venusaur: { x: 50, y: 52, scale: 1.1 },
  charmander: { x: 46, y: 30, scale: 1.15 },
  charmeleon: { x: 40, y: 32, scale: 1.15 },
  charizard: { x: 50, y: 32, scale: 1.05 },
  squirtle: { x: 48, y: 32, scale: 1.15 },
  wartortle: { x: 42, y: 38, scale: 1.15 },
  blastoise: { x: 62, y: 17, scale: 1.1 },
  caterpie: { x: 52, y: 38, scale: 1.1 },
  metapod: { x: 42, y: 40, scale: 1.15 },
  butterfree: { x: 40, y: 45, scale: 1.05 },
  weedle: { x: 38, y: 32, scale: 1.15 },
  kakuna: { x: 50, y: 40, scale: 1.15 },
  beedrill: { x: 45, y: 35, scale: 1.05 },
  pidgey: { x: 35, y: 33, scale: 1.1 },
  pidgeotto: { x: 40, y: 38, scale: 1.1 },
  pidgeot: { x: 70, y: 45, scale: 1.1 },
  rattata: { x: 42, y: 48, scale: 1.15 },
  raticate: { x: 35, y: 35, scale: 1.1 },
  fearow: { x: 35, y: 58, scale: 1.05 },
  pikachu: { x: 40, y: 35, scale: 1.15 },
  raichu: { x: 30, y: 32, scale: 1.1 },
  golbat: { x: 40, y: 50, scale: 1.05 },
  oddish: { x: 38, y: 55, scale: 1.15 },
  gloom: { x: 48, y: 50, scale: 1.1 },
  vileplume: { x: 48, y: 60, scale: 1.05 },
  persian: { x: 62, y: 35, scale: 1.1 },
  arcanine: { x: 38, y: 40, scale: 1.05 },
  poliwag: { x: 38, y: 35, scale: 1.15 },
  kadabra: { x: 38, y: 34, scale: 1.05 },
  geodude: { x: 46, y: 50, scale: 1.1 },
  graveler: { x: 46, y: 50, scale: 1.1 },
  golem: { x: 35, y: 55, scale: 1.05 },
  slowpoke: { x: 35, y: 55, scale: 1.1 },
  slowbro: { x: 35, y: 35, scale: 1.05 },
  seel: { x: 45, y: 62, scale: 1.1 },
  dewgong: { x: 35, y: 42, scale: 1.05 },
  onix: { x: 38, y: 40, scale: 1.05 },
  gastly: { x: 44, y: 50, scale: 1.05 },
  staryu: { x: 46, y: 46, scale: 1.1 },
  starmie: { x: 50, y: 46, scale: 1.1 },
  magikarp: { x: 40, y: 45, scale: 1.1 },
  gyarados: { x: 35, y: 38, scale: 1.05 },
  lapras: { x: 42, y: 38, scale: 1.12 },
  eevee: { x: 38, y: 42, scale: 1.1 },
  aerodactyl: { x: 45, y: 45, scale: 1.25 },
  ekans: { x: 38, y: 40, scale: 1.1 },
};

// The thin strip of a family card (the next form, ~3 : 1) shows a slice of the
// picture, so it has its own crop, on the face (the card crops above sit
// between the face and the body and would cut the head off in a strip).
// Only evolved forms ever show as a strip. ✏️ fixes it in the editor's
// „Pasek ewolucji” tab, separately from the card.
export const ROW_DEFAULT = { x: 50, y: 30, scale: 1.15 };
export const ROW_FOCUS = {
  ivysaur: { x: 66, y: 46, scale: 1.15 }, venusaur: { x: 50, y: 55, scale: 1.15 },
  charmeleon: { x: 40, y: 22, scale: 1.15 }, charizard: { x: 52, y: 20, scale: 1.15 },
  wartortle: { x: 42, y: 36, scale: 1.15 }, blastoise: { x: 66, y: 15, scale: 1.15 },
  metapod: { x: 47, y: 30, scale: 1.15 }, butterfree: { x: 42, y: 45, scale: 1.15 },
  kakuna: { x: 45, y: 28, scale: 1.15 }, beedrill: { x: 50, y: 24, scale: 1.15 },
  pidgeotto: { x: 40, y: 31, scale: 1.15 }, pidgeot: { x: 74, y: 34, scale: 1.15 },
  raticate: { x: 32, y: 25, scale: 1.15 }, fearow: { x: 22, y: 62, scale: 1.15 },
  raichu: { x: 32, y: 26, scale: 1.15 }, clefable: { x: 48, y: 42, scale: 1.15 },
  golbat: { x: 45, y: 36, scale: 1.15 }, gloom: { x: 48, y: 50, scale: 1.15 },
  vileplume: { x: 45, y: 68, scale: 1.15 }, dugtrio: { x: 55, y: 42, scale: 1.15 },
  persian: { x: 68, y: 20, scale: 1.15 }, golduck: { x: 35, y: 25, scale: 1.15 },
  arcanine: { x: 35, y: 25, scale: 1.15 }, poliwhirl: { x: 58, y: 28, scale: 1.15 },
  poliwrath: { x: 55, y: 25, scale: 1.15 }, kadabra: { x: 40, y: 28, scale: 1.15 },
  alakazam: { x: 50, y: 25, scale: 1.15 }, tentacruel: { x: 50, y: 25, scale: 1.15 },
  graveler: { x: 50, y: 55, scale: 1.15 }, golem: { x: 28, y: 64, scale: 1.15 },
  slowbro: { x: 38, y: 24, scale: 1.15 }, magneton: { x: 50, y: 42, scale: 1.15 },
  dewgong: { x: 25, y: 40, scale: 1.15 }, haunter: { x: 55, y: 40, scale: 1.15 },
  gengar: { x: 55, y: 45, scale: 1.15 }, kingler: { x: 45, y: 52, scale: 1.15 },
  starmie: { x: 50, y: 44, scale: 1.15 }, gyarados: { x: 30, y: 30, scale: 1.15 },
  arbok: { x: 45, y: 22, scale: 1.15 }, weezing: { x: 38, y: 58, scale: 1.15 },
};

// ---- per-species crop overrides (in-game crop editor, artEditor.js) ---------------
// Saved globally per species in this browser — not per Pokémon, save game or
// player — under their own key, never inside a game save:
//   localStorage['pokemon.artFocus.v1'] = { "v": 1, "focus": { "charizard": { "x": 50, "y": 22, "scale": 1.9 }, … },
//                                           "row": { "pidgeotto": { … } } }   (strip crops, Build 2.4 — older builds ignore "row")
// Priority: saved override → ART_FOCUS / ROW_FOCUS above → DEFAULT_FOCUS / ROW_DEFAULT.
// `shape`: 'card' (every picture but the strip) or 'row' (the family card's strip).
export const ART_FOCUS_KEY = 'pokemon.artFocus.v1';
export const SCALE_RANGE = [1, 3.5];
const overrides = {};
const rowOverrides = {};
let store = null;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const round = (v, digits) => Math.round(v * 10 ** digits) / 10 ** digits;

// A focus with sane numbers (x, y 0–100, scale in SCALE_RANGE), or null.
export function normalizeFocus(f) {
  if (!f || ![f.x, f.y, f.scale].every((v) => typeof v === 'number' && Number.isFinite(v))) return null;
  return { x: round(clamp(f.x, 0, 100), 1), y: round(clamp(f.y, 0, 100), 1), scale: round(clamp(f.scale, ...SCALE_RANGE), 2) };
}

// Use this storage (window.localStorage in the browser, a fake in tests) and
// load the overrides saved there. Unreadable entries are ignored.
export function useArtStorage(storage) {
  store = storage;
  for (const id of Object.keys(overrides)) delete overrides[id];
  for (const id of Object.keys(rowOverrides)) delete rowOverrides[id];
  let saved = null;
  try {
    saved = JSON.parse(storage?.getItem(ART_FOCUS_KEY) ?? 'null');
  } catch {
    saved = null;
  }
  for (const [into, from] of [[overrides, saved?.focus], [rowOverrides, saved?.row]]) {
    for (const [id, f] of Object.entries(saved?.v === 1 && from && typeof from === 'object' ? from : {})) {
      const ok = /^[a-z0-9-]+$/.test(id) ? normalizeFocus(f) : null;
      if (ok) into[id] = ok;
    }
  }
}

// → true when written (false: storage full / unavailable; the override still
// applies for this session).
function persist() {
  try {
    if (Object.keys(overrides).length || Object.keys(rowOverrides).length) store?.setItem(ART_FOCUS_KEY, JSON.stringify({ v: 1, focus: overrides, ...(Object.keys(rowOverrides).length ? { row: rowOverrides } : {}) }));
    else store?.removeItem(ART_FOCUS_KEY);
    return Boolean(store);
  } catch {
    return false;
  }
}

export function setArtOverride(speciesId, focus, shape = 'card') {
  const ok = normalizeFocus(focus);
  if (!ok) throw new Error(`Bad crop for ${speciesId}`);
  (shape === 'row' ? rowOverrides : overrides)[speciesId] = ok;
  return persist();
}

export function clearArtOverride(speciesId, shape = 'card') {
  delete (shape === 'row' ? rowOverrides : overrides)[speciesId];
  return persist();
}

export function artOverrides() {
  return structuredClone(overrides);
}

// Where this species' crop comes from: 'saved' | 'code' | 'default'.
export function artFocusSource(speciesId, shape = 'card') {
  if (shape === 'row') return rowOverrides[speciesId] ? 'saved' : ROW_FOCUS[speciesId] ? 'code' : 'default';
  return overrides[speciesId] ? 'saved' : ART_FOCUS[speciesId] ? 'code' : 'default';
}

export function artFocus(speciesId, shape = 'card') {
  if (shape === 'row') return rowOverrides[speciesId] ?? ROW_FOCUS[speciesId] ?? ROW_DEFAULT;
  return overrides[speciesId] ?? ART_FOCUS[speciesId] ?? DEFAULT_FOCUS;
}

// The crop from the code (the editor's Reset).
export function codeFocus(speciesId, shape = 'card') {
  return shape === 'row' ? ROW_FOCUS[speciesId] ?? ROW_DEFAULT : ART_FOCUS[speciesId] ?? DEFAULT_FOCUS;
}

// The saved crops as lines ready to paste into ART_FOCUS above.
export function overridesSnippet() {
  const lines = (map) => Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([id, f]) => `  ${id}: { x: ${f.x}, y: ${f.y}, scale: ${f.scale} },`).join('\n');
  const rows = lines(rowOverrides);
  return lines(overrides) + (rows ? `\n// ROW_FOCUS (pasek ewolucji):\n${rows}` : '');
}

// ---- portrait geometry -----------------------------------------------------------

// For a portrait crop of focus `f` in a frame `aspect` = width / height:
// cover crop, zoom around the focus point, then move the focus to the middle
// of the frame. The face comes first: the picture may leave a light margin
// (up to PORTRAIT_MARGIN of the frame on a side, showing the type colours as
// the artwork's own transparent edges do) rather than cut the face; beyond
// that the shift stops. dx in frame widths, dy in frame heights. The square
// artwork overflows a wide frame vertically (r) and a tall one — the full-art
// cards of P1.5 — horizontally (w).
export const PORTRAIT_MARGIN = 0.2;

export function shiftFor(f, aspect = 2) {
  const fx = f.x / 100;
  const fy = f.y / 100;
  const k = f.scale;
  const r = Math.max(1, aspect);
  const w = Math.max(1, 1 / aspect);
  const m = PORTRAIT_MARGIN;
  return {
    dx: clamp(0.5 - fx, (1 - fx) * (1 - k * w) - m, fx * (k * w - 1) + m),
    dy: clamp(0.5 - fy, (1 - fy) * (1 - k * r) - m, fy * (k * r - 1) + m),
  };
}

// The crop as CSS variables; table.css draws it. Build 2.5.1 (Piotr: the left
// edge of the artwork was always cut — on Pikachu it shows while moving the
// crop): where the browser has container units, the image element is the WHOLE
// square artwork, as big as the frame's longer side, with the focus point placed
// where a cover crop would put it — a shift shows more of the picture (or its
// transparent edge), never a cut. Older browsers keep the frame-sized cover crop.
// --fx / --fy: the focus (0–1), --dx / --dy: the shift in frame widths / heights.
export function styleFor(f, aspect = 2) {
  const { dx, dy } = shiftFor(f, aspect);
  const n = (v) => Math.round(v * 10000) / 10000;
  return `--fx:${n(f.x / 100)};--fy:${n(f.y / 100)};--dx:${n(dx)};--dy:${n(dy)};--k:${f.scale}`;
}

export function portraitShift(speciesId, aspect = 2, shape = 'card') {
  return shiftFor(artFocus(speciesId, shape), aspect);
}

export function portraitStyle(speciesId, aspect = 2, shape = 'card') {
  return styleFor(artFocus(speciesId, shape), aspect);
}

// The range of focus points that still sit in the middle of a frame of this
// shape, margin allowance included (outside it the crop would stop moving):
// x, y in %.
export function focusRange(scale, aspect = 2) {
  const r = Math.max(1, aspect);
  const w = Math.max(1, 1 / aspect);
  const edge = 100 * (0.5 - PORTRAIT_MARGIN);
  return { x: [edge / (scale * w), 100 - edge / (scale * w)], y: [edge / (scale * r), 100 - edge / (scale * r)] };
}

// Editor gestures. Dragging the picture by (dxPx, dyPx) in a frame `widthPx`
// wide moves the focus the other way; the picture is drawn widthPx × scale
// wide (and as tall: the artwork is square).
export function panFocus(f, dxPx, dyPx, widthPx, aspect = 2) {
  const perPercent = (widthPx * f.scale) / 100;
  return fitFocus({ ...f, x: f.x - dxPx / perPercent, y: f.y - dyPx / perPercent }, aspect);
}

export function zoomFocus(f, scale, aspect = 2) {
  return fitFocus({ ...f, scale }, aspect);
}

function fitFocus(f, aspect) {
  const n = normalizeFocus(f);
  const range = focusRange(n.scale, aspect);
  return normalizeFocus({ ...n, x: clamp(n.x, ...range.x), y: clamp(n.y, ...range.y) });
}
