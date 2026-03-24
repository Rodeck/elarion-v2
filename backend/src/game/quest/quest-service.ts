import { config } from '../../config';
import { log } from '../../logger';
import { query } from '../../db/connection';
import {
  getQuestById,
  getObjectivesForQuest,
  getPrerequisitesForQuest,
  getRewardsForQuest,
  getCharacterQuestProgress,
  hasCompletedQuest,
  getCurrentResetKey,
} from '../../db/queries/quests';
import { getInventorySlotCount } from '../../db/queries/inventory';
import { grantItemToCharacter } from '../inventory/inventory-grant-service';
import { awardXp } from '../progression/xp-service';
import { awardCrowns } from '../currency/crown-service';
import type { AuthenticatedSession } from '../../websocket/server';
import type {
  QuestDefinitionDto,
  QuestObjectiveDto,
  QuestRewardDto,
  QuestPrerequisiteDto,
  CharacterQuestDto,
  QuestType,
  QuestStatus,
  ObjectiveType,
  PrereqType,
  RewardType,
  InventorySlotDto,
} from '../../../../shared/protocol/index';
import type { QuestObjective, QuestPrerequisite, QuestReward, CharacterQuest } from '../../db/queries/quests';

const INVENTORY_CAPACITY = 20;

function buildIconUrl(type: 'item' | 'monster' | 'npc', iconFilename: string | null): string | null {
  if (!iconFilename) return null;
  const prefix = type === 'item' ? 'item-icons' : type === 'monster' ? 'monster-icons' : 'npc-icons';
  return `${config.adminBaseUrl}/${prefix}/${iconFilename}`;
}

// ---------------------------------------------------------------------------
// Name + icon resolution helpers
// ---------------------------------------------------------------------------

interface ResolvedTarget {
  name: string | null;
  icon_url: string | null;
}

async function resolveObjectiveTarget(obj: QuestObjective): Promise<ResolvedTarget> {
  if (obj.target_id == null) return { name: null, icon_url: null };

  switch (obj.objective_type) {
    case 'kill_monster': {
      const r = await query<{ name: string; icon_filename: string | null }>(
        'SELECT name, icon_filename FROM monsters WHERE id = $1', [obj.target_id],
      );
      const row = r.rows[0];
      return row ? { name: row.name, icon_url: buildIconUrl('monster', row.icon_filename) } : { name: null, icon_url: null };
    }
    case 'collect_item':
    case 'craft_item': {
      const r = await query<{ name: string; icon_filename: string | null }>(
        'SELECT name, icon_filename FROM item_definitions WHERE id = $1', [obj.target_id],
      );
      const row = r.rows[0];
      return row ? { name: row.name, icon_url: buildIconUrl('item', row.icon_filename) } : { name: null, icon_url: null };
    }
    case 'talk_to_npc': {
      const r = await query<{ name: string; icon_filename: string | null }>(
        'SELECT name, icon_filename FROM npcs WHERE id = $1', [obj.target_id],
      );
      const row = r.rows[0];
      return row ? { name: row.name, icon_url: buildIconUrl('npc', row.icon_filename) } : { name: null, icon_url: null };
    }
    case 'visit_location': {
      const r = await query<{ name: string }>('SELECT name FROM map_zones WHERE id = $1', [obj.target_id]);
      const row = r.rows[0];
      return { name: row?.name ?? null, icon_url: null };
    }
    case 'gather_resource': {
      const r = await query<{ name: string }>('SELECT name FROM buildings WHERE id = $1', [obj.target_id]);
      const row = r.rows[0];
      return { name: row?.name ?? null, icon_url: null };
    }
    default:
      return { name: null, icon_url: null };
  }
}

async function resolveRewardTarget(reward: QuestReward): Promise<ResolvedTarget> {
  if (reward.reward_type === 'item' && reward.target_id != null) {
    const r = await query<{ name: string; icon_filename: string | null }>(
      'SELECT name, icon_filename FROM item_definitions WHERE id = $1', [reward.target_id],
    );
    const row = r.rows[0];
    return row ? { name: row.name, icon_url: buildIconUrl('item', row.icon_filename) } : { name: null, icon_url: null };
  }
  return { name: null, icon_url: null };
}

