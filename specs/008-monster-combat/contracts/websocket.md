# WebSocket Contract: Monster Combat System (008)

**Protocol version**: v1 (field `v: 1` in every envelope)
**Branch**: `008-monster-combat`
**Source of truth**: `shared/protocol/index.ts`

---

## Changes from Previous Version

### Removed Types

The following protocol types are removed as part of the old monster system cleanup:

| Type | Direction | Reason |
|------|-----------|--------|
| `CombatStartPayload` / `CombatStartMessage` | Client→Server | Old click-to-attack mechanic removed |
| `CombatStartedPayload` | Server→Client | Old combat flow removed |
| `CombatRoundPayload` | Server→Client | Old combat flow removed |
| `CombatEndedPayload` | Server→Client | Old combat flow removed |
| `MonsterSpawnedPayload` | Server→Client | Roaming monsters removed |
| `MonsterDespawnedPayload` | Server→Client | Roaming monsters removed |
| `MonsterInstance` (sub-type) | — | No longer needed |
| `ItemGained` (sub-type) | — | Replaced by `ItemDroppedDto` |

### Modified Types

| Type | Change |
|------|--------|
| `CityBuildingActionPayload.action_type` | Extended from `'travel'` to `'travel' \| 'explore'` |
| `BuildingActionDto` | Changed to a discriminated union: `TravelBuildingActionDto \| ExploreBuildingActionDto` |
| `WorldStatePayload.monsters` | Field removed (world-map monsters no longer exist) |
| `CityBuildingActionRejectedPayload.reason` | Added `'EXPLORE_FAILED'` |

---

## Envelope Format (unchanged)

```typescript
interface WsMessage<T> {
  type: string;
  v: 1;
  payload: T;
}
```

---

## New Sub-Types

### `ExploreActionDto`

```typescript
interface ExploreActionDto {
  encounter_chance: number;   // 0–100, informational only (not used client-side for rolls)
}
```

### `TravelBuildingActionDto` / `ExploreBuildingActionDto`

```typescript
interface TravelBuildingActionDto {
  id: number;
  action_type: 'travel';
  label: string;
  config: TravelActionDto;    // existing type: { target_zone_id, target_zone_name, target_node_id }
}

interface ExploreBuildingActionDto {
  id: number;
  action_type: 'explore';
  label: string;              // e.g. "Explore"
  config: ExploreActionDto;
}

type BuildingActionDto = TravelBuildingActionDto | ExploreBuildingActionDto;
```

### `CombatRoundRecord`

```typescript
interface CombatRoundRecord {
  round: number;
  player_attack: number;      // damage player dealt this round
  monster_attack: number;     // damage monster dealt this round (0 if monster died on player's turn)
  player_hp_after: number;
  monster_hp_after: number;
}
```

### `ItemDroppedDto`

```typescript
interface ItemDroppedDto {
  item_def_id: number;
  name: string;
  quantity: number;
  icon_url: string | null;
}
```

### `BuildingExploreResultPayload`

```typescript
interface BuildingExploreResultPayload {
  action_id: number;
  outcome: 'no_encounter' | 'combat';

  // Only present when outcome === 'combat':
  monster?: {
    id: number;
    name: string;
    icon_url: string | null;
    max_hp: number;
    attack: number;
    defense: number;
  };
  rounds?: CombatRoundRecord[];
  combat_result?: 'win' | 'loss';
  xp_gained?: number;             // only when combat_result === 'win'
  items_dropped?: ItemDroppedDto[]; // only when combat_result === 'win', may be empty
}
```

---

## Message Flows

### Flow 1: No Encounter

```
Client                           Server
  |                                |
  |-- city.building_action ------->|  { building_id, action_id, action_type: 'explore' }
  |                                |  [server rolls encounter_chance → miss]
  |<-- building.explore_result ----|  { action_id, outcome: 'no_encounter' }
```

### Flow 2: Combat — Player Wins

```
Client                           Server
  |                                |
  |-- city.building_action ------->|  { building_id, action_id, action_type: 'explore' }
  |                                |  [server rolls encounter → hit]
  |                                |  [server selects monster by weight]
  |                                |  [server resolves full fight in-memory]
  |                                |  [server applies XP + drops to character]
  |<-- building.explore_result ----|  {
  |                                |    action_id,
  |                                |    outcome: 'combat',
  |                                |    monster: { id, name, icon_url, max_hp, attack, defense },
  |                                |    rounds: [ CombatRoundRecord... ],
  |                                |    combat_result: 'win',
  |                                |    xp_gained: 150,
  |                                |    items_dropped: [ ItemDroppedDto... ]
  |                                |  }
  |<-- inventory.item_received ----|  (one per dropped item, if inventory space available)
  |<-- character.levelled_up ------|  (if XP caused a level up)
```

