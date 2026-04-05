import { query } from '../connection';
import { config } from '../../config';

// ---------------------------------------------------------------------------
// TypeScript interfaces for DB rows
// ---------------------------------------------------------------------------

export interface MarketplaceListingRow {
  id: number;
  building_id: number;
  seller_id: string;
  item_def_id: number;
  quantity: number;
  price_per_item: number;
  current_durability: number | null;
  status: string;
  seller_collected: boolean;
  created_at: Date;
  expires_at: Date;
  sold_at: Date | null;
  buyer_id: string | null;
}

export interface ListingSummaryRow {
  item_def_id: number;
  name: string;
  category: string;
  icon_filename: string | null;
  total_quantity: string; // bigint from SUM
  listing_count: string; // bigint from COUNT
  min_price_per_item: number;
  max_price_per_item: number;
}

export interface ListingDetailRow extends MarketplaceListingRow {
  seller_name: string;
  max_durability: number | null;
}

export interface SellerListingRow extends MarketplaceListingRow {
  item_name: string;
  icon_filename: string | null;
}

function buildIconUrl(iconFilename: string | null): string | null {
  if (!iconFilename) return null;
  return `${config.adminBaseUrl}/item-icons/${iconFilename}`;
}

// ---------------------------------------------------------------------------
// Browse queries
// ---------------------------------------------------------------------------

const PAGE_SIZE = 24;

