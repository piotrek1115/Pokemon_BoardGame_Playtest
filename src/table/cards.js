// Cards and tokens of the digital tabletop: the Pokémon Card (5:7) with its
// coloured HP slots, mission cards, ball / star / badge tokens, decks. Pure
// HTML strings; buttons carry engine actions in data-act like the harness.
import { attackTypeOf, getSpecies } from '../data/pokemon.js';
import { ITEMS } from '../data/items.js';
import { artLoaded, pokemonArtUrl, portraitStyle, trainerArtUrl } from './art.js';
import { GYMS } from '../data/gyms.js';
import { getLocation } from '../data/locations.js';
import { escapeZones } from '../engine/captureEngine.js';
import { hasBadge } from '../engine/gymEngine.js';
import { questLocations, questReward } from '../engine/questEngine.js';
import { QUESTS_BY_ID } from '../data/quests.js';
import { actAttr, esc } from '../ui/dom.js';
import { RARITY_PL, TYPE_PL, stageLabel } from './i18n.js';
import { gi, iconText, itemIconKey, pokeballSvg, superballSvg, typeIcon } from './icons.js';

export { superballSvg };

// Build 2.4: icons instead of emoji (icons.js). The classic cards of ?hud=legacy keep theirs.
const IC = {
  star: () => gi('star'),
  lock: () => gi('lock'),
  check: () => gi('done'),
  ready: () => gi('evolve'),
  arrow: () => gi('next'),
  atk: () => gi('attack'),
  coin: () => gi('money'),
  edit: () => gi('edit'),
  pin: () => gi('here'),
};
const heartIc = (on) => gi(on ? 'hp' : 'hp.empty', { cls: on ? 'on' : '' });
const gems = (rarity) => gi('rarity').repeat({ common: 1, rare: 2, superRare: 3 }[rarity] ?? 1);
// An item as its icon (the balls as balls).
export const itemIc = (id, size = null) => gi(itemIconKey(id), { size });
import { DIFFICULTY_PL, plotPl, questPl, rewardPl, thingPl, trainerPl } from './content-pl.js';

export const TYPE_COLOUR = {
  normal: '#a8a77a', fire: '#ee8130', water: '#6390f0', electric: '#f7d02c', grass: '#7ac74c', ice: '#96d9d6',
  fighting: '#c22e28', poison: '#a33ea1', ground: '#e2bf65', flying: '#a98ff3', psychic: '#f95587',
  bug: '#a6b91a', rock: '#b6a136', ghost: '#735797', dragon: '#6f35fc',
};

// HP slots: every slot keeps its colour (green 1st, then yellow, then red);
// filled hearts up to the current HP, empty hearts after it.
export function hpSlots(hp, maxHp, { small = false } = {}) {
  const zones = escapeZones(maxHp);
  const slots = zones.map((z, i) => `<span class="hp-slot z-${z}${i < hp ? ' full' : ''}">${heartIc(i < hp)}</span>`).join('');
  return `<div class="hp-slots${small ? ' small' : ''}" aria-label="HP ${hp} z ${maxHp}">${slots}</div>`;
}

export function currentZone(hp, maxHp) {
  return escapeZones(maxHp)[Math.max(1, Math.min(hp, maxHp)) - 1];
}

// ---- artwork (art.js is the only place that knows where pictures come from) ----

export const typeBackground = (s) => `linear-gradient(160deg, ${TYPE_COLOUR[s.types[0]]}, ${TYPE_COLOUR[s.types[1] ?? s.types[0]]}cc)`;

// The picture over a fallback (type colours + icon / initial) that keeps the
// same size: 'hero' shows the whole Pokémon (contain), 'portrait' crops to the
// species' focus point (art.js ART_FOCUS). A failed picture hides itself
// (main.js) and the fallback shows; nothing moves.
// `aspect`: the portrait frame's width / height (the crop is centred for it).
function artImg(s, mode, aspect, shape = 'card') {
  const url = pokemonArtUrl(s);
  if (!url) return '';
  const style = mode === 'portrait' ? ` style="${portraitStyle(s.id, aspect, shape)}"` : '';
  // crossorigin: a CORS request, so the service worker can keep the picture on the device.
  return `<img class="art art-${mode}" src="${esc(url)}" alt="" loading="lazy" decoding="async" crossorigin="anonymous" referrerpolicy="no-referrer" draggable="false"${style}>`;
}

// Portraits carry a small ✏️: fix this species' crop right at the table
// (artEditor.js); the fix applies to every portrait of the species.
function artBox(s, mode, cls, aspect, shape = 'card') {
  const img = artImg(s, mode, aspect, shape);
  const shown = img && artLoaded(pokemonArtUrl(s));
  const edit = mode === 'portrait' ? `<button class="art-edit" data-art-edit="${esc(s.id)}" aria-label="Popraw kadr: ${esc(s.name)}" title="Popraw kadr">${IC.edit()}</button>` : '';
  return `<div class="${cls}${shown ? ' has-art' : ''}" style="background:${typeBackground(s)}"><span class="art-icon">${gi(`type.${s.types[0]}`)}</span><span class="art-initial">${esc(s.name[0])}</span>${img}${edit}</div>`;
}

