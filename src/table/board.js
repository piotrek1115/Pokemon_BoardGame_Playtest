// The digital Kanto board: art + graph, pawns that glide between places,
// Poké Stop / gym / League / Team Rocket markers, legal destinations glowing.
// Tap a glowing place to move; tap a closed neighbour to hear why. Movement
// legality always comes from the engine; coordinates are presentation only.
import { getLocation, hasFeature, isLocationEnabled, topologyLocations } from '../data/locations.js';
import { MAP_LAYOUT } from '../data/mapLayout.js';
import { gymInCity } from '../data/gyms.js';
import { CAPABILITIES, CROSS_MAP_SHORTCUTS } from '../data/travelConnections.js';
import { getLegalActions } from '../engine/turnEngine.js';
import { currentPlayer } from '../engine/gameState.js';
import { edgeKey, networkEdgeList } from '../engine/travelEngine.js';
import { activePlot, challengeLocations, plotCard } from '../engine/rocketEngine.js';
import { closedNeighbors, worldBlocks } from '../engine/graphEngine.js';
import { gymsEnabled, hasBadge } from '../engine/gymEngine.js';
import { questLocations } from '../engine/questEngine.js';
import { hasPokeStop } from '../engine/pokeStopEngine.js';
import { placeFatigue } from '../engine/fatigueEngine.js';
import { rumourList } from '../engine/rumourEngine.js';
import { pawnSvg } from './tokens.js';
import { patchKeyed, setHtml } from './patch.js';

// SVG markup parsed in an <svg> (the board's places and roads are SVG elements).
const svgBox = (html) => {
  const box = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  box.innerHTML = html;
  return box;
};
import { esc } from '../ui/dom.js';
import { placeName, plotPl } from './content-pl.js';
import { gi } from './icons.js';

// A game icon placed in the map's SVG, centred on (x, y).
const mapIcon = (key, x, y, size) => gi(key, { size }).replace('<svg ', `<svg x="${x - size / 2}" y="${y - size / 2}" `);

const W = 1000;
// The family table plays on the hand-made Kanto board art only (Playtest Build
// 2 release gate). The schematic grid is a harness / debug view: no silent
// fallback here — without the art the board says so (BRAK GRAFIKI PLANSZY).
export const BOARD_ART = 'assets/boards/kanto-board.jpg';
const DEFAULT_ASPECT = 5000 / 3453;
const NEEDS_PL = { canTravelWater: 'Soul Badge (pływanie)', canClimbMountain: 'wspinaczki', canEnterCave: 'wejścia do jaskini', canFly: 'latania' };

// 3A-5 (DQ-85): the Underground Paths are not on the board art, so the overlay
// draws them — a dashed tunnel bowing around Saffron City. `bend`: how far the
// curve leaves the straight line, as a share of its length (+ = to the right of
// a → b as seen on the screen); `at`: where along it (0 = a, 1 = b) the tunnel
// icon and, while it is a move choice, its words sit — clear of other places.
// (11.10: Piotr's new layout moved Route 6 west, so Route 5 ↔ 6 bows west of Saffron.)
export const TUNNELS = { 'route-5|route-6': { bend: 0.2, at: 0.6 }, 'route-7|route-8': { bend: -0.08, at: 0.75 } };
const SHORTCUT_PLACES = new Set(CROSS_MAP_SHORTCUTS.map((s) => s.location));
// DQ-96 board: the Diglett's Cave shortcut crosses the whole map, and a
// straight line would run right over Route 7, so it swings south of it. Two
// control points [t, o] keyed like edgeKey (a = the first id): t along a → b
// (0…1), o off the straight line as a share of its length (+ = to the right of
// a → b on the screen, as TUNNELS' bend). Clear of every other place.
export const SHORTCUT_CURVES = { 'digletts-cave|route-11': [[0.35, 0.2], [0.4, 0.04]] };

// Family words for a travel edge (move choices, tunnel tags, taps).
export function travelLabelPl(meta) {
  if (meta.kind !== 'underground') return null;
  const actions = meta.actionCost === 1 ? '1 akcja' : `${meta.actionCost} akcje`;
  return { title: 'PODZIEMNE PRZEJŚCIE', cost: actions, text: `PODZIEMNE PRZEJŚCIE · ${actions.toUpperCase()}` };
}