export async function getActiveListingsSummary(
  buildingId: number,
  page: number,
  pageSize: number = PAGE_SIZE,
  category?: string,
  search?: string,
): Promise<{ items: ListingSummaryRow[]; totalItems: number }> {
  let where = `ml.building_id = $1 AND ml.status = 'active' AND ml.expires_at > NOW()`;
  const params: unknown[] = [buildingId];
  let paramIdx = 2;

  if (category) {
    where += ` AND d.category = $${paramIdx}`;
    params.push(category);
    paramIdx++;
  }
  if (search) {
    where += ` AND d.name ILIKE $${paramIdx}`;
    params.push(`%${search}%`);
    paramIdx++;
  }

  // Count distinct items
  const countResult = await query<{ count: string }>(
    `SELECT COUNT(DISTINCT d.id) AS count
     FROM marketplace_listings ml
     JOIN item_definitions d ON d.id = ml.item_def_id
     WHERE ${where}`,
    params,
  );
  const totalItems = parseInt(countResult.rows[0]?.count ?? '0', 10);

  // Fetch page
  const offset = (page - 1) * pageSize;
  const itemsResult = await query<ListingSummaryRow>(
    `SELECT
       d.id AS item_def_id,
       d.name,
       d.category,
       d.icon_filename,
       SUM(ml.quantity)::text AS total_quantity,
       COUNT(ml.id)::text AS listing_count,
       MIN(ml.price_per_item) AS min_price_per_item,
       MAX(ml.price_per_item) AS max_price_per_item
     FROM marketplace_listings ml
     JOIN item_definitions d ON d.id = ml.item_def_id
     WHERE ${where}
     GROUP BY d.id, d.name, d.category, d.icon_filename
     ORDER BY d.name ASC
     LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
    [...params, pageSize, offset],
  );

  return { items: itemsResult.rows, totalItems };
}

export async function getListingsForItem(
  buildingId: number,
  itemDefId: number,
): Promise<ListingDetailRow[]> {
  const result = await query<ListingDetailRow>(
    `SELECT
       ml.*,
       c.name AS seller_name,
       d.max_durability
     FROM marketplace_listings ml
     JOIN characters c ON c.id = ml.seller_id
     JOIN item_definitions d ON d.id = ml.item_def_id
     WHERE ml.building_id = $1
       AND ml.item_def_id = $2
       AND ml.status = 'active'
       AND ml.expires_at > NOW()
     ORDER BY ml.price_per_item ASC`,
    [buildingId, itemDefId],
  );
  return result.rows;
}

export async function getListingByIdForUpdate(
  listingId: number,
): Promise<MarketplaceListingRow | null> {
  const result = await query<MarketplaceListingRow>(
    `SELECT * FROM marketplace_listings WHERE id = $1 FOR UPDATE`,
    [listingId],
  );
  return result.rows[0] ?? null;
}

export async function getListingById(
  listingId: number,
): Promise<MarketplaceListingRow | null> {
  const result = await query<MarketplaceListingRow>(
    `SELECT * FROM marketplace_listings WHERE id = $1`,
    [listingId],
  );
  return result.rows[0] ?? null;
}

// ---------------------------------------------------------------------------
// Listing creation
// ---------------------------------------------------------------------------

export interface ListingInstanceStats {
  instance_attack: number | null;
  instance_defence: number | null;
  instance_crit_chance: number | null;
  instance_additional_attacks: number | null;
  instance_armor_penetration: number | null;
  instance_max_mana: number | null;
  instance_mana_on_hit: number | null;
  instance_mana_regen: number | null;
  instance_quality_tier: number | null;
}

export async function createListing(
  buildingId: number,
  sellerId: string,
  itemDefId: number,
  quantity: number,
  pricePerItem: number,
  currentDurability: number | null,
  durationDays: number,
  instanceStats?: ListingInstanceStats | null,
): Promise<number> {
  if (instanceStats && instanceStats.instance_quality_tier != null) {
    const result = await query<{ id: number }>(
      `INSERT INTO marketplace_listings
         (building_id, seller_id, item_def_id, quantity, price_per_item, current_durability, expires_at,
          instance_attack, instance_defence, instance_crit_chance, instance_additional_attacks,
          instance_armor_penetration, instance_max_mana, instance_mana_on_hit, instance_mana_regen,
          instance_quality_tier)
       VALUES ($1, $2, $3, $4, $5, $6, NOW() + $7 * INTERVAL '1 day',
               $8, $9, $10, $11, $12, $13, $14, $15, $16)
       RETURNING id`,
      [
        buildingId, sellerId, itemDefId, quantity, pricePerItem, currentDurability, durationDays,
        instanceStats.instance_attack, instanceStats.instance_defence, instanceStats.instance_crit_chance,
        instanceStats.instance_additional_attacks, instanceStats.instance_armor_penetration,
        instanceStats.instance_max_mana, instanceStats.instance_mana_on_hit, instanceStats.instance_mana_regen,
        instanceStats.instance_quality_tier,
      ],
    );
    return result.rows[0]!.id;
  }
  const result = await query<{ id: number }>(
    `INSERT INTO marketplace_listings
       (building_id, seller_id, item_def_id, quantity, price_per_item, current_durability, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW() + $7 * INTERVAL '1 day')
     RETURNING id`,
    [buildingId, sellerId, itemDefId, quantity, pricePerItem, currentDurability, durationDays],
  );
  return result.rows[0]!.id;
}

// ---------------------------------------------------------------------------
// Listing status updates
// ---------------------------------------------------------------------------

export async function updateListingToSold(
  listingId: number,
  buyerId: string,
): Promise<void> {
  await query(
    `UPDATE marketplace_listings
     SET status = 'sold', sold_at = NOW(), buyer_id = $2
     WHERE id = $1`,
    [listingId, buyerId],
  );
}

export async function updateListingToCancelled(
  listingId: number,
): Promise<void> {
  await query(
    `UPDATE marketplace_listings SET status = 'cancelled' WHERE id = $1`,
    [listingId],
  );
}

export async function markListingCollected(
  listingId: number,
  sellerId: string,
): Promise<MarketplaceListingRow | null> {
  const result = await query<MarketplaceListingRow>(
    `UPDATE marketplace_listings
     SET seller_collected = TRUE
     WHERE id = $1
       AND seller_id = $2
       AND (status = 'expired' OR (status = 'active' AND expires_at <= NOW()))
       AND seller_collected = FALSE
     RETURNING *`,
    [listingId, sellerId],
  );
  return result.rows[0] ?? null;
}

// ---------------------------------------------------------------------------
// Seller listing queries
// ---------------------------------------------------------------------------

export async function countSellerActiveListings(sellerId: string): Promise<number> {
  const result = await query<{ count: string }>(
    `SELECT COUNT(*) AS count
     FROM marketplace_listings
     WHERE seller_id = $1
       AND (
         status = 'active'
         OR (status IN ('sold', 'expired') AND seller_collected = FALSE)
       )`,
    [sellerId],
  );
  return parseInt(result.rows[0]?.count ?? '0', 10);
}

export async function getSellerListings(
  buildingId: number,
  sellerId: string,
): Promise<SellerListingRow[]> {
  const result = await query<SellerListingRow>(
    `SELECT
       ml.*,
       d.name AS item_name,
       d.icon_filename
     FROM marketplace_listings ml
     JOIN item_definitions d ON d.id = ml.item_def_id
     WHERE ml.building_id = $1
       AND ml.seller_id = $2
       AND ml.status != 'cancelled'
       AND ml.seller_collected = FALSE
     ORDER BY ml.created_at DESC`,
    [buildingId, sellerId],
  );
  return result.rows;
}

// ---------------------------------------------------------------------------
// Earnings queries
// ---------------------------------------------------------------------------

export async function getOrCreateEarnings(
  buildingId: number,
  sellerId: string,
): Promise<number> {
  await query(
    `INSERT INTO marketplace_earnings (building_id, seller_id)
     VALUES ($1, $2)
     ON CONFLICT (building_id, seller_id) DO NOTHING`,
    [buildingId, sellerId],
  );
  const result = await query<{ pending_crowns: number }>(
    `SELECT pending_crowns FROM marketplace_earnings
     WHERE building_id = $1 AND seller_id = $2`,
    [buildingId, sellerId],
  );
  return result.rows[0]?.pending_crowns ?? 0;
}

export async function addEarnings(
  buildingId: number,
  sellerId: string,
  amount: number,
): Promise<void> {
  await query(
    `INSERT INTO marketplace_earnings (building_id, seller_id, pending_crowns)
     VALUES ($1, $2, $3)
     ON CONFLICT (building_id, seller_id)
     DO UPDATE SET pending_crowns = marketplace_earnings.pending_crowns + $3`,
    [buildingId, sellerId, amount],
  );
}

export async function collectEarnings(
  buildingId: number,
  sellerId: string,
): Promise<number> {
  // Read the current amount first, then zero it out
  const readResult = await query<{ pending_crowns: number }>(
    `SELECT pending_crowns FROM marketplace_earnings
     WHERE building_id = $1 AND seller_id = $2 AND pending_crowns > 0`,
    [buildingId, sellerId],
  );
  const amount = readResult.rows[0]?.pending_crowns ?? 0;

  if (amount > 0) {
    await query(
      `UPDATE marketplace_earnings SET pending_crowns = 0
       WHERE building_id = $1 AND seller_id = $2`,
      [buildingId, sellerId],
    );
  }

  if (amount > 0) {
    // Mark all sold listings as collected for this seller at this building
    await query(
      `UPDATE marketplace_listings
       SET seller_collected = TRUE
       WHERE building_id = $1 AND seller_id = $2 AND status = 'sold' AND seller_collected = FALSE`,
      [buildingId, sellerId],
    );
  }

  return amount;
}

// Re-export buildIconUrl for use by service layer
export { buildIconUrl };