// The evolution line a species belongs to, stage 1 first (1, 2 or 3 species).
export function familyOf(speciesId) {
  const line = [getSpecies(getSpecies(speciesId).family)];
  while (line.at(-1).evolvesTo) line.push(getSpecies(line.at(-1).evolvesTo));
  return line;
}

function inspectAttr(mon) {
  return mon.uid ? ` data-inspect="${esc(mon.uid)}"` : ` data-inspect-species="${esc(mon.species)}"`;
}

// Card style (P1.5): 'full' — full-art cards (the artwork is the card, name /
// Growth / HP / status float on it; the family build); 'classic' — the boxed
// card of phases 1b–3A (?hud=legacy, and the default for tests). Switch like
// the art source: one call, every card on the table changes.
export const CARD_STYLE = { fullArt: false };
export function setCardStyle(style) {
  if (!['full', 'classic'].includes(style)) throw new Error(`Unknown card style: ${style}`);
  CARD_STYLE.fullArt = style === 'full';
}

// The Pokémon Card. mon = { species, hp, maxHp, uid?, growth? }. `family`:
// an owned Pokémon of a 2- or 3-stage line is drawn as its evolution family
// card; one-stage Pokémon and everything else keep the single-art card.
export function pokemonCard(mon, { actions = '', label = '', family = false, ...opts } = {}) {
  let card = CARD_STYLE.fullArt
    ? (family && familyOf(mon.species).length > 1 ? fullArtFamily(mon, opts) : fullArtCard(mon, opts))
    : (family && familyOf(mon.species).length > 1 ? familyCard(mon, opts) : cardFace(mon, opts));
  if (label) card = `<div class="card-labelled"><div class="card-owner">${esc(label)}</div>${card}</div>`;
  return actions ? `<div class="card-with-actions">${card}<div class="pcard-actions">${actions}</div></div>` : card;
}

// Growth games: the Pokémon's own training toward its next form (⭐ 2/4), READY
// when the threshold is reached (plus the stone the edge needs, if any).
export function growthRow(mon, { size = 'm' } = {}) {
  const edge = getSpecies(mon.species).evolution;
  if (!edge) return `<div class="growth-row final" title="Ostatnia forma — nie ewoluuje dalej">${IC.star()} forma ostateczna</div>`;
  const g = Math.min(mon.growth ?? 0, edge.growth);
  const ready = g >= edge.growth;
  const stone = edge.item ? ITEMS[edge.item] : null;
  const pips = size === 's' ? '' : `<span class="gpips">${Array.from({ length: edge.growth }, (_, i) => `<span class="gpip${i < g ? ' on' : ''}">${gi(i < g ? 'star' : 'star.empty')}</span>`).join('')}</span>`;
  const tag = ready ? `<span class="ready-tag">${stone ? `GOTOWY + ${itemIc(edge.item)}` : 'GOTOWY!'}</span>` : '';
  return `<div class="growth-row${ready ? ' ready' : ''}" title="Punkty treningu: ${g} z ${edge.growth}${stone ? ` + ${esc(stone.name)}` : ''}">${IC.star()} <b>${g}/${edge.growth}</b>${stone ? ` + ${itemIc(edge.item)}` : ''}${pips}${tag}</div>`;
}

function cardFace(mon, { size = 'm', lead = false, drop = false, hp = mon.hp, cls = '', growth = false } = {}) {
  const s = getSpecies(mon.species);
  const fainted = hp === 0;
  return `
    <div class="pcard size-${size} r-${s.rarity}${fainted ? ' fainted' : ''}${lead ? ' lead' : ''}${drop ? ' drop-target' : ''} ${cls}"${drop ? ' data-drop="wild"' : ''}${mon.uid ? ` data-uid="${esc(mon.uid)}"` : ''}${inspectAttr(mon)}>
      <div class="pcard-head"><span class="pcard-name">${esc(s.name)}</span><span class="evo-stage" title="Etap ewolucji">Etap ${stageLabel(s.stage)}</span></div>
      ${artBox(s, 'hero', 'pcard-art')}
      <div class="pcard-rarity">${gems(s.rarity)} ${RARITY_PL[s.rarity]}</div>
      <div class="pcard-stats">
        <span class="types">${s.types.map((x) => `<span class="type-chip" style="--tc:${TYPE_COLOUR[x]}">${gi(`type.${x}`)} ${TYPE_PL[x]}</span>`).join('')}</span>
        <span class="atk" title="Atak">${IC.atk()} ${s.attack >= 0 ? '+' : ''}${s.attack}</span>
      </div>
      ${hpSlots(hp, mon.maxHp, { small: size === 's' })}
      <div class="hp-num">${hp} / ${mon.maxHp}</div>
      ${growth && mon.growth !== undefined ? growthRow(mon, { size }) : ''}
      ${lead ? '<div class="lead-tag">prowadzi</div>' : ''}
      ${fainted ? '<div class="faint-tag">Omdlał</div>' : ''}
    </div>`;
}

