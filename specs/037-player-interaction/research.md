# Research: Player Interaction Panel

**Feature**: 037-player-interaction | **Date**: 2026-04-07

## Decision 1: Backend vs Frontend-Only Implementation

**Decision**: Frontend-only implementation — no backend changes needed.

**Rationale**: The existing WebSocket protocol already provides all necessary data:
- `world.state` sends `PlayerSummary[]` with `current_node_id` for all zone players on connect
- `city.player_moved` broadcasts `{character_id, node_id, x, y}` for every movement step
- `player.entered_zone` sends `PlayerSummary` (includes `current_node_id`) when a player enters
- `player.left_zone` sends `{character_id}` when a player leaves

The frontend can derive co-located players by maintaining a local `Map<characterId, nodeId>` and filtering against `myCharacter.current_node_id`. No new backend messages or DB tables required.

**Alternatives considered**:
- Backend sends dedicated `players_at_node` message → rejected (adds unnecessary server logic and a new message type when all data is already available client-side)
- Backend maintains per-node player lists → rejected (violates YAGNI; the frontend can compute this trivially)

## Decision 2: Remote Player Node Tracking

**Decision**: Create a lightweight `Map<string, RemotePlayerInfo>` alongside the existing `remotePlayers` Map (which stores Phaser Containers). Update `nodeId` on every `city.player_moved` event for remote players (currently only own player's node_id is updated at line 681 of GameScene.ts).

**Rationale**: The existing `remotePlayers` Map stores Phaser GameObjects (Containers) which can't easily hold extra data. A parallel data map is the simplest approach without modifying the existing sprite system.

**Alternatives considered**:
- Store data on Phaser Container's `data` property → rejected (fragile, not type-safe)
- Modify RemotePlayer entity class → rejected (no RemotePlayer class exists; remote players are bare Containers)

## Decision 3: CombatLog Replacement Strategy

**Decision**: Remove CombatLog entirely from GameScene. Redirect the single `server.error` handler (line 620) to use `ChatBox.addSystemMessage()` or equivalent.

**Rationale**: The CombatLog has only ONE consumer outside of combat: the `server.error` handler. The CombatScreen modal has its own internal combat log (`combatLogEl`), so in-combat logging is unaffected. Server errors can be shown in the chat panel.

**Alternatives considered**:
- Keep CombatLog hidden alongside NearbyPlayersPanel → rejected (unnecessary complexity; combat has its own log in CombatScreen)

## Decision 4: Player Detail Modal Pattern

**Decision**: Follow the existing SkillDetailModal/StatTrainingModal pattern — fixed overlay with centered dialog, close on backdrop click / X button / Escape key.

**Rationale**: Consistent with existing UI patterns. The overlay pattern is already used across 5+ modals in the codebase. z-index 250 (between existing 200 and 300 range).

**Alternatives considered**:
- Phaser-rendered modal → rejected (all existing modals are HTML/DOM; mixing would break consistency)
- Inline expansion in the panel → rejected (not extensible for future action buttons)

## Decision 5: Panel Visibility on Tile Maps

**Decision**: The NearbyPlayersPanel only functions on city maps (where nodes exist). On tile maps, the panel remains visible but shows the empty state ("No other players here") since tile maps use `pos_x/pos_y` coordinates rather than discrete nodes, making "same location" impractical.

**Rationale**: City maps use discrete path nodes making co-location well-defined. Tile maps use continuous pixel coordinates where "same location" is ambiguous. Future features could add proximity-based detection for tile maps.

**Alternatives considered**:
- Hide panel entirely on tile maps → rejected (jarring layout change when switching zones)
- Proximity-based detection on tile maps → deferred (out of scope; adds complexity for a rare scenario)
