import { registerHandler } from '../../websocket/dispatcher';
import { sendToSession } from '../../websocket/server';
import type { AuthenticatedSession } from '../../websocket/server';
import { log } from '../../logger';
import {
  getQuestsForNpc,
  getActiveQuestsForCharacter,
  getCharacterQuestById,
  getActiveQuestCount,
  getObjectivesForQuest,
  getNpcGiversForQuest,
  hasActiveOrCompletedQuestForPeriod,
  createCharacterQuest,
  createCharacterQuestObjectives,
  completeCharacterQuest,
  abandonCharacterQuest,
  areAllObjectivesComplete,
  getCurrentResetKey,
  getPendingNpcDialogs,
  updateObjectiveProgress,
} from '../../db/queries/quests';
import {
  buildQuestDefinitionDto,
  buildCharacterQuestDto,
  checkPrerequisites,
  grantQuestRewards,
  hasInventorySpaceForRewards,
} from './quest-service';
import { QuestTracker } from './quest-tracker';
import { getInventoryWithDefinitions } from '../../db/queries/inventory';
import { getMinRodTierForItem, getRodTierByItemDefId } from '../../db/queries/fishing';
import { query } from '../../db/connection';
import { config } from '../../config';
import type {
  QuestListAvailablePayload,
  QuestAcceptPayload,
  QuestCompletePayload,
  QuestAbandonPayload,
  QuestNpcDialogsPayload,
  QuestTalkCompletePayload,
  QuestRejectionReason,
  InventorySlotDto,
  ItemCategory,
  WeaponSubtype,
} from '../../../../shared/protocol/index';

const MAX_ACTIVE_QUESTS = 25;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function reject(session: AuthenticatedSession, action: string, reason: QuestRejectionReason, details?: string): void {
  sendToSession(session, 'quest.rejected', { action, reason, details });
}

function itemIconUrl(iconFilename: string | null): string | null {
  if (!iconFilename) return null;
  return `${config.adminBaseUrl}/item-icons/${iconFilename}`;
}

async function buildFullInventorySlots(characterId: string): Promise<InventorySlotDto[]> {
  const rows = await getInventoryWithDefinitions(characterId);
  return rows.map((r) => ({
    slot_id: r.id,
    item_def_id: r.item_def_id,
    quantity: r.quantity,
    current_durability: r.current_durability ?? undefined,
    definition: {
      id: r.item_def_id,
      name: r.def_name,
      description: r.def_description ?? '',
      category: r.def_category as ItemCategory,
      weapon_subtype: (r.def_weapon_subtype as WeaponSubtype) ?? null,
      attack: r.def_attack,
      defence: r.def_defence,
      heal_power: r.def_heal_power,
      food_power: r.def_food_power,
      stack_size: r.def_stack_size,
      icon_url: itemIconUrl(r.def_icon_filename),
      max_mana: r.def_max_mana,
      mana_on_hit: r.def_mana_on_hit,
      mana_on_damage_taken: r.def_mana_on_damage_taken,
      mana_regen: r.def_mana_regen,
      dodge_chance: r.def_dodge_chance,
      crit_chance: r.def_crit_chance,
      crit_damage: r.def_crit_damage,
      tool_type: r.def_tool_type ?? null,
      max_durability: r.def_max_durability ?? null,
      power: r.def_power ?? null,
    },
  }));
}

// ---------------------------------------------------------------------------
// Daily fishing quest filtering helpers
// ---------------------------------------------------------------------------

const MAX_DAILY_FISHING_QUESTS = 2;

/** Get the player's equipped fishing rod tier (0 if no rod equipped). */
async function getPlayerRodTier(characterId: string): Promise<number> {
  const result = await query<{ item_def_id: number }>(
    `SELECT ii.item_def_id
     FROM inventory_items ii
     JOIN item_definitions d ON d.id = ii.item_def_id
     WHERE ii.character_id = $1
       AND ii.equipped_slot IS NOT NULL
       AND d.tool_type = 'fishing_rod'
     LIMIT 1`,
    [characterId],
  );
  const row = result.rows[0];
  if (!row) return 0;
  const tier = await getRodTierByItemDefId(row.item_def_id);
  return tier?.tier ?? 0;
}

/**
 * Check whether a daily quest is a fishing quest (has collect_item objectives
 * referencing items in the fishing_loot table) and whether the player's rod
 * tier is high enough to catch all required fish.
 *
 * Returns true if the quest is NOT a daily fishing quest, or if it IS one and
 * the player can catch all required fish.
 */