// ---- evolution family card ------------------------------------------------------
// An owned Pokémon of a 2- or 3-stage line: one portrait row per stage, the
// current one larger and highlighted (Growth, READY, stone), earlier stages
// done, later stages locked; HP of the current form underneath. Full stats
// live in the inspect view (tap the card).

function rowState(stage, current) {
  return stage < current ? 'done' : stage === current ? 'current' : 'future';
}

function currentRowStatus(mon, s) {
  if (mon.growth === undefined) return ''; // Phase 2 star game: the evolve button shows the star cost
  const edge = s.evolution;
  if (!edge) return '<span class="frow-status final">ostatnia forma</span>';
  const g = Math.min(mon.growth, edge.growth);
  const stone = edge.item ? ITEMS[edge.item] : null;
  if (g >= edge.growth) return `<span class="frow-status ready">GOTOWY${stone ? ` + ${itemIc(edge.item)}` : '!'}</span>`;
  return `<span class="frow-status">${IC.star()} ${g}/${edge.growth}${stone ? ` + ${itemIc(edge.item)}` : ''}</span>`;
}

// Row frame shapes (width / height) in the family card layout (table.css).
const ROW_ASPECT = { n2: { current: 1.6, other: 2.6 }, n3: { current: 2, other: 4 } };

function familyRow(sp, state, mon, prev, n) {
  const tag = state === 'done' ? IC.check() : state === 'future' ? IC.lock() : '';
  // Stones exist in Growth games only (Phase 2 star games evolve with stars).
  const need = state === 'future' && mon.growth !== undefined && prev?.evolution?.item ? `<span class="frow-need" title="potrzebny ${esc(ITEMS[prev.evolution.item].name)}">${itemIc(prev.evolution.item)}</span>` : '';
  return `
      <div class="frow ${state}" title="${esc(sp.name)} — ${state === 'done' ? 'wcześniejsza forma' : state === 'current' ? 'obecna forma' : 'przyszła forma'}">
        ${artBox(sp, 'portrait', 'frow-art', ROW_ASPECT[`n${n}`][state === 'current' ? 'current' : 'other'])}
        <span class="frow-name">${esc(sp.name)}</span><span class="frow-stage">${stageLabel(sp.stage)}${tag ? ` ${tag}` : ''}</span>
        ${state === 'current' ? currentRowStatus(mon, sp) : need}
      </div>`;
}

export function familyCard(mon, { size = 's', lead = false, hp = mon.hp, cls = '' } = {}) {
  const s = getSpecies(mon.species);
  const line = familyOf(s.id);
  const fainted = hp === 0;
  const rows = line.map((sp, i) => familyRow(sp, rowState(sp.stage, s.stage), mon, line[i - 1], line.length)).join('');
  return `
    <div class="pcard fcard size-${size} r-${s.rarity} n${line.length} at${s.stage}${fainted ? ' fainted' : ''}${lead ? ' lead' : ''} ${cls}"${mon.uid ? ` data-uid="${esc(mon.uid)}"` : ''}${inspectAttr(mon)}>
      <div class="frows">${rows}</div>
      ${hpSlots(hp, mon.maxHp, { small: true })}
      <div class="hp-num">${hp} / ${mon.maxHp}</div>
      ${lead ? '<div class="lead-tag">prowadzi</div>' : ''}
      ${fainted ? '<div class="faint-tag">Omdlał</div>' : ''}
    </div>`;
}

