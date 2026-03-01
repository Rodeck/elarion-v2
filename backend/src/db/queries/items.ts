import { query } from '../connection';

export interface Item {
  id: number;
  name: string;
  type: string;
  stat_modifiers: Record<string, number>;
  description: string | null;
}

export interface CharacterItem {
  character_id: string;
  item_id: number;
  quantity: number;
  equipped: boolean;
}

export async function findItemById(id: number): Promise<Item | null> {
  const result = await query<Item>(
    `SELECT id, name, type, stat_modifiers, description FROM items WHERE id = $1`,
    [id],
  );
  return result.rows[0] ?? null;
}

export async function insertCharacterItem(characterId: string, itemId: number, quantity: number): Promise<void> {
  await query(
    `INSERT INTO character_items (character_id, item_id, quantity)
     VALUES ($1, $2, $3)
     ON CONFLICT (character_id, item_id)
     DO UPDATE SET quantity = character_items.quantity + EXCLUDED.quantity`,
    [characterId, itemId, quantity],
  );
}

export async function updateCharacterItemQuantity(characterId: string, itemId: number, delta: number): Promise<void> {
  await query(
    `UPDATE character_items SET quantity = quantity + $3
     WHERE character_id = $1 AND item_id = $2`,
    [characterId, itemId, delta],
  );
}
