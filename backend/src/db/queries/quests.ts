import { query } from '../connection';

// ---------------------------------------------------------------------------
// TypeScript interfaces for DB rows
// ---------------------------------------------------------------------------

export interface QuestDefinition {
  id: number;
  name: string;
  description: string;
  quest_type: string;
  sort_order: number;
  is_active: boolean;
  chain_id: string | null;
  chain_step: number | null;
  created_at: Date;
}

export interface QuestObjective {
  id: number;
  quest_id: number;
  objective_type: string;
  target_id: number | null;
  target_quantity: number;
  target_duration: number | null;
  description: string | null;
  dialog_prompt: string | null;
  dialog_response: string | null;
  sort_order: number;
}

export interface QuestPrerequisite {
  id: number;
  quest_id: number;
  prereq_type: string;
  target_id: number | null;
  target_value: number;
}

export interface QuestReward {
  id: number;
  quest_id: number;
  reward_type: string;
  target_id: number | null;
  quantity: number;
}

export interface QuestNpcGiver {
  quest_id: number;
  npc_id: number;
}

export interface CharacterQuest {
  id: number;
  character_id: string;
  quest_id: number;
  status: string;
  accepted_at: Date;
  completed_at: Date | null;
  reset_period_key: string | null;
}

export interface CharacterQuestObjective {
  id: number;
  character_quest_id: number;
  objective_id: number;
  current_progress: number;
  is_complete: boolean;
}

// ---------------------------------------------------------------------------
// Quest definition queries
// ---------------------------------------------------------------------------

export async function getQuestById(id: number): Promise<QuestDefinition | null> {
  const result = await query<QuestDefinition>(
    'SELECT * FROM quest_definitions WHERE id = $1',
    [id],
  );
  return result.rows[0] ?? null;
}

