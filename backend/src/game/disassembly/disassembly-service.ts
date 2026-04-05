/**
 * disassembly-service.ts
 *
 * Core business logic for the item disassembly system.
 * Handles preview computation, chance-table rolling, and atomic execution.
 */

import { log } from '../../logger';
import { config } from '../../config';
import { getClient, query } from '../../db/connection';
// characters query not needed — crowns checked via direct query in transaction
import {
  getInventoryWithDefinitions,
  getInventorySlotCount,
  getInventorySlotById,
  findStackableSlot,
  getItemDefinitionById,
} from '../../db/queries/inventory';
import { getRecipesForItemDefIds, getDisassemblyCost } from '../../db/queries/disassembly';
import type { RecipeWithOutputs } from '../../db/queries/disassembly';
import type { InventoryItemWithDefinition } from '../../db/queries/inventory';
import type {
  DisassemblyPreviewResultPayload,
  DisassemblyOutputPreview,
  DisassemblyResultPayload,
  DisassemblyReceivedItem,
  InventorySlotDto,
  ItemCategory,
  WeaponSubtype,
} from '../../../../shared/protocol/index';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const INVENTORY_CAPACITY = 20;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildIconUrl(iconFilename: string | null): string | null {
  if (!iconFilename) return null;
  return `${config.adminBaseUrl}/item-icons/${iconFilename}`;
}

function buildSlotDto(r: InventoryItemWithDefinition): InventorySlotDto {
  return {
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
      icon_url: buildIconUrl(r.def_icon_filename),
      max_mana: r.def_max_mana,
      mana_on_hit: r.def_mana_on_hit,
      mana_on_damage_taken: r.def_mana_on_damage_taken,
      mana_regen: r.def_mana_regen,
      dodge_chance: r.def_dodge_chance,
      crit_chance: r.def_crit_chance,
      crit_damage: r.def_crit_damage,
      armor_penetration: r.def_armor_penetration ?? 0,
      additional_attacks: r.def_additional_attacks ?? 0,
      tool_type: r.def_tool_type ?? null,
      max_durability: r.def_max_durability ?? null,
      power: r.def_power ?? null,
      ability_id: r.def_ability_id ?? null,
    },
  };
}

async function buildFullInventorySlots(characterId: string): Promise<InventorySlotDto[]> {
  const rows = await getInventoryWithDefinitions(characterId);
  return rows.map(buildSlotDto);
}

// ---------------------------------------------------------------------------
// rollChanceTable
// ---------------------------------------------------------------------------

/**
 * Roll against a chance table for a single item's recipes.
 * Generates a random number 1–100 and walks through recipes summing chance_percent.
 */
export function rollChanceTable(recipes: RecipeWithOutputs[]): RecipeWithOutputs['outputs'] {
  if (recipes.length === 0) return [];
  if (recipes.length === 1) return recipes[0]!.outputs;

  const roll = Math.floor(Math.random() * 100) + 1; // 1-100
  let cumulative = 0;
  for (const recipe of recipes) {
    cumulative += recipe.chance_percent;
    if (roll <= cumulative) {
      return recipe.outputs;
    }
  }
  // Fallback to last recipe (shouldn't happen if chances sum to 100)
  return recipes[recipes.length - 1]!.outputs;
}

// ---------------------------------------------------------------------------
// computePreview
// ---------------------------------------------------------------------------

