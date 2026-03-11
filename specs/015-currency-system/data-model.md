# Data Model: Currency System (Crowns)

**Feature**: 015-currency-system
**Date**: 2026-03-11

---

## Schema Changes

### Migration: `backend/src/db/migrations/017_currency.sql`

```sql
-- Add Crown balance to characters (default 0 for new and existing characters)
ALTER TABLE characters
  ADD COLUMN crowns INTEGER NOT NULL DEFAULT 0;

-- Ensure no negative balances can be stored
ALTER TABLE characters
  ADD CONSTRAINT characters_crowns_non_negative CHECK (crowns >= 0);

-- Add Crown drop range to monsters (both default 0 = no drop)
ALTER TABLE monsters
  ADD COLUMN min_crowns INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN max_crowns INTEGER NOT NULL DEFAULT 0;

-- Ensure valid range: min <= max, both non-negative
ALTER TABLE monsters
  ADD CONSTRAINT monsters_crowns_non_negative CHECK (min_crowns >= 0 AND max_crowns >= 0),
  ADD CONSTRAINT monsters_crowns_range CHECK (min_crowns <= max_crowns);
```

---

## Updated Entities

### characters (modified)

| Column | Type | Constraint | Notes |
|--------|------|------------|-------|
| id | UUID | PK | unchanged |
| account_id | UUID | FK accounts | unchanged |
| name | VARCHAR(64) | UNIQUE | unchanged |
| ... | ... | ... | all existing columns unchanged |
| **crowns** | **INTEGER** | **NOT NULL DEFAULT 0, CHECK >= 0** | **new — Crown balance** |

### monsters (modified)

| Column | Type | Constraint | Notes |
|--------|------|------------|-------|
| id | SERIAL | PK | unchanged |
| name | VARCHAR(64) | NOT NULL | unchanged |
| attack | INTEGER | NOT NULL | unchanged |
| defense | INTEGER | NOT NULL | unchanged |
| hp | INTEGER | NOT NULL | unchanged |
| xp_reward | INTEGER | NOT NULL | unchanged |
| icon_filename | VARCHAR | nullable | unchanged |
| **min_crowns** | **INTEGER** | **NOT NULL DEFAULT 0** | **new — minimum drop** |
| **max_crowns** | **INTEGER** | **NOT NULL DEFAULT 0** | **new — maximum drop** |

---

## TypeScript Type Changes

### `backend/src/db/queries/characters.ts`

```typescript
export interface Character {
  // ... existing fields ...
  crowns: number;  // NEW
}

// New atomic increment function
export async function addCrowns(characterId: string, amount: number): Promise<number>
// Returns the new balance. Uses: UPDATE characters SET crowns = crowns + $2 WHERE id = $1 RETURNING crowns
```

### `backend/src/db/queries/monsters.ts`

```typescript
export interface Monster {
  // ... existing fields ...
  min_crowns: number;  // NEW
  max_crowns: number;  // NEW
}

// createMonster and updateMonster signatures extended with optional min_crowns / max_crowns
```

---

## New Service Module

### `backend/src/game/currency/crown-service.ts`

```typescript
// Atomically credits amount Crowns to a character. Returns new balance.
export async function awardCrowns(characterId: string, amount: number): Promise<number>

// Rolls a random Crown drop for a monster. Returns 0 if min/max both 0.
export function rollCrownDrop(monster: Monster): number
// Math.floor(Math.random() * (max - min + 1)) + min
```

---

## Protocol Types (shared/protocol/index.ts)

### Modified: `CharacterData`

```typescript
export interface CharacterData {
  // ... existing fields ...
  crowns: number;  // NEW — current Crown balance
}
```

### Modified: `BuildingExploreResultPayload`

```typescript
export interface BuildingExploreResultPayload {
  // ... existing fields ...
  crowns_gained?: number;  // NEW — only present when combat_result === 'win' AND > 0
}
```

### Modified: `NightEncounterResultPayload`

```typescript
export interface NightEncounterResultPayload {
  // ... existing fields ...
  crowns_gained?: number;  // NEW — only present when combat_result === 'win' AND > 0
}
```

### New: `CharacterCrownsChangedPayload`

```typescript
// Sent to a player when their Crown balance changes via admin command
export interface CharacterCrownsChangedPayload {
  crowns: number;  // new absolute balance
}
export type CharacterCrownsChangedMessage = WsMessage<CharacterCrownsChangedPayload>;
// Message type string: 'character.crowns_changed'
```

---

## Crown Award Flow

```
Combat win (explore or night)
  └─ crown-service.rollCrownDrop(monster)  → amount (may be 0)
  └─ crown-service.awardCrowns(characterId, amount)  → newBalance
  └─ explore/night result payload includes crowns_gained: amount  (omitted if 0)
  └─ client updates display from crowns_gained delta

Admin /crown command
  └─ validate: admin, online target, positive integer amount
  └─ crown-service.awardCrowns(characterId, amount)  → newBalance
  └─ sendToSession(targetSession, 'character.crowns_changed', { crowns: newBalance })
  └─ client receives authoritative new balance and updates display
```

---

## Validation Rules

| Rule | Location | Details |
|------|----------|---------|
| `crowns >= 0` | DB constraint | Can never go negative in storage |
| `min_crowns >= 0`, `max_crowns >= 0` | DB constraint | Non-negative drop range |
| `min_crowns <= max_crowns` | DB constraint | Valid range enforcement |
| `/crown` amount must be positive integer | Admin command handler | Rejects 0 and negative |
| `/crown` target must be online | Admin command handler | `getSessionByCharacterId` check |
| Crown increment is atomic | `addCrowns` SQL | `SET crowns = crowns + $n` |
