# Data Model: Item and Inventory System (007)

**Branch**: `007-item-inventory` | **Date**: 2026-03-03

## Overview

Two new tables replace the legacy `items` and `character_items` tables. Migration 010 drops the old schema and creates the new one.

---

## Migration 010: Replace Legacy Item Schema

**File**: `backend/src/db/migrations/010_item_inventory.sql`

```sql
-- Drop legacy tables (character_items first due to FK)
DROP TABLE IF EXISTS character_items;
DROP TABLE IF EXISTS items;

-- ─────────────────────────────────────────────────────
-- item_definitions: Admin-managed item templates
-- ─────────────────────────────────────────────────────
CREATE TABLE item_definitions (
  id             SERIAL       PRIMARY KEY,
  name           VARCHAR(64)  NOT NULL UNIQUE,
  description    TEXT,
  category       VARCHAR(16)  NOT NULL
                   CHECK (category IN (
                     'resource','food','heal','weapon',
                     'boots','shield','greaves','bracer','tool'
                   )),
  weapon_subtype VARCHAR(16)
                   CHECK (weapon_subtype IN (
                     'one_handed','two_handed','dagger','wand','staff','bow'
                   )),
  -- Stat fields: non-NULL only for relevant categories
  -- attack:      weapon only
  -- defence:     boots, shield, greaves, bracer
  -- heal_power:  heal only
  -- food_power:  food only
  attack         SMALLINT CHECK (attack >= 0),
  defence        SMALLINT CHECK (defence >= 0),
  heal_power     SMALLINT CHECK (heal_power >= 0),
  food_power     SMALLINT CHECK (food_power >= 0),
  -- Stacking: NULL means not stackable; value = max stack size
  -- Stackable categories: resource, heal, food
  stack_size     SMALLINT CHECK (stack_size >= 1),
  -- Icon: NULL means use placeholder icon
  icon_filename  VARCHAR(256),
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Cross-field constraints enforced at application level (not DB):
--   weapon_subtype must be set iff category = 'weapon'
--   attack must be set only for category = 'weapon'
--   defence must be set only for equipment categories
--   heal_power must be set only for category = 'heal'
--   food_power must be set only for category = 'food'
--   stack_size must be set only for stackable categories (resource, heal, food)

-- ─────────────────────────────────────────────────────
-- inventory_items: Per-character item slots
-- ─────────────────────────────────────────────────────
CREATE TABLE inventory_items (
  id           SERIAL       PRIMARY KEY,
  character_id UUID         NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  item_def_id  INTEGER      NOT NULL REFERENCES item_definitions(id),
  quantity     SMALLINT     NOT NULL DEFAULT 1 CHECK (quantity >= 1),
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_inventory_items_character ON inventory_items(character_id);
CREATE INDEX idx_inventory_items_def ON inventory_items(item_def_id);
```

---

## Entity Definitions

### ItemDefinition

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | SERIAL | No | Auto-assigned primary key |
| name | VARCHAR(64) | No | Unique display name |
| description | TEXT | Yes | Flavour text |
| category | VARCHAR(16) | No | Enum: see below |
| weapon_subtype | VARCHAR(16) | Yes | Weapon only; enum: see below |
| attack | SMALLINT | Yes | Weapon only; >= 0 |
| defence | SMALLINT | Yes | Equipment only (boots/shield/greaves/bracer); >= 0 |
| heal_power | SMALLINT | Yes | Heal only; >= 0 |
| food_power | SMALLINT | Yes | Food only; >= 0 |
| stack_size | SMALLINT | Yes | Stackable categories only; NULL = not stackable |
| icon_filename | VARCHAR(256) | Yes | UUID.png; NULL = placeholder |
| created_at | TIMESTAMPTZ | No | Server timestamp |

**Category enum**: `resource`, `food`, `heal`, `weapon`, `boots`, `shield`, `greaves`, `bracer`, `tool`

**Weapon subtype enum**: `one_handed`, `two_handed`, `dagger`, `wand`, `staff`, `bow`

**Stackability by category**:

| Category | Stackable | Stats |
|----------|-----------|-------|
| resource | Yes | None |
| food | Yes | food_power |
| heal | Yes | heal_power |
| weapon | No | attack, weapon_subtype |
| boots | No | defence |
| shield | No | defence |
| greaves | No | defence |
| bracer | No | defence |
| tool | No | None |

---

### InventoryItem (slot)

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| id | SERIAL | No | Slot identifier (used for deletion) |
| character_id | UUID | No | Owner character |
| item_def_id | INTEGER | No | References item_definitions.id |
| quantity | SMALLINT | No | Default 1; ≥ 1; only > 1 for stackable items |
| created_at | TIMESTAMPTZ | No | Controls grid display order |