async function isDailyFishingQuestCatchable(
  questDef: { id: number; quest_type: string },
  playerRodTier: number,
): Promise<{ isFishingDaily: boolean; catchable: boolean }> {
  if (questDef.quest_type !== 'daily') return { isFishingDaily: false, catchable: true };

  const objectives = await getObjectivesForQuest(questDef.id);
  const collectObjectives = objectives.filter(
    (o) => o.objective_type === 'collect_item' && o.target_id != null,
  );

  if (collectObjectives.length === 0) return { isFishingDaily: false, catchable: true };

  // Check if ANY collect_item objective references a fish (item in fishing_loot)
  let hasFishObjective = false;
  for (const obj of collectObjectives) {
    const minTier = await getMinRodTierForItem(obj.target_id!);
    if (minTier != null) {
      hasFishObjective = true;
      if (playerRodTier < minTier) {
        return { isFishingDaily: true, catchable: false };
      }
    }
  }

  return { isFishingDaily: hasFishObjective, catchable: true };
}

// ---------------------------------------------------------------------------
// quest.list_available
// ---------------------------------------------------------------------------

async function handleQuestListAvailable(session: AuthenticatedSession, payload: unknown): Promise<void> {
  const { npc_id } = payload as QuestListAvailablePayload;
  const characterId = session.characterId;
  if (!characterId) { reject(session, 'list_available', 'NOT_AT_NPC', 'No character.'); return; }

  // Track talk_to_npc objectives
  const talkProgress = await QuestTracker.onNpcTalkedTo(characterId, npc_id);
  for (const p of talkProgress) {
    sendToSession(session, 'quest.progress', p);
  }

  const allQuestsForNpc = await getQuestsForNpc(npc_id);
  const activeCharQuests = await getActiveQuestsForCharacter(characterId);

  const available = [];
  const active = [];
  const completable = [];

  for (const quest of allQuestsForNpc) {
    const resetKey = getCurrentResetKey(quest.quest_type);

    // Check if player already has this quest active or completed for current period
    const alreadyExists = await hasActiveOrCompletedQuestForPeriod(characterId, quest.id, resetKey);

    // Is it currently active?
    const activeCharQuest = activeCharQuests.find((cq) => cq.quest_id === quest.id);

    if (activeCharQuest) {
      // Check if all objectives are complete
      const allComplete = await areAllObjectivesComplete(activeCharQuest.id);
      const dto = await buildCharacterQuestDto(activeCharQuest);
      if (!dto) continue;

      if (allComplete) {
        completable.push(dto);
      } else {
        active.push(dto);
      }
    } else if (!alreadyExists) {
      // Not active and not completed this period — check prerequisites
      const { met } = await checkPrerequisites(characterId, quest.id);
      if (met) {
        const dto = await buildQuestDefinitionDto(quest.id);
        if (dto) available.push(dto);
      }
    }
    // If alreadyExists but not active, it means completed this period — skip
  }

  // ── Filter daily fishing quests: show at most 2 that match player's rod tier ──
  const playerRodTier = await getPlayerRodTier(characterId);
  const filteredAvailable: typeof available = [];
  const eligibleFishingDailies: typeof available = [];

  for (const questDto of available) {
    const questDef = allQuestsForNpc.find((q) => q.id === questDto.id);
    if (!questDef) { filteredAvailable.push(questDto); continue; }

    const { isFishingDaily, catchable } = await isDailyFishingQuestCatchable(questDef, playerRodTier);
    if (!isFishingDaily) {
      filteredAvailable.push(questDto);
    } else if (catchable) {
      eligibleFishingDailies.push(questDto);
    }
    // If isFishingDaily && !catchable, skip it entirely
  }

  // Randomly select at most MAX_DAILY_FISHING_QUESTS from eligible fishing dailies
  if (eligibleFishingDailies.length <= MAX_DAILY_FISHING_QUESTS) {
    filteredAvailable.push(...eligibleFishingDailies);
  } else {
    // Fisher-Yates partial shuffle to pick random subset
    for (let i = eligibleFishingDailies.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [eligibleFishingDailies[i], eligibleFishingDailies[j]] = [eligibleFishingDailies[j]!, eligibleFishingDailies[i]!];
    }
    filteredAvailable.push(...eligibleFishingDailies.slice(0, MAX_DAILY_FISHING_QUESTS));
  }

  log('debug', 'quest', 'quest_list_available', {
    characterId,
    npcId: npc_id,
    available: filteredAvailable.length,
    active: active.length,
    completable: completable.length,
  });

  sendToSession(session, 'quest.available_list', {
    npc_id,
    available_quests: filteredAvailable,
    active_quests: active,
    completable_quests: completable,
  });
}

// ---------------------------------------------------------------------------
// quest.accept
// ---------------------------------------------------------------------------

