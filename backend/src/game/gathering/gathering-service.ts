/**
 * gathering-service.ts
 *
 * Manages active gathering sessions. Each session ticks once per second,
 * rolling a weighted event and applying its effects. Sessions are in-memory
 * (like CombatSession) and lost on server restart.
 */

import { log } from '../../logger';
import { config } from '../../config';
import { sendToSession } from '../../websocket/server';
import type { AuthenticatedSession } from '../../websocket/server';
import { findByAccountId, updateCharacter, addCrowns } from '../../db/queries/characters';
import type { Character } from '../../db/queries/characters';
import { updateToolDurability, deleteInventoryItem, getInventorySlotById, getItemDefinitionById } from '../../db/queries/inventory';
import { grantItemToCharacter } from '../inventory/inventory-grant-service';
import { getMonsterById } from '../../db/queries/monsters';
import { CombatSessionManager } from '../combat/combat-session-manager';
import { getPhase } from '../world/day-cycle-service';
import { computeCombatStats } from '../combat/combat-stats-service';
import { getCharacterLoadout } from '../../db/queries/loadouts';
import { setCharacterInCombat } from '../../db/queries/loadouts';
import { CombatSession } from '../combat/combat-session';
import type { Monster } from '../../db/queries/monsters';
import { QuestTracker } from '../quest/quest-tracker';
import type {
  GatheringTickEvent,
  GatheringSummary,
} from '../../../../shared/protocol/index';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GatherEventConfig {
  type: 'resource' | 'gold' | 'monster' | 'accident' | 'nothing';
  weight: number;
  item_def_id?: number;
  quantity?: number;
  min_amount?: number;
  max_amount?: number;
  monster_id?: number;
  hp_damage?: number;
  message?: string;
}

interface GatherActionConfig {
  required_tool_type: string;
  durability_per_second: number;
  min_seconds: number;
  max_seconds: number;
  events: GatherEventConfig[];
}

interface GatherEventResult {
  tick: number;
  type: GatherEventConfig['type'];
  message?: string;
  item_name?: string;
  quantity?: number;
  crowns?: number;
  hp_damage?: number;
  combat_result?: 'win' | 'loss';
}

interface PendingResource {
  item_def_id: number;
  quantity: number;
}

interface GatheringSession {
  characterId: string;
  wsSession: AuthenticatedSession;
  actionId: number;
  buildingId: number;
  /** All matching tool slot IDs, sorted by durability ascending (lowest first) */
  toolSlotIds: number[];
  chosenDuration: number;
  totalDurabilityCost: number;
  config: GatherActionConfig;
  currentTick: number;
  eventLog: GatherEventResult[];
  paused: boolean;
  timer: ReturnType<typeof setInterval> | null;
  totalWeightSum: number;
  /** Resources accumulated during gathering — granted only on successful end */
  pendingResources: PendingResource[];
  /** Crowns accumulated during gathering — granted only on successful end */
  pendingCrowns: number;
}

// ---------------------------------------------------------------------------
// Weighted random selection helper
// ---------------------------------------------------------------------------

function pickEvent(events: GatherEventConfig[], totalWeight: number): GatherEventConfig {
  let roll = Math.random() * totalWeight;
  for (const ev of events) {
    roll -= ev.weight;
    if (roll <= 0) return ev;
  }
  return events[events.length - 1]!;
}

// ---------------------------------------------------------------------------
// GatheringSessionManager singleton
// ---------------------------------------------------------------------------

class GatheringSessionManagerImpl {
  private sessions = new Map<string, GatheringSession>();

