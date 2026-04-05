import { Router } from 'express';
import { query } from '../../../../backend/src/db/connection';
import {
  getItemDefinitionById,
  getInventorySlotCount,
  findStackableSlot,
  insertInventoryItem,
  insertInventoryItemWithStats,
  insertToolInventoryItem,
  updateInventoryQuantity,
} from '../../../../backend/src/db/queries/inventory';
import { rollItemStats } from '../../../../backend/src/game/inventory/item-roll-service';

export const adminToolsRouter = Router();

function log(level: string, event: string, extra: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ level, event, timestamp: new Date().toISOString(), ...extra }));
}

// ---------------------------------------------------------------------------
// GET /api/admin-tools/characters
// ---------------------------------------------------------------------------

adminToolsRouter.get('/characters', async (_req, res) => {
  try {
    const result = await query<{ id: string; name: string; level: number; class_name: string }>(
      `SELECT c.id, c.name, c.level, cc.name AS class_name
       FROM characters c
       JOIN character_classes cc ON cc.id = c.class_id
       ORDER BY c.name`,
    );
    res.json(result.rows);
  } catch (err) {
    log('error', 'admin_tools_characters_error', { error: String(err) });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/admin-tools/grant-item
// ---------------------------------------------------------------------------

adminToolsRouter.post('/grant-item', async (req, res) => {
  const { character_id, item_def_id, quantity } = req.body as {
    character_id?: unknown;
    item_def_id?: unknown;
    quantity?: unknown;
  };

  if (typeof character_id !== 'string' || !character_id.trim()) {
    return res.status(400).json({ error: 'character_id is required' });
  }
  if (typeof item_def_id !== 'number' || !Number.isInteger(item_def_id) || item_def_id < 1) {
    return res.status(400).json({ error: 'item_def_id must be a positive integer' });
  }
  const qty =
    typeof quantity === 'number' && Number.isInteger(quantity) && quantity >= 1 ? quantity : 1;

  try {
    const itemDef = await getItemDefinitionById(item_def_id);
    if (!itemDef) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const charResult = await query<{ id: string; name: string }>(
      `SELECT id, name FROM characters WHERE id = $1`,
      [character_id],
    );
    if (charResult.rows.length === 0) {
      return res.status(404).json({ error: 'Character not found' });
    }
    const charName = charResult.rows[0]!.name;

    // Try stacking first
    if (itemDef.stack_size !== null) {
      const existingSlot = await findStackableSlot(character_id, item_def_id);
      if (existingSlot && existingSlot.quantity + qty <= itemDef.stack_size) {
        await updateInventoryQuantity(existingSlot.id, existingSlot.quantity + qty);
        log('info', 'admin_tools_grant_item', {
          character_id,
          char_name: charName,
          item_def_id,
          item_name: itemDef.name,
          quantity: qty,
          stacked: true,
        });
        return res.json({
          success: true,
          message: `Added ${qty}× ${itemDef.name} to ${charName}'s inventory (stacked)`,
        });
      }
    }

    // New slot(s) — non-stackable items must each occupy their own slot
    const isStackable = itemDef.stack_size !== null;
    const isTool = itemDef.category === 'tool' && itemDef.max_durability != null;
    const unitsToInsert = isStackable ? 1 : qty;
    const qtyPerSlot = isStackable ? qty : 1;

    for (let u = 0; u < unitsToInsert; u++) {
      const slotCount = await getInventorySlotCount(character_id);
      if (slotCount >= 20) {
        if (u === 0) {
          return res
            .status(409)
            .json({ error: `${charName}'s inventory is full (20/20 slots)` });
        }
        // Partial grant — some items were inserted before inventory filled
        log('info', 'admin_tools_grant_item', {
          character_id,
          char_name: charName,
          item_def_id,
          item_name: itemDef.name,
          quantity: u,
          requested: qty,
          stacked: false,
          partial: true,
        });
        return res.json({
          success: true,
          message: `Gave ${u}× ${itemDef.name} to ${charName} (inventory full, requested ${qty})`,
        });
      }

      if (isTool) {
        await insertToolInventoryItem(character_id, item_def_id, itemDef.max_durability!);
      } else {
        const rolled = rollItemStats(itemDef);
        if (rolled) {
          await insertInventoryItemWithStats(character_id, item_def_id, qtyPerSlot, {
            instance_attack: rolled.instance_attack,
            instance_defence: rolled.instance_defence,
            instance_crit_chance: rolled.instance_crit_chance,
            instance_additional_attacks: rolled.instance_additional_attacks,
            instance_armor_penetration: rolled.instance_armor_penetration,
            instance_max_mana: rolled.instance_max_mana,
            instance_mana_on_hit: rolled.instance_mana_on_hit,
            instance_mana_regen: rolled.instance_mana_regen,
            instance_quality_tier: rolled.instance_quality_tier,
          });
        } else {
          await insertInventoryItem(character_id, item_def_id, qtyPerSlot);
        }
      }
    }

    log('info', 'admin_tools_grant_item', {
      character_id,
      char_name: charName,
      item_def_id,
      item_name: itemDef.name,
      quantity: qty,
      stacked: false,
    });
    return res.json({
      success: true,
      message: `Gave ${qty}× ${itemDef.name} to ${charName}`,
    });
  } catch (err) {
    log('error', 'admin_tools_grant_item_error', { error: String(err) });
    return res.status(500).json({ error: 'Internal server error' });
  }
});
