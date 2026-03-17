import { registerHandler } from '../../websocket/dispatcher';
import { sendToSession } from '../../websocket/server';
import type { AuthenticatedSession } from '../../websocket/server';
import { log } from '../../logger';
import { config } from '../../config';
import { findByAccountId, deductCrowns, addCrowns } from '../../db/queries/characters';
import { getNpcById } from '../../db/queries/npcs';
import {
  getRecipesByNpcId,
  getRecipeById,
  getRecipeIngredients,
  getActiveSessionsForCharacterAtNpc,
  getActiveSessionForRecipeAtNpc,
  createSession,
  insertSessionCost,
  getSessionById,
  getSessionCosts,
  updateSessionStatus,
  completeExpiredSessions,
} from '../../db/queries/crafting';
import {
  getInventoryWithDefinitions,
  getInventorySlotCount,
  insertInventoryItem,
  updateInventoryQuantity,
  findStackableSlot,
  getItemDefinitionById,
} from '../../db/queries/inventory';
import { buildRecipeDto, buildSessionDto, calculateProgress } from './crafting-service';
import { grantItemToCharacter } from '../inventory/inventory-grant-service';
import type {
  CraftingOpenPayload,
  CraftingStartPayload,
  CraftingCancelPayload,
  CraftingCollectPayload,
  CraftingRejectionReason,
  InventorySlotDto,
  ItemCategory,
  WeaponSubtype,
} from '../../../../shared/protocol/index';
import { query } from '../../db/connection';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function reject(session: AuthenticatedSession, action: string, reason: CraftingRejectionReason, details?: string): void {
  sendToSession(session, 'crafting.rejected', { action, reason, details });
}

const INVENTORY_CAPACITY = 20;

function buildIconUrl(iconFilename: string | null): string | null {
  if (!iconFilename) return null;
  return `${config.adminBaseUrl}/item-icons/${iconFilename}`;
}

async function buildFullInventorySlots(characterId: string): Promise<InventorySlotDto[]> {
  const rows = await getInventoryWithDefinitions(characterId);
  return rows.map((r) => ({
    slot_id: r.id,
    item_def_id: r.item_def_id,
    quantity: r.quantity,
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
    },
  }));
}

// ---------------------------------------------------------------------------
// crafting.open
// ---------------------------------------------------------------------------

async function handleCraftingOpen(session: AuthenticatedSession, payload: unknown): Promise<void> {
  const { npc_id } = payload as CraftingOpenPayload;
  const characterId = session.characterId;
  if (!characterId) { reject(session, 'open', 'NOT_AT_NPC', 'No character.'); return; }

  const npc = await getNpcById(npc_id);
  if (!npc || !npc.is_crafter) {
    reject(session, 'open', 'NPC_NOT_CRAFTER', 'This NPC does not offer crafting.');
    return;
  }

  // Auto-complete expired sessions
  await completeExpiredSessions(characterId, npc_id);

  const recipes = await getRecipesByNpcId(npc_id);
  const recipeDtos = [];
  for (const recipe of recipes) {
    const ingredients = await getRecipeIngredients(recipe.id);
    const dto = await buildRecipeDto(recipe, ingredients);
    if (dto) recipeDtos.push(dto);
  }

  const activeSessions = await getActiveSessionsForCharacterAtNpc(characterId, npc_id);
  const sessionDtos = activeSessions.map(buildSessionDto);

  log('debug', 'crafting', 'crafting_open', { characterId, npcId: npc_id, recipeCount: recipeDtos.length, activeCount: sessionDtos.length });

  sendToSession(session, 'crafting.state', {
    npc_id,
    recipes: recipeDtos,
    active_sessions: sessionDtos,
  });
}

// ---------------------------------------------------------------------------
// crafting.start
// ---------------------------------------------------------------------------

