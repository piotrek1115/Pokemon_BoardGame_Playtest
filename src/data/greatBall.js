// PLAYTEST_006 PT006-09 — the Great Ball's „truly easy” Pokémon: a CLOSED, printed list (the physical game
// needs one it can print on the Great Ball card). Rule behind it, for review: common AND 1 power dot (K5:
// HP + 2 × attack ≤ 3) — tests/pt006-balance.test.js keeps the list equal to it. Not every common Pokémon:
// Pikachu, Growlithe or Abra are not on it. Used only by the candidate rules.greatBall 'G1' / 'G2'.
export const TRIVIAL_CATCH = Object.freeze([
  'caterpie', 'weedle', 'pidgey', 'rattata', 'spearow', 'zubat', 'oddish', 'meowth', 'poliwag',
  'tentacool', 'magikarp', 'nidoranf', 'paras', 'venonat', 'bellsprout', 'shellder', 'horsea', 'goldeen',
]);
