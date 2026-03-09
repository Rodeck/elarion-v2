# WebSocket Contract: Day/Night Cycle

**Feature**: `013-day-night-cycle`
**Protocol Version**: v1 (all messages use `{ type, v: 1, payload }` envelope)
**Date**: 2026-03-09

---

## New Message Types

### S→C: `world.day_night_changed`

Broadcast to **all connected authenticated sessions** whenever the phase transitions (natural timer expiry or admin override).

```typescript
// Payload
interface WorldDayNightChangedPayload {
  phase: 'day' | 'night';
  phase_started_at: number;   // Unix ms — when this new phase began (server clock)
  day_duration_ms: number;    // 2_700_000 (45 min) — constant, but included for client convenience
  night_duration_ms: number;  // 900_000  (15 min) — constant, but included for client convenience
}
```

**Example**:
```json
{
  "type": "world.day_night_changed",
  "v": 1,
  "payload": {
    "phase": "night",
    "phase_started_at": 1741545600000,
    "day_duration_ms": 2700000,
    "night_duration_ms": 900000
  }
}
```

**Client behaviour on receipt**:
- Update local cycle state.
- Reset and restart the progress bar from zero.
- Apply or remove the night dark overlay on the map.
- Switch progress bar colour (yellow ↔ blue/silver) and icon (sun ↔ moon).

---

### S→C: `night.encounter_result`

Sent to a **single player** after a night random encounter resolves. Triggered when the player steps to a new node (city map) or moves to a new tile (tile map) during night and the 10% encounter roll succeeds.

```typescript
interface NightEncounterResultPayload {
  outcome: 'no_encounter' | 'combat';

  // Present only when outcome === 'combat':
  monster?: {
    id: number;
    name: string;
    icon_url: string | null;
    max_hp: number;      // includes 1.1× night bonus
    attack: number;      // includes 1.1× night bonus
    defense: number;     // includes 1.1× night bonus
  };
  rounds?: CombatRoundRecord[];   // same CombatRoundRecord type as BuildingExploreResultPayload
  combat_result?: 'win' | 'loss';
  xp_gained?: number;             // only when combat_result === 'win'
  items_dropped?: ItemDroppedDto[]; // only when combat_result === 'win', may be empty
}
```

**Note**: `outcome: 'no_encounter'` is **not** sent to the client. The server silently discards no-encounter rolls. The message is only sent when `outcome === 'combat'`.

**Example (win)**:
```json
{
  "type": "night.encounter_result",
  "v": 1,
  "payload": {
    "outcome": "combat",
    "monster": {
      "id": 3,
      "name": "Dire Rat",
      "icon_url": "/assets/monster-icons/rat.png",
      "max_hp": 22,
      "attack": 6,
      "defense": 2
    },
    "rounds": [
      { "round": 1, "player_attack": 8, "monster_attack": 3, "player_hp_after": 47, "monster_hp_after": 14 },
      { "round": 2, "player_attack": 8, "monster_attack": 3, "player_hp_after": 44, "monster_hp_after": 6 },
      { "round": 3, "player_attack": 8, "monster_attack": 0, "player_hp_after": 44, "monster_hp_after": 0 }
    ],
    "combat_result": "win",
    "xp_gained": 15,
    "items_dropped": []
  }
}
```

**Client behaviour on receipt**:
- Display the combat modal (reuse existing `CombatModal` component).
- If movement was in progress (city map), it is already cancelled server-side; no client cancellation needed.

---

## Modified Messages

### S→C: `world.state` *(modified)*

The existing `world.state` message gains a new mandatory field `day_night_state`.

```typescript
// Addition to WorldStatePayload
interface WorldStatePayload {
  // ... all existing fields unchanged ...
  day_night_state: {
    phase: 'day' | 'night';
    phase_started_at: number;
    day_duration_ms: number;
    night_duration_ms: number;
  };
}
```

**Purpose**: Ensures players who connect mid-cycle immediately receive the current phase and can position the progress bar correctly without waiting for a `world.day_night_changed` broadcast.

---

## Unchanged Admin Command Infrastructure

The `/day` and `/night` commands are handled by the existing admin command pipeline:

- Client sends a `chat.send` message with `message: "/day"` or `message: "/night"`.
- `chat-handler.ts` detects the `/` prefix and routes to `admin-command-handler.ts`.
- `admin-command-handler.ts` responds with the existing `admin.command_result` message (success/failure).

No new C→S message type is introduced for admin phase control.

---

## Backward Compatibility

| Change | Impact | Mitigation |
|--------|--------|-----------|
| `world.state` gains `day_night_state` field | Existing clients that ignore unknown fields are unaffected | Field is always present (never null); old clients that do not handle it simply ignore it |
| Two new S→C message types | Old clients that do not register handlers for `world.day_night_changed` and `night.encounter_result` will silently ignore them | No action needed; unhandled message types are discarded by the dispatcher |

Protocol version remains `v: 1`. The additions are additive-only and do not break existing message consumers.