// ---- full-art cards (P1.5) ---------------------------------------------------------
// HP on the artwork: always hearts (Build 2.4 — Piotr: one way for every card; the most is 8).
function hpOverlay(hp, maxHp) {
  return `<span class="fa-hp" aria-label="HP ${hp} z ${maxHp}">${Array.from({ length: maxHp }, (_, i) => heartIc(i < hp)).join('')}</span>`;
}
// The status of one stage of an owned Pokémon's line: done (its own edge's
// threshold, completed), the current one (progress / READY + stone), a final
// form, or a future stage (🔒 + the threshold to reach it + its stone).
export function stageStatus(mon, sp) {
  const cur = getSpecies(mon.species);
  const growthGame = mon.growth !== undefined;
  if (sp.stage < cur.stage) {
    const e = sp.evolution;
    return { kind: 'done', text: growthGame && e?.growth ? `${IC.star()} ${e.growth}/${e.growth} ${IC.check()}` : IC.check() };
  }
  if (sp.id === cur.id) {
    const e = sp.evolution;
    if (!growthGame) return { kind: 'current', text: '' };
    if (!e) return { kind: 'final', text: `${IC.star()} forma ostateczna` };
    const stone = e.item ? ` ${itemIc(e.item)}` : '';
    if (mon.growth >= e.growth) return { kind: 'ready', text: `${IC.ready()} GOTOWY${stone}` };
    return { kind: 'current', text: `${IC.star()} ${Math.min(mon.growth, e.growth)}/${e.growth}${stone}` };
  }
  const prev = familyOf(sp.id).find((x) => x.stage === sp.stage - 1);
  const e = prev?.evolution;
  return { kind: 'future', text: growthGame && e?.growth ? `${IC.lock()} ${IC.star()} ${e.growth}${e.item ? ` ${itemIc(e.item)}` : ''}` : IC.lock() };
}
function faAttrs(mon, { size, lead, drop, cls, fainted, selected }) {
  const classes = ['pcard', 'fa', `size-${size}`, lead ? 'lead' : '', fainted ? 'fainted' : '', drop ? 'drop-target' : '', selected ? 'selected' : '', cls].filter(Boolean).join(' ');
  return `class="${classes}"${drop ? ' data-drop="wild"' : ''}${mon.uid ? ` data-uid="${esc(mon.uid)}"` : ''}${inspectAttr(mon)}`;
}
const signedNum = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0');
// The card's ⚔ is the Pokémon's own attack stat, always. In a battle (Build 2.3)
// a separate matchup badge says what its TYPE does against this opponent:
// green „💧 +1” / red „🔥 −1” (the icon of its attack type); nothing when 0.
function faAttack(s) {
  return `<b class="fa-atk">${IC.atk()}${s.attack >= 0 ? '+' : ''}${s.attack}</b>`;
}
function faMatchup(s, fight) {
  if (!fight?.type) return '';
  return `<span class="fa-mu ${fight.type > 0 ? 'good' : 'bad'}" title="typ: ${signedNum(fight.type)} do ataku">${gi(`type.${attackTypeOf(s)}`)} ${signedNum(fight.type)}</span>`;
}
// The card's bottom (Build 2.4): HP and the ATK stat only — the types are named
// in the detail (a lone ⚪ for Normal said nothing); the lead is the gold frame.
function faBottom(s, hp, maxHp) {
  return `<div class="fa-bottom">${hpOverlay(hp, maxHp)}<span class="fa-types">${faAttack(s)}</span></div>`;
}
// ✏️ in the corner (P1.5b): the crop editor in one tap, for the species shown.
const faEdit = (s, shape = 'card') => `<button class="fa-edit" data-art-edit="${esc(s.id)}"${shape === 'row' ? ' data-art-shape="row"' : ''} aria-label="Popraw kadr: ${esc(s.name)}${shape === 'row' ? ' (pasek)' : ''}" title="Popraw kadr"><span>${IC.edit()}</span></button>`;
// Whose move it is in a battle (P1.5b): the existing order, shown — no new stat.
const faActor = `<span class="fa-actor">${gi('turn')} RUCH</span>`;
const RARITY_DOTS = { common: 1, rare: 2, superRare: 3 };
// One Pokémon on one full-art card (one-stage lines, combat, wild / trainer Pokémon).
export function fullArtCard(mon, { size = 'm', lead = false, drop = false, hp = mon.hp, cls = '', growth = false, selected = false, edit = false, fight = null, actor = false, chip: chipOverride = null } = {}) {
  const s = getSpecies(mon.species);
  const fainted = hp <= 0;
  const st = growth && mon.growth !== undefined ? stageStatus(mon, s) : null;
  const chip = chipOverride ?? (st ? (st.text ? `<span class="fa-chip ${st.kind}">${st.text}</span>` : '') : `<span class="fa-chip rarity">${gems(s.rarity)} ${esc(RARITY_PL[s.rarity])}</span>`);
  // full-art cards are 3 : 4 everywhere (team grid, battle, detail) — the crop's frame shape
  return `<div ${faAttrs(mon, { size, lead, drop, cls: `${cls}${actor ? ' acting' : ''}`, fainted, selected })}>${artBox(s, 'portrait', 'fa-art', 0.75)}
    <div class="fa-top"><b class="fa-name">${esc(s.name)}</b>${chip}</div>${faBottom(s, hp, mon.maxHp)}${faMatchup(s, fight)}${actor ? faActor : ''}${edit ? faEdit(s) : ''}${fainted ? '<div class="fa-out">Omdlał</div>' : ''}</div>`;
}
// An owned Pokémon that still evolves (Build 2.4): the Pokémon you have on top,
// big; under it a thin strip with the NEXT form only — locked, with what it
// takes (⭐ Growth + stone) or ✨ GOTOWY. Earlier forms are not shown (which one
// do I have?); the whole line is in the detail. The strip has its own crop
// (art.js ROW_FOCUS / the editor's „Pasek ewolucji”).
export const STRIP_ASPECT = 3;
export function fullArtFamily(mon, { size = 'm', lead = false, hp = mon.hp, cls = '', selected = false, edit = false } = {}) {
  const s = getSpecies(mon.species);
  const next = s.evolution ? getSpecies(s.evolution.to) : null;
  if (!next) return fullArtCard(mon, { size, lead, hp, cls, selected, edit, growth: mon.growth !== undefined });
  const fainted = hp <= 0;
  const cur = stageStatus(mon, s);
  const fut = stageStatus(mon, next);
  const ready = cur.kind === 'ready';
  return `<div ${faAttrs(mon, { size, lead, drop: false, cls: `fam ${cls}`, fainted, selected })}>
    <div class="fa-row cur">${artBox(s, 'portrait', 'fa-art', 1)}
      <div class="fa-top"><b class="fa-name">${esc(s.name)}</b>${cur.text ? `<span class="fa-chip ${cur.kind}">${cur.text}</span>` : ''}</div>${faBottom(s, hp, mon.maxHp)}${edit ? faEdit(s) : ''}</div>
    <div class="fa-row next${ready ? ' ready' : ''}">${artBox(next, 'portrait', 'fa-art', STRIP_ASPECT, 'row')}
      <div class="fa-top"><b class="fa-name">${IC.arrow()} ${esc(next.name)}</b><span class="fa-chip ${ready ? 'ready' : 'future'}">${ready ? `${IC.ready()} GOTOWY` : fut.text}</span></div>${edit ? faEdit(next, 'row') : ''}</div>
    ${fainted ? '<div class="fa-out">Omdlał</div>' : ''}</div>`;
}

