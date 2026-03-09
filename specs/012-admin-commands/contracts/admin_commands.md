# WebSocket Contract: Admin Commands

**Feature**: 012-admin-commands
**Protocol Version**: v1
**Direction convention**: C→S = client to server, S→C = server to client

---

## Overview

Admin commands piggyback on the **existing** `chat.send` message type. No new
client-to-server message type is introduced. The server intercepts messages whose
`message` field starts with `/`, validates admin status, and executes the command.

One **new** server-to-client message type is introduced: `admin.command_result`.

---

## Reused Message: `chat.send` (C→S)

Admin commands use this existing message without change.

```json
{
  "type": "chat.send",
  "v": 1,
  "payload": {
    "channel": "local",
    "message": "/level_up Roddeck 3"
  }
}
```

**Admin command detection rule (server-side only)**:
- If `payload.message` starts with `/` AND the session has `isAdmin: true` →
  route to admin command parser; do NOT broadcast as chat.
- If `payload.message` starts with `/` AND `isAdmin: false` →
  return `admin.command_result` with `success: false`, message:
  `"You do not have permission to use this command."` Do NOT broadcast.
- If `payload.message` does NOT start with `/` → normal chat flow (unchanged).

---

## New Message: `admin.command_result` (S→C)

Sent exclusively to the admin who issued the command. Never broadcast to other players.

### Schema

```typescript
interface AdminCommandResultPayload {
  success: boolean;   // true = command executed, false = validation/permission failure
  message: string;    // human-readable result or error text
}
```

### Success Examples

```json
// /level_up Roddeck
{
  "type": "admin.command_result",
  "v": 1,
  "payload": {
    "success": true,
    "message": "Levelled up Roddeck by 1. New level: 5."
  }
}

// /level_up Roddeck 3
{
  "type": "admin.command_result",
  "v": 1,
  "payload": {
    "success": true,
    "message": "Levelled up Roddeck by 3. New level: 8."
  }
}

// /item Roddeck 1 5
{
  "type": "admin.command_result",
  "v": 1,
  "payload": {
    "success": true,
    "message": "Gave 5x Iron Sword to Roddeck."
  }
}

// /clear_inventory Roddeck
{
  "type": "admin.command_result",
  "v": 1,
  "payload": {
    "success": true,
    "message": "Cleared inventory of Roddeck (12 items removed)."
  }
}
```

### Failure Examples

```json
// Permission denied
{
  "type": "admin.command_result",
  "v": 1,
  "payload": {
    "success": false,
    "message": "You do not have permission to use this command."
  }
}

// Player not found
{
  "type": "admin.command_result",
  "v": 1,
  "payload": {
    "success": false,
    "message": "Player 'Gandalf' not found."
  }
}

// Item not found
{
  "type": "admin.command_result",
  "v": 1,
  "payload": {
    "success": false,
    "message": "Item with ID 999 does not exist."
  }
}

// Bad argument
{
  "type": "admin.command_result",
  "v": 1,
  "payload": {
    "success": false,
    "message": "Count must be a positive number."
  }
}

// Usage hint
{
  "type": "admin.command_result",
  "v": 1,
  "payload": {
    "success": false,
    "message": "Usage: /level_up <player> [count]"
  }
}

// Unknown command
{
  "type": "admin.command_result",
  "v": 1,
  "payload": {
    "success": false,
    "message": "Unknown command '/foo'. Available: /level_up, /item, /clear_inventory"
  }
}
```

---

## Supported Admin Command Syntax

| Command | Syntax | Arguments |
|---------|--------|-----------|
| Level up | `/level_up <player> [count]` | `player`: character name (string); `count`: positive integer, default 1 |
| Give item | `/item <player> <item_id> <quantity>` | `player`: character name; `item_id`: positive integer; `quantity`: positive integer |
| Clear inventory | `/clear_inventory <player>` | `player`: character name |

---

## State Updates Pushed After Successful Commands

When an admin command mutates another player's state, the server MUST push the
appropriate existing state update messages to that player's session (if online):

| Command | Additional S→C messages sent to target |
|---------|----------------------------------------|
| `/level_up` | `character.level_up` (if such message exists) OR full character state refresh |
| `/item` | `inventory.item_received` (existing message type) |
| `/clear_inventory` | `inventory.state` (existing full inventory refresh message) |

The admin receives only `admin.command_result`. The target player receives their normal
state update messages.

---

## Backward Compatibility

- `chat.send` schema is unchanged. Existing clients are unaffected.
- `admin.command_result` is a new type; existing clients that do not handle it will
  silently ignore unknown message types (per existing frontend client pattern).
- No protocol version bump required (additive change only).

---

## Structured Log Events (Constitution §IV)

All admin command executions MUST emit a structured log entry:

```json
{
  "event": "admin_command",
  "admin_account_id": "<uuid>",
  "admin_character_id": "<uuid>",
  "command": "level_up",
  "target_player": "Roddeck",
  "target_character_id": "<uuid>",
  "args": { "count": 3 },
  "success": true,
  "timestamp": "2026-03-08T12:00:00.000Z"
}
```

Failed attempts (permission or validation) MUST also be logged at WARN level with
`"success": false` and a `"reason"` field.