async function handleCraftingStart(session: AuthenticatedSession, payload: unknown): Promise<void> {
  const { npc_id, recipe_id, quantity } = payload as CraftingStartPayload;
  const characterId = session.characterId;
  if (!characterId) { reject(session, 'start', 'NOT_AT_NPC'); return; }

  // Validate quantity
  if (!Number.isInteger(quantity) || quantity < 1) {
    reject(session, 'start', 'INVALID_QUANTITY', 'Quantity must be a positive integer.');
    return;
  }

  // Validate NPC
  const npc = await getNpcById(npc_id);
  if (!npc || !npc.is_crafter) {
    reject(session, 'start', 'NPC_NOT_CRAFTER');
    return;
  }

  // Validate recipe belongs to NPC
  const recipe = await getRecipeById(recipe_id);
  if (!recipe || recipe.npc_id !== npc_id) {
    reject(session, 'start', 'RECIPE_NOT_FOUND');
    return;
  }

  // Check no active session for this recipe at this NPC
  const existing = await getActiveSessionForRecipeAtNpc(characterId, recipe_id, npc_id);
  if (existing) {
    reject(session, 'start', 'ALREADY_CRAFTING', 'You are already crafting this recipe.');
    return;
  }

  // Get recipe ingredients
  const ingredients = await getRecipeIngredients(recipe_id);

  // Get character inventory (unequipped only)
  const character = await findByAccountId(session.accountId!);
  if (!character) { reject(session, 'start', 'NOT_AT_NPC'); return; }

  const inventoryRows = await getInventoryWithDefinitions(characterId);

  // Check materials (unequipped inventory items only — equipped items have is_equipped flag)
  // In this system, inventory_items are separate from equipment, so all inventory rows are unequipped
  for (const ing of ingredients) {
    const totalOwned = inventoryRows
      .filter((r) => r.item_def_id === ing.item_def_id)
      .reduce((sum, r) => sum + r.quantity, 0);
    const needed = ing.quantity * quantity;
    if (totalOwned < needed) {
      const itemDef = await getItemDefinitionById(ing.item_def_id);
      reject(session, 'start', 'INSUFFICIENT_MATERIALS', `Need ${needed}x ${itemDef?.name ?? 'item'}, have ${totalOwned}.`);
      return;
    }
  }

  // Check crowns
  const totalCrowns = recipe.cost_crowns * quantity;
  if (totalCrowns > 0 && character.crowns < totalCrowns) {
    reject(session, 'start', 'INSUFFICIENT_CROWNS', `Need ${totalCrowns} Crowns, have ${character.crowns}.`);
    return;
  }

  // All validations passed — execute in transaction-like sequence
  // Deduct crowns
  let newCrownBalance = character.crowns;
  if (totalCrowns > 0) {
    const result = await deductCrowns(characterId, totalCrowns);
    if (result === null) {
      reject(session, 'start', 'INSUFFICIENT_CROWNS');
      return;
    }
    newCrownBalance = result;
  }

  // Deduct materials from inventory
  for (const ing of ingredients) {
    let remaining = ing.quantity * quantity;
    for (const row of inventoryRows) {
      if (row.item_def_id !== ing.item_def_id || remaining <= 0) continue;
      const deduct = Math.min(remaining, row.quantity);
      const newQty = row.quantity - deduct;
      if (newQty <= 0) {
        await query('DELETE FROM inventory_items WHERE id = $1', [row.id]);
      } else {
        await updateInventoryQuantity(row.id, newQty);
      }
      remaining -= deduct;
      row.quantity = newQty; // Update in-memory for multi-slot deduction
    }
  }

  // Create session
  const totalDuration = recipe.craft_time_seconds * quantity;
  const craftSession = await createSession({
    character_id: characterId,
    recipe_id,
    npc_id,
    quantity,
    total_duration_seconds: totalDuration,
    cost_crowns: totalCrowns,
  });

  // Snapshot costs for refund
  for (const ing of ingredients) {
    await insertSessionCost(craftSession.id, ing.item_def_id, ing.quantity * quantity);
  }

  // Build response
  const updatedSlots = await buildFullInventorySlots(characterId);
  const sessionDto = buildSessionDto(craftSession);

  log('info', 'crafting', 'crafting_started', {
    characterId,
    recipeId: recipe_id,
    recipeName: recipe.name,
    npcId: npc_id,
    quantity,
    totalCrowns,
    totalDurationSeconds: totalDuration,
    sessionId: craftSession.id,
  });

  sendToSession(session, 'crafting.started', {
    session: sessionDto,
    new_crowns: newCrownBalance,
    updated_slots: updatedSlots,
  });
}

// ---------------------------------------------------------------------------
// crafting.cancel
// ---------------------------------------------------------------------------

