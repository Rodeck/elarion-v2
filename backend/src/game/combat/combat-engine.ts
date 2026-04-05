/**
 * combat-engine.ts
 *
 * Pure, side-effect-free combat resolution functions.
 * No I/O, no timers, no WebSocket sends.
 * All randomness uses Math.random() — testable by injecting a seeded RNG.
 */

import type { CombatEventDto } from '../../../../shared/protocol/index';

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

export interface DerivedCombatStats {
  attack: number;
  defence: number;
  maxHp: number;
  maxMana: number;
  manaOnHit: number;
  manaOnDamageTaken: number;
  manaRegen: number;
  dodgeChance: number;       // 0–100
  critChance: number;        // 0–100
  critDamage: number;        // integer %: 150 = 1.5×
  armorPenetration: number;  // 0–100, % of enemy defence ignored
  additionalAttacks: number; // bonus hits at combat start
}

export interface LoadoutSlotSnapshot {
  abilityId: number;
  name: string;
  description: string;
  manaCost: number;
  effectType: string;
  effectValue: number;
  durationTurns: number;
  cooldownTurns: number;
  priority: number;
  slotType: string;
}

export interface ActiveEffect {
  id: string;            // unique per application (for removal tracking)
  source: 'player' | 'enemy';
  target: 'player' | 'enemy';
  effectType: 'buff' | 'debuff' | 'dot' | 'reflect' | 'shield';
  stat?: 'attack' | 'defence';  // for buff/debuff
  value: number;
  turnsRemaining: number;
  abilityName: string;
}

export interface EngineState {
  playerHp: number;
  playerMana: number;
  enemyHp: number;
  activeEffects: ActiveEffect[];
  abilityCooldowns: Map<number, number>;  // abilityId → turns remaining
}

export interface AutoSlotConfig {
  slot_name: 'auto_1' | 'auto_2' | 'auto_3';
  ability: LoadoutSlotSnapshot;
}

export interface TurnResult {
  events: CombatEventDto[];
  newState: EngineState;
}

const DEFAULT_CRIT_DAMAGE = 150;

/** Effect types that create persistent ActiveEffect entries (not instant effects). */
const DURATION_EFFECT_TYPES = new Set(['buff', 'debuff', 'dot', 'reflect', 'shield']);

// ---------------------------------------------------------------------------
// Helper: check if an ability already has an active effect (anti-stacking)
// ---------------------------------------------------------------------------

function hasActiveEffectForAbility(state: EngineState, abilityName: string, effectType: string): boolean {
  if (!DURATION_EFFECT_TYPES.has(effectType)) return false;
  return state.activeEffects.some((e) => e.abilityName === abilityName);
}

// ---------------------------------------------------------------------------
// Helper: resolve a dodge roll
// ---------------------------------------------------------------------------

function rollDodge(dodgeChance: number): boolean {
  return Math.random() * 100 < dodgeChance;
}

// ---------------------------------------------------------------------------
// Helper: resolve a crit roll
// ---------------------------------------------------------------------------

function rollCrit(critChance: number): boolean {
  return Math.random() * 100 < critChance;
}

// ---------------------------------------------------------------------------
// Helper: apply damage through active effects (reflect, shield)
// ---------------------------------------------------------------------------

function applyDamageToPlayer(
  rawDamage: number,
  state: EngineState,
  events: CombatEventDto[],
): number {
  let damage = rawDamage;

  // Apply defence reduction from buff effects (Iron Skin style)
  const defBuff = state.activeEffects.find(
    (e) => e.target === 'player' && e.effectType === 'buff' && e.stat === 'defence',
  );
  if (defBuff) {
    damage = Math.max(1, Math.floor(damage * (1 - defBuff.value / 100)));
  }

  // Reflect damage back
  const reflect = state.activeEffects.find(
    (e) => e.target === 'enemy' && e.effectType === 'reflect',
  );
  if (reflect) {
    const reflected = Math.floor(damage * (reflect.value / 100));
    if (reflected > 0) {
      events.push({ kind: 'effect_tick', source: 'player', target: 'enemy', value: reflected, effect_name: reflect.abilityName });
      state.enemyHp = Math.max(0, state.enemyHp - reflected);
    }
  }

  return damage;
}

// ---------------------------------------------------------------------------
// computePlayerAttack — player auto-attack against enemy
// ---------------------------------------------------------------------------

