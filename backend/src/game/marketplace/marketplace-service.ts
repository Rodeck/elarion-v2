import { sendToSession } from '../../websocket/server';
import type { AuthenticatedSession } from '../../websocket/server';
import { log } from '../../logger';
import { findByAccountId } from '../../db/queries/characters';
import { addCrowns, deductCrowns } from '../../db/queries/characters';
import { getCityMapCache } from '../world/city-map-loader';
import { getBuildingActions, getBuildingById } from '../../db/queries/city-maps';
import {
  getActiveListingsSummary,
  getListingsForItem,
  getListingByIdForUpdate,
  getListingById,
  createListing,
  updateListingToSold,
  updateListingToCancelled,
  markListingCollected,
  countSellerActiveListings,
  getSellerListings,
  getOrCreateEarnings,
  addEarnings,
  collectEarnings,
  buildIconUrl,
} from '../../db/queries/marketplace';
import {
  getInventorySlotById,
  getInventorySlotCount,
  deleteInventoryItem,
  updateInventoryQuantity,
} from '../../db/queries/inventory';
import { grantItemToCharacter } from '../inventory/inventory-grant-service';
import { getClient } from '../../db/connection';
import type {
  MarketplaceBrowsePayload,
  MarketplaceItemListingsPayload,
  MarketplaceBuyPayload,
  MarketplaceListItemPayload,
  MarketplaceCancelListingPayload,
  MarketplaceMyListingsPayload,
  MarketplaceCollectCrownsPayload,
  MarketplaceCollectItemsPayload,
  MarketplaceActionConfig,
  MarketplaceItemSummary,
  MarketplaceListingDto,
  MyListingDto,
} from '@elarion/protocol';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface MarketplaceContext {
  characterId: string;
  buildingId: number;
  config: MarketplaceActionConfig;
}

async function validateMarketplaceAccess(
  session: AuthenticatedSession,
  buildingId: number,
  actionName: string,
): Promise<MarketplaceContext | null> {
  if (!session.characterId) {
    sendToSession(session, 'marketplace.rejected', { action: actionName, reason: 'CHARACTER_REQUIRED' });
    return null;
  }

  const character = await findByAccountId(session.accountId);
  if (!character) {
    sendToSession(session, 'marketplace.rejected', { action: actionName, reason: 'CHARACTER_REQUIRED' });
    return null;
  }

  const cityCache = getCityMapCache(character.zone_id);
  if (!cityCache) {
    sendToSession(session, 'marketplace.rejected', { action: actionName, reason: 'NOT_AT_BUILDING' });
    return null;
  }

  const building = await getBuildingById(buildingId);
  const currentNodeId = (character as unknown as { current_node_id: number | null }).current_node_id;
  if (!building || building.zone_id !== character.zone_id || building.node_id !== currentNodeId) {
    sendToSession(session, 'marketplace.rejected', { action: actionName, reason: 'NOT_AT_BUILDING' });
    return null;
  }

  const actions = await getBuildingActions(buildingId);
  const marketplaceAction = actions.find((a) => a.action_type === 'marketplace');
  if (!marketplaceAction) {
    sendToSession(session, 'marketplace.rejected', { action: actionName, reason: 'NOT_MARKETPLACE' });
    return null;
  }

  return {
    characterId: session.characterId,
    buildingId,
    config: marketplaceAction.config as unknown as MarketplaceActionConfig,
  };
}

// ---------------------------------------------------------------------------
// Browse & Buy (US1)
// ---------------------------------------------------------------------------

