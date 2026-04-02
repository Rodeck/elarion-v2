# WebSocket Message Contract: Training System

**Feature**: 030-stat-allocation | **Protocol Version**: Existing `v` field in message envelope

## New Message Types

### `training.open` (client → server)

Player requests to open the training UI at a Trainer NPC.

```typescript
{
  type: 'training.open';
  npc_id: number;
}
```

**Server validation**:
- Player must be at a building containing this NPC
- NPC must have `is_trainer = true`
- Player must not be `in_combat = true`

**On success**: Server responds with `training.state`
**On failure**: Server responds with `training.error`

---

### `training.state` (server → client)

Full training state for the allocation UI.

```typescript
{
  type: 'training.state';
  attributes: {
    constitution: number;  // currently allocated
    strength: number;
    intelligence: number;
    dexterity: number;
    toughness: number;
  };
  unspent_points: number;
  per_stat_cap: number;   // 10 × (level - 1)
  level: number;
  derived_stats: {
    max_hp: number;
    attack_power: number;
    defence: number;
    max_mana: number;
    crit_chance: number;   // percentage with decimals (e.g., 3.4 = 3.4%)
    crit_damage: number;   // percentage with decimals (e.g., 153.6 = 153.6%)
    dodge_chance: number;  // percentage with decimals (e.g., 3.4 = 3.4%)
  };
  descriptions: {
    constitution: string;  // e.g., "+4 HP, +1 Attack per point"
    strength: string;
    intelligence: string;
    dexterity: string;
    toughness: string;
  };
}
```

---

### `training.allocate` (client → server)

Player submits attribute point allocation.

```typescript
{
  type: 'training.allocate';
  npc_id: number;
  increments: {
    constitution: number;  // points to ADD (>= 0)
    strength: number;
    intelligence: number;
    dexterity: number;
    toughness: number;
  };
}
```

**Server validation**:
- All increments >= 0
- Sum of increments > 0 and <= unspent_points
- Each `current_attr + increment <= per_stat_cap`
- Player must be at building with this NPC
- NPC must have `is_trainer = true`
- Player must not be `in_combat = true`

**On success**: Server responds with `training.result`
**On failure**: Server responds with `training.error`

---

### `training.result` (server → client)

Successful allocation result with updated character state.

```typescript
{
  type: 'training.result';
  attributes: {
    constitution: number;
    strength: number;
    intelligence: number;
    dexterity: number;
    toughness: number;
  };
  unspent_points: number;
  new_max_hp: number;
  new_attack_power: number;
  new_defence: number;
  new_max_mana: number;
  new_crit_chance: number;
  new_crit_damage: number;
  new_dodge_chance: number;
}
```

---

### `training.error` (server → client)

Allocation or open request failed.

```typescript
{
  type: 'training.error';
  message: string;  // Human-readable error (e.g., "Not enough stat points", "Exceeds stat cap")
}
```

---

## Modified Message Types

### `character.levelled_up` (server → client) — MODIFIED

Add stat points info to existing `CharacterLevelledUpPayload`.

```typescript
// BEFORE:
{
  type: 'character.levelled_up';
  new_level: number;
  new_max_hp: number;
  new_attack_power: number;
  new_defence: number;
  new_experience: number;
}

// AFTER:
{
  type: 'character.levelled_up';
  new_level: number;
  new_max_hp: number;       // unchanged (no auto-grants)
  new_attack_power: number; // unchanged
  new_defence: number;      // unchanged
  new_experience: number;
  stat_points_gained: number;    // NEW — points earned this level-up (7 × levels gained)
  stat_points_unspent: number;   // NEW — total unspent after this level-up
}
```

### `character.data` (server → client) — MODIFIED

Add attributes and unspent points to `CharacterData`.

```typescript
// NEW fields added to CharacterData:
{
  // ... existing fields ...
  attr_constitution: number;   // NEW
  attr_strength: number;       // NEW
  attr_intelligence: number;   // NEW
  attr_dexterity: number;      // NEW
  attr_toughness: number;      // NEW
  stat_points_unspent: number; // NEW
}
```

## Backward Compatibility

- New message types (`training.*`) are additive — old clients ignore unknown types
- Modified `character.levelled_up` adds optional fields — old clients ignore extra fields
- Modified `CharacterData` adds optional fields — old clients ignore extra fields
- No breaking changes to existing message formats