async function handleQuestAccept(session: AuthenticatedSession, payload: unknown): Promise<void> {
  const { npc_id, quest_id } = payload as QuestAcceptPayload;
  const characterId = session.characterId;
  if (!characterId) { reject(session, 'accept', 'NOT_AT_NPC'); return; }

  // Verify quest exists and is assigned to this NPC
  const questDto = await buildQuestDefinitionDto(quest_id);
  if (!questDto) { reject(session, 'accept', 'QUEST_NOT_FOUND'); return; }

  const npcGivers = await getNpcGiversForQuest(quest_id);
  if (!npcGivers.some((g) => g.npc_id === npc_id)) {
    reject(session, 'accept', 'QUEST_NOT_FOUND', 'Quest not available from this NPC.');
    return;
  }

  // Check quest log limit
  const activeCount = await getActiveQuestCount(characterId);
  if (activeCount >= MAX_ACTIVE_QUESTS) {
    reject(session, 'accept', 'QUEST_LOG_FULL', `Maximum ${MAX_ACTIVE_QUESTS} active quests.`);
    return;
  }

  // Check if already active/completed for current period
  const resetKey = getCurrentResetKey(questDto.quest_type);
  const alreadyExists = await hasActiveOrCompletedQuestForPeriod(characterId, quest_id, resetKey);
  if (alreadyExists) {
    reject(session, 'accept', 'QUEST_ALREADY_ACTIVE');
    return;
  }

  // Check prerequisites
  const { met, unmet } = await checkPrerequisites(characterId, quest_id);
  if (!met) {
    reject(session, 'accept', 'PREREQUISITES_NOT_MET', `Unmet: ${unmet.join(', ')}`);
    return;
  }

  // Create character quest + objective rows
  const charQuest = await createCharacterQuest(characterId, quest_id, resetKey);
  const objectives = await getObjectivesForQuest(quest_id);
  await createCharacterQuestObjectives(charQuest.id, objectives.map((o) => o.id));

  const charQuestDto = await buildCharacterQuestDto(charQuest);
  if (!charQuestDto) { reject(session, 'accept', 'INVALID_REQUEST'); return; }

  log('info', 'quest', 'quest_accepted', {
    characterId,
    questId: quest_id,
    questName: questDto.name,
    charQuestId: charQuest.id,
  });

  sendToSession(session, 'quest.accepted', { quest: charQuestDto });

  // Check existing inventory against collect_item objectives so items
  // already in the player's possession count toward the new quest.
  try {
    const questProgress = await QuestTracker.onInventoryChanged(characterId);
    for (const p of questProgress) {
      sendToSession(session, 'quest.progress', p);
    }
  } catch (qErr) {
    log('warn', 'quest', 'post_accept_inventory_check_error', { characterId, err: qErr });
  }
}

// ---------------------------------------------------------------------------
// quest.complete (turn in)
// ---------------------------------------------------------------------------

async function handleQuestComplete(session: AuthenticatedSession, payload: unknown): Promise<void> {
  const { character_quest_id } = payload as QuestCompletePayload;
  const characterId = session.characterId;
  if (!characterId) { reject(session, 'complete', 'NOT_AT_NPC'); return; }

  const charQuest = await getCharacterQuestById(character_quest_id);
  if (!charQuest || charQuest.character_id !== characterId || charQuest.status !== 'active') {
    reject(session, 'complete', 'QUEST_NOT_FOUND');
    return;
  }

  // Check all objectives complete
  const allComplete = await areAllObjectivesComplete(character_quest_id);
  if (!allComplete) {
    reject(session, 'complete', 'QUEST_NOT_COMPLETABLE', 'Not all objectives are complete.');
    return;
  }

  // Check inventory space for item rewards
  const hasSpace = await hasInventorySpaceForRewards(characterId, charQuest.quest_id);
  if (!hasSpace) {
    reject(session, 'complete', 'INVENTORY_FULL', 'Free inventory space for quest rewards.');
    return;
  }

  // Grant rewards
  const { rewards, newCrowns } = await grantQuestRewards(session, characterId, charQuest.quest_id);

  // Mark completed
  await completeCharacterQuest(character_quest_id);

  // Rebuild inventory slots for response
  const updatedSlots = await buildFullInventorySlots(characterId);

  log('info', 'quest', 'quest_completed', {
    characterId,
    charQuestId: character_quest_id,
    questId: charQuest.quest_id,
  });

  sendToSession(session, 'quest.completed', {
    character_quest_id,
    rewards_granted: rewards,
    new_crowns: newCrowns,
    updated_slots: updatedSlots,
  });
}

// ---------------------------------------------------------------------------
// quest.abandon
// ---------------------------------------------------------------------------

