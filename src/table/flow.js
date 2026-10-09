// Tabletop flow logic with no DOM: which physical die an action still needs,
// the reveal steps an action produced (to animate after the engine resolved
// it), the outcome line, and which balls the family UI offers (DQ-69 guard).
// The engine stays the single source of truth; nothing here changes rules.
import { dispatch } from '../engine/turnEngine.js';
import { currentPlayer } from '../engine/gameState.js';
import { catchBlocked } from '../engine/rocketEngine.js';
import { catchDie } from '../engine/captureEngine.js';
import { itemCount } from '../engine/itemEngine.js';
import { encounterOutcomeFromRoll, rarityFromRoll } from '../engine/encounterEngine.js';
import { getSpecies } from '../data/pokemon.js';
import { GYMS_BY_ID } from '../data/gyms.js';
import { EVENTS_BY_ID } from '../data/events.js';
import { describeNeed } from './dice.js';
import { BALL_PL, ITEM_PL, OUTCOME_PL, RARITY_PL } from './i18n.js';
import { effectsPl, eventPl, plotPl, questPl, rewardPl, thingPl, trainerPl } from './content-pl.js';

const MEANING_PL = {
  'no plot this week': 'W tym tygodniu spokój.', 'a plot is revealed!': 'Team Rocket knuje spisek!',
  easy: 'łatwy przeciwnik', medium: 'średni przeciwnik', hard: 'trudny przeciwnik',
  'a Poké Ball (never the last)': 'Poké Ball (nigdy ostatni)', 'an item of your choice': 'przedmiot do wyboru', 'Meowth trips!': 'Meowth się potyka!',
};
const meaningPl = (text) => MEANING_PL[text] ?? (/^up to (\d+) money$/.test(text) ? `do 💰${/\d+/.exec(text)[0]}` : '');

// Dry run on a copy: the first die this action would roll that the dice mode
// wants from a physical die, given the values already entered. null = none.
export function nextPhysicalNeed(state, action, entered = []) {
  // The engine never reads the log, so the copy leaves it behind (much faster).
  const sim = structuredClone({ ...state, log: [] });
  if (entered.length && !dispatch(sim, { type: 'enterDice', values: entered }).ok) return null;
  const mark = sim.log.length;
  const roller = currentPlayer(sim);
  if (!dispatch(sim, action).ok) return null;
  const miss = sim.log.slice(mark).find((e) => e.data?.missingPhysical);
  return miss ? describeNeed(miss.data, roller) : null;
}

// P1.5b dice rolled by this device (settings „Pełny automat” / „Cyfrowe —
// kliknij rzut”): a d6 face mapped onto the die the game asks for — the Catch
// Die shows a ball on its high `successFaces` faces, the Escape Die the wind on
// its high `fleeFaces` faces, as the real dice do. The value then goes in
// through enterDice exactly like a real die (save and replay stay exact).
export function faceToDie(need, face, config) {
  if (need.type === 'catch') return face > 6 - config.capture.catchDice[need.colour].successFaces ? 'ball' : 'blank';
  if (need.type === 'escape') return face > 6 - config.capture.escapeDice[need.colour].fleeFaces ? 'flee' : 'stay';
  return face;
}

// Build 2.4 team order (drag a card in the player popup): the setLead actions —
// the existing free „put in front” — that turn `team` into the order with the
// Pokémon `uid` at place `to`. The new order's first k + 1 Pokémon go in front,
// last to first, k as small as possible (the rest keeps its order). null when
// nothing moves; { blocked: true } when a fainted Pokémon would have to be put
// in front (setLead never takes a fainted one — the faint rule stays).
export function reorderPlan(team, uid, to) {
  const from = team.findIndex((m) => m.uid === uid);
  if (from < 0 || to < 0 || to >= team.length || from === to) return null;
  const order = team.filter((m) => m.uid !== uid);
  order.splice(to, 0, team[from]);
  const rest = (k) => team.filter((m) => !order.slice(0, k + 1).includes(m));
  let k = 0;
  while (k < order.length - 1 && !rest(k).every((m, i) => m === order[k + 1 + i])) k += 1;
  const front = order.slice(0, k + 1);
  if (front.some((m) => m.hp <= 0)) return { blocked: true };
  // simulate the moves: skip one that would find its Pokémon already in front
  const now = [...team];
  const actions = [];
  for (const m of [...front].reverse()) {
    if (now[0] === m) continue;
    now.splice(now.indexOf(m), 1);
    now.unshift(m);
    actions.push({ type: 'setLead', target: m.uid });
  }
  return { actions, order: now.map((m) => m.uid) };
}

