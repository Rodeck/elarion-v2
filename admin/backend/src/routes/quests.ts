import { Router, Request, Response } from 'express';
import { query } from '../../../../backend/src/db/connection';
import {
  getAllQuests,
  getQuestById,
  getObjectivesForQuest,
  getPrerequisitesForQuest,
  getRewardsForQuest,
  getNpcGiversForQuest,
  createQuestDefinition,
  updateQuestDefinition,
  deleteQuestDefinition,
  replaceObjectives,
  replacePrerequisites,
  replaceRewards,
  replaceNpcGivers,
  type QuestDefinition,
} from '../../../../backend/src/db/queries/quests';

export const questsRouter = Router();

function log(level: string, event: string, extra: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ level, event, timestamp: new Date().toISOString(), ...extra }));
}

// ---------------------------------------------------------------------------
// Response builder
// ---------------------------------------------------------------------------

interface QuestResponse {
  id: number;
  name: string;
  description: string;
  quest_type: string;
  sort_order: number;
  is_active: boolean;
  chain_id: string | null;
  chain_step: number | null;
  created_at: Date;
  objectives: { id: number; objective_type: string; target_id: number | null; target_quantity: number; target_duration: number | null; description: string | null; sort_order: number }[];
  prerequisites: { id: number; prereq_type: string; target_id: number | null; target_value: number }[];
  rewards: { id: number; reward_type: string; target_id: number | null; quantity: number }[];
  npc_ids: number[];
}