async function handleQuestAbandon(session: AuthenticatedSession, payload: unknown): Promise<void> {
  const { character_quest_id } = payload as QuestAbandonPayload;
  const characterId = session.characterId;
  if (!characterId) { reject(session, 'abandon', 'INVALID_REQUEST'); return; }

  const charQuest = await getCharacterQuestById(character_quest_id);
  if (!charQuest || charQuest.character_id !== characterId || charQuest.status !== 'active') {
    reject(session, 'abandon', 'QUEST_NOT_FOUND');
    return;
  }

  await abandonCharacterQuest(character_quest_id);

  log('info', 'quest', 'quest_abandoned', {
    characterId,
    charQuestId: character_quest_id,
    questId: charQuest.quest_id,
  });

  sendToSession(session, 'quest.abandoned', { character_quest_id });
}

// ---------------------------------------------------------------------------
// quest.log
// ---------------------------------------------------------------------------

async function handleQuestLog(session: AuthenticatedSession, _payload: unknown): Promise<void> {
  const characterId = session.characterId;
  if (!characterId) { reject(session, 'log', 'INVALID_REQUEST'); return; }

  const activeQuests = await getActiveQuestsForCharacter(characterId);
  const questDtos = [];

  for (const cq of activeQuests) {
    const dto = await buildCharacterQuestDto(cq);
    if (dto) questDtos.push(dto);
  }

  sendToSession(session, 'quest.log', { active_quests: questDtos });
}

// ---------------------------------------------------------------------------
// quest.npc_dialogs — get pending talk_to_npc dialog options for any NPC
// ---------------------------------------------------------------------------

async function handleQuestNpcDialogs(session: AuthenticatedSession, payload: unknown): Promise<void> {
  const { npc_id } = payload as QuestNpcDialogsPayload;
  const characterId = session.characterId;
  if (!characterId) { reject(session, 'npc_dialogs', 'INVALID_REQUEST'); return; }

  const dialogs = await getPendingNpcDialogs(characterId, npc_id);

  sendToSession(session, 'quest.npc_dialogs', {
    npc_id,
    dialogs: dialogs.map((d) => ({
      character_quest_id: d.character_quest_id,
      quest_name: d.quest_name,
      objective_id: d.objective_id,
      dialog_prompt: d.dialog_prompt,
      dialog_response: d.dialog_response,
    })),
  });
}

// ---------------------------------------------------------------------------
// quest.talk_complete — player chose a quest dialog option, complete the objective
// ---------------------------------------------------------------------------

async function handleQuestTalkComplete(session: AuthenticatedSession, payload: unknown): Promise<void> {
  const { npc_id, character_quest_id, objective_id } = payload as QuestTalkCompletePayload;
  const characterId = session.characterId;
  if (!characterId) { reject(session, 'talk_complete', 'INVALID_REQUEST'); return; }

  // Verify the character quest belongs to this player and is active
  const charQuest = await getCharacterQuestById(character_quest_id);
  if (!charQuest || charQuest.character_id !== characterId || charQuest.status !== 'active') {
    reject(session, 'talk_complete', 'QUEST_NOT_FOUND');
    return;
  }

  // Verify this is a valid pending dialog for this NPC
  const dialogs = await getPendingNpcDialogs(characterId, npc_id);
  const dialog = dialogs.find((d) => d.character_quest_id === character_quest_id && d.objective_id === objective_id);
  if (!dialog) {
    reject(session, 'talk_complete', 'QUEST_NOT_FOUND', 'No pending dialog for this objective.');
    return;
  }

  // Mark objective complete
  await updateObjectiveProgress(character_quest_id, objective_id, 1, true);

  const questComplete = await areAllObjectivesComplete(character_quest_id);

  log('info', 'quest', 'quest_talk_completed', {
    characterId,
    charQuestId: character_quest_id,
    objectiveId: objective_id,
    npcId: npc_id,
    questComplete,
  });

  // Send the NPC's response + completion status
  sendToSession(session, 'quest.talk_completed', {
    character_quest_id,
    objective_id,
    dialog_response: dialog.dialog_response,
    quest_complete: questComplete,
  });

  // Also send a standard progress update so quest log/tracker update
  sendToSession(session, 'quest.progress', {
    character_quest_id,
    objective_id,
    current_progress: 1,
    target_quantity: 1,
    is_complete: true,
    quest_complete: questComplete,
  });
}

// ---------------------------------------------------------------------------
// Register handlers
// ---------------------------------------------------------------------------

export function registerQuestHandlers(): void {
  registerHandler('quest.list_available', handleQuestListAvailable);
  registerHandler('quest.accept', handleQuestAccept);
  registerHandler('quest.complete', handleQuestComplete);
  registerHandler('quest.abandon', handleQuestAbandon);
  registerHandler('quest.log', handleQuestLog);
  registerHandler('quest.npc_dialogs', handleQuestNpcDialogs);
  registerHandler('quest.talk_complete', handleQuestTalkComplete);
}
