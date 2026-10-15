// Character portrait tokens (ChatGPT 11.10.2026 16:08, before Build 3.1): one
// round portrait token per person of the game world — the four playable
// characters, the 14 trainer classes, the gym leaders, the League and Team
// Rocket. Presentation only: no rule, no RNG, no save reads it. Every identity
// comes from data the game already keeps (player.id, trainer.archetype,
// encounter.gymId, the League stage + the Pokémon's place in it, the Rocket
// Pokémon's species), so nothing new is stored.
//
// Piotr's portraits: a square image per identity in assets/tokens/ (the Card
// Studio — tools/card-studio.html — crops and exports it), listed in
// TOKEN_ART below. The table masks it to a circle. A missing portrait is not
// an error: the token keeps its size and shows its fallback — the player's
// initial on their colour, Team Rocket's initials, or (developer fallback, not
// the final art) the trainer's FireRed / LeafGreen picture over its class icon.
import { CHARACTERS, CHARACTERS_BY_ID } from '../data/characters.js';
import { TRAINER_ARCHETYPES } from '../data/trainers.js';
import { GYMS, LEAGUE } from '../data/gyms.js';
import { esc } from '../ui/dom.js';
import { trainerArtUrl } from './art.js';
import { gi } from './icons.js';

export const TOKEN_ART_DIR = 'assets/tokens/';

// identity → file name in assets/tokens/ — one line per portrait Piotr delivers
// (the build copies and precaches them; a listed file that is missing stops the build).
export const TOKEN_ART = {
  'ash': 'ash.png',
  'misty': 'misty.png',
  'brock': 'brock.png',
  'gary': 'gary.png',
  'bug-catcher': 'bug-catcher.png',
  'youngster': 'youngster.png',
  'lass': 'lass.png',
  'hiker': 'hiker.png',
  'fisherman': 'fisherman.png',
  'sailor': 'sailor.png',
  'camper': 'camper.png',
  'picnicker': 'picnicker.png',
  'scientist': 'scientist.png',
  'psychic': 'psychic.png',
  'channeler': 'channeler.png',
  'biker': 'biker.png',
  'bird-keeper': 'bird-keeper.png',
  'swimmer': 'swimmer.png',
  'flint': 'flint.png',
  'sensational-sisters': 'sensational-sisters.png',
  'lt-surge': 'lt-surge.png',
  'erika': 'erika.png',
  'sabrina': 'sabrina.png',
  'koga': 'koga.png',
  'lorelei': 'lorelei.png',
  'agatha': 'agatha.png',
  'bruno': 'bruno.png',
  'lance': 'lance.png',
  'jessie': 'jessie.png',
  'james': 'james.png',
  'meowth': 'meowth.png',
};

const GYM_TOKENS = { pewter: 'flint', cerulean: 'sensational-sisters', vermilion: 'lt-surge', celadon: 'erika', saffron: 'sabrina', fuchsia: 'koga' };
const LEAGUE_TOKENS = { Lorelei: 'lorelei', Agatha: 'agatha', Bruno: 'bruno', Lance: 'lance' };

// Every identity: its name, its group and the fallback shown without a portrait.
export const TOKENS = Object.freeze({
  ...Object.fromEntries(CHARACTERS.map((c) => [c.id, { name: c.name, group: 'playable', color: c.color, initial: c.name[0] }])),
  ...Object.fromEntries(TRAINER_ARCHETYPES.map((a) => [a.id, { name: a.name, group: 'trainer', sprite: { archetype: a.id }, icon: 'trainer' }])),
  ...Object.fromEntries(GYMS.map((g) => [GYM_TOKENS[g.id], { name: g.leader, group: 'gym', sprite: { gymId: g.id }, icon: `type.${g.type}`, gymId: g.id }])),
  ...Object.fromEntries(Object.entries(LEAGUE_TOKENS).map(([name, id]) => [id, { name, group: 'league', sprite: { leagueName: name }, icon: 'league' }])),
  jessie: { name: 'Jessie', group: 'rocket', color: '#b0274a', initial: 'J' },
  james: { name: 'James', group: 'rocket', color: '#4b3fa0', initial: 'J' },
  meowth: { name: 'Meowth', group: 'rocket', color: '#c99a2e', icon: 'meowth' },
});

export const TOKEN_GROUPS = [
  { id: 'playable', title: 'Postacie graczy' },
  { id: 'trainer', title: 'Trenerzy' },
  { id: 'gym', title: 'Liderzy sal' },
  { id: 'league', title: 'Liga' },
  { id: 'rocket', title: 'Team Rocket' },
].map((g) => ({ ...g, ids: Object.keys(TOKENS).filter((id) => TOKENS[id].group === g.id) }));

// ---- identity → asset -------------------------------------------------------------------

export function characterTokenUrl(identity) {
  const file = TOKEN_ART[identity];
  return file ? `${TOKEN_ART_DIR}${file}` : null;
}

// ---- who is it? (only from what the game already stores) ------------------------------

export function playerTokenId(player) {
  return CHARACTERS_BY_ID[player.id] ? player.id : null;
}

export function gymTokenId(gymId) {
  return GYM_TOKENS[gymId] ?? null;
}

