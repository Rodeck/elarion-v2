/**
 * boss-combat-handler.ts
 *
 * Handles boss combat: challenge initiation, turn loop with boss abilities,
 * hidden HP brackets, persistent HP, and loot on defeat.
 */

import crypto from 'crypto';
import { log } from '../../logger';
import { config } from '../../config';
import { sendToSession } from '../../websocket/server';
import { findByAccountId } from '../../db/queries/characters';
import { getInventoryWithDefinitions, updateInventoryQuantity, deleteInventoryItem, getRandomItemByCategory } from '../../db/queries/inventory';
import { computeCombatStats } from '../combat/combat-stats-service';
import { getCharacterLoadout, setCharacterInCombat } from '../../db/queries/loadouts';
import { awardXp } from '../progression/xp-service';
import { buildAbilityIconUrl } from '../../db/queries/abilities';
import { awardCrowns } from '../currency/crown-service';
import { grantItemToCharacter } from '../inventory/inventory-grant-service';
import { sendInventoryState } from '../../websocket/handlers/inventory-state-handler';
import {
  computePlayerAttack,
  computeAutoAbilities,
  computeActiveAbility,
  computeEnemyTurn,
  tickActiveEffects,
  tickAbilityCooldowns,
  applyManaRegen,
} from '../combat/combat-engine';
import type { DerivedCombatStats, LoadoutSlotSnapshot, EngineState, AutoSlotConfig } from '../combat/combat-engine';
import type { AuthenticatedSession } from '../../websocket/server';
import * as bossManager from './boss-instance-manager';
import type {
  BossCombatStartPayload,
  BossCombatTurnResultPayload,
  BossCombatActiveWindowPayload,
  BossCombatEndPayload,
  CombatAbilityStateDto,
  ActiveEffectDto,
  ItemDroppedDto,
  LoadoutSlotDto,
  BossHpBracket,
} from '../../../../shared/protocol/index';
import type { Boss, BossAbility, BossLootEntry } from '../../db/queries/bosses';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TURN_TIMER_MS = 3_000;
const ENEMY_TURN_DELAY_MS = 2_000;
const BOSS_CHALLENGE_TOKEN_NAME = 'Boss Challenge Token';

// ---------------------------------------------------------------------------
// Active boss combat sessions (in-memory, keyed by characterId)
// ---------------------------------------------------------------------------

interface BossCombatSession {
  combatId: string;
  session: AuthenticatedSession;
  characterId: string;
  characterName: string;
  bossId: number;
  boss: Boss;
  bossAbilities: BossAbility[];
  playerStats: DerivedCombatStats & { maxHp: number };
  playerMaxMana: number;
  loadout: CombatLoadout;
  engineState: EngineState;
  turn: number;
  phase: 'player_turn' | 'active_window' | 'enemy_turn' | 'ended';
  activeWindowTimer: ReturnType<typeof setTimeout> | null;
  enemyMaxHp: number;
  effectiveAttack: number;
  effectiveDefense: number;
}

interface CombatLoadout {
  auto_1: (LoadoutSlotSnapshot & { iconUrl: string | null }) | null;
  auto_2: (LoadoutSlotSnapshot & { iconUrl: string | null }) | null;
  auto_3: (LoadoutSlotSnapshot & { iconUrl: string | null }) | null;
  active: (LoadoutSlotSnapshot & { iconUrl: string | null }) | null;
}

const activeSessions = new Map<string, BossCombatSession>();

// ---------------------------------------------------------------------------
// Challenge handler (registered as 'boss:challenge')
// ---------------------------------------------------------------------------