export async function browseMarketplace(
  session: AuthenticatedSession,
  payload: unknown,
): Promise<void> {
  const { building_id, page, category, search } = payload as MarketplaceBrowsePayload;
  const ctx = await validateMarketplaceAccess(session, building_id, 'marketplace.browse');
  if (!ctx) return;

  const pageNum = Math.max(1, page || 1);
  const { items, totalItems } = await getActiveListingsSummary(
    ctx.buildingId, pageNum, 24, category, search,
  );

  const totalPages = Math.max(1, Math.ceil(totalItems / 24));

  const mappedItems: MarketplaceItemSummary[] = items.map((row) => ({
    item_def_id: row.item_def_id,
    name: row.name,
    category: row.category,
    icon_url: buildIconUrl(row.icon_filename) ?? '',
    total_quantity: parseInt(row.total_quantity, 10),
    listing_count: parseInt(row.listing_count, 10),
    min_price_per_item: row.min_price_per_item,
    max_price_per_item: row.max_price_per_item,
  }));

  sendToSession(session, 'marketplace.browse_result', {
    building_id: ctx.buildingId,
    items: mappedItems,
    page: pageNum,
    total_pages: totalPages,
    total_items: totalItems,
  });

  log('debug', 'marketplace', 'browse', {
    character_id: ctx.characterId,
    building_id: ctx.buildingId,
    page: pageNum,
    category,
    search,
    results: totalItems,
  });
}

export async function getItemListings(
  session: AuthenticatedSession,
  payload: unknown,
): Promise<void> {
  const { building_id, item_def_id } = payload as MarketplaceItemListingsPayload;
  const ctx = await validateMarketplaceAccess(session, building_id, 'marketplace.item_listings');
  if (!ctx) return;

  const rows = await getListingsForItem(ctx.buildingId, item_def_id);

  const listings: MarketplaceListingDto[] = rows.map((row) => ({
    listing_id: row.id,
    seller_name: row.seller_name,
    quantity: row.quantity,
    price_per_item: row.price_per_item,
    total_price: row.quantity * row.price_per_item,
    current_durability: row.current_durability,
    max_durability: row.max_durability,
    created_at: row.created_at.toISOString(),
  }));

  sendToSession(session, 'marketplace.item_listings_result', {
    item_def_id,
    listings,
  });
}

