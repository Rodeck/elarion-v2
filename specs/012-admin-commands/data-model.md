# Data Model: Admin Commands System

**Feature**: 012-admin-commands
**Date**: 2026-03-08

---

## No New Tables Required

The `accounts.is_admin` column already exists (added in migration 008). No new database
migration is needed for this feature.

---

## Existing Schema — Relevant Portions

### accounts (existing, no changes to schema)

```sql
accounts (
  id            UUID        PRIMARY KEY,
  username      VARCHAR(32) NOT NULL UNIQUE,
  password_hash VARCHAR     NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  banned_at     TIMESTAMPTZ,
  is_admin      BOOLEAN     NOT NULL DEFAULT FALSE   -- already present since migration 008
)
```

**Admin commands rely on `is_admin` to gate all privileged operations.**

### characters (existing, no changes to schema)

```sql
characters (
  id           UUID     PRIMARY KEY,
  account_id   UUID     NOT NULL UNIQUE REFERENCES accounts(id),
  name         VARCHAR(32) NOT NULL UNIQUE,   -- lookup target for admin commands
  level        SMALLINT NOT NULL DEFAULT 1,
  experience   INTEGER  NOT NULL DEFAULT 0,
  max_hp       SMALLINT NOT NULL,
  ...
)
```

**`name` is the unique human-readable identifier used in admin command arguments.**

### inventory_items (existing, no changes to schema)

```sql
inventory_items (
  id            SERIAL      PRIMARY KEY,
  character_id  UUID        NOT NULL REFERENCES characters(id),
  item_def_id   INTEGER     NOT NULL REFERENCES item_definitions(id),
  quantity      SMALLINT    NOT NULL DEFAULT 1,
  equipped_slot VARCHAR(16),
  created_at    TIMESTAMPTZ NOT NULL
)
```

**`/clear_inventory` deletes all rows for a given `character_id`, including equipped slots.**

### item_definitions (existing, no changes to schema)

```sql
item_definitions (
  id   SERIAL      PRIMARY KEY,
  name VARCHAR(64) NOT NULL UNIQUE,
  ...
)
```

**`/item` validates that `item_def_id` exists here before inserting into `inventory_items`.**

---

## Code-Level Type Changes

### 1. `Account` interface — add `is_admin`

File: `backend/src/db/queries/accounts.ts`

```typescript
// BEFORE
export interface Account {
  id: string;
  username: string;
  password_hash: string;
  created_at: Date;
  banned_at: Date | null;
}

// AFTER — add is_admin
export interface Account {
  id: string;
  username: string;
  password_hash: string;
  created_at: Date;
  banned_at: Date | null;
  is_admin: boolean;           // ADD THIS
}
```

### 2. `JwtClaims` — add `isAdmin`

File: `backend/src/auth/jwt.ts`

```typescript
// BEFORE
export interface JwtClaims {
  accountId: string;
  characterId?: string;
}

// AFTER
export interface JwtClaims {
  accountId: string;
  characterId?: string;
  isAdmin: boolean;            // ADD THIS
}
```

### 3. `AuthenticatedSession` — add `isAdmin`

File: `backend/src/websocket/server.ts`

```typescript
// AFTER — extend existing session type
export interface AuthenticatedSession {
  accountId: string | null;
  characterId: string | null;
  isAdmin: boolean;            // ADD THIS (default: false)
  socket: WebSocket;
}
```

### 4. `AdminCommandResultPayload` — new protocol type

File: `shared/protocol/index.ts`

```typescript
export interface AdminCommandResultPayload {
  success: boolean;
  message: string;   // human-readable confirmation or error text
}
// Message type: 'admin.command_result'
// Direction: server → client (only to the admin who issued the command)
```

---

## New Query Functions

### `getCharacterByName(name: string): Promise<Character | null>`

File: `backend/src/db/queries/characters.ts`

Looks up a character by unique name. Returns `null` if not found. Used by all three
admin commands to resolve the target player.

```sql
SELECT * FROM characters WHERE name = $1;
```

### `clearAllInventory(characterId: string): Promise<number>`

File: `backend/src/db/queries/inventory.ts`

Deletes all inventory rows for a character (including equipped items). Returns the count
of deleted rows (0 is valid — empty inventory).

```sql
DELETE FROM inventory_items WHERE character_id = $1;
-- RETURNING count of deleted rows
```

---

## Entity Relationships (unchanged)

```
accounts (is_admin)
    │ 1:1
    └── characters (name, level)
            │ 1:N
            └── inventory_items (item_def_id, quantity, equipped_slot)
                    │ N:1
                    └── item_definitions (id, name)
```

Admin commands navigate this graph:
- Resolve admin: `session.isAdmin` (from JWT, sourced from `accounts.is_admin`)
- Resolve target: `characters.name` → character row
- Mutate state: `characters.level`, `inventory_items`
