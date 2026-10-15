// Species traits (Build 3.3, docs/BUILD_3_3_SPEC.md §8): one small table per
// trait, read only through engine/initiativeEngine.js (`hasTrait`), never
// hard-coded in combat. Versioned like every other rule data: a game's
// `rules.initiative` names the version it plays with.
//
// First Strike ⚡ „Szybkie wejście” (DEC-12 FS-B, Piotr 13.10.2026). The SPECIES
// LIST IS PROVISIONAL — a small test pilot for the overnight batch (ChatGPT's
// handoff 00:11 suggested these five), not Piotr's approved content. Every id
// must be one of the game's species (tests/b33.test.js checks it). Character
// traits (Ash, Misty…) are a separate scope and never live here.
//
// Correction C6 (13.10, ChatGPT review R5): two MEASUREMENT lists beside the
// pilot — never a decision; a game plays them only with CONFIG.firstStrike.list:
// - 'fsB-A': the pilot without a starter line (no Pikachu — Ash's starter;
//   Misty's Staryu / Starmie, Brock's Geodude line and Gary's Squirtle line were
//   never on it);
// - 'fsB-A2': A plus four fast final forms that are no one's starter line
//   (Fearow, Dodrio, Tauros, Aerodactyl), so ⚡ stays about as frequent.
export const TRAITS = {
  firstStrike: {
    fsB: ['pikachu', 'persian', 'dugtrio', 'electrode', 'rapidash'],
    'fsB-A': ['persian', 'dugtrio', 'electrode', 'rapidash'],
    'fsB-A2': ['persian', 'dugtrio', 'electrode', 'rapidash', 'fearow', 'dodrio', 'tauros', 'aerodactyl'],
  },
};

export const FIRST_STRIKE_PROVISIONAL = true;