export async function computePreview(
  characterId: string,
  slotIds: number[],
  kilnSlotId: number,
): Promise<DisassemblyPreviewResultPayload> {
  // Load inventory items for the given slot_ids
  const items: InventoryItemWithDefinition[] = [];
  for (const slotId of slotIds) {
    const item = await getInventorySlotById(slotId, characterId);
    if (!item) throw new Error(`INVALID_ITEM:Slot ${slotId} not found or does not belong to character.`);
    items.push(item);
  }

  if (items.length === 0) throw new Error('GRID_EMPTY:No items selected.');

  // Batch-load recipes for all item def IDs
  const itemDefIds = [...new Set(items.map((i) => i.item_def_id))];
  const recipeMap = await getRecipesForItemDefIds(itemDefIds);

  // Validate all items have recipes
  for (const item of items) {
    const recipes = recipeMap.get(item.item_def_id);
    if (!recipes || recipes.length === 0) {
      throw new Error(`ITEM_NOT_DISASSEMBLABLE:${item.def_name} cannot be disassembled.`);
    }
  }

  // Aggregate output ranges across all grid items
  // For each output item type: min = sum of minimum possible, max = sum of maximum possible
  const outputMinMap = new Map<number, { name: string; icon_url: string | null; min: number; max: number }>();

  let totalCost = 0;
  let totalItemCount = 0;
  let maxOutputSlots = 0;

  for (const item of items) {
    const recipes = recipeMap.get(item.item_def_id)!;
    const qty = item.quantity;

    // Compute disassembly_cost for this item (per unit, stored on item_definitions)
    const costPerUnit = await getDisassemblyCost(item.item_def_id);
    totalCost += costPerUnit * qty;
    totalItemCount += qty;

    // For each unit of this item, find min/max possible outputs across all recipes
    // Min output for a given output item = minimum quantity across all recipes that produce it (or 0 if some recipe doesn't produce it)
    // Max output for a given output item = maximum quantity across all recipes that produce it

    // Collect all unique output item IDs across all recipes for this item
    const allOutputItemIds = new Set<number>();
    for (const recipe of recipes) {
      for (const out of recipe.outputs) {
        allOutputItemIds.add(out.output_item_def_id);
      }
    }

    // For each output item, find min and max quantity per unit
    for (const outItemId of allOutputItemIds) {
      let minPerUnit = Infinity;
      let maxPerUnit = 0;

      for (const recipe of recipes) {
        const output = recipe.outputs.find((o) => o.output_item_def_id === outItemId);
        const outputQty = output?.quantity ?? 0;
        minPerUnit = Math.min(minPerUnit, outputQty);
        maxPerUnit = Math.max(maxPerUnit, outputQty);
      }

      if (minPerUnit === Infinity) minPerUnit = 0;

      const existing = outputMinMap.get(outItemId);
      const outputInfo = recipes.flatMap((r) => r.outputs).find((o) => o.output_item_def_id === outItemId)!;

      if (existing) {
        existing.min += minPerUnit * qty;
        existing.max += maxPerUnit * qty;
      } else {
        outputMinMap.set(outItemId, {
          name: outputInfo.output_item_name,
          icon_url: outputInfo.output_icon_url,
          min: minPerUnit * qty,
          max: maxPerUnit * qty,
        });
      }
    }

    // max_output_slots: worst case = max distinct output items from a single roll * qty
    // We calculate this as: max number of distinct outputs from any single recipe, summed per item unit
    let maxDistinctOutputsPerRoll = 0;
    for (const recipe of recipes) {
      maxDistinctOutputsPerRoll = Math.max(maxDistinctOutputsPerRoll, recipe.outputs.length);
    }
    maxOutputSlots += maxDistinctOutputsPerRoll * qty;
  }

  const possibleOutputs: DisassemblyOutputPreview[] = [];
  for (const [itemDefId, info] of outputMinMap) {
    possibleOutputs.push({
      item_def_id: itemDefId,
      item_name: info.name,
      icon_url: info.icon_url,
      min_quantity: info.min,
      max_quantity: info.max,
    });
  }

  return {
    possible_outputs: possibleOutputs,
    total_cost: totalCost,
    total_item_count: totalItemCount,
    max_output_slots: maxOutputSlots,
  };
}

// ---------------------------------------------------------------------------
// executeDisassembly
// ---------------------------------------------------------------------------

