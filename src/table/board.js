// The digital Kanto board: art + graph, pawns that glide between places,
// Poké Stop / gym / League / Team Rocket markers, legal destinations glowing.
// Tap a glowing place to move; tap a closed neighbour to hear why. Movement
// legality always comes from the engine; coordinates are presentation only.
import { LOCATIONS, LOCATIONS_BY_ID, hasFeature, isLocationEnabled } from '../data/locations.js';
import { MAP_LAYOUT } from '../data/mapLayout.js';
import { gymInCity } from '../data/gyms.js';
import { CAPABILITIES } from '../data/travelConnections.js';
import { getLegalActions } from '../engine/turnEngine.js';
import { currentPlayer } from '../engine/gameState.js';
import { blockedNeighbors, getEdgeMeta } from '../engine/travelEngine.js';
import { activePlot, plotCard, rocketBlocks } from '../engine/rocketEngine.js';
import { gymsEnabled, hasBadge } from '../engine/gymEngine.js';
import { questLocations } from '../engine/questEngine.js';
import { esc } from '../ui/dom.js';
import { plotPl } from './content-pl.js';
import { gi } from './icons.js';

// A game icon placed in the map's SVG, centred on (x, y).
const mapIcon = (key, x, y, size) => gi(key, { size }).replace('<svg ', `<svg x="${x - size / 2}" y="${y - size / 2}" `);

const W = 1000;
// The family table plays on the hand-made Kanto board art only (Playtest Build
// 2 release gate). The schematic grid is a harness / debug view: no silent
// fallback here — without the art the board says so (BRAK GRAFIKI PLANSZY).
export const BOARD_ART = 'assets/boards/kanto-board.jpg';
const DEFAULT_ASPECT = 6036 / 4168;
const NEEDS_PL = { canTravelWater: 'Soul Badge (pływanie)', canClimbMountain: 'wspinaczki', canEnterCave: 'wejścia do jaskini', canFly: 'latania' };

function readOverrides() {
  try {
    return JSON.parse(localStorage.getItem('kanto.layoutOverrides.v1')) ?? {};
  } catch {
    return {};
  }
}

// Why a neighbour can't be entered, in family language.
export function blockedReason(state, player, to) {
  const b = blockedNeighbors(player, state.config, rocketBlocks(state)).find((x) => x.to === to);
  if (!b) return null;
  if (b.rocket) return `🎈 Team Rocket zamknął drogę: ${plotPl(activePlot(state).plotId).title}`;
  const needs = b.missing.map((c) => NEEDS_PL[c] ?? CAPABILITIES[c]?.name ?? c).join(' + ');
  return `${b.missing.map((c) => CAPABILITIES[c]?.icon ?? '').join('')} Ta droga wymaga: ${needs}.`;
}

export class BoardView {
  constructor(root, { onMove, onInfo }) {
    this.root = root;
    this.onMove = onMove;
    this.onInfo = onInfo;
    this.state = null;
    this.aspect = DEFAULT_ASPECT;
    this.overrides = readOverrides();
    root.dataset.boardArt = 'loading';
    root.innerHTML = `<svg class="board-svg" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
      <image class="board-art" x="0" y="0" width="${W}"/>
      <g class="b-edges"></g><g class="b-nodes"></g><g class="b-rocket"></g><g class="b-pawns"></g></svg>
      <div class="board-missing" role="alert" hidden>
        <b>BRAK GRAFIKI PLANSZY</b>
        <p>Nie udało się wczytać mapy Kanto (<code>${BOARD_ART}</code>). Ta wersja gry nie ma planszy — gra na schemacie jest wyłączona.</p>
        <p class="small">Jeśli tablet jest offline: połącz go z internetem i odśwież stronę. Jeśli to nowa wersja: zbuduj ją z grafiką planszy (<code>npm run build:tablet</code>).</p>
      </div>`;
    this.svg = root.querySelector('svg');
    this.image = root.querySelector('.board-art');
    this.loadArt();
    this.svg.addEventListener('click', (e) => {
      const node = e.target.closest('[data-node]');
      if (node) this.tap(node.dataset.node);
    });
  }

