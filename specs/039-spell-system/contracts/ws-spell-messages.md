# WebSocket Contract: Spell System Messages

**Feature**: 039-spell-system  
**Protocol version**: v1 (backward-compatible addition)

## New Message Types

### Client → Server

#### `spell.request_state`
Request full spell state (learned spells + active buffs). Sent on login/reconnect and when opening Spells tab.

```typescript
interface SpellRequestStatePayload {}
```

#### `spell.cast`
Cast a spell on self.

```typescript
interface SpellCastPayload {
  spell_id: number;
}
```

#### `spell.cast_on_player`
Cast a spell on another player in the same location.

```typescript
interface SpellCastOnPlayerPayload {
  spell_id: number;
  target_character_id: string;  // UUID
}
```

#### `spell-book-spell.use`
Use a spell book item to train a spell.

```typescript
interface SpellBookUsePayload {
  slot_id: number;  // inventory_items.id
}
```

### Server → Client

#### `spell:state`
Full spell state — sent on login, reconnect, and after state changes.

```typescript
interface SpellStatePayload {
  spells: OwnedSpellDto[];
  active_buffs: ActiveSpellBuffDto[];
}
```

#### `spell.cast_result`
Successful spell cast confirmation.

```typescript
interface SpellCastResultPayload {
  spell_id: number;
  spell_name: string;
  target_character_id: string;
  level: number;
  effect_type: string;
  effect_value: number;
  duration_seconds: number;
  expires_at: string;  // ISO 8601
}
```

#### `spell.cast_rejected`
Spell cast rejected.

```typescript
interface SpellCastRejectedPayload {
  spell_id: number;
  reason: 'in_combat' | 'not_owned' | 'insufficient_resources' | 'higher_level_active' | 'target_not_found' | 'target_not_in_location';
  message: string;
}
```

#### `spell.buff_received`
Sent to the target player when they receive a buff from another player.

```typescript
interface SpellBuffReceivedPayload {
  spell_id: number;
  spell_name: string;
  caster_name: string;
  level: number;
  effect_type: string;
  effect_value: number;
  duration_seconds: number;
  expires_at: string;  // ISO 8601
  icon_url: string | null;
}
```

#### `spell.buff_expired`
Sent when a buff expires (server-side timer check on next interaction or periodic sweep).

```typescript
interface SpellBuffExpiredPayload {
  spell_id: number;
  spell_name: string;
  effect_type: string;
}
```

#### `spell-book-spell.result`
Successful spell book use.

```typescript
interface SpellBookResultPayload {
  spell_id: number;
  spell_name: string;
  points_gained: number;
  new_points: number;
  new_level: number;
  leveled_up: boolean;
  cooldown_until: string | null;  // ISO 8601
}
```

#### `spell-book-spell.error`
Spell book use rejected.

```typescript
interface SpellBookErrorPayload {
  message: string;
}
```

## New DTO Types

```typescript
interface OwnedSpellDto {
  id: number;
  name: string;
  icon_url: string | null;
  description: string;
  effect_type: string;
  effect_value: number;
  duration_seconds: number;
  level: number;
  points: number;
  points_to_next: number | null;  // null if max level
  cooldown_until: string | null;  // ISO 8601, training cooldown
  current_level_stats: SpellLevelStatsDto | null;
  next_level_stats: SpellLevelStatsDto | null;
  costs: SpellCostDto[];  // costs for current level
}

interface SpellLevelStatsDto {
  level: number;
  effect_value: number;
  duration_seconds: number;
  gold_cost: number;
  item_costs: SpellItemCostDto[];
}

interface SpellItemCostDto {
  item_def_id: number;
  item_name: string;
  item_icon_url: string | null;
  quantity: number;
}

interface SpellCostDto {
  gold: number;
  items: SpellItemCostDto[];
}

interface ActiveSpellBuffDto {
  spell_id: number;
  spell_name: string;
  icon_url: string | null;
  level: number;
  effect_type: string;
  effect_value: number;
  expires_at: string;  // ISO 8601
  caster_name: string;
}
```

## Modified Message Types

### `character.stats_updated` (existing)

No structural change. The effective stats computed by `computeCombatStats()` will now include spell buff modifiers. The frontend already consumes these stats generically — no protocol change needed.

## Message Flow Diagrams

### Self-Cast Flow
```
Client                          Server
  |-- spell.cast ----------------->|
  |   { spell_id }                 |  validate: owns spell, not in combat,
  |                                |  resources sufficient, level check
  |<--- spell.cast_result ---------|  deduct resources, insert/upsert buff
  |<--- spell:state ---------------|  updated spell + buff state
  |<--- character.stats_updated ---|  recalculated effective stats
```

### Cast-on-Player Flow
```
Client A                        Server                        Client B
  |-- spell.cast_on_player ------->|                              |
  |   { spell_id, target_id }     |  validate: same location,    |
  |                                |  resources, level check      |
  |<--- spell.cast_result ---------|                              |
  |<--- spell:state ---------------|                              |
  |                                |--- spell.buff_received ----->|
  |                                |--- spell:state ------------->|
  |                                |--- character.stats_updated ->|
```

### Spell Book Training Flow
```
Client                          Server
  |-- spell-book-spell.use ------->|
  |   { slot_id }                  |  validate: item exists, is spell book,
  |                                |  owns spell or grant it, cooldown, max level
  |<--- spell-book-spell.result ---|  consume item, update progress
  |<--- spell:state ---------------|  updated spell state
  |<--- inventory:state ---------->|  updated inventory
```
