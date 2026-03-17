# WebSocket Contract: Combat System

**Feature**: 016-combat-system
**Protocol version**: v1 (additive — no version bump required)
**Envelope**: `{ type: string, v: 1, payload: T }`

All messages flow over the existing WebSocket connection. New message types are additive; existing types are unchanged.

---

## Sub-types (shared)

```typescript
/** A single event that occurred during a turn */
interface CombatEventDto {
  kind:
    | 'auto_attack'       // auto-attack resolved
    | 'ability_fired'     // ability activated
    | 'mana_gained'       // mana increased
    | 'mana_spent'        // mana consumed by ability
    | 'dodge'             // attack was dodged
    | 'crit'              // critical hit
    | 'effect_applied'    // buff/debuff/DoT applied
    | 'effect_tick'       // DoT or ongoing effect ticked
    | 'effect_expired';   // buff/debuff/DoT expired
  source: 'player' | 'enemy';
  target: 'player' | 'enemy';
  value?: number;          // damage dealt, HP healed, mana delta, etc.
  ability_name?: string;   // present for ability_fired, effect_applied
  effect_name?: string;    // present for effect_tick, effect_expired
  is_crit?: boolean;       // present for auto_attack when critical
}

/** Snapshot of one ability's current combat status */
interface CombatAbilityStateDto {
  slot_name: 'auto_1' | 'auto_2' | 'auto_3' | 'active';
  ability_id: number;
  name: string;
  mana_cost: number;
  icon_url: string | null;
  status: 'ready' | 'cooldown' | 'insufficient_mana';
  cooldown_turns_remaining: number;  // 0 when not on cooldown
}

/** Monster data at combat start */
interface MonsterCombatDto {
  id: number;
  name: string;
  icon_url: string | null;
  max_hp: number;
  attack: number;
  defence: number;
}

/** Player state at combat start */
interface PlayerCombatStateDto {
  max_hp: number;
  current_hp: number;
  max_mana: number;
  current_mana: number;   // always 0 at start
  attack: number;
  defence: number;
}

/** An ability that dropped as loot */
interface AbilityDroppedDto {
  ability_id: number;
  name: string;
  icon_url: string | null;
}
```

---

## Server → Client Messages

### `combat:start`

Sent immediately when an explore action results in a combat encounter. The client should close any explore result UI and open the combat screen.

```typescript
type: 'combat:start'
payload: {
  combat_id: string;          // UUID, unique per fight
  monster: MonsterCombatDto;
  player: PlayerCombatStateDto;
  loadout: {
    slots: CombatAbilityStateDto[];  // all 4 slots (empty slots omitted)
  };
  turn_timer_ms: number;      // duration of the active ability window in ms (default 15000)
}
```

---

### `combat:turn_result`

Sent after each complete half-turn (player turn or enemy turn) resolves. Includes all events that occurred and the updated state.

```typescript
type: 'combat:turn_result'
payload: {
  combat_id: string;
  turn: number;
  phase: 'player' | 'enemy';
  events: CombatEventDto[];           // ordered list of everything that happened
  player_hp: number;                  // after this half-turn
  player_mana: number;                // after this half-turn
  enemy_hp: number;                   // after this half-turn
  ability_states: CombatAbilityStateDto[];  // updated statuses after resolution
}
```

---

### `combat:active_window`

Sent after the player's auto-attack and auto-abilities resolve. Signals that the active ability window is now open.

```typescript
type: 'combat:active_window'
payload: {
  combat_id: string;
  timer_ms: number;           // countdown duration (matches turn_timer_ms from combat:start)
  ability: CombatAbilityStateDto | null;  // null if no ability in active slot or insufficient mana
}
```

---

### `combat:end`

Sent when either combatant reaches 0 HP.

```typescript
type: 'combat:end'
payload: {
  combat_id: string;
  outcome: 'win' | 'loss';
  xp_gained: number;          // 0 on loss
  crowns_gained: number;      // 0 on loss
  items_dropped: ItemDroppedDto[];    // [] on loss (existing type from protocol)
  ability_drops: AbilityDroppedDto[]; // [] if none
}
```