// ---- the compact Pokémon detail (P1.5b) ------------------------------------------------
// Tap a card → this: the Pokémon's card → its next form's card, what the
// evolution takes (⭐ Growth + stone), what changes (HP, ⚔, types — changes
// highlighted) and the quick actions the caller passes (legal ones only).
const cmp = (label, a, b, fmt = String) => `<span class="dt-stat${a === b ? '' : ' up'}"><small>${label}</small> ${fmt(a)}${a === b ? '' : ` ${IC.arrow()} <b>${fmt(b)}</b>`}</span>`;
const typesText = (sp) => sp.types.map((t) => `${typeIcon(t)} ${TYPE_PL[t]}`).join(' / ');
export function pokemonDetail(mon, { growth = false, config = null, owner = null, actions = '' } = {}) {
  const s = getSpecies(mon.species);
  const hp = mon.hp ?? s.hp;
  const maxHp = mon.maxHp ?? s.hp;
  const owned = Boolean(mon.uid) && owner;
  const card = { ...mon, hp, maxHp };
  const next = s.evolution ? getSpecies(s.evolution.to) : null;
  const edge = s.evolution;
  let arrow = '';
  let nextCard = '';
  let compare = `<span class="dt-stat"><small>HP</small> ${maxHp}</span><span class="dt-stat"><small>${IC.atk()}</small> ${signedNum(s.attack)}</span><span class="dt-stat">${typesText(s)}</span><span class="dt-final">${IC.star()} forma ostateczna</span>`;
  if (next) {
    const stone = edge.item ? ` + ${itemIc(edge.item)} ${esc(ITEMS[edge.item].name)}` : '';
    const ready = growth && mon.growth !== undefined && mon.growth >= edge.growth;
    const need = growth
      ? `${IC.star()} ${mon.growth !== undefined ? `${Math.min(mon.growth, edge.growth)}/` : ''}${edge.growth}${stone}`
      : edgeNeed(s, { growth, config });
    arrow = `<div class="dt-arrow${ready ? ' ready' : ''}"><span class="dt-arrow-icon">${IC.arrow()}</span><b>${ready ? `${IC.ready()} GOTOWY` : 'Ewolucja'}</b><small>${need}</small></div>`;
    const nextMax = next.hp;
    nextCard = `<div class="dt-card next">${fullArtCard({ species: next.id, hp: nextMax, maxHp: nextMax }, { size: 'm', edit: true, chip: `<span class="fa-chip ${ready ? 'ready' : 'future'}">${ready ? `${IC.ready()} GOTOWY` : IC.lock()}</span>` })}</div>`;
    compare = `${cmp('HP', maxHp, nextMax)}${cmp(IC.atk(), s.attack, next.attack, signedNum)}<span class="dt-stat${typesText(s) === typesText(next) ? '' : ' up'}">${typesText(s)}${typesText(s) === typesText(next) ? '' : ` ${IC.arrow()} <b>${typesText(next)}</b>`}</span>`;
  }
  return `
    <div class="detail">
      <div class="dt-head"><b>${esc(s.name)}</b><small>#${s.dex} · Etap ${stageLabel(s.stage)} · ${gems(s.rarity)} ${RARITY_PL[s.rarity]}${owned ? ` · ${esc(owner)}` : ''}</small></div>
      <div class="dt-row">
        <div class="dt-card">${fullArtCard(card, { size: 'm', growth, edit: true })}</div>
        ${arrow}${nextCard}
      </div>
      <div class="dt-compare">${compare}</div>
      ${actions ? `<div class="dt-actions">${actions}</div>` : ''}
    </div>`;
}

