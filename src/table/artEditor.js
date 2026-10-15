// In-game portrait crop editor (Phase 3A-1.5). During a normal game, the ✏️ on
// a card opens this editor: drag the picture with a finger or the mouse, zoom
// with the slider, two fingers or the mouse wheel, then Save — the crop is
// stored per species (art.js, localStorage 'pokemon.artFocus.v1') and every
// picture of that species on the table updates at once. Reset goes back to the
// crop from the code. Copy puts every saved crop on the clipboard, ready to
// paste into ART_FOCUS / ROW_FOCUS. Visual only: never touches the game or its save.
//
// Up to three crops per species: „Karta” — the single-picture cards (battle,
// detail) and tokens; „Karta drużyny” (Piotr 12.10.2026) — the big picture on
// the Pokémon's own family card, over the strips of its future forms, a frame
// of its own shape (until set, it is the card crop); „Pasek ewolucji” — the
// thin strip of a future form under an earlier one's card (Build 2.4). The ✏️
// on a part of a card opens that part's tab; a tab switch changes which crop
// is edited.
import { getSpecies } from '../data/pokemon.js';
import { esc } from '../ui/dom.js';
import { gi } from './icons.js';
import { CARD_STYLE, STRIP_ASPECT, familyTopAspect, futureForms, typeBackground } from './cards.js';
import {
  SCALE_RANGE, artFocus, artFocusSource, clearArtOverride, codeFocus, overridesSnippet, panFocus,
  pokemonArtUrl, setArtOverride, styleFor, zoomFocus,
} from './art.js';

// The big frame has the shape being edited; the previews show where that crop
// is used, with the name and HP strips drawn on top (a face hidden under them
// shows here before it is saved).
const SHAPES = {
  card: {
    tab: 'Karta', edit: 0.75, height: 'min(300px, 38vh)',
    previews: [
      { label: 'karta walki', aspect: 0.75, width: 96, strips: true },
      { label: 'żeton', aspect: 1, width: 52, round: true },
    ],
  },
  top: {
    tab: 'Karta drużyny', edit: 'top', height: 'min(260px, 34vh)',
    previews: [{ label: 'karta w drużynie (nad paskami ewolucji)', aspect: 'top', width: 150, strips: true }],
  },
  row: {
    tab: 'Pasek ewolucji', edit: STRIP_ASPECT, height: 'min(170px, 24vh)',
    previews: [{ label: 'pasek pod kartą', aspect: STRIP_ASPECT, width: 200, strips: 'top' }],
  },
};
// The classic cards (?hud=legacy) only have the card crop, in the old 2 : 1 frame.
const LEGACY = { tab: 'Kadr', edit: 2, height: 'auto', previews: [{ label: 'mały wiersz', aspect: 4, width: 150 }, { label: 'pasek rodziny', aspect: 1.5, width: 150 }] };
const SOURCE_PL = { saved: 'twój zapisany kadr', own: 'kadr z ilustracji (Studio)', code: 'kadr domyślny z gry', default: 'kadr ogólny', preview: 'podgląd Studio', card: 'z kadru karty (nieustawiony osobno)' };

