// PLAYTEST_007 stage 3 (PT007-07 / 08): two levels of messages.
//   TOAST          money, ordinary progress, small rewards, EXP — the reveal's short notes and toasts, as before;
//   IMPORTANT      a new rumour a (human) player hears, a new Team Rocket plot, the balloon landing — they wait for
//                  „ROZUMIEM”: never closed by a timer, never inside the battle HUD (the reveal skips them), shown
//                  after the battle is over and its result closed, before the next turn's handoff.
// The queue is the game LOG itself (every entry has a monotone `seq`), so a reload never loses one; what the table
// already confirmed is remembered per game on this device (not in the save — no schema change), so nothing
// confirmed comes back. A game seen for the first time on this device starts from its last entry (no flood of old
// rumours from a resumed save).
import { RUMOUR_PL, placeName, plotPl } from './content-pl.js';

export const NOTICE_KEY = 'kanto.table.notices.v1';

// Is this log entry an IMPORTANT notice for the table (and so not a reveal note)?
export function isNotice(state, e) {
  const d = e?.data;
  if (!d) return false;
  if (d.rumour?.event === 'heard') return state.players.find((p) => p.id === (d.rumour.player ?? e.player))?.controller !== 'ai';
  if (d.rocket?.event === 'plot') return true;
  if (d.rocket?.event === 'drift') return Boolean(d.rocket.landed);
  return false;
}

// The notice's words (the child's language), with the place to look at.
export function noticeOf(state, e) {
  const d = e.data;
  if (d.rumour) {
    const who = state.players.find((p) => p.id === (d.rumour.player ?? e.player))?.name ?? '';
    return { seq: e.seq, icon: '📜', title: `${who} słyszy plotkę!`, text: RUMOUR_PL[d.rumour.id] ?? '', place: d.rumour.start, where: `📍 ${placeName(d.rumour.start)}${d.rumour.from === 'local' ? ' — to tutaj!' : ''}` };
  }
  if (d.rocket.event === 'plot') {
    const p = plotPl(d.rocket.plot);
    return { seq: e.seq, icon: '🎈', title: `Team Rocket knuje: ${p.title}`, text: [p.flavor, p.text].filter(Boolean).join(' '), place: d.rocket.location, where: `📍 ${placeName(d.rocket.location)}` };
  }
  return { seq: e.seq, icon: '🎈', title: 'Balon Team Rocket wylądował!', text: 'Uwaga na drogach w pobliżu.', place: d.rocket.to, where: `📍 ${placeName(d.rocket.to)}` };
}

// The notices not yet confirmed (after `ackSeq`), oldest first.
export function pendingNotices(state, ackSeq = 0) {
  return state.log.filter((e) => e.seq > ackSeq && isNotice(state, e)).map((e) => noticeOf(state, e));
}

// This game's key on the device and the seq a game seen for the first time starts from.
export const noticeGameKey = (state) => `${state.seed}|${state.players.map((p) => p.id).join(',')}|${state.scenario ?? ''}`;
export const lastSeq = (state) => state.log.at(-1)?.seq ?? state.logBase ?? 0;
