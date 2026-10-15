// Tabletop flow logic with no DOM: which physical die an action still needs,
// the reveal steps an action produced (to animate after the engine resolved
// it), the outcome line, and which balls the family UI offers (DQ-69 guard).
// The engine stays the single source of truth; nothing here changes rules.
import { isNotice } from './notices.js';
import { dispatch } from '../engine/turnEngine.js';
import { currentPlayer } from '../engine/gameState.js';
import { catchBlocked } from '../engine/rocketEngine.js';
import { throwDie } from '../engine/captureEngine.js';
import { itemCount } from '../engine/itemEngine.js';
import { encounterOutcomeFromRoll, rarityFromRoll } from '../engine/encounterEngine.js';
import { getSpecies } from '../data/pokemon.js';
import { STATUS_DEFINITIONS } from '../combat2/statuses.js';
import { researchReward, usesResearch } from '../engine/oakEngine.js';
import { ALL_ACHIEVEMENTS } from '../data/achievements.js';
import { SIGNATURE_MOVES } from '../data/signatureMoves.js';
import { GYMS_BY_ID } from '../data/gyms.js';
import { EVENTS_BY_ID } from '../data/events.js';
import { describeNeed } from './dice.js';
import { BALL_PL, ITEM_PL, OUTCOME_PL, RARITY_PL, turnsPl } from './i18n.js';
import { QUESTBOOK_PL, RUMOUR_PL, effectsPl, eventPl, placeName, plotPl, questPl, rewardPl, thingPl, trainerPl } from './content-pl.js';