// What to animate, in order, from the log entries an action added.
export function buildReveal(state, from) {
  const steps = [];
  for (const e of state.log.slice(from)) {
    const d = e.data;
    if (!d) continue;
    if (d.attack) {
      steps.push({ type: 'attack', ...d.attack });
    } else if (d.die === 'catch') {
      steps.push({ type: 'catch', colour: d.colour, face: d.result, reroll: d.reroll, physical: d.source === 'physical' });
    } else if (d.die === 'escape') {
      steps.push({ type: 'escape', colour: d.colour, face: d.result, physical: d.source === 'physical' });
    } else if (d.escape?.secondChance) {
      steps.push({ type: 'note', text: 'Druga szansa — zostaje bez rzutu!' });
    } else if (d.switch) {
      steps.push({ type: 'switch', ...d.switch });
    } else if (d.growth) {
      steps.push({ type: 'growth', ...d.growth });
    } else if (d.item?.battle) {
      steps.push({ type: 'note', text: `${d.item.id === 'potion' ? '🧪 Potion' : '💎 Revive'}: ${getSpecies(d.item.species).name} — zamiast ataku.` });
    } else if (d.rocket) {
      const r = d.rocket;
      if (r.event === 'plot') steps.push({ type: 'plot', plot: r.plot });
      else if (r.event === 'drift') steps.push({ type: 'drift', ...r });
      else if (r.event === 'battle') steps.push({ type: 'rocketBattle', trigger: r.trigger });
      else if (r.event === 'loot') steps.push({ type: 'loot', ...r });
      else if (r.event === 'lootBack') steps.push({ type: 'lootBack', ...r, ownerName: state.players.find((p) => p.id === r.owner)?.name ?? '' });
      else if (r.event === 'blastOff') steps.push({ type: 'blastOff' });
      else if (r.event === 'pitfall') steps.push({ type: 'pitfall' });
      else if (r.event === 'nothing') steps.push({ type: 'note', text: '😼 Meowth nic nie zabrał!' });
    } else if (d.event && d.choice === undefined) {
      // Drawn event: one that resolves at once shows its card and effects here;
      // one with choices waits on the table as an Event Card.
      const ev = EVENTS_BY_ID[d.event];
      if (!ev.choices?.length) steps.push({ type: 'event', event: d.event, effects: effectsPl(ev.effects ?? []) });
    } else if (d.event && d.choice !== undefined) {
      const ev = eventPl(d.event);
      steps.push({ type: 'eventChoice', label: ev.choices[d.choice]?.label ?? '', effects: effectsPl(EVENTS_BY_ID[d.event].choices[d.choice]?.effects ?? []) });
    } else if (e.kind === 'roll' && d.sides === 6 && d.label === 'Encounter') {
      steps.push({ type: 'explore', value: d.value, outcome: OUTCOME_PL[encounterOutcomeFromRoll(d.value, state.config)] });
    } else if (e.kind === 'roll' && d.sides === 6 && d.label === 'Rarity') {
      const bonus = /\+(\d) bonus/.exec(e.text);
      const total = Math.min(6, d.value + (bonus ? Number(bonus[1]) : 0));
      steps.push({ type: 'rarity', value: d.value, total, rarity: rarityFromRoll(total, state.config), label: RARITY_PL[rarityFromRoll(total, state.config)] });
    } else if (e.kind === 'roll' && d.sides === 6 && !/ attacks /.test(d.label) && d.label !== 'Capture') {
      const meaning = e.text.split(' -> ')[1] ?? '';
      steps.push({ type: 'd6', label: d.label, value: d.value, meaning: meaningPl(meaning) });
    }
  }
  return steps;
}