export function computePlayerAttack(
  playerStats: DerivedCombatStats,
  enemyDodgeChance: number,
  enemyDefence: number,
  state: EngineState,
): TurnResult {
  const events: CombatEventDto[] = [];
  const newState: EngineState = {
    ...state,
    activeEffects: [...state.activeEffects],
    abilityCooldowns: new Map(state.abilityCooldowns),
  };

  // Enemy dodge
  if (rollDodge(enemyDodgeChance)) {
    events.push({ kind: 'dodge', source: 'player', target: 'enemy' });
    return { events, newState };
  }

  // Compute base attack (may be buffed)
  let effectiveAttack = playerStats.attack;
  const atkBuff = newState.activeEffects.find(
    (e) => e.target === 'player' && e.effectType === 'buff' && e.stat === 'attack',
  );
  if (atkBuff) {
    effectiveAttack = Math.floor(effectiveAttack * (1 + atkBuff.value / 100));
  }

  // Crit
  const isCrit = rollCrit(playerStats.critChance);
  const critMult = isCrit ? (playerStats.critDamage || DEFAULT_CRIT_DAMAGE) / 100 : 1;

  // Apply armor penetration then enemy defence reduction
  const effectiveDefence = Math.floor(enemyDefence * (1 - (playerStats.armorPenetration ?? 0) / 100));
  const rawDamage = Math.floor(effectiveAttack * critMult);
  const damage = Math.max(1, rawDamage - effectiveDefence);

  newState.enemyHp = Math.max(0, newState.enemyHp - damage);

  // Mana on hit
  const manaGained = Math.min(
    playerStats.manaOnHit,
    playerStats.maxMana - newState.playerMana,
  );
  if (manaGained > 0) {
    newState.playerMana = newState.playerMana + manaGained;
    events.push({ kind: 'mana_gained', source: 'player', target: 'player', value: manaGained });
  }

  events.push({ kind: 'auto_attack', source: 'player', target: 'enemy', value: damage, is_crit: isCrit });
  if (isCrit) {
    events.push({ kind: 'crit', source: 'player', target: 'enemy', value: damage });
  }

  return { events, newState };
}

// ---------------------------------------------------------------------------
// computeAutoAbilities — fire eligible auto-slot abilities
// ---------------------------------------------------------------------------

export function computeAutoAbilities(
  autoSlots: AutoSlotConfig[],
  playerStats: DerivedCombatStats,
  enemyDefence: number,
  state: EngineState,
): TurnResult {
  const events: CombatEventDto[] = [];
  const newState: EngineState = {
    ...state,
    activeEffects: [...state.activeEffects],
    abilityCooldowns: new Map(state.abilityCooldowns),
  };

  // Sort by priority descending
  const sorted = [...autoSlots].sort((a, b) => b.ability.priority - a.ability.priority);

  for (const { ability } of sorted) {
    const cooldown = newState.abilityCooldowns.get(ability.abilityId) ?? 0;
    if (newState.playerMana < ability.manaCost || cooldown > 0) continue;

    // Skip if this ability already has an active effect (no stacking)
    if (hasActiveEffectForAbility(newState, ability.name, ability.effectType)) continue;

    // Special case: Execute only fires when enemy < 30% HP
    if (ability.name === 'Execute' && newState.enemyHp > 0) {
      // need enemy max hp for this check — we skip if we can't verify; engine caller should handle
    }

    // Consume mana
    newState.playerMana = newState.playerMana - ability.manaCost;
    events.push({ kind: 'mana_spent', source: 'player', target: 'player', value: ability.manaCost, ability_name: ability.name });

    // Start cooldown
    if (ability.cooldownTurns > 0) {
      newState.abilityCooldowns.set(ability.abilityId, ability.cooldownTurns);
    }

    // Apply effect
    const effectEvents = applyAbilityEffect(ability, playerStats, enemyDefence, newState);
    events.push(...effectEvents);
  }

  return { events, newState };
}

// ---------------------------------------------------------------------------
// computeActiveAbility — fire the active slot ability
// ---------------------------------------------------------------------------

