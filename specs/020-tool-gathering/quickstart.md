# Quickstart: Tool Durability & Gathering System

**Feature Branch**: `020-tool-gathering`

## What This Feature Does

Adds tool durability and a gathering system to Elarion. Admins create tools (pickaxes, axes) with durability and power stats. Admins configure "gather" actions on buildings where players use tools to passively gather resources over time. Each second of gathering consumes tool durability and may trigger events: finding resources, discovering gold, fighting monsters, suffering accidents, or nothing. HP loss persists, tools break when durability runs out, and players at 0 HP must heal before doing anything.

## Key Files to Modify

### Backend

| File | Change |
|------|--------|
| `backend/src/db/migrations/021_tool_gathering.sql` | **NEW** — schema changes (item_definitions cols, inventory_items col, building_actions CHECK, characters col) |
| `backend/src/db/queries/inventory.ts` | Extend ItemDefinition/InventoryItem interfaces, add durability update/check queries |
| `backend/src/db/queries/characters.ts` | Add `in_gathering` to Character interface and updateCharacter fields |
| `backend/src/game/gathering/gathering-service.ts` | **NEW** — GatheringSession manager, tick loop, event processing |
| `backend/src/game/gathering/gathering-handler.ts` | **NEW** — WebSocket message handler for gathering.start/cancel |
| `backend/src/game/world/building-action-handler.ts` | Add `in_gathering` gate check, route 'gather' action type |
| `backend/src/game/combat/explore-combat-service.ts` | Add HP > 0 guard before explore encounters |
| `backend/src/game/inventory/inventory-grant-service.ts` | Initialize `current_durability` when granting tool items |

### Shared

| File | Change |
|------|--------|
| `shared/protocol/index.ts` | Add GatherActionDto, gathering message types/payloads, extend ItemDefinitionDto and InventorySlotDto |

### Frontend

| File | Change |
|------|--------|
| `frontend/src/ui/BuildingPanel.ts` | Add gather action UI (duration picker, start button, progress display) |
| `frontend/src/ui/InventoryPanel.ts` | Show durability bar/text on tool items |
| `frontend/src/websocket/message-handler.ts` | Handle gathering.* messages |

### Admin

| File | Change |
|------|--------|
| `admin/backend/src/routes/items.ts` | Accept tool_type, max_durability, power fields on tool items |
| `admin/backend/src/routes/buildings.ts` | Accept 'gather' action_type, validate gather config |
| `admin/frontend/src/pages/items.ts` | Add tool-specific form fields |
| `admin/frontend/src/pages/building-actions.ts` | Add gather action config UI (events editor) |

## How to Test Manually

1. **Create a tool item**: Admin panel → Items → New → category "tool", tool_type "pickaxe", max_durability 1000, power 10
2. **Grant tool to player**: Via admin command or crafting
3. **Create gather action**: Admin panel → Buildings → select building → Actions → New gather action with event list
4. **Start gathering**: In-game, visit building, select gather action, choose duration, start
5. **Observe events**: Watch tick-by-tick events in the gathering progress UI
6. **Verify durability**: Check tool durability decreased after gathering
7. **Test edge cases**: Cancel early (durability still consumed), 0 HP blocking, tool destruction

## Architecture Notes

- **Gathering sessions are in-memory** (`Map<string, GatheringSession>`) — same pattern as combat sessions. Lost on server restart (acceptable for 30–120s sessions).
- **Event processing**: 1-second `setInterval` per session. Each tick rolls a weighted random event, processes it, and sends a `gathering.tick` message.
- **Combat during gathering**: Reuses existing `CombatSession`. Gathering timer pauses during combat, resumes or ends after.
- **Durability cost**: Full chosen duration cost applied at session end, regardless of actual elapsed time. This simplifies the logic and matches the spec ("loses all tool durability anyways" on cancel).
- **HP updates**: Accidents directly call `updateCharacter({ current_hp })`. Combat HP changes are handled by the existing combat system.