// A move choice in family words: „Route 6 · PODZIEMNE PRZEJŚCIE · 1 akcja”, or
// just the place for an ordinary road.
export function moveChoicePl(state, from, to) {
  const tunnel = networkEdgeList(state.config).find((e) => edgeKey(e.a, e.b) === edgeKey(from, to) && e.meta.kind === 'underground');
  const name = placeName(to);
  if (!tunnel) return name;
  const label = travelLabelPl(tunnel.meta);
  return `${name} · ${label.title} · ${label.cost}`;
}

// A quadratic curve from a to b: its path, a point on it (`at`, t = 0…1; its
// middle is where it bends most) and the side it bows to (`out`).
export function tunnelCurve(a, b, bend) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const c = { x: (a.x + b.x) / 2 + 2 * nx * bend * len, y: (a.y + b.y) / 2 + 2 * ny * bend * len };
  const at = (t) => ({ x: (1 - t) ** 2 * a.x + 2 * (1 - t) * t * c.x + t ** 2 * b.x, y: (1 - t) ** 2 * a.y + 2 * (1 - t) * t * c.y + t ** 2 * b.y });
  const r = (v) => Math.round(v * 10) / 10;
  return { d: `M${r(a.x)} ${r(a.y)} Q${r(c.x)} ${r(c.y)} ${r(b.x)} ${r(b.y)}`, at, out: { x: Math.sign(bend) * nx, y: Math.sign(bend) * ny } };
}

// A cubic curve from a to b through two control points [t, o] (see SHORTCUT_CURVES).
export function shortcutCurve(a, b, [[t1, o1], [t2, o2]]) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const c = (t, o) => ({ x: a.x + t * dx + o * len * nx, y: a.y + t * dy + o * len * ny });
  const r = (v) => Math.round(v * 10) / 10;
  const [c1, c2] = [c(t1, o1), c(t2, o2)];
  return `M${r(a.x)} ${r(a.y)} C${r(c1.x)} ${r(c1.y)} ${r(c2.x)} ${r(c2.y)} ${r(b.x)} ${r(b.y)}`;
}

function readOverrides() {
  try {
    return JSON.parse(localStorage.getItem('kanto.layoutOverrides.v1')) ?? {};
  } catch {
    return {};
  }
}

// Why a neighbour can't be entered, in family language.
// Where „Wyzwij Team Rocket” works, in family words: a closed place is left
// out (nobody can enter it) unless the player stands inside.
export function rocketPlacesPl(state, player) {
  const closed = worldBlocks(state)?.locations ?? [];
  return challengeLocations(state).filter((id) => !closed.includes(id) || id === player.location).map(placeName).join(' albo ');
}

export function blockedReason(state, player, to) {
  const b = closedNeighbors(state, player).find((x) => x.to === to); // the one effective graph
  if (!b) return null;
  if (b.rocket) return `🎈 Team Rocket zamknął drogę: ${plotPl(activePlot(state).plotId).title}`;
  const needs = b.missing.map((c) => NEEDS_PL[c] ?? CAPABILITIES[c]?.name ?? c).join(' + ');
  return `${b.missing.map((c) => CAPABILITIES[c]?.icon ?? '').join('')} Ta droga wymaga: ${needs}.`;
}

