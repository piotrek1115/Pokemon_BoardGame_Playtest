// Game log. Every meaningful state transition and every random result is
// appended here; the log lives inside GameState (never only in the DOM).
//
// kinds: system | turn | action | roll | info | encounter | combat | capture | event | evolution | quest | rocket | gym | end | ai | warn
export function log(state, kind, text, data) {
  const player = state.players?.[state.turn?.playerIndex];
  const entry = {
    seq: state.log.length + 1,
    round: state.turn?.round ?? 0,
    player: player?.id ?? null,
    kind,
    text,
  };
  if (data !== undefined) entry.data = data;
  state.log.push(entry);
  return entry;
}