export async function handleBossChallenge(
  session: AuthenticatedSession,
  payload: unknown,
): Promise<void> {
  const { boss_id } = payload as { boss_id: number };
  const characterId = session.characterId;
  if (!characterId) {
    sendToSession(session, 'boss:challenge_rejected', { reason: 'not_found', message: 'Character required.' });
    return;
  }

  const character = await findByAccountId(session.accountId);
  if (!character) {
    sendToSession(session, 'boss:challenge_rejected', { reason: 'not_found', message: 'Character not found.' });
    return;
  }

  // Gate: must be alive
  if (character.current_hp <= 0) {
    sendToSession(session, 'boss:challenge_rejected', { reason: 'already_in_combat', message: 'You are too wounded to fight.' });
    return;
  }

  // Gate: not already in combat
  if (character.in_combat || activeSessions.has(characterId)) {
    sendToSession(session, 'boss:challenge_rejected', { reason: 'already_in_combat', message: 'You are already in combat.' });
    return;
  }

  // Gate: has Boss Challenge Token
  const inventory = await getInventoryWithDefinitions(characterId);
  const tokenSlot = inventory.find((s) => s.def_name === BOSS_CHALLENGE_TOKEN_NAME && s.quantity >= 1);
  if (!tokenSlot) {
    sendToSession(session, 'boss:challenge_rejected', { reason: 'no_token', message: 'You need a Boss Challenge Token to challenge this guardian.' });
    return;
  }

  // Try to lock boss
  const result = await bossManager.challengeBoss(boss_id, characterId);
  if (!result.success) {
    const messages: Record<string, string> = {
      not_found: 'Boss not found.',
      inactive: 'This guardian is dormant.',
      defeated: 'This guardian has been defeated. It will return soon.',
      in_combat: 'Another adventurer is already fighting this guardian.',
    };
    sendToSession(session, 'boss:challenge_rejected', {
      reason: result.reason,
      message: messages[result.reason] ?? 'Cannot challenge.',
      respawn_at: 'respawnAt' in result ? result.respawnAt : null,
    });
    return;
  }

  // Consume token
  if (tokenSlot.quantity <= 1) {
    await deleteInventoryItem(tokenSlot.id, characterId);
  } else {
    await updateInventoryQuantity(tokenSlot.id, tokenSlot.quantity - 1);
  }

  // Push updated inventory to client (token consumed)
  await sendInventoryState(session);

  // Set in_combat flag
  await setCharacterInCombat(characterId, true);

  // Load combat data
  const stats = await computeCombatStats(characterId);
  const loadoutSlots = await getCharacterLoadout(characterId);
  const bossAbilities = await bossManager.getBossAbilitiesForCombat(boss_id);

  // Build loadout
  const loadout = buildLoadout(loadoutSlots);

  // Build engine state
  const engineState: EngineState = {
    playerHp: character.current_hp,
    playerMana: 0,
    enemyHp: result.instance.current_hp,
    activeEffects: [],
    abilityCooldowns: new Map(),
  };

  // Get effective combat stats (randomized per instance)
  const instanceStats = bossManager.getInstanceCombatStats(boss_id);

  const combatSession: BossCombatSession = {
    combatId: crypto.randomUUID(),
    session,
    characterId,
    characterName: character.name,
    bossId: boss_id,
    boss: result.boss,
    bossAbilities,
    playerStats: stats,
    playerMaxMana: stats.maxMana,
    loadout,
    engineState,
    turn: 0,
    phase: 'player_turn',
    activeWindowTimer: null,
    enemyMaxHp: result.instance.current_hp, // instance HP (randomized on spawn)
    effectiveAttack: instanceStats.attack,
    effectiveDefense: instanceStats.defense,
  };

  activeSessions.set(characterId, combatSession);

  // Send combat start
  const startPayload: BossCombatStartPayload = {
    combat_id: combatSession.combatId,
    boss: {
      id: result.boss.id,
      name: result.boss.name,
      icon_url: result.boss.icon_filename ? `/assets/bosses/icons/${result.boss.icon_filename}` : null,
      attack: instanceStats.attack,
      defense: instanceStats.defense,
      hp_bracket: bossManager.hpToBracket(result.instance.current_hp, result.boss.max_hp),
      abilities: bossAbilities.map((a) => ({
        name: a.name ?? 'Unknown',
        icon_url: buildAbilityIconUrl(a.icon_filename ?? null),
      })),
    },
    player: {
      max_hp: stats.maxHp,
      current_hp: character.current_hp,
      max_mana: stats.maxMana,
      current_mana: 0,
      attack: stats.attack,
      defence: stats.defence,
    },
    loadout: { slots: buildAbilityStates(combatSession) },
    turn_timer_ms: TURN_TIMER_MS,
    active_effects: [],
  };

  sendToSession(session, 'boss:combat_start', startPayload);

  // Broadcast state change to zone
  bossManager.broadcastBossState(boss_id);

  // Execute additional attacks (bonus hits before first turn, no crits)
  executeAdditionalAttacks(combatSession);

  // Start first turn
  startTurn(combatSession);
}

