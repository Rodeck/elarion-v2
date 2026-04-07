/**
 * arena-combat-handler.ts
 *
 * Handles PvP combat within arenas: challenge initiation, simultaneous
 * turn loop with dual EngineState management, active ability windows,
 * HP syncing, rewards, and disconnection handling.
 */

import crypto from 'crypto';
import { config } from '../../config';
import { log } from '../../logger';
import { sendToSession, getSessionByCharacterId } from '../../websocket/server';
import { registerHandler } from '../../websocket/dispatcher';
import { query } from '../../db/connection';
import { computeCombatStats } from '../combat/combat-stats-service';
import { getCharacterLoadout } from '../../db/queries/loadouts';
import { awardXp } from '../progression/xp-service';
import { awardCrowns } from '../currency/crown-service';
import { getArenaById, getArenaMonsterEntry } from '../../db/queries/arenas';
import {
  updateParticipantCombatState,
  setPreFightHp,
  clearPreFightHp,
  updateParticipantHp,
} from '../../db/queries/arenas';
import {
  getInventoryWithDefinitions,
  deleteInventoryItem,
  updateInventoryQuantity,
} from '../../db/queries/inventory';
import { sendInventoryState } from '../../websocket/handlers/inventory-state-handler';
import { getMonsterById } from '../../db/queries/monsters';
import {
  getParticipant,
  setInCombat,
  updateHp,
  broadcastToArena,
} from './arena-state-manager';
import { kickFromArena } from './arena-handler';
import { getFatigueConfig } from '../../db/queries/fatigue-config';
import {
  computePlayerAttack,
  computeAutoAbilities,
  computeActiveAbility,
  computeEnemyTurn,
  tickActiveEffects,
  tickAbilityCooldowns,
  applyManaRegen,
} from '../combat/combat-engine';
import type {
  DerivedCombatStats,
  LoadoutSlotSnapshot,
  EngineState,
  AutoSlotConfig,
} from '../combat/combat-engine';
import type { AuthenticatedSession } from '../../websocket/server';
import type {
  CombatEventDto,
  CombatAbilityStateDto,
  ActiveEffectDto,
  ArenaCombatStartPayload,
  ArenaCombatTurnResultPayload,
  ArenaCombatActiveWindowPayload,
  ArenaCombatEndPayload,
  ArenaChallengeRejectedPayload,
  ArenaParticipantUpdatedPayload,
  LoadoutSlotDto,
  FatigueStateDto,
} from '../../../../shared/protocol/index';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TURN_TIMER_MS = 3_000;
const ENEMY_TURN_DELAY_MS = 2_000;

// ---------------------------------------------------------------------------
// Loadout types (mirrors boss-combat-handler)
// ---------------------------------------------------------------------------

interface CombatLoadout {
  auto_1: (LoadoutSlotSnapshot & { iconUrl: string | null }) | null;
  auto_2: (LoadoutSlotSnapshot & { iconUrl: string | null }) | null;
  auto_3: (LoadoutSlotSnapshot & { iconUrl: string | null }) | null;
  active: (LoadoutSlotSnapshot & { iconUrl: string | null }) | null;
}

// ---------------------------------------------------------------------------
// PvP combat session
// ---------------------------------------------------------------------------

interface PvpCombatSession {
  combatId: string;
  arenaId: number;
  challengerId: string;
  defenderId: string;
  challengerSession: AuthenticatedSession;
  defenderSession: AuthenticatedSession;
  challengerStats: DerivedCombatStats & { maxHp: number };
  defenderStats: DerivedCombatStats & { maxHp: number };
  challengerLoadout: CombatLoadout;
  defenderLoadout: CombatLoadout;
  challengerState: EngineState;
  defenderState: EngineState;
  turn: number;
  phase: 'player_turn' | 'active_window' | 'ended';
  activeWindowTimer: ReturnType<typeof setTimeout> | null;
  challengerActedThisTurn: boolean;
  defenderActedThisTurn: boolean;
  // Fatigue system state
  fatigueStartRound: number;
  fatigueBaseDamage: number;
  fatigueDamageIncrement: number;
  fatigueActive: boolean;
  fatigueTurnCount: number;
  fatigueOnsetDelayModifier: number;
  fatigueImmunityRoundsLeft: number;
  fatigueDamageReduction: number;
}

// keyed by combatId
const pvpSessions = new Map<string, PvpCombatSession>();
// characterId → combatId
const characterToSession = new Map<string, string>();

// ---------------------------------------------------------------------------
// Arena NPC combat session
// ---------------------------------------------------------------------------

const ARENA_CHALLENGE_TOKEN_NAME = 'Arena Challenge Token';

interface ArenaNpcCombatSession {
  combatId: string;
  arenaId: number;
  session: AuthenticatedSession;
  characterId: string;
  monsterId: number;
  monsterName: string;
  monsterIconFilename: string | null;
  monsterAttack: number;
  monsterDefense: number;
  monsterMaxHp: number;
  monsterXpReward: number;
  playerStats: DerivedCombatStats & { maxHp: number };
  loadout: CombatLoadout;
  engineState: EngineState;
  turn: number;
  phase: 'player_turn' | 'active_window' | 'enemy_turn' | 'ended';
  activeWindowTimer: ReturnType<typeof setTimeout> | null;
  enemyTurnDelayRef: ReturnType<typeof setTimeout> | null;
  // Fatigue system state
  fatigueStartRound: number;
  fatigueBaseDamage: number;
  fatigueDamageIncrement: number;
  fatigueActive: boolean;
  fatigueTurnCount: number;
  fatigueOnsetDelayModifier: number;
  fatigueImmunityRoundsLeft: number;
  fatigueDamageReduction: number;
}

// keyed by characterId
const npcSessions = new Map<string, ArenaNpcCombatSession>();

// ---------------------------------------------------------------------------
// Challenge handler (arena:challenge_player)
// ---------------------------------------------------------------------------

