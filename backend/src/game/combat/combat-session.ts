/**
 * combat-session.ts
 *
 * CombatSession orchestrates the real-time turn loop for a single fight.
 * Each instance manages one character ↔ monster encounter.
 * Sends WebSocket events as turns resolve; never batches combat outcomes.
 */

import crypto from 'crypto';
import { log } from '../../logger';
import { config } from '../../config';
import { sendToSession } from '../../websocket/server';
import { awardXp } from '../progression/xp-service';
import { grantItemToCharacter } from '../inventory/inventory-grant-service';
import { awardCrowns, rollCrownDrop } from '../currency/crown-service';
import { getLootByMonsterId } from '../../db/queries/monster-loot';
import { getAbilityLootByMonsterId } from '../../db/queries/abilities';
import { grantAbilityToCharacter, setCharacterInCombat } from '../../db/queries/loadouts';
import {
  computePlayerAttack,
  computeAutoAbilities,
  computeActiveAbility,
  computeEnemyTurn,
  tickActiveEffects,
  tickAbilityCooldowns,
  applyManaRegen,
} from './combat-engine';
import type { DerivedCombatStats, LoadoutSlotSnapshot, ActiveEffect, EngineState, AutoSlotConfig } from './combat-engine';
import type { AuthenticatedSession } from '../../websocket/server';
import type { Character } from '../../db/queries/characters';
import type { Monster } from '../../db/queries/monsters';
import type {
  CombatAbilityStateDto,
  CombatStartPayload,
  CombatTurnResultPayload,
  CombatActiveWindowPayload,
  CombatEndPayload,
  LoadoutSlotDto,
  ItemDroppedDto,
  AbilityDroppedDto,
} from '../../../../shared/protocol/index';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TURN_TIMER_MS      = 3_000;
const ENEMY_TURN_DELAY_MS = 2_000; // pause after enemy attacks before next player turn

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface CombatLoadout {
  auto_1: (LoadoutSlotSnapshot & { iconUrl: string | null }) | null;
  auto_2: (LoadoutSlotSnapshot & { iconUrl: string | null }) | null;
  auto_3: (LoadoutSlotSnapshot & { iconUrl: string | null }) | null;
  active:  (LoadoutSlotSnapshot & { iconUrl: string | null }) | null;
}

// ---------------------------------------------------------------------------
// CombatSession
// ---------------------------------------------------------------------------

export class CombatSession {
  private readonly combatId: string;
  private readonly characterId: string;
  private readonly monster: Monster;

  private readonly playerMaxHp: number;
  private readonly playerMaxMana: number;
  private readonly playerStats: DerivedCombatStats;

  private readonly enemyMaxHp: number;

  private readonly loadout: CombatLoadout;

  private engineState: EngineState;
  private turn = 0;
  private phase: 'player_turn' | 'active_window' | 'enemy_turn' | 'ended' = 'player_turn';
  private activeWindowTimerRef: ReturnType<typeof setTimeout> | null = null;
  private enemyTurnDelayRef: ReturnType<typeof setTimeout> | null = null;

  private readonly wsSession: AuthenticatedSession;

