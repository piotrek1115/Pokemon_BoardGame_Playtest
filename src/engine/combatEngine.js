// Combat v0.1: attack roll = d6 + attack modifier + type modifier, looked up in
// CONFIG.combat.damageThresholds. A natural 1 always misses.
// One "fight" action = the player's lead attacks, then the opponent strikes back
// (CONFIG.combat.opponentCounterattacks). Trainer, Team Rocket, gym and League
// battles share this flow; only the end (reward / plot / badge / stage) differs.
import { TYPE_CHART } from '../data/types.js';
import { attackTypeOf, getSpecies } from '../data/pokemon.js';
import { d6 } from './rng.js';
import { log } from './log.js';
import { currentPlayer, getLead } from './gameState.js';
import { endEncounter } from './encounterEngine.js';
import { rocketDefeated, rocketWins } from './rocketEngine.js';
import { gymLost, gymWon, leagueStageLost, leagueStageWon } from './gymEngine.js';
import { noteParticipant, opponentDefeated } from './growthEngine.js';
import { useItem } from './itemEngine.js';

export function typeModifier(attackType, defenderTypes, config) {
  const chart = TYPE_CHART[attackType];
  if (!chart) throw new Error(`Unknown attack type: ${attackType}`);
  let mod = 0;
  for (const t of defenderTypes) {
    if (chart.strong.includes(t)) mod += config.combat.typeAdvantage;
    else if (chart.weak.includes(t)) mod += config.combat.typeDisadvantage;
  }
  const [lo, hi] = config.combat.typeModifierClamp;
  return Math.max(lo, Math.min(hi, mod));
}

export function damageForTotal(total, config) {
  for (const row of config.combat.damageThresholds) {
    if (total >= row.atLeast) return row.damage;
  }
  return 0;
}

// The type modifier of `attacker`'s attack against `defender` (species) — the
// one the attack roll uses; the table previews it before the choice.
export function typeMatchup(attacker, defender, config) {
  return typeModifier(attackTypeOf(attacker), defender.types, config);
}

// Pure resolution of one attack, given the d6 result and two species.
export function resolveAttack(roll, attacker, defender, config) {
  const attackMod = attacker.attack;
  const typeMod = typeMatchup(attacker, defender, config);
  const total = roll + attackMod + typeMod;
  const natural1 = roll === 1 && config.combat.naturalOneMisses;
  let damage = natural1 ? 0 : damageForTotal(total, config);
  const natural6Boost = roll === 6 && damage < (config.combat.naturalSixMinDamage ?? 0);
  if (natural6Boost) damage = config.combat.naturalSixMinDamage;
  return { roll, attackMod, typeMod, total, natural1, natural6Boost, damage };
}

function signed(n, label) {
  return n ? ` ${n > 0 ? '+' : ''}${n} ${label}` : '';
}

export function formatAttack(r) {
  if (r.natural1) return 'natural 1, miss';
  const nat6 = r.natural6Boost ? ' (natural 6 minimum)' : '';
  return `${r.roll}${signed(r.attackMod, 'atk')}${signed(r.typeMod, 'type')} = ${r.total} -> ${r.damage ? `${r.damage} damage` : 'miss'}${nat6}`;
}

// kind: 'player' for the current player's Pokémon attacking, 'system' for the
// opponent's counter-attack (who rolls the die — DQ-62).
// `extra`: more facts for the log entry (Phase 3A-2: `after: 'stay' | 'item'`
// for the opponent's response when the player did not attack).
export function performAttack(state, attackerInst, defenderInst, kind = 'system', extra = null) {
  const attacker = getSpecies(attackerInst.species);
  const defender = getSpecies(defenderInst.species);
  let result;
  d6(state, `${attacker.name} attacks ${defender.name}`, (v) => {
    result = resolveAttack(v, attacker, defender, state.config);
    return formatAttack(result);
  }, kind);
  defenderInst.hp = Math.max(0, defenderInst.hp - result.damage);
  // Structured result for the digital board: raw roll, modifiers, total, damage.
  const attack = {
    die: 'attack', kind, attacker: attacker.id, defender: defender.id, attackerUid: attackerInst.uid, defenderUid: defenderInst.uid, raw: result.roll,
    modifiers: [{ label: 'Attack', value: result.attackMod }, { label: 'Type', value: result.typeMod }].filter((m) => m.value),
    total: result.total, damage: result.damage, natural1: result.natural1, natural6Boost: result.natural6Boost,
    hpAfter: defenderInst.hp, maxHp: defenderInst.maxHp,
    ...(extra ?? {}),
  };
  log(state, 'combat', `${defender.name} ❤ ${defenderInst.hp}/${defenderInst.maxHp}${defenderInst.hp === 0 ? ' — fainted!' : ''}`, { attack });
  return result;
}