// ---------------------------------------------------------------------------
// Active ability trigger (registered as 'boss:combat_trigger_active')
// ---------------------------------------------------------------------------

export async function handleBossCombatTriggerActive(
  session: AuthenticatedSession,
  payload: unknown,
): Promise<void> {
  const { combat_id } = payload as { combat_id: string };
  const cs = activeSessions.get(session.characterId!);
  if (!cs || cs.combatId !== combat_id || cs.phase !== 'active_window') return;

  if (cs.activeWindowTimer) {
    clearTimeout(cs.activeWindowTimer);
    cs.activeWindowTimer = null;
  }

  // Fire active ability
  if (cs.loadout.active) {
    const result = computeActiveAbility(
      cs.loadout.active,
      cs.playerStats,
      cs.effectiveDefense,
      cs.engineState,
    );
    cs.engineState = result.newState;

    // Check if boss died from active ability
    if (cs.engineState.enemyHp <= 0) {
      await endCombat(cs, 'win');
      return;
    }
  }

  // Proceed to enemy turn
  cs.phase = 'enemy_turn';
  await runEnemyTurn(cs);
}

// ---------------------------------------------------------------------------
// Disconnect cleanup
// ---------------------------------------------------------------------------

export async function handleBossDisconnect(characterId: string): Promise<void> {
  const cs = activeSessions.get(characterId);
  if (!cs) return;
  await endCombat(cs, 'loss');
}

// ---------------------------------------------------------------------------
// Additional attacks (bonus hits at combat start)
// ---------------------------------------------------------------------------

function executeAdditionalAttacks(cs: BossCombatSession): void {
  const count = cs.playerStats.additionalAttacks ?? 0;
  if (count <= 0) return;

  const bonusEvents: import('../../../../shared/protocol/index').CombatEventDto[] = [];

  for (let i = 0; i < count; i++) {
    if (cs.engineState.enemyHp <= 0) break;
    const noCritStats: DerivedCombatStats = { ...cs.playerStats, critChance: 0 };
    const result = computePlayerAttack(noCritStats, 0, cs.effectiveDefense, cs.engineState);
    cs.engineState = result.newState;
    bonusEvents.push(...result.events);
  }

  if (bonusEvents.length > 0) {
    sendTurnResult(cs, 'player', bonusEvents);
  }
}

// ---------------------------------------------------------------------------
// Turn loop
// ---------------------------------------------------------------------------

function startTurn(cs: BossCombatSession): void {
  if (cs.phase === 'ended') return;

  cs.turn++;
  cs.phase = 'player_turn';

  // 1. Mana regen
  const manaResult = applyManaRegen(cs.playerStats, cs.engineState);
  cs.engineState = manaResult.newState;
  const turnEvents = [...manaResult.events];

  // 2. Player auto-attack
  const attackResult = computePlayerAttack(cs.playerStats, 0, cs.effectiveDefense, cs.engineState);
  cs.engineState = attackResult.newState;
  turnEvents.push(...attackResult.events);

  if (cs.engineState.enemyHp <= 0) {
    sendTurnResult(cs, 'player', turnEvents);
    void endCombat(cs, 'win');
    return;
  }

  // 3. Auto abilities
  const autoSlots = buildAutoSlots(cs.loadout);
  if (autoSlots.length > 0) {
    const autoResult = computeAutoAbilities(autoSlots, cs.playerStats, cs.effectiveDefense, cs.engineState);
    cs.engineState = autoResult.newState;
    turnEvents.push(...autoResult.events);

    if (cs.engineState.enemyHp <= 0) {
      sendTurnResult(cs, 'player', turnEvents);
      void endCombat(cs, 'win');
      return;
    }
  }

  // Send player turn result
  sendTurnResult(cs, 'player', turnEvents);

  // 4. Open active window
  cs.phase = 'active_window';
  const activeAbility = cs.loadout.active;
  const canUseActive = activeAbility &&
    cs.engineState.playerMana >= activeAbility.manaCost &&
    (cs.engineState.abilityCooldowns.get(activeAbility.abilityId) ?? 0) === 0;

  const windowPayload: BossCombatActiveWindowPayload = {
    combat_id: cs.combatId,
    timer_ms: TURN_TIMER_MS,
    ability: canUseActive ? buildSingleAbilityState(activeAbility!, cs.engineState) : null,
  };
  sendToSession(cs.session, 'boss:combat_active_window', windowPayload);

  // Auto-close window after timeout
  cs.activeWindowTimer = setTimeout(async () => {
    if (cs.phase !== 'active_window') return;
    cs.phase = 'enemy_turn';
    await runEnemyTurn(cs);
  }, TURN_TIMER_MS);
}