  constructor(
    wsSession: AuthenticatedSession,
    character: Character,
    monster: Monster,
    stats: DerivedCombatStats & { maxHp: number },
    loadoutSlots: LoadoutSlotDto[],
  ) {
    this.combatId   = crypto.randomUUID();
    this.characterId = character.id;
    this.monster    = monster;
    this.wsSession  = wsSession;

    this.playerMaxHp   = stats.maxHp;
    this.playerMaxMana = stats.maxMana;
    this.playerStats   = stats;
    this.enemyMaxHp    = monster.hp;

    this.loadout = this.buildLoadout(loadoutSlots);

    this.engineState = {
      playerHp:          stats.maxHp,
      playerMana:        0,
      enemyHp:           monster.hp,
      activeEffects:     [],
      abilityCooldowns:  new Map(),
    };
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  getCombatId(): string   { return this.combatId; }
  getCharacterId(): string { return this.characterId; }
  getPhase(): string       { return this.phase; }

  /** Called by CombatSessionManager after construction. Sends combat:start and begins the first turn. */
  start(): void {
    log('info', 'combat', 'combat_session_started', {
      combatId:    this.combatId,
      characterId: this.characterId,
      monsterId:   this.monster.id,
      monsterName: this.monster.name,
    });

    const startPayload: CombatStartPayload = {
      combat_id:     this.combatId,
      monster: {
        id:       this.monster.id,
        name:     this.monster.name,
        icon_url: this.buildMonsterIconUrl(this.monster.icon_filename),
        max_hp:   this.enemyMaxHp,
        attack:   this.monster.attack,
        defence:  this.monster.defense,
      },
      player: {
        max_hp:       this.playerMaxHp,
        current_hp:   this.engineState.playerHp,
        max_mana:     this.playerMaxMana,
        current_mana: 0,
        attack:       this.playerStats.attack,
        defence:      this.playerStats.defence,
      },
      loadout: {
        slots: this.buildAbilityStates(),
      },
      turn_timer_ms: TURN_TIMER_MS,
    };

    sendToSession(this.wsSession, 'combat:start', startPayload);
    this.startTurn();
  }

  /**
   * Called by the dispatcher when client sends combat:trigger_active.
   * Silently ignored if conditions aren't met (timer may have just expired).
   */
  triggerActive(combatId: string): void {
    if (this.phase !== 'active_window') return;
    if (combatId !== this.combatId) return;

    const activeSlot = this.loadout.active;
    if (!activeSlot) return;
    if (this.engineState.playerMana < activeSlot.manaCost) return;
    const cooldown = this.engineState.abilityCooldowns.get(activeSlot.abilityId) ?? 0;
    if (cooldown > 0) return;

    // Cancel the auto-advance timer
    if (this.activeWindowTimerRef !== null) {
      clearTimeout(this.activeWindowTimerRef);
      this.activeWindowTimerRef = null;
    }

    // Fire the active ability
    const result = computeActiveAbility(activeSlot, this.playerStats, this.engineState);
    this.engineState = result.newState;

    log('info', 'combat', 'combat_ability_fired', {
      combatId:    this.combatId,
      characterId: this.characterId,
      turn:        this.turn,
      slot:        'active',
      ability:     activeSlot.name,
    });

    this.closeActiveWindow(result.events);
  }

  // ---------------------------------------------------------------------------
  // Private turn-loop methods
  // ---------------------------------------------------------------------------

  private startTurn(): void {
    this.turn += 1;
    this.phase = 'player_turn';

    const allEvents: CombatEventDto[] = [];

    // 1. Mana regen
    const regenResult = applyManaRegen(this.playerStats, this.engineState);
    this.engineState = regenResult.newState;
    allEvents.push(...regenResult.events);

    // 2. Player auto-attack (enemy has no dodge chance)
    const attackResult = computePlayerAttack(this.playerStats, 0, this.engineState);
    this.engineState = attackResult.newState;
    allEvents.push(...attackResult.events);

    // If enemy died from auto-attack, end immediately
    if (this.engineState.enemyHp <= 0) {
      this.sendTurnResult('player', allEvents);
      void this.endCombat('win');
      return;
    }

    // 3. Auto-ability resolution
    const autoSlots: AutoSlotConfig[] = (['auto_1', 'auto_2', 'auto_3'] as const)
      .filter((s) => this.loadout[s] !== null)
      .map((s) => ({ slot_name: s, ability: this.loadout[s]! }));

    if (autoSlots.length > 0) {
      const autoResult = computeAutoAbilities(autoSlots, this.playerStats, this.engineState);
      this.engineState = autoResult.newState;
      allEvents.push(...autoResult.events);

      // Log any abilities fired
      for (const evt of autoResult.events) {
        if (evt.kind === 'ability_fired' && evt.ability_name) {
          log('info', 'combat', 'combat_ability_fired', {
            combatId:    this.combatId,
            characterId: this.characterId,
            turn:        this.turn,
            slot:        'auto',
            ability:     evt.ability_name,
          });
        }
      }

      // If enemy died from auto-ability
      if (this.engineState.enemyHp <= 0) {
        this.sendTurnResult('player', allEvents);
        void this.endCombat('win');
        return;
      }
    }

    // Send player-phase turn result
    this.sendTurnResult('player', allEvents);

    // 4. Open active ability window
    this.phase = 'active_window';

    const activeWindowPayload: CombatActiveWindowPayload = {
      combat_id: this.combatId,
      timer_ms:  TURN_TIMER_MS,
      ability:   this.buildActiveWindowAbility(),
    };
    sendToSession(this.wsSession, 'combat:active_window', activeWindowPayload);

    // Auto-advance after timer expires
    this.activeWindowTimerRef = setTimeout(() => {
      this.activeWindowTimerRef = null;
      this.closeActiveWindow([]);
    }, TURN_TIMER_MS);
  }

  /** Resolves the enemy turn after the active window closes (with or without active ability used). */
  private closeActiveWindow(activeAbilityEvents: CombatEventDto[]): void {
    this.phase = 'enemy_turn';

    const allEvents: CombatEventDto[] = [...activeAbilityEvents];

    // 5. Tick active effects (DoT etc.) at end of player turn
    const tickResult = tickActiveEffects(this.playerStats, this.engineState);
    this.engineState = tickResult.newState;
    allEvents.push(...tickResult.events);

    // 6. Tick ability cooldowns
    this.engineState = tickAbilityCooldowns(this.engineState);

    // If enemy died from DoT tick
    if (this.engineState.enemyHp <= 0) {
      this.sendTurnResult('enemy', allEvents);
      void this.endCombat('win');
      return;
    }

    // 7. Enemy turn
    const enemyResult = computeEnemyTurn(this.monster.attack, this.playerStats, this.engineState);
    this.engineState = enemyResult.newState;
    allEvents.push(...enemyResult.events);

    log('info', 'combat', 'combat_turn_resolved', {
      combatId:    this.combatId,
      characterId: this.characterId,
      turn:        this.turn,
      playerHp:    this.engineState.playerHp,
      enemyHp:     this.engineState.enemyHp,
      playerMana:  this.engineState.playerMana,
    });

    this.sendTurnResult('enemy', allEvents);

    // 8. Check HP
    if (this.engineState.playerHp <= 0) {
      void this.endCombat('loss');
      return;
    }
    if (this.engineState.enemyHp <= 0) {
      void this.endCombat('win');
      return;
    }

    // 9. Next turn — delay gives clients room for monster attack animations
    this.enemyTurnDelayRef = setTimeout(() => {
      this.enemyTurnDelayRef = null;
      this.startTurn();
    }, ENEMY_TURN_DELAY_MS);
  }

  private async endCombat(outcome: 'win' | 'loss'): Promise<void> {
    if (this.phase === 'ended') return;
    this.phase = 'ended';

    // Cancel any pending timers
    if (this.activeWindowTimerRef !== null) {
      clearTimeout(this.activeWindowTimerRef);
      this.activeWindowTimerRef = null;
    }
    if (this.enemyTurnDelayRef !== null) {
      clearTimeout(this.enemyTurnDelayRef);
      this.enemyTurnDelayRef = null;
    }

    let xpGained = 0;
    let crownsGained = 0;
    const itemsDropped: ItemDroppedDto[] = [];
    const abilityDrops: AbilityDroppedDto[] = [];

    if (outcome === 'win') {
      try {
        // Award XP
        xpGained = this.monster.xp_reward;
        await awardXp(this.characterId, xpGained);

        // Award crowns
        crownsGained = rollCrownDrop(this.monster);
        if (crownsGained > 0) {
          await awardCrowns(this.characterId, crownsGained);
        }

        // Roll item loot
        const lootTable = await getLootByMonsterId(this.monster.id);
        for (const entry of lootTable) {
          if (Math.random() * 100 < entry.drop_chance) {
            await grantItemToCharacter(this.wsSession, this.characterId, entry.item_def_id, entry.quantity);
            itemsDropped.push({
              item_def_id: entry.item_def_id,
              name:        entry.item_name,
              quantity:    entry.quantity,
              icon_url:    entry.icon_filename
                ? `${config.adminBaseUrl}/item-icons/${entry.icon_filename}`
                : null,
            });
          }
        }

        // Roll ability loot
        const abilityLoot = await getAbilityLootByMonsterId(this.monster.id);
        for (const entry of abilityLoot) {
          if (Math.random() * 100 < entry.drop_chance) {
            await grantAbilityToCharacter(this.characterId, entry.ability_id);
            abilityDrops.push({
              ability_id: entry.ability_id,
              name:       entry.ability_name,
              icon_url:   entry.icon_filename
                ? `${config.adminBaseUrl}/ability-icons/${entry.icon_filename}`
                : null,
            });
          }
        }
      } catch (err) {
        log('error', 'combat', 'combat_reward_error', {
          combatId:    this.combatId,
          characterId: this.characterId,
          err,
        });
      }
    }

    // Clear in_combat flag
    await setCharacterInCombat(this.characterId, false).catch((err) => {
      log('error', 'combat', 'in_combat_reset_failed', { characterId: this.characterId, err });
    });

    log('info', 'combat', 'combat_session_ended', {
      combatId:    this.combatId,
      characterId: this.characterId,
      monsterId:   this.monster.id,
      outcome,
      turns:       this.turn,
      xpGained,
      crownsGained,
      itemsDropped: itemsDropped.length,
      abilityDrops: abilityDrops.length,
    });

    const endPayload: CombatEndPayload = {
      combat_id:      this.combatId,
      outcome,
      xp_gained:      xpGained,
      crowns_gained:  crownsGained,
      items_dropped:  itemsDropped,
      ability_drops:  abilityDrops,
    };
    sendToSession(this.wsSession, 'combat:end', endPayload);

    // Remove session from manager (lazy import to avoid circular deps)
    import('./combat-session-manager').then(({ CombatSessionManager }) => {
      CombatSessionManager.end(this.characterId);
    }).catch(() => undefined);
  }

  /**
   * Called when the player disconnects mid-combat (grace period expired).
   * Cancels any pending timers, clears in_combat, and removes from manager.
   * Does NOT send any WS messages — the socket is gone.
   */
  abort(): void {
    if (this.activeWindowTimerRef !== null) {
      clearTimeout(this.activeWindowTimerRef);
      this.activeWindowTimerRef = null;
    }
    if (this.enemyTurnDelayRef !== null) {
      clearTimeout(this.enemyTurnDelayRef);
      this.enemyTurnDelayRef = null;
    }
    setCharacterInCombat(this.characterId, false).catch(() => undefined);
    import('./combat-session-manager').then(({ CombatSessionManager }) => {
      CombatSessionManager.end(this.characterId);
    }).catch(() => undefined);
    log('info', 'combat', 'combat_session_aborted', {
      combatId: this.combatId,
      characterId: this.characterId,
    });
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private sendTurnResult(phase: 'player' | 'enemy', events: CombatEventDto[]): void {
    const payload: CombatTurnResultPayload = {
      combat_id:      this.combatId,
      turn:           this.turn,
      phase,
      events,
      player_hp:      this.engineState.playerHp,
      player_mana:    this.engineState.playerMana,
      enemy_hp:       this.engineState.enemyHp,
      ability_states: this.buildAbilityStates(),
    };
    sendToSession(this.wsSession, 'combat:turn_result', payload);
  }

  private buildLoadout(slots: LoadoutSlotDto[]): CombatLoadout {
    const loadout: CombatLoadout = { auto_1: null, auto_2: null, auto_3: null, active: null };

    for (const slot of slots) {
      if (!slot.ability || slot.ability_id === null) continue;
      const a = slot.ability;
      const snap: LoadoutSlotSnapshot & { iconUrl: string | null } = {
        abilityId:    a.id,
        name:         a.name,
        description:  a.description,
        manaCost:     a.mana_cost,
        effectType:   a.effect_type,
        effectValue:  a.effect_value,
        durationTurns: a.duration_turns,
        cooldownTurns: a.cooldown_turns,
        priority:     slot.priority,
        slotType:     a.slot_type,
        iconUrl:      a.icon_url,
      };
      loadout[slot.slot_name] = snap;
    }

    return loadout;
  }

  private buildAbilityStates(): CombatAbilityStateDto[] {
    const states: CombatAbilityStateDto[] = [];
    const slotNames = ['auto_1', 'auto_2', 'auto_3', 'active'] as const;

    for (const slotName of slotNames) {
      const slot = this.loadout[slotName];
      if (!slot) continue;

      const cooldown = this.engineState.abilityCooldowns.get(slot.abilityId) ?? 0;
      let status: CombatAbilityStateDto['status'];
      if (cooldown > 0) {
        status = 'cooldown';
      } else if (this.engineState.playerMana < slot.manaCost) {
        status = 'insufficient_mana';
      } else {
        status = 'ready';
      }

      states.push({
        slot_name:               slotName,
        ability_id:              slot.abilityId,
        name:                    slot.name,
        description:             slot.description,
        mana_cost:               slot.manaCost,
        icon_url:                slot.iconUrl,
        status,
        cooldown_turns_remaining: cooldown,
      });
    }

    return states;
  }

  private buildActiveWindowAbility(): CombatAbilityStateDto | null {
    const slot = this.loadout.active;
    if (!slot) return null;

    const cooldown = this.engineState.abilityCooldowns.get(slot.abilityId) ?? 0;
    if (cooldown > 0 || this.engineState.playerMana < slot.manaCost) return null;

    return {
      slot_name:               'active',
      ability_id:              slot.abilityId,
      name:                    slot.name,
      description:             slot.description,
      mana_cost:               slot.manaCost,
      icon_url:                slot.iconUrl,
      status:                  'ready',
      cooldown_turns_remaining: 0,
    };
  }

  private buildMonsterIconUrl(filename: string | null): string | null {
    return filename ? `${config.adminBaseUrl}/monster-icons/${filename}` : null;
  }
}

// ---------------------------------------------------------------------------
// Local type alias to avoid unused-import noise
// ---------------------------------------------------------------------------

type CombatEventDto = import('../../../../shared/protocol/index').CombatEventDto;