export class BoardView {
  constructor(root, { onMove, onInfo, onRocket = null }) {
    this.root = root;
    this.onMove = onMove;
    this.onInfo = onInfo;
    this.onRocket = onRocket;
    this.state = null;
    this.aspect = DEFAULT_ASPECT;
    this.overrides = readOverrides();
    root.dataset.boardArt = 'loading';
    // Build 3.2 hotfix (a walking pawn lost frames on the tablet): the board art is an
    // <img> on its own layer under the SVG, fitted exactly as the SVG's viewBox is
    // (object-fit: contain = xMidYMid meet, the same aspect), so the pawn's animation
    // repaints only the light SVG, never the 2400 px picture. The SVG <image> keeps
    // the address (the release checks read it) but is not painted.
    root.innerHTML = `<img class="board-art-img" alt="" draggable="false" decoding="async" hidden>
      <svg class="board-svg" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
      <image class="board-art" x="0" y="0" width="${W}"/>
      <g class="b-edges"></g><g class="b-nodes"></g><g class="b-rocket"></g><g class="b-pawns"></g></svg>
      <div class="board-missing" role="alert" hidden>
        <b>BRAK GRAFIKI PLANSZY</b>
        <p>Nie udało się wczytać mapy Kanto (<code>${BOARD_ART}</code>). Ta wersja gry nie ma planszy — gra na schemacie jest wyłączona.</p>
        <p class="small">Jeśli tablet jest offline: połącz go z internetem i odśwież stronę. Jeśli to nowa wersja: zbuduj ją z grafiką planszy (<code>npm run build:tablet</code>).</p>
      </div>`;
    this.svg = root.querySelector('svg');
    this.image = root.querySelector('.board-art');
    this.layer = root.querySelector('.board-art-img');
    this.loadArt();
    this.svg.addEventListener('click', (e) => {
      const node = e.target.closest('[data-node]');
      if (node) this.tap(node.dataset.node);
      else if (e.target.closest('[data-tunnel]')) this.tapTunnel(e.target.closest('[data-tunnel]').dataset.tunnel);
    });
  }

  loadArt() {
    const img = new Image();
    img.onload = () => {
      this.aspect = img.naturalWidth / img.naturalHeight || DEFAULT_ASPECT;
      this.image.setAttribute('href', BOARD_ART);
      this.layer.src = BOARD_ART;
      this.layer.hidden = false;
      this.root.dataset.boardArt = 'ok';
      // Absolute: a relative url() in a custom property resolves against the stylesheet.
      this.root.style.setProperty('--board-art', `url("${new URL(BOARD_ART, document.baseURI).href}")`);
      this.render();
    };
    img.onerror = () => {
      this.root.dataset.boardArt = 'missing';
      this.svg.style.display = 'none';
      this.root.querySelector('.board-missing').hidden = false;
    };
    img.src = BOARD_ART;
  }

  // A place of an older board without a marker of its own is drawn where the
  // board has it (kanto43's Route 10 / Rock Tunnel at Rock Tunnel — `drawnAt`).
  pos(id) {
    const p = this.overrides[id] ?? MAP_LAYOUT.positions[id] ?? MAP_LAYOUT.positions[getLocation(id).drawnAt];
    return { x: p.x * W, y: (p.y * W) / this.aspect };
  }

  tap(id) {
    const state = this.state;
    if (!state) return;
    const player = currentPlayer(state);
    const legal = this.legalTargets();
    const loc = getLocation(id);
    if (legal.has(id)) {
      const via = moveChoicePl(state, player.location, id);
      if (via !== placeName(id)) this.onInfo(via); // through an Underground Path: say so
      this.onMove(id);
      return;
    }
    if (player.controller !== 'human' || state.phase !== 'turn') {
      this.onInfo(placeName(id));
      return;
    }
    if (id === player.location) {
      this.onInfo(`Tu jesteś: ${placeName(id)}`);
      return;
    }
    // Macro 01 (family playtest: Diglett's Cave closed by Rocket, the challenge
    // not found): a tap on Team Rocket's place opens its card with „Wyzwij” when
    // the challenge is possible here, else says where it is possible.
    const active = activePlot(state);
    if (active?.location === id) {
      if (this.onRocket && getLegalActions(state).some((a) => a.type === 'challengeRocket')) {
        this.onRocket();
        return;
      }
      const here = challengeLocations(state).includes(player.location);
      const why = !here ? '' : player.team.every((m) => m.hp === 0) ? ' Najpierw wylecz drużynę.' : state.turn.actionsRemaining <= 0 ? ' Brak akcji w tej turze.' : '';
      this.onInfo(`🎈 ${plotPl(active.plotId).title} — wyzwij Team Rocket z: ${rocketPlacesPl(state, player)}.${why}`);
      return;
    }
    const why = blockedReason(state, player, id);
    if (why) this.onInfo(why);
    else if (state.turn.actionsRemaining <= 0) this.onInfo('Brak akcji — zakończ turę.');
    else this.onInfo(`${placeName(id)} — za daleko. Idziesz tylko do sąsiedniego miejsca.`);
  }

