# Data Model: Energy & Movement Speed System

**Branch**: `038-energy-system` | **Date**: 2026-04-07

## Schema Changes

### Migration `042_energy_system.sql`

#### ALTER `characters` table

| Column | Type | Default | Nullable | Description |
|--------|------|---------|----------|-------------|
| `max_energy` | SMALLINT | 1000 | NOT NULL | Maximum energy cap |
| `current_energy` | SMALLINT | 1000 | NOT NULL | Current energy (0 to max_energy) |
| `movement_speed` | SMALLINT | 100 | NOT NULL | Base movement speed |

**Constraints**:
- `current_energy >= 0`
- `current_energy <= max_energy`
- `movement_speed > 0`

#### ALTER `building_actions` config (gather type)

The `config` JSONB column for `action_type = 'gather'` gains an optional field:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `energy_per_second` | number | 0 | Energy cost per second during gathering (0 = free) |

No schema change needed — the field is added to the JSON config object stored in the existing `config` column.

### Extended `admin_config` keys

| Key | Default Value | Description |
|-----|---------------|-------------|
| `energy_regen_per_tick` | `'50'` | Energy restored per regen tick |
| `energy_tick_interval_seconds` | `'300'` | Seconds between energy regen ticks |
| `hp_regen_percent` | `'10'` | Percentage of max HP restored per HP tick |
| `hp_tick_interval_seconds` | `'600'` | Seconds between HP regen ticks |

All values stored as strings (existing admin_config pattern).

## Entity Relationships

```
characters
├── max_energy: SMALLINT (cap)
├── current_energy: SMALLINT (current value, 0..max_energy)
└── movement_speed: SMALLINT (base speed, default 100)

admin_config (key-value)
├── energy_regen_per_tick → amount restored per energy tick
├── energy_tick_interval_seconds → interval between energy ticks
├── hp_regen_percent → % of max_hp restored per HP tick
└── hp_tick_interval_seconds → interval between HP ticks

building_actions (config JSON, gather type only)
└── config.energy_per_second → energy cost per second during gathering

item_definitions (existing, no changes)
├── food_power → energy restore amount (category: food)
└── heal_power → HP restore amount (category: heal)
```

## State Transitions

### Energy Lifecycle

```
Character Created → energy = 1000, max_energy = 1000, movement_speed = 100
    │
    ├─ Action performed → energy -= cost (floor at 0)
    │   ├─ City move: 2 per node step
    │   ├─ Arena enter: 20
    │   ├─ Boss challenge: 20
    │   ├─ Fishing cast: 10
    │   ├─ Explore: 10
    │   └─ Gathering: energy_per_second * 2 per tick (every 2s)
    │
    ├─ Food consumed → energy = min(energy + food_power, max_energy)
    │
    ├─ Regen tick → energy = min(energy + regen_amount, max_energy)
    │
    ├─ Death → energy = floor(energy / 2)
    │
    └─ Energy = 0 → depleted state
        ├─ Actions blocked (arena, boss, fish, explore, gather start)
        ├─ Gathering in progress → session ends, partial rewards granted
        └─ City movement → speed halved (effective_speed = movement_speed * 0.5)
```

### Movement Speed Calculation

```
effective_speed = current_energy > 0
    ? movement_speed
    : floor(movement_speed * 0.5)

step_delay_ms = base_delay_ms * (100 / effective_speed)
```

Where `base_delay_ms = 300` (current hardcoded value in `city-movement-handler.ts`).

## Validation Rules

| Field | Rule | Enforced At |
|-------|------|-------------|
| `current_energy` | 0 ≤ value ≤ max_energy | DB CHECK + application logic |
| `max_energy` | > 0 | DB CHECK |
| `movement_speed` | > 0 | DB CHECK |
| `energy_per_second` | ≥ 0, integer | Admin backend validation |
| `energy_regen_per_tick` | > 0, integer | Admin backend validation |
| `energy_tick_interval_seconds` | > 0, integer | Admin backend validation |
| `hp_regen_percent` | 1–100, integer | Admin backend validation |
| `hp_tick_interval_seconds` | > 0, integer | Admin backend validation |
| Food use | Refused if energy = max_energy | Backend handler |
| Heal use | Refused if hp = max_hp | Backend handler |
| Action gate | Refused if energy < cost (except city move) | Each action handler |
