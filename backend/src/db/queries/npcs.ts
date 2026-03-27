import { query } from '../connection';

export interface Npc {
  id: number;
  name: string;
  description: string;
  icon_filename: string;
  is_crafter: boolean;
  is_quest_giver: boolean;
  is_disassembler: boolean;
  created_at: Date;
}

export async function getAllNpcs(): Promise<Npc[]> {
  const result = await query<Npc>(
    'SELECT * FROM npcs ORDER BY name',
  );
  return result.rows;
}

export async function getNpcById(id: number): Promise<Npc | null> {
  const result = await query<Npc>(
    'SELECT * FROM npcs WHERE id = $1',
    [id],
  );
  return result.rows[0] ?? null;
}

export async function createNpc(data: {
  name: string;
  description: string;
  icon_filename: string;
}): Promise<Npc> {
  const result = await query<Npc>(
    `INSERT INTO npcs (name, description, icon_filename)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [data.name, data.description, data.icon_filename],
  );
  return result.rows[0]!;
}

export async function updateNpc(
  id: number,
  data: {
    name?: string;
    description?: string;
    icon_filename?: string;
  },
): Promise<Npc | null> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let paramIdx = 1;

  if (data.name !== undefined) { fields.push(`name = $${paramIdx++}`); values.push(data.name); }
  if (data.description !== undefined) { fields.push(`description = $${paramIdx++}`); values.push(data.description); }
  if (data.icon_filename !== undefined) { fields.push(`icon_filename = $${paramIdx++}`); values.push(data.icon_filename); }

  if (fields.length === 0) return getNpcById(id);

  values.push(id);
  const result = await query<Npc>(
    `UPDATE npcs SET ${fields.join(', ')} WHERE id = $${paramIdx} RETURNING *`,
    values,
  );
  return result.rows[0] ?? null;
}

export async function deleteNpc(id: number): Promise<void> {
  await query('DELETE FROM npcs WHERE id = $1', [id]);
}

export interface BuildingNpc {
  npc_id: number;
  name: string;
  icon_filename: string;
  is_crafter: boolean;
  is_quest_giver: boolean;
  is_disassembler: boolean;
  sort_order: number;
}

export async function getNpcsForBuilding(buildingId: number): Promise<BuildingNpc[]> {
  const result = await query<BuildingNpc>(
    `SELECT bn.npc_id, n.name, n.icon_filename, n.is_crafter, n.is_quest_giver, n.is_disassembler, bn.sort_order
     FROM building_npcs bn
     JOIN npcs n ON n.id = bn.npc_id
     WHERE bn.building_id = $1
     ORDER BY bn.sort_order, n.name`,
    [buildingId],
  );
  return result.rows;
}

export async function assignNpcToBuilding(buildingId: number, npcId: number): Promise<void> {
  await query(
    `INSERT INTO building_npcs (building_id, npc_id) VALUES ($1, $2)`,
    [buildingId, npcId],
  );
}

export async function removeNpcFromBuilding(buildingId: number, npcId: number): Promise<void> {
  await query(
    `DELETE FROM building_npcs WHERE building_id = $1 AND npc_id = $2`,
    [buildingId, npcId],
  );
}

export interface ZoneNpcRow {
  building_id: number;
  npc_id: number;
  npc_name: string;
  npc_description: string;
  icon_filename: string;
  is_crafter: boolean;
  is_quest_giver: boolean;
  is_squire_dismisser: boolean;
  is_disassembler: boolean;
  sort_order: number;
}

export async function getNpcsForZone(zoneId: number): Promise<ZoneNpcRow[]> {
  const result = await query<ZoneNpcRow>(
    `SELECT b.id AS building_id, n.id AS npc_id, n.name AS npc_name, n.description AS npc_description, n.icon_filename, n.is_crafter, n.is_quest_giver, n.is_squire_dismisser, n.is_disassembler, bn.sort_order
     FROM buildings b
     JOIN building_npcs bn ON bn.building_id = b.id
     JOIN npcs n ON n.id = bn.npc_id
     WHERE b.zone_id = $1
     ORDER BY b.id, bn.sort_order, n.name`,
    [zoneId],
  );
  return result.rows;
}