export function leagueTokenId(name) {
  return LEAGUE_TOKENS[name] ?? null;
}

// Team Rocket: Jessie's Ekans / Arbok, James's Koffing / Weezing, Meowth
// (CONFIG.rocket: team / evolvedTeam in that order, meowth).
export function rocketTokenId(species, config) {
  const r = config.rocket;
  if (species === r.meowth) return 'meowth';
  if ([r.team?.[0], r.evolvedTeam?.[0]].includes(species)) return 'jessie';
  if ([r.team?.[1], r.evolvedTeam?.[1]].includes(species)) return 'james';
  return null;
}

// Whose Pokémon is fighting on the other side right now (null: a wild one).
export function opponentTokenId(enc, config) {
  if (!enc || enc.kind === 'wild') return null;
  if (enc.kind === 'trainer') return TOKENS[enc.trainer.archetype] ? enc.trainer.archetype : null;
  if (enc.kind === 'gym') return enc.trainer?.archetype && TOKENS[enc.trainer.archetype] ? enc.trainer.archetype : gymTokenId(enc.gymId); // B33-3: a gym trainer
  const mon = enc.trainer.pokemonTeam[enc.index];
  if (enc.kind === 'rocket') return mon ? rocketTokenId(mon.species, config) : null;
  if (enc.kind === 'league') {
    const trainers = LEAGUE.stages[enc.stage]?.trainers ?? [];
    return leagueTokenId(enc.trainer.owners?.[enc.index] ?? trainers[enc.index] ?? trainers[0]);
  }
  return null;
}

// ---- drawing ---------------------------------------------------------------------------

// The fallback under the portrait: the initial on the person's colour, else
// the developer picture (FRLG) over the class icon, else the class icon.
function fallback(t) {
  if (t.initial) return `<span class="ct-initial">${esc(t.initial)}</span>`;
  const sprite = t.sprite ? trainerArtUrl(t.sprite) : null;
  const icon = `<span class="art-icon">${gi(t.icon ?? 'trainer')}</span>`;
  return sprite ? `${icon}<img class="art ct-sprite" src="${esc(sprite)}" alt="" loading="lazy" decoding="async" crossorigin="anonymous" referrerpolicy="no-referrer" draggable="false">` : icon;
}

// The portrait itself (masked round by its token's CSS), or '' without one.
export function tokenArt(identity) {
  const url = identity ? characterTokenUrl(identity) : null;
  return url ? `<img class="art ct-art" src="${esc(url)}" alt="" decoding="async" draggable="false">` : '';
}

// A round token (sizes xs 28 · s 36 · m 56 · l 72 · xl 96 px — always the same
// box, with or without the portrait). `ring`: the player's colour around it.
export function characterToken(identity, { size = 'm', ring = null, title = null } = {}) {
  const t = TOKENS[identity];
  if (!t) return '';
  const art = tokenArt(identity);
  const style = `--tc:${t.color ?? '#2a3352'};${ring ? `--ring:${ring};` : ''}`;
  return `<span class="ctoken ct-${size}${ring ? ' ringed' : ''}" data-token="${identity}" style="${style}" title="${esc(title ?? t.name)}">${fallback(t)}${art}</span>`;
}

// The player's own token (map pawn colour as the ring).
export function playerToken(player, opts = {}) {
  const id = playerTokenId(player);
  return id ? characterToken(id, { ring: player.color, title: player.name, ...opts }) : '';
}

// The map pawn (SVG): the portrait (radius r) inside a band of the player's
// colour (3 units) with a white edge — the same size with or without the
// portrait; without it the initial on the colour (the pawn before tokens).
export function pawnSvg(player, { r = 12 } = {}) {
  const id = playerTokenId(player);
  const url = id ? characterTokenUrl(id) : null;
  const face = `<circle class="pawn-ring" r="${r + 3}" fill="${player.color}"/><circle class="pawn-face" r="${r}" fill="${player.color}"/><text dy="5">${esc(player.name[0])}</text>`;
  if (!url) return face;
  const clip = `pawn-clip-${player.id}`;
  return `<clipPath id="${clip}"><circle r="${r}"/></clipPath>${face}<image class="pawn-art" href="${esc(url)}" x="${-r}" y="${-r}" width="${2 * r}" height="${2 * r}" clip-path="url(#${clip})" preserveAspectRatio="xMidYMid slice"/>`;
}

// The player's big round token in the HUD and the player popup (Build 2.4's
// hero token, now with the portrait): the initial on the colour stays under it.
export function heroToken(player, size = '') {
  const id = playerTokenId(player);
  return `<span class="hero-token ${size}"${id ? ` data-token="${id}"` : ''} style="--pc:${player.color}"><span class="ct-initial">${esc(player.name[0])}</span>${tokenArt(id)}</span>`;
}

// The small round player badge (setup, results, the wallet line, the legacy HUD):
// the same portrait, the initial on the colour without one.
export function avatarToken(player, size = '') {
  const id = playerTokenId(player);
  return `<span class="avatar${size ? ` ${size}` : ''}"${id ? ` data-token="${id}"` : ''} style="--pc:${player.color}"><span class="ct-initial">${esc(player.name[0])}</span>${tokenArt(id)}</span>`;
}