const MEANING_PL = {
  'no plot this week': 'W tym tygodniu spokój.', 'a plot is revealed!': 'Team Rocket knuje spisek!',
  easy: 'łatwy przeciwnik', medium: 'średni przeciwnik', hard: 'trudny przeciwnik',
  'a bite!': 'Bierze!', 'nothing bites': 'Nic nie bierze…', // bonus 14.10: the Old Rod
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
  // One Kanto day 14.10: in a duel the attacker rolls (not always the player whose turn it is)
  const roller = action.type === 'pvpAttack' ? sim.players.find((p) => p.id === action.by) : currentPlayer(sim);
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

// Build 3.3 ⚡: one sentence per First Strike moment (no numbers).
function firstStrikePl(state, fs) {
  const mine = (uid) => state.players.flatMap((p) => p.team.concat(p.reserve)).find((m) => m.uid === uid);
  const name = (mon) => (mon ? getSpecies(mon.species).name : 'Pokémon');
  const enc = state.encounter;
  const foe = fs.opponent ? getSpecies(fs.opponent).name : enc ? name(enc.kind === 'wild' ? enc.pokemon : enc.trainer.pokemonTeam[enc.index]) : 'przeciwnik';
  if (fs.event === 'opponent') return `${foe} jest szybki — atakuje pierwszy!`;
  if (fs.event === 'player') return `${name(mine(fs.uid))} jest szybki — jego pierwszy ruch będzie bez odpowiedzi.`;
  if (fs.event === 'switchIn') return `${name(mine(fs.uid))} wchodzi szybko — przeciwnik nie zdążył zaatakować.`;
  if (fs.event === 'unanswered') return `${name(mine(fs.uid))} był szybszy — przeciwnik nie zdążył oddać.`;
  return 'Oba Pokémony są szybkie — nikt nie ma przewagi.';
}

// What to animate, in order, from the log entries an action added.
// PLAYTEST_007 stage 3: `skipNotices` (the table) leaves the IMPORTANT world events out — they wait for „ROZUMIEM”
// after the battle and its result (table/notices.js), never flash for a second, never inside the battle HUD.
export function buildReveal(state, from, { skipNotices = false } = {}) {
  const steps = [];
  for (const e of state.log.slice(from)) {
    const d = e.data;
    if (!d) continue;
    if (skipNotices && isNotice(state, e)) continue;
    if (d.attack) {
      steps.push({ type: 'attack', ...d.attack });
    } else if (d.die === 'catch') {
      steps.push({ type: 'catch', colour: d.colour, face: d.result, reroll: d.reroll, physical: d.source === 'physical' });
    } else if (d.die === 'escape') {
      steps.push({ type: 'escape', colour: d.colour, face: d.result, physical: d.source === 'physical', ...(d.trigger ? { trigger: d.trigger } : {}) });
    } else if (d.escape?.temperament === 'aggressive') {
      steps.push({ type: 'note', text: 'AGRESYWNY — nie ucieka! Zostaje w walce.' });
    } else if (d.escape?.secondChance) {
      steps.push({ type: 'note', text: 'Druga szansa — zostaje bez rzutu!' });
    } else if (d.switch) {
      steps.push({ type: 'switch', ...d.switch });
    } else if (d.firstStrike) {
      // Build 3.3 ⚡ „Szybkie wejście” (DEC-12 FS-B): said in the child's words
      steps.push({ type: 'firstStrike', event: d.firstStrike.event, text: firstStrikePl(state, d.firstStrike) });
    } else if (d.growth) {
      steps.push({ type: 'growth', ...d.growth });
    } else if (d.item?.battle) {
      const icon = d.item.id === 'revive' ? '💎' : '🧪';
      steps.push({ type: 'note', text: `${icon} ${ITEM_PL[d.item.id]}: ${getSpecies(d.item.species).name} — ${d.item.free ? 'bez straty ataku.' : 'zamiast ataku.'}` });
    } else if (d.oak?.event === 'return') {
      // Macro 01: the Research Job ends at the start of the owner's turn
      const owner = state.players.find((p) => p.team.concat(p.reserve).some((m) => m.uid === d.oak.uids[0]));
      const names = d.oak.uids.map((uid) => owner?.team.concat(owner.reserve).find((m) => m.uid === uid)).filter(Boolean).map((m) => getSpecies(m.species).name);
      steps.push({ type: 'note', text: `🔬 ${owner ? `${owner.name}: ` : ''}${names.join(', ')} ${names.length > 1 ? 'wracają' : 'wraca'} od Profesora Oaka — ${rewardPl(d.oak.reward)}.` });
    } else if (d.rocket) {
      const r = d.rocket;
      if (r.event === 'plot') steps.push({ type: 'plot', plot: r.plot });
      else if (r.event === 'drift') steps.push({ type: 'drift', ...r });
      else if (r.event === 'battle') steps.push({ type: 'rocketBattle', trigger: r.trigger });
      else if (r.event === 'loot') steps.push({ type: 'loot', ...r });
      else if (r.event === 'lootBack') steps.push({ type: 'lootBack', ...r, ownerName: state.players.find((p) => p.id === r.owner)?.name ?? '' });
      else if (r.event === 'blastOff') steps.push({ type: 'blastOff' });
      else if (r.event === 'escaped') steps.push({ type: 'rocketEscaped', loot: r.loot ?? 0 });
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
    } else if (d.pvp?.event === 'start') {
      // One Kanto day 14.10: a friendly duel
      const who = state.players.find((p) => p.id === d.pvp.first)?.name ?? '';
      steps.push({ type: 'note', text: `⚔️ Pojedynek! Zaczyna ${who}${d.pvp.quick ? ' — jego Pokémon jest szybki' : ''}.` });
    } else if (d.pvp?.event === 'end') {
      const who = state.players.find((p) => p.id === d.pvp.winner)?.name ?? '';
      steps.push({ type: 'note', text: `⚔️ ${who} wygrywa pojedynek! Pokémony wracają do zdrowia.${d.pvp.qualified ? '' : d.pvp.yielded ? ' (Wygrana przez poddanie nie liczy się do trofeów.)' : ' (Do trofeów liczy się jedna wygrana z tym graczem na tydzień.)'}` });
    } else if (d.sigMove && !d.sigMove.drained) {
      // bonus 2 (rules.signatureMoves) — `sigMove`, never M02-1's `signature` (the place's own species)
      steps.push({ type: 'note', text: `✨ ${getSpecies(d.sigMove.species).name}: ${SIGNATURE_MOVES[getSpecies(d.sigMove.species).family]?.pl ?? d.sigMove.move}!` });
    } else if (d.sigMove?.drained) {
      steps.push({ type: 'note', text: `✨ Wysysanie: +${d.sigMove.drained} ❤` });
    } else if (d.moveUse) {
      // Combat MVP (rules.combatMoves): a Special / Powerful move, by its name; a drain says what it gave back
      steps.push({ type: 'note', text: d.moveUse.drained ? `✨ ${d.moveUse.pl}: +${d.moveUse.drained} ❤` : `${d.moveUse.slot === 'powerful' ? '💥' : '✨'} ${getSpecies(d.moveUse.species).name}: ${d.moveUse.pl}!` });
    } else if (d.status?.event && d.status.species) { // Combat MVP (no other log entry has this shape)
      const text = statusNotePl(d.status);
      if (text) steps.push({ type: 'note', text });
    } else if (d.trait) {
      // bonus 2, 14.10 (rules.characterTraits): a character's trait, in one line
      const who = state.players.find((p) => p.id === d.trait.player)?.name ?? '';
      const text = { ash: () => `⭐ ${who} nigdy się nie poddaje: +1 trening (${d.trait.growth}/${d.trait.threshold})!`, brock: () => `💤 Opieka ${who}a: +1 ❤ więcej.`, gary: () => `🔬 ${who} bada nowy gatunek: +1 💰.` }[d.trait.id];
      if (text) steps.push({ type: 'note', text: text() });
    } else if (d.fishing?.event === 'bite') {
      steps.push({ type: 'note', text: `🎣 Coś bierze — dziki ${getSpecies(d.fishing.species).name}!` }); // bonus 14.10
    } else if (d.book?.event === 'keyItem') {
      steps.push({ type: 'note', text: `🎣 Masz Starą wędkę! Łów w miejscu z wodą (1 akcja).` });
    } else if (d.achievement) {
      // One Kanto day 14.10: ACHIEVEMENT UNLOCKED — short, no modal
      const a = ALL_ACHIEVEMENTS.find((x) => x.id === d.achievement.id);
      const who = state.players.find((p) => p.id === d.achievement.player)?.name ?? '';
      steps.push({ type: 'note', text: `🏆 ${a.name} — ${who}: ${a.pl}!` });
    } else if (d.rumour?.event === 'heard') {
      // PLAYTEST_006 C5: the rumour card — WHO heard it (a rumour at the start of a turn arrives with the previous
      // player's „Koniec tury”), one sentence, where to take it
      const who = state.players.find((p) => p.id === (d.rumour.player ?? e.player))?.name;
      steps.push({ type: 'note', text: `📜 ${who ? `${who} słyszy plotkę` : 'Plotka'}: ${RUMOUR_PL[d.rumour.id] ?? ''} 📍 ${placeName(d.rumour.start)}${d.rumour.from === 'local' ? ' — to tutaj!' : ''}` });
    } else if (d.book?.event === 'encounter') {
      // PLAYTEST_006 C4: the expedition's encounter starts — what to do, in the child's words
      steps.push({ type: 'note', text: `📜 Wyprawa: ${getSpecies(d.book.species).name} jest tutaj! Złap go — jeśli pokonasz go do zera, ucieknie.` });
    } else if (d.book?.event === 'show') {
      steps.push({ type: 'note', text: `📜 Marynarz ogląda: ${d.book.species.map((sp) => getSpecies(sp).name).join(', ')} — zadanie wykonane!` }); // day 14
    } else if (d.book?.event === 'give') {
      steps.push({ type: 'note', text: `📜 Oddajesz ${d.book.count}× ${ITEM_PL[d.book.item] ?? d.book.item} — zadanie wykonane!` }); // day 14
    } else if (d.book?.event === 'encounterLost') {
      steps.push({ type: 'note', text: `📜 Wyprawa trwa: poszukaj go jeszcze raz — jedna eksploracja tutaj, a ${getSpecies(d.book.species).name} znów się pokaże.` }); // R2
    } else if (d.book?.event === 'newTrail') {
      steps.push({ type: 'note', text: `📜 Są ślady! ${getSpecies(d.book.species).name} jest blisko — spotkanie z wyprawy znów czeka (1 akcja).` });
    } else if (d.capture?.sure) {
      // PT006-09 measurement 'G1' / 'G2': a Great Ball on a trivial Pokémon — no die
      steps.push({ type: 'note', text: '✓ Great Ball — łatwy Pokémon: pewne złapanie!' });
    } else if (d.rarityFallback) {
      // PT006-01: a Super Rare roll at a place with no Super Rare brings a Rare one — the tray says
      // what appears (◆◆ Arcanine), not only what was rolled (◆◆◆)
      const last = steps.findLast((s) => s.type === 'rarity');
      if (last) Object.assign(last, { rarity: d.rarityFallback.rarity, label: RARITY_PL[d.rarityFallback.rarity], rolled: d.rarityFallback.rolled });
    } else if (d.fatigue) {
      // M02-2: a searched place — said once per Explore, in the child's words
      if (d.fatigue.quiet) {
        // the die is right, the place changed what it means — said so, for physical dice too (ChatGPT 15:08)
        const last = steps.findLast((s) => s.type === 'explore');
        if (last) last.outcome = `Cisza… Wypadło ${last.value}, ale Pokémony tutaj już Cię znają i chowają się. Nie rzucasz drugi raz.`;
      } else if (d.fatigue.level) steps.push({ type: 'note', text: `${'👣'.repeat(d.fatigue.level)} Pokémony tutaj już Cię znają. Trening tu nic nie da — ruszaj dalej!` });
    } else if (e.kind === 'roll' && d.sides === 6 && d.label === 'Encounter') {
      steps.push({ type: 'explore', value: d.value, outcome: OUTCOME_PL[encounterOutcomeFromRoll(d.value, state.config)] });
    } else if (e.kind === 'roll' && d.sides === 6 && d.label === 'Rarity') {
      const bonus = /\+(\d) bonus/.exec(e.text);
      const total = Math.min(6, d.value + (bonus ? Number(bonus[1]) : 0));
      steps.push({ type: 'rarity', value: d.value, total, rarity: rarityFromRoll(total, state.config), label: RARITY_PL[rarityFromRoll(total, state.config)] });
    } else if (e.kind === 'roll' && d.sides === 6 && !/ attacks /.test(d.label) && d.label !== 'Capture' && !/^Status: /.test(d.label)) { // Combat MVP: a status roll is said in its note
      const meaning = e.text.split(' -> ')[1] ?? '';
      steps.push({ type: 'd6', label: d.label, value: d.value, meaning: meaningPl(meaning) });
    }
  }
  return steps;
}

// PLAYTEST_007 stage 2A (PT007-04): a battle that OPENS in this action with ⚡ „Szybkie wejście” (or any
// opening exchange) must not be played over the map before the arena exists. The reveal is cut in two:
//   head  — what led to the battle (the explore die, the rarity, an event…), on the map as before;
//   tail  — from the first ⚡ / attack step on, INSIDE the arena: `arena` is the state after the action with the
//           opening damage not yet applied (the player's Pokémon as before the action; a new opponent's HP put
//           back from the step's damage), so the hearts drop when the strike is shown.
// Presentation only: the engine settled the strike once in the dispatch (initiativeEngine.settleEntries) and the
// save holds it settled — a reload never strikes twice. null when the action opened no battle with such steps.
export function splitOpening(before, after, steps) {
  if (before.phase === 'encounter' || after.phase !== 'encounter' || after.encounter?.leadPick || before.pvp) return null;
  const cut = steps.findIndex((s) => s.type === 'firstStrike' || s.type === 'attack');
  if (cut < 0) return null;
  const tail = steps.slice(cut);
  const arena = structuredClone(after);
  const pools = (v) => [...v.players.flatMap((p) => [...p.team, ...(p.reserve ?? [])]), v.encounter?.pokemon, ...(v.encounter?.trainer?.pokemonTeam ?? [])].filter(Boolean);
  const mine = new Map(pools(before).map((m) => [m.uid, m.hp]));
  const seen = new Set();
  for (const st of tail) {
    if (st.type !== 'attack' || seen.has(st.defenderUid)) continue;
    seen.add(st.defenderUid);
    const mon = pools(arena).find((m) => m.uid === st.defenderUid);
    if (mon) mon.hp = mine.has(st.defenderUid) ? mine.get(st.defenderUid) : Math.min(st.maxHp ?? mon.maxHp, (st.hpAfter ?? mon.hp) + (st.damage ?? 0));
  }
  return { head: steps.slice(0, cut), tail, arena };
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
  const wallet = pa.money !== pb.money ? { id: pa.id, name: pa.name, color: pa.color, from: pb.money, to: pa.money } : null;
  const result = outcomeSummaryText(before, after, action, { pb, pa, enc, ended, plus });
  return result && wallet ? { ...result, wallet } : result;
}

function outcomeSummaryText(before, after, action, { pb, pa, enc, ended, plus }) {
  // EREV UI: a quest's reward says what was really paid (the claim's resolved lines)
  if (action.type === 'claimQuest') {
    const claim = after.log.findLast((e) => e.data?.book?.event === 'claim' && e.data.book.occ === action.occ);
    const title = QUESTBOOK_PL[claim?.data.book.quest]?.title ?? 'Zadanie';
    return { tone: 'win', title: `🎁 ${title} — ukończone!`, text: `Nagroda: ${rewardPl(claim?.data.book.reward ?? [])}.` };
  }
  if (action.type === 'takeQuest') return { tone: 'neutral', title: `📜 Nowe zadanie: ${QUESTBOOK_PL[action.quest]?.title ?? action.quest}`, text: 'Jego kroki są w księdze zadań (📜 w prawym górnym rogu).' };
  // Gameplay P1: Leczenie in a Poké Stop (DQ-89) and Oak's Box (DQ-95).
  if (action.type === 'pokeStopHeal') return { tone: 'win', title: 'Drużyna wyleczona!', text: 'Leczenie w Poké Stopie: wszystkie Pokémony w drużynie mają pełne zdrowie.' };
  // Macro 01: Professor Oak (the kit; the last pick starts a Research Job)
  if (action.type === 'oakKit') return { tone: 'win', title: 'Awaryjny Poké Ball!', text: 'Nie masz balli ani pieniędzy, więc dostajesz 1 Poké Ball — raz na grę. Powodzenia!' };
  if (action.type === 'oakJobPick' && pa.oakJob && !pb.oakJob) {
    const spec = after.config.oak.jobs[pa.oakJob.job];
    // One Kanto day 14.10 (rules.oakResearch): the pay this job will bring (new species for Oak or not)
    const research = usesResearch(after) ? researchReward(pa, pa.oakJob.job, pa.oakJob.pokemon.map((m) => m.species)) : null;
    const pay = research ? `${rewardPl(research.reward)}${research.fresh.length ? ' — nowe gatunki dla Oaka!' : ' — Oak już je zna'}` : rewardPl(spec.reward);
    return { tone: 'neutral', title: '🔬 Do pracy u Profesora Oaka!', text: `${pa.oakJob.pokemon.map((m) => getSpecies(m.species).name).join(', ')} — wracają za ${turnsPl(spec.turns)} z nagrodą: ${pay}.` };
  }
  if (action.type === 'boxKeep') {
    const caught = pa.team.find((m) => m.uid === before.boxChoice?.uid);
    const out = pb.team.find((m) => m.uid === action.target);
    return { tone: 'neutral', title: `${caught ? getSpecies(caught.species).name : 'Nowy Pokémon'} w drużynie!`, text: `${getSpecies(out.species).name} jedzie do Boxu Oaka.` };
  }
  if (action.type === 'boxSend') {
    const sent = pb.reserve.find((m) => m.uid === before.boxChoice?.uid);
    return { tone: 'neutral', title: `${sent ? getSpecies(sent.species).name : 'Pokémon'} jedzie do Profesora Oaka`, text: 'Zabierzesz go do drużyny w każdym mieście z Poké Stopem.' };
  }
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
  // One Kanto day 14.10: the trade's swap
  if (action.type === 'tradeAgree' && before.trade && !after.trade) {
    const t = before.trade;
    const name = (id) => after.players.find((p) => p.id === id).name;
    const got = (id, other) => getSpecies([...before.players.find((p) => p.id === other).team, ...before.players.find((p) => p.id === other).reserve].find((m) => m.uid === t.pick[other]).species).name;
    return { tone: 'win', title: '🔄 Wymiana!', text: `${name(t.a)} dostaje ${got(t.a, t.b)}, ${name(t.b)} dostaje ${got(t.b, t.a)}.` };
  }
  if (action.type === 'quitChallenge') return { tone: 'neutral', title: '🚪 Wyjście z wyzwania', text: `Następnym razem ${before.challenge?.kind === 'league' ? 'Liga' : 'sala'} od początku.` }; // B33-3
  if (pa.league?.champion && !pb.league?.champion) return { tone: 'win', title: '👑 MISTRZ LIGI POKÉMON!', text: `${pa.name} pokonuje Lance’a!${plus}` };
  const newBadge = pa.badges?.find((b) => !pb.badges?.includes(b));
  if (newBadge) {
    const gym = GYMS_BY_ID[newBadge];
    // 3A-3 (gymReward v2): the leader's thematic item, shown on the banner
    const item = after.log.slice(before.log.length).find((e) => e.data?.gymReward)?.data.gymReward.item ?? null;
    return { tone: 'win', title: `🏅 ${gym.badge}!`, text: `Odznaka trafia do gabloty.${item ? ` Lider daje też: ${ITEM_PL[item]}.` : ''}${plus}`, badge: newBadge, ...(item ? { item } : {}) };
  }
  if (!enc || !ended) return null;
  const name = enc.kind === 'wild' ? getSpecies(enc.pokemon.species).name : null;
  if (action.type === 'run' && enc.kind === 'trainer') {
    const r = after.log.slice(before.log.length).find((e) => e.data?.retreat)?.data.retreat;
    const paid = !r || r.penalty === 'none' ? 'Bez kary — nie było czego zostawić.' : r.penalty === 'money' ? 'Kosztowało 💰1.' : `Zostawiasz trenerowi: ${ITEM_PL[r.penalty]}.`;
    return { tone: 'neutral', title: '🏃 Wycofanie z walki', text: `${paid} Punkty treningu za pokonane wcześniej Pokémony zostają.` };
  }
  // PLAYTEST_006 C4: an expedition encounter that ended without a catch — what happened, then what next (R2), in
  // the child's words: the expedition goes on, one Explore here brings the Pokémon back
  const expeditionDone = after.log.slice(before.log.length).some((e) => e.data?.book?.event === 'claim' && enc.questEncounter?.occ === e.data.book.occ);
  if (enc.questEncounter && !expeditionDone) {
    const why = after.log.slice(before.log.length).some((e) => /fainted and can no longer be caught/.test(e.text)) ? { title: `${name} zemdlał`, text: 'Zemdlonego Pokémona nie da się złapać.' }
      : after.log.slice(before.log.length).some((e) => e.data?.escape?.result === 'flee') ? { title: `${name.toUpperCase()} UCIEKŁ!`, text: 'Pokémon zniknął w trawie.' }
        : action.type === 'run' ? { title: 'Uciekasz z walki', text: `${name} zostaje w trawie.` }
          : { title: 'Twoje Pokémony zemdlały', text: 'Najpierw wylecz drużynę (Poké Stop albo Revive).' };
    return { tone: 'neutral', title: `📜 ${why.title}`, text: `${why.text} Wyprawa trwa: jedna eksploracja tutaj, a ${name} znów się pokaże.` };
  }
  if (action.type === 'run') return null;
  if (enc.kind === 'wild') {
    if (pa.pokedex.caught.length > pb.pokedex.caught.length || pa.team.length + pa.reserve.length > pb.team.length + pb.reserve.length) {
      const where = after.boxChoice ? 'Drużyna jest pełna: do drużyny czy do Profesora Oaka?' : pa.team.length > pb.team.length ? `${name} dołącza do drużyny.` : `Drużyna jest pełna: ${name} trafia do ${after.config.rules.oakBox ? 'Boxu Oaka' : 'rezerwy'}.`;
      return { tone: 'win', title: `ZŁAPANY! ${name}`, text: `${where}${expeditionDone ? ' 📜 Wyprawa ukończona!' : ''}${plus}` };
    }
    const fled = after.log.slice(before.log.length).find((e) => e.data?.escape?.result === 'flee')?.data.escape;
    if (fled?.trigger === 'afterRound') return { tone: 'lose', title: `${name.toUpperCase()} UCIEKŁ!`, text: 'PŁOCHLIWY — uciekł po rundzie walki.' };
    if (action.type === 'throwBall' || fled) return { tone: 'lose', title: `${name.toUpperCase()} UCIEKŁ!`, text: 'Pokémon zniknął w trawie.' };
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
  // Build 3.3 B33-3: a battle of a chain won → the intermission
  if (after.phase === 'challenge' && ['gym', 'league'].includes(enc.kind)) {
    const ribbon = pa.league?.ribbon && !pb.league?.ribbon;
    const beaten = enc.trainer.archetype ? trainerPl(enc.trainer).name : enc.trainer.name;
    if (ribbon) return { tone: 'win', title: '🎀 Elitarna Czwórka pokonana!', text: 'Wstęga trafia do gabloty. Przerwa przed walką z Lance’em — bez Poké Stopu.', ribbon: true };
    return { tone: 'win', title: `Wygrana z: ${beaten}!`, text: `Przerwa — obrażenia zostają.${plus}` };
  }
  if (enc.kind === 'gym') return { tone: 'lose', title: 'Przegrana w sali', text: before.challenge ? 'Nic nie tracisz — następnym razem sala od początku.' : 'Nic nie tracisz — spróbuj w kolejnej turze.' };
  if (enc.kind === 'league' && enc.v2) return { tone: 'lose', title: `${enc.trainer.name} tym razem wygrywa`, text: 'Następne wyzwanie Ligi zaczniesz od Lorelei.' };
  if (enc.kind === 'league') {
    if (after.phase === 'league') return { tone: 'win', title: '🎀 Elitarna Czwórka pokonana!', text: 'Wstęga trafia do gabloty. Przerwa przed walką z Lance’em.', ribbon: true };
    if (pa.league?.ribbon) return { tone: 'lose', title: 'Lance tym razem wygrywa', text: 'Masz 🎀 Wstęgę: następne wyzwanie Ligi zaczniesz od razu od Lance’a.' };
    return { tone: 'lose', title: 'Przegrana z Elitarną Czwórką', text: 'Wylecz drużynę i spróbuj znowu.' };
  }
  const trainer = enc.trainer ? trainerPl(enc.trainer).name : 'Trener';
  // M02-2: at an exhausted place a won trainer battle pays nothing
  const unpaid = after.log.slice(before.log.length).some((e) => e.data?.fatigue?.noMoney);
  const won = pa.money > pb.money || pa.stars > pb.stars || unpaid;
  if (won && unpaid) return { tone: 'win', title: `Wygrana z: ${trainer}!`, text: '👣 Brawo! Tutaj już bez nagrody — ruszaj dalej!' };
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
  return ['pokeball', 'superball', ...(state.config.rules.ultraBall ? ['ultraball'] : [])].map((ball) => { // E2: the Ultra Ball in games that have it
    const count = itemCount(player, ball);
    const die = throwDie(state, ball, player); // the die the throw will roll
    const noBonus = ball === 'superball' && die.ballEffect === 'none';
    let note = '';
    let usable = count > 0 && !blocked;
    if (noBonus && count > 0) {
      if (pokeballs > 0) {
        usable = false;
        note = 'Great Ball nie daje tu dodatkowego bonusu. Użyj zwykłego Poké Balla.';
      } else {
        note = 'Brak dodatkowego bonusu, ale możesz go użyć.';
      }
    }
    if (blocked) note = 'Team Rocket nie pozwala tu łapać.';
    return { ball, name: BALL_PL[ball], count, die, usable, note, noBonus };
  });
}

// Combat MVP: a status in one short line (the roll in brackets — the status die is not a step of its own).
export function statusNotePl(st) {
  const def = STATUS_DEFINITIONS[st.id];
  const name = getSpecies(st.species).name;
  const roll = st.roll ? ` (rzut ${st.roll})` : '';
  switch (st.event) {
    case 'applied': return `${def.icon} ${name}: ${def.pl}!`;
    case 'blocked': return st.why === 'immune' ? `${def.icon} ${name} jest odporny — bez stanu.` : '';
    case 'sleeping': return `💤 ${name} śpi — nie atakuje${roll}.`;
    case 'woke': return `💤 ${name} budzi się${roll} i atakuje!`;
    case 'paralysed': return `⚡ ${name} sparaliżowany — nie atakuje${roll}.`;
    case 'tick': return st.lost ? `${def.icon} ${def.pl}: ${name} −${st.lost} ❤${st.wornOff ? ' — mija' : ''}` : `${def.icon} ${def.pl}: ${name} bez straty${roll}${st.wornOff ? ' — mija' : ''}.`;
    case 'cured': return st.reason === 'ko' ? '' : `${def.icon} ${name}: ${def.pl} mija.`;
    default: return '';
  }
}
