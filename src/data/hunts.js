// Build 3.3 E4 — rare hunts MVP (rules.hunts 'pilot'; docs/BUILD_3_3_SPEC.md §11.2).
// A hunt is a SHARED world event: an exceptional strong (never legendary) Pokémon at
// one place for a limited time. A clue is PERSONAL knowledge: its holder knows the
// place and meets the Pokémon on the first Explore there; without one, the hunt
// shows only its region, and an Explore at the place meets it on a 6 (a hunt die).
// Never a sure catch: the exceptional Pokémon has +HP, ⚡ First Strike, and its
// Catch Die is one step harder. Whoever catches it ends the hunt for everyone.
// CONTENT AND NUMBERS ARE A PROVISIONAL DEV PILOT (3 curated hunts; DEC-10, DEC-30).
export const HUNTS = {
  pilot: [
    { id: 'hunt-arcanine', species: 'arcanine', place: 'route-8', region: ['route-7', 'route-8', 'lavender-town'] },
    { id: 'hunt-gyarados', species: 'gyarados', place: 'route-12', region: ['route-11', 'route-12', 'route-13'] },
    { id: 'hunt-scyther', species: 'scyther', place: 'safari-zone', region: ['fuchsia-city', 'safari-zone', 'route-14'] },
  ],
};