async function handleChallengePlayer(
  session: AuthenticatedSession,
  payload: unknown,
): Promise<void> {
  const { target_character_id } = payload as { target_character_id: string };
  const challengerId = session.characterId;

  if (!challengerId) {
    sendToSession(session, 'arena:challenge_rejected', {
      reason: 'not_in_arena',
      message: 'Character required.',
    } satisfies ArenaChallengeRejectedPayload);
    return;
  }

  // Validate challenger is in an arena
  const challengerParticipant = getParticipant(challengerId);
  if (!challengerParticipant) {
    sendToSession(session, 'arena:challenge_rejected', {
      reason: 'not_in_arena',
      message: 'You are not in an arena.',
    } satisfies ArenaChallengeRejectedPayload);
    return;
  }

  // Validate not self-challenge
  if (challengerId === target_character_id) {
    sendToSession(session, 'arena:challenge_rejected', {
      reason: 'target_not_found',
      message: 'You cannot challenge yourself.',
    } satisfies ArenaChallengeRejectedPayload);
    return;
  }

  // Validate challenger not already in combat
  if (challengerParticipant.participant.inCombat || characterToSession.has(challengerId)) {
    sendToSession(session, 'arena:challenge_rejected', {
      reason: 'self_in_combat',
      message: 'You are already in combat.',
    } satisfies ArenaChallengeRejectedPayload);
    return;
  }

  // Validate target is in the same arena
  const defenderParticipant = getParticipant(target_character_id);
  if (!defenderParticipant || defenderParticipant.arenaId !== challengerParticipant.arenaId) {
    sendToSession(session, 'arena:challenge_rejected', {
      reason: 'target_not_found',
      message: 'Target is not in this arena.',
    } satisfies ArenaChallengeRejectedPayload);
    return;
  }

  // Validate target not in combat
  if (defenderParticipant.participant.inCombat || characterToSession.has(target_character_id)) {
    sendToSession(session, 'arena:challenge_rejected', {
      reason: 'target_in_combat',
      message: 'Target is already in combat.',
    } satisfies ArenaChallengeRejectedPayload);
    return;
  }

  const arenaId = challengerParticipant.arenaId;

  // Level bracket check
  const arena = await getArenaById(arenaId);
  if (!arena) {
    sendToSession(session, 'arena:challenge_rejected', {
      reason: 'not_in_arena',
      message: 'Arena not found.',
    } satisfies ArenaChallengeRejectedPayload);
    return;
  }

  const challengerLevel = challengerParticipant.participant.level;
  const defenderLevel = defenderParticipant.participant.level;
  if (Math.abs(challengerLevel - defenderLevel) > arena.level_bracket) {
    sendToSession(session, 'arena:challenge_rejected', {
      reason: 'level_bracket',
      message: `Level difference too large (max ${arena.level_bracket}).`,
    } satisfies ArenaChallengeRejectedPayload);
    return;
  }

  // Get defender session
  const defenderSession = getSessionByCharacterId(target_character_id);
  if (!defenderSession) {
    sendToSession(session, 'arena:challenge_rejected', {
      reason: 'target_not_found',
      message: 'Target player is offline.',
    } satisfies ArenaChallengeRejectedPayload);
    return;
  }

  // Save pre-fight HP and set both in_combat
  const challengerHp = challengerParticipant.participant.currentHp;
  const defenderHp = defenderParticipant.participant.currentHp;

  await setPreFightHp(challengerId, challengerHp);
  await setPreFightHp(target_character_id, defenderHp);
  await updateParticipantCombatState(challengerId, true, target_character_id);
  await updateParticipantCombatState(target_character_id, true, challengerId);

  setInCombat(challengerId, true, target_character_id);
  setInCombat(target_character_id, true, challengerId);

  // Compute combat stats for both
  const challengerStats = await computeCombatStats(challengerId);
  const defenderStats = await computeCombatStats(target_character_id);

  // Build loadouts for both
  const challengerSlots = await getCharacterLoadout(challengerId);
  const defenderSlots = await getCharacterLoadout(target_character_id);
  const challengerLoadout = buildLoadout(challengerSlots);
  const defenderLoadout = buildLoadout(defenderSlots);

  // Build engine states — each player is "player" in their own state
  const challengerState: EngineState = {
    playerHp: challengerHp,
    playerMana: 0,
    enemyHp: defenderHp,
    activeEffects: [],
    abilityCooldowns: new Map(),
  };

  const defenderState: EngineState = {
    playerHp: defenderHp,
    playerMana: 0,
    enemyHp: challengerHp,
    activeEffects: [],
    abilityCooldowns: new Map(),
  };

  const combatId = crypto.randomUUID();

  // Load fatigue configuration for PvP combat
  const fatigueRow = await getFatigueConfig('pvp');

  const cs: PvpCombatSession = {
    combatId,
    arenaId,
    challengerId,
    defenderId: target_character_id,
    challengerSession: session,
    defenderSession,
    challengerStats,
    defenderStats,
    challengerLoadout,
    defenderLoadout,
    challengerState,
    defenderState,
    turn: 0,
    phase: 'player_turn',
    activeWindowTimer: null,
    challengerActedThisTurn: false,
    defenderActedThisTurn: false,
    fatigueStartRound: fatigueRow?.start_round ?? 0,
    fatigueBaseDamage: fatigueRow?.base_damage ?? 0,
    fatigueDamageIncrement: fatigueRow?.damage_increment ?? 0,
    fatigueActive: false,
    fatigueTurnCount: 0,
    fatigueOnsetDelayModifier: 0,
    fatigueImmunityRoundsLeft: 0,
    fatigueDamageReduction: 0,
  };

  pvpSessions.set(combatId, cs);
  characterToSession.set(challengerId, combatId);
  characterToSession.set(target_character_id, combatId);

  // Send combat start to challenger
  const challengerStartPayload: ArenaCombatStartPayload = {
    combat_id: combatId,
    opponent: {
      character_id: target_character_id,
      name: defenderParticipant.participant.name,
      class_id: defenderParticipant.participant.classId,
      level: defenderLevel,
      max_hp: defenderParticipant.participant.maxHp,
      current_hp: defenderHp,
      attack: defenderStats.attack,
      defence: defenderStats.defence,
      icon_url: '/assets/player_icons/player_1.png',
    },
    player: {
      max_hp: challengerStats.maxHp,
      current_hp: challengerHp,
      max_mana: challengerStats.maxMana,
      current_mana: 0,
      attack: challengerStats.attack,
      defence: challengerStats.defence,
    },
    loadout: { slots: buildAbilityStates(challengerLoadout, challengerState) },
    is_pvp: true,
    turn_timer_ms: TURN_TIMER_MS,
    fatigue_config: fatigueRow && fatigueRow.start_round > 0 ? {
      start_round: fatigueRow.start_round,
      base_damage: fatigueRow.base_damage,
      damage_increment: fatigueRow.damage_increment,
      icon_url: fatigueRow.icon_filename ? `/fatigue-icons/${fatigueRow.icon_filename}` : undefined,
    } : undefined,
  };
  sendToSession(session, 'arena:combat_start', challengerStartPayload);

  // Send combat start to defender
  const defenderStartPayload: ArenaCombatStartPayload = {
    combat_id: combatId,
    opponent: {
      character_id: challengerId,
      name: challengerParticipant.participant.name,
      class_id: challengerParticipant.participant.classId,
      level: challengerLevel,
      max_hp: challengerParticipant.participant.maxHp,
      current_hp: challengerHp,
      attack: challengerStats.attack,
      defence: challengerStats.defence,
      icon_url: '/assets/player_icons/player_1.png',
    },
    player: {
      max_hp: defenderStats.maxHp,
      current_hp: defenderHp,
      max_mana: defenderStats.maxMana,
      current_mana: 0,
      attack: defenderStats.attack,
      defence: defenderStats.defence,
    },
    loadout: { slots: buildAbilityStates(defenderLoadout, defenderState) },
    is_pvp: true,
    turn_timer_ms: TURN_TIMER_MS,
    fatigue_config: fatigueRow && fatigueRow.start_round > 0 ? {
      start_round: fatigueRow.start_round,
      base_damage: fatigueRow.base_damage,
      damage_increment: fatigueRow.damage_increment,
      icon_url: fatigueRow.icon_filename ? `/fatigue-icons/${fatigueRow.icon_filename}` : undefined,
    } : undefined,
  };
  sendToSession(defenderSession, 'arena:combat_start', defenderStartPayload);

  // Broadcast in_combat state to arena
  const challengerUpdate: ArenaParticipantUpdatedPayload = {
    character_id: challengerId,
    in_combat: true,
  };
  const defenderUpdate: ArenaParticipantUpdatedPayload = {
    character_id: target_character_id,
    in_combat: true,
  };
  broadcastToArena(arenaId, 'arena:participant_updated', challengerUpdate);
  broadcastToArena(arenaId, 'arena:participant_updated', defenderUpdate);

  log('info', 'arena', 'pvp_combat_start', {
    combat_id: combatId,
    arena_id: arenaId,
    challenger_id: challengerId,
    defender_id: target_character_id,
  });

  // Execute additional attacks for both players before first turn (no crits)
  executePvpAdditionalAttacks(cs);

  // Start first turn
  startPvpTurn(cs);
}

// ---------------------------------------------------------------------------
// Additional attacks (bonus hits at combat start)
// ---------------------------------------------------------------------------

