# WebSocket Message Contracts: Building Actions & Map Travel

**Feature Branch**: `006-building-actions`
**Protocol Version**: `v: 1` (backward compatible extension)
**Date**: 2026-03-03

---

## Modified Messages

### `world.state` → `city_map.buildings[]` — EXTENDED

The `CityMapBuilding` entry within `world.state.city_map.buildings` gains two new fields. All existing fields are unchanged. The change is backward compatible — clients that do not read `description` or `actions` continue to function normally.

```typescript
interface CityMapBuilding {
  id: number;
  name: string;
  description: string;          // NEW — empty string when not set
  node_id: number;
  label_x: number;
  label_y: number;
  actions: BuildingActionDto[]; // NEW — may be empty array
  hotspot?: {
    type: 'rect' | 'circle';
    x: number;
    y: number;
    w?: number;
    h?: number;
    r?: number;
  };
}

// NEW — represents a single configured action on a building
interface BuildingActionDto {
  id: number;
  action_type: 'travel';        // only 'travel' for this feature
  label: string;                // e.g. "Travel to Harbor" — pre-computed server-side
  config: TravelActionDto;
}

interface TravelActionDto {
  target_zone_id: number;
  target_zone_name: string;     // resolved zone name for display
  target_node_id: number;
}
```

**Server population rule**: `label` is built by the server as `"Travel to {target_zone_name}"`.

---

### `city.building_arrived` (Server → Client) — UNCHANGED

No changes to this message. The client now has all building data (including description and actions) from the `world.state` payload and can look up building details by `building_id`.

```typescript
// type: 'city.building_arrived', v: 1  — unchanged
interface CityBuildingArrivedPayload {
  building_id: number;
  building_name: string;
  node_id: number;
}
```

---

## New Messages

### `city.building_action` (Client → Server)

Sent when the player activates an action button in the building panel.

```typescript
// type: 'city.building_action', v: 1
interface CityBuildingActionPayload {
  building_id: number;  // must match the building the player is currently at
  action_id: number;    // ID of the specific building_action row to execute
  action_type: 'travel';
}
```

**Server validation**:
1. Player must be on a city-type map.
2. Player must not be in combat.
3. `building_id` must exist and have `node_id === player.current_node_id`.
4. `action_id` must belong to `building_id` and have `action_type === 'travel'`.
5. Travel action config must reference a valid, existing zone and node.

**Server behavior on success**:
1. Update `characters.zone_id = target_zone_id` and `characters.current_node_id = target_node_id`.
2. Remove player from old zone's active set; add to new zone's active set.
3. Broadcast `city.player_left` to old zone players.
4. Send `world.state` for the new zone to the player.
5. Broadcast new player presence to the new zone's players (existing `city.player_joined` or equivalent mechanism).
6. Emit structured log: `{ event: 'player_travel', character_id, from_zone_id, to_zone_id, building_id, action_id }`.

---

### `city.building_action_rejected` (Server → Client)

Sent when a `city.building_action` request fails validation.

```typescript
// type: 'city.building_action_rejected', v: 1
interface CityBuildingActionRejectedPayload {
  reason:
    | 'NOT_AT_BUILDING'       // player.current_node_id !== building.node_id
    | 'INVALID_ACTION'        // action_id not found on this building
    | 'INVALID_DESTINATION'   // target zone or node no longer exists
    | 'IN_COMBAT'             // player is engaged in combat
    | 'NOT_CITY_MAP';         // player is not on a city-type zone
}
```

**Client behavior on receipt**:
1. If fade-out animation is in progress → call `camera.fadeIn` immediately to reverse.
2. Re-enable all action buttons in the building panel.
3. Display the rejection reason as a brief error message in the panel.

---

## Admin REST API Changes

### Modified: `PUT /api/maps/:id/buildings/:buildingId`

Added optional `description` field.

| Method | Path | Body | Response |
|--------|------|------|----------|
| PUT | `/maps/:id/buildings/:buildingId` | `{ name?, description?, node_id?, label_offset_x?, label_offset_y?, hotspot? }` | `{ building: Building }` |

### New: Building Actions Sub-Resource

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/maps/:id/buildings/:buildingId/actions` | — | `{ actions: BuildingAction[] }` |
| POST | `/maps/:id/buildings/:buildingId/actions` | `{ action_type: 'travel', sort_order?: number, config: TravelConfig }` | `{ action: BuildingAction }` |
| PUT | `/maps/:id/buildings/:buildingId/actions/:actionId` | `{ sort_order?: number, config?: TravelConfig }` | `{ action: BuildingAction }` |
| DELETE | `/maps/:id/buildings/:buildingId/actions/:actionId` | — | `{ success: true }` |

**TravelConfig** body shape:
```jsonc
{
  "target_zone_id": 2,
  "target_node_id": 15
}
```

**Validation** (server-side, on POST/PUT):
- `target_zone_id` must reference an existing `map_zones.id`.
- `target_node_id` must reference an existing `path_nodes.id` belonging to `target_zone_id`.
- `action_type` must be one of the allowed values (`'travel'`).

**Building response type** (extended):
```typescript
interface Building {
  id: number;
  zone_id: number;
  node_id: number;
  name: string;
  description: string | null;  // NEW
  label_offset_x: number | null;
  label_offset_y: number | null;
  hotspot_type: string | null;
  hotspot_x: number | null;
  hotspot_y: number | null;
  hotspot_w: number | null;
  hotspot_h: number | null;
  hotspot_r: number | null;
}

interface BuildingAction {
  id: number;
  building_id: number;
  action_type: 'travel';
  sort_order: number;
  config: TravelConfig;
  created_at: string;
}

interface TravelConfig {
  target_zone_id: number;
  target_node_id: number;
}
```

---

## Protocol Compatibility

All changes are backward compatible:
- New fields in `CityMapBuilding` (`description`, `actions`) are additive; old clients ignore them.
- New message types (`city.building_action`, `city.building_action_rejected`) are opt-in; only clients that send `city.building_action` receive `city.building_action_rejected`.
- No existing message types are removed or have fields removed.
- Protocol version remains `v: 1`.
