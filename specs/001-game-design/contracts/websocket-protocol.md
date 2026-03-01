# WebSocket Protocol: Elarion v1

**Version**: 1.0
**Transport**: WebSocket (text frames, JSON payload)
**Encoding**: UTF-8 JSON

---

## Message Envelope

Every message — in both directions — uses this envelope:

```json
{
  "type": "namespace.action",
  "v": 1,
  "payload": { ... }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `type` | string | Dot-namespaced action identifier (see below) |
| `v` | number | Protocol version; currently `1` |
| `payload` | object | Action-specific data (may be `{}` if no data) |

The server MUST reject any message where `v` is absent or does not match the
server's supported version, responding with `server.error` code `PROTOCOL_VERSION`.

---

## Connection Handshake

The client connects via WebSocket to:
```
ws://<host>:<port>/game?token=<jwt>
```

The server validates the JWT before accepting the upgrade.

- **Success**: Connection accepted; server sends `world.state` immediately.
- **Failure**: Connection rejected with HTTP 401; no WebSocket frames sent.

On reconnect after a clean disconnect, the client re-sends the JWT. The server
restores the player's session from the last persisted state.

---

## Client → Server Messages

### `auth.register`

Register a new account.

```json
{
  "type": "auth.register",
  "v": 1,
  "payload": {
    "username": "string (3–32 chars, [a-zA-Z0-9_])",
    "password": "string (min 8 chars)"
  }
}
```

**Server responses**: `auth.success` | `auth.error`

---

### `auth.login`

Authenticate an existing account and receive a JWT.

```json
{
  "type": "auth.login",
  "v": 1,
  "payload": {
    "username": "string",
    "password": "string"
  }
}
```

**Server responses**: `auth.success` | `auth.error`

---

### `character.create`

Create a character for the authenticated account. Only valid before the player
has a character; an account with an existing character receives `server.error`
with code `CHARACTER_EXISTS`.

```json
{
  "type": "character.create",
  "v": 1,
  "payload": {
    "name": "string (3–32 chars, [a-zA-Z0-9_])",
    "class_id": "number (1 = Warrior | 2 = Mage | 3 = Ranger)"
  }
}
```

**Server responses**: `character.created` | `server.error`

---

### `player.move`

Request to move the character one tile in the given direction. The server
validates the move, updates the position, and broadcasts `player.moved` to all
players in the zone. If rejected, the server sends `player.move_rejected`.

```json
{
  "type": "player.move",
  "v": 1,
  "payload": {
    "direction": "n | s | e | w"
  }
}
```

**Server responses**: `player.moved` (broadcast) | `player.move_rejected`

**Rate limit**: Maximum 10 move requests per second per player. Excess requests
receive `server.rate_limited`.

---

### `combat.start`

Initiate automatic combat with a monster instance in the player's zone. The
monster must be within the player's current tile or an adjacent tile. The server
validates proximity and monster state before starting simulation.

```json
{
  "type": "combat.start",
  "v": 1,
  "payload": {
    "monster_instance_id": "string (UUID)"
  }
}
```

**Server responses**: `combat.started` → stream of `combat.round` → `combat.ended`
| `server.error` (if monster not adjacent, already dead, or player already in combat)

**Note**: No further client input is accepted for this combat after `combat.started`.
The server drives the simulation entirely.

---

### `chat.send`

Send a chat message to local area or global channel.

```json
{
  "type": "chat.send",
  "v": 1,
  "payload": {
    "channel": "local | global",
    "message": "string (1–256 chars)"
  }
}
```

**Server responses**: `chat.message` broadcast | `server.rate_limited`

**Rate limit**: Maximum 5 messages per 3 seconds per player.

---

## Server → Client Messages

### `auth.success`

Sent in response to a successful `auth.register` or `auth.login`.

```json
{
  "type": "auth.success",
  "v": 1,
  "payload": {
    "token": "string (JWT)",
    "has_character": "boolean"
  }
}
```

If `has_character` is `false`, the client MUST show the character creation screen
before connecting to the game world.

---

### `auth.error`

Sent when registration or login fails.

```json
{
  "type": "auth.error",
  "v": 1,
  "payload": {
    "code": "USERNAME_TAKEN | INVALID_CREDENTIALS | USERNAME_INVALID | PASSWORD_TOO_SHORT",
    "message": "string (human-readable)"
  }
}
```

---

### `character.created`

Sent after successful character creation.

```json
{
  "type": "character.created",
  "v": 1,
  "payload": {
    "character": {
      "id": "string (UUID)",
      "name": "string",
      "class_id": "number",
      "class_name": "string",
      "level": 1,
      "experience": 0,
      "max_hp": "number",
      "current_hp": "number",
      "attack_power": "number",
      "defence": "number",
      "zone_id": "number",
      "pos_x": "number",
      "pos_y": "number"
    }
  }
}
```

---

### `world.state`

Sent immediately after the WebSocket connection is accepted (JWT validated and
character exists). Contains the full current state of the player's zone.

```json
{
  "type": "world.state",
  "v": 1,
  "payload": {
    "zone_id": "number",
    "zone_name": "string",
    "my_character": { /* same shape as character.created payload */ },
    "players": [
      {
        "id": "string",
        "name": "string",
        "class_id": "number",
        "level": "number",
        "pos_x": "number",
        "pos_y": "number"
      }
    ],
    "monsters": [
      {
        "instance_id": "string (UUID)",
        "template_id": "number",
        "name": "string",
        "max_hp": "number",
        "current_hp": "number",
        "pos_x": "number",
        "pos_y": "number",
        "in_combat": "boolean"
      }
    ]
  }
}
```

---

### `player.moved`

Broadcast to all players in a zone when any player's position changes.

```json
{
  "type": "player.moved",
  "v": 1,
  "payload": {
    "character_id": "string (UUID)",
    "pos_x": "number",
    "pos_y": "number"
  }
}
```

---

### `player.move_rejected`

Sent only to the requesting player when a move is invalid.

```json
{
  "type": "player.move_rejected",
  "v": 1,
  "payload": {
    "pos_x": "number (authoritative position)",
    "pos_y": "number (authoritative position)",
    "reason": "BLOCKED_TILE | ZONE_BOUNDARY | IN_COMBAT | RATE_LIMITED"
  }
}
```

The client MUST roll back any client-side prediction to `pos_x`, `pos_y`.

---

### `player.entered_zone`

Broadcast to all existing zone players when a new player enters.

```json
{
  "type": "player.entered_zone",
  "v": 1,
  "payload": {
    "character": {
      "id": "string",
      "name": "string",
      "class_id": "number",
      "level": "number",
      "pos_x": "number",
      "pos_y": "number"
    }
  }
}
```

---

### `player.left_zone`

Broadcast when a player leaves or disconnects.

```json
{
  "type": "player.left_zone",
  "v": 1,
  "payload": {
    "character_id": "string (UUID)"
  }
}
```

---

### `combat.started`

Sent to the initiating player to confirm combat has begun.

```json
{
  "type": "combat.started",
  "v": 1,
  "payload": {
    "combat_id": "string (UUID)",
    "monster": {
      "instance_id": "string",
      "name": "string",
      "max_hp": "number",
      "current_hp": "number",
      "attack_power": "number",
      "defence": "number"
    }
  }
}
```

---

### `combat.round`

Streamed once per combat round during an ongoing simulation. Sent to all
CombatParticipants (players who have dealt damage to this monster).

```json
{
  "type": "combat.round",
  "v": 1,
  "payload": {
    "combat_id": "string (UUID)",
    "round_number": "number (1-based)",
    "attacker": "player | monster",
    "attacker_name": "string",
    "action": "attack | critical | miss",
    "damage": "number (0 if miss)",
    "player_hp_after": "number",
    "monster_hp_after": "number"
  }
}
```

---

### `combat.ended`

Sent to all CombatParticipants when the simulation concludes.

```json
{
  "type": "combat.ended",
  "v": 1,
  "payload": {
    "combat_id": "string (UUID)",
    "outcome": "victory | defeat",
    "xp_gained": "number (0 on defeat)",
    "items_gained": [
      {
        "item_id": "number",
        "name": "string",
        "type": "string",
        "quantity": "number"
      }
    ]
  }
}
```

---

### `character.levelled_up`

Sent immediately after `combat.ended` if the character's XP crossed a level
threshold.

```json
{
  "type": "character.levelled_up",
  "v": 1,
  "payload": {
    "new_level": "number",
    "new_max_hp": "number",
    "new_attack_power": "number",
    "new_defence": "number",
    "new_experience": "number"
  }
}
```

---

### `monster.spawned`

Broadcast to zone players when a monster respawns.

```json
{
  "type": "monster.spawned",
  "v": 1,
  "payload": {
    "instance_id": "string (UUID)",
    "template_id": "number",
    "name": "string",
    "max_hp": "number",
    "pos_x": "number",
    "pos_y": "number"
  }
}
```

---

### `monster.despawned`

Broadcast to zone players when a monster is killed (before respawn).

```json
{
  "type": "monster.despawned",
  "v": 1,
  "payload": {
    "instance_id": "string (UUID)"
  }
}
```

---

### `chat.message`

Broadcast to the appropriate audience (zone players for local, all players for
global).

```json
{
  "type": "chat.message",
  "v": 1,
  "payload": {
    "channel": "local | global",
    "sender_name": "string",
    "message": "string",
    "timestamp": "string (ISO 8601)"
  }
}
```

---

### `server.rate_limited`

Sent when a player exceeds the rate limit for an action.

```json
{
  "type": "server.rate_limited",
  "v": 1,
  "payload": {
    "action": "player.move | chat.send | combat.start",
    "retry_after_ms": "number"
  }
}
```

---

### `server.error`

Generic error message for invalid or rejected operations.

```json
{
  "type": "server.error",
  "v": 1,
  "payload": {
    "code": "string (see codes below)",
    "message": "string (human-readable)"
  }
}
```

**Error codes**:

| Code | Meaning |
|------|---------|
| `PROTOCOL_VERSION` | Client `v` does not match server |
| `NOT_AUTHENTICATED` | Action requires authentication |
| `CHARACTER_EXISTS` | Account already has a character |
| `CHARACTER_REQUIRED` | Action requires a character to exist |
| `MONSTER_NOT_FOUND` | Monster instance does not exist or is dead |
| `MONSTER_NOT_ADJACENT` | Monster is not adjacent to the player |
| `ALREADY_IN_COMBAT` | Player or monster is already in combat |
| `DUPLICATE_COMBAT` | Duplicate `combat.start` for active simulation |
| `INTERNAL_ERROR` | Unexpected server error |

---

## Protocol Versioning Policy

Per Constitution Principle V:
- **Backward-compatible changes** (new optional fields, new message types):
  increment patch in document header comment only; `v` field stays the same.
- **Breaking changes** (field renamed/removed, mandatory new field, semantics
  changed): increment `v` in the envelope; server MUST support at least one
  previous version during transition with a deprecation notice.
