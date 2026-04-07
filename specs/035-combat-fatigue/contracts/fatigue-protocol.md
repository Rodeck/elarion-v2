# WebSocket Protocol Contract: Combat Fatigue

**Branch**: `035-combat-fatigue` | **Protocol Version**: Current + fatigue extensions

## New Types

### FatigueConfigDto

Sent to client at combat start so the frontend can render the fatigue timer.

```typescript
interface FatigueConfigDto {
  start_round: number;      // 0 = fatigue disabled
  base_damage: number;
  damage_increment: number;
}
```

### FatigueStateDto

Sent to client each turn result to update fatigue timer and debuff display.

```typescript
interface FatigueStateDto {
  current_round: number;         // current combat round (1-based)
  fatigue_active: boolean;       // true once fatigue is dealing damage
  current_damage: number;        // damage being dealt this round (0 if not active)
  immunity_rounds_left: number;  // future: rounds of immunity remaining
  effective_start_round: number; // start_round + modifiers (for timer accuracy)
}
```

## Extended Event Kind

Add to `CombatEventKind` union:

```typescript
| 'fatigue_damage'   // fatigue true damage applied to a combatant
```

## Message Extensions

### combat:start (Monster Combat)

Add optional field to `CombatStartPayload`:

```typescript
fatigue_config?: FatigueConfigDto;  // present when fatigue is enabled (start_round > 0)
```

### combat:turn_result (Monster Combat)

Add optional field to `CombatTurnResultPayload`:

```typescript
fatigue_state?: FatigueStateDto;  // present when fatigue config exists for this combat type
```

Fatigue damage events appear in the `events[]` array:

```typescript
{
  kind: 'fatigue_damage',
  source: 'environment',  // new source value — fatigue is not from player or enemy
  target: 'player' | 'enemy',
  value: number,           // damage dealt
}
```

### boss:combat_start (Boss Combat)

Add optional field to `BossCombatStartPayload`:

```typescript
fatigue_config?: FatigueConfigDto;
```

### boss:combat_turn_result (Boss Combat)

Add optional field to `BossCombatTurnResultPayload`:

```typescript
fatigue_state?: FatigueStateDto;
```

### arena:combat_start (PvP Combat)

Add optional field to `ArenaCombatStartPayload`:

```typescript
fatigue_config?: FatigueConfigDto;
```

### arena:combat_turn_result (PvP Combat)

Add optional field to `ArenaCombatTurnResultPayload`:

```typescript
fatigue_state?: FatigueStateDto;
```

## Admin REST API Contract

### GET /api/fatigue-config

Returns all fatigue configurations.

```typescript
// Response: 200 OK
FatigueConfigResponse[]

interface FatigueConfigResponse {
  combat_type: 'monster' | 'boss' | 'pvp';
  start_round: number;
  base_damage: number;
  damage_increment: number;
}
```

### PUT /api/fatigue-config/:combat_type

Updates fatigue configuration for a specific combat type.

```typescript
// Request body:
{
  start_round: number;      // >= 0
  base_damage: number;      // >= 0
  damage_increment: number; // >= 0
}

// Response: 200 OK
FatigueConfigResponse
```

## Backward Compatibility

All new fields are optional (`?`). Existing clients that do not handle fatigue will:
- Ignore `fatigue_config` in start payloads (no timer displayed — acceptable degradation)
- Ignore `fatigue_state` in turn results (no debuff displayed)
- Ignore `fatigue_damage` events in the log (unknown events are skipped by `formatEvent()`)

No protocol version increment required — purely additive changes.