  // Macro 02 M02-1 (the Pokédex's „Gdzie szukać”): show a place — a pulsing
  // ring and its name for a few seconds. Nothing else: no move, no action, the
  // game state is never touched.
  locate(id) {
    this.located = id;
    clearTimeout(this.locateTimer);
    this.root.querySelector('.node.located')?.classList.remove('located');
    this.root.querySelector(`[data-node="${id}"]`)?.classList.add('located');
    this.locateTimer = setTimeout(() => {
      this.located = null;
      this.root.querySelector('.node.located')?.classList.remove('located');
    }, 5000);
  }

  // A tap on a tunnel tells where it goes; moving is still a tap on the place.
  tapTunnel(key) {
    const [a, b] = key.split('|').map((id) => getLocation(id).name);
    const tunnel = networkEdgeList(this.state.config).find((e) => edgeKey(e.a, e.b) === key);
    this.onInfo(`Podziemne przejście: ${a} ↔ ${b} · ${travelLabelPl(tunnel.meta).cost}, bez opłat.`);
  }

  legalTargets() {
    const state = this.state;
    const player = currentPlayer(state);
    const humanTurn = player.controller === 'human' && state.phase === 'turn' && this.interactive;
    return new Set(humanTurn ? getLegalActions(state).filter((a) => a.type === 'move').map((a) => a.to) : []);
  }