async function resolvePrereqDescription(prereq: QuestPrerequisite): Promise<string> {
  switch (prereq.prereq_type) {
    case 'min_level':
      return `Reach level ${prereq.target_value}`;
    case 'has_item': {
      if (prereq.target_id == null) return 'Possess a specific item';
      const r = await query<{ name: string }>('SELECT name FROM item_definitions WHERE id = $1', [prereq.target_id]);
      const itemName = r.rows[0]?.name ?? 'Unknown Item';
      return prereq.target_value > 1 ? `Have ${prereq.target_value}x ${itemName}` : `Have ${itemName}`;
    }
    case 'completed_quest': {
      if (prereq.target_id == null) return 'Complete a specific quest';
      const r = await query<{ name: string }>('SELECT name FROM quest_definitions WHERE id = $1', [prereq.target_id]);
      return `Complete "${r.rows[0]?.name ?? 'Unknown Quest'}"`;
    }
    case 'class_required': {
      if (prereq.target_id == null) return 'Be a specific class';
      const r = await query<{ name: string }>('SELECT name FROM character_classes WHERE id = $1', [prereq.target_id]);
      return `Be a ${r.rows[0]?.name ?? 'Unknown Class'}`;
    }
    default:
      return 'Unknown prerequisite';
  }
}

// ---------------------------------------------------------------------------
// DTO builders
// ---------------------------------------------------------------------------

export async function buildQuestDefinitionDto(questId: number): Promise<QuestDefinitionDto | null> {
  const quest = await getQuestById(questId);
  if (!quest) return null;

  const [objectives, prereqs, rewards] = await Promise.all([
    getObjectivesForQuest(questId),
    getPrerequisitesForQuest(questId),
    getRewardsForQuest(questId),
  ]);

  const objectiveDtos: QuestObjectiveDto[] = await Promise.all(
    objectives.map(async (obj) => {
      const target = await resolveObjectiveTarget(obj);
      return {
        id: obj.id,
        objective_type: obj.objective_type as ObjectiveType,
        target_id: obj.target_id,
        target_name: target.name,
        target_icon_url: target.icon_url,
        target_quantity: obj.target_quantity,
        target_duration: obj.target_duration,
        description: obj.description,
        dialog_prompt: obj.dialog_prompt,
        dialog_response: obj.dialog_response,
        current_progress: 0,
        is_complete: false,
      };
    }),
  );

  const rewardDtos: QuestRewardDto[] = await Promise.all(
    rewards.map(async (r) => {
      const target = await resolveRewardTarget(r);
      return {
        reward_type: r.reward_type as RewardType,
        target_id: r.target_id,
        target_name: target.name,
        target_icon_url: target.icon_url,
        quantity: r.quantity,
      };
    }),
  );

  const prereqDtos: QuestPrerequisiteDto[] = await Promise.all(
    prereqs.map(async (p) => ({
      prereq_type: p.prereq_type as PrereqType,
      target_id: p.target_id,
      target_value: p.target_value,
      description: await resolvePrereqDescription(p),
    })),
  );

  return {
    id: quest.id,
    name: quest.name,
    description: quest.description,
    quest_type: quest.quest_type as QuestType,
    chain_id: quest.chain_id,
    chain_step: quest.chain_step,
    objectives: objectiveDtos,
    rewards: rewardDtos,
    prerequisites: prereqDtos,
  };
}

export async function buildCharacterQuestDto(
  charQuest: CharacterQuest,
): Promise<CharacterQuestDto | null> {
  const questDto = await buildQuestDefinitionDto(charQuest.quest_id);
  if (!questDto) return null;

  const progress = await getCharacterQuestProgress(charQuest.id);

  // Merge progress into objective DTOs
  const objectives: QuestObjectiveDto[] = questDto.objectives.map((obj) => {
    const prog = progress.find((p) => p.objective_id === obj.id);
    return {
      ...obj,
      current_progress: prog?.current_progress ?? 0,
      is_complete: prog?.is_complete ?? false,
    };
  });

  return {
    character_quest_id: charQuest.id,
    quest: questDto,
    status: charQuest.status as QuestStatus,
    accepted_at: charQuest.accepted_at.toISOString(),
    completed_at: charQuest.completed_at?.toISOString() ?? null,
    objectives,
  };
}