**Constraints**:
- Maximum 20 rows per `character_id` (enforced at application level)
- For stackable items (stack_size IS NOT NULL): maximum ONE row per `(character_id, item_def_id)` — enforced at application level
- For non-stackable items: multiple rows with same `item_def_id` are permitted (player can hold multiple copies)

---

## Application-Level Business Rules

### Receiving an Item

```
Input: character_id, item_def_id, quantity_to_receive

1. Load item_definition WHERE id = item_def_id
2. IF item_definition.stack_size IS NOT NULL (stackable):
   a. Find existing slot: SELECT FROM inventory_items WHERE character_id = ? AND item_def_id = ?
   b. IF slot exists:
      - new_qty = slot.quantity + quantity_to_receive
      - IF new_qty <= item_definition.stack_size:
          UPDATE quantity; DONE (no new slot consumed)
      - ELSE:
          Fill existing slot to stack_size, remainder = new_qty - stack_size
          Continue with remainder as non-stackable (steps 3-4)
   c. IF no slot exists:
      Treat as non-stackable insert (steps 3-4) with quantity = quantity_to_receive (capped at stack_size)
3. Count current slots: SELECT COUNT(*) FROM inventory_items WHERE character_id = ?
4. IF count >= 20: emit inventory.full; STOP (item NOT lost — returned to source or logged)
5. INSERT INTO inventory_items (character_id, item_def_id, quantity) VALUES (...)
6. Emit inventory.item_received to client
```

### Deleting an Item

```
Input: character_id, slot_id (inventory_items.id)

1. SELECT FROM inventory_items WHERE id = slot_id AND character_id = character_id
2. IF not found: emit inventory.delete_rejected { reason: 'NOT_FOUND' }; STOP
3. DELETE FROM inventory_items WHERE id = slot_id
4. Emit inventory.item_deleted { slot_id } to client
5. Log structured: { event: 'inventory_item_deleted', character_id, slot_id, item_def_id }
```

---

## Query File: `backend/src/db/queries/inventory.ts`

TypeScript interfaces and functions to implement:

```typescript
// --- Interfaces ---

export interface ItemDefinition {
  id: number;
  name: string;
  description: string | null;
  category: ItemCategory;
  weapon_subtype: WeaponSubtype | null;
  attack: number | null;
  defence: number | null;
  heal_power: number | null;
  food_power: number | null;
  stack_size: number | null;   // null = not stackable
  icon_filename: string | null;
  created_at: string;
}

export interface InventoryItem {
  id: number;
  character_id: string;
  item_def_id: number;
  quantity: number;
  created_at: string;
  // Joined from item_definitions (for WS payload construction):
  definition?: ItemDefinition;
}

export type ItemCategory = 'resource' | 'food' | 'heal' | 'weapon' | 'boots' | 'shield' | 'greaves' | 'bracer' | 'tool';
export type WeaponSubtype = 'one_handed' | 'two_handed' | 'dagger' | 'wand' | 'staff' | 'bow';

// --- Functions ---

// Admin CRUD
getItemDefinitions(category?: ItemCategory): Promise<ItemDefinition[]>
getItemDefinitionById(id: number): Promise<ItemDefinition | null>
createItemDefinition(data: Omit<ItemDefinition, 'id' | 'created_at'>): Promise<ItemDefinition>
updateItemDefinition(id: number, data: Partial<Omit<ItemDefinition, 'id' | 'created_at'>>): Promise<ItemDefinition | null>
deleteItemDefinition(id: number): Promise<boolean>

// Inventory queries
getInventoryWithDefinitions(characterId: string): Promise<(InventoryItem & { definition: ItemDefinition })[]>
getInventorySlotCount(characterId: string): Promise<number>
findStackableSlot(characterId: string, itemDefId: number): Promise<InventoryItem | null>
insertInventoryItem(characterId: string, itemDefId: number, quantity: number): Promise<InventoryItem>
updateInventoryQuantity(slotId: number, quantity: number): Promise<void>
deleteInventoryItem(slotId: number, characterId: string): Promise<boolean>
```

---

## Admin REST API — Icon Storage

Item icons follow the same pattern as map images:

- **Storage directory**: `backend/assets/items/icons/` (shared with game backend, same parent volume)
- **Serving**: `app.use('/item-icons', express.static(iconsDir))` on admin backend (port 4001)
- **Naming**: `crypto.randomUUID() + '.png'`
- **Format**: PNG only (magic bytes validated)
- **Size limit**: 2 MB (icons are small; map images use 10 MB)
- **Icon URL in responses**: `/item-icons/{filename}` (relative to admin backend origin)

When the game backend constructs WS payloads, it builds the icon URL using a configured base:
```
ADMIN_BASE_URL (env, default: http://localhost:4001) + '/item-icons/' + icon_filename
```
This resolves consistently in both development and production.