  render(state = this.state, { interactive = true } = {}) {
    this.state = state;
    this.interactive = interactive;
    if (!state) return;
    const H = W / this.aspect;
    this.svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    this.image.setAttribute('height', H);
    const cfg = state.config;
    const player = currentPlayer(state);
    const legal = this.legalTargets();
    const water = Boolean(player.capabilities?.canTravelWater);
    const enabled = topologyLocations(cfg).filter((l) => isLocationEnabled(l.id, cfg));
    const blocks = worldBlocks(state); // the one effective graph's closures
    const closed = new Set(blocks?.locations ?? []);
    const targets = new Set((player.quests ?? []).flatMap((q) => questLocations(q)));
    const rumours = new Set(rumourList(state, player).filter((r) => r.status === 'go').map((r) => r.start)); // PLAYTEST_006 C5: where a heard rumour is taken

    // One graph: the game's travel network (canonical roads + its shortcuts).
    const edges = [];
    const tunnels = [];
    for (const { a: from, b: to, meta } of networkEdgeList(cfg)) {
      const a = this.pos(from);
      const b = this.pos(to);
      const active = (from === player.location && legal.has(to)) || (to === player.location && legal.has(from));
      if (meta.kind === 'underground') {
        tunnels.push(this.tunnel(from, to, meta, active));
        continue;
      }
      const isWater = meta.requires.includes('canTravelWater');
      const shortcut = SHORTCUT_PLACES.has(from) || SHORTCUT_PLACES.has(to);
      const cls = ['edge', meta.traversal, isWater ? (water ? 'water-open' : 'water-locked') : '', shortcut ? 'shortcut' : '', active ? 'active' : ''].filter(Boolean).join(' ');
      const curve = shortcut && SHORTCUT_CURVES[edgeKey(from, to)];
      const [p, q] = from < to ? [a, b] : [b, a];
      edges.push(curve ? `<path class="${cls}" d="${shortcutCurve(p, q, curve)}"/>` : `<line class="${cls}" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"/>`);
    }
    edges.push(...tunnels);

    const nodes = enabled.map((loc) => {
      const { x, y } = this.pos(loc.id);
      const big = loc.type === 'city' || loc.type === 'town';
      const r = big ? 13 : loc.type === 'special' ? 10 : 8;
      const cls = ['node', loc.type, legal.has(loc.id) ? 'legal' : '', loc.id === player.location ? 'current' : '', closed.has(loc.id) ? 'closed' : '', loc.id === this.located ? 'located' : ''].filter(Boolean).join(' ');
      const shape = loc.type === 'special' ? `<rect class="shape" x="${-r}" y="${-r}" width="${2 * r}" height="${2 * r}" rx="3" transform="rotate(45)"/>` : `<circle class="shape" r="${r}"/>`;
      const halo = legal.has(loc.id) ? `<circle class="halo" r="${r + 12}"/>` : '';
      const ring = `<circle class="locate-ring" r="${r + 16}"/>`; // shown only while the place is located
      const stop = hasPokeStop(loc.id, cfg) ? `<g class="stop-mark" transform="translate(${r + 2} ${-r - 2})"><circle r="9"/><text dy="4">P</text></g>` : '';
      const gym = gymsEnabled(state) ? gymInCity(loc.id) : null;
      const gymMark = gym ? `<g class="gym-mark${hasBadge(player, gym.id) ? ' earned' : ''}" transform="translate(${-r - 4} ${r + 3})"><circle r="11"/>${mapIcon(`type.${gym.type}`, 0, 0, 14)}</g>` : '';
      const league = gymsEnabled(state) && hasFeature(loc.id, 'league') ? `<g class="league-mark">${mapIcon('league', -r - 10, r + 6, 14)}</g>` : '';
      const flag = targets.has(loc.id) ? `<g class="target-mark">${mapIcon('target', r - 2, r + 10, 14)}</g>` : '';
      const rumour = rumours.has(loc.id) ? `<g class="rumour-mark" transform="translate(${-r - 8} ${-r - 6})"><circle r="12"/>${mapIcon('missions', 0, 0, 16)}</g>` : ''; // top-left: clear of the Poké Stop „P”
      // M02-2: a place this player has searched — 1 footprint tired, 2 exhausted (no numbers).
      // On the left of the place: clear of the pawns (above it), the gym mark and the name (below).
      const lvl = placeFatigue(player, loc.id, cfg);
      const tired = lvl ? `<g class="tired-mark lvl-${lvl}" transform="translate(${-r - 15} 0)"><rect x="${-10 - (lvl - 1) * 16}" y="-10" width="${20 + (lvl - 1) * 16}" height="20" rx="10"/>${lvl === 1 ? mapIcon('fatigue', 0, 0, 14) : mapIcon('fatigue', -16, 0, 14) + mapIcon('fatigue', 0, 0, 14)}</g>` : '';
      // DQ-96: a merged place is one marker with both names, on two lines. The
      // line offsets are in em so a bigger name (Ustawienia → Mapa) moves down
      // with its size (at the default size: 20 below the marker, 15 between lines).
      // Any other route has its name too, shown only when the settings ask for it.
      const label = loc.subtitle
        ? `<text class="label merged" y="${r}" dy="1.54em">${esc(loc.name)}<tspan class="sub" x="0" dy="1.364em">${esc(loc.subtitle)}</tspan></text>`
        : big || loc.type === 'special' ? `<text class="label${big ? ' big' : ''}" y="${r}" dy="${big ? '1.333em' : '1.54em'}">${esc(loc.name)}</text>`
          : `<text class="label plain" y="${r}" dy="1.54em">${esc(loc.name)}</text>`;
      // 3A-5: a cross-map shortcut place says so (Diglett's Cave).
      const shortcut = SHORTCUT_PLACES.has(loc.id) ? `<g class="shortcut-mark" transform="translate(0 ${-r - 14})">${mapIcon('travel.shortcut', -30, 0, 14)}<text x="-20" dy="4">SKRÓT</text></g>` : '';
      return `<g class="${cls}" data-node="${loc.id}" transform="translate(${x} ${y})"><circle class="hit" r="26"/>${ring}${halo}${shape}${stop}${gymMark}${league}${flag}${rumour}${tired}${label}${shortcut}</g>`;
    });
    // Build 3.2 hotfix: the roads are written only when they changed, the places one by one
    // (patch.js) — a walking pawn no longer rebuilds the whole board.
    setHtml(this.root.querySelector('.b-edges'), edges.join(''));
    patchKeyed(this.root.querySelector('.b-nodes'), nodes.map((html, i) => ({ key: enabled[i].id, html })), 'data-node', svgBox);

    this.renderRocket(state);
    this.renderPawns(state, player);
  }