  // ── Start a gathering session ──────────────────────────────────────────
  async start(
    wsSession: AuthenticatedSession,
    character: Character,
    buildingId: number,
    actionId: number,
    config: GatherActionConfig,
    toolSlotIds: number[],
    totalToolDurability: number,
    duration: number,
  ): Promise<void> {
    const characterId = character.id;

    // Validation gates
    if (this.sessions.has(characterId)) {
      sendToSession(wsSession, 'gathering.rejected', { reason: 'IN_GATHERING', message: 'You are already gathering.' });
      return;
    }
    if (character.in_combat) {
      sendToSession(wsSession, 'gathering.rejected', { reason: 'IN_COMBAT', message: 'You are in combat.' });
      return;
    }
    if (character.in_gathering) {
      sendToSession(wsSession, 'gathering.rejected', { reason: 'IN_GATHERING', message: 'You are already gathering.' });
      return;
    }
    if (character.current_hp <= 0) {
      sendToSession(wsSession, 'gathering.rejected', { reason: 'HP_ZERO', message: 'You must heal before gathering.' });
      return;
    }
    if (duration < config.min_seconds || duration > config.max_seconds) {
      sendToSession(wsSession, 'gathering.rejected', { reason: 'INVALID_DURATION', message: `Duration must be between ${config.min_seconds} and ${config.max_seconds} seconds.` });
      return;
    }
    const totalDurabilityCost = duration * config.durability_per_second;
    if (totalToolDurability < totalDurabilityCost) {
      sendToSession(wsSession, 'gathering.rejected', {
        reason: 'INSUFFICIENT_DURABILITY',
        message: `Tools need ${totalDurabilityCost} durability but only have ${totalToolDurability} total.`,
      });
      return;
    }

    // Set in_gathering flag
    await updateCharacter(characterId, { in_gathering: true });

    const totalWeightSum = config.events.reduce((sum, e) => sum + e.weight, 0);

    // Events fire every 2 seconds, so total ticks = ceil(duration / 2)
    const totalTicks = Math.ceil(duration / 2);

    const session: GatheringSession = {
      characterId,
      wsSession,
      actionId,
      buildingId,
      toolSlotIds,
      chosenDuration: totalTicks,
      totalDurabilityCost,
      config,
      currentTick: 0,
      eventLog: [],
      paused: false,
      timer: null,
      totalWeightSum,
      pendingResources: [],
      pendingCrowns: 0,
    };

    this.sessions.set(characterId, session);

    // Send started confirmation
    sendToSession(wsSession, 'gathering.started', {
      action_id: actionId,
      building_id: buildingId,
      duration,
      durability_cost: totalDurabilityCost,
      tool_slot_ids: toolSlotIds,
      started_at: new Date().toISOString(),
    });

    log('info', 'gathering', 'gathering_started', {
      characterId,
      actionId,
      buildingId,
      duration,
      toolSlotIds,
      totalDurabilityCost,
    });

    // Start tick loop (events fire every 2 seconds)
    session.timer = setInterval(() => {
      void this.tick(characterId);
    }, 2000);
  }

