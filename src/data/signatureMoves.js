// Bonus 2, 14.10 — SIGNATURE MOVES, the first pilot of docs/SIGNATURE_MOVES.md (DQ-88; rules.signatureMoves
// 'pilot', the DEV ruleset dev-1410c). One move per EVOLUTION LINE (the species' `family`, so Raichu keeps Piorun),
// at most once per battle per Pokémon, Atakuj always available. Only the four starter lines for now; the kinds
// are those of the spec's closed list (attack / drain / guard), each a battle step the engine already has.
// Numbers are the spec's placeholders — PROVISIONAL. Players' Pokémon only (spec v1: NPC opponents have none).
export const SIGNATURE_MOVES = Object.freeze({
  pikachu: Object.freeze({ id: 'thunderbolt', name: 'Thunderbolt', pl: 'Piorun', text: 'Atak +2. Raz na walkę.', effect: Object.freeze({ kind: 'attack', bonus: 2 }) }),
  charmander: Object.freeze({ id: 'blaze', name: 'Blaze', pl: 'Płomień', text: 'Atak +3, gdy ma połowę serc lub mniej. Raz na walkę.', effect: Object.freeze({ kind: 'attack', bonus: 3, when: 'hpHalfOrLess' }) }),
  bulbasaur: Object.freeze({ id: 'absorb', name: 'Absorb', pl: 'Wysysanie', text: 'Atak; odzyskuje tyle serc, ile zada obrażeń. Raz na walkę.', effect: Object.freeze({ kind: 'drain' }) }),
  squirtle: Object.freeze({ id: 'withdraw', name: 'Withdraw', pl: 'Skorupa', text: 'Atak; kontra przeciwnika w tej rundzie zadaje 1 mniej. Raz na walkę.', effect: Object.freeze({ kind: 'guard', reduce: 1 }) }),
});