export async function getAllQuests(filters?: {
  quest_type?: string;
  npc_id?: number;
  is_active?: boolean;
}): Promise<QuestDefinition[]> {
  const conditions: string[] = [];
  const values: unknown[] = [];
  let paramIdx = 1;

  if (filters?.quest_type) {
    conditions.push(`qd.quest_type = $${paramIdx++}`);
    values.push(filters.quest_type);
  }
  if (filters?.is_active !== undefined) {
    conditions.push(`qd.is_active = $${paramIdx++}`);
    values.push(filters.is_active);
  }
  if (filters?.npc_id) {
    conditions.push(`EXISTS (SELECT 1 FROM quest_npc_givers qng WHERE qng.quest_id = qd.id AND qng.npc_id = $${paramIdx++})`);
    values.push(filters.npc_id);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await query<QuestDefinition>(
    `SELECT qd.* FROM quest_definitions qd ${where} ORDER BY qd.sort_order, qd.name`,
    values,
  );
  return result.rows;
}

export async function getQuestsForNpc(npcId: number): Promise<QuestDefinition[]> {
  const result = await query<QuestDefinition>(
    `SELECT qd.* FROM quest_definitions qd
     JOIN quest_npc_givers qng ON qng.quest_id = qd.id
     WHERE qng.npc_id = $1 AND qd.is_active = true
     ORDER BY qd.sort_order, qd.name`,
    [npcId],
  );
  return result.rows;
}

export async function createQuestDefinition(data: {
  name: string;
  description: string;
  quest_type: string;
  sort_order?: number;
  is_active?: boolean;
  chain_id?: string | null;
  chain_step?: number | null;
}): Promise<QuestDefinition> {
  const result = await query<QuestDefinition>(
    `INSERT INTO quest_definitions (name, description, quest_type, sort_order, is_active, chain_id, chain_step)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [data.name, data.description, data.quest_type, data.sort_order ?? 0, data.is_active ?? true, data.chain_id ?? null, data.chain_step ?? null],
  );
  return result.rows[0]!;
}

export async function updateQuestDefinition(
  id: number,
  data: {
    name?: string;
    description?: string;
    quest_type?: string;
    sort_order?: number;
    is_active?: boolean;
    chain_id?: string | null;
    chain_step?: number | null;
  },
): Promise<QuestDefinition | null> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let paramIdx = 1;

  if (data.name !== undefined) { fields.push(`name = $${paramIdx++}`); values.push(data.name); }
  if (data.description !== undefined) { fields.push(`description = $${paramIdx++}`); values.push(data.description); }
  if (data.quest_type !== undefined) { fields.push(`quest_type = $${paramIdx++}`); values.push(data.quest_type); }
  if (data.sort_order !== undefined) { fields.push(`sort_order = $${paramIdx++}`); values.push(data.sort_order); }
  if (data.is_active !== undefined) { fields.push(`is_active = $${paramIdx++}`); values.push(data.is_active); }
  if (data.chain_id !== undefined) { fields.push(`chain_id = $${paramIdx++}`); values.push(data.chain_id); }
  if (data.chain_step !== undefined) { fields.push(`chain_step = $${paramIdx++}`); values.push(data.chain_step); }

  if (fields.length === 0) return getQuestById(id);

  values.push(id);
  const result = await query<QuestDefinition>(
    `UPDATE quest_definitions SET ${fields.join(', ')} WHERE id = $${paramIdx} RETURNING *`,
    values,
  );
  return result.rows[0] ?? null;
}

export async function deleteQuestDefinition(id: number): Promise<void> {
  // Delete player quest tracking first (handles DBs where FK lacks CASCADE)
  await query('DELETE FROM character_quests WHERE quest_id = $1', [id]);
  await query('DELETE FROM quest_definitions WHERE id = $1', [id]);
}

// ---------------------------------------------------------------------------
// Objective queries
// ---------------------------------------------------------------------------

export async function getObjectivesForQuest(questId: number): Promise<QuestObjective[]> {
  const result = await query<QuestObjective>(
    'SELECT * FROM quest_objectives WHERE quest_id = $1 ORDER BY sort_order, id',
    [questId],
  );
  return result.rows;
}

export async function replaceObjectives(
  questId: number,
  objectives: { objective_type: string; target_id?: number | null; target_quantity: number; target_duration?: number | null; description?: string | null; dialog_prompt?: string | null; dialog_response?: string | null; sort_order?: number }[],
): Promise<void> {
  await query('DELETE FROM quest_objectives WHERE quest_id = $1', [questId]);
  for (let i = 0; i < objectives.length; i++) {
    const obj = objectives[i]!;
    await query(
      `INSERT INTO quest_objectives (quest_id, objective_type, target_id, target_quantity, target_duration, description, dialog_prompt, dialog_response, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [questId, obj.objective_type, obj.target_id ?? null, obj.target_quantity, obj.target_duration ?? null, obj.description ?? null, obj.dialog_prompt ?? null, obj.dialog_response ?? null, obj.sort_order ?? i],
    );
  }
}

// ---------------------------------------------------------------------------
// Prerequisite queries
// ---------------------------------------------------------------------------

export async function getPrerequisitesForQuest(questId: number): Promise<QuestPrerequisite[]> {
  const result = await query<QuestPrerequisite>(
    'SELECT * FROM quest_prerequisites WHERE quest_id = $1 ORDER BY id',
    [questId],
  );
  return result.rows;
}

export async function replacePrerequisites(
  questId: number,
  prereqs: { prereq_type: string; target_id?: number | null; target_value: number }[],
): Promise<void> {
  await query('DELETE FROM quest_prerequisites WHERE quest_id = $1', [questId]);
  for (const p of prereqs) {
    await query(
      `INSERT INTO quest_prerequisites (quest_id, prereq_type, target_id, target_value)
       VALUES ($1, $2, $3, $4)`,
      [questId, p.prereq_type, p.target_id ?? null, p.target_value],
    );
  }
}

// ---------------------------------------------------------------------------
// Reward queries
// ---------------------------------------------------------------------------

export async function getRewardsForQuest(questId: number): Promise<QuestReward[]> {
  const result = await query<QuestReward>(
    'SELECT * FROM quest_rewards WHERE quest_id = $1 ORDER BY id',
    [questId],
  );
  return result.rows;
}

export async function replaceRewards(
  questId: number,
  rewards: { reward_type: string; target_id?: number | null; quantity: number }[],
): Promise<void> {
  await query('DELETE FROM quest_rewards WHERE quest_id = $1', [questId]);
  for (const r of rewards) {
    await query(
      `INSERT INTO quest_rewards (quest_id, reward_type, target_id, quantity)
       VALUES ($1, $2, $3, $4)`,
      [questId, r.reward_type, r.target_id ?? null, r.quantity],
    );
  }
}

// ---------------------------------------------------------------------------
// NPC giver queries
// ---------------------------------------------------------------------------

export async function getNpcGiversForQuest(questId: number): Promise<QuestNpcGiver[]> {
  const result = await query<QuestNpcGiver>(
    'SELECT quest_id, npc_id FROM quest_npc_givers WHERE quest_id = $1 ORDER BY npc_id',
    [questId],
  );
  return result.rows;
}

export async function replaceNpcGivers(questId: number, npcIds: number[]): Promise<void> {
  await query('DELETE FROM quest_npc_givers WHERE quest_id = $1', [questId]);
  for (const npcId of npcIds) {
    await query(
      'INSERT INTO quest_npc_givers (quest_id, npc_id) VALUES ($1, $2)',
      [questId, npcId],
    );
  }
  // Auto-set is_quest_giver flag on assigned NPCs
  if (npcIds.length > 0) {
    await query(
      `UPDATE npcs SET is_quest_giver = true WHERE id = ANY($1::int[])`,
      [npcIds],
    );
  }
}

// ---------------------------------------------------------------------------
// Character quest queries
// ---------------------------------------------------------------------------

export async function getActiveQuestsForCharacter(characterId: string): Promise<CharacterQuest[]> {
  const result = await query<CharacterQuest>(
    `SELECT * FROM character_quests WHERE character_id = $1 AND status = 'active' ORDER BY accepted_at`,
    [characterId],
  );
  return result.rows;
}

export async function getCharacterQuestById(id: number): Promise<CharacterQuest | null> {
  const result = await query<CharacterQuest>(
    'SELECT * FROM character_quests WHERE id = $1',
    [id],
  );
  return result.rows[0] ?? null;
}

export async function getActiveQuestCount(characterId: string): Promise<number> {
  const result = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM character_quests WHERE character_id = $1 AND status = 'active'`,
    [characterId],
  );
  return parseInt(result.rows[0]?.count ?? '0', 10);
}

export async function hasCompletedQuest(characterId: string, questId: number): Promise<boolean> {
  const result = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM character_quests WHERE character_id = $1 AND quest_id = $2 AND status = 'completed'`,
    [characterId, questId],
  );
  return parseInt(result.rows[0]?.count ?? '0', 10) > 0;
}