  loadArt() {
    const img = new Image();
    img.onload = () => {
      this.aspect = img.naturalWidth / img.naturalHeight || DEFAULT_ASPECT;
      this.image.setAttribute('href', BOARD_ART);
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

  pos(id) {
    const p = this.overrides[id] ?? MAP_LAYOUT.positions[id];
    return { x: p.x * W, y: (p.y * W) / this.aspect };
  }

  tap(id) {
    const state = this.state;
    if (!state) return;
    const player = currentPlayer(state);
    const legal = this.legalTargets();
    const loc = LOCATIONS_BY_ID[id];
    if (legal.has(id)) {
      this.onMove(id);
      return;
    }
    if (player.controller !== 'human' || state.phase !== 'turn') {
      this.onInfo(loc.name);
      return;
    }
    if (id === player.location) {
      this.onInfo(`Tu jesteś: ${loc.name}`);
      return;
    }
    const why = blockedReason(state, player, id);
    if (why) this.onInfo(why);
    else if (state.turn.actionsRemaining <= 0) this.onInfo('Brak akcji — zakończ turę.');
    else this.onInfo(`${loc.name} — za daleko. Idziesz tylko do sąsiedniego miejsca.`);
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
    const enabled = LOCATIONS.filter((l) => isLocationEnabled(l.id, cfg));
    const blocks = rocketBlocks(state);
    const closed = new Set(blocks?.locations ?? []);
    const targets = new Set((player.quests ?? []).flatMap((q) => questLocations(q)));

    const edges = [];
    for (const loc of enabled) {
      for (const n of loc.connections) {
        if (loc.id >= n || !isLocationEnabled(n, cfg)) continue;
        const a = this.pos(loc.id);
        const b = this.pos(n);
        const meta = getEdgeMeta(loc.id, n);
        const active = (loc.id === player.location && legal.has(n)) || (n === player.location && legal.has(loc.id));
        const isWater = meta.requires.includes('canTravelWater');
        const cls = ['edge', meta.traversal, isWater ? (water ? 'water-open' : 'water-locked') : '', active ? 'active' : ''].filter(Boolean).join(' ');
        edges.push(`<line class="${cls}" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"/>`);
      }
    }

    const nodes = enabled.map((loc) => {
      const { x, y } = this.pos(loc.id);
      const big = loc.type === 'city' || loc.type === 'town';
      const r = big ? 13 : loc.type === 'special' ? 10 : 8;
      const cls = ['node', loc.type, legal.has(loc.id) ? 'legal' : '', loc.id === player.location ? 'current' : '', closed.has(loc.id) ? 'closed' : ''].filter(Boolean).join(' ');
      const shape = loc.type === 'special' ? `<rect class="shape" x="${-r}" y="${-r}" width="${2 * r}" height="${2 * r}" rx="3" transform="rotate(45)"/>` : `<circle class="shape" r="${r}"/>`;
      const halo = legal.has(loc.id) ? `<circle class="halo" r="${r + 12}"/>` : '';
      const stop = hasFeature(loc.id, 'pokeStop') ? `<g class="stop-mark" transform="translate(${r + 2} ${-r - 2})"><circle r="9"/><text dy="4">P</text></g>` : '';
      const gym = gymsEnabled(state) ? gymInCity(loc.id) : null;
      const gymMark = gym ? `<g class="gym-mark${hasBadge(player, gym.id) ? ' earned' : ''}" transform="translate(${-r - 4} ${r + 3})"><circle r="11"/>${mapIcon(`type.${gym.type}`, 0, 0, 14)}</g>` : '';
      const league = gymsEnabled(state) && hasFeature(loc.id, 'league') ? `<g class="league-mark">${mapIcon('league', -r - 10, r + 6, 14)}</g>` : '';
      const flag = targets.has(loc.id) ? `<g class="target-mark">${mapIcon('target', r - 2, r + 10, 14)}</g>` : '';
      const label = big || loc.type === 'special' ? `<text class="label${big ? ' big' : ''}" y="${r + 20}">${esc(loc.name)}</text>` : '';
      return `<g class="${cls}" data-node="${loc.id}" transform="translate(${x} ${y})"><circle class="hit" r="26"/>${halo}${shape}${stop}${gymMark}${league}${flag}${label}</g>`;
    });
    this.root.querySelector('.b-edges').innerHTML = edges.join('');
    this.root.querySelector('.b-nodes').innerHTML = nodes.join('');

    this.renderRocket(state);
    this.renderPawns(state, player);
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
        const tx = x + Math.cos(angle) * 22;
        const ty = y + Math.sin(angle) * 22;
        let g = layer.querySelector(`[data-pawn="${p.id}"]`);
        if (!g) {
          g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
          g.dataset.pawn = p.id;
          g.innerHTML = `<g class="pawn-body"><ellipse class="pawn-shadow" cx="0" cy="12" rx="10" ry="4"/><circle r="12" fill="${p.color}"/><text dy="5">${esc(p.name[0])}</text></g>`;
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