function executePvpAdditionalAttacks(cs: PvpCombatSession): void {
  const challengerBonusEvents: CombatEventDto[] = [];
  const defenderBonusEvents: CombatEventDto[] = [];

  // Challenger bonus hits against defender
  const cCount = cs.challengerStats.additionalAttacks ?? 0;
  for (let i = 0; i < cCount; i++) {
    if (cs.defenderState.playerHp <= 0) break;
    const noCritStats: DerivedCombatStats = { ...cs.challengerStats, critChance: 0 };
    const result = computePlayerAttack(noCritStats, cs.defenderStats.dodgeChance, cs.defenderStats.defence, {
      ...cs.challengerState,
      enemyHp: cs.defenderState.playerHp,
    });
    cs.challengerState = { ...result.newState, enemyHp: cs.challengerState.enemyHp };
    cs.defenderState = { ...cs.defenderState, playerHp: result.newState.enemyHp };
    challengerBonusEvents.push(...result.events);
  }

  // Defender bonus hits against challenger
  const dCount = cs.defenderStats.additionalAttacks ?? 0;
  for (let i = 0; i < dCount; i++) {
    if (cs.challengerState.playerHp <= 0) break;
    const noCritStats: DerivedCombatStats = { ...cs.defenderStats, critChance: 0 };
    const result = computePlayerAttack(noCritStats, cs.challengerStats.dodgeChance, cs.challengerStats.defence, {
      ...cs.defenderState,
      enemyHp: cs.challengerState.playerHp,
    });
    cs.defenderState = { ...result.newState, enemyHp: cs.defenderState.enemyHp };
    cs.challengerState = { ...cs.challengerState, playerHp: result.newState.enemyHp };
    defenderBonusEvents.push(...result.events);
  }

  if (challengerBonusEvents.length > 0 || defenderBonusEvents.length > 0) {
    sendPvpTurnResult(cs, 'player', challengerBonusEvents, defenderBonusEvents);
  }
}

// ---------------------------------------------------------------------------
// Turn loop
// ---------------------------------------------------------------------------

function startPvpTurn(cs: PvpCombatSession): void {
  if (cs.phase === 'ended') return;

  cs.turn++;
  cs.phase = 'player_turn';
  cs.challengerActedThisTurn = false;
  cs.defenderActedThisTurn = false;

  const challengerEvents: CombatEventDto[] = [];
  const defenderEvents: CombatEventDto[] = [];

  // 1. Mana regen for both
  const challengerMana = applyManaRegen(cs.challengerStats, cs.challengerState);
  cs.challengerState = challengerMana.newState;
  challengerEvents.push(...challengerMana.events);

  const defenderMana = applyManaRegen(cs.defenderStats, cs.defenderState);
  cs.defenderState = defenderMana.newState;
  defenderEvents.push(...defenderMana.events);

  // 2. Challenger attacks defender
  const challengerAttack = computePlayerAttack(
    cs.challengerStats,
    cs.defenderStats.dodgeChance,
    cs.defenderStats.defence,
    cs.challengerState,
  );
  cs.challengerState = challengerAttack.newState;
  challengerEvents.push(...challengerAttack.events);

  // 3. Defender attacks challenger
  const defenderAttack = computePlayerAttack(
    cs.defenderStats,
    cs.challengerStats.dodgeChance,
    cs.challengerStats.defence,
    cs.defenderState,
  );
  cs.defenderState = defenderAttack.newState;
  defenderEvents.push(...defenderAttack.events);

  // 4. SYNC HP between the two states
  syncHp(cs);

  // 5. Auto abilities for challenger
  const challengerAutoSlots = buildAutoSlots(cs.challengerLoadout);
  if (challengerAutoSlots.length > 0) {
    const autoResult = computeAutoAbilities(
      challengerAutoSlots,
      cs.challengerStats,
      cs.defenderStats.defence,
      cs.challengerState,
    );
    cs.challengerState = autoResult.newState;
    challengerEvents.push(...autoResult.events);
  }

  // Auto abilities for defender
  const defenderAutoSlots = buildAutoSlots(cs.defenderLoadout);
  if (defenderAutoSlots.length > 0) {
    const autoResult = computeAutoAbilities(
      defenderAutoSlots,
      cs.defenderStats,
      cs.challengerStats.defence,
      cs.defenderState,
    );
    cs.defenderState = autoResult.newState;
    defenderEvents.push(...autoResult.events);
  }

  // 6. SYNC HP again after auto abilities
  syncHp(cs);

  // 7. Check for death
  const deathResult = checkDeath(cs);
  if (deathResult) {
    sendPvpTurnResult(cs, 'player', challengerEvents, defenderEvents);
    void endPvpCombat(cs, deathResult.winnerId, deathResult.loserId);
    return;
  }

  // 8. Send player turn results to each
  sendPvpTurnResult(cs, 'player', challengerEvents, defenderEvents);

  // 9. Open active window
  cs.phase = 'active_window';
  sendActiveWindows(cs);

  // Auto-close window after timeout
  cs.activeWindowTimer = setTimeout(() => {
    if (cs.phase !== 'active_window') return;
    resolveAndAdvance(cs);
  }, TURN_TIMER_MS);
}

// ---------------------------------------------------------------------------
// Active ability trigger (arena:combat_trigger_active)
// ---------------------------------------------------------------------------

async function handleCombatTriggerActive(
  session: AuthenticatedSession,
  payload: unknown,
): Promise<void> {
  const { combat_id } = payload as { combat_id: string };
  const characterId = session.characterId;
  if (!characterId) return;

  // Check if this is an NPC combat session
  const npcCs = npcSessions.get(characterId);
  if (npcCs && npcCs.combatId === combat_id && npcCs.phase === 'active_window') {
    handleNpcTriggerActive(npcCs);
    return;
  }

  // Otherwise try PvP session
  const cs = pvpSessions.get(combat_id);
  if (!cs || cs.phase !== 'active_window') return;

  const isChallenger = characterId === cs.challengerId;
  const isDefender = characterId === cs.defenderId;
  if (!isChallenger && !isDefender) return;

  // Prevent double-activation
  if (isChallenger && cs.challengerActedThisTurn) return;
  if (isDefender && cs.defenderActedThisTurn) return;

  if (isChallenger && cs.challengerLoadout.active) {
    const result = computeActiveAbility(
      cs.challengerLoadout.active,
      cs.challengerStats,
      cs.defenderStats.defence,
      cs.challengerState,
    );
    cs.challengerState = result.newState;
    syncHp(cs);

    // Check if defender died from active ability
    const deathResult = checkDeath(cs);
    if (deathResult) {
      if (cs.activeWindowTimer) {
        clearTimeout(cs.activeWindowTimer);
        cs.activeWindowTimer = null;
      }
      void endPvpCombat(cs, deathResult.winnerId, deathResult.loserId);
      return;
    }

    cs.challengerActedThisTurn = true;
  }

  if (isDefender && cs.defenderLoadout.active) {
    const result = computeActiveAbility(
      cs.defenderLoadout.active,
      cs.defenderStats,
      cs.challengerStats.defence,
      cs.defenderState,
    );
    cs.defenderState = result.newState;
    syncHp(cs);

    // Check if challenger died from active ability
    const deathResult = checkDeath(cs);
    if (deathResult) {
      if (cs.activeWindowTimer) {
        clearTimeout(cs.activeWindowTimer);
        cs.activeWindowTimer = null;
      }
      void endPvpCombat(cs, deathResult.winnerId, deathResult.loserId);
      return;
    }

    cs.defenderActedThisTurn = true;
  }

  // If both have acted, resolve immediately
  if (cs.challengerActedThisTurn && cs.defenderActedThisTurn) {
    if (cs.activeWindowTimer) {
      clearTimeout(cs.activeWindowTimer);
      cs.activeWindowTimer = null;
    }
    resolveAndAdvance(cs);
  }
}

// ---------------------------------------------------------------------------
// Resolve active effects and advance to next turn
// ---------------------------------------------------------------------------

