import { sendToSession } from '../server';
import type { AuthenticatedSession } from '../server';
import { log } from '../../logger';
import { config } from '../../config';
import { getInventoryWithDefinitions } from '../../db/queries/inventory';
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
}