---

### `loadout:state`

Sent to the client on character load (after `character:select`) and after any loadout update.

```typescript
type: 'loadout:state'
payload: {
  slots: Array<{
    slot_name: 'auto_1' | 'auto_2' | 'auto_3' | 'active';
    ability_id: number | null;
    priority: number;
    ability?: OwnedAbilityDto;  // present when ability_id is set
  }>;
  owned_abilities: OwnedAbilityDto[];
}

interface OwnedAbilityDto {
  id: number;
  name: string;
  icon_url: string | null;
  description: string;
  effect_type: string;
  mana_cost: number;
  effect_value: number;
  duration_turns: number;
  cooldown_turns: number;
  slot_type: 'auto' | 'active' | 'both';
}
```

---

### `loadout:updated`

Acknowledgement sent after a successful `loadout:update`.

```typescript
type: 'loadout:updated'
payload: {
  slot_name: 'auto_1' | 'auto_2' | 'auto_3' | 'active';
  ability_id: number | null;
  priority: number;
}
```

---

### `loadout:update_rejected`

Sent when a `loadout:update` cannot be applied.

```typescript
type: 'loadout:update_rejected'
payload: {
  slot_name: string;
  reason: 'in_combat' | 'ability_not_owned' | 'slot_type_mismatch';
  message: string;   // human-readable explanation
}
```

---

## Client → Server Messages

### `combat:trigger_active`

Player manually triggers the active ability during the active window.

```typescript
type: 'combat:trigger_active'
payload: {
  combat_id: string;   // must match the active combat session for this character
}
```

**Server validation**:
- Character must have an active combat session with matching `combat_id`
- Session phase must be `'active_window'`
- Active slot must have an ability assigned
- Player mana must be ≥ ability mana cost
- Ability must not be on cooldown

**Rejection**: Server ignores the message silently if any check fails (window may have just expired); no rejection message is sent to avoid confusing the user after timer expiry.

---

### `loadout:update`

Update a single slot in the player's loadout.

```typescript
type: 'loadout:update'
payload: {
  slot_name: 'auto_1' | 'auto_2' | 'auto_3' | 'active';
  ability_id: number | null;  // null to clear the slot
  priority?: number;           // 1–99; only meaningful for auto slots
}
```

**Server validation**:
- Character must NOT be in combat (`in_combat = false`)
- If `ability_id` is set: character must own the ability
- If `ability_id` is set: `slot_type` must be compatible with `slot_name`
- If `priority` is not provided, defaults to `priority_default` from the ability definition

**Success response**: `loadout:state` (full refresh) + `loadout:updated`
**Failure response**: `loadout:update_rejected`

---

### `loadout:request`

Client requests the full loadout state (e.g., on reconnect or when opening the loadout panel).

```typescript
type: 'loadout:request'
payload: {}
```

**Server response**: `loadout:state`

---

## Explore Flow Change

The existing `building:explore_result` payload gains a new discriminant:

```typescript
// Added to existing BuildingExploreResultPayload union:
outcome: 'combat_started'
// No additional fields — combat proceeds via combat:* messages.
// The monster details are delivered in the combat:start message.
```

The legacy `outcome: 'combat'` variant (with pre-computed rounds) is retained for backward compatibility but is no longer generated by the server for new encounters.

---

## Admin REST Endpoints (non-game-state)

Base path: `/api/abilities` (admin backend, port 4001)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/abilities` | List all abilities |
| GET | `/api/abilities/:id` | Get single ability |
| POST | `/api/abilities` | Create new ability |
| PUT | `/api/abilities/:id` | Update ability (all editable fields) |
| POST | `/api/abilities/:id/icon` | Upload icon (multipart/form-data) |
| DELETE | `/api/abilities/:id` | Delete ability |

**Editable fields via REST**: `name`, `icon_filename`, `description`, `mana_cost`, `effect_value`, `duration_turns`, `cooldown_turns`, `priority_default`, `slot_type`.
**Read-only field**: `effect_type` — returned in responses but rejected in create/update payloads (or silently ignored on update).
