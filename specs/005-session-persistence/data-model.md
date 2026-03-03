# Data Model: Session Persistence & Logout

**Branch**: `005-session-persistence` | **Date**: 2026-03-03

---

## Entities

### SessionToken (client-side only)

Stored in browser `localStorage`. Not a database entity.

| Field | Type | Description |
|-------|------|-------------|
| `key` | `string` | Fixed storage key: `'elarion_token'` |
| `value` | `string` | Signed JWT string |

**Validation rules**:
- Must be a non-empty string
- Must be a valid JWT (verified server-side on WS connect)
- Considered absent if `localStorage.getItem('elarion_token')` returns `null` or `''`

**Lifecycle**:
- **Written**: On `auth.success` received in `LoginScene` (successful login or register)
- **Read**: On `BootScene.create()` to attempt session restore
- **Cleared**: On logout (user clicks logout button), OR when WS upgrade fails with 401

---

### JWT Claims (server-side, encoded in token)

| Claim | Type | Description |
|-------|------|-------------|
| `accountId` | `string` | UUID of the authenticated account |
| `characterId` | `string \| undefined` | UUID of the account's character (omitted if none) |
| `iat` | `number` | Issued-at timestamp (set by `jose`) |
| `exp` | `number` | Expiry timestamp. Duration: `JWT_EXPIRY` env var, default `'30d'` |

**Note**: `characterId` is only present if the account had a character **at login time**. If the player creates a character after login, subsequent WS connections may have `characterId = undefined` in the JWT. The server-side `world-state-handler` uses `findByAccountId()` (DB lookup) to find the character, not the JWT claim. This is correct behaviour.

---

## State Transitions

### Session Restore Flow (BootScene)

```
Page load
    │
    ▼
Read localStorage['elarion_token']
    │
    ├─► null / empty ──────────────────────────────► LoginScene
    │
    └─► token exists
            │
            ▼
        Connect WS with ?token=<jwt>
            │
            ├─► WS error/close (401 or network fail) ─► clear token ─► LoginScene
            │
            ├─► receive 'world.state' ─────────────────────────────────► GameScene
            │
            └─► receive 'auth.session_info' { has_character: false } ──► CharacterCreateScene
```

### Logout Flow (GameScene)

```
User clicks logout button
    │
    ▼
SessionStore.clear()                  (removes localStorage['elarion_token'])
    │
    ▼
wsClient.disconnect()                 (closes WebSocket connection)
    │
    ▼
StatsBar.destroy() + LogoutButton.destroy()   (remove HTML elements)
    │
    ▼
scene.start('LoginScene')
```

---

## No Database Changes

This feature requires no changes to the PostgreSQL schema. All new state is:
1. Client-side only (`localStorage`)
2. Configuration (environment variable `JWT_EXPIRY`)
3. In-memory session routing logic (backend `server.ts`)