  // ── Process one tick ───────────────────────────────────────────────────
  private async tick(characterId: string): Promise<void> {
    const session = this.sessions.get(characterId);
    if (!session || session.paused) return;

    session.currentTick++;

    // Roll event
    const eventConfig = pickEvent(session.config.events, session.totalWeightSum);

    // Re-fetch character for current HP
    const character = await findByAccountId(
      (await findCharacterAccountId(characterId)) ?? '',
    );
    if (!character) {
      await this.endSession(characterId, 'death');
      return;
    }

    const tickEvent: GatheringTickEvent = { type: eventConfig.type };
    const eventResult: GatherEventResult = { tick: session.currentTick, type: eventConfig.type };

    // Process event by type
    switch (eventConfig.type) {
      case 'nothing':
        break;

      case 'resource': {
        if (eventConfig.item_def_id != null && eventConfig.quantity != null) {
          // Defer granting — accumulate for end-of-session
          session.pendingResources.push({
            item_def_id: eventConfig.item_def_id,
            quantity: eventConfig.quantity,
          });
          // Look up item def for name and icon
          const itemDef = await getItemDefinitionById(eventConfig.item_def_id);
          const itemName = itemDef?.name ?? 'Resource';
          const itemIconUrl = itemDef?.icon_filename
            ? `${config.adminBaseUrl}/item-icons/${itemDef.icon_filename}`
            : undefined;
          tickEvent.item_name = itemName;
          tickEvent.item_icon_url = itemIconUrl;
          tickEvent.quantity = eventConfig.quantity;
          tickEvent.message = eventConfig.message;
          eventResult.item_name = itemName;
          eventResult.quantity = eventConfig.quantity;
          eventResult.message = eventConfig.message;
        }
        break;
      }

      case 'gold': {
        const min = eventConfig.min_amount ?? 0;
        const max = eventConfig.max_amount ?? min;
        const amount = min + Math.floor(Math.random() * (max - min + 1));
        if (amount > 0) {
          // Defer granting — accumulate for end-of-session
          session.pendingCrowns += amount;
        }
        tickEvent.crowns = amount;
        tickEvent.message = eventConfig.message;
        eventResult.crowns = amount;
        eventResult.message = eventConfig.message;
        break;
      }

      case 'accident': {
        const damage = eventConfig.hp_damage ?? 0;
        const newHp = Math.max(0, character.current_hp - damage);
        await updateCharacter(characterId, { current_hp: newHp });
        tickEvent.hp_damage = damage;
        tickEvent.message = eventConfig.message;
        eventResult.hp_damage = damage;
        eventResult.message = eventConfig.message;

        if (newHp <= 0) {
          session.eventLog.push(eventResult);
          // Send final tick before ending
          sendToSession(session.wsSession, 'gathering.tick', {
            tick: session.currentTick,
            total_ticks: session.chosenDuration,
            event: tickEvent,
            current_hp: 0,
            tool_durability: Math.max(0, (await this.getTotalToolDurability(session)) - session.config.durability_per_second * session.currentTick),
          });
          await this.endSession(characterId, 'death');
          return;
        }
        break;
      }

      case 'monster': {
        if (eventConfig.monster_id == null) break;
        const monster = await getMonsterById(eventConfig.monster_id);
        if (!monster) {
          // Monster doesn't exist — treat as nothing
          tickEvent.type = 'nothing';
          eventResult.type = 'nothing';
          break;
        }

        // Pause gathering
        session.paused = true;
        if (session.timer) {
          clearInterval(session.timer);
          session.timer = null;
        }

        tickEvent.monster_name = monster.name;
        tickEvent.monster_icon_url = monster.icon_filename
          ? `${config.adminBaseUrl}/monster-icons/${monster.icon_filename}`
          : undefined;
        tickEvent.message = `A ${monster.name} attacks!`;
        eventResult.message = tickEvent.message;

        // Send combat pause notification (includes icon URL for the gathering modal)
        sendToSession(session.wsSession, 'gathering.combat_pause', {
          tick: session.currentTick,
          monster_name: monster.name,
          monster_icon_url: tickEvent.monster_icon_url ?? null,
        });

        // Apply night bonus
        const isNight = getPhase() === 'night';
        const mult = isNight ? 1.1 : 1;
        const effectiveMonster: Monster = {
          ...monster,
          hp: Math.ceil(monster.hp * mult),
          attack: Math.ceil(monster.attack * mult),
          defense: Math.ceil(monster.defense * mult),
        };

        // Register callback for when combat ends
        CombatSessionManager.registerOnEnd(characterId, async (_cid, outcome) => {
          eventResult.combat_result = outcome;
          session.eventLog.push(eventResult);

          // Re-read character HP
          const charAfterCombat = await findByAccountId(
            (await findCharacterAccountId(characterId)) ?? '',
          );
          const hpAfterCombat = charAfterCombat?.current_hp ?? 0;

          if (hpAfterCombat <= 0) {
            await this.endSession(characterId, 'death');
          } else {
            // Resume gathering
            session.paused = false;
            sendToSession(session.wsSession, 'gathering.combat_resume', {
              tick: session.currentTick,
              remaining_ticks: session.chosenDuration - session.currentTick,
              combat_result: outcome,
              current_hp: hpAfterCombat,
            });
            session.timer = setInterval(() => {
              void this.tick(characterId);
            }, 2000);
          }
        });

        // Start combat
        void CombatSessionManager.start(session.wsSession, character, effectiveMonster);

        // Send tick but don't add to eventLog yet (will be added in callback)
        sendToSession(session.wsSession, 'gathering.tick', {
          tick: session.currentTick,
          total_ticks: session.chosenDuration,
          event: tickEvent,
          current_hp: character.current_hp,
          tool_durability: Math.max(0, (await this.getTotalToolDurability(session)) - session.config.durability_per_second * session.currentTick),
        });
        return; // Don't process further — combat takes over
      }
    }

    session.eventLog.push(eventResult);

    // Refresh HP for the tick message
    const currentChar = await findByAccountId(
      (await findCharacterAccountId(characterId)) ?? '',
    );

    sendToSession(session.wsSession, 'gathering.tick', {
      tick: session.currentTick,
      total_ticks: session.chosenDuration,
      event: tickEvent,
      current_hp: currentChar?.current_hp ?? 0,
      tool_durability: Math.max(0, (await this.getTotalToolDurability(session)) - session.config.durability_per_second * session.currentTick),
    });

    // Check if all ticks completed
    if (session.currentTick >= session.chosenDuration) {
      await this.endSession(characterId, 'completed');
    }
  }

  // ── Cancel a session ───────────────────────────────────────────────────
  async cancel(characterId: string): Promise<void> {
    const session = this.sessions.get(characterId);
    if (!session) return;
    await this.endSession(characterId, 'cancelled');
  }