// What it takes to go from `from` to the next stage, for the family strip.
function edgeNeed(from, { growth, config }) {
  if (!from.evolution) return '';
  if (growth) return `${IC.star()} ${from.evolution.growth}${from.evolution.item ? ` + ${itemIc(from.evolution.item)}` : ''}`;
  const cost = config?.evolution?.starCost?.[from.stage];
  return cost ? `${IC.star()} ${cost}` : '';
}

// The whole line side by side (inspect view): done / current / future.
export function familyStrip(speciesId, { current = null, growth = false, config = null } = {}) {
  const line = familyOf(speciesId);
  if (line.length < 2) return '';
  const now = current ? getSpecies(current).stage : 0;
  return `<div class="family-strip">${line.map((sp, i) => `${i ? `<span class="fs-arrow">${IC.arrow()}<small>${edgeNeed(line[i - 1], { growth, config })}</small></span>` : ''}
    <div class="fs-stage ${now ? rowState(sp.stage, now) : 'future'}">${artBox(sp, 'portrait', 'fs-art', 1.5)}<b>${esc(sp.name)}</b><small>Etap ${stageLabel(sp.stage)}</small></div>`).join('')}</div>`;
}

// The inspect view: the whole artwork, the stats, and the family line.
export function inspectView(mon, { growth = false, config = null, owner = null } = {}) {
  const s = getSpecies(mon.species);
  const hp = mon.hp ?? s.hp;
  const maxHp = mon.maxHp ?? s.hp;
  return `
    <div class="inspect">
      ${artBox(s, 'hero', 'inspect-art')}
      <div class="inspect-info">
        <h2>${esc(s.name)} <small>#${s.dex}</small></h2>
        <div class="inspect-line">Etap ${stageLabel(s.stage)} · ${gems(s.rarity)} ${RARITY_PL[s.rarity]}${owner ? ` · ${esc(owner)}` : ''}</div>
        <div class="inspect-line">${s.types.map((x) => `<span class="type-chip" style="--tc:${TYPE_COLOUR[x]}">${gi(`type.${x}`)} ${TYPE_PL[x]}</span>`).join(' ')} <b title="Atak">${IC.atk()} ${s.attack >= 0 ? '+' : ''}${s.attack}</b></div>
        ${hpSlots(hp, maxHp)}<div class="hp-num">${hp} / ${maxHp}</div>
        ${growth && mon.growth !== undefined ? growthRow(mon) : ''}
      </div>
      ${familyStrip(s.id, { current: mon.uid ? s.id : null, growth, config })}
    </div>`;
}

export function speciesCard(id, opts = {}) {
  const s = getSpecies(id);
  return pokemonCard({ species: id, hp: s.hp, maxHp: s.hp }, opts);
}

// Balls as the balls themselves (Build 2.4 — a red / blue dot said nothing to Piotr).
const rewardIcon = (type) => itemIc(type, 16);

export function rewardTokens(reward) {
  return reward.map((r) => `<span class="reward-token" title="${esc(thingPl(r.type === 'pokeballs' ? 'pokeball' : r.type, r.amount ?? 1))}">${rewardIcon(r.type)}${r.amount > 1 ? `×${r.amount}` : ''}</span>`).join('');
}

// An active mission (Phase 3A-2.5): a card to read, not a button — what to
// do, where (🎯 on the board), progress, reward, and the AKTYWNA status.
// `config`: the game's config — the reward shown is the one its rules pay
// (questRewards v1 / v2; Post-playtest Build 2, P0).
export function missionCard(instance, { actions = '', config = null } = {}) {
  if (!instance) return '<div class="mission-card empty">Wolne miejsce na misję<small>Nowe misje czekają w Poké Stopach.</small></div>';
  const q = questPl(instance.questId);
  const count = q.count ?? 1;
  const progress = Math.min(instance.progress ?? 0, count);
  const places = questLocations(instance).map((id) => getLocation(id).name);
  const where = places.length ? `<div class="m-row m-where"><small>Dokąd</small><span>${gi('target')} ${esc(places.join(' / '))}</span></div>` : '';
  return `
    <div class="mission-card active ${q.scope}">
      <span class="m-status">AKTYWNA</span>
      <div class="m-head"><span class="m-title">${esc(q.title)}</span></div>
      <div class="m-giver">od: ${esc(q.giver)}</div>
      <div class="m-row m-task"><small>Co zrobić</small><span>${esc(q.text)}</span></div>
      ${where}
      <div class="m-row m-progress" aria-label="Postęp ${progress} z ${count}"><small>Postęp</small><span class="m-dots">${Array.from({ length: count }, (_, i) => `<span class="${i < progress ? 'done' : ''}"></span>`).join('')}</span><b>${progress}/${count}</b></div>
      <div class="m-row m-reward"><small>Nagroda</small><span>${rewardTokens(config ? questReward(QUESTS_BY_ID[instance.questId], config) : q.reward)}</span></div>
      ${actions}
    </div>`;
}