function resolveAndAdvance(cs: PvpCombatSession): void {
  if (cs.phase === 'ended') return;

  const challengerEvents: CombatEventDto[] = [];
  const defenderEvents: CombatEventDto[] = [];

  // Tick active effects for challenger
  const challengerTick = tickActiveEffects(cs.challengerStats, cs.challengerState);
  cs.challengerState = challengerTick.newState;
  challengerEvents.push(...challengerTick.events);

  // Tick active effects for defender
  const defenderTick = tickActiveEffects(cs.defenderStats, cs.defenderState);
  cs.defenderState = defenderTick.newState;
  defenderEvents.push(...defenderTick.events);

  // SYNC HP after effects
  syncHp(cs);

  // Fatigue damage (true damage bypassing defense)
  if (cs.fatigueStartRound > 0) {
    const effectiveStartRound = cs.fatigueStartRound + cs.fatigueOnsetDelayModifier;
    if (cs.turn >= effectiveStartRound) {
      if (cs.fatigueImmunityRoundsLeft > 0) {
        cs.fatigueImmunityRoundsLeft -= 1;
        // Push to challenger perspective only; remapEventsForOpponent produces defender's view
        challengerEvents.push(
          { kind: 'fatigue_damage', source: 'environment', target: 'player', value: 0 },
          { kind: 'fatigue_damage', source: 'environment', target: 'enemy', value: 0 },
        );
      } else {
        const rawDamage = cs.fatigueBaseDamage + cs.fatigueTurnCount * cs.fatigueDamageIncrement;
        const reductionMultiplier = Math.max(0, 1 - cs.fatigueDamageReduction / 100);
        const fatigueDamage = Math.round(rawDamage * reductionMultiplier);

        // Apply true damage to both players
        cs.challengerState.playerHp = Math.max(0, cs.challengerState.playerHp - fatigueDamage);
        cs.defenderState.playerHp = Math.max(0, cs.defenderState.playerHp - fatigueDamage);
        // Keep enemy HP views in sync
        cs.challengerState.enemyHp = cs.defenderState.playerHp;
        cs.defenderState.enemyHp = cs.challengerState.playerHp;

        // Push to challenger perspective only; remapEventsForOpponent produces defender's view
        challengerEvents.push(
          { kind: 'fatigue_damage', source: 'environment', target: 'player', value: fatigueDamage },
          { kind: 'fatigue_damage', source: 'environment', target: 'enemy', value: fatigueDamage },
        );

        cs.fatigueTurnCount += 1;
      }

      cs.fatigueActive = true;

      log('info', 'arena', 'fatigue_damage_applied', {
        combat_id: cs.combatId,
        arena_id: cs.arenaId,
        challenger_id: cs.challengerId,
        defender_id: cs.defenderId,
        round: cs.turn,
        damage: cs.fatigueImmunityRoundsLeft >= 0 && cs.fatigueTurnCount === 0
          ? 0
          : cs.fatigueBaseDamage + (cs.fatigueTurnCount - 1) * cs.fatigueDamageIncrement,
        challenger_hp: cs.challengerState.playerHp,
        defender_hp: cs.defenderState.playerHp,
      });

      // Simultaneous KO from fatigue: DEFENDER wins
      if (cs.challengerState.playerHp <= 0 && cs.defenderState.playerHp <= 0) {
        cs.challengerState.playerHp = 0;
        cs.defenderState.playerHp = 1;
        cs.challengerState.enemyHp = 1;
        cs.defenderState.enemyHp = 0;
        sendPvpTurnResult(cs, 'enemy', challengerEvents, defenderEvents);
        void endPvpCombat(cs, cs.defenderId, cs.challengerId);
        return;
      }

      if (cs.challengerState.playerHp <= 0) {
        sendPvpTurnResult(cs, 'enemy', challengerEvents, defenderEvents);
        void endPvpCombat(cs, cs.defenderId, cs.challengerId);
        return;
      }

      if (cs.defenderState.playerHp <= 0) {
        sendPvpTurnResult(cs, 'enemy', challengerEvents, defenderEvents);
        void endPvpCombat(cs, cs.challengerId, cs.defenderId);
        return;
      }
    }
  }

  // Tick cooldowns for both
  cs.challengerState = tickAbilityCooldowns(cs.challengerState);
  cs.defenderState = tickAbilityCooldowns(cs.defenderState);

  // Check death
  const deathResult = checkDeath(cs);
  if (deathResult) {
    sendPvpTurnResult(cs, 'enemy', challengerEvents, defenderEvents);
    void endPvpCombat(cs, deathResult.winnerId, deathResult.loserId);
    return;
  }

  // Send enemy phase turn results
  sendPvpTurnResult(cs, 'enemy', challengerEvents, defenderEvents);

  // Schedule next turn
  setTimeout(() => startPvpTurn(cs), ENEMY_TURN_DELAY_MS);
}

// ---------------------------------------------------------------------------
// End PvP combat
// ---------------------------------------------------------------------------

async function endPvpCombat(
  cs: PvpCombatSession,
  winnerId: string,
  loserId: string,
): Promise<void> {
  if (cs.phase === 'ended') return;
  cs.phase = 'ended';

  if (cs.activeWindowTimer) {
    clearTimeout(cs.activeWindowTimer);
    cs.activeWindowTimer = null;
  }

  // Get fresh arena config for reward values (SC-006 compliance)
  const arena = await getArenaById(cs.arenaId);
  const winnerXp = arena?.winner_xp ?? 50;
  const loserXp = arena?.loser_xp ?? 10;
  const winnerCrowns = arena?.winner_crowns ?? 25;
  const loserCrowns = arena?.loser_crowns ?? 0;

  const isWinnerChallenger = winnerId === cs.challengerId;
  const winnerState = isWinnerChallenger ? cs.challengerState : cs.defenderState;
  const loserState = isWinnerChallenger ? cs.defenderState : cs.challengerState;
  const winnerSession = isWinnerChallenger ? cs.challengerSession : cs.defenderSession;
  const loserSession = isWinnerChallenger ? cs.defenderSession : cs.challengerSession;
  const winnerName = isWinnerChallenger
    ? getParticipant(cs.challengerId)?.participant.name ?? 'Unknown'
    : getParticipant(cs.defenderId)?.participant.name ?? 'Unknown';
  const loserName = isWinnerChallenger
    ? getParticipant(cs.defenderId)?.participant.name ?? 'Unknown'
    : getParticipant(cs.challengerId)?.participant.name ?? 'Unknown';

  // Award winner
  const winnerXpResult = winnerXp > 0 ? await awardXp(winnerId, winnerXp) : null;
  if (winnerCrowns > 0) await awardCrowns(winnerId, winnerCrowns);

  // Award loser (consolation)
  const loserXpResult = loserXp > 0 ? await awardXp(loserId, loserXp) : null;
  if (loserCrowns > 0) await awardCrowns(loserId, loserCrowns);

  // Increment winner's combat_wins + arena_pvp_wins
  await query('UPDATE characters SET combat_wins = combat_wins + 1, arena_pvp_wins = arena_pvp_wins + 1 WHERE id = $1', [winnerId]);

  // Increment winner's current streak in arena_participants + update in-memory state
  await query('UPDATE arena_participants SET current_streak = current_streak + 1 WHERE character_id = $1', [winnerId]);
  const winnerParticipant = getParticipant(winnerId);
  if (winnerParticipant) {
    winnerParticipant.participant.currentStreak++;
    winnerParticipant.participant.arenaPvpWins++;
  }

  // Send combat end to winner
  const winnerEndPayload: ArenaCombatEndPayload = {
    combat_id: cs.combatId,
    outcome: 'victory',
    current_hp: Math.max(0, winnerState.playerHp),
    xp_gained: winnerXp,
    crowns_gained: winnerCrowns,
    opponent_name: loserName,
    is_pvp: true,
  };
  sendToSession(winnerSession, 'arena:combat_end', winnerEndPayload);

  // Send combat end to loser
  const loserEndPayload: ArenaCombatEndPayload = {
    combat_id: cs.combatId,
    outcome: 'defeat',
    current_hp: 0,
    xp_gained: loserXp,
    crowns_gained: loserCrowns,
    opponent_name: winnerName,
    is_pvp: true,
  };
  sendToSession(loserSession, 'arena:combat_end', loserEndPayload);

  // Update winner's arena HP in DB and state manager
  const winnerHp = Math.max(1, winnerState.playerHp); // winner stays with at least 1 HP
  await updateParticipantHp(winnerId, winnerHp);
  await updateParticipantCombatState(winnerId, false, null);
  await clearPreFightHp(winnerId);
  updateHp(winnerId, winnerHp);
  setInCombat(winnerId, false);

  // Sync characters.current_hp to arena HP (prevents stale HP in stats panel).
  // Also overrides level-up full-heal if one occurred.
  await query('UPDATE characters SET current_hp = $1 WHERE id = $2', [winnerHp, winnerId]);
  const winnerMaxHp = getParticipant(winnerId)?.participant.maxHp ?? winnerHp;
  sendToSession(winnerSession, 'character.hp_changed', {
    current_hp: winnerHp,
    max_hp: winnerMaxHp,
  });

  // Level-up no longer changes max_hp (stat allocation system) — no arena state update needed

  // Broadcast winner's updated state (include refreshed stats)
  const winnerP = getParticipant(winnerId);
  const winnerUpdate: ArenaParticipantUpdatedPayload = {
    character_id: winnerId,
    in_combat: false,
    current_streak: winnerP?.participant.currentStreak ?? 0,
    arena_pvp_wins: winnerP?.participant.arenaPvpWins ?? 0,
  };
  broadcastToArena(cs.arenaId, 'arena:participant_updated', winnerUpdate);

  // Sync loser's final HP to state manager before kicking (so kickFromArena writes correct HP to character)
  const loserFinalHp = Math.max(0, loserState.playerHp);
  await updateParticipantHp(loserId, loserFinalHp);
  updateHp(loserId, loserFinalHp);

  // Kick loser from arena
  await kickFromArena(loserId, 'defeat', true);

  // Clean up session maps
  pvpSessions.delete(cs.combatId);
  characterToSession.delete(cs.challengerId);
  characterToSession.delete(cs.defenderId);

  log('info', 'arena', 'pvp_combat_end', {
    combat_id: cs.combatId,
    arena_id: cs.arenaId,
    winner_id: winnerId,
    loser_id: loserId,
    winner_xp: winnerXp,
    winner_crowns: winnerCrowns,
  });
}