export function currentOpponent(encounter) {
  if (!encounter) return null;
  return encounter.kind === 'wild' ? encounter.pokemon : encounter.trainer.pokemonTeam[encounter.index];
}

// One exchange in the current wild or trainer encounter.
export function fightRound(state) {
  const player = currentPlayer(state);
  const lead = getLead(player);
  const opponent = currentOpponent(state.encounter);
  state.encounter.freeSwitch = false;

  if (state.encounter.kind === 'wild') state.encounter.fights = (state.encounter.fights ?? 0) + 1;
  noteParticipant(state, lead.uid); // Growth games: the lead fights this opponent
  performAttack(state, lead, opponent, 'player');
  if (opponent.hp <= 0) {
    opponentDefeated(state, opponent);
    onOpponentFainted(state);
    return;
  }
  if (state.config.combat.opponentCounterattacks) {
    performAttack(state, opponent, lead, 'system');
    if (lead.hp <= 0) onLeadFainted(state, lead);
  }
}

function onOpponentFainted(state) {
  const enc = state.encounter;
  const player = currentPlayer(state);
  if (enc.kind === 'wild') {
    log(state, 'encounter', `The wild ${getSpecies(enc.pokemon.species).name} fainted and can no longer be caught.`);
    endEncounter(state, 'wildFainted');
    return;
  }
  enc.index += 1;
  const next = enc.trainer.pokemonTeam[enc.index];
  if (next) {
    log(state, 'encounter', `${enc.trainer.owners?.[enc.index] ?? enc.trainer.name} sends out ${getSpecies(next.species).name}!`);
    return;
  }
  if (enc.kind === 'rocket') {
    rocketDefeated(state);
    return;
  }
  if (enc.kind === 'gym') {
    gymWon(state);
    return;
  }
  if (enc.kind === 'league') {
    leagueStageWon(state);
    return;
  }
  const before = player.money;
  player.money += enc.trainer.reward;
  log(state, 'encounter', `${player.name} defeated ${enc.trainer.name}! Money ${before} → ${player.money} (+${enc.trainer.reward})`);
  endEncounter(state, 'trainerWon');
}

// Switching Pokémon in battle (DQ-71), instead of attacking, in every kind of
// battle. A voluntary switch costs the exchange: the player does not attack and
// the opponent strikes the newcomer at once. Right after the lead fainted the
// player may pick the replacement for free (no extra attack). Never costs a
// map action.
export function canSwitchTo(state, player, uid) {
  const target = player.team.find((p) => p.uid === uid);
  return Boolean(state.encounter && target && target.hp > 0 && target !== getLead(player));
}

export function switchPokemon(state, uid) {
  const player = currentPlayer(state);
  const enc = state.encounter;
  const i = player.team.findIndex((p) => p.uid === uid);
  const [mon] = player.team.splice(i, 1);
  player.team.unshift(mon);
  const free = Boolean(enc.freeSwitch);
  enc.freeSwitch = false;
  log(state, 'combat', `🔄 ${player.name} switches to ${getSpecies(mon.species).name}${free ? ' (free: replacing a fainted Pokémon)' : ''}`, { switch: { to: mon.uid, species: mon.species, free } });
  if (free || !state.config.combat.opponentCounterattacks) return;
  noteParticipant(state, mon.uid); // Growth games: it came in and takes the opponent's hit
  performAttack(state, currentOpponent(enc), mon, 'system');
  if (mon.hp <= 0) onLeadFainted(state, mon);
}

// Phase 3A-2: the opponent's response when the player's exchange was not an
// attack — a wild Pokémon that stayed after a failed throw, or a battle item.
// Exactly one attack, on the current lead (which takes part in the fight for
// Growth); a faint goes the usual way (free replacement, or the battle ends).
export function opponentStrikes(state, why) {
  const lead = getLead(currentPlayer(state));
  if (!lead || !state.config.combat.opponentCounterattacks) return;
  noteParticipant(state, lead.uid);
  performAttack(state, currentOpponent(state.encounter), lead, 'system', { after: why });
  if (lead.hp <= 0) onLeadFainted(state, lead);
}

