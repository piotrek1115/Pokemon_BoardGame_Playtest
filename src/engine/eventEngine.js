// Event system: weighted draw among events whose conditions hold, then either
// immediate effects or a pending choice (phase "event").
import { EVENTS, EVENTS_BY_ID } from '../data/events.js';
import { getLocation } from '../data/locations.js';
import { getSpecies } from '../data/pokemon.js';
import { weightedPick } from './rng.js';
import { log } from './log.js';
import { currentPlayer, getLead, heal } from './gameState.js';
import { spawnWild, startTrainerBattle } from './encounterEngine.js';

export function conditionsMet(player, conditions, ctx = {}) {
  if (!conditions) return true;
  const lead = getLead(player);
  if (conditions.biomes && !conditions.biomes.includes(ctx.biome)) return false;
  if (conditions.locationTypes && !conditions.locationTypes.includes(getLocation(player.location).type)) return false;
  if (conditions.minMoney != null && player.money < conditions.minMoney) return false;
  if (conditions.minPokeballs != null && player.pokeballs < conditions.minPokeballs) return false;
  if (conditions.teamInjured && !player.team.some((p) => p.hp < p.maxHp)) return false;
  if (conditions.leadInjured && (!lead || lead.hp >= lead.maxHp)) return false;
  if (conditions.hasHealthyPokemon && !lead) return false;
  return true;
}

export function eligibleEvents(player, ctx) {
  return EVENTS.filter((e) => conditionsMet(player, e.conditions, ctx));
}

export function drawEvent(state, ctx) {
  const player = currentPlayer(state);
  const pool = eligibleEvents(player, ctx);
  if (!pool.length) {
    log(state, 'warn', 'No eligible event here. Nothing happens.');
    return null;
  }
  const event = weightedPick(state, 'Event', pool, (e) => e.weight ?? 1, (e) => e.title);
  log(state, 'event', `📜 ${event.title} — ${event.text}`, { event: event.id });
  if (event.choices?.length) {
    state.phase = 'event';
    state.pendingEvent = { id: event.id, biome: ctx.biome };
  } else {
    applyEffects(state, event.effects ?? [], ctx);
  }
  return event;
}

export function legalEventChoices(state) {
  const event = EVENTS_BY_ID[state.pendingEvent.id];
  const player = currentPlayer(state);
  const ctx = { biome: state.pendingEvent.biome };
  return event.choices.map((c, i) => (conditionsMet(player, c.requires, ctx) ? i : -1)).filter((i) => i >= 0);
}

export function chooseEventOption(state, index) {
  const pending = state.pendingEvent;
  const choice = EVENTS_BY_ID[pending.id].choices[index];
  log(state, 'event', `${currentPlayer(state).name} chooses: ${choice.label}`, { event: state.pendingEvent?.id ?? null, choice: index });
  state.pendingEvent = null;
  state.phase = 'turn';
  applyEffects(state, choice.effects, { biome: pending.biome });
}

export function applyEffects(state, effects, ctx) {
  const player = currentPlayer(state);
  for (const effect of effects) {
    const lead = getLead(player);
    switch (effect.type) {
      case 'money': {
        const before = player.money;
        player.money = Math.max(0, before + effect.amount);
        log(state, 'event', `Money ${before} → ${player.money}`);
        break;
      }
      case 'pokeballs': {
        const before = player.pokeballs;
        player.pokeballs = Math.max(0, before + effect.amount);
        log(state, 'event', `Poké Balls ${before} → ${player.pokeballs}`);
        break;
      }
      case 'healLead': {
        if (!lead) break;
        const healed = heal(lead, effect.amount, false);
        log(state, 'event', `${getSpecies(lead.species).name} +${healed} HP (❤ ${lead.hp}/${lead.maxHp})`);
        break;
      }
      case 'healTeam': {
        for (const p of player.team) heal(p, effect.amount, true);
        log(state, 'event', `Team healed +${effect.amount} HP each.`);
        break;
      }
      case 'damageLead': {
        if (!lead) break;
        lead.hp = Math.max(0, lead.hp - effect.amount);
        log(state, 'event', `${getSpecies(lead.species).name} −${effect.amount} HP (❤ ${lead.hp}/${lead.maxHp})${lead.hp === 0 ? ' — fainted!' : ''}`);
        break;
      }
      case 'actions': {
        const before = state.turn.actionsRemaining;
        state.turn.actionsRemaining = Math.max(0, before + effect.amount);
        log(state, 'event', `Actions left ${before} → ${state.turn.actionsRemaining}`);
        break;
      }
      case 'wildEncounter':
        if (lead) spawnWild(state, ctx.biome, effect.rarityBonus ?? 0);
        else log(state, 'warn', 'No healthy Pokémon — the encounter is skipped.');
        break;
      case 'trainerBattle':
        if (lead) startTrainerBattle(state, ctx.biome);
        else log(state, 'warn', 'No healthy Pokémon — the trainer battle is skipped.');
        break;
      default:
        throw new Error(`Unknown event effect: ${effect.type}`);
    }
  }
}