async function runEnemyTurn(cs: BossCombatSession): Promise<void> {
  const enemyEvents: typeof cs.engineState.activeEffects extends unknown[] ? import('../../../../shared/protocol/index').CombatEventDto[] : never = [];

  // Tick effects (DoT etc.)
  const tickResult = tickActiveEffects(cs.playerStats, cs.engineState);
  cs.engineState = tickResult.newState;
  enemyEvents.push(...tickResult.events);

  // Tick cooldowns
  cs.engineState = tickAbilityCooldowns(cs.engineState);

  if (cs.engineState.enemyHp <= 0) {
    sendTurnResult(cs, 'enemy', enemyEvents);
    await endCombat(cs, 'win');
    return;
  }

  // Boss abilities (fire by priority, unlimited mana, gated by cooldown)
  const DURATION_EFFECTS = new Set(['buff', 'debuff', 'dot', 'reflect', 'shield']);
  for (const ba of cs.bossAbilities) {
    const cooldown = cs.engineState.abilityCooldowns.get(ba.ability_id) ?? 0;
    if (cooldown > 0) continue;

    const abilityName = ba.name ?? 'Unknown';
    const effectType = ba.effect_type ?? 'damage';
    const effectValue = ba.effect_value ?? 0;

    // Skip if this boss ability already has an active effect (no stacking)
    if (DURATION_EFFECTS.has(effectType) && cs.engineState.activeEffects.some((e) => e.abilityName === abilityName)) continue;

    // Apply boss ability effect — boss is the source, player is the target
    const abilityEvents = applyBossAbilityEffect(
      ba.ability_id, abilityName, effectType, effectValue,
      ba.duration_turns ?? 0, cs.effectiveAttack, cs.playerStats, cs.engineState,
    );
    enemyEvents.push(...abilityEvents);

    // Start cooldown
    if ((ba.cooldown_turns ?? 0) > 0) {
      cs.engineState.abilityCooldowns.set(ba.ability_id, ba.cooldown_turns!);
    }

    break; // Only fire one ability per turn (highest priority)
  }

  // Boss basic attack (always, even if ability fired)
  const enemyTurnResult = computeEnemyTurn(cs.effectiveAttack, cs.playerStats, cs.engineState);
  cs.engineState = enemyTurnResult.newState;
  enemyEvents.push(...enemyTurnResult.events);

  // Send enemy turn result
  sendTurnResult(cs, 'enemy', enemyEvents);

  // Check outcomes
  if (cs.engineState.playerHp <= 0) {
    await endCombat(cs, 'loss');
    return;
  }
  if (cs.engineState.enemyHp <= 0) {
    await endCombat(cs, 'win');
    return;
  }

  // Persist boss HP after each turn
  await bossManager.updateHp(cs.bossId, cs.engineState.enemyHp);

  // Next turn after delay
  setTimeout(() => startTurn(cs), ENEMY_TURN_DELAY_MS);
}

// ---------------------------------------------------------------------------
// End combat
// ---------------------------------------------------------------------------