export async function buyListing(
  session: AuthenticatedSession,
  payload: unknown,
): Promise<void> {
  const { listing_id } = payload as MarketplaceBuyPayload;

  if (!session.characterId) {
    sendToSession(session, 'marketplace.buy_result', {
      success: false, listing_id, reason: 'CHARACTER_REQUIRED',
    });
    return;
  }

  const buyerId = session.characterId;

  // Use a transaction for atomicity
  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Lock the listing row
    const listingResult = await client.query(
      `SELECT * FROM marketplace_listings WHERE id = $1 FOR UPDATE`,
      [listing_id],
    );
    const listing = listingResult.rows[0];

    if (!listing || listing.status !== 'active' || new Date(listing.expires_at) <= new Date()) {
      await client.query('ROLLBACK');
      sendToSession(session, 'marketplace.buy_result', {
        success: false, listing_id, reason: 'LISTING_UNAVAILABLE',
      });
      return;
    }

    const totalPrice = listing.quantity * listing.price_per_item;

    // Check inventory capacity
    const slotCount = await getInventorySlotCount(buyerId);
    if (slotCount >= 20) {
      await client.query('ROLLBACK');
      sendToSession(session, 'marketplace.buy_result', {
        success: false, listing_id, reason: 'INVENTORY_FULL',
      });
      return;
    }

    // Deduct crowns from buyer
    const newCrowns = await deductCrowns(buyerId, totalPrice);
    if (newCrowns === null) {
      await client.query('ROLLBACK');
      sendToSession(session, 'marketplace.buy_result', {
        success: false, listing_id, reason: 'INSUFFICIENT_CROWNS',
      });
      return;
    }

    // Mark listing as sold
    await client.query(
      `UPDATE marketplace_listings SET status = 'sold', sold_at = NOW(), buyer_id = $2 WHERE id = $1`,
      [listing_id, buyerId],
    );

    // Credit seller earnings
    await client.query(
      `INSERT INTO marketplace_earnings (building_id, seller_id, pending_crowns)
       VALUES ($1, $2, $3)
       ON CONFLICT (building_id, seller_id)
       DO UPDATE SET pending_crowns = marketplace_earnings.pending_crowns + $3`,
      [listing.building_id, listing.seller_id, totalPrice],
    );

    await client.query('COMMIT');

    // Grant item to buyer (outside transaction — uses its own session send)
    await grantItemToCharacter(session, buyerId, listing.item_def_id, listing.quantity);

    // Update buyer's crown display
    sendToSession(session, 'marketplace.buy_result', {
      success: true,
      listing_id,
      new_crowns: newCrowns,
    });

    log('info', 'marketplace', 'purchase', {
      listing_id,
      buyer_id: buyerId,
      seller_id: listing.seller_id,
      item_def_id: listing.item_def_id,
      quantity: listing.quantity,
      total_price: totalPrice,
      building_id: listing.building_id,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    log('error', 'marketplace', 'purchase_failed', {
      listing_id,
      buyer_id: buyerId,
      error: String(err),
    });
    sendToSession(session, 'marketplace.buy_result', {
      success: false, listing_id, reason: 'UNKNOWN_ERROR',
    });
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// List Items for Sale (US2)
// ---------------------------------------------------------------------------

export async function listItem(
  session: AuthenticatedSession,
  payload: unknown,
): Promise<void> {
  const { building_id, slot_id, quantity, price_per_item } = payload as MarketplaceListItemPayload;
  const ctx = await validateMarketplaceAccess(session, building_id, 'marketplace.list_item');
  if (!ctx) return;

  // Validate price
  if (!price_per_item || price_per_item < 1 || !Number.isInteger(price_per_item)) {
    sendToSession(session, 'marketplace.list_item_result', {
      success: false, reason: 'INVALID_PRICE',
    });
    return;
  }

  // Validate quantity
  if (!quantity || quantity < 1 || !Number.isInteger(quantity)) {
    sendToSession(session, 'marketplace.list_item_result', {
      success: false, reason: 'INVALID_QUANTITY',
    });
    return;
  }

  // Get inventory slot
  const slot = await getInventorySlotById(slot_id, ctx.characterId);
  if (!slot) {
    sendToSession(session, 'marketplace.list_item_result', {
      success: false, reason: 'INVALID_ITEM',
    });
    return;
  }

  // Check equipped
  if ((slot as unknown as { equipped_slot: string | null }).equipped_slot) {
    sendToSession(session, 'marketplace.list_item_result', {
      success: false, reason: 'EQUIPPED_ITEM',
    });
    return;
  }

  // Validate quantity against available
  if (quantity > slot.quantity) {
    sendToSession(session, 'marketplace.list_item_result', {
      success: false, reason: 'INVALID_QUANTITY',
    });
    return;
  }

  // Check listing limit
  const currentListings = await countSellerActiveListings(ctx.characterId);
  if (currentListings >= ctx.config.max_listings) {
    sendToSession(session, 'marketplace.list_item_result', {
      success: false, reason: 'LISTING_LIMIT',
    });
    return;
  }

  // Deduct listing fee
  const listingFee = ctx.config.listing_fee;
  if (listingFee > 0) {
    const newCrowns = await deductCrowns(ctx.characterId, listingFee);
    if (newCrowns === null) {
      sendToSession(session, 'marketplace.list_item_result', {
        success: false, reason: 'INSUFFICIENT_CROWNS',
      });
      return;
    }
  }

  // Remove items from inventory
  const durability = slot.current_durability ?? null;
  if (quantity === slot.quantity) {
    await deleteInventoryItem(slot_id, ctx.characterId);
    sendToSession(session, 'inventory.item_deleted', { slot_id });
  } else {
    await updateInventoryQuantity(slot_id, slot.quantity - quantity);
    // Send updated slot — re-fetch to get correct data
    const updatedSlot = await getInventorySlotById(slot_id, ctx.characterId);
    if (updatedSlot) {
      sendToSession(session, 'inventory.item_received', {
        slot: {
          slot_id: updatedSlot.id,
          item_def_id: updatedSlot.item_def_id,
          quantity: updatedSlot.quantity,
          current_durability: updatedSlot.current_durability,
          definition: buildDefinitionDto(updatedSlot),
        },
        stacked: true,
      });
    }
  }

  // Create listing
  const listingId = await createListing(
    ctx.buildingId,
    ctx.characterId,
    slot.item_def_id,
    quantity,
    price_per_item,
    durability,
    ctx.config.listing_duration_days,
  );

  const newListingCount = await countSellerActiveListings(ctx.characterId);

  // Get updated crowns
  const character = await findByAccountId(session.accountId);
  const updatedCrowns = character?.crowns ?? 0;

  sendToSession(session, 'marketplace.list_item_result', {
    success: true,
    new_crowns: updatedCrowns,
    listing_id: listingId,
    listings_used: newListingCount,
    listings_max: ctx.config.max_listings,
  });

  log('info', 'marketplace', 'item_listed', {
    listing_id: listingId,
    seller_id: ctx.characterId,
    building_id: ctx.buildingId,
    item_def_id: slot.item_def_id,
    quantity,
    price_per_item,
    listing_fee: listingFee,
  });
}

// ---------------------------------------------------------------------------
// Manage Listings & Collect (US3)
// ---------------------------------------------------------------------------

export async function getMyListings(
  session: AuthenticatedSession,
  payload: unknown,
): Promise<void> {
  const { building_id } = payload as MarketplaceMyListingsPayload;
  const ctx = await validateMarketplaceAccess(session, building_id, 'marketplace.my_listings');
  if (!ctx) return;

  const rows = await getSellerListings(ctx.buildingId, ctx.characterId);
  const pendingCrowns = await getOrCreateEarnings(ctx.buildingId, ctx.characterId);
  const listingsUsed = await countSellerActiveListings(ctx.characterId);

  const listings: MyListingDto[] = rows.map((row) => {
    let status: 'active' | 'sold' | 'expired' = row.status as 'active' | 'sold' | 'expired';
    if (status === 'active' && new Date(row.expires_at) <= new Date()) {
      status = 'expired';
    }
    return {
      listing_id: row.id,
      item_def_id: row.item_def_id,
      item_name: row.item_name,
      icon_url: buildIconUrl(row.icon_filename) ?? '',
      quantity: row.quantity,
      price_per_item: row.price_per_item,
      status,
      created_at: row.created_at.toISOString(),
      expires_at: row.expires_at.toISOString(),
      current_durability: row.current_durability,
    };
  });

  sendToSession(session, 'marketplace.my_listings_result', {
    building_id: ctx.buildingId,
    listings,
    pending_crowns: pendingCrowns,
    listings_used: listingsUsed,
    listings_max: ctx.config.max_listings,
  });
}

export async function collectCrownsHandler(
  session: AuthenticatedSession,
  payload: unknown,
): Promise<void> {
  const { building_id } = payload as MarketplaceCollectCrownsPayload;
  const ctx = await validateMarketplaceAccess(session, building_id, 'marketplace.collect_crowns');
  if (!ctx) return;

  const amount = await collectEarnings(ctx.buildingId, ctx.characterId);
  let newCrowns = 0;
  if (amount > 0) {
    newCrowns = await addCrowns(ctx.characterId, amount);
  } else {
    const character = await findByAccountId(session.accountId);
    newCrowns = character?.crowns ?? 0;
  }

  sendToSession(session, 'marketplace.collect_crowns_result', {
    success: true,
    crowns_collected: amount,
    new_crowns: newCrowns,
  });

  if (amount > 0) {
    log('info', 'marketplace', 'crowns_collected', {
      seller_id: ctx.characterId,
      building_id: ctx.buildingId,
      amount,
    });
  }
}

export async function collectItemsHandler(
  session: AuthenticatedSession,
  payload: unknown,
): Promise<void> {
  const { listing_id } = payload as MarketplaceCollectItemsPayload;

  if (!session.characterId) {
    sendToSession(session, 'marketplace.collect_items_result', {
      success: false, listing_id, reason: 'NOT_OWNER',
    });
    return;
  }

  // Check inventory capacity
  const slotCount = await getInventorySlotCount(session.characterId);
  if (slotCount >= 20) {
    sendToSession(session, 'marketplace.collect_items_result', {
      success: false, listing_id, reason: 'INVENTORY_FULL',
    });
    return;
  }

  const listing = await markListingCollected(listing_id, session.characterId);
  if (!listing) {
    sendToSession(session, 'marketplace.collect_items_result', {
      success: false, listing_id, reason: 'NOT_EXPIRED',
    });
    return;
  }

  // Grant items back
  await grantItemToCharacter(session, session.characterId, listing.item_def_id, listing.quantity);

  sendToSession(session, 'marketplace.collect_items_result', {
    success: true,
    listing_id,
  });

  log('info', 'marketplace', 'items_collected', {
    listing_id,
    seller_id: session.characterId,
    item_def_id: listing.item_def_id,
    quantity: listing.quantity,
  });
}

export async function cancelListing(
  session: AuthenticatedSession,
  payload: unknown,
): Promise<void> {
  const { listing_id } = payload as MarketplaceCancelListingPayload;

  if (!session.characterId) {
    sendToSession(session, 'marketplace.cancel_result', {
      success: false, listing_id, reason: 'NOT_OWNER',
    });
    return;
  }

  const listing = await getListingById(listing_id);
  if (!listing || listing.seller_id !== session.characterId) {
    sendToSession(session, 'marketplace.cancel_result', {
      success: false, listing_id, reason: 'NOT_OWNER',
    });
    return;
  }

  if (listing.status !== 'active') {
    sendToSession(session, 'marketplace.cancel_result', {
      success: false, listing_id, reason: 'NOT_ACTIVE',
    });
    return;
  }

  // Check inventory capacity
  const slotCount = await getInventorySlotCount(session.characterId);
  if (slotCount >= 20) {
    sendToSession(session, 'marketplace.cancel_result', {
      success: false, listing_id, reason: 'INVENTORY_FULL',
    });
    return;
  }

  await updateListingToCancelled(listing_id);

  // Grant items back
  await grantItemToCharacter(session, session.characterId, listing.item_def_id, listing.quantity);

  sendToSession(session, 'marketplace.cancel_result', {
    success: true,
    listing_id,
  });

  log('info', 'marketplace', 'listing_cancelled', {
    listing_id,
    seller_id: session.characterId,
    item_def_id: listing.item_def_id,
    quantity: listing.quantity,
  });
}

// ---------------------------------------------------------------------------
// Helper: build ItemDefinitionDto from inventory row
// ---------------------------------------------------------------------------

function buildDefinitionDto(row: {
  def_name: string;
  def_description: string | null;
  def_category: string;
  def_weapon_subtype: string | null;
  def_attack: number | null;
  def_defence: number | null;
  def_heal_power: number | null;
  def_food_power: number | null;
  def_stack_size: number | null;
  def_icon_filename: string | null;
  def_max_mana: number;
  def_mana_on_hit: number;
  def_mana_on_damage_taken: number;
  def_mana_regen: number;
  def_dodge_chance: number;
  def_crit_chance: number;
  def_crit_damage: number;
  def_tool_type: string | null;
  def_max_durability: number | null;
  def_power: number | null;
  item_def_id: number;
}) {
  return {
    id: row.item_def_id,
    name: row.def_name,
    description: row.def_description ?? '',
    category: row.def_category,
    weapon_subtype: row.def_weapon_subtype,
    attack: row.def_attack,
    defence: row.def_defence,
    heal_power: row.def_heal_power,
    food_power: row.def_food_power,
    stack_size: row.def_stack_size,
    icon_url: buildIconUrl(row.def_icon_filename),
    max_mana: row.def_max_mana ?? 0,
    mana_on_hit: row.def_mana_on_hit ?? 0,
    mana_on_damage_taken: row.def_mana_on_damage_taken ?? 0,
    mana_regen: row.def_mana_regen ?? 0,
    dodge_chance: row.def_dodge_chance ?? 0,
    crit_chance: row.def_crit_chance ?? 0,
    crit_damage: row.def_crit_damage ?? 0,
    tool_type: row.def_tool_type,
    max_durability: row.def_max_durability,
    power: row.def_power,
  };
}
