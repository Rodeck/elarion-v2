import { log } from '../../logger';
import { query } from '../../db/connection';
import {
  getCharacterQuestsWithObjectiveType,
  updateObjectiveProgress,
  areAllObjectivesComplete,
} from '../../db/queries/quests';
import type { QuestProgressPayload } from '../../../../shared/protocol/index';

// ---------------------------------------------------------------------------
// Quest Tracker — singleton that hooks into existing game systems to update
// quest objective progress. Each method returns an array of progress payloads
// for the caller to send to the player's session.
// ---------------------------------------------------------------------------

class QuestTrackerImpl {

  /**
   * Called after a player wins combat against a monster.
   */
  async onMonsterKilled(characterId: string, monsterId: number): Promise<QuestProgressPayload[]> {
    return this.incrementObjectives(characterId, 'kill_monster', monsterId);
  }

  /**
   * Called after a player collects crafted items.
   */
  async onItemCrafted(characterId: string, itemDefId: number, quantity: number): Promise<QuestProgressPayload[]> {
    return this.incrementObjectives(characterId, 'craft_item', itemDefId, quantity);
  }

  /**
   * Called after a player completes a gathering session.
   */
  async onGatheringCompleted(characterId: string, buildingId: number): Promise<QuestProgressPayload[]> {
    return this.incrementObjectives(characterId, 'gather_resource', buildingId);
  }

  /**
   * Called after any inventory change. Re-checks collect_item objectives
   * against the actual inventory count.
   */
  async onInventoryChanged(characterId: string): Promise<QuestProgressPayload[]> {
    const matches = await getCharacterQuestsWithObjectiveType(characterId, 'collect_item');
    if (matches.length === 0) return [];

    const results: QuestProgressPayload[] = [];

    for (const m of matches) {
      if (m.target_id == null) continue;

      // Check actual inventory count
      const invResult = await query<{ total: string }>(
        `SELECT COALESCE(SUM(quantity), 0) as total FROM inventory_items
         WHERE character_id = $1 AND item_def_id = $2`,
        [characterId, m.target_id],
      );
      const currentCount = parseInt(invResult.rows[0]?.total ?? '0', 10);
      const newProgress = Math.min(currentCount, m.target_quantity);
      const isComplete = newProgress >= m.target_quantity;

      // Only send update if progress changed
      if (newProgress !== m.current_progress || isComplete !== m.is_complete) {
        await updateObjectiveProgress(m.character_quest_id, m.objective_id, newProgress, isComplete);

        const questComplete = await areAllObjectivesComplete(m.character_quest_id);

        results.push({
          character_quest_id: m.character_quest_id,
          objective_id: m.objective_id,
          current_progress: newProgress,
          target_quantity: m.target_quantity,
          is_complete: isComplete,
          quest_complete: questComplete,
        });

        log('debug', 'quest-tracker', 'collect_item_progress', {
          characterId,
          charQuestId: m.character_quest_id,
          objectiveId: m.objective_id,
          itemDefId: m.target_id,
          progress: `${newProgress}/${m.target_quantity}`,
        });
      }
    }

    return results;
  }

  /**
   * Called after a player levels up.
   */
  async onLevelUp(characterId: string, newLevel: number): Promise<QuestProgressPayload[]> {
    const matches = await getCharacterQuestsWithObjectiveType(characterId, 'reach_level');
    if (matches.length === 0) return [];

    const results: QuestProgressPayload[] = [];

    for (const m of matches) {
      const isComplete = newLevel >= m.target_quantity;
      const newProgress = Math.min(newLevel, m.target_quantity);

      if (newProgress !== m.current_progress || isComplete !== m.is_complete) {
        await updateObjectiveProgress(m.character_quest_id, m.objective_id, newProgress, isComplete);

        const questComplete = await areAllObjectivesComplete(m.character_quest_id);

        results.push({
          character_quest_id: m.character_quest_id,
          objective_id: m.objective_id,
          current_progress: newProgress,
          target_quantity: m.target_quantity,
          is_complete: isComplete,
          quest_complete: questComplete,
        });
      }
    }

    return results;
  }

  /**
   * Called after crowns are spent (deducted).
   */
  async onCrownsSpent(characterId: string, amount: number): Promise<QuestProgressPayload[]> {
    return this.incrementObjectives(characterId, 'spend_crowns', undefined, amount);
  }

  /**
   * Called when a player enters a zone or building.
   */
  async onLocationVisited(characterId: string, zoneId: number, _buildingId?: number): Promise<QuestProgressPayload[]> {
    return this.setCompleteObjectives(characterId, 'visit_location', zoneId);
  }

  /**
   * Called when a player interacts with an NPC (opens quest dialogue).
   */
  async onNpcTalkedTo(characterId: string, npcId: number): Promise<QuestProgressPayload[]> {
    return this.setCompleteObjectives(characterId, 'talk_to_npc', npcId);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Increment-based progress for kill, craft, spend, gather objectives.
   */
  private async incrementObjectives(
    characterId: string,
    objectiveType: string,
    targetId?: number,
    amount: number = 1,
  ): Promise<QuestProgressPayload[]> {
    const matches = await getCharacterQuestsWithObjectiveType(characterId, objectiveType, targetId);
    if (matches.length === 0) return [];

    const results: QuestProgressPayload[] = [];

    for (const m of matches) {
      if (m.is_complete) continue; // Already complete, skip

      const newProgress = Math.min(m.current_progress + amount, m.target_quantity);
      const isComplete = newProgress >= m.target_quantity;

      await updateObjectiveProgress(m.character_quest_id, m.objective_id, newProgress, isComplete);

      const questComplete = await areAllObjectivesComplete(m.character_quest_id);

      results.push({
        character_quest_id: m.character_quest_id,
        objective_id: m.objective_id,
        current_progress: newProgress,
        target_quantity: m.target_quantity,
        is_complete: isComplete,
        quest_complete: questComplete,
      });

      log('debug', 'quest-tracker', 'objective_progress', {
        characterId,
        charQuestId: m.character_quest_id,
        objectiveType,
        targetId,
        progress: `${newProgress}/${m.target_quantity}`,
      });
    }

    return results;
  }

  /**
   * Boolean/visit-based progress — set to complete on first occurrence.
   */
  private async setCompleteObjectives(
    characterId: string,
    objectiveType: string,
    targetId: number,
  ): Promise<QuestProgressPayload[]> {
    const matches = await getCharacterQuestsWithObjectiveType(characterId, objectiveType, targetId);
    if (matches.length === 0) return [];

    const results: QuestProgressPayload[] = [];

    for (const m of matches) {
      if (m.is_complete) continue;

      await updateObjectiveProgress(m.character_quest_id, m.objective_id, m.target_quantity, true);

      const questComplete = await areAllObjectivesComplete(m.character_quest_id);

      results.push({
        character_quest_id: m.character_quest_id,
        objective_id: m.objective_id,
        current_progress: m.target_quantity,
        target_quantity: m.target_quantity,
        is_complete: true,
        quest_complete: questComplete,
      });
    }

    return results;
  }
}

export const QuestTracker = new QuestTrackerImpl();