async function handleCraftingCancel(session: AuthenticatedSession, payload: unknown): Promise<void> {
  const { session_id } = payload as CraftingCancelPayload;
  const characterId = session.characterId;
  if (!characterId) { reject(session, 'cancel', 'SESSION_NOT_FOUND'); return; }

  const craftSession = await getSessionById(session_id);
  if (!craftSession || craftSession.character_id !== characterId) {
    reject(session, 'cancel', 'SESSION_NOT_FOUND');
    return;
  }

  if (craftSession.status !== 'in_progress') {
    reject(session, 'cancel', 'SESSION_NOT_IN_PROGRESS');
    return;
  }

  // Calculate refunds (50% rounded down)
  const costs = await getSessionCosts(session_id);
  const refundedItems: { item_def_id: number; quantity: number }[] = [];
  for (const cost of costs) {
    const refundQty = Math.floor(cost.quantity_spent * 0.5);
    if (refundQty > 0) {
      refundedItems.push({ item_def_id: cost.item_def_id, quantity: refundQty });
    }
  }
  const refundedCrowns = Math.floor(craftSession.cost_crowns * 0.5);

  // Check inventory capacity for refunded materials
  const currentSlotCount = await getInventorySlotCount(characterId);
  let slotsNeeded = 0;
  for (const item of refundedItems) {
    const existing = await findStackableSlot(characterId, item.item_def_id);
    const def = await getItemDefinitionById(item.item_def_id);
    if (existing && def?.stack_size && existing.quantity + item.quantity <= def.stack_size) {
      // Will stack, no new slot needed
    } else {
      slotsNeeded++;
    }
  }
  if (currentSlotCount + slotsNeeded > INVENTORY_CAPACITY) {
    reject(session, 'cancel', 'INVENTORY_FULL', 'Not enough inventory space for refunded materials.');
    return;
  }

  // Execute cancellation
  await updateSessionStatus(session_id, 'cancelled');

  // Refund materials
  for (const item of refundedItems) {
    const existing = await findStackableSlot(characterId, item.item_def_id);
    const def = await getItemDefinitionById(item.item_def_id);
    if (existing && def?.stack_size && existing.quantity + item.quantity <= def.stack_size) {
      await updateInventoryQuantity(existing.id, existing.quantity + item.quantity);
    } else {
      await insertInventoryItem(characterId, item.item_def_id, item.quantity);
    }
  }

  // Refund crowns
  let newCrownBalance = 0;
  if (refundedCrowns > 0) {
    newCrownBalance = await addCrowns(characterId, refundedCrowns);
  } else {
    const character = await findByAccountId(session.accountId!);
    newCrownBalance = character?.crowns ?? 0;
  }

  const updatedSlots = await buildFullInventorySlots(characterId);

  log('info', 'crafting', 'crafting_cancelled', {
    characterId,
    sessionId: session_id,
    recipeId: craftSession.recipe_id,
    refundedCrowns,
    refundedItems,
  });

  sendToSession(session, 'crafting.cancelled', {
    session_id,
    refunded_crowns: refundedCrowns,
    refunded_items: refundedItems,
    new_crowns: newCrownBalance,
    updated_slots: updatedSlots,
  });
}

// ---------------------------------------------------------------------------
// crafting.collect
// ---------------------------------------------------------------------------

async function handleCraftingCollect(session: AuthenticatedSession, payload: unknown): Promise<void> {
  const { session_id } = payload as CraftingCollectPayload;
  const characterId = session.characterId;
  if (!characterId) { reject(session, 'collect', 'SESSION_NOT_FOUND'); return; }

  const craftSession = await getSessionById(session_id);
  if (!craftSession || craftSession.character_id !== characterId) {
    reject(session, 'collect', 'SESSION_NOT_FOUND');
    return;
  }

  // Auto-complete if time elapsed
  const progress = calculateProgress(craftSession);
  if (craftSession.status === 'in_progress' && progress.isComplete) {
    await updateSessionStatus(session_id, 'completed');
    craftSession.status = 'completed';
  }

  if (craftSession.status !== 'completed') {
    reject(session, 'collect', 'SESSION_NOT_COMPLETED', 'Crafting is not yet complete.');
    return;
  }

  // Get recipe for output info
  const recipe = await getRecipeById(craftSession.recipe_id);
  if (!recipe) {
    reject(session, 'collect', 'ITEM_DEF_NOT_FOUND', 'Recipe no longer exists.');
    return;
  }

  const outputDef = await getItemDefinitionById(recipe.output_item_id);
  if (!outputDef) {
    reject(session, 'collect', 'ITEM_DEF_NOT_FOUND', 'Output item no longer exists.');
    return;
  }

  const totalOutputQty = recipe.output_quantity * craftSession.quantity;

  // Check inventory capacity
  const slotCount = await getInventorySlotCount(characterId);
  const existingStack = await findStackableSlot(characterId, recipe.output_item_id);
  const canStack = existingStack && outputDef.stack_size != null && existingStack.quantity + totalOutputQty <= outputDef.stack_size;
  if (!canStack && slotCount >= INVENTORY_CAPACITY) {
    reject(session, 'collect', 'INVENTORY_FULL', 'Not enough inventory space for crafted items.');
    return;
  }

  // Grant items
  await grantItemToCharacter(session, characterId, recipe.output_item_id, totalOutputQty);

  // Mark collected
  await updateSessionStatus(session_id, 'collected');

  const updatedSlots = await buildFullInventorySlots(characterId);

  log('info', 'crafting', 'crafting_collected', {
    characterId,
    sessionId: session_id,
    recipeId: craftSession.recipe_id,
    outputItemId: recipe.output_item_id,
    totalOutputQty,
  });

  sendToSession(session, 'crafting.collected', {
    session_id,
    items_received: [{ item_def_id: recipe.output_item_id, quantity: totalOutputQty }],
    updated_slots: updatedSlots,
  });
}

// ---------------------------------------------------------------------------
// Register handlers
// ---------------------------------------------------------------------------

export function registerCraftingHandlers(): void {
  registerHandler('crafting.open', handleCraftingOpen);
  registerHandler('crafting.start', handleCraftingStart);
  registerHandler('crafting.cancel', handleCraftingCancel);
  registerHandler('crafting.collect', handleCraftingCollect);
}
