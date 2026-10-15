// Bonus 2, 14.10 — CHARACTER TRAITS (CHAR-01 / DEC-26; rules.characterTraits 'pilot', the DEV ruleset dev-1410c).
// One clear power per playable character — PROPOSALS for Piotr, not approved numbers. Chosen to be: one sentence
// for a child, no new counter, useful in play, no effect on a duel (no Growth, money or HP comes out of PvP), and the
// same at a cardboard table. The whole module switches off with the rule (an older game never has a trait).
//   ash    after a WON hard battle (a trainer, Team Rocket, a gym, the League) the Pokémon standing gets +1 Growth
//          (if it can still grow, never at a place the Pokémon know already — fatigue)
//   misty  catching a Water-type Pokémon: the Catch Die one colour easier
//   brock  resting heals 1 ❤ more
//   gary   a species NEW to his Pokédex caught: +1 💰
export const CHARACTER_TRAITS = Object.freeze({
  ash: Object.freeze({ id: 'ash', name: 'Never give up', pl: 'Nigdy się nie poddaje', text: 'Wygrana walka z trenerem, Team Rocket, salą lub Ligą: Pokémon, który ją skończył, dostaje +1 trening.' }),
  misty: Object.freeze({ id: 'misty', name: 'Water friend', pl: 'Przyjaciółka wody', text: 'Łapanie Pokémona typu Wodnego: kostka łapania o jeden kolor łatwiejsza.' }),
  brock: Object.freeze({ id: 'brock', name: 'Caretaker', pl: 'Opiekun', text: 'Odpoczynek leczy o 1 ❤ więcej.' }),
  gary: Object.freeze({ id: 'gary', name: 'Researcher', pl: 'Badacz', text: 'Złapany gatunek, którego jeszcze nie było w Pokédexie: +1 💰.' }),
});