  // An Underground Path: a dashed tunnel with its icon; while it is a move
  // choice it glows and says what it is and where it goes.
  tunnel(from, to, meta, active) {
    const key = edgeKey(from, to);
    const shape = TUNNELS[key] ?? { bend: 0.2, at: 0.5 };
    const { d, at, out } = tunnelCurve(this.pos(from), this.pos(to), shape.bend);
    const mark = at(shape.at);
    const label = travelLabelPl(meta);
    let tag = '';
    if (active) {
      const dest = getLocation(currentPlayer(this.state).location === from ? to : from).name;
      const anchor = out.x > 0.4 ? 'start' : out.x < -0.4 ? 'end' : 'middle';
      const tx = mark.x + out.x * 22;
      const ty = mark.y + out.y * 22 + (anchor === 'middle' && out.y < 0 ? -14 : 0);
      tag = `<text class="tunnel-tag" text-anchor="${anchor}" x="${tx}" y="${ty}"><tspan x="${tx}">${esc(label.title)}</tspan><tspan class="sub" x="${tx}" dy="15">→ ${esc(dest)} · ${esc(label.cost)}</tspan></text>`;
    }
    return `<g class="tunnel${active ? ' active' : ''}" data-tunnel="${key}"><title>${esc(label.text)}</title><path class="tunnel-casing" d="${d}"/><path class="tunnel-line" d="${d}"/>`
      + `<g class="tunnel-mark" transform="translate(${mark.x} ${mark.y})"><circle r="13"/>${mapIcon('travel.underground', 0, 0, 16)}</g>${tag}</g>`;
  }

  // The balloon persists between renders so a roaming plot visibly drifts;
  // a roaming card also shows the rest of its route.
  renderRocket(state) {
    const layer = this.root.querySelector('.b-rocket');
    const plot = activePlot(state);
    let route = layer.querySelector('.rocket-route');
    let balloon = layer.querySelector('.rocket-mark');
    if (!plot) {
      layer.innerHTML = '';
      return;
    }
    const steps = plotCard(plot).movement?.route.slice(plot.step) ?? [];
    if (!route) {
      route = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
      route.classList.add('rocket-route');
      layer.append(route);
    }
    route.setAttribute('points', steps.length > 1 ? steps.map((id) => { const p = this.pos(id); return `${p.x},${p.y}`; }).join(' ') : '');
    const { x, y } = this.pos(plot.location);
    if (!balloon || balloon.dataset.plot !== plot.plotId) {
      balloon?.remove();
      balloon = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      balloon.classList.add('rocket-mark');
      balloon.dataset.plot = plot.plotId;
      balloon.innerHTML = '<g class="balloon-body"><path class="balloon-string" d="M0 1q-4 6 0 12"/><ellipse class="balloon" cx="0" cy="-15" rx="14" ry="16"/><circle cx="0" cy="-16" r="9"/><text class="r" y="-11">R</text></g>';
      balloon.style.transform = `translate(${x + 22}px, ${y - 26}px)`;
      layer.append(balloon);
    }
    balloon.style.transform = `translate(${x + 22}px, ${y - 26}px)`;
  }

  // Pawns persist between renders so a move glides (CSS transition).
  renderPawns(state, player) {
    const layer = this.root.querySelector('.b-pawns');
    const byLoc = {};
    for (const p of state.players) (byLoc[p.location] ??= []).push(p);
    const seen = new Set();
    for (const [locId, ps] of Object.entries(byLoc)) {
      const { x, y } = this.pos(locId);
      ps.forEach((p, i) => {
        const angle = ((-120 + i * 80) * Math.PI) / 180;
        // 25: the portrait pawns (r 15 + edge) side by side without overlapping
        const tx = x + Math.cos(angle) * 25;
        const ty = y + Math.sin(angle) * 25;
        let g = layer.querySelector(`[data-pawn="${p.id}"]`);
        if (!g) {
          g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
          g.dataset.pawn = p.id;
          // the character's portrait token (tokens.js), the initial on the colour without one
          g.innerHTML = `<g class="pawn-body"><ellipse class="pawn-shadow" cx="0" cy="15" rx="12" ry="4"/>${pawnSvg(p)}</g>`;
          g.style.transform = `translate(${tx}px, ${ty}px)`;
          layer.append(g);
        }
        g.classList.toggle('active', p.id === player.id);
        g.style.transform = `translate(${tx}px, ${ty}px)`;
        seen.add(p.id);
      });
    }
    for (const g of [...layer.children]) if (!seen.has(g.dataset.pawn)) g.remove();
  }
}
