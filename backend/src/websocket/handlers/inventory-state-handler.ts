import { sendToSession } from '../server';
import type { AuthenticatedSession } from '../server';
import { log } from '../../logger';
import { config } from '../../config';
import { getInventoryWithDefinitions } from '../../db/queries/inventory';
import { sendEquipmentState } from './equipment-state-handler';
import type { InventorySlotDto, ItemCategory, WeaponSubtype } from '../../../../shared/protocol/index';

const INVENTORY_CAPACITY = 20;

function buildIconUrl(iconFilename: string | null): string | null {
  if (!iconFilename) return null;
  return `${config.adminBaseUrl}/item-icons/${iconFilename}`;
}

export async function sendInventoryState(session: AuthenticatedSession): Promise<void> {
  if (!session.characterId) return;

  const rows = await getInventoryWithDefinitions(session.characterId);

  const slots: InventorySlotDto[] = rows.map((row) => ({
    slot_id: row.id,
    item_def_id: row.item_def_id,
    quantity: row.quantity,
    definition: {
      id: row.item_def_id,
      name: row.def_name,
      description: row.def_description ?? '',
      category: row.def_category as ItemCategory,
      weapon_subtype: (row.def_weapon_subtype as WeaponSubtype) ?? null,
      attack: row.def_attack,
      defence: row.def_defence,
      heal_power: row.def_heal_power,
      food_power: row.def_food_power,
      stack_size: row.def_stack_size,
      icon_url: buildIconUrl(row.def_icon_filename),
      max_mana: row.def_max_mana,
      mana_on_hit: row.def_mana_on_hit,
      mana_on_damage_taken: row.def_mana_on_damage_taken,
      mana_regen: row.def_mana_regen,
      dodge_chance: row.def_dodge_chance,
      crit_chance: row.def_crit_chance,
      crit_damage: row.def_crit_damage,
    },
  }));

  sendToSession(session, 'inventory.state', {
    slots,
    capacity: INVENTORY_CAPACITY,
  });

  log('info', 'inventory', 'inventory_state_sent', {
    character_id: session.characterId,
    slot_count: slots.length,
  });

  await sendEquipmentState(session);
}