  // ── End a session ──────────────────────────────────────────────────────
  private async endSession(
    characterId: string,
    reason: 'completed' | 'cancelled' | 'death',
  ): Promise<void> {
    const session = this.sessions.get(characterId);
    if (!session) return;

    // Clear timer
    if (session.timer) {
      clearInterval(session.timer);
      session.timer = null;
    }
    this.sessions.delete(characterId);

    // Apply durability cost across tools (lowest durability first)
    let remainingCost = session.totalDurabilityCost;
    let toolDestroyed = false;
    let toolRemainingDurability: number | null = null;

    for (const slotId of session.toolSlotIds) {
      if (remainingCost <= 0) break;
      const slot = await getInventorySlotById(slotId, characterId);
      if (!slot) continue;

      const dur = slot.current_durability ?? 0;
      if (dur <= 0) continue;

      const deduction = Math.min(dur, remainingCost);
      remainingCost -= deduction;
      const newDur = dur - deduction;

      if (newDur <= 0) {
        toolDestroyed = true;
        await deleteInventoryItem(slotId, characterId);
        sendToSession(session.wsSession, 'inventory.item_deleted', { slot_id: slotId });
        log('info', 'gathering', 'tool_destroyed', { characterId, toolSlotId: slotId });
      } else {
        toolRemainingDurability = newDur;
        await updateToolDurability(slotId, newDur);
      }
    }

    // Clear in_gathering flag
    await updateCharacter(characterId, { in_gathering: false });

    // Grant pending resources and crowns only on successful completion
    if (reason === 'completed') {
      for (const res of session.pendingResources) {
        await grantItemToCharacter(session.wsSession, characterId, res.item_def_id, res.quantity);
      }
      if (session.pendingCrowns > 0) {
        await addCrowns(characterId, session.pendingCrowns);
        const charAfter = await findByAccountId(
          (await findCharacterAccountId(characterId)) ?? '',
        );
        sendToSession(session.wsSession, 'character.crowns_changed', {
          crowns: charAfter?.crowns ?? 0,
        });
      }

      // Quest tracking: gathering completed
      try {
        const questProgress = await QuestTracker.onGatheringCompleted(characterId, session.buildingId);
        for (const p of questProgress) {
          sendToSession(session.wsSession, 'quest.progress', p);
        }
      } catch (qErr) {
        log('warn', 'gathering', 'quest_tracker_error', { characterId, err: qErr });
      }
    }

    // Build summary
    const summary = this.buildSummary(session.eventLog);

    sendToSession(session.wsSession, 'gathering.ended', {
      reason,
      ticks_completed: session.currentTick,
      total_ticks: session.chosenDuration,
      summary,
      tool_destroyed: toolDestroyed,
      tool_remaining_durability: toolRemainingDurability,
    });

    log('info', 'gathering', 'gathering_ended', {
      characterId,
      reason,
      ticksCompleted: session.currentTick,
      totalTicks: session.chosenDuration,
      toolDestroyed,
      summary,
    });
  }

  // ── Build summary from event log ───────────────────────────────────────
  private buildSummary(events: GatherEventResult[]): GatheringSummary {
    const resourceMap = new Map<string, number>();
    let crownsGained = 0;
    let combatsFought = 0;
    let combatsWon = 0;
    let accidents = 0;
    let totalHpLost = 0;

    for (const ev of events) {
      switch (ev.type) {
        case 'resource':
          if (ev.item_name && ev.quantity) {
            resourceMap.set(ev.item_name, (resourceMap.get(ev.item_name) ?? 0) + ev.quantity);
          }
          break;
        case 'gold':
          crownsGained += ev.crowns ?? 0;
          break;
        case 'monster':
          combatsFought++;
          if (ev.combat_result === 'win') combatsWon++;
          break;
        case 'accident':
          accidents++;
          totalHpLost += ev.hp_damage ?? 0;
          break;
      }
    }

    return {
      resources_gained: Array.from(resourceMap.entries()).map(([item_name, quantity]) => ({ item_name, quantity })),
      crowns_gained: crownsGained,
      combats_fought: combatsFought,
      combats_won: combatsWon,
      accidents,
      total_hp_lost: totalHpLost,
    };
  }

  // ── Helpers ────────────────────────────────────────────────────────────
  has(characterId: string): boolean {
    return this.sessions.has(characterId);
  }

  private async getTotalToolDurability(session: GatheringSession): Promise<number> {
    let total = 0;
    for (const slotId of session.toolSlotIds) {
      const slot = await getInventorySlotById(slotId, session.characterId);
      total += slot?.current_durability ?? 0;
    }
    return total;
  }
}

// ---------------------------------------------------------------------------
// Helper: find account_id for a character (to use findByAccountId)
// ---------------------------------------------------------------------------
import { query } from '../../db/connection';

async function findCharacterAccountId(characterId: string): Promise<string | null> {
  const result = await query<{ account_id: string }>(
    'SELECT account_id FROM characters WHERE id = $1',
    [characterId],
  );
  return result.rows[0]?.account_id ?? null;
}

export const GatheringSessionManager = new GatheringSessionManagerImpl();
