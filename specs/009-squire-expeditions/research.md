# Research: Squire Expeditions

## Status: Complete — No external research required

All design decisions below are based on analysis of the existing codebase
(`building-action-handler.ts`, `city-maps.ts`, `server.ts`, `protocol/index.ts`, etc.)
and the Elarion constitution.

---

## Decision 1: How expedition actions are stored

**Decision**: Add `'expedition'` as a third value to `building_actions.action_type`.
The config JSONB column stores:
```json
{
  "base_gold": 50,
  "base_exp": 100,
  "items": [
    { "item_def_id": 3, "base_quantity": 2 }
  ]
}
```

**Rationale**: Follows the exact pattern already established for `'travel'` and `'explore'`
config objects. No new table needed. Admin panel already has the form scaffold to extend.

**Alternatives considered**:
- Separate `expedition_configs` table — rejected: over-engineering for a single config shape.

---

## Decision 2: Reward scaling formula

**Decision**: Three fixed multipliers applied to base reward amounts:

| Duration | Multiplier | Reward/hour vs 1h |
|----------|------------|-------------------|
| 1 hour   | 1.0×       | 1.0×              |
| 3 hours  | 2.4×       | 0.8×              |
| 6 hours  | 4.0×       | 0.67×             |

Gold and exp are multiplied and rounded down. Item quantities are multiplied and rounded
down (minimum 0 per item). Items with a calculated quantity of 0 are omitted from the
snapshot.

These constants live in `expedition-service.ts`. No configuration needed — they are
game-balance constants, not admin-configurable data.

**Rationale**: Simple, predictable, YAGNI-compliant. Balance changes come via a code
change with a clear comment, not via a hidden admin field.

**Alternatives considered**:
- Admin-configurable multipliers per duration — rejected: complicates admin UI for
  speculative future tuning; multipliers can be changed in code when needed.

---

## Decision 3: Squire data model — status as derived state

**Decision**: Squires have no `status` column. Status is derived from
`squire_expeditions` rows:
- No uncollected expedition row → **idle**
- Uncollected row with `completes_at > now()` → **exploring**
- Uncollected row with `completes_at <= now()` → **ready to collect**

**Rationale**: Avoids a status field that can desync with the expedition row. Single
source of truth. Follows the constitution's server-authoritative principle.

---

## Decision 4: Squire naming

**Decision**: Squire names are assigned from a fixed name pool at character creation.
The first squire always gets the name from the pool slot matching the character's
first squire (currently always index 0). Pool:

```
Aldric, Brand, Cade, Daveth, Edgar, Finn, Gareth, Hadwyn
```

If the pool is exhausted (future multi-squire scenario), fall back to "Squire N"
where N is a counter.

**Rationale**: Thematic RPG flavor with no user input required, matching spec
requirement that names are system-assigned.

**Alternatives considered**:
- Random UUID-based names — rejected: unintuitive for players.
- Incrementing "Squire 1, Squire 2" — kept as fallback only; named squires feel more
  personal.

---

## Decision 5: Notification delivery strategy

**Decision**: On-connect only (no server-side polling timer).

When `sendWorldState` runs (every player login/reconnect), the server queries for
completed but not-yet-notified expeditions belonging to that character. For each:
1. Push `expedition.completed` WS message to the client.
2. Set `notified_at = now()` on the expedition row.

If the player is online when their expedition finishes, they receive the notification
on their next action that triggers a server round-trip — or on next reconnect.

**Rationale**: Simplest implementation satisfying SC-003 and User Story 3. The spec
says "appears when they next view the game" — on-connect delivery fulfills this.
A real-time push timer (setInterval) can be added in a future iteration if players
request immediate notifications.

**Alternatives considered**:
- `setInterval` polling every minute — rejected for initial implementation under YAGNI;
  the poll loop adds complexity (error handling, graceful shutdown, missed-notification
  edge cases) not required by the current spec.

---

## Decision 6: New WS message types vs extending `city.building_action`

**Decision**: Introduce two new WS message types rather than overloading
`city.building_action`:
- `expedition.dispatch` (client→server)
- `expedition.collect` (client→server)

**Rationale**: `CityBuildingActionPayload` has `action_type: 'travel' | 'explore'`
with no room for extra fields like `duration_hours`. Adding a discriminated union would
require a protocol version bump. Clean new message types are simpler and follow the
existing naming convention.

---

## Decision 7: Expedition state in building arrived payload

**Decision**: Extend `CityBuildingArrivedPayload` with an optional `expedition_state`
field. Populated only when the building has an expedition action.

**Rationale**: The client needs expedition context (squire status, duration options,
reward previews) immediately on building arrival to render the menu correctly.
A separate follow-up query message adds latency and complexity.

---

## Decision 8: Squire creation at character create

**Decision**: `handleCharacterCreate` inserts a `squires` row immediately after
creating the character, within the same handler (not in a DB transaction — matching
the existing non-transactional pattern in the codebase).

**Rationale**: Character creation already has no rollback logic. Keeping the squire
insert inline is consistent. If the squire insert fails (rare), the handler logs an
error; the character exists but without a squire — acceptable for the initial
implementation.

---

## Decision 9: Reward snapshot format

**Decision**: The `reward_snapshot` JSONB column stores:
```json
{
  "gold": 120,
  "exp": 240,
  "items": [
    { "item_def_id": 3, "name": "Health Potion", "quantity": 4 }
  ]
}
```
Item names are embedded at dispatch time (denormalized) so the collect result can
display item names even if the item definition is later renamed or removed.

**Rationale**: FR-005 requires snapshot isolation. Embedding the name avoids a join
on a potentially stale definition at collect time.

---

## Decision 10: Inventory full edge case at collect time

**Decision**: If inventory is full for one or more items, those items are silently
skipped. Gold and exp are always awarded in full. The collect response includes
`items_skipped: true` flag when any items could not be granted.

**Rationale**: Matches the existing `grantItemToCharacter` behavior which already
emits `inventory.full` per item. Collecting gold/exp should never be blocked by
inventory state.
