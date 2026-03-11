# WebSocket Contract: Currency System (Crowns)

**Feature**: 015-currency-system
**Protocol version**: v1 (no version bump required — additive changes only)
**Date**: 2026-03-11

All messages use the existing envelope: `{ type: string, v: 1, payload: T }`.

---

## Modified Messages (additive — backward compatible)

### `world.state` (Server → Client)

**Type**: `WorldStateMessage`

The `my_character` field now includes `crowns`.

```typescript
// CharacterData (modified)
interface CharacterData {
  id: string;
  name: string;
  class_id: number;
  class_name: string;
  level: number;
  experience: number;
  max_hp: number;
  current_hp: number;
  attack_power: number;
  defence: number;
  zone_id: number;
  pos_x: number;
  pos_y: number;
  current_node_id: number | null;
  crowns: number;          // NEW — current Crown balance
}
```

**When sent**: On session initialization (after auth + character lookup).
**Consumer**: Frontend reads `my_character.crowns` to initialize StatsBar.

---

### `building.explore_result` (Server → Client)

**Type**: `BuildingExploreResultMessage`

The payload is extended with an optional `crowns_gained` field on combat win.

```typescript
interface BuildingExploreResultPayload {
  action_id: number;
  outcome: 'no_encounter' | 'combat';
  monster?: { ... };               // unchanged
  rounds?: CombatRoundRecord[];    // unchanged
  combat_result?: 'win' | 'loss';  // unchanged
  xp_gained?: number;              // unchanged
  items_dropped?: ItemDroppedDto[]; // unchanged
  crowns_gained?: number;          // NEW — Crowns awarded; omitted when 0 or loss
}
```

**When sent**: After a building explore action resolves combat.
**Consumer**: Frontend updates Crown display by incrementing by `crowns_gained`.

---

### `night.encounter_result` (Server → Client)

**Type**: `NightEncounterResultMessage`

Same extension as `building.explore_result`.

```typescript
interface NightEncounterResultPayload {
  outcome: 'combat';
  monster: { ... };                // unchanged
  rounds: CombatRoundRecord[];     // unchanged
  combat_result: 'win' | 'loss';   // unchanged
  xp_gained?: number;              // unchanged
  items_dropped?: ItemDroppedDto[]; // unchanged
  crowns_gained?: number;          // NEW — Crowns awarded; omitted when 0 or loss
}
```

**When sent**: After a night random encounter resolves.
**Consumer**: Frontend updates Crown display by incrementing by `crowns_gained`.

---

## New Messages

### `character.crowns_changed` (Server → Client)

**Type**: `CharacterCrownsChangedMessage`

Sent to a specific player when their Crown balance is changed by an admin command. Carries the new authoritative absolute balance.

```typescript
// Payload
interface CharacterCrownsChangedPayload {
  crowns: number;   // new absolute Crown balance
}

// Full message
type CharacterCrownsChangedMessage = WsMessage<CharacterCrownsChangedPayload>;
// envelope: { type: 'character.crowns_changed', v: 1, payload: { crowns: number } }
```

**Trigger**: Admin issues `/crown <PlayerName> <Amount>` and the target is online.
**Consumer**: Frontend replaces the displayed Crown balance with `payload.crowns`.

**Example**:
```json
{
  "type": "character.crowns_changed",
  "v": 1,
  "payload": { "crowns": 1200 }
}
```

---

## No New Client → Server Messages

The `/crown` admin command is issued via the existing chat message flow (`chat.send` → server detects `/` prefix → `admin-command-handler`). No new client-to-server message type is required.

---

## Backward Compatibility Notes

- `CharacterData.crowns` is a new required field — clients compiled against the old protocol will not have it. Since frontend and backend are deployed together (same monorepo), this is a coordinated deploy and no backward compatibility concern exists.
- `crowns_gained` in explore/night result payloads is optional (`?`) — old frontend versions will ignore it gracefully.
- `character.crowns_changed` is a new message type — old frontends will ignore unknown message types (existing dispatcher uses a switch with a default no-op).

---

## AnyServerMessage Union Update

```typescript
// Add to AnyServerMessage union in shared/protocol/index.ts:
| CharacterCrownsChangedMessage
```
