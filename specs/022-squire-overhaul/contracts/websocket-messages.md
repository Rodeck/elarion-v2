# WebSocket Message Contracts: Squire System Overhaul

**Branch**: `022-squire-overhaul` | **Protocol Version**: Current + extensions

## New Protocol Types

### Shared Types (`shared/protocol/index.ts`)

```typescript
// Squire definition as seen by admin/client
export interface SquireDefinitionDto {
  id: number;
  name: string;
  icon_url: string | null;
  power_level: number;       // 0–100
  is_active: boolean;
}

// Player-owned squire instance
export interface CharacterSquireDto {
  id: number;                 // character_squires.id
  squire_def_id: number;
  name: string;               // from squire_definitions.name
  icon_url: string | null;
  level: number;              // 1–20
  rank: string;               // resolved from SQUIRE_RANKS[level-1]
  power_level: number;        // from squire_definitions.power_level
  status: 'idle' | 'on_expedition';
}

// Squire roster (full list for a character)
export interface SquireRosterDto {
  squires: CharacterSquireDto[];
  slots_unlocked: number;     // currently unlocked (e.g. 2)
  slots_total: number;        // max possible (5)
}
```

### Extended: `ExpeditionStateDto`

```typescript
export interface ExpeditionStateDto {
  action_id: number;
  // REMOVED: squire_name (single squire)
  // ADDED: list of idle squires to choose from
  available_squires?: CharacterSquireDto[];  // present when no active expedition
  active_squire?: CharacterSquireDto;        // present when expedition in progress
  squire_status: SquireStatus;
  expedition_id?: number;
  started_at?: string;
  completes_at?: string;
  collectable_rewards?: CollectableRewards;
  duration_options?: ExpeditionDurationOption[];
}
```

### Extended: `RewardType`

```typescript
export type RewardType = 'item' | 'xp' | 'crowns' | 'squire';
```

### Extended: `GatheringTickEvent`

```typescript
export interface GatheringTickEvent {
  type: 'resource' | 'gold' | 'monster' | 'accident' | 'nothing' | 'squire';
  // ... existing fields ...
  squire_name?: string;       // NEW: for 'squire' type
  squire_icon_url?: string;   // NEW
  squire_rank?: string;       // NEW
}
```

### Extended: `CombatEndPayload`

```typescript
export interface CombatEndPayload {
  // ... existing fields ...
  squires_dropped?: SquireDroppedDto[];  // NEW
}

export interface SquireDroppedDto {
  squire_def_id: number;
  name: string;
  level: number;
  rank: string;
  icon_url: string | null;
}
```

## New Client → Server Messages

### `squire.roster` — Request squire roster

**Trigger**: Player opens squire roster UI or connects to game.

```typescript
// No payload required
type SquireRosterRequest = Record<string, never>;
```

### `expedition.dispatch` — Extended

**Change**: Add `squire_id` field to payload.

```typescript
export interface ExpeditionDispatchPayload {
  building_id: number;
  action_id: number;
  duration_hours: 1 | 3 | 6;
  squire_id: number;           // NEW: character_squires.id — which squire to send
}
```

### `squire.dismiss_list` — Request dismissable squires

**Trigger**: Player selects "I want to dismiss a squire" at a dismisser NPC.

```typescript
export interface SquireDismissListPayload {
  npc_id: number;              // the dismisser NPC
}
```

### `squire.dismiss_confirm` — Confirm squire dismissal

**Trigger**: Player confirms dismissal of a specific squire.

```typescript
export interface SquireDismissConfirmPayload {
  squire_id: number;           // character_squires.id to dismiss
}
```

## New Server → Client Messages

### `squire.roster_update` — Full roster state

**Trigger**: On connect, after acquisition, after dismissal, after expedition state changes.

```typescript
export type SquireRosterUpdatePayload = SquireRosterDto;
```

### `squire.acquired` — New squire obtained

**Trigger**: After combat loot, quest reward, or gathering event grants a squire.

```typescript
export interface SquireAcquiredPayload {
  squire: CharacterSquireDto;
  source: 'combat' | 'quest' | 'gathering' | 'exploration';
  updated_roster: SquireRosterDto;
}
```

### `squire.acquisition_failed` — Roster full

**Trigger**: Squire drop occurs but no slots available.

```typescript
export interface SquireAcquisitionFailedPayload {
  reason: 'ROSTER_FULL';
  squire_name: string;         // what they would have gotten
}
```

### `squire.dismiss_list_result` — Available squires for dismissal

```typescript
export interface SquireDismissListResultPayload {
  squires: CharacterSquireDto[];  // only idle squires
}
```

### `squire.dismissed` — Squire successfully dismissed

```typescript
export interface SquireDismissedPayload {
  squire_id: number;
  squire_name: string;
  updated_roster: SquireRosterDto;
}
```

### `squire.dismiss_rejected` — Dismissal failed

```typescript
export interface SquireDismissRejectedPayload {
  reason: 'NOT_FOUND' | 'ON_EXPEDITION' | 'NOT_AT_NPC' | 'NPC_NOT_DISMISSER';
}
```

### Extended: `expedition.dispatch_rejected`

Add new rejection reason:

```typescript
// Existing reasons + new:
type ExpeditionDispatchRejectionReason =
  | 'NO_SQUIRE_AVAILABLE'
  | 'INVALID_DURATION'
  | 'NOT_AT_BUILDING'
  | 'NO_EXPEDITION_CONFIG'
  | 'IN_COMBAT'
  | 'NOT_CITY_MAP'
  | 'SQUIRE_NOT_IDLE'       // NEW: selected squire is on expedition
  | 'SQUIRE_NOT_FOUND';     // NEW: squire_id doesn't belong to player
```

## Admin REST API Extensions

### `POST /api/squire-definitions`

Create a new squire definition.

```json
{
  "name": "Brand",
  "power_level": 50
}
```

Response `201`:
```json
{
  "id": 1,
  "name": "Brand",
  "icon_filename": null,
  "power_level": 50,
  "is_active": true
}
```

### `PUT /api/squire-definitions/:id`

Update a squire definition.

### `PUT /api/squire-definitions/:id/deactivate`

Deactivate (soft-delete) a squire definition.

### `POST /api/squire-definitions/:id/icon`

Upload squire icon (multipart/form-data). Follows `POST /api/npcs/:id/icon` pattern.

### `GET /api/squire-definitions`

List all squire definitions.

### `POST /api/monsters/:id/squire-loot`

Add a squire to a monster's loot table.

```json
{
  "squire_def_id": 1,
  "drop_chance": 10,
  "squire_level": 5
}
```

### `DELETE /api/monsters/:id/squire-loot/:lootId`

Remove a squire loot entry.

### `PUT /api/npcs/:id/squire-dismisser`

Set/unset a NPC as squire dismisser.

```json
{
  "is_squire_dismisser": true
}
```

### Extended: `POST /api/quests`

Quest rewards array now accepts `reward_type: 'squire'`:

```json
{
  "rewards": [
    { "reward_type": "squire", "target_id": 1, "quantity": 5 }
  ]
}
```

Where `target_id` = `squire_definitions.id`, `quantity` = squire level (1–20).

### Extended: `POST /api/maps/:id/buildings/:bid/actions` (gather type)

Gather event configs now accept `type: 'squire'`:

```json
{
  "action_type": "gather",
  "config": {
    "events": [
      { "type": "squire", "weight": 2, "squire_def_id": 1, "squire_level": 3 }
    ]
  }
}
```
