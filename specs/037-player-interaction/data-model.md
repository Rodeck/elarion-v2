# Data Model: Player Interaction Panel

**Feature**: 037-player-interaction | **Date**: 2026-04-07

## Overview

No database changes required. All data is derived from existing WebSocket messages and tracked in frontend memory.

## Frontend Data Structures

### RemotePlayerInfo

Lightweight data object tracked per remote player in the zone.

| Field | Type | Source | Description |
|-------|------|--------|-------------|
| id | string | PlayerSummary.id | Character unique identifier |
| name | string | PlayerSummary.name | Display name |
| level | number | PlayerSummary.level | Character level |
| classId | number | PlayerSummary.class_id | Character class (for future icon use) |
| nodeId | number \| null | PlayerSummary.current_node_id | Current city map node; null on tile maps |

**Lifecycle**:
- Created when `world.state` arrives (from `players[]`) or `player.entered_zone` fires
- Updated on every `city.player_moved` event (nodeId, derived from payload.node_id)
- Destroyed on `player.left_zone` or zone change

### NearbyPlayerEntry

Derived view shown in the panel — a filtered subset of RemotePlayerInfo where `nodeId === myCharacter.current_node_id`.

| Field | Type | Description |
|-------|------|-------------|
| id | string | Character unique identifier (for click handler) |
| name | string | Display name |
| level | number | Character level |

### PlayerDetailModalState

Internal state for the player detail modal.

| Field | Type | Description |
|-------|------|-------------|
| targetId | string | Character ID of the player being viewed |
| isPresent | boolean | Whether the target is still at the same node |

**State transitions**:
- Closed → Open: User clicks a player name in the panel
- Open (present) → Open (left): Target player's nodeId changes away from viewer's nodeId
- Open (left) → Open (present): Target player's nodeId changes back to viewer's nodeId
- Open → Closed: User closes modal (click outside / X / Escape)

## Existing Protocol Types Used (no changes)

- `PlayerSummary` — id, name, class_id, level, pos_x, pos_y, current_node_id
- `CityPlayerMovedPayload` — character_id, node_id, x, y
- `PlayerEnteredZonePayload` — character: PlayerSummary
- `PlayerLeftZonePayload` — character_id
- `WorldStatePayload` — players: PlayerSummary[]