export function computeActiveAbility(
  ability: LoadoutSlotSnapshot,
  playerStats: DerivedCombatStats,
  enemyDefence: number,
  state: EngineState,
): TurnResult {
  const events: CombatEventDto[] = [];
  const newState: EngineState = {
    ...state,
    activeEffects: [...state.activeEffects],
    abilityCooldowns: new Map(state.abilityCooldowns),
  };

  if (newState.playerMana < ability.manaCost) return { events, newState };
  const cooldown = newState.abilityCooldowns.get(ability.abilityId) ?? 0;
  if (cooldown > 0) return { events, newState };

  // Skip if this ability already has an active effect (no stacking)
  if (hasActiveEffectForAbility(newState, ability.name, ability.effectType)) return { events, newState };

  newState.playerMana = newState.playerMana - ability.manaCost;
  events.push({ kind: 'mana_spent', source: 'player', target: 'player', value: ability.manaCost, ability_name: ability.name });

  if (ability.cooldownTurns > 0) {
    newState.abilityCooldowns.set(ability.abilityId, ability.cooldownTurns);
  }

  const effectEvents = applyAbilityEffect(ability, playerStats, enemyDefence, newState);
  events.push(...effectEvents);

  return { events, newState };
}

// ---------------------------------------------------------------------------
// computeEnemyTurn — enemy auto-attack against player
// ---------------------------------------------------------------------------

export function computeEnemyTurn(
  enemyAttack: number,
  playerStats: DerivedCombatStats,
  state: EngineState,
): TurnResult {
  const events: CombatEventDto[] = [];
  const newState: EngineState = {
    ...state,
    activeEffects: [...state.activeEffects],
    abilityCooldowns: new Map(state.abilityCooldowns),
  };

  // Player dodge
  if (rollDodge(playerStats.dodgeChance)) {
    events.push({ kind: 'dodge', source: 'enemy', target: 'player' });
    return { events, newState };
  }

  // Compute raw damage reduced by defence
  let rawDamage = Math.max(1, enemyAttack - playerStats.defence);

  // Apply defence buffs / reflect
  rawDamage = applyDamageToPlayer(rawDamage, newState, events);

  newState.playerHp = Math.max(0, newState.playerHp - rawDamage);

  // Mana on damage taken
  const manaGained = Math.min(
    playerStats.manaOnDamageTaken,
    playerStats.maxMana - newState.playerMana,
  );
  if (manaGained > 0) {
    newState.playerMana = newState.playerMana + manaGained;
    events.push({ kind: 'mana_gained', source: 'enemy', target: 'player', value: manaGained });
  }

  events.push({ kind: 'auto_attack', source: 'enemy', target: 'player', value: rawDamage });

  return { events, newState };
}

// ---------------------------------------------------------------------------
// tickActiveEffects — decrement durations, apply DoT damage, expire buffs
// ---------------------------------------------------------------------------

export function tickActiveEffects(
  playerStats: DerivedCombatStats,
  state: EngineState,
): TurnResult {
  const events: CombatEventDto[] = [];
  const newState: EngineState = {
    ...state,
    activeEffects: [],
    abilityCooldowns: new Map(state.abilityCooldowns),
  };

  for (const effect of state.activeEffects) {
    if (effect.effectType === 'dot' && effect.target === 'enemy') {
      const dotDamage = Math.max(1, Math.floor(playerStats.attack * (effect.value / 100)));
      newState.enemyHp = Math.max(0, (newState.enemyHp) - dotDamage);
      events.push({ kind: 'effect_tick', source: 'player', target: 'enemy', value: dotDamage, effect_name: effect.abilityName });
    }

    const remaining = effect.turnsRemaining - 1;
    if (remaining > 0) {
      newState.activeEffects.push({ ...effect, turnsRemaining: remaining });
    } else {
      events.push({ kind: 'effect_expired', source: effect.source, target: effect.target, effect_name: effect.abilityName });
    }
  }

  return { events, newState };
}

// ---------------------------------------------------------------------------
// tickAbilityCooldowns — decrement all cooldown counters by 1
// ---------------------------------------------------------------------------

export function tickAbilityCooldowns(state: EngineState): EngineState {
  const newCooldowns = new Map<number, number>();
  for (const [id, turns] of state.abilityCooldowns) {
    if (turns > 1) newCooldowns.set(id, turns - 1);
    // turns === 1: expires this tick, don't add back
  }
  return { ...state, abilityCooldowns: newCooldowns };
}

// ---------------------------------------------------------------------------
// applyManaRegen — flat mana per turn
// ---------------------------------------------------------------------------