### Flow 3: Combat — Player Loses

```
Client                           Server
  |-- city.building_action ------->|
  |<-- building.explore_result ----|  {
  |                                |    outcome: 'combat',
  |                                |    monster: { ... },
  |                                |    rounds: [ ... ],
  |                                |    combat_result: 'loss',
  |                                |    xp_gained: 0
  |                                |  }
```

### Flow 4: Rejection (gates)

```
Client                           Server
  |-- city.building_action ------->|
  |<-- city.building_action_rejected |  { reason: 'NOT_AT_BUILDING' | 'IN_COMBAT' | ... }
```

---

## Client → Server Messages (registered handlers)

| Type string | Handler | Change |
|-------------|---------|--------|
| `city.building_action` | `handleBuildingAction` | Modified: `action_type: 'travel' \| 'explore'` |
| `combat.start` | — | **REMOVED** |

## Server → Client Messages

| Type string | Payload type | Change |
|-------------|-------------|--------|
| `building.explore_result` | `BuildingExploreResultPayload` | **NEW** |
| `city.building_action_rejected` | `CityBuildingActionRejectedPayload` | Extended with `'EXPLORE_FAILED'` reason |
| `combat.started` | — | **REMOVED** |
| `combat.round` | — | **REMOVED** |
| `combat.ended` | — | **REMOVED** |
| `monster.spawned` | — | **REMOVED** |
| `monster.despawned` | — | **REMOVED** |

---

## Admin REST API Contract

The admin REST API is not a game-state channel (REST is permitted here per Constitution I — only game state mutations must use WebSocket).

### Monster Endpoints (`/api/monsters`)

| Method | Path | Body / Query | Response | Description |
|--------|------|-------------|----------|-------------|
| GET | `/api/monsters` | — | `MonsterSummary[]` | List all monsters |
| GET | `/api/monsters/:id` | — | `MonsterDetail` | Monster with loot entries |
| POST | `/api/monsters` | `multipart/form-data` | `MonsterDetail` | Create monster (icon optional) |
| PUT | `/api/monsters/:id` | `multipart/form-data` | `MonsterDetail` | Update (icon optional) |
| DELETE | `/api/monsters/:id` | — | `204` | Delete monster + icon file |

**`MonsterSummary`**:
```typescript
{ id: number; name: string; attack: number; defense: number; hp: number; xp_reward: number; icon_url: string | null }
```

**`MonsterDetail`** = `MonsterSummary` + `{ loot: LootEntry[] }`

**`LootEntry`**:
```typescript
{ id: number; item_def_id: number; item_name: string; drop_chance: number; quantity: number; icon_url: string | null }
```

### Loot Endpoints (`/api/monsters/:id/loot`)

| Method | Path | Body | Response | Description |
|--------|------|------|----------|-------------|
| GET | `/api/monsters/:id/loot` | — | `LootEntry[]` | List loot entries |
| POST | `/api/monsters/:id/loot` | `{ item_def_id, drop_chance, quantity }` | `LootEntry` | Add loot entry |
| PUT | `/api/monsters/:id/loot/:lootId` | `{ drop_chance?, quantity? }` | `LootEntry` | Update loot entry |
| DELETE | `/api/monsters/:id/loot/:lootId` | — | `204` | Remove loot entry |

### Building Actions — Explore Config

Explore actions are created/updated via the existing `/api/maps/:id/buildings/:buildingId/actions` endpoints. No new routes needed; the `config` field shape changes based on `action_type`:

**Create explore action** (POST `/api/maps/:id/buildings/:buildingId/actions`):
```json
{
  "action_type": "explore",
  "sort_order": 0,
  "config": {
    "encounter_chance": 15,
    "monsters": [
      { "monster_id": 1, "weight": 33 },
      { "monster_id": 2, "weight": 66 }
    ]
  }
}
```

Validation (server-side):
- `encounter_chance`: integer 0–100
- `monsters`: array, required if `encounter_chance > 0`; each entry: `monster_id` must exist in `monsters` table, `weight` must be > 0
