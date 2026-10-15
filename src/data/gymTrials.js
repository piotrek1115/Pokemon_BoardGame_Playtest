// Build 3.3 E5 — randomized Gym Trials, a PILOT for three existing gyms (rules.gymTrials
// 'pilot'; docs/BUILD_3_3_SPEC.md §13.7.4). DESIGN DIRECTION APPROVED; the mix, the
// content and every number are NOT — this is reversible DEV content.
// At game creation each pilot gym draws ONCE (its own stream, state.trialRng) a mode:
//   open    — no trial: the gym is open as before;
//   short   — one small local goal;
//   special — a thematic pair of goals.
// A trial is a quest-book entry (the same engine — engine/questBookEngine.js) with
// repeat 'never', no mission slot, no reward: completing it is the gym's credential
// (gymEngine.gymUnlock 'trial', monotone). Knowledge is per player: a player learns a
// gym's trial on first arriving in its city (a start city counts). Every goal has a
// guaranteed path — a signature species of a reachable land place (the guarantee meets
// one within 3 Explores), an Explore, or a quest challenge that is always there; never
// a rare spawn, an event or a Rocket plot. The other three gyms keep open access.
export const GYM_TRIALS = {
  pilot: {
    pewter: {
      short: [{ id: 'trial-pewter-rock', gym: 'pewter', giver: 'gym', repeat: 'never', stages: [{ objectives: [{ kind: 'catch', types: ['rock', 'ground'], count: 1 }] }], reward: [] }],
      special: [{
        id: 'trial-pewter-mtmoon', gym: 'pewter', giver: 'gym', repeat: 'never', reward: [],
        stages: [{ objectives: [{ kind: 'explore', place: 'mt-moon', times: 1 }, { kind: 'challenge', place: 'mt-moon', name: 'Super Nerd', archetype: 'scientist', teams: [['geodude'], ['geodude', 'zubat'], ['graveler', 'golbat']] }] }],
      }],
    },
    cerulean: {
      short: [{ id: 'trial-cerulean-water', gym: 'cerulean', giver: 'gym', repeat: 'never', stages: [{ objectives: [{ kind: 'catch', types: ['water'], count: 1 }] }], reward: [] }],
      special: [{
        id: 'trial-cerulean-show', gym: 'cerulean', giver: 'gym', repeat: 'never', reward: [],
        stages: [{ objectives: [{ kind: 'explore', place: 'route-24', times: 1 }, { kind: 'challenge', place: 'cerulean-city', name: 'Sisters Show', archetype: 'swimmer', teams: [['goldeen'], ['staryu', 'horsea'], ['seaking', 'starmie']] }] }],
      }],
    },
    vermilion: {
      short: [{ id: 'trial-vermilion-route11', gym: 'vermilion', giver: 'gym', repeat: 'never', stages: [{ objectives: [{ kind: 'explore', place: 'route-11', times: 1 }] }], reward: [] }],
      special: [{
        id: 'trial-vermilion-spark', gym: 'vermilion', giver: 'gym', repeat: 'never', reward: [],
        stages: [{ objectives: [{ kind: 'catch', types: ['electric'], count: 1 }, { kind: 'challenge', place: 'route-11', name: 'Engineer', archetype: 'scientist', teams: [['voltorb'], ['magnemite', 'voltorb'], ['electrode', 'magneton']] }] }],
      }],
    },
  },
};

export const ALL_TRIALS = Object.values(GYM_TRIALS.pilot).flatMap((g) => [...g.short, ...g.special]);