// One family-language line for how an encounter / challenge ended, comparing
// the state before and after the action. null when nothing ended.
// While a result banner is up after the acting player's last action, the HUD
// keeps showing that player (their money, their team) — the next player's turn
// is shown only after the banner is closed (Post-playtest Build 2, P0).
export function displayView(state, hold) {
  if (!hold || (state.turn.playerIndex === hold.playerIndex && state.turn.round === hold.round)) return state;
  return { ...state, turn: { ...state.turn, playerIndex: hold.playerIndex, round: hold.round, actionsRemaining: 0 } };
}

export function outcomeSummary(before, after, action) {
  const pb = before.players.find((p) => p.id === currentPlayer(before).id);
  const pa = after.players.find((p) => p.id === pb.id);
  const enc = before.encounter;
  const ended = enc && (!after.encounter || after.encounter !== enc) && after.phase !== 'encounter';
  // Post-playtest Build 2 (P0): the banner says WHOSE money changed and the
  // balance ("Ash · 💰 6 → 10") — the turn may already have passed.
  const plus = pa.stars > pb.stars ? ` +⭐${pa.stars - pb.stars}` : '';
  const wallet = pa.money !== pb.money ? { name: pa.name, color: pa.color, from: pb.money, to: pa.money } : null;
  const result = outcomeSummaryText(before, after, action, { pb, pa, enc, ended, plus });
  return result && wallet ? { ...result, wallet } : result;
}