// ---- battle items (Phase 3A-2, rules.battleItems, DQ-81) -----------------------
// Potion / Revive as the player's exchange, in every kind of battle: the item
// replaces the attack, then the opponent strikes the lead. Potion: any injured
// active-team Pokémon; Revive: a fainted one (the lead itself has always been
// replaced first — the next healthy Pokémon steps in). A revived Pokémon never
// takes over the lead by itself: the current lead stays in front.
export function useBattleItem(state, item, targetUid) {
  const player = currentPlayer(state);
  const target = player.team.find((p) => p.uid === targetUid);
  const lead = getLead(player);
  if (item === 'revive' && lead && player.team.indexOf(target) < player.team.indexOf(lead)) {
    player.team.splice(player.team.indexOf(lead), 1);
    player.team.unshift(lead);
  }
  state.encounter.freeSwitch = false;
  useItem(state, item, targetUid, { battle: true });
  opponentStrikes(state, 'item');
}

// ---- trainer retreat (Phase 3A-2, rules.trainerRetreat, DQ-82) ------------------
// Only from trainer battles (never gym, Team Rocket or the League). The price:
// 1 money if you have any; with no money, one consumable of your choice — a
// Poké Ball, Super Ball, Potion or Revive, but never your last ball; with
// nothing to give, you just go. No debt, no Pokémon lost; it ends the battle
// as a retreat (no reward, no mission progress), and the Growth of trainer
// Pokémon already defeated stays (growthEngine).
export const RETREAT_ITEMS = ['pokeball', 'superball', 'potion', 'revive'];

export function canRetreat(state) {
  return Boolean(state.config.rules.trainerRetreat) && state.encounter?.kind === 'trainer';
}

// The retreat actions on offer: [{ type: 'run' }] when it costs money or
// nothing, else one { type: 'run', item } per item that may be left behind.
export function retreatOptions(state, player) {
  if (!canRetreat(state)) return [];
  if (player.money > 0) return [{ type: 'run' }];
  const balls = player.pokeballs + (player.items.superball ?? 0);
  const count = (id) => (id === 'pokeball' ? player.pokeballs : player.items[id] ?? 0);
  const items = RETREAT_ITEMS.filter((id) => count(id) > 0 && (!['pokeball', 'superball'].includes(id) || balls > 1));
  return items.length ? items.map((item) => ({ type: 'run', item })) : [{ type: 'run' }];
}

export function retreat(state, item) {
  const player = currentPlayer(state);
  const enc = state.encounter;
  let penalty = 'none';
  if (player.money > 0) {
    player.money -= 1;
    penalty = 'money';
  } else if (item) {
    if (item === 'pokeball') player.pokeballs -= 1;
    else player.items[item] -= 1;
    penalty = item;
  }
  const paid = penalty === 'money' ? ' (−1 money)' : penalty === 'none' ? ' (nothing to leave behind)' : ` and leaves a ${item}`;
  log(state, 'encounter', `${player.name} retreats from ${enc.trainer.name}${paid}.`, { retreat: { penalty, trainer: enc.trainer.name, defeated: enc.index } });
  endEncounter(state, 'retreated');
}

function onLeadFainted(state, fainted) {
  const player = currentPlayer(state);
  state.encounter.playerFainted = true; // breaks "win without fainting" missions
  const next = getLead(player);
  if (next) {
    // The next healthy Pokémon steps in; choosing another one instead is free.
    state.encounter.freeSwitch = true;
    log(state, 'combat', `${getSpecies(fainted.species).name} fainted! ${getSpecies(next.species).name} steps in.`);
    return;
  }
  const enc = state.encounter;
  if (enc.kind === 'wild') {
    log(state, 'encounter', `All of ${player.name}'s Pokémon fainted. The wild ${getSpecies(enc.pokemon.species).name} wanders off.`);
    endEncounter(state, 'wildLost');
    return;
  }
  if (enc.kind === 'rocket') {
    rocketWins(state);
    return;
  }
  if (enc.kind === 'gym') {
    gymLost(state);
    return;
  }
  if (enc.kind === 'league') {
    leagueStageLost(state);
    return;
  }
  const penalty = Math.min(player.money, state.config.trainers.lossMoneyPenalty);
  player.money -= penalty;
  log(state, 'encounter', `All of ${player.name}'s Pokémon fainted. ${enc.trainer.name} wins${penalty ? ` (−${penalty} money)` : ''}.`);
  endEncounter(state, 'trainerLost');
}
