# Boss System — WebSocket Message Contracts

**Protocol Version**: Extends existing v1 message envelope (`{ type, payload, v }`)

## Client → Server Messages

### `boss:challenge`

Player initiates a boss fight. Server validates token, locks instance, starts combat.

**Payload**:
```json
{
  "boss_id": 5
}
```

**Success response**: Server sends `boss:combat_start` to the challenger, `boss:state` to all zone players.

**Rejection responses** (sent as `boss:challenge_rejected`):
```json
{ "reason": "no_token", "message": "You need a Boss Challenge Token to challenge this guardian." }
{ "reason": "in_combat", "message": "Another adventurer is already fighting this guardian." }
{ "reason": "defeated", "message": "This guardian has been defeated. It will return soon.", "respawn_at": "2026-03-28T15:30:00Z" }
{ "reason": "inactive", "message": "This guardian is dormant." }
{ "reason": "already_in_combat", "message": "You are already in combat." }
```

### `boss:combat_trigger_active`

Player triggers their active ability during boss combat. Same semantics as `combat:trigger_active`.

**Payload**:
```json
{
  "combat_id": "abc-123-def"
}
```

---

## Server → Client Messages (to fighting player)

### `boss:combat_start`

Sent to the challenger when boss combat begins.

**Payload**: `BossCombatStartPayload` (see data-model.md)

```json
{
  "combat_id": "abc-123-def",
  "boss": {
    "id": 5,
    "name": "Troll Chieftain",
    "icon_url": "/assets/bosses/icons/troll-chieftain.png",
    "attack": 40,
    "defense": 20,
    "hp_bracket": "full",
    "abilities": [
      { "name": "Crushing Blow", "icon_url": null },
      { "name": "War Cry", "icon_url": null }
    ]
  },
  "player": {
    "max_hp": 200,
    "current_hp": 200,
    "max_mana": 100,
    "current_mana": 0,
    "attack": 45,
    "defence": 18
  },
  "loadout": {
    "slots": [
      { "slot": "auto_1", "ability_id": 1, "name": "Power Strike", "icon_url": null, "status": "ready" },
      { "slot": "active", "ability_id": 7, "name": "Execute", "icon_url": null, "status": "ready" }
    ]
  },
  "turn_timer_ms": 3000
}
```

### `boss:combat_turn_result`

Sent after each combat phase. Same structure as `combat:turn_result` but `enemy_hp` replaced with `enemy_hp_bracket`.

**Payload**: `BossCombatTurnResultPayload` (see data-model.md)

```json
{
  "combat_id": "abc-123-def",
  "turn": 3,
  "phase": "enemy",
  "events": [
    { "type": "ability_fired", "source": "enemy", "target": "player", "ability_name": "Crushing Blow", "value": 65 },
    { "type": "effect_applied", "source": "enemy", "target": "player", "effect_name": "Stun", "value": 0 }
  ],
  "player_hp": 135,
  "player_mana": 45,
  "enemy_hp_bracket": "high",
  "ability_states": [
    { "slot": "auto_1", "ability_id": 1, "name": "Power Strike", "icon_url": null, "status": "ready" },
    { "slot": "active", "ability_id": 7, "name": "Execute", "icon_url": null, "status": "cooldown", "cooldown_remaining": 2 }
  ]
}
```

### `boss:combat_active_window`

Active ability window opens. Same semantics as `combat:active_window`.

**Payload**:
```json
{
  "combat_id": "abc-123-def",
  "timer_ms": 3000,
  "ability": {
    "slot": "active",
    "ability_id": 7,
    "name": "Execute",
    "icon_url": null,
    "status": "ready"
  }
}
```

### `boss:combat_end`

Boss fight concluded.

**Payload**: `BossCombatEndPayload` (see data-model.md)

```json
{
  "combat_id": "abc-123-def",
  "outcome": "win",
  "current_hp": 85,
  "boss_name": "Troll Chieftain",
  "boss_icon_url": "/assets/bosses/icons/troll-chieftain.png",
  "enemy_hp_bracket": "critical",
  "xp_gained": 500,
  "crowns_gained": 120,
  "items_dropped": [
    { "item_def_id": 38, "name": "Steel Bar", "icon_url": "/assets/items/icons/steel-bar.png", "quantity": 3 }
  ]
}
```

---

## Server → All Zone Players (broadcasts)

### `boss:state`

Broadcast when a boss changes state: spawns, enters combat, is defeated, respawns.

**Payload**: `BossStatePayload` (see data-model.md)

```json
{
  "boss_id": 5,
  "building_id": 12,
  "status": "in_combat",
  "fighting_character_name": "Kael",
  "total_attempts": 3,
  "respawn_at": null
}
```

**Trigger conditions**:
- Boss spawns/respawns: `status: "alive"`, `respawn_at: null`
- Player challenges: `status: "in_combat"`, `fighting_character_name` set
- Player loses: `status: "alive"`, `fighting_character_name: null`
- Boss defeated: `status: "defeated"`, `respawn_at` set

---

## Zone Entry Data

When a player enters a zone, the zone state payload (existing `world:state` or similar) MUST include boss data:

```json
{
  "bosses": [
    {
      "id": 5,
      "name": "Troll Chieftain",
      "description": "A massive troll guards the mine entrance...",
      "icon_url": "/assets/bosses/icons/troll-chieftain.png",
      "sprite_url": "/assets/bosses/sprites/troll-chieftain.png",
      "building_id": 12,
      "status": "alive",
      "fighting_character_name": null,
      "total_attempts": 0,
      "respawn_at": null
    }
  ]
}
```

---

## Backward Compatibility

All boss messages use the `boss:` prefix namespace. No existing message types are modified. The `combat:*` messages remain unchanged for regular monster combat. Frontend differentiates by message type prefix.

The zone state payload is extended with an optional `bosses` array — clients that don't understand it will ignore it (graceful degradation).