// ---------------------------------------------------------------------------
// Disconnection handling
// ---------------------------------------------------------------------------

export async function handleArenaDisconnect(characterId: string): Promise<void> {
  const combatId = characterToSession.get(characterId);
  if (!combatId) return;

  const cs = pvpSessions.get(combatId);
  if (!cs || cs.phase === 'ended') return;

  const isChallenger = characterId === cs.challengerId;
  const opponentId = isChallenger ? cs.defenderId : cs.challengerId;

  // Check if opponent is also disconnected
  const opponentSession = getSessionByCharacterId(opponentId);
  const opponentDisconnected = !opponentSession || opponentSession.socket.readyState !== 1;

  if (opponentDisconnected) {
    // Both disconnected — cancel the fight
    log('info', 'arena', 'pvp_both_disconnected', {
      combat_id: cs.combatId,
      challenger_id: cs.challengerId,
      defender_id: cs.defenderId,
    });

    cs.phase = 'ended';
    if (cs.activeWindowTimer) {
      clearTimeout(cs.activeWindowTimer);
      cs.activeWindowTimer = null;
    }

    // Restore pre_fight_hp for both and remove from arena with cooldowns
    for (const id of [cs.challengerId, cs.defenderId]) {
      await updateParticipantCombatState(id, false, null);
      await clearPreFightHp(id);
      setInCombat(id, false);

      // Kick both from arena with cooldown, no rewards
      await kickFromArena(id, 'defeat', true);
    }

    // Clean up session maps
    pvpSessions.delete(cs.combatId);
    characterToSession.delete(cs.challengerId);
    characterToSession.delete(cs.defenderId);
  } else {
    // Only one disconnected — treat as forfeit, opponent wins
    log('info', 'arena', 'pvp_disconnect_forfeit', {
      combat_id: cs.combatId,
      disconnected_id: characterId,
      winner_id: opponentId,
    });

    await endPvpCombat(cs, opponentId, characterId);
  }
}

// ---------------------------------------------------------------------------
// HP sync — keeps the two EngineStates consistent
// ---------------------------------------------------------------------------

function syncHp(cs: PvpCombatSession): void {
  // Defender's HP as computed by challenger's attacks
  cs.defenderState.playerHp = cs.challengerState.enemyHp;
  // Challenger's HP as computed by defender's attacks
  cs.challengerState.playerHp = cs.defenderState.enemyHp;
}

// ---------------------------------------------------------------------------
// Death check — returns winner/loser IDs or null if no death
// ---------------------------------------------------------------------------