export async function hasActiveOrCompletedQuestForPeriod(
  characterId: string,
  questId: number,
  resetKey: string | null,
): Promise<boolean> {
  if (resetKey === null) {
    // One-time quests: check for any row
    const result = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM character_quests
       WHERE character_id = $1 AND quest_id = $2 AND reset_period_key IS NULL`,
      [characterId, questId],
    );
    return parseInt(result.rows[0]?.count ?? '0', 10) > 0;
  }

  const result = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM character_quests
     WHERE character_id = $1 AND quest_id = $2 AND reset_period_key = $3
       AND status IN ('active', 'completed')`,
    [characterId, questId, resetKey],
  );
  return parseInt(result.rows[0]?.count ?? '0', 10) > 0;
}

export async function createCharacterQuest(
  characterId: string,
  questId: number,
  resetPeriodKey: string | null,
): Promise<CharacterQuest> {
  const result = await query<CharacterQuest>(
    `INSERT INTO character_quests (character_id, quest_id, reset_period_key)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [characterId, questId, resetPeriodKey],
  );
  return result.rows[0]!;
}

export async function completeCharacterQuest(id: number): Promise<CharacterQuest | null> {
  const result = await query<CharacterQuest>(
    `UPDATE character_quests SET status = 'completed', completed_at = now()
     WHERE id = $1 AND status = 'active'
     RETURNING *`,
    [id],
  );
  return result.rows[0] ?? null;
}

export async function abandonCharacterQuest(id: number): Promise<CharacterQuest | null> {
  const result = await query<CharacterQuest>(
    `UPDATE character_quests SET status = 'abandoned'
     WHERE id = $1 AND status = 'active'
     RETURNING *`,
    [id],
  );
  return result.rows[0] ?? null;
}

// ---------------------------------------------------------------------------
// Character quest objective queries
// ---------------------------------------------------------------------------

export async function getCharacterQuestProgress(charQuestId: number): Promise<CharacterQuestObjective[]> {
  const result = await query<CharacterQuestObjective>(
    'SELECT * FROM character_quest_objectives WHERE character_quest_id = $1 ORDER BY objective_id',
    [charQuestId],
  );
  return result.rows;
}

export async function createCharacterQuestObjectives(
  charQuestId: number,
  objectiveIds: number[],
): Promise<void> {
  for (const objId of objectiveIds) {
    await query(
      'INSERT INTO character_quest_objectives (character_quest_id, objective_id) VALUES ($1, $2)',
      [charQuestId, objId],
    );
  }
}

export async function updateObjectiveProgress(
  charQuestId: number,
  objectiveId: number,
  newProgress: number,
  isComplete: boolean,
): Promise<void> {
  await query(
    `UPDATE character_quest_objectives
     SET current_progress = $3, is_complete = $4
     WHERE character_quest_id = $1 AND objective_id = $2`,
    [charQuestId, objectiveId, newProgress, isComplete],
  );
}

/**
 * Find all active character quests that have an objective matching the given type.
 * Optionally filter by target_id for specific targets (e.g., a specific monster).
 */
export async function getCharacterQuestsWithObjectiveType(
  characterId: string,
  objectiveType: string,
  targetId?: number,
): Promise<{
  character_quest_id: number;
  quest_id: number;
  objective_id: number;
  objective_type: string;
  target_id: number | null;
  target_quantity: number;
  target_duration: number | null;
  current_progress: number;
  is_complete: boolean;
}[]> {
  const conditions = [
    `cq.character_id = $1`,
    `cq.status = 'active'`,
    `qo.objective_type = $2`,
  ];
  const values: unknown[] = [characterId, objectiveType];

  if (targetId !== undefined) {
    conditions.push(`qo.target_id = $3`);
    values.push(targetId);
  }

  const result = await query<{
    character_quest_id: number;
    quest_id: number;
    objective_id: number;
    objective_type: string;
    target_id: number | null;
    target_quantity: number;
    target_duration: number | null;
    current_progress: number;
    is_complete: boolean;
  }>(
    `SELECT cq.id AS character_quest_id, cq.quest_id, qo.id AS objective_id,
            qo.objective_type, qo.target_id, qo.target_quantity, qo.target_duration,
            cqo.current_progress, cqo.is_complete
     FROM character_quests cq
     JOIN quest_objectives qo ON qo.quest_id = cq.quest_id
     JOIN character_quest_objectives cqo ON cqo.character_quest_id = cq.id AND cqo.objective_id = qo.id
     WHERE ${conditions.join(' AND ')}`,
    values,
  );
  return result.rows;
}

/**
 * Check if all objectives for a character quest are complete.
 */
export async function areAllObjectivesComplete(charQuestId: number): Promise<boolean> {
  const result = await query<{ incomplete: string }>(
    `SELECT COUNT(*) as incomplete FROM character_quest_objectives
     WHERE character_quest_id = $1 AND is_complete = false`,
    [charQuestId],
  );
  return parseInt(result.rows[0]?.incomplete ?? '1', 10) === 0;
}

// ---------------------------------------------------------------------------
// NPC dialog queries (for talk_to_npc objectives)
// ---------------------------------------------------------------------------

export interface PendingNpcDialog {
  character_quest_id: number;
  quest_id: number;
  quest_name: string;
  objective_id: number;
  dialog_prompt: string;
  dialog_response: string;
}

/**
 * Find active talk_to_npc objectives targeting a specific NPC
 * that have dialog_prompt/dialog_response defined and are not yet complete.
 */
export async function getPendingNpcDialogs(
  characterId: string,
  npcId: number,
): Promise<PendingNpcDialog[]> {
  const result = await query<PendingNpcDialog>(
    `SELECT cq.id AS character_quest_id, cq.quest_id, qd.name AS quest_name,
            qo.id AS objective_id, qo.dialog_prompt, qo.dialog_response
     FROM character_quests cq
     JOIN quest_definitions qd ON qd.id = cq.quest_id
     JOIN quest_objectives qo ON qo.quest_id = cq.quest_id
     JOIN character_quest_objectives cqo ON cqo.character_quest_id = cq.id AND cqo.objective_id = qo.id
     WHERE cq.character_id = $1
       AND cq.status = 'active'
       AND qo.objective_type = 'talk_to_npc'
       AND qo.target_id = $2
       AND qo.dialog_prompt IS NOT NULL
       AND qo.dialog_response IS NOT NULL
       AND cqo.is_complete = false`,
    [characterId, npcId],
  );
  return result.rows;
}

// ---------------------------------------------------------------------------
// Reset period key helpers
// ---------------------------------------------------------------------------

export function getCurrentResetKey(questType: string): string | null {
  const now = new Date();

  switch (questType) {
    case 'daily': {
      return now.toISOString().slice(0, 10); // 'YYYY-MM-DD'
    }
    case 'weekly': {
      // ISO week: get Thursday of this week to determine ISO week number
      const d = new Date(now);
      d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
      const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
      const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
      return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
    }
    case 'monthly': {
      return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    }
    case 'repeatable': {
      return now.toISOString(); // always unique
    }
    default:
      return null; // main, side — one-time
  }
}
