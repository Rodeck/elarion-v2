# Quickstart: Admin Commands System

**Feature**: 012-admin-commands

This guide helps a developer get started implementing and testing admin commands.

---

## Prerequisites

- Elarion v2 dev environment running (`npm run dev` in both `backend/` and `frontend/`)
- PostgreSQL running with all migrations applied
- At least one account with `accounts.is_admin = TRUE` (see Setup below)

---

## 1. Create an Admin Account (Database)

Connect to the local database and set a test account as admin:

```sql
UPDATE accounts SET is_admin = TRUE WHERE username = 'your_test_admin';
```

Verify:

```sql
SELECT username, is_admin FROM accounts;
```

---

## 2. Key Files to Modify

### Backend — type changes (do these first)

| File | What to add |
|------|------------|
| `backend/src/db/queries/accounts.ts` | `is_admin: boolean` to `Account` interface; include in SELECT |
| `backend/src/auth/jwt.ts` | `isAdmin: boolean` to `JwtClaims` |
| `backend/src/auth/login-handler.ts` | Pass `isAdmin` to `signToken()` |
| `backend/src/websocket/server.ts` | `isAdmin: boolean` to `AuthenticatedSession` (default `false`); populate from JWT on auth |

### Backend — new logic

| File | What to create/change |
|------|----------------------|
| `backend/src/db/queries/characters.ts` | Add `getCharacterByName(name)` |
| `backend/src/db/queries/inventory.ts` | Add `clearAllInventory(characterId)` |
| `backend/src/game/admin/admin-command-handler.ts` | **New file** — parse and execute admin commands |
| `backend/src/game/chat/chat-handler.ts` | Add `/`-prefix interception before broadcast |

### Shared protocol

| File | What to add |
|------|------------|
| `shared/protocol/index.ts` | `AdminCommandResultPayload` interface |

### Frontend

| File | What to add |
|------|------------|
| `frontend/src/ui/ChatBox.ts` | Handle `admin.command_result` — display in chat as a distinct (e.g., yellow) system message |

---

## 3. Admin Command Handler — Skeleton

Create `backend/src/game/admin/admin-command-handler.ts`:

```typescript
import { AuthenticatedSession } from '../../websocket/server.js';
import { sendToSession } from '../../websocket/server.js';
import { getCharacterByName } from '../../db/queries/characters.js';
import { getItemDefinitionById, insertInventoryItem, clearAllInventory } from '../../db/queries/inventory.js';
import { levelUp } from '../progression/level-up-service.js';
import { logger } from '../../logger.js';

export async function handleAdminCommand(session: AuthenticatedSession, rawMessage: string): Promise<void> {
  // Parse command and args
  const parts = rawMessage.trim().split(/\s+/);
  const command = parts[0].toLowerCase();  // e.g. '/level_up'

  const reply = (success: boolean, message: string) =>
    sendToSession(session, 'admin.command_result', { success, message });

  switch (command) {
    case '/level_up': return handleLevelUp(session, parts.slice(1), reply);
    case '/item':     return handleGiveItem(session, parts.slice(1), reply);
    case '/clear_inventory': return handleClearInventory(session, parts.slice(1), reply);
    default:
      reply(false, `Unknown command '${command}'. Available: /level_up, /item, /clear_inventory`);
  }
}
```

---

## 4. Chat Handler Interception Point

In `backend/src/game/chat/chat-handler.ts`, add before the broadcast logic:

```typescript
// Admin command interception
if (message.startsWith('/')) {
  if (!session.isAdmin) {
    sendToSession(session, 'admin.command_result', {
      success: false,
      message: 'You do not have permission to use this command.',
    });
    return;  // Do not broadcast
  }
  await handleAdminCommand(session, message);
  return;  // Do not broadcast admin commands
}
// ... existing broadcast logic below
```

---

## 5. Frontend — Handling the New Message Type

In `frontend/src/ui/ChatBox.ts`, register a handler for `admin.command_result`:

```typescript
this.client.on<AdminCommandResultPayload>('admin.command_result', (payload) => {
  const colour = payload.success ? '#88ff88' : '#ff8888';
  const prefix = payload.success ? '[Admin ✓]' : '[Admin ✗]';
  this.appendMessage({ text: `${prefix} ${payload.message}`, colour });
});
```

---

## 6. Manual Testing Checklist

1. Log in as admin account → type `/level_up <your_char>` → confirm level increases
2. Type `/level_up <your_char> 5` → confirm level increases by 5
3. Type `/item <your_char> 1 3` → confirm 3× item in inventory
4. Type `/item <your_char> 999 1` → confirm error "Item with ID 999 does not exist"
5. Type `/clear_inventory <your_char>` → confirm inventory is empty
6. Log in as non-admin account → type `/level_up <char>` → confirm permission error
7. Verify other players do NOT see admin commands in their chat
8. Check backend logs contain structured `admin_command` entries for each test

---

## 7. No Migration Needed

The `accounts.is_admin` column was added in migration 008. Run migrations to confirm:

```bash
cd backend && npm run migrate
```

All 014 migrations should already be applied.
