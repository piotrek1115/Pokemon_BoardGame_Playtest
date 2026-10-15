// Gym card (in a gym city) and League card (at Indigo Plateau): leader, type,
// what is strong / weak here, the tier rows with yours highlighted, and the
// Challenge button with the reason when it is not available.
import { GYMS, LEAGUE } from '../data/gyms.js';
import { getLocation } from '../data/locations.js';
import { getSpecies } from '../data/pokemon.js';
import { TYPE_CHART, TYPE_ICONS } from '../data/types.js';
import { getLegalActions } from '../engine/turnEngine.js';
import { currentPlayer } from '../engine/gameState.js';
import { typeModifier } from '../engine/combatEngine.js';
import {
  gymChallengeBlocker, gymHere, gymTier, gymTiers, gymsEnabled, hasBadge, leagueChallengeBlocker, leagueHere, leagueStageTeam, leagueStartStage, rowPower,
} from '../engine/gymEngine.js';
import { actButton, esc } from './dom.js';

function monText(id) {
  const s = getSpecies(id);
  return `${esc(s.name)} ❤${s.hp} ⚔${s.attack >= 0 ? '+' : ''}${s.attack}`;
}

// Attack types that hit every Pokémon of the gym harder / weaker (type chart).
export function gymMatchups(gym, config) {
  const mons = [...new Set(gymTiers(gym, config).flat())].map((id) => getSpecies(id));
  const strong = [];
  const weak = [];
  for (const t of Object.keys(TYPE_CHART)) {
    const mods = mons.map((m) => typeModifier(t, m.types, config));
    if (mods.every((x) => x > 0)) strong.push(t);
    if (mods.every((x) => x < 0)) weak.push(t);
  }
  return { strong, weak };
}

function typeList(types) {
  return types.map((t) => `${TYPE_ICONS[t] ?? ''} ${t}`).join(', ');
}

function renderGym(state, player, gym) {
  const human = player.controller === 'human' && state.phase === 'turn';
  const legal = getLegalActions(state).find((a) => a.type === 'challengeGym');
  const tier = gymTier(state, player);
  const { strong, weak } = gymMatchups(gym, state.config);
  const rows = gymTiers(gym, state.config).map((row, i) => {
    const label = i === 0 ? '0 badges' : i === 1 ? '1 badge' : '2+ badges';
    return `<li class="${i + 1 === tier ? 'mine' : ''}"><span class="muted small">${label} · tier ${i + 1}</span> ${row.map(monText).join(' · ')} <span class="muted small">(power ${rowPower(row)})</span></li>`;
  }).join('');
  const owned = hasBadge(player, gym.id);
  const button = human && !owned
    ? actButton({ type: 'challengeGym' }, `🏟️ Gym Challenge (1 action)`, { cls: legal ? 'primary' : '', disabled: !legal, title: legal ? `Battle tier ${tier}` : gymChallengeBlocker(state, player) })
    : '';
  return `
    <div class="gym-card">
      <div class="enc-head"><span class="badge gym">Gym</span><h4>${gym.icon} ${esc(getLocation(gym.city).name)} Gym · ${esc(gym.leader)}</h4><span class="tag">${esc(gym.badge)}${owned ? ' ✓' : ''}</span></div>
      ${gym.leaderNote ? `<div class="small muted">${esc(gym.leaderNote)}</div>` : ''}
      <div class="small">Strong here: ${typeList(strong) || '—'} · Weak here: ${typeList(weak) || '—'}</div>
      <ol class="tiers">${rows}</ol>
      <div class="small">Win: ${esc(gym.badge)} + 💰${state.config.gyms.reward.money}${state.config.gyms.starsPerBadge ? ` + ⭐${state.config.gyms.starsPerBadge}` : ''}${gym.grants ? ' + 🌊 water travel' : ''} · Lose: nothing lost, try again next turn · no fleeing, no balls, no items in battle</div>
      ${button ? `<div class="row">${button}</div>` : ''}
    </div>`;
}

function renderLeague(state, player) {
  const human = player.controller === 'human' && state.phase === 'turn';
  const legal = getLegalActions(state).find((a) => a.type === 'challengeLeague');
  const start = leagueStartStage(state, player);
  const stages = LEAGUE.stages.map((stage, i) => `<li class="${i === start ? 'mine' : ''}"><b>${esc(stage.name)}</b>: ${leagueStageTeam(state, i).map((id, j) => `${esc(stage.trainers[j] ?? stage.trainers[0])}'s ${monText(id)}`).join(' · ')}</li>`).join('');
  const need = state.config.gyms.badgesForLeague;
  const button = human && !player.league.champion
    ? actButton({ type: 'challengeLeague' }, '🏆 League Challenge (1 action)', { cls: legal ? 'primary' : '', disabled: !legal, title: legal ? 'Elite Four, then Champion Lance' : leagueChallengeBlocker(state, player) })
    : '';
  return `
    <div class="gym-card league">
      <div class="enc-head"><span class="badge league">League</span><h4>🏆 Pokémon League · Indigo Plateau</h4><span class="tag">${player.badges.length} / ${need} badges${player.league.ribbon ? ' · 🎀 ribbon' : ''}${player.league.champion ? ' · 👑 Champion' : ''}</span></div>
      <ol class="tiers">${stages}</ol>
      <div class="small">Between the two battles: Potions / Revives and lead changes, no Poké Stop. Beat the Elite Four once and the 🎀 ribbon takes you straight to Lance next time.</div>
      ${button ? `<div class="row">${button}</div>` : ''}
    </div>`;
}

export function renderGymCard(state) {
  if (!gymsEnabled(state)) return '';
  const player = currentPlayer(state);
  const gym = gymHere(state, player);
  if (gym) return renderGym(state, player, gym);
  if (leagueHere(state, player)) return renderLeague(state, player);
  return '';
}

// Badge case for the player board.
export function renderBadgeCase(state, player) {
  if (!gymsEnabled(state)) return '';
  const slots = GYMS.map((g) => `<span class="badge-slot${hasBadge(player, g.id) ? ' earned' : ''}" title="${esc(`${g.badge} — ${g.leader}, ${getLocation(g.city).name}`)}">${g.icon}</span>`).join('');
  const extra = `${player.league?.ribbon ? '<span title="Elite Four Ribbon">🎀</span>' : ''}${player.league?.champion ? '<span title="Pokémon League Champion">👑</span>' : ''}`;
  return `<div class="badge-case" title="Badges: ${player.badges.length} / ${state.config.gyms.badgesForLeague} for the League">${slots}${extra}</div>`;
}
