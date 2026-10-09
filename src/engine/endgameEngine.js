// Win condition (Step 6, V1 "Simple Champion Win", DQ-53…57).
//
// "Get 3 badges, go to the Pokémon League, beat the Elite Four and Lance, and
// become Champion."
//
// - Beating Lance makes a player Champion (gymEngine calls onChampion). The
//   first Champion starts the final week. A Champion is frozen: their turn
//   ends at once and they get no further turns.
// - The others finish the current week (equal turns). Anyone else who beats
//   Lance that week is Champion too — a shared victory, no tiebreak.
// - When the turn order wraps to the next week, the game is over: no new week,
//   no week-start systems (Team Rocket), no legal actions.
// - Optional Time Limit (CONFIG.winCondition.timeLimitWeeks): if week T ends
//   with no Champion, the winner is the most badges → Elite Four Ribbon → most
//   unique Pokémon caught → still tied: shared.
// - Hall of Fame: an epilogue of titles, never points, never changes winners.
//
// Identities are stable player ids, always in setup order.
import { log } from './log.js';

export function emptyEndgame() {
  return { status: 'playing', finalWeek: null, champions: [], winners: [], reason: null, decidedBy: null, hallOfFame: null };
}

export function gameOver(state) {
  return state.endgame?.status === 'over';
}

function inSetupOrder(state, ids) {
  return state.players.map((p) => p.id).filter((id) => ids.includes(id));
}

function names(state, ids) {
  const list = ids.map((id) => state.players.find((p) => p.id === id).name);
  return list.length > 1 ? `${list.slice(0, -1).join(', ')} and ${list.at(-1)}` : list[0];
}

// Lance beaten (called by gymEngine after setting player.league.champion).
export function onChampion(state, player) {
  const end = state.endgame;
  if (!state.config.winCondition?.endsGame) return;
  end.champions = inSetupOrder(state, [...new Set([...end.champions, player.id])]);
  if (end.status === 'playing') {
    end.status = 'finalWeek';
    end.finalWeek = state.turn.round;
    log(state, 'end', `🏁 Final week! ${player.name} is the Champion — everyone else finishes this week's turns. Beat Lance this week to share the victory.`);
  } else {
    log(state, 'end', `👑 ${player.name} becomes Champion too and shares the victory!`);
  }
  state.turn.actionsRemaining = 0; // the Champion is frozen: the turn ends now
}

// Called by advanceTurn before the turn order wraps to a new week. Returns
// true when the game is over (the week counter is not advanced).
export function endOfWeekEndsGame(state) {
  const end = state.endgame;
  const wc = state.config.winCondition;
  if (!wc?.endsGame) return false;
  if (end.status === 'finalWeek') {
    finishGame(state, 'champion', end.champions, null);
    return true;
  }
  if (wc.timeLimitWeeks && state.turn.round >= wc.timeLimitWeeks) {
    const { winners, decidedBy } = timeLimitWinners(state);
    finishGame(state, 'timeLimit', winners, decidedBy);
    return true;
  }
  return false;
}

// Most badges → Elite Four Ribbon → most unique Pokémon caught → shared.
export function timeLimitWinners(state) {
  let pool = state.players;
  const steps = [
    ['badges', (p) => p.badges.length],
    ['ribbon', (p) => (p.league.ribbon ? 1 : 0)],
    ['caught', (p) => p.pokedex.caught.length],
  ];
  for (const [key, value] of steps) {
    const best = Math.max(...pool.map(value));
    pool = pool.filter((p) => value(p) === best);
    if (pool.length === 1) return { winners: [pool[0].id], decidedBy: key };
  }
  return { winners: pool.map((p) => p.id), decidedBy: 'shared' };
}

export const HALL_OF_FAME = [
  { id: 'pokedexMaster', icon: '📕', title: 'Pokédex Master', measure: 'unique Pokémon caught', value: (p) => p.pokedex.caught.length },
  { id: 'rocketBuster', icon: '🎈', title: 'Rocket Buster', measure: 'Rocket plots cleared', value: (p) => p.stats.rocket?.cleared ?? 0 },
  { id: 'missionAce', icon: '📜', title: 'Mission Ace', measure: 'Mission Cards completed', value: (p) => p.stats.quests?.completed ?? 0 },
  { id: 'gymHero', icon: '🏅', title: 'Gym Hero', measure: 'badges', value: (p) => p.badges.length },
];

// Each title goes to the top player(s) if the best value is > 0; ties share
// it; one player may hold several. Champions get 👑 regardless.
export function hallOfFame(state) {
  const titles = HALL_OF_FAME.map((t) => {
    const best = Math.max(...state.players.map(t.value));
    const holders = best > 0 ? state.players.filter((p) => t.value(p) === best).map((p) => p.id) : [];
    return { id: t.id, icon: t.icon, title: t.title, measure: t.measure, best, holders };
  });
  const stats = Object.fromEntries(state.players.map((p) => [p.id, Object.fromEntries(HALL_OF_FAME.map((t) => [t.id, t.value(p)]))]));
  return { titles, stats };
}

function finishGame(state, reason, winners, decidedBy) {
  const end = state.endgame;
  end.status = 'over';
  end.reason = reason;
  end.winners = inSetupOrder(state, winners);
  end.decidedBy = decidedBy;
  end.hallOfFame = hallOfFame(state);
  state.phase = 'over';
  state.encounter = null;
  if (reason === 'champion') {
    log(state, 'end', end.winners.length > 1 ? `👑 ${names(state, end.winners)} share the victory as Pokémon League Champions!` : `👑 ${names(state, end.winners)} is the Pokémon League Champion and wins the game!`);
  } else {
    const how = { badges: 'most badges', ribbon: 'the Elite Four Ribbon', caught: 'most Pokémon caught', shared: 'a tie — shared victory' }[decidedBy];
    log(state, 'end', `⏱ Time's up after week ${state.turn.round}: ${names(state, end.winners)} win${end.winners.length > 1 ? '' : 's'} (${how}).`);
  }
  for (const t of end.hallOfFame.titles) {
    if (t.holders.length) log(state, 'end', `${t.icon} ${t.title}: ${names(state, t.holders)} (${t.best} ${t.measure})`);
  }
}
