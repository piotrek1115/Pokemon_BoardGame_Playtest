// Team Rocket plot cards (Step 4, V3 "Rocket Plots" + Meowth balloon).
// One shared deck; at most one plot is active. When a plot is revealed, the
// Team Rocket balloon is placed on its location and stays there until someone
// beats Rocket (no timer). Plots never sit on a Poké Stop hub, never block
// healing and never cut a place off (tested in tests/rocket.test.js).
//
//   location     where the balloon is placed (for a roaming card: the start)
//   effect       what the plot does while it is active:
//                exploreRocket  exploring here finds only Rocket (a Rocket battle,
//                               no encounter roll; the Explore action pays for it)
//                noCatch        Poké Balls can't be thrown at wild Pokémon here
//                ambush         entering here with a healthy Pokémon starts a
//                               Rocket battle (no extra action)
//                closed         nobody can enter here; anyone inside can leave
//                blockEdge      the edge `edge` is closed both ways (never a bridge)
//                pitfall        entering here ends your turn (no battle)
//   challengeFrom  extra places where "Challenge Rocket" is allowed (besides
//                the balloon's own location), e.g. both ends of a blocked edge
//   meowth       Meowth joins Jessie and James in the battle (stronger plots)
//   reward       for whoever beats Rocket; types as on mission cards, never stars
//                (DQ-27): money | pokeballs | superball | potion | revive
//   movement     roaming cards only: { route: [location ids] }. At the start of
//                each week the balloon moves one step along the route; at the
//                end it lands and waits. Max 1 roaming card in the deck.
//
// Battle team (CONFIG.rocket): Jessie's Ekans + James's Koffing, Arbok + Weezing
// from week CONFIG.rocket.evolvedFromWeek, plus Meowth on `meowth` cards.

export const ROCKET_EFFECTS = ['exploreRocket', 'noCatch', 'ambush', 'closed', 'blockEdge', 'pitfall'];

export const ROCKET_PLOTS = [
  {
    id: 'tower-ghosts', icon: '👻', title: 'Pokémon Tower ghosts', location: 'lavender-town',
    flavor: "Boo! It's only Jessie in a bedsheet… and Meowth in a ghost costume.",
    text: 'Exploring Lavender Town finds only Team Rocket.',
    effect: { kind: 'exploreRocket' }, meowth: true,
    reward: [{ type: 'revive', amount: 1 }],
  },
  {
    id: 'fossil-thieves', icon: '🦴', title: 'Fossil thieves', location: 'mt-moon',
    flavor: 'James is digging up Moon Stones and fossils to sell.',
    text: 'Exploring Mt. Moon finds only Team Rocket.',
    effect: { kind: 'exploreRocket' },
    reward: [{ type: 'money', amount: 3 }],
  },
  {
    id: 'safari-poachers', icon: '🥅', title: 'Safari poachers', location: 'safari-zone',
    flavor: "Meowth's giant net is spread over the tall grass.",
    text: "No catching in the Safari Zone until Rocket is beaten.",
    effect: { kind: 'noCatch' },
    reward: [{ type: 'superball', amount: 1 }, { type: 'money', amount: 1 }],
  },
  {
    id: 'route9-ambush', icon: '🌿', title: 'Route 9 ambush', location: 'route-9',
    flavor: '"Prepare for trouble!" — from behind the bushes.',
    text: 'Entering Route 9 with a healthy Pokémon starts a Rocket battle.',
    effect: { kind: 'ambush' },
    reward: [{ type: 'money', amount: 2 }, { type: 'pokeballs', amount: 1 }],
  },
  {
    id: 'diglett-cave-in', icon: '🕳️', title: "Diglett's Cave cave-in", location: 'digletts-cave',
    flavor: "Rocket's giant drill collapsed the tunnel.",
    text: "Nobody can enter Diglett's Cave. Challenge Rocket from Route 2 or Route 11.",
    effect: { kind: 'closed' }, challengeFrom: ['route-2', 'route-11'],
    reward: [{ type: 'money', amount: 3 }],
  },
  {
    id: 'route6-roadblock', icon: '🚧', title: 'Route 6 roadblock', location: 'route-6',
    flavor: 'A Team Rocket "toll booth" in the middle of the road.',
    text: 'Entering Route 6 with a healthy Pokémon starts a Rocket battle.',
    effect: { kind: 'ambush' },
    reward: [{ type: 'money', amount: 2 }, { type: 'potion', amount: 1 }],
  },
  {
    id: 'cycling-road', icon: '🚲', title: 'Cycling Road blockade', location: 'route-17',
    flavor: "Jessie's old biker gang has parked across Cycling Road.",
    text: 'The road between Route 16 and Route 17 is closed. Challenge Rocket from Route 16 or Route 17.',
    effect: { kind: 'blockEdge', edge: ['route-16', 'route-17'] }, challengeFrom: ['route-16'],
    reward: [{ type: 'potion', amount: 1 }, { type: 'money', amount: 1 }],
  },
  {
    id: 'route22-pitfall', icon: '🪤', title: 'Pitfall on Route 22', location: 'route-22',
    flavor: '"We dug a hole!" — a pitfall trap hidden under the leaves.',
    text: 'Entering Route 22 drops you into the pitfall: your turn ends.',
    effect: { kind: 'pitfall' },
    reward: [{ type: 'pokeballs', amount: 1 }, { type: 'money', amount: 2 }],
  },
  {
    id: 'balloon-getaway', icon: '🎈', title: 'Team Rocket on the run!', location: 'saffron-city',
    flavor: 'The Meowth balloon floats away with a sack of stolen Poké Balls.',
    text: 'The balloon moves 1 step along the arrow at the start of every week and lands at Route 15. Exploring where it is finds only Rocket.',
    effect: { kind: 'exploreRocket' }, meowth: true,
    movement: { route: ['saffron-city', 'route-8', 'lavender-town', 'route-12', 'route-13', 'route-14', 'route-15'] },
    reward: [{ type: 'revive', amount: 1 }],
  },
];

export const ROCKET_PLOTS_BY_ID = Object.fromEntries(ROCKET_PLOTS.map((p) => [p.id, p]));

export const ROCKET_REWARD_TYPES = ['money', 'pokeballs', 'superball', 'potion', 'revive'];