// A mission in the player popup (Build 2.4): the title, what to do, the reward —
// nothing else (no status, no labels, no icon). Progress only when it counts more than one.
export function missionMini(instance, { config = null } = {}) {
  if (!instance) return '<div class="mission-mini empty">Wolne miejsce na misję</div>';
  const q = questPl(instance.questId);
  const count = q.count ?? 1;
  const progress = Math.min(instance.progress ?? 0, count);
  return `<div class="mission-mini ${q.scope}"><b>${esc(q.title)}</b><p>${esc(q.text)}</p><div class="mm-reward">${rewardTokens(config ? questReward(QUESTS_BY_ID[instance.questId], config) : q.reward)}${count > 1 ? `<span class="mm-progress">${progress}/${count}</span>` : ''}</div></div>`;
}

// Pokédex (Phase 3A-2.5): four states a child reads at a glance. A species
// both caught and evolved counts as caught.
export const DEX_STATES = [
  { id: 'unknown', label: '???', icon: gi('dex.unknown'), text: 'jeszcze nie spotkany' },
  { id: 'seen', label: 'WIDZIANY', icon: gi('dex.seen'), text: 'spotkany, jeszcze nie złapany' },
  { id: 'caught', label: 'ZŁAPANY', icon: gi('dex.caught'), text: 'złapany Poké Ballem' },
  { id: 'evolved', label: 'EWOLUOWANY', icon: gi('dex.evolved'), text: 'zdobyty przez ewolucję' },
];

export function dexState(player, speciesId) {
  const d = player.pokedex;
  if (d.caught.includes(speciesId)) return 'caught';
  if (d.evolved?.includes(speciesId)) return 'evolved';
  if (d.seen.includes(speciesId)) return 'seen';
  return 'unknown';
}

// One Pokédex tile: ??? shows only a silhouette and the number; a seen
// species is grey; caught / evolved in full colour. Known ones open the
// inspect view.
export function dexTile(player, speciesId) {
  const s = getSpecies(speciesId);
  const state = dexState(player, speciesId);
  const def = DEX_STATES.find((d) => d.id === state);
  const known = state !== 'unknown';
  const img = artImg(s, 'hero', 1);
  return `<div class="dex-tile ds-${state}"${known ? ` data-inspect-species="${esc(s.id)}"` : ''} title="${esc(known ? `${s.name} — ${def.text}` : def.text)}">
    <span class="dt-no">#${String(s.dex).padStart(3, '0')}</span>
    <span class="dt-art"${known ? ` style="background:${typeBackground(s)}"` : ''}>${known ? `<span class="art-icon">${gi(`type.${s.types[0]}`)}</span>` : '<span class="dt-q">?</span>'}${img}</span>
    <b class="dt-name">${known ? esc(s.name) : '???'}</b>
    <small class="dt-state">${def.icon} ${def.label}</small>
  </div>`;
}

// Bottom bar (Phase 3A-2.5): one small round portrait per team Pokémon with
// its HP bar; the lead is ringed, a fainted one greyed. Tapping opens the mat.
export function teamDot(mon, { lead = false } = {}) {
  const s = getSpecies(mon.species);
  const pct = Math.round((Math.max(0, mon.hp) / mon.maxHp) * 100);
  const zone = mon.hp <= 0 ? 'out' : currentZone(mon.hp, mon.maxHp);
  const img = artImg(s, 'portrait', 1);
  const shown = img && artLoaded(pokemonArtUrl(s));
  return `<span class="team-dot${lead ? ' lead' : ''}${mon.hp <= 0 ? ' fainted' : ''}" title="${esc(s.name)} HP ${mon.hp}/${mon.maxHp}">
    <span class="td-art${shown ? ' has-art' : ''}" style="background:${typeBackground(s)}"><span class="art-initial">${esc(s.name[0])}</span>${img}</span>
    <span class="td-hp z-${zone}"><i style="width:${pct}%"></i></span></span>`;
}

// Draggable ball token (Pointer Events in main.js); tap opens the same throw.
export function ballToken(option, { draggable = true } = {}) {
  const cls = ['ball-token', option.ball, option.usable ? '' : 'disabled', option.noBonus ? 'no-bonus' : ''].filter(Boolean).join(' ');
  return `<div class="${cls}"${option.usable && draggable ? ` data-drag-ball="${option.ball}"` : ''} title="${esc(option.note || option.name)}">
    ${option.ball === 'superball' ? superballSvg() : pokeballSvg(44)}<span class="count">×${option.count}</span></div>`;
}