// ---------------------------------------------------------------------------
// Prerequisite checking
// ---------------------------------------------------------------------------

export async function checkPrerequisites(
  characterId: string,
  questId: number,
): Promise<{ met: boolean; unmet: string[] }> {
  const prereqs = await getPrerequisitesForQuest(questId);
  if (prereqs.length === 0) return { met: true, unmet: [] };

  const unmet: string[] = [];

  // Fetch character data once
  const charResult = await query<{
    level: number;
    class_id: number;
  }>('SELECT level, class_id FROM characters WHERE id = $1', [characterId]);
  const char = charResult.rows[0];
  if (!char) return { met: false, unmet: ['Character not found'] };

  for (const prereq of prereqs) {
    const desc = await resolvePrereqDescription(prereq);

    switch (prereq.prereq_type) {
      case 'min_level': {
        if (char.level < prereq.target_value) {
          unmet.push(desc);
        }
        break;
      }
      case 'has_item': {
        if (prereq.target_id != null) {
          const invResult = await query<{ total: string }>(
            `SELECT COALESCE(SUM(quantity), 0) as total FROM inventory_items
             WHERE character_id = $1 AND item_def_id = $2`,
            [characterId, prereq.target_id],
          );
          const total = parseInt(invResult.rows[0]?.total ?? '0', 10);
          if (total < prereq.target_value) {
            unmet.push(desc);
          }
        }
        break;
      }
      case 'completed_quest': {
        if (prereq.target_id != null) {
          const completed = await hasCompletedQuest(characterId, prereq.target_id);
          if (!completed) {
            unmet.push(desc);
          }
        }
        break;
      }
      case 'class_required': {
        if (prereq.target_id != null && char.class_id !== prereq.target_id) {
          unmet.push(desc);
        }
        break;
      }
    }
  }

  return { met: unmet.length === 0, unmet };
}

// ---------------------------------------------------------------------------
// Reward granting
// ---------------------------------------------------------------------------

export async function grantQuestRewards(
  session: AuthenticatedSession,
  characterId: string,
  questId: number,
): Promise<{ rewards: QuestRewardDto[]; newCrowns: number }> {
  const rewards = await getRewardsForQuest(questId);
  const grantedRewards: QuestRewardDto[] = [];
  let newCrowns = 0;

  for (const reward of rewards) {
    const target = await resolveRewardTarget(reward);

    switch (reward.reward_type) {
      case 'item': {
        if (reward.target_id != null) {
          await grantItemToCharacter(session, characterId, reward.target_id, reward.quantity);
        }
        break;
      }
      case 'xp': {
        await awardXp(characterId, reward.quantity);
        break;
      }
      case 'crowns': {
        newCrowns = await awardCrowns(characterId, reward.quantity);
        break;
      }
    }

    grantedRewards.push({
      reward_type: reward.reward_type as RewardType,
      target_id: reward.target_id,
      target_name: target.name,
      target_icon_url: target.icon_url,
      quantity: reward.quantity,
    });
  }

  log('info', 'quest-service', 'quest_rewards_granted', {
    characterId,
    questId,
    rewards: grantedRewards.map((r) => `${r.reward_type}:${r.quantity}`),
  });

  return { rewards: grantedRewards, newCrowns };
}

// ---------------------------------------------------------------------------
// Reset key generation (re-exported from queries for convenience)
// ---------------------------------------------------------------------------

export { getCurrentResetKey } from '../../db/queries/quests';

// ---------------------------------------------------------------------------
// Inventory space check for item rewards
// ---------------------------------------------------------------------------

export async function hasInventorySpaceForRewards(characterId: string, questId: number): Promise<boolean> {
  const rewards = await getRewardsForQuest(questId);
  const itemRewardCount = rewards.filter((r) => r.reward_type === 'item').length;
  if (itemRewardCount === 0) return true;

  const currentSlots = await getInventorySlotCount(characterId);
  // Conservative check: each item reward may need a new slot (worst case, no stacking)
  return (currentSlots + itemRewardCount) <= INVENTORY_CAPACITY;
}