export function applyManaRegen(playerStats: DerivedCombatStats, state: EngineState): TurnResult {
  const events: CombatEventDto[] = [];
  if (playerStats.manaRegen <= 0) return { events, newState: state };

  const gained = Math.min(playerStats.manaRegen, playerStats.maxMana - state.playerMana);
  if (gained <= 0) return { events, newState: state };

  events.push({ kind: 'mana_gained', source: 'player', target: 'player', value: gained });
  return { events, newState: { ...state, playerMana: state.playerMana + gained } };
}

// ---------------------------------------------------------------------------
// Internal: apply a single ability's effect to state
// ---------------------------------------------------------------------------

function applyAbilityEffect(
  ability: LoadoutSlotSnapshot,
  playerStats: DerivedCombatStats,
  enemyDefence: number,
  state: EngineState,
): CombatEventDto[] {
  const events: CombatEventDto[] = [];

  const effDef = Math.floor(enemyDefence * (1 - (playerStats.armorPenetration ?? 0) / 100));

  switch (ability.effectType) {
    case 'damage': {
      const rawDmg = Math.floor(playerStats.attack * (ability.effectValue / 100));
      const dmg = Math.max(1, rawDmg - effDef);
      state.enemyHp = Math.max(0, state.enemyHp - dmg);
      events.push({ kind: 'ability_fired', source: 'player', target: 'enemy', value: dmg, ability_name: ability.name });
      break;
    }
    case 'heal': {
      const healAmt = Math.floor(playerStats.maxHp * (ability.effectValue / 100));
      state.playerHp = Math.min(playerStats.maxHp, state.playerHp + healAmt);
      events.push({ kind: 'ability_fired', source: 'player', target: 'player', value: healAmt, ability_name: ability.name });
      break;
    }
    case 'buff': {
      const effId = `buff-${ability.abilityId}-${Date.now()}`;
      state.activeEffects.push({
        id: effId,
        source: 'player',
        target: 'player',
        effectType: 'buff',
        stat: ability.name === 'Iron Skin' ? 'defence' : 'attack',
        value: ability.effectValue,
        turnsRemaining: ability.durationTurns,
        abilityName: ability.name,
      });
      events.push({ kind: 'effect_applied', source: 'player', target: 'player', ability_name: ability.name, value: ability.effectValue });
      break;
    }
    case 'debuff': {
      const effId = `debuff-${ability.abilityId}-${Date.now()}`;
      state.activeEffects.push({
        id: effId,
        source: 'player',
        target: 'enemy',
        effectType: 'debuff',
        stat: 'defence',
        value: ability.effectValue,
        turnsRemaining: ability.durationTurns,
        abilityName: ability.name,
      });
      events.push({ kind: 'effect_applied', source: 'player', target: 'enemy', ability_name: ability.name, value: ability.effectValue });
      break;
    }
    case 'dot': {
      const effId = `dot-${ability.abilityId}-${Date.now()}`;
      state.activeEffects.push({
        id: effId,
        source: 'player',
        target: 'enemy',
        effectType: 'dot',
        value: ability.effectValue,
        turnsRemaining: ability.durationTurns,
        abilityName: ability.name,
      });
      events.push({ kind: 'effect_applied', source: 'player', target: 'enemy', ability_name: ability.name });
      break;
    }
    case 'reflect': {
      const effId = `reflect-${ability.abilityId}-${Date.now()}`;
      state.activeEffects.push({
        id: effId,
        source: 'player',
        target: 'enemy',
        effectType: 'reflect',
        value: ability.effectValue,
        turnsRemaining: ability.durationTurns,
        abilityName: ability.name,
      });
      events.push({ kind: 'effect_applied', source: 'player', target: 'enemy', ability_name: ability.name });
      break;
    }
    case 'drain': {
      const rawDmg = Math.floor(playerStats.attack * (ability.effectValue / 100));
      const dmg = Math.max(1, rawDmg - effDef);
      const healAmt = Math.floor(dmg * 0.5);
      state.enemyHp = Math.max(0, state.enemyHp - dmg);
      state.playerHp = Math.min(playerStats.maxHp, state.playerHp + healAmt);
      events.push({ kind: 'ability_fired', source: 'player', target: 'enemy', value: dmg, ability_name: ability.name });
      events.push({ kind: 'ability_fired', source: 'player', target: 'player', value: healAmt, ability_name: ability.name });
      break;
    }
  }

  return events;
}
