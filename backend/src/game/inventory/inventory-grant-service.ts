import { sendToSession } from '../../websocket/server';
import type { AuthenticatedSession } from '../../websocket/server';
import { log } from '../../logger';
import { config } from '../../config';
import {
  getItemDefinitionById,
  findStackableSlot,
  updateInventoryQuantity,
  getInventorySlotCount,
  insertInventoryItem,
  insertInventoryItemWithStats,
  insertToolInventoryItem,
  getInventoryWithDefinitions,
} from '../../db/queries/inventory';
import { QuestTracker } from '../quest/quest-tracker';
import { rollItemStats, type InstanceStats } from './item-roll-service';
import type { InventorySlotDto, ItemCategory, WeaponSubtype, QualityTier } from '../../../../shared/protocol/index';
import { QUALITY_LABELS } from '../../../../shared/protocol/index';

const INVENTORY_CAPACITY = 20;

function buildIconUrl(iconFilename: string | null): string | null {
  if (!iconFilename) return null;
  return `${config.adminBaseUrl}/item-icons/${iconFilename}`;
}

/**
 * Grant an item to a character, handling stacking logic and capacity checks.
 * Emits inventory.item_received or inventory.full to the session.
 */
export async function grantItemToCharacter(
  session: AuthenticatedSession,
  characterId: string,
  itemDefId: number,
  quantityToGrant: number,
  instanceStatsOverride?: InstanceStats | null,
): Promise<void> {
  const def = await getItemDefinitionById(itemDefId);
  if (!def) {
    log('warn', 'inventory', 'grant_item_def_not_found', { character_id: characterId, item_def_id: itemDefId });
    return;
  }

  const isStackable = def.stack_size != null;

  if (isStackable) {
    // Try to stack onto an existing slot — fill it up, grant remainder as new slot
    const existingSlot = await findStackableSlot(characterId, itemDefId);
    if (existingSlot) {
      const room = def.stack_size! - existingSlot.quantity;
      const toStack = Math.min(quantityToGrant, room);

      if (toStack > 0) {
        const newQuantity = existingSlot.quantity + toStack;
        const updatedSlot = await updateInventoryQuantity(existingSlot.id, newQuantity);
        if (updatedSlot) {
          const slotDto: InventorySlotDto = {
            slot_id: updatedSlot.id,
            item_def_id: def.id,
            quantity: updatedSlot.quantity,
            current_durability: updatedSlot.current_durability ?? undefined,
            definition: {
              id: def.id,
              name: def.name,
              description: def.description ?? '',
              category: def.category as ItemCategory,
              weapon_subtype: (def.weapon_subtype as WeaponSubtype) ?? null,
              attack: def.attack,
              defence: def.defence,
              heal_power: def.heal_power,
              food_power: def.food_power,
              stack_size: def.stack_size,
              icon_url: buildIconUrl(def.icon_filename),
              max_mana: def.max_mana,
              mana_on_hit: def.mana_on_hit,
              mana_on_damage_taken: def.mana_on_damage_taken,
              mana_regen: def.mana_regen,
              dodge_chance: def.dodge_chance,
              crit_chance: def.crit_chance,
              crit_damage: def.crit_damage,
              armor_penetration: def.armor_penetration ?? 0,
              additional_attacks: def.additional_attacks ?? 0,
              tool_type: def.tool_type ?? null,
              max_durability: def.max_durability ?? null,
              power: def.power ?? null,
              ability_id: def.ability_id ?? null,
            },
          };

          sendToSession(session, 'inventory.item_received', { slot: slotDto, stacked: true });
          log('info', 'inventory', 'inventory_item_received', {
            character_id: characterId,
            item_def_id: itemDefId,
            quantity: toStack,
            stacked: true,
          });

          // Quest tracking: inventory changed (stacking path)
          try {
            const questProgress = await QuestTracker.onInventoryChanged(characterId);
            for (const p of questProgress) {
              sendToSession(session, 'quest.progress', p);
            }
          } catch (qErr) {
            log('warn', 'inventory', 'quest_tracker_error', { character_id: characterId, err: qErr });
          }
        }

        // If all quantity was stacked, we're done
        const remainder = quantityToGrant - toStack;
        if (remainder <= 0) return;

        // Recurse for the remainder (will create a new slot or find another stackable slot)
        return grantItemToCharacter(session, characterId, itemDefId, remainder);
      }
    }
  }

  // Non-stackable items (weapons, armor, etc.) must each occupy their own slot.
  // Loop once per unit for non-stackable items, once total for stackable overflow.
  const isTool = def.category === 'tool' && def.max_durability != null;
  const unitsToInsert = isStackable ? 1 : quantityToGrant;
  const qtyPerSlot = isStackable ? quantityToGrant : 1;

  for (let u = 0; u < unitsToInsert; u++) {
    const slotCount = await getInventorySlotCount(characterId);
    if (slotCount >= INVENTORY_CAPACITY) {
      sendToSession(session, 'inventory.full', { item_name: def.name });
      log('info', 'inventory', 'inventory_full', {
        character_id: characterId,
        item_def_id: itemDefId,
        item_name: def.name,
      });
      return;
    }

    // Roll instance stats (or use override from marketplace)
    const rolled = instanceStatsOverride ?? rollItemStats(def);

    let newSlot;
    if (isTool) {
      newSlot = await insertToolInventoryItem(characterId, itemDefId, def.max_durability!);
    } else if (rolled) {
      newSlot = await insertInventoryItemWithStats(characterId, itemDefId, qtyPerSlot, {
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
      newSlot = await insertInventoryItem(characterId, itemDefId, qtyPerSlot);
    }

    // Fetch with definition for the full DTO
    const allSlots = await getInventoryWithDefinitions(characterId);
    const newSlotWithDef = allSlots.find((s) => s.id === newSlot.id);
    if (!newSlotWithDef) continue;

    const tier = newSlotWithDef.instance_quality_tier as QualityTier | null;
    const slotDto: InventorySlotDto = {
      slot_id: newSlotWithDef.id,
      item_def_id: newSlotWithDef.item_def_id,
      quantity: newSlotWithDef.quantity,
      current_durability: newSlotWithDef.current_durability ?? undefined,
      instance_attack: newSlotWithDef.instance_attack ?? null,
      instance_defence: newSlotWithDef.instance_defence ?? null,
      instance_crit_chance: newSlotWithDef.instance_crit_chance ?? null,
      instance_additional_attacks: newSlotWithDef.instance_additional_attacks ?? null,
      instance_armor_penetration: newSlotWithDef.instance_armor_penetration ?? null,
      instance_max_mana: newSlotWithDef.instance_max_mana ?? null,
      instance_mana_on_hit: newSlotWithDef.instance_mana_on_hit ?? null,
      instance_mana_regen: newSlotWithDef.instance_mana_regen ?? null,
      quality_tier: tier,
      quality_label: tier ? QUALITY_LABELS[tier] : null,
      definition: {
        id: newSlotWithDef.item_def_id,
        name: newSlotWithDef.def_name,
        description: newSlotWithDef.def_description ?? '',
        category: newSlotWithDef.def_category as ItemCategory,
        weapon_subtype: (newSlotWithDef.def_weapon_subtype as WeaponSubtype) ?? null,
        attack: newSlotWithDef.def_attack,
        defence: newSlotWithDef.def_defence,
        heal_power: newSlotWithDef.def_heal_power,
        food_power: newSlotWithDef.def_food_power,
        stack_size: newSlotWithDef.def_stack_size,
        icon_url: buildIconUrl(newSlotWithDef.def_icon_filename),
        max_mana: newSlotWithDef.def_max_mana,
        mana_on_hit: newSlotWithDef.def_mana_on_hit,
        mana_on_damage_taken: newSlotWithDef.def_mana_on_damage_taken,
        mana_regen: newSlotWithDef.def_mana_regen,
        dodge_chance: newSlotWithDef.def_dodge_chance,
        crit_chance: newSlotWithDef.def_crit_chance,
        crit_damage: newSlotWithDef.def_crit_damage,
        armor_penetration: newSlotWithDef.def_armor_penetration ?? 0,
        additional_attacks: newSlotWithDef.def_additional_attacks ?? 0,
        tool_type: newSlotWithDef.def_tool_type ?? null,
        max_durability: newSlotWithDef.def_max_durability ?? null,
        power: newSlotWithDef.def_power ?? null,
        ability_id: newSlotWithDef.def_ability_id ?? null,
      },
    };

    if (rolled) {
      log('info', 'inventory', 'item_roll', {
        character_id: characterId,
        item_def_id: itemDefId,
        weapon_subtype: def.weapon_subtype,
        quality_tier: rolled.instance_quality_tier,
        quality_label: rolled.quality_label,
      });
    }

    sendToSession(session, 'inventory.item_received', { slot: slotDto, stacked: false });
    log('info', 'inventory', 'inventory_item_received', {
      character_id: characterId,
      item_def_id: itemDefId,
      quantity: 1,
      stacked: false,
    });
  } // end for loop

  // Quest tracking: inventory changed (runs once after all units granted)
  try {
    const questProgress = await QuestTracker.onInventoryChanged(characterId);
    for (const p of questProgress) {
      sendToSession(session, 'quest.progress', p);
    }
  } catch (qErr) {
    log('warn', 'inventory', 'quest_tracker_error', { character_id: characterId, err: qErr });
  }
}
