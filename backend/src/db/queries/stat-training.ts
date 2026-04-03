import { query } from '../connection';

export interface StatTrainingItem {
  id: number;
  item_def_id: number;
  stat_name: string;
  tier: number;
  base_chance: number;
  decay_per_level: number;
  npc_id: number;
}

export interface StatTrainingItemWithDetails extends StatTrainingItem {
  item_name: string;
  icon_filename: string | null;
  npc_name: string;
}

export async function getTrainingItemsByNpcId(npcId: number): Promise<StatTrainingItemWithDetails[]> {
  const result = await query<StatTrainingItemWithDetails>(
    `SELECT st.*, d.name AS item_name, d.icon_filename, n.name AS npc_name
     FROM stat_training_items st
     JOIN item_definitions d ON d.id = st.item_def_id
     JOIN npcs n ON n.id = st.npc_id
     WHERE st.npc_id = $1
     ORDER BY st.tier ASC`,
    [npcId],
  );
  return result.rows;
}

export async function getTrainingItemByItemDefId(itemDefId: number): Promise<StatTrainingItem | null> {
  const result = await query<StatTrainingItem>(
    `SELECT * FROM stat_training_items WHERE item_def_id = $1`,
    [itemDefId],
  );
  return result.rows[0] ?? null;
}

export async function listAllTrainingItems(): Promise<StatTrainingItemWithDetails[]> {
  const result = await query<StatTrainingItemWithDetails>(
    `SELECT st.*, d.name AS item_name, d.icon_filename, n.name AS npc_name
     FROM stat_training_items st
     JOIN item_definitions d ON d.id = st.item_def_id
     JOIN npcs n ON n.id = st.npc_id
     ORDER BY st.stat_name, st.tier ASC`,
  );
  return result.rows;
}

export async function createTrainingItem(data: {
  item_def_id: number;
  stat_name: string;
  tier: number;
  base_chance: number;
  decay_per_level: number;
  npc_id: number;
}): Promise<StatTrainingItem> {
  const result = await query<StatTrainingItem>(
    `INSERT INTO stat_training_items (item_def_id, stat_name, tier, base_chance, decay_per_level, npc_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [data.item_def_id, data.stat_name, data.tier, data.base_chance, data.decay_per_level, data.npc_id],
  );
  return result.rows[0]!;
}

export async function deleteTrainingItem(id: number): Promise<boolean> {
  const result = await query(
    `DELETE FROM stat_training_items WHERE id = $1`,
    [id],
  );
  return (result.rowCount ?? 0) > 0;
}
