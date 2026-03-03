# Contract: Authentication Messages (Session Persistence)

**Branch**: `005-session-persistence` | **Protocol Version**: v1 | **Date**: 2026-03-03

This document extends the existing auth protocol to cover the session restore flow.
All messages use the standard envelope: `{ type: string, v: 1, payload: T }`.

---

## New Message: `auth.session_info`

**Direction**: Server → Client
**Trigger**: Sent by the server immediately after a valid-token WS connection is established **when the authenticated account has no character in the database**.
**Not sent**: When `world.state` is sent (has character case) or when the connection is rejected (invalid token).

### Payload

```typescript
interface AuthSessionInfoPayload {
  has_character: boolean;  // Always false when this message is sent
}
```

### TypeScript types (shared/protocol/index.ts)

```typescript
export interface AuthSessionInfoPayload {
  has_character: boolean;
}

export type AuthSessionInfoMessage = WsMessage<AuthSessionInfoPayload>;
```

### Example frame

```json
{
  "type": "auth.session_info",
  "v": 1,
  "payload": { "has_character": false }
}
```

### Frontend handling

```
Receive 'auth.session_info':
  payload.has_character === false → disconnect WS, go to CharacterCreateScene with stored token
  payload.has_character === true  → (this case shouldn't occur; 'world.state' is sent instead)
```

---

## Existing Messages: No Changes

The following existing messages are **unchanged** by this feature:

| Message | Direction | Usage in this feature |
|---------|-----------|----------------------|
| `auth.success` | Server → Client | Received in LoginScene on successful login/register; token saved to localStorage |
| `auth.error` | Server → Client | Received in LoginScene on failed login; no session storage change |
| `world.state` | Server → Client | Received in BootScene (auto-restore, has character) and GameScene; triggers navigation to GameScene |

---

## WS Connection Auth Protocol (unchanged)

```
Client → ws://host:port/game?token=<jwt>

Server upgrade handler:
  token = ''         → accept, create pre-auth session (accountId='')
  token = valid JWT  → accept, create authenticated session
  token = invalid    → HTTP 401 Unauthorized, socket destroyed
```

The frontend interprets WS connection failure as an invalid/expired token and clears localStorage.

---

## Backward Compatibility

- `auth.session_info` is a new message type. Old clients (before this feature) will not send this type and will not handle it. No existing client sends `auth.session_info` to the server.
- The change to trigger `world.state` on `accountId` (rather than `characterId`) is a behaviour fix, not a protocol change. No message types or payloads change.
- Protocol version remains `v: 1`. No version bump required (additive change).
