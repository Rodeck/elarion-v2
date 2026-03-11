# Data Model: NPC System

**Feature**: 014-npc-system
**Date**: 2026-03-09

## New Tables

### `npcs`

Stores all NPC definitions managed by admins.

| Column          | Type                        | Constraints                             |
|-----------------|-----------------------------|-----------------------------------------|
| `id`            | `SERIAL`                    | PRIMARY KEY                             |
| `name`          | `VARCHAR(128)`              | NOT NULL, UNIQUE                        |
| `description`   | `TEXT`                      | NOT NULL                                |
| `icon_filename` | `VARCHAR(255)`              | NOT NULL                                |
| `created_at`    | `TIMESTAMPTZ`               | NOT NULL DEFAULT NOW()                  |

**Validation rules**:
- `name` must be non-empty (enforced at application and DB layer)
- `description` must be non-empty (application layer)
- `icon_filename` must be set before the row is saved — icon is always required

---

### `building_npcs`

Join table linking NPCs to buildings (many-to-many).

| Column        | Type      | Constraints                                           |
|---------------|-----------|-------------------------------------------------------|
| `id`          | `SERIAL`  | PRIMARY KEY                                           |
| `building_id` | `INTEGER` | NOT NULL, FK → `buildings(id)` ON DELETE CASCADE      |
| `npc_id`      | `INTEGER` | NOT NULL, FK → `npcs(id)` ON DELETE CASCADE           |
| `sort_order`  | `INTEGER` | NOT NULL DEFAULT 0                                    |

**Unique constraint**: `UNIQUE (building_id, npc_id)` — prevents duplicate assignments.

**Cascade behavior**:
- Deleting a building cascades to remove all its `building_npcs` rows.
- Deleting an NPC cascades to remove all its `building_npcs` rows, satisfying FR-009.

---

## Modified Tables

### `buildings` (no schema change)

No schema changes needed. NPC assignments are stored in the `building_npcs` join table. The `buildings` table is extended functionally via a JOIN when loading data, not structurally.

---

## Migration

**File**: `backend/src/db/migrations/016_npcs.sql`

```sql
CREATE TABLE npcs (
  id           SERIAL PRIMARY KEY,
  name         VARCHAR(128) NOT NULL UNIQUE,
  description  TEXT NOT NULL,
  icon_filename VARCHAR(255) NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE building_npcs (
  id          SERIAL PRIMARY KEY,
  building_id INTEGER NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  npc_id      INTEGER NOT NULL REFERENCES npcs(id) ON DELETE CASCADE,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  UNIQUE (building_id, npc_id)
);
```

---

## New Shared Protocol Types

### `NpcDto`

Sent to the game client as part of building data.

```typescript
interface NpcDto {
  id: number;
  name: string;
  icon_url: string;  // e.g. "/npc-icons/abc123.png"
}
```

### `CityMapBuilding` (extended)

The existing type gains a new `npcs` field. Empty array `[]` when no NPCs are assigned.

```typescript
interface CityMapBuilding {
  id: number;
  name: string;
  description: string;
  node_id: number;
  label_x: number;
  label_y: number;
  actions: BuildingActionDto[];
  hotspot?: { type: 'rect' | 'circle'; x: number; y: number; w?: number; h?: number; r?: number };
  npcs: NpcDto[];  // NEW — always present, empty array when no NPCs assigned
}
```

---

## Relationships Summary

```
npcs (1) ──── (M) building_npcs (M) ──── (1) buildings
```

- One NPC can appear in many buildings.
- One building can have many NPCs.
- Join table enforces uniqueness and handles cascade deletes.

---

## Icon Asset Storage

| Asset type  | Storage path                         | Served URL prefix    |
|-------------|--------------------------------------|----------------------|
| NPC icons   | `backend/assets/npcs/icons/`         | `/npc-icons/`        |

Follows the same pattern as item icons (`backend/assets/items/icons/` → `/item-icons/`) and monster icons.