function outcomeSummaryText(before, after, action, { pb, pa, enc, ended, plus }) {
  // Build 2.5.1 (Piotr: „nie wiem, które zadanie wymieniam na wskazane”): the
  // swap names the mission given back and the new one.
  if (action.type === 'swapQuest') {
    const gone = questPl(action.target).title;
    const fresh = pa.quests.find((q) => !pb.quests.some((o) => o.questId === q.questId));
    if (!fresh) return { tone: 'neutral', title: 'Misja oddana', text: `Oddajesz: ${gone}. Talia misji jest pusta — nowej nie ma.` };
    const q = questPl(fresh.questId);
    return { tone: 'neutral', title: 'Nowa misja!', text: `Oddajesz: ${gone}. Dostajesz: ${q.title} — ${q.text}` };
  }
  if (action.type === 'evolve') {
    const was = pb.team.find((m) => m.uid === action.target);
    const now = pa.team.find((m) => m.uid === action.target);
    if (was && now && was.species !== now.species) {
      return { tone: 'win', title: '✨ Ewolucja!', text: `${getSpecies(was.species).name} → ${getSpecies(now.species).name}`, evolved: now.uid };
    }
  }
  if (pa.league?.champion && !pb.league?.champion) return { tone: 'win', title: '👑 MISTRZ LIGI POKÉMON!', text: `${pa.name} pokonuje Lance’a!${plus}` };
  const newBadge = pa.badges?.find((b) => !pb.badges?.includes(b));
  if (newBadge) {
    const gym = GYMS_BY_ID[newBadge];
    return { tone: 'win', title: `🏅 ${gym.badge}!`, text: `Odznaka trafia do gabloty.${plus}`, badge: newBadge };
  }
  if (!enc || !ended) return null;
  const name = enc.kind === 'wild' ? getSpecies(enc.pokemon.species).name : null;
  if (action.type === 'run' && enc.kind === 'trainer') {
    const r = after.log.slice(before.log.length).find((e) => e.data?.retreat)?.data.retreat;
    const paid = !r || r.penalty === 'none' ? 'Bez kary — nie było czego zostawić.' : r.penalty === 'money' ? 'Kosztowało 💰1.' : `Zostawiasz trenerowi: ${ITEM_PL[r.penalty]}.`;
    return { tone: 'neutral', title: '🏃 Wycofanie z walki', text: `${paid} Punkty treningu za pokonane wcześniej Pokémony zostają.` };
  }
  if (action.type === 'run') return null;
  if (enc.kind === 'wild') {
    if (pa.pokedex.caught.length > pb.pokedex.caught.length || pa.team.length + pa.reserve.length > pb.team.length + pb.reserve.length) {
      return { tone: 'win', title: `ZŁAPANY! ${name}`, text: `${name} dołącza do drużyny.${plus}` };
    }
    if (action.type === 'throwBall') return { tone: 'lose', title: `${name.toUpperCase()} UCIEKŁ!`, text: 'Pokémon zniknął w trawie.' };
    const opp = after.log.slice(before.log.length).some((e) => /fainted and can no longer be caught/.test(e.text));
    if (opp) return { tone: 'neutral', title: `${name} zemdlał`, text: `Zemdlonego Pokémona nie da się złapać.${plus}` };
    return { tone: 'lose', title: 'Twoje Pokémony zemdlały', text: `${name} odchodzi. Odwiedź Poké Stop albo użyj Revive.` };
  }
  if (enc.kind === 'rocket') {
    const card = plotPl(enc.plotId);
    if (!after.rocket?.active) return { tone: 'win', title: 'Team Rocket znowu odlatuje! ✨', text: `Spisek „${card.title}” pokonany. Nagroda: ${rewardPl(card.reward)}. Łupy wracają do właścicieli.` };
    const grabbed = after.rocket.active.loot.length > (before.rocket?.active?.loot.length ?? 0);
    return { tone: 'lose', title: 'Team Rocket wygrywa tym razem…', text: after.phase === 'loot' ? 'Meowth chce przedmiot — wybierz, co oddasz.' : grabbed ? `Meowth zabrał ${thingPl(after.rocket.active.loot.at(-1).item, after.rocket.active.loot.at(-1).amount)} na kartę spisku.` : 'Meowth nic nie zabrał.' };
  }
  if (enc.kind === 'gym') return { tone: 'lose', title: 'Przegrana w sali', text: 'Nic nie tracisz — spróbuj w kolejnej turze.' };
  if (enc.kind === 'league') {
    if (after.phase === 'league') return { tone: 'win', title: '🎀 Elitarna Czwórka pokonana!', text: 'Wstęga trafia do gabloty. Przerwa przed walką z Lance’em.', ribbon: true };
    if (pa.league?.ribbon) return { tone: 'lose', title: 'Lance tym razem wygrywa', text: 'Masz 🎀 Wstęgę: następne wyzwanie Ligi zaczniesz od razu od Lance’a.' };
    return { tone: 'lose', title: 'Przegrana z Elitarną Czwórką', text: 'Wylecz drużynę i spróbuj znowu.' };
  }
  const trainer = enc.trainer ? trainerPl(enc.trainer).name : 'Trener';
  const won = pa.money > pb.money || pa.stars > pb.stars;
  return won ? { tone: 'win', title: `Wygrana z: ${trainer}!`, text: `Brawo!${plus}` } : { tone: 'lose', title: `${trainer} wygrywa`, text: 'Twoje Pokémony potrzebują odpoczynku — Poké Stop albo Revive.' };
}

// The balls the family UI offers against the current wild Pokémon, with the
// Catch Die each would use. A Super Ball that adds nothing while a Poké Ball
// is in hand is not offered (DQ-69 UX guard) — it is never spent by accident.
export function ballOptions(state) {
  const player = currentPlayer(state);
  const enc = state.encounter;
  if (state.phase !== 'encounter' || enc?.kind !== 'wild') return [];
  const blocked = catchBlocked(state, player);
  const pokeballs = itemCount(player, 'pokeball');
  return ['pokeball', 'superball'].map((ball) => {
    const count = itemCount(player, ball);
    const die = catchDie(enc.pokemon, ball, state.config);
    const noBonus = ball === 'superball' && die.ballEffect === 'none';
    let note = '';
    let usable = count > 0 && !blocked;
    if (noBonus && count > 0) {
      if (pokeballs > 0) {
        usable = false;
        note = 'Super Ball nie daje tu dodatkowego bonusu. Użyj zwykłego Poké Balla.';
      } else {
        note = 'Brak dodatkowego bonusu, ale możesz go użyć.';
      }
    }
    if (blocked) note = 'Team Rocket nie pozwala tu łapać.';
    return { ball, name: BALL_PL[ball], count, die, usable, note, noBonus };
  });
}