export async function executeDisassembly(
  characterId: string,
  slotIds: number[],
  kilnSlotId: number,
): Promise<DisassemblyResultPayload> {
  if (slotIds.length === 0) throw new Error('GRID_EMPTY:No items selected.');

  // Load and validate all input items
  const items: InventoryItemWithDefinition[] = [];
  for (const slotId of slotIds) {
    const item = await getInventorySlotById(slotId, characterId);
    if (!item) throw new Error(`INVALID_ITEM:Slot ${slotId} not found or does not belong to character.`);
    items.push(item);
  }

  // Validate kiln
  const kiln = await getInventorySlotById(kilnSlotId, characterId);
  if (!kiln || kiln.def_tool_type !== 'kiln') {
    throw new Error('NO_KILN:No valid kiln found in the specified slot.');
  }

  // Load recipes
  const itemDefIds = [...new Set(items.map((i) => i.item_def_id))];
  const recipeMap = await getRecipesForItemDefIds(itemDefIds);

  // Validate all items have recipes
  for (const item of items) {
    const recipes = recipeMap.get(item.item_def_id);
    if (!recipes || recipes.length === 0) {
      throw new Error(`ITEM_NOT_DISASSEMBLABLE:${item.def_name} cannot be disassembled.`);
    }
  }

  // Compute total cost and total item count
  let totalCost = 0;
  let totalItemCount = 0;
  for (const item of items) {
    const costPerUnit = await getDisassemblyCost(item.item_def_id);
    totalCost += costPerUnit * item.quantity;
    totalItemCount += item.quantity;
  }

  // Validate kiln durability
  const kilnDurability = kiln.current_durability ?? 0;
  if (kilnDurability < totalItemCount) {
    throw new Error(`INSUFFICIENT_KILN_DURABILITY:Kiln durability ${kilnDurability} < ${totalItemCount} items.`);
  }

  // Validate crowns
  const charResult = await query<{ crowns: number }>('SELECT crowns FROM characters WHERE id = $1', [characterId]);
  if (charResult.rows.length === 0) throw new Error('NO_CHARACTER:Character not found.');
  const currentCrowns = charResult.rows[0]?.crowns ?? 0;
  if (currentCrowns < totalCost) {
    throw new Error(`INSUFFICIENT_CROWNS:Need ${totalCost} Crowns, have ${currentCrowns}.`);
  }

  // Validate inventory capacity for outputs
  // Roll outputs first (before transaction) to know exactly how many slots we need
  const rolledOutputs: { output_item_def_id: number; output_item_name: string; output_icon_url: string | null; quantity: number }[] = [];
  for (const item of items) {
    const recipes = recipeMap.get(item.item_def_id)!;
    // Roll once per unit
    for (let u = 0; u < item.quantity; u++) {
      const outputs = rollChanceTable(recipes);
      for (const out of outputs) {
        rolledOutputs.push({
          output_item_def_id: out.output_item_def_id,
          output_item_name: out.output_item_name,
          output_icon_url: out.output_icon_url,
          quantity: out.quantity,
        });
      }
    }
  }

  // Aggregate rolled outputs by item def id
  const aggregatedOutputs = new Map<number, { name: string; icon_url: string | null; quantity: number }>();
  for (const out of rolledOutputs) {
    const existing = aggregatedOutputs.get(out.output_item_def_id);
    if (existing) {
      existing.quantity += out.quantity;
    } else {
      aggregatedOutputs.set(out.output_item_def_id, {
        name: out.output_item_name,
        icon_url: out.output_icon_url,
        quantity: out.quantity,
      });
    }
  }

  // Check inventory space: after removing input items, how many free slots?
  const currentSlotCount = await getInventorySlotCount(characterId);
  // Input items being removed frees up their slots
  const slotsFreed = slotIds.length;
  // Kiln might be removed too if durability reaches 0
  const kilnDestroyed = kilnDurability - totalItemCount <= 0;
  const kilnSlotFreed = kilnDestroyed ? 1 : 0;
  const availableSlots = INVENTORY_CAPACITY - currentSlotCount + slotsFreed + kilnSlotFreed;

  // Count how many new slots the outputs need
  let newSlotsNeeded = 0;
  for (const [outItemDefId, outInfo] of aggregatedOutputs) {
    const def = await getItemDefinitionById(outItemDefId);
    if (def?.stack_size != null) {
      // Check if there's an existing stack (not one of the input items being removed)
      const existingStack = await findStackableSlot(characterId, outItemDefId);
      if (existingStack && !slotIds.includes(existingStack.id) && existingStack.quantity + outInfo.quantity <= def.stack_size) {
        // Can stack, no new slot needed
        continue;
      }
    }
    newSlotsNeeded++;
  }

  if (newSlotsNeeded > availableSlots) {
    throw new Error('INSUFFICIENT_INVENTORY_SPACE:Not enough inventory space for disassembly outputs.');
  }

  // ---------------------------------------------------------------------------
  // Atomic transaction
  // ---------------------------------------------------------------------------
  const client = await getClient();
  try {
    await client.query('BEGIN');

    // a. Delete all input inventory items
    for (const slotId of slotIds) {
      await client.query('DELETE FROM inventory_items WHERE id = $1 AND character_id = $2', [slotId, characterId]);
    }

    // b. Deduct crowns
    if (totalCost > 0) {
      await client.query(
        'UPDATE characters SET crowns = crowns - $2, updated_at = now() WHERE id = $1 AND crowns >= $2',
        [characterId, totalCost],
      );
    }

    // c. Decrement kiln durability; if reaches 0, delete kiln row
    const newKilnDurability = kilnDurability - totalItemCount;
    if (newKilnDurability <= 0) {
      await client.query('DELETE FROM inventory_items WHERE id = $1', [kilnSlotId]);
    } else {
      await client.query(
        'UPDATE inventory_items SET current_durability = $1 WHERE id = $2',
        [newKilnDurability, kilnSlotId],
      );
    }

    // d. Grant output items
    for (const [outItemDefId, outInfo] of aggregatedOutputs) {
      const def = await getItemDefinitionById(outItemDefId);
      const isStackable = def?.stack_size != null;

      if (isStackable) {
        // Try to stack onto existing
        const stackResult = await client.query<{ id: number; quantity: number }>(
          `SELECT ii.id, ii.quantity
           FROM inventory_items ii
           JOIN item_definitions d ON d.id = ii.item_def_id
           WHERE ii.character_id = $1
             AND ii.item_def_id = $2
             AND d.stack_size IS NOT NULL
             AND ii.quantity + $3 <= d.stack_size
             AND ii.equipped_slot IS NULL
           ORDER BY ii.created_at ASC
           LIMIT 1`,
          [characterId, outItemDefId, outInfo.quantity],
        );

        if (stackResult.rows.length > 0) {
          const row = stackResult.rows[0]!;
          await client.query(
            'UPDATE inventory_items SET quantity = quantity + $1 WHERE id = $2',
            [outInfo.quantity, row.id],
          );
          continue;
        }
      }

      // Insert new row
      const isTool = def?.category === 'tool' && def.max_durability != null;
      if (isTool) {
        await client.query(
          'INSERT INTO inventory_items (character_id, item_def_id, quantity, current_durability) VALUES ($1, $2, 1, $3)',
          [characterId, outItemDefId, def!.max_durability],
        );
      } else {
        await client.query(
          'INSERT INTO inventory_items (character_id, item_def_id, quantity) VALUES ($1, $2, $3)',
          [characterId, outItemDefId, outInfo.quantity],
        );
      }
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  // ---------------------------------------------------------------------------
  // Build result payload
  // ---------------------------------------------------------------------------

  // Get new crowns balance
  const crownsResult = await query<{ crowns: number }>('SELECT crowns FROM characters WHERE id = $1', [characterId]);
  const newCrowns = crownsResult.rows[0]?.crowns ?? 0;

  // Build updated inventory slots
  const updatedSlots = await buildFullInventorySlots(characterId);

  // Build received items
  const receivedItems: DisassemblyReceivedItem[] = [];
  for (const [outItemDefId, outInfo] of aggregatedOutputs) {
    receivedItems.push({
      item_def_id: outItemDefId,
      item_name: outInfo.name,
      icon_url: outInfo.icon_url,
      quantity: outInfo.quantity,
    });
  }

  // Build kiln slot DTO (null if destroyed)
  let kilnSlot: InventorySlotDto | null = null;
  if (!kilnDestroyed) {
    const kilnRow = await getInventorySlotById(kilnSlotId, characterId);
    if (kilnRow) {
      kilnSlot = buildSlotDto(kilnRow);
    }
  }

  log('info', 'disassembly', 'disassembly_executed', {
    character_id: characterId,
    items_consumed: slotIds.length,
    items_granted: receivedItems.length,
    crowns_deducted: totalCost,
    kiln_durability_remaining: kilnDestroyed ? 0 : kilnDurability - totalItemCount,
  });

  return {
    received_items: receivedItems,
    new_crowns: newCrowns,
    updated_slots: updatedSlots,
    removed_slot_ids: slotIds,
    kiln_slot: kilnSlot,
  };
}