function checkDeath(
  cs: PvpCombatSession,
): { winnerId: string; loserId: string } | null {
  const challengerDead = cs.challengerState.playerHp <= 0;
  const defenderDead = cs.defenderState.playerHp <= 0;

  if (challengerDead && defenderDead) {
    // Tie-break: challenger wins
    return { winnerId: cs.challengerId, loserId: cs.defenderId };
  }
  if (defenderDead) {
    return { winnerId: cs.challengerId, loserId: cs.defenderId };
  }
  if (challengerDead) {
    return { winnerId: cs.defenderId, loserId: cs.challengerId };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Send turn results from each player's perspective
// ---------------------------------------------------------------------------

function sendPvpTurnResult(
  cs: PvpCombatSession,
  phase: 'player' | 'enemy',
  challengerEvents: CombatEventDto[],
  defenderEvents: CombatEventDto[],
): void {
  // Challenger sees: their events as source:'player', defender's events as source:'enemy'
  // The combat engine already produces events with source:'player' from each player's perspective.
  // Challenger needs to see their own events + defender's events remapped.
  const challengerCombined = [
    ...challengerEvents,
    ...remapEventsForOpponent(defenderEvents),
  ];

  const defenderCombined = [
    ...defenderEvents,
    ...remapEventsForOpponent(challengerEvents),
  ];

  const fatigueState = buildFatigueState(cs);

  const challengerPayload: ArenaCombatTurnResultPayload = {
    combat_id: cs.combatId,
    turn: cs.turn,
    phase,
    events: challengerCombined,
    player_hp: cs.challengerState.playerHp,
    player_mana: cs.challengerState.playerMana,
    opponent_hp: cs.challengerState.enemyHp,
    ability_states: buildAbilityStates(cs.challengerLoadout, cs.challengerState),
    active_effects: serializeActiveEffects(cs.challengerLoadout, cs.challengerState),
    fatigue_state: fatigueState,
  };
  sendToSession(cs.challengerSession, 'arena:combat_turn_result', challengerPayload);

  const defenderPayload: ArenaCombatTurnResultPayload = {
    combat_id: cs.combatId,
    turn: cs.turn,
    phase,
    events: defenderCombined,
    player_hp: cs.defenderState.playerHp,
    player_mana: cs.defenderState.playerMana,
    opponent_hp: cs.defenderState.enemyHp,
    ability_states: buildAbilityStates(cs.defenderLoadout, cs.defenderState),
    active_effects: serializeActiveEffects(cs.defenderLoadout, cs.defenderState),
    fatigue_state: fatigueState,
  };
  sendToSession(cs.defenderSession, 'arena:combat_turn_result', defenderPayload);
}

// ---------------------------------------------------------------------------
// Remap events from one player's perspective to the opponent's perspective
// ---------------------------------------------------------------------------

function remapEventsForOpponent(events: CombatEventDto[]): CombatEventDto[] {
  return events.map((e) => ({
    ...e,
    source: flipSource(e.source),
    target: flipTarget(e.target),
  }));
}

function flipSource(side: 'player' | 'enemy' | 'environment'): 'player' | 'enemy' | 'environment' {
  if (side === 'environment') return 'environment';
  return side === 'player' ? 'enemy' : 'player';
}

function flipTarget(side: 'player' | 'enemy'): 'player' | 'enemy' {
  return side === 'player' ? 'enemy' : 'player';
}

// ---------------------------------------------------------------------------
// Fatigue state builder (shared by PvP and NPC sessions)
// ---------------------------------------------------------------------------

function buildFatigueState(cs: PvpCombatSession | ArenaNpcCombatSession): FatigueStateDto | undefined {
  if (cs.fatigueStartRound <= 0) return undefined;
  return {
    current_round: cs.turn,
    fatigue_active: cs.fatigueActive,
    current_damage: cs.fatigueActive
      ? (cs.fatigueBaseDamage + Math.max(0, cs.fatigueTurnCount - 1) * cs.fatigueDamageIncrement)
      : 0,
    immunity_rounds_left: cs.fatigueImmunityRoundsLeft,
    effective_start_round: cs.fatigueStartRound + cs.fatigueOnsetDelayModifier,
  };
}

// ---------------------------------------------------------------------------
// Send active windows to both players
// ---------------------------------------------------------------------------

function sendActiveWindows(cs: PvpCombatSession): void {
  const challengerAbility = cs.challengerLoadout.active;
  const challengerCanUse = challengerAbility &&
    cs.challengerState.playerMana >= challengerAbility.manaCost &&
    (cs.challengerState.abilityCooldowns.get(challengerAbility.abilityId) ?? 0) === 0;

  const challengerWindow: ArenaCombatActiveWindowPayload = {
    combat_id: cs.combatId,
    timer_ms: TURN_TIMER_MS,
    ability: challengerCanUse
      ? buildSingleAbilityState(challengerAbility!, cs.challengerState)
      : null,
  };
  sendToSession(cs.challengerSession, 'arena:combat_active_window', challengerWindow);

  const defenderAbility = cs.defenderLoadout.active;
  const defenderCanUse = defenderAbility &&
    cs.defenderState.playerMana >= defenderAbility.manaCost &&
    (cs.defenderState.abilityCooldowns.get(defenderAbility.abilityId) ?? 0) === 0;

  const defenderWindow: ArenaCombatActiveWindowPayload = {
    combat_id: cs.combatId,
    timer_ms: TURN_TIMER_MS,
    ability: defenderCanUse
      ? buildSingleAbilityState(defenderAbility!, cs.defenderState)
      : null,
  };
  sendToSession(cs.defenderSession, 'arena:combat_active_window', defenderWindow);
}

// ---------------------------------------------------------------------------
// Loadout helpers (mirrors boss-combat-handler)
// ---------------------------------------------------------------------------

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

function buildAbilityStates(loadout: CombatLoadout, state: EngineState): CombatAbilityStateDto[] {
  const states: CombatAbilityStateDto[] = [];
  for (const slotName of ['auto_1', 'auto_2', 'auto_3', 'active'] as const) {
    const slot = loadout[slotName];
    if (!slot) continue;
    const cooldown = state.abilityCooldowns.get(slot.abilityId) ?? 0;
    let status: 'ready' | 'cooldown' | 'insufficient_mana' = 'ready';
    if (cooldown > 0) status = 'cooldown';
    else if (state.playerMana < slot.manaCost) status = 'insufficient_mana';
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

function serializeActiveEffects(
  loadout: CombatLoadout,
  state: EngineState,
): ActiveEffectDto[] {
  const iconMap = new Map<string, string | null>();
  for (const slot of [loadout.auto_1, loadout.auto_2, loadout.auto_3, loadout.active]) {
    if (slot) iconMap.set(slot.name, slot.iconUrl);
  }

  return state.activeEffects.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    effect_type: e.effectType,
    stat: e.stat,
    value: e.value,
    turns_remaining: e.turnsRemaining,
    ability_name: e.abilityName,
    icon_url: iconMap.get(e.abilityName) ?? null,
  }));
}

// ---------------------------------------------------------------------------
// NPC Challenge handler (arena:challenge_npc)
// ---------------------------------------------------------------------------

async function handleChallengeNpc(
  session: AuthenticatedSession,
  payload: unknown,
): Promise<void> {
  const { monster_id } = payload as { monster_id: number };
  const characterId = session.characterId;

  if (!characterId) {
    sendToSession(session, 'arena:challenge_rejected', {
      reason: 'not_in_arena',
      message: 'Character required.',
    } satisfies ArenaChallengeRejectedPayload);
    return;
  }

  // Validate challenger is in an arena and not in combat
  const participantInfo = getParticipant(characterId);
  if (!participantInfo) {
    sendToSession(session, 'arena:challenge_rejected', {
      reason: 'not_in_arena',
      message: 'You are not in an arena.',
    } satisfies ArenaChallengeRejectedPayload);
    return;
  }

  if (participantInfo.participant.inCombat || characterToSession.has(characterId) || npcSessions.has(characterId)) {
    sendToSession(session, 'arena:challenge_rejected', {
      reason: 'self_in_combat',
      message: 'You are already in combat.',
    } satisfies ArenaChallengeRejectedPayload);
    return;
  }

  const arenaId = participantInfo.arenaId;

  // Validate monster is assigned to this arena
  const arenaMonster = await getArenaMonsterEntry(arenaId, monster_id);
  if (!arenaMonster) {
    sendToSession(session, 'arena:challenge_rejected', {
      reason: 'target_not_found',
      message: 'Fighter not found in this arena.',
    } satisfies ArenaChallengeRejectedPayload);
    return;
  }

  // Get full monster data
  const monster = await getMonsterById(monster_id);
  if (!monster) {
    sendToSession(session, 'arena:challenge_rejected', {
      reason: 'target_not_found',
      message: 'Fighter data not found.',
    } satisfies ArenaChallengeRejectedPayload);
    return;
  }

  // Token consumption (follows boss-combat-handler pattern)
  const inventory = await getInventoryWithDefinitions(characterId);
  const tokenSlot = inventory.find((s) => s.def_name === ARENA_CHALLENGE_TOKEN_NAME && s.quantity >= 1);
  if (!tokenSlot) {
    sendToSession(session, 'arena:challenge_rejected', {
      reason: 'no_token',
      message: 'You need an Arena Challenge Token to challenge a fighter.',
    } satisfies ArenaChallengeRejectedPayload);
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

  log('info', 'arena', 'npc_token_consumed', {
    arena_id: arenaId,
    character_id: characterId,
    monster_id: monster_id,
  });

  // Save pre-fight HP and set in_combat
  const preFightHp = participantInfo.participant.currentHp;
  await setPreFightHp(characterId, preFightHp);
  await updateParticipantCombatState(characterId, true, null);
  setInCombat(characterId, true);

  // Broadcast in_combat state to arena
  const participantUpdate: ArenaParticipantUpdatedPayload = {
    character_id: characterId,
    in_combat: true,
  };
  broadcastToArena(arenaId, 'arena:participant_updated', participantUpdate);

  // Compute combat stats and loadout
  const stats = await computeCombatStats(characterId);
  const loadoutSlots = await getCharacterLoadout(characterId);
  const loadout = buildLoadout(loadoutSlots);

  // Build engine state — player starts with arena HP, not character max HP
  const engineState: EngineState = {
    playerHp: preFightHp,
    playerMana: 0,
    enemyHp: monster.hp,
    activeEffects: [],
    abilityCooldowns: new Map(),
  };

  const combatId = crypto.randomUUID();

  // Load fatigue configuration for arena NPC combat (uses 'pvp' config)
  const npcFatigueRow = await getFatigueConfig('pvp');

  const cs: ArenaNpcCombatSession = {
    combatId,
    arenaId,
    session,
    characterId,
    monsterId: monster.id,
    monsterName: monster.name,
    monsterIconFilename: monster.icon_filename,
    monsterAttack: monster.attack,
    monsterDefense: monster.defense,
    monsterMaxHp: monster.hp,
    monsterXpReward: monster.xp_reward,
    playerStats: stats,
    loadout,
    engineState,
    turn: 0,
    phase: 'player_turn',
    activeWindowTimer: null,
    enemyTurnDelayRef: null,
    fatigueStartRound: npcFatigueRow?.start_round ?? 0,
    fatigueBaseDamage: npcFatigueRow?.base_damage ?? 0,
    fatigueDamageIncrement: npcFatigueRow?.damage_increment ?? 0,
    fatigueActive: false,
    fatigueTurnCount: 0,
    fatigueOnsetDelayModifier: 0,
    fatigueImmunityRoundsLeft: 0,
    fatigueDamageReduction: 0,
  };

  npcSessions.set(characterId, cs);

  // Send combat start — reuse arena combat payload with is_pvp: false
  const monsterIconUrl = monster.icon_filename
    ? `${config.adminBaseUrl}/monster-icons/${monster.icon_filename}`
    : null;

  const startPayload: ArenaCombatStartPayload = {
    combat_id: combatId,
    opponent: {
      character_id: `npc_${monster.id}`,
      name: monster.name,
      class_id: 0,
      level: 0,
      max_hp: monster.hp,
      current_hp: monster.hp,
      attack: monster.attack,
      defence: monster.defense,
      icon_url: monsterIconUrl,
    },
    player: {
      max_hp: stats.maxHp,
      current_hp: preFightHp,
      max_mana: stats.maxMana,
      current_mana: 0,
      attack: stats.attack,
      defence: stats.defence,
    },
    loadout: { slots: buildAbilityStates(loadout, engineState) },
    is_pvp: false,
    turn_timer_ms: TURN_TIMER_MS,
    fatigue_config: npcFatigueRow && npcFatigueRow.start_round > 0 ? {
      start_round: npcFatigueRow.start_round,
      base_damage: npcFatigueRow.base_damage,
      damage_increment: npcFatigueRow.damage_increment,
      icon_url: npcFatigueRow.icon_filename ? `/fatigue-icons/${npcFatigueRow.icon_filename}` : undefined,
    } : undefined,
  };
  sendToSession(session, 'arena:combat_start', startPayload);

  log('info', 'arena', 'npc_combat_start', {
    combat_id: combatId,
    arena_id: arenaId,
    character_id: characterId,
    monster_id: monster.id,
    monster_name: monster.name,
  });

  // Execute additional attacks before first turn
  executeNpcAdditionalAttacks(cs);

  // Start first turn
  startNpcTurn(cs);
}

function executeNpcAdditionalAttacks(cs: ArenaNpcCombatSession): void {
  const count = cs.playerStats.additionalAttacks ?? 0;
  if (count <= 0) return;

  const bonusEvents: CombatEventDto[] = [];
  for (let i = 0; i < count; i++) {
    if (cs.engineState.enemyHp <= 0) break;
    const noCritStats: DerivedCombatStats = { ...cs.playerStats, critChance: 0 };
    const result = computePlayerAttack(noCritStats, 0, cs.monsterDefense, cs.engineState);
    cs.engineState = result.newState;
    bonusEvents.push(...result.events);
  }

  if (bonusEvents.length > 0) {
    sendNpcTurnResult(cs, 'player', bonusEvents);
  }
}

// ---------------------------------------------------------------------------
// NPC combat turn loop
// ---------------------------------------------------------------------------

function startNpcTurn(cs: ArenaNpcCombatSession): void {
  if (cs.phase === 'ended') return;

  cs.turn++;
  cs.phase = 'player_turn';

  // 1. Mana regen
  const manaResult = applyManaRegen(cs.playerStats, cs.engineState);
  cs.engineState = manaResult.newState;
  const turnEvents: CombatEventDto[] = [...manaResult.events];

  // 2. Player auto-attack
  const attackResult = computePlayerAttack(cs.playerStats, 0, cs.monsterDefense, cs.engineState);
  cs.engineState = attackResult.newState;
  turnEvents.push(...attackResult.events);

  if (cs.engineState.enemyHp <= 0) {
    sendNpcTurnResult(cs, 'player', turnEvents);
    void endNpcCombat(cs, 'win');
    return;
  }

  // 3. Auto abilities
  const autoSlots = buildAutoSlots(cs.loadout);
  if (autoSlots.length > 0) {
    const autoResult = computeAutoAbilities(autoSlots, cs.playerStats, cs.monsterDefense, cs.engineState);
    cs.engineState = autoResult.newState;
    turnEvents.push(...autoResult.events);

    if (cs.engineState.enemyHp <= 0) {
      sendNpcTurnResult(cs, 'player', turnEvents);
      void endNpcCombat(cs, 'win');
      return;
    }
  }

  // Send player turn result
  sendNpcTurnResult(cs, 'player', turnEvents);

  // 4. Open active window
  cs.phase = 'active_window';
  const activeAbility = cs.loadout.active;
  const canUseActive = activeAbility &&
    cs.engineState.playerMana >= activeAbility.manaCost &&
    (cs.engineState.abilityCooldowns.get(activeAbility.abilityId) ?? 0) === 0;

  const windowPayload: ArenaCombatActiveWindowPayload = {
    combat_id: cs.combatId,
    timer_ms: TURN_TIMER_MS,
    ability: canUseActive ? buildSingleAbilityState(activeAbility!, cs.engineState) : null,
  };
  sendToSession(cs.session, 'arena:combat_active_window', windowPayload);

  // Auto-close window after timeout
  cs.activeWindowTimer = setTimeout(async () => {
    if (cs.phase !== 'active_window') return;
    cs.phase = 'enemy_turn';
    await runNpcEnemyTurn(cs);
  }, TURN_TIMER_MS);
}

// ---------------------------------------------------------------------------
// NPC active ability trigger (reuses arena:combat_trigger_active)
// ---------------------------------------------------------------------------

function handleNpcTriggerActive(cs: ArenaNpcCombatSession): void {
  if (cs.phase !== 'active_window') return;

  if (cs.activeWindowTimer) {
    clearTimeout(cs.activeWindowTimer);
    cs.activeWindowTimer = null;
  }

  // Fire active ability
  if (cs.loadout.active) {
    const result = computeActiveAbility(
      cs.loadout.active,
      cs.playerStats,
      cs.monsterDefense,
      cs.engineState,
    );
    cs.engineState = result.newState;

    if (cs.engineState.enemyHp <= 0) {
      void endNpcCombat(cs, 'win');
      return;
    }
  }

  // Proceed to enemy turn
  cs.phase = 'enemy_turn';
  void runNpcEnemyTurn(cs);
}

// ---------------------------------------------------------------------------
// NPC enemy turn
// ---------------------------------------------------------------------------

async function runNpcEnemyTurn(cs: ArenaNpcCombatSession): Promise<void> {
  const enemyEvents: CombatEventDto[] = [];

  // Tick effects (DoT etc.)
  const tickResult = tickActiveEffects(cs.playerStats, cs.engineState);
  cs.engineState = tickResult.newState;
  enemyEvents.push(...tickResult.events);

  // Tick cooldowns
  cs.engineState = tickAbilityCooldowns(cs.engineState);

  // Fatigue damage (true damage bypassing defense)
  if (cs.fatigueStartRound > 0) {
    const effectiveStartRound = cs.fatigueStartRound + cs.fatigueOnsetDelayModifier;
    if (cs.turn >= effectiveStartRound) {
      if (cs.fatigueImmunityRoundsLeft > 0) {
        cs.fatigueImmunityRoundsLeft -= 1;
        enemyEvents.push(
          { kind: 'fatigue_damage', source: 'environment', target: 'player', value: 0 },
          { kind: 'fatigue_damage', source: 'environment', target: 'enemy', value: 0 },
        );
      } else {
        const rawDamage = cs.fatigueBaseDamage + cs.fatigueTurnCount * cs.fatigueDamageIncrement;
        const reductionMultiplier = Math.max(0, 1 - cs.fatigueDamageReduction / 100);
        const fatigueDamage = Math.round(rawDamage * reductionMultiplier);

        cs.engineState.playerHp = Math.max(0, cs.engineState.playerHp - fatigueDamage);
        cs.engineState.enemyHp = Math.max(0, cs.engineState.enemyHp - fatigueDamage);

        enemyEvents.push(
          { kind: 'fatigue_damage', source: 'environment', target: 'player', value: fatigueDamage },
          { kind: 'fatigue_damage', source: 'environment', target: 'enemy', value: fatigueDamage },
        );

        cs.fatigueTurnCount += 1;
      }

      cs.fatigueActive = true;

      log('info', 'arena', 'fatigue_damage_applied', {
        combat_id: cs.combatId,
        arena_id: cs.arenaId,
        character_id: cs.characterId,
        monster_id: cs.monsterId,
        round: cs.turn,
        damage: cs.fatigueImmunityRoundsLeft >= 0 && cs.fatigueTurnCount === 0
          ? 0
          : cs.fatigueBaseDamage + (cs.fatigueTurnCount - 1) * cs.fatigueDamageIncrement,
        player_hp: cs.engineState.playerHp,
        enemy_hp: cs.engineState.enemyHp,
      });

      // Simultaneous KO from fatigue: player wins (same as monster combat)
      if (cs.engineState.playerHp <= 0 && cs.engineState.enemyHp <= 0) {
        cs.engineState.enemyHp = 0;
        cs.engineState.playerHp = 1;
        sendNpcTurnResult(cs, 'enemy', enemyEvents);
        await endNpcCombat(cs, 'win');
        return;
      }

      if (cs.engineState.enemyHp <= 0) {
        sendNpcTurnResult(cs, 'enemy', enemyEvents);
        await endNpcCombat(cs, 'win');
        return;
      }

      if (cs.engineState.playerHp <= 0) {
        sendNpcTurnResult(cs, 'enemy', enemyEvents);
        await endNpcCombat(cs, 'loss');
        return;
      }
    }
  }

  if (cs.engineState.enemyHp <= 0) {
    sendNpcTurnResult(cs, 'enemy', enemyEvents);
    await endNpcCombat(cs, 'win');
    return;
  }

  // Monster basic attack
  const enemyTurnResult = computeEnemyTurn(cs.monsterAttack, cs.playerStats, cs.engineState);
  cs.engineState = enemyTurnResult.newState;
  enemyEvents.push(...enemyTurnResult.events);

  // Send enemy turn result
  sendNpcTurnResult(cs, 'enemy', enemyEvents);

  // Check outcomes
  if (cs.engineState.playerHp <= 0) {
    await endNpcCombat(cs, 'loss');
    return;
  }
  if (cs.engineState.enemyHp <= 0) {
    await endNpcCombat(cs, 'win');
    return;
  }

  // Next turn after delay
  cs.enemyTurnDelayRef = setTimeout(() => {
    cs.enemyTurnDelayRef = null;
    startNpcTurn(cs);
  }, ENEMY_TURN_DELAY_MS);
}

// ---------------------------------------------------------------------------
// End NPC combat
// ---------------------------------------------------------------------------

async function endNpcCombat(cs: ArenaNpcCombatSession, outcome: 'win' | 'loss'): Promise<void> {
  if (cs.phase === 'ended') return;
  cs.phase = 'ended';

  if (cs.activeWindowTimer) {
    clearTimeout(cs.activeWindowTimer);
    cs.activeWindowTimer = null;
  }
  if (cs.enemyTurnDelayRef) {
    clearTimeout(cs.enemyTurnDelayRef);
    cs.enemyTurnDelayRef = null;
  }

  npcSessions.delete(cs.characterId);

  if (outcome === 'win') {
    // Update arena participant HP with post-combat HP
    const postCombatHp = Math.max(1, cs.engineState.playerHp);
    await updateParticipantHp(cs.characterId, postCombatHp);
    await updateParticipantCombatState(cs.characterId, false, null);
    await clearPreFightHp(cs.characterId);
    updateHp(cs.characterId, postCombatHp);
    setInCombat(cs.characterId, false);

    // Award XP (standard monster XP, no loot, no crowns for arena NPC)
    const xpGained = cs.monsterXpReward;
    if (xpGained > 0) {
      await awardXp(cs.characterId, xpGained);
    }

    // Increment combat wins
    await query('UPDATE characters SET combat_wins = combat_wins + 1 WHERE id = $1', [cs.characterId]);

    // Send combat end
    const endPayload: ArenaCombatEndPayload = {
      combat_id: cs.combatId,
      outcome: 'victory',
      current_hp: postCombatHp,
      xp_gained: xpGained,
      crowns_gained: 0,
      opponent_name: cs.monsterName,
      is_pvp: false,
    };
    sendToSession(cs.session, 'arena:combat_end', endPayload);

    // Broadcast updated state
    const participantUpdate: ArenaParticipantUpdatedPayload = {
      character_id: cs.characterId,
      in_combat: false,
    };
    broadcastToArena(cs.arenaId, 'arena:participant_updated', participantUpdate);

    log('info', 'arena', 'npc_combat_win', {
      combat_id: cs.combatId,
      arena_id: cs.arenaId,
      character_id: cs.characterId,
      monster_id: cs.monsterId,
      xp: xpGained,
      post_hp: postCombatHp,
    });
  } else {
    // Loss — kick from arena
    const endPayload: ArenaCombatEndPayload = {
      combat_id: cs.combatId,
      outcome: 'defeat',
      current_hp: 0,
      xp_gained: 0,
      crowns_gained: 0,
      opponent_name: cs.monsterName,
      is_pvp: false,
    };
    sendToSession(cs.session, 'arena:combat_end', endPayload);

    // Sync final HP to state manager before kicking
    const loserHp = Math.max(0, cs.engineState.playerHp);
    await updateParticipantHp(cs.characterId, loserHp);
    updateHp(cs.characterId, loserHp);

    await kickFromArena(cs.characterId, 'defeat', true);

    log('info', 'arena', 'npc_combat_loss', {
      combat_id: cs.combatId,
      arena_id: cs.arenaId,
      character_id: cs.characterId,
      monster_id: cs.monsterId,
    });
  }

  // Push updated inventory state (token was consumed at start)
  await sendInventoryState(cs.session);
}

// ---------------------------------------------------------------------------
// NPC combat turn result helper
// ---------------------------------------------------------------------------

function sendNpcTurnResult(cs: ArenaNpcCombatSession, phase: 'player' | 'enemy', events: CombatEventDto[]): void {
  const payload: ArenaCombatTurnResultPayload = {
    combat_id: cs.combatId,
    turn: cs.turn,
    phase,
    events,
    player_hp: cs.engineState.playerHp,
    player_mana: cs.engineState.playerMana,
    opponent_hp: cs.engineState.enemyHp,
    ability_states: buildAbilityStates(cs.loadout, cs.engineState),
    active_effects: serializeActiveEffects(cs.loadout, cs.engineState),
    fatigue_state: buildFatigueState(cs),
  };
  sendToSession(cs.session, 'arena:combat_turn_result', payload);
}

// ---------------------------------------------------------------------------
// NPC combat disconnect handler
// ---------------------------------------------------------------------------

export async function handleArenaNpcDisconnect(characterId: string): Promise<void> {
  const cs = npcSessions.get(characterId);
  if (!cs || cs.phase === 'ended') return;
  await endNpcCombat(cs, 'loss');
}

// ---------------------------------------------------------------------------
// Handler registration
// ---------------------------------------------------------------------------

export function registerArenaCombatHandlers(): void {
  registerHandler('arena:challenge_player', handleChallengePlayer);
  registerHandler('arena:challenge_npc', handleChallengeNpc);
  registerHandler('arena:combat_trigger_active', handleCombatTriggerActive);
  log('info', 'arena', 'combat_handlers_registered', {});
}

// ---------------------------------------------------------------------------
// Public accessors (for disconnect handler integration)
// ---------------------------------------------------------------------------

export function isInPvpCombat(characterId: string): boolean {
  return characterToSession.has(characterId);
}

export function isInNpcCombat(characterId: string): boolean {
  return npcSessions.has(characterId);
}
