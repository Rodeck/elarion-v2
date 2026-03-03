# Data Model: Building Actions & Map Travel

**Feature Branch**: `006-building-actions`
**Date**: 2026-03-03

---

## Database Schema Changes

### Modified: `buildings` table

```sql
ALTER TABLE buildings
  ADD COLUMN description TEXT;
```

No default — existing rows will have `NULL` description (displayed as empty in UI).

### New: `building_actions` table

```sql
CREATE TABLE building_actions (
  id          SERIAL      PRIMARY KEY,
  building_id INTEGER     NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  action_type TEXT        NOT NULL CHECK (action_type IN ('travel')),
  sort_order  INTEGER     NOT NULL DEFAULT 0,
  config      JSONB       NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_building_actions_building_id ON building_actions(building_id);
```

**Field notes**:
- `action_type`: Discriminator. Only `'travel'` is valid for this feature. Future types extend the CHECK constraint.
- `sort_order`: Display order for multiple actions on the same building. Ascending order, 0-indexed.
- `config`: Type-specific configuration stored as JSONB. Schema varies by `action_type` (see below).

---

## Action Config Schemas

### `action_type = 'travel'`

```jsonc
{
  "target_zone_id":  2,   // integer — ID of the destination zone
  "target_node_id": 15   // integer — ID of the destination node within target_zone_id
}
```

**Validation rules**:
- Both `target_zone_id` and `target_node_id` must reference existing rows
- `target_node_id` must belong to `target_zone_id`
- Target zone must be a `city`-type map (tile map travel is out of scope for this feature)

---

## TypeScript Types

### Backend (`backend/src/db/queries/city-maps.ts`)

```typescript
// Extended existing interface
export interface Building {
  id: number;
  zone_id: number;
  node_id: number;
  name: string;
  description: string | null;           // NEW
  label_offset_x: number | null;
  label_offset_y: number | null;
  hotspot_type: string | null;
  hotspot_x: number | null;
  hotspot_y: number | null;
  hotspot_w: number | null;
  hotspot_h: number | null;
  hotspot_r: number | null;
}

// New
export interface BuildingAction {
  id: number;
  building_id: number;
  action_type: 'travel';
  sort_order: number;
  config: TravelActionConfig | Record<string, unknown>;
  created_at: Date;
}

export interface TravelActionConfig {
  target_zone_id: number;
  target_node_id: number;
}
```

### Protocol (`shared/protocol/index.ts`)

```typescript
// Extended — added description and actions
export interface CityMapBuilding {
  id: number;
  name: string;
  description: string;                  // NEW (empty string if null in DB)
  node_id: number;
  label_x: number;
  label_y: number;
  actions: BuildingActionDto[];         // NEW
  hotspot?: {
    type: 'rect' | 'circle';
    x: number;
    y: number;
    w?: number;
    h?: number;
    r?: number;
  };
}

// New
export interface BuildingActionDto {
  id: number;
  action_type: 'travel';
  label: string;                        // display label, e.g. "Travel to Harbor"
  config: TravelActionDto;
}

export interface TravelActionDto {
  target_zone_id: number;
  target_zone_name: string;            // resolved name for label display
  target_node_id: number;
}

// New — Client → Server
export interface CityBuildingActionPayload {
  building_id: number;
  action_type: 'travel';
  action_id: number;                   // ID of the specific building_action row
}

// New — Server → Client (rejection only; success uses existing world.state)
export interface CityBuildingActionRejectedPayload {
  reason:
    | 'NOT_AT_BUILDING'         // player's current_node_id ≠ building.node_id
    | 'INVALID_ACTION'          // action_id not found on this building
    | 'INVALID_DESTINATION'     // target zone/node deleted or invalid
    | 'IN_COMBAT'               // player is in combat
    | 'NOT_CITY_MAP';           // player is not on a city-type map
}
```

---

## Entity Relationships

```
buildings (extended)
  ├── id (PK)
  ├── zone_id → map_zones.id
  ├── node_id → path_nodes.id
  ├── name
  ├── description            ← NEW
  └── ...hotspot fields

building_actions (NEW)
  ├── id (PK)
  ├── building_id → buildings.id (CASCADE DELETE)
  ├── action_type ('travel')
  ├── sort_order
  └── config (JSONB)
       └── travel: { target_zone_id → map_zones.id, target_node_id → path_nodes.id }
```

---

## State Transitions

### Player Travel Flow

```
[Player at building node]
        │
        ▼
[client: sends city.building_action]
        │
        ▼
[server: validates]
  ├─ FAIL → sends city.building_action_rejected → client rolls back animation
  └─ PASS → updates characters (zone_id, current_node_id) in DB
              │
              ▼
           [server: broadcasts city.player_left to old zone]
              │
              ▼
           [server: sends world.state for new zone to player]
              │
              ▼
           [server: broadcasts new player presence to new zone]
              │
              ▼
           [client: receives world.state → completes fade transition → renders new map]
```

---

## Migration File

**Path**: `backend/src/db/migrations/009_building_actions.sql`

```sql
-- 009_building_actions.sql
-- Add description to buildings; create building_actions table

ALTER TABLE buildings
  ADD COLUMN description TEXT;

CREATE TABLE building_actions (
  id          SERIAL      PRIMARY KEY,
  building_id INTEGER     NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  action_type TEXT        NOT NULL CHECK (action_type IN ('travel')),
  sort_order  INTEGER     NOT NULL DEFAULT 0,
  config      JSONB       NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_building_actions_building_id
  ON building_actions(building_id);
```