async function endCombat(cs: BossCombatSession, outcome: 'win' | 'loss'): Promise<void> {
  if (cs.phase === 'ended') return;
  cs.phase = 'ended';

  if (cs.activeWindowTimer) {
    clearTimeout(cs.activeWindowTimer);
    cs.activeWindowTimer = null;
  }

  activeSessions.delete(cs.characterId);

  // Persist player HP
  const { query: dbQuery } = await import('../../db/connection');
  await dbQuery('UPDATE characters SET current_hp = $1, in_combat = false WHERE id = $2', [
    Math.max(0, cs.engineState.playerHp),
    cs.characterId,
  ]);

  let xpGained = 0;
  let crownsGained = 0;
  const itemsDropped: ItemDroppedDto[] = [];

  if (outcome === 'win') {
    // Award XP
    xpGained = cs.boss.xp_reward;
    if (xpGained > 0) {
      await awardXp(cs.characterId, xpGained);
    }

    // Award crowns
    const min = cs.boss.min_crowns;
    const max = cs.boss.max_crowns;
    if (max > 0) {
      crownsGained = Math.floor(Math.random() * (max - min + 1)) + min;
      if (crownsGained > 0) {
        await awardCrowns(cs.characterId, crownsGained);
      }
    }

    // Roll loot
    const loot = await bossManager.getBossLootForCombat(cs.bossId);
    for (const entry of loot) {
      const roll = Math.random() * 100;
      if (roll < entry.drop_chance) {
        let itemDefId = entry.item_def_id;
        let itemName = entry.item_name ?? 'Unknown';
        let iconFilename = entry.icon_filename;

        // Category-based loot: pick a random item from the category
        if (!itemDefId && entry.item_category) {
          const picked = await getRandomItemByCategory(entry.item_category);
          if (!picked) continue;
          itemDefId = picked.id;
          itemName = picked.name;
          iconFilename = picked.icon_filename;
        }
        if (!itemDefId) continue;

        await grantItemToCharacter(cs.session, cs.characterId, itemDefId, entry.quantity);
        itemsDropped.push({
          item_def_id: itemDefId,
          name: itemName,
          icon_url: iconFilename ? `${config.adminBaseUrl}/item-icons/${iconFilename}` : null,
          quantity: entry.quantity,
        });
      }
    }

    // Persist boss HP to 0 and defeat
    await bossManager.updateHp(cs.bossId, 0);
    await bossManager.defeatBoss(cs.bossId, cs.characterName);

    log('info', 'boss', 'combat_win', {
      boss_id: cs.bossId,
      boss_name: cs.boss.name,
      character_id: cs.characterId,
      xp: xpGained,
      crowns: crownsGained,
      items: itemsDropped.length,
    });
  } else {
    // Loss — boss keeps HP
    await bossManager.updateHp(cs.bossId, cs.engineState.enemyHp);
    await bossManager.releaseBoss(cs.bossId);

    log('info', 'boss', 'combat_loss', {
      boss_id: cs.bossId,
      boss_name: cs.boss.name,
      character_id: cs.characterId,
      boss_hp_remaining: cs.engineState.enemyHp,
    });
  }

  const endPayload: BossCombatEndPayload = {
    combat_id: cs.combatId,
    outcome,
    current_hp: Math.max(0, cs.engineState.playerHp),
    boss_name: cs.boss.name,
    boss_icon_url: cs.boss.icon_filename ? `/assets/bosses/icons/${cs.boss.icon_filename}` : null,
    enemy_hp_bracket: bossManager.hpToBracket(
      Math.max(0, cs.engineState.enemyHp),
      cs.enemyMaxHp,
    ),
    xp_gained: xpGained,
    crowns_gained: crownsGained,
    items_dropped: itemsDropped,
  };

  sendToSession(cs.session, 'boss:combat_end', endPayload);

  // Push updated inventory (loot granted on win, token already consumed on start)
  await sendInventoryState(cs.session);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sendTurnResult(cs: BossCombatSession, phase: 'player' | 'enemy', events: import('../../../../shared/protocol/index').CombatEventDto[]): void {
  const payload: BossCombatTurnResultPayload = {
    combat_id: cs.combatId,
    turn: cs.turn,
    phase,
    events,
    player_hp: cs.engineState.playerHp,
    player_mana: cs.engineState.playerMana,
    enemy_hp_bracket: bossManager.hpToBracket(cs.engineState.enemyHp, cs.enemyMaxHp),
    ability_states: buildAbilityStates(cs),
    active_effects: serializeActiveEffects(cs),
  };
  sendToSession(cs.session, 'boss:combat_turn_result', payload);
}

function serializeActiveEffects(cs: BossCombatSession): ActiveEffectDto[] {
  // Build name→iconUrl lookup from player loadout + boss abilities
  const iconMap = new Map<string, string | null>();
  for (const slot of [cs.loadout.auto_1, cs.loadout.auto_2, cs.loadout.auto_3, cs.loadout.active]) {
    if (slot) iconMap.set(slot.name, slot.iconUrl);
  }
  for (const ba of cs.bossAbilities) {
    if (ba.name) iconMap.set(ba.name, buildAbilityIconUrl(ba.icon_filename ?? null));
  }

  return cs.engineState.activeEffects.map((e) => ({
    id:              e.id,
    source:          e.source,
    target:          e.target,
    effect_type:     e.effectType,
    stat:            e.stat,
    value:           e.value,
    turns_remaining: e.turnsRemaining,
    ability_name:    e.abilityName,
    icon_url:        iconMap.get(e.abilityName) ?? null,
  }));
}

function buildLoadout(slots: LoadoutSlotDto[]): CombatLoadout {
  const loadout: CombatLoadout = { auto_1: null, auto_2: null, auto_3: null, active: null };
  for (const slot of slots) {
    if (!slot.ability) continue;
    const snapshot: LoadoutSlotSnapshot & { iconUrl: string | null } = {
      abilityId: slot.ability.id,
      name: slot.ability.name,
      description: slot.ability.description,
      manaCost: slot.ability.mana_cost,
      effectType: slot.ability.effect_type,
      effectValue: slot.ability.effect_value,
      durationTurns: slot.ability.duration_turns,
      cooldownTurns: slot.ability.cooldown_turns,
      priority: slot.priority,
      slotType: slot.ability.slot_type,
      iconUrl: slot.ability.icon_url,
    };
    loadout[slot.slot_name] = snapshot;
  }
  return loadout;
}

function buildAutoSlots(loadout: CombatLoadout): AutoSlotConfig[] {
  const result: AutoSlotConfig[] = [];
  for (const slotName of ['auto_1', 'auto_2', 'auto_3'] as const) {
    const slot = loadout[slotName];
    if (slot) result.push({ slot_name: slotName, ability: slot });
  }
  return result;
}

function buildAbilityStates(cs: BossCombatSession): CombatAbilityStateDto[] {
  const states: CombatAbilityStateDto[] = [];
  for (const slotName of ['auto_1', 'auto_2', 'auto_3', 'active'] as const) {
    const slot = cs.loadout[slotName];
    if (!slot) continue;
    const cooldown = cs.engineState.abilityCooldowns.get(slot.abilityId) ?? 0;
    let status: 'ready' | 'cooldown' | 'insufficient_mana' = 'ready';
    if (cooldown > 0) status = 'cooldown';
    else if (cs.engineState.playerMana < slot.manaCost) status = 'insufficient_mana';
    states.push({
      slot_name: slotName,
      ability_id: slot.abilityId,
      name: slot.name,
      description: slot.description,
      mana_cost: slot.manaCost,
      icon_url: slot.iconUrl,
      status,
      cooldown_turns_remaining: cooldown,
    });
  }
  return states;
}

// ---------------------------------------------------------------------------
// Boss ability effect — inverse of player applyAbilityEffect
// Boss is the source, player is the target for damage/debuffs
// ---------------------------------------------------------------------------

function applyBossAbilityEffect(
  abilityId: number,
  abilityName: string,
  effectType: string,
  effectValue: number,
  durationTurns: number,
  bossAttack: number,
  playerStats: DerivedCombatStats & { maxHp: number },
  state: EngineState,
): import('../../../../shared/protocol/index').CombatEventDto[] {
  const events: import('../../../../shared/protocol/index').CombatEventDto[] = [];

  switch (effectType) {
    case 'damage': {
      // Boss damage ability hits the player
      const rawDmg = Math.floor(bossAttack * (effectValue / 100));
      const dmg = Math.max(1, rawDmg - playerStats.defence);
      state.playerHp = Math.max(0, state.playerHp - dmg);
      events.push({ kind: 'ability_fired', source: 'enemy', target: 'player', value: dmg, ability_name: abilityName });
      break;
    }
    case 'heal': {
      // Boss heals itself
      const healAmt = Math.floor(effectValue); // flat heal for bosses
      state.enemyHp = state.enemyHp + healAmt;
      events.push({ kind: 'ability_fired', source: 'enemy', target: 'enemy', value: healAmt, ability_name: abilityName });
      break;
    }
    case 'buff': {
      // Boss buffs itself (e.g., Iron Skin on the boss)
      const effId = `boss-buff-${abilityId}-${Date.now()}`;
      state.activeEffects.push({
        id: effId,
        source: 'enemy',
        target: 'enemy',
        effectType: 'buff',
        stat: abilityName === 'Iron Skin' ? 'defence' : 'attack',
        value: effectValue,
        turnsRemaining: durationTurns,
        abilityName,
      });
      events.push({ kind: 'effect_applied', source: 'enemy', target: 'enemy', ability_name: abilityName, value: effectValue });
      break;
    }
    case 'debuff': {
      // Boss debuffs the player
      const effId = `boss-debuff-${abilityId}-${Date.now()}`;
      state.activeEffects.push({
        id: effId,
        source: 'enemy',
        target: 'player',
        effectType: 'debuff',
        stat: 'defence',
        value: effectValue,
        turnsRemaining: durationTurns,
        abilityName,
      });
      events.push({ kind: 'effect_applied', source: 'enemy', target: 'player', ability_name: abilityName, value: effectValue });
      break;
    }
    case 'dot': {
      // Boss applies DoT to the player
      const effId = `boss-dot-${abilityId}-${Date.now()}`;
      state.activeEffects.push({
        id: effId,
        source: 'enemy',
        target: 'player',
        effectType: 'dot',
        value: effectValue,
        turnsRemaining: durationTurns,
        abilityName,
      });
      events.push({ kind: 'effect_applied', source: 'enemy', target: 'player', ability_name: abilityName });
      break;
    }
    case 'drain': {
      // Boss drains player HP and heals itself
      const rawDmg = Math.floor(bossAttack * (effectValue / 100));
      const dmg = Math.max(1, rawDmg - playerStats.defence);
      const healAmt = Math.floor(dmg * 0.5);
      state.playerHp = Math.max(0, state.playerHp - dmg);
      state.enemyHp = state.enemyHp + healAmt;
      events.push({ kind: 'ability_fired', source: 'enemy', target: 'player', value: dmg, ability_name: abilityName });
      events.push({ kind: 'ability_fired', source: 'enemy', target: 'enemy', value: healAmt, ability_name: abilityName });
      break;
    }
    case 'reflect': {
      // Boss gets a reflect shield
      const effId = `boss-reflect-${abilityId}-${Date.now()}`;
      state.activeEffects.push({
        id: effId,
        source: 'enemy',
        target: 'player', // reflects damage back to player
        effectType: 'reflect',
        value: effectValue,
        turnsRemaining: durationTurns,
        abilityName,
      });
      events.push({ kind: 'effect_applied', source: 'enemy', target: 'player', ability_name: abilityName });
      break;
    }
  }

  return events;
}

function buildSingleAbilityState(
  slot: LoadoutSlotSnapshot & { iconUrl: string | null },
  state: EngineState,
): CombatAbilityStateDto {
  const cooldown = state.abilityCooldowns.get(slot.abilityId) ?? 0;
  let status: 'ready' | 'cooldown' | 'insufficient_mana' = 'ready';
  if (cooldown > 0) status = 'cooldown';
  else if (state.playerMana < slot.manaCost) status = 'insufficient_mana';
  return {
    slot_name: 'active',
    ability_id: slot.abilityId,
    name: slot.name,
    description: slot.description,
    mana_cost: slot.manaCost,
    icon_url: slot.iconUrl,
    status,
    cooldown_turns_remaining: cooldown,
  };
}