async function buildQuestResponse(quest: QuestDefinition): Promise<QuestResponse> {
  const [objectives, prerequisites, rewards, npcGivers] = await Promise.all([
    getObjectivesForQuest(quest.id),
    getPrerequisitesForQuest(quest.id),
    getRewardsForQuest(quest.id),
    getNpcGiversForQuest(quest.id),
  ]);

  return {
    id: quest.id,
    name: quest.name,
    description: quest.description,
    quest_type: quest.quest_type,
    sort_order: quest.sort_order,
    is_active: quest.is_active,
    chain_id: quest.chain_id,
    chain_step: quest.chain_step,
    created_at: quest.created_at,
    objectives: objectives.map((o) => ({
      id: o.id,
      objective_type: o.objective_type,
      target_id: o.target_id,
      target_quantity: o.target_quantity,
      target_duration: o.target_duration,
      description: o.description,
      dialog_prompt: o.dialog_prompt,
      dialog_response: o.dialog_response,
      sort_order: o.sort_order,
    })),
    prerequisites: prerequisites.map((p) => ({
      id: p.id,
      prereq_type: p.prereq_type,
      target_id: p.target_id,
      target_value: p.target_value,
    })),
    rewards: rewards.map((r) => ({
      id: r.id,
      reward_type: r.reward_type,
      target_id: r.target_id,
      quantity: r.quantity,
    })),
    npc_ids: npcGivers.map((g) => g.npc_id),
  };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const VALID_QUEST_TYPES = ['main', 'side', 'daily', 'weekly', 'monthly', 'repeatable'];
const VALID_OBJECTIVE_TYPES = ['kill_monster', 'collect_item', 'craft_item', 'spend_crowns', 'gather_resource', 'reach_level', 'visit_location', 'talk_to_npc'];
const VALID_PREREQ_TYPES = ['min_level', 'has_item', 'completed_quest', 'class_required'];
const VALID_REWARD_TYPES = ['item', 'xp', 'crowns', 'squire'];

// ─── GET /api/quests ──────────────────────────────────────────────────────────

questsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const filters: { quest_type?: string; npc_id?: number; is_active?: boolean } = {};

    const typeParam = req.query['type'] as string | undefined;
    if (typeParam && VALID_QUEST_TYPES.includes(typeParam)) filters.quest_type = typeParam;

    const npcParam = req.query['npc_id'] as string | undefined;
    if (npcParam) {
      const n = parseInt(npcParam, 10);
      if (!isNaN(n)) filters.npc_id = n;
    }

    const activeParam = req.query['active'] as string | undefined;
    if (activeParam === 'true') filters.is_active = true;
    if (activeParam === 'false') filters.is_active = false;

    const quests = await getAllQuests(filters);
    const response: QuestResponse[] = [];
    for (const q of quests) {
      response.push(await buildQuestResponse(q));
    }

    log('info', 'quests_listed', { admin: req.username, count: response.length });
    return res.json(response);
  } catch (err) {
    log('error', 'quests_list_failed', { admin: req.username, error: String(err) });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/quests/catalog ──────────────────────────────────────────────────

questsRouter.get('/catalog', (_req: Request, res: Response) => {
  return res.json({
    version: '1.0',
    quest_types: {
      main: { description: 'One-time story quest. Cannot be repeated.', repeatable: false },
      side: { description: 'One-time side quest. Cannot be repeated.', repeatable: false },
      daily: { description: 'Resets every day at midnight UTC.', repeatable: true, reset: 'daily' },
      weekly: { description: 'Resets every Monday at midnight UTC.', repeatable: true, reset: 'weekly' },
      monthly: { description: 'Resets on the 1st of each month at midnight UTC.', repeatable: true, reset: 'monthly' },
      repeatable: { description: 'Can be accepted again immediately after completion.', repeatable: true },
    },
    objective_types: {
      kill_monster: { description: 'Kill a specific monster type a number of times.', parameters: { target_id: 'monster ID (from GET /api/monsters)', target_quantity: 'number of kills required' }, example: { objective_type: 'kill_monster', target_id: 3, target_quantity: 5 } },
      collect_item: { description: 'Have a specific item in inventory. Checked on acceptance and when inventory changes. Progress decreases if items are consumed/dropped.', parameters: { target_id: 'item_definition ID (from GET /api/items)', target_quantity: 'quantity needed' }, example: { objective_type: 'collect_item', target_id: 12, target_quantity: 3 } },
      craft_item: { description: 'Craft a specific item via an NPC crafting station.', parameters: { target_id: 'item_definition ID', target_quantity: 'number to craft' }, example: { objective_type: 'craft_item', target_id: 7, target_quantity: 2 } },
      spend_crowns: { description: 'Spend a total of X crowns (cumulative during quest).', parameters: { target_id: null, target_quantity: 'total crowns to spend' }, example: { objective_type: 'spend_crowns', target_quantity: 100 } },
      gather_resource: { description: 'Complete gathering sessions at a specific building.', parameters: { target_id: 'building ID', target_quantity: 'number of successful sessions', target_duration: 'optional min duration in seconds' }, example: { objective_type: 'gather_resource', target_id: 5, target_quantity: 3 } },
      reach_level: { description: 'Reach a specific character level.', parameters: { target_id: null, target_quantity: 'level to reach' }, example: { objective_type: 'reach_level', target_quantity: 10 } },
      visit_location: { description: 'Enter a specific zone.', parameters: { target_id: 'zone_id (from map_zones)', target_quantity: 1 }, example: { objective_type: 'visit_location', target_id: 2, target_quantity: 1 } },
      talk_to_npc: { description: 'Talk to a specific NPC. Set dialog_prompt (what player says) and dialog_response (what NPC replies) to create a custom dialogue option that completes the objective when chosen.', parameters: { target_id: 'NPC ID (from GET /api/npcs)', target_quantity: 1, dialog_prompt: 'text the player chooses as dialogue option', dialog_response: 'text the NPC replies with' }, example: { objective_type: 'talk_to_npc', target_id: 4, target_quantity: 1, dialog_prompt: 'Borin sent me to ask about the shipment', dialog_response: 'Ah yes! Tell Borin the iron will arrive by morning.' } },
    },
    prerequisite_types: {
      min_level: { description: 'Player must be at least level X.', target_id: null, target_value: 'minimum level' },
      has_item: { description: 'Player must have item X in inventory.', target_id: 'item_definition ID', target_value: 'quantity' },
      completed_quest: { description: 'Player must have completed quest X. Used for chain quests.', target_id: 'quest_definition ID', target_value: 1 },
      class_required: { description: 'Player must be of class X.', target_id: 'class_id', target_value: 1 },
    },
    reward_types: {
      item: { description: 'Grant item(s) to player.', target_id: 'item_definition ID', quantity: 'number of items' },
      xp: { description: 'Grant experience points.', target_id: null, quantity: 'XP amount' },
      crowns: { description: 'Grant crowns (currency).', target_id: null, quantity: 'crowns amount' },
      squire: { description: 'Grant a squire to the player.', target_id: 'squire_definition ID', quantity: 'squire level (1–20)' },
    },
    chain_quests: {
      description: 'Set chain_id to a shared string and chain_step to ordering (1, 2, 3). Use completed_quest prerequisites to enforce ordering.',
      example: {
        quest_1: { chain_id: 'blacksmith_apprentice', chain_step: 1, prerequisites: [] },
        quest_2: { chain_id: 'blacksmith_apprentice', chain_step: 2, prerequisites: [{ prereq_type: 'completed_quest', target_id: '<quest_1_id>' }] },
      },
    },
    api_endpoints: {
      list: 'GET /api/quests?type=daily&npc_id=5&active=true',
      get: 'GET /api/quests/:id',
      create: 'POST /api/quests',
      update: 'PUT /api/quests/:id',
      delete: 'DELETE /api/quests/:id',
      catalog: 'GET /api/quests/catalog',
      monsters: 'GET /api/monsters',
      items: 'GET /api/items',
      npcs: 'GET /api/npcs',
    },
  });
});

// ─── GET /api/quests/:id ──────────────────────────────────────────────────────

questsRouter.get('/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id!, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid quest id' });
  try {
    const quest = await getQuestById(id);
    if (!quest) return res.status(404).json({ error: 'Quest not found' });
    log('info', 'quest_fetched', { admin: req.username, quest_id: id });
    return res.json(await buildQuestResponse(quest));
  } catch (err) {
    log('error', 'quest_fetch_failed', { admin: req.username, quest_id: id, error: String(err) });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/quests ─────────────────────────────────────────────────────────

questsRouter.post('/', async (req: Request, res: Response) => {
  const body = req.body as Record<string, unknown>;

  const name = body['name'] as string | undefined;
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'name is required' });
  }
  const description = body['description'] as string | undefined;
  if (!description || typeof description !== 'string' || !description.trim()) {
    return res.status(400).json({ error: 'description is required' });
  }
  const questType = body['quest_type'] as string | undefined;
  if (!questType || !VALID_QUEST_TYPES.includes(questType)) {
    return res.status(400).json({ error: `quest_type must be one of: ${VALID_QUEST_TYPES.join(', ')}` });
  }

  // Validate objectives
  const objectives = body['objectives'] as { objective_type: string; target_id?: number | null; target_quantity: number; target_duration?: number | null; description?: string | null; sort_order?: number }[] | undefined;
  if (!objectives || !Array.isArray(objectives) || objectives.length === 0) {
    return res.status(400).json({ error: 'At least one objective is required' });
  }
  for (const obj of objectives) {
    if (!obj.objective_type || !VALID_OBJECTIVE_TYPES.includes(obj.objective_type)) {
      return res.status(400).json({ error: `Invalid objective_type: ${obj.objective_type}. Must be one of: ${VALID_OBJECTIVE_TYPES.join(', ')}` });
    }
    if (!obj.target_quantity || obj.target_quantity < 1) {
      return res.status(400).json({ error: 'Each objective must have a positive target_quantity' });
    }
  }

  // Validate prerequisites (optional)
  const prerequisites = body['prerequisites'] as { prereq_type: string; target_id?: number | null; target_value: number }[] | undefined;
  if (prerequisites && !Array.isArray(prerequisites)) {
    return res.status(400).json({ error: 'prerequisites must be an array' });
  }
  if (prerequisites) {
    for (const p of prerequisites) {
      if (!p.prereq_type || !VALID_PREREQ_TYPES.includes(p.prereq_type)) {
        return res.status(400).json({ error: `Invalid prereq_type: ${p.prereq_type}` });
      }
    }
  }

  // Validate rewards (optional)
  const rewards = body['rewards'] as { reward_type: string; target_id?: number | null; quantity: number }[] | undefined;
  if (rewards && !Array.isArray(rewards)) {
    return res.status(400).json({ error: 'rewards must be an array' });
  }
  if (rewards) {
    for (const r of rewards) {
      if (!r.reward_type || !VALID_REWARD_TYPES.includes(r.reward_type)) {
        return res.status(400).json({ error: `Invalid reward_type: ${r.reward_type}` });
      }
      if (!r.quantity || r.quantity < 1) {
        return res.status(400).json({ error: 'Each reward must have a positive quantity' });
      }
      if (r.reward_type === 'squire') {
        if (!r.target_id || !Number.isInteger(r.target_id) || r.target_id < 1) {
          return res.status(400).json({ error: 'squire reward requires target_id (squire_def_id) as a positive integer' });
        }
        if (!Number.isInteger(r.quantity) || r.quantity < 1 || r.quantity > 20) {
          return res.status(400).json({ error: 'squire reward quantity (squire level) must be 1–20' });
        }
        const squireRow = await query<{ id: number }>('SELECT id FROM squire_definitions WHERE id = $1', [r.target_id]);
        if (squireRow.rows.length === 0) {
          return res.status(400).json({ error: `squire reward target_id ${r.target_id} references a non-existent squire definition` });
        }
      }
    }
  }

  // NPC IDs (optional)
  const npcIds = body['npc_ids'] as number[] | undefined;
  if (npcIds && !Array.isArray(npcIds)) {
    return res.status(400).json({ error: 'npc_ids must be an array of numbers' });
  }

  try {
    const quest = await createQuestDefinition({
      name: name.trim(),
      description: description.trim(),
      quest_type: questType,
      sort_order: body['sort_order'] != null ? Number(body['sort_order']) : undefined,
      is_active: body['is_active'] != null ? Boolean(body['is_active']) : undefined,
      chain_id: body['chain_id'] ? String(body['chain_id']).trim() : null,
      chain_step: body['chain_step'] != null ? Number(body['chain_step']) : null,
    });

    await replaceObjectives(quest.id, objectives);

    if (prerequisites && prerequisites.length > 0) {
      await replacePrerequisites(quest.id, prerequisites);
    }
    if (rewards && rewards.length > 0) {
      await replaceRewards(quest.id, rewards);
    }
    if (npcIds && npcIds.length > 0) {
      await replaceNpcGivers(quest.id, npcIds);
    }

    log('info', 'quest_created', { admin: req.username, quest_id: quest.id, name: quest.name });
    return res.status(201).json(await buildQuestResponse(quest));
  } catch (err) {
    const errStr = String(err);
    if (errStr.includes('unique') || errStr.includes('duplicate')) {
      return res.status(409).json({ error: 'Quest name already exists' });
    }
    log('error', 'quest_create_failed', { admin: req.username, error: errStr });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── PUT /api/quests/:id ──────────────────────────────────────────────────────

questsRouter.put('/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id!, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid quest id' });

  const existing = await getQuestById(id);
  if (!existing) return res.status(404).json({ error: 'Quest not found' });

  const body = req.body as Record<string, unknown>;

  const updateData: Record<string, unknown> = {};
  if (body['name'] !== undefined) {
    const v = body['name'] as string;
    if (!v || !v.trim()) return res.status(400).json({ error: 'name cannot be empty' });
    updateData['name'] = v.trim();
  }
  if (body['description'] !== undefined) {
    const v = body['description'] as string;
    if (!v || !v.trim()) return res.status(400).json({ error: 'description cannot be empty' });
    updateData['description'] = v.trim();
  }
  if (body['quest_type'] !== undefined) {
    const v = body['quest_type'] as string;
    if (!VALID_QUEST_TYPES.includes(v)) return res.status(400).json({ error: `Invalid quest_type: ${v}` });
    updateData['quest_type'] = v;
  }
  if (body['sort_order'] !== undefined) updateData['sort_order'] = Number(body['sort_order']);
  if (body['is_active'] !== undefined) updateData['is_active'] = Boolean(body['is_active']);
  if (body['chain_id'] !== undefined) updateData['chain_id'] = body['chain_id'] ? String(body['chain_id']).trim() : null;
  if (body['chain_step'] !== undefined) updateData['chain_step'] = body['chain_step'] != null ? Number(body['chain_step']) : null;

  try {
    const updated = await updateQuestDefinition(id, updateData as Parameters<typeof updateQuestDefinition>[1]);
    if (!updated) return res.status(404).json({ error: 'Quest not found' });

    // Replace child collections if provided
    if (body['objectives'] !== undefined) {
      const objectives = body['objectives'] as { objective_type: string; target_id?: number | null; target_quantity: number; target_duration?: number | null; description?: string | null; sort_order?: number }[];
      if (!Array.isArray(objectives) || objectives.length === 0) {
        return res.status(400).json({ error: 'At least one objective is required' });
      }
      for (const obj of objectives) {
        if (!obj.objective_type || !VALID_OBJECTIVE_TYPES.includes(obj.objective_type)) {
          return res.status(400).json({ error: `Invalid objective_type: ${obj.objective_type}` });
        }
      }
      await replaceObjectives(id, objectives);
    }

    if (body['prerequisites'] !== undefined) {
      const prerequisites = body['prerequisites'] as { prereq_type: string; target_id?: number | null; target_value: number }[];
      if (!Array.isArray(prerequisites)) return res.status(400).json({ error: 'prerequisites must be an array' });
      await replacePrerequisites(id, prerequisites);
    }

    if (body['rewards'] !== undefined) {
      const rewards = body['rewards'] as { reward_type: string; target_id?: number | null; quantity: number }[];
      if (!Array.isArray(rewards)) return res.status(400).json({ error: 'rewards must be an array' });
      await replaceRewards(id, rewards);
    }

    if (body['npc_ids'] !== undefined) {
      const npcIds = body['npc_ids'] as number[];
      if (!Array.isArray(npcIds)) return res.status(400).json({ error: 'npc_ids must be an array' });
      await replaceNpcGivers(id, npcIds);
    }

    log('info', 'quest_updated', { admin: req.username, quest_id: id, fields_changed: Object.keys(updateData) });
    return res.json(await buildQuestResponse(updated));
  } catch (err) {
    const errStr = String(err);
    if (errStr.includes('unique') || errStr.includes('duplicate')) {
      return res.status(409).json({ error: 'Quest name already exists' });
    }
    log('error', 'quest_update_failed', { admin: req.username, quest_id: id, error: errStr });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── DELETE /api/quests/:id ───────────────────────────────────────────────────

questsRouter.delete('/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id!, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid quest id' });

  try {
    const quest = await getQuestById(id);
    if (!quest) return res.status(404).json({ error: 'Quest not found' });

    await deleteQuestDefinition(id);

    log('info', 'quest_deleted', { admin: req.username, quest_id: id });
    return res.status(204).send();
  } catch (err) {
    log('error', 'quest_delete_failed', { admin: req.username, quest_id: id, error: String(err) });
    return res.status(500).json({ error: 'Internal server error' });
  }
});
