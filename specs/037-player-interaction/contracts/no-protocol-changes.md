# Protocol Contracts: Player Interaction Panel

**Feature**: 037-player-interaction | **Date**: 2026-04-07

## No New Messages

This feature introduces **no new WebSocket message types**. All required data is already available through existing messages:

### Messages Consumed (existing, unchanged)

| Message | Direction | Payload | Used For |
|---------|-----------|---------|----------|
| `world.state` | Server → Client | `WorldStatePayload` (includes `players: PlayerSummary[]`) | Initial population of remote player data |
| `player.entered_zone` | Server → Client | `PlayerEnteredZonePayload` (includes `character: PlayerSummary`) | Adding new remote player to tracking |
| `player.left_zone` | Server → Client | `PlayerLeftZonePayload` (includes `character_id`) | Removing remote player from tracking |
| `city.player_moved` | Server → Client | `CityPlayerMovedPayload` (includes `character_id`, `node_id`, `x`, `y`) | Updating remote player's current node |

### Key Field: `current_node_id`

The `PlayerSummary.current_node_id` field (already part of the protocol) is the basis for co-location detection. The `CityPlayerMovedPayload.node_id` field provides real-time node updates.

No protocol version bump is required.