export function createArtEditor(dialog, { onChange, toast }) {
  let species = null;
  let shape = 'card';
  let focus = null;
  const pointers = new Map();
  let pinch = null;
  const spec = () => (CARD_STYLE.fullArt ? SHAPES[shape] : LEGACY);
  // 'top': the family card's big picture — its frame depends on how many strips sit under it
  const sized = (a) => (a === 'top' ? familyTopAspect(species) : a);
  const aspect = () => sized(spec().edit);
  // The crops this species shows: the card; its family card's big picture (it evolves); a strip (it is an evolved form).
  const shapesOf = (id) => ['card', ...(futureForms(id).length ? ['top'] : []), ...(getSpecies(id).stage > 1 ? ['row'] : [])];

  const frame = (asp, cls, { width = null, strips = false, round = false, height = null } = {}) => {
    const s = getSpecies(species);
    const url = pokemonArtUrl(s);
    const top = strips ? `<div class="ae-strip top"><b>${esc(s.name)}</b><i>${gi('star')} 2/4</i></div>` : '';
    const bottom = strips === true ? `<div class="ae-strip bottom">${gi('hp').repeat(3)}${gi('hp.empty')}</div>` : '';
    const size = height ? `;height:${height};width:auto;max-width:100%` : width ? `;width:${width}px` : '';
    return `<div class="ae-frame ${cls}${round ? ' round' : ''}" style="aspect-ratio:${asp};background:${typeBackground(s)}${size}" data-aspect="${asp}">
      <span class="art-icon">${gi(`type.${s.types[0]}`)}</span>${url ? `<img class="art art-portrait" src="${esc(url)}" alt="" draggable="false" crossorigin="anonymous" referrerpolicy="no-referrer">` : ''}${top}${bottom}</div>`;
  };

  function paint() {
    for (const el of dialog.querySelectorAll('.ae-frame img.art')) el.setAttribute('style', styleFor(focus, Number(el.parentElement.dataset.aspect)));
    dialog.querySelector('[name="ae-zoom"]').value = String(focus.scale);
    dialog.querySelector('.ae-zoom-value').textContent = `${focus.scale.toFixed(2)}×`;
    const current = artFocus(species, shape);
    const edited = ['x', 'y', 'scale'].some((k) => current[k] !== focus[k]);
    dialog.querySelector('.ae-source').textContent = `Teraz: ${SOURCE_PL[artFocusSource(species, shape)]}${edited ? ' · zmiany niezapisane' : ''}`;
  }

  function render() {
    const s = getSpecies(species);
    const online = Boolean(pokemonArtUrl(s));
    const tabs = CARD_STYLE.fullArt && shapesOf(species).length > 1
      ? `<div class="ae-tabs" role="tablist">${shapesOf(species).map((id) => `<button role="tab" class="ae-tab${id === shape ? ' on' : ''}" data-ae-shape="${id}" aria-selected="${id === shape}">${SHAPES[id].tab}</button>`).join('')}</div>`
      : '';
    dialog.innerHTML = `
      <h2>${gi('edit')} Kadr: ${esc(s.name)}</h2>
      ${tabs}
      <p class="small muted">Przeciągnij obraz palcem lub myszką. Zoom: suwak, dwa palce albo kółko myszy.${tabs ? ' Każda zakładka to osobny kadr.' : ''}</p>
      <div class="ae-main-wrap">${frame(aspect(), 'ae-main', { height: spec().height })}</div>
      <div class="ae-previews">${spec().previews.map((p) => `<div class="ae-preview">${frame(sized(p.aspect), 'ae-small', p)}<small>${p.label}</small></div>`).join('')}</div>
      ${online ? '' : '<p class="note">Grafika jest teraz niedostępna (offline?). Kadr możesz zapisać — zadziała, gdy obraz wróci.</p>'}
      <label class="ae-zoom">Zoom <input type="range" name="ae-zoom" min="${SCALE_RANGE[0]}" max="${SCALE_RANGE[1]}" step="0.05"> <b class="ae-zoom-value"></b></label>
      <p class="small ae-source"></p>
      <div class="row wrap end">
        <button data-ae="copy" class="ghost">Kopiuj ustawienia</button>
        <button data-ae="reset">Reset</button>
        <button data-ae="cancel">Anuluj</button>
        <button data-ae="save" class="primary">Zapisz</button>
      </div>`;
    paint();
  }

  function open(speciesId, which = 'card') {
    species = speciesId;
    shape = CARD_STYLE.fullArt && shapesOf(speciesId).includes(which) ? which : 'card';
    focus = { ...artFocus(speciesId, shape) };
    pointers.clear();
    pinch = null;
    render();
    if (!dialog.open) dialog.showModal();
  }

  // ---- gestures on the big frame ------------------------------------------------------
  const main = () => dialog.querySelector('.ae-main');
  dialog.addEventListener('pointerdown', (e) => {
    if (!e.target.closest('.ae-main')) return;
    e.preventDefault();
    main().setPointerCapture?.(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y), scale: focus.scale };
    }
  });
  dialog.addEventListener('pointermove', (e) => {
    const last = pointers.get(e.pointerId);
    if (!last) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2 && pinch) {
      const [a, b] = [...pointers.values()];
      focus = zoomFocus(focus, (pinch.scale * Math.hypot(a.x - b.x, a.y - b.y)) / Math.max(1, pinch.dist), aspect());
    } else if (pointers.size === 1) {
      focus = panFocus(focus, e.clientX - last.x, e.clientY - last.y, main().getBoundingClientRect().width, aspect());
    }
    paint();
  });
  const release = (e) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
  };
  dialog.addEventListener('pointerup', release);
  dialog.addEventListener('pointercancel', release);
  dialog.addEventListener('wheel', (e) => {
    if (!e.target.closest('.ae-main')) return;
    e.preventDefault();
    focus = zoomFocus(focus, focus.scale * Math.exp(-e.deltaY * 0.0015), aspect());
    paint();
  }, { passive: false });
  dialog.addEventListener('input', (e) => {
    if (e.target.name !== 'ae-zoom') return;
    focus = zoomFocus(focus, Number(e.target.value), aspect());
    paint();
  });

  // ---- buttons ---------------------------------------------------------------------------
  dialog.addEventListener('click', async (e) => {
    const tab = e.target.closest('[data-ae-shape]')?.dataset.aeShape;
    if (tab && tab !== shape) {
      shape = tab;
      focus = { ...artFocus(species, shape) };
      render();
      return;
    }
    const cmd = e.target.closest('[data-ae]')?.dataset.ae;
    if (cmd === 'save') {
      const stored = setArtOverride(species, focus, shape);
      dialog.close();
      onChange(species);
      toast(stored ? `Zapisano kadr: ${getSpecies(species).name}${shape === 'row' ? ' (pasek)' : shape === 'top' ? ' (karta drużyny)' : ''}.` : 'Kadr działa w tej sesji, ale nie udało się go zapisać w przeglądarce.');
    } else if (cmd === 'cancel') {
      dialog.close();
    } else if (cmd === 'reset') {
      clearArtOverride(species, shape);
      focus = { ...codeFocus(species, shape) };
      paint();
      onChange(species);
      toast(`Przywrócono kadr domyślny: ${getSpecies(species).name}${shape === 'row' ? ' (pasek)' : shape === 'top' ? ' (karta drużyny)' : ''}.`);
    } else if (cmd === 'copy') {
      const text = `// ${new Date().toLocaleString('pl-PL')} — zapisane kadry (pokemon.artFocus.v1), do wklejenia w ART_FOCUS / ROW_FOCUS:\n${overridesSnippet() || '// (brak zapisanych kadrów)'}`;
      try {
        await navigator.clipboard.writeText(text);
        toast('Skopiowano ustawienia kadrów.');
      } catch {
        window.prompt('Skopiuj ustawienia kadrów:', text);
      }
    }
  });

  return { open };
}