export function starTokens(n, { fresh = 0 } = {}) {
  if (!n) return '<span class="muted">brak gwiazdek</span>';
  return Array.from({ length: n }, (_, i) => `<span class="star-token${i >= n - fresh ? ' fresh' : ''}">${IC.star()}</span>`).join('');
}

export function badgeCase(state, player, { fresh = null } = {}) {
  const slots = GYMS.map((g) => {
    const has = hasBadge(player, g.id);
    return `<span class="badge-slot${has ? ' earned' : ''}${fresh === g.id ? ' fresh' : ''}" title="${esc(`${g.badge} — ${g.leader}`)}">${has ? gi(`type.${g.type}`) : ''}</span>`;
  }).join('');
  const extra = `${player.league?.ribbon ? `<span class="ribbon" title="Wstęga Elitarnej Czwórki">${gi('ribbon')}</span>` : ''}${player.league?.champion ? `<span class="crown" title="Mistrz Ligi">${gi('champion')}</span>` : ''}`;
  return `<div class="badge-case">${slots}${extra}</div>`;
}

export function actButtonPl(action, label, { cls = '', disabled = false, title = '' } = {}) {
  return `<button class="${cls}" ${actAttr(action)}${disabled ? ' disabled' : ''}${title ? ` title="${esc(title)}"` : ''}>${label}</button>`;
}

// Item token art: SVG balls, emoji for the rest.
export function itemToken(id, size = 44) {
  if (id === 'pokeball' || id === 'pokeballs') return pokeballSvg(size);
  if (id === 'superball') return superballSvg(size);
  const icon = itemIc(id);
  return `<span class="emoji-token" style="font-size:${Math.round(size * 0.8)}px">${icon}</span>`;
}

// The active Team Rocket plot card: what it does, where, loot on it, reward.
export function rocketPlotCard(state, { size = 'm', fresh = null } = {}) {
  const active = state.rocket?.active;
  if (!active) return '';
  const card = plotPl(active.plotId);
  const route = card.movement?.route;
  const routeHtml = route ? `<div class="plot-route">${route.map((id, i) => `<span class="${i === active.step ? 'here' : i < active.step ? 'past' : ''}">${esc(getLocation(id).name)}</span>`).join(`<b>${IC.arrow()}</b>`)}</div>` : '';
  const loot = active.loot.length
    ? active.loot.map((entry, i) => {
      const owner = state.players.find((p) => p.id === entry.owner);
      return `<span class="loot-token${fresh === i ? ' fresh' : ''}" style="--pc:${owner.color}" title="${esc(`${owner.name}: ${thingPl(entry.item, entry.amount)}`)}">${itemToken(entry.item, 26)}<small>${esc(owner.name[0])}</small></span>`;
    }).join('')
    : '<span class="muted small">pusto</span>';
  return `
    <div class="plot-card size-${size}">
      <div class="plot-head"><span class="plot-icon">${gi('rocket')}</span><div><div class="plot-tag">Spisek Team Rocket${card.meowth ? ` · ${gi('meowth')} z Meowthem` : ''}</div><h3>${esc(card.title)}</h3></div></div>
      <div class="plot-where">${IC.pin()} ${esc(getLocation(active.location).name)}</div>
      ${routeHtml}
      <p class="plot-flavor">${esc(card.flavor)}</p>
      <p class="plot-text">${esc(card.text)}</p>
      <div class="plot-loot"><b>Łupy Meowtha:</b> ${loot}</div>
      <div class="plot-reward"><b>Nagroda za pokonanie:</b> ${esc(rewardPl(card.reward))} <small>(+ łupy wracają do właścicieli)</small></div>
    </div>`;
}

// A trainer's small portrait (Build 2.3, 56 px): the picture over the class icon,
// which shows whenever there is no picture (no mapping, 404, offline).
export function trainerPortrait(who, icon) {
  const url = trainerArtUrl(who);
  const img = url ? `<img class="art tr-art" src="${esc(url)}" alt="" loading="lazy" decoding="async" crossorigin="anonymous" referrerpolicy="no-referrer" draggable="false">` : '';
  return `<span class="tr-portrait${url && artLoaded(url) ? ' has-art' : ''}"><span class="art-icon">${icon}</span>${img}</span>`;
}

export function trainerBadge(trainer) {
  const t = trainerPl(trainer);
  const d = DIFFICULTY_PL[trainer.difficulty] ?? { name: trainer.difficulty, stars: '' };
  return `<div class="trainer-card">${trainerPortrait({ archetype: trainer.archetype }, gi('trainer'))}<div><div class="plot-tag">Trener</div><h3>${esc(t.name)}</h3><div class="trainer-diff">${iconText(d.stars)} ${d.name} · nagroda ${IC.coin()}${trainer.reward}</div></div></div>`;
}
