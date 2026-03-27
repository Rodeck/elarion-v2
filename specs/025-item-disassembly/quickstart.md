# Quickstart: Item Disassembly System

**Feature Branch**: `025-item-disassembly`

## What This Feature Does

Adds item disassembly — players can break down items into component materials at designated NPC disassemblers. Each item type has configurable chance-based output recipes. Requires a kiln tool (with durability) and costs gold.

## Key Files to Touch

### Database
- `backend/src/db/migrations/027_item_disassembly.sql` — new tables + ALTER

### Backend (game server)
- `backend/src/db/queries/disassembly.ts` — new: DB queries for recipes, execution
- `backend/src/game/disassembly/disassembly-handler.ts` — new: WebSocket handler
- `backend/src/game/disassembly/disassembly-service.ts` — new: business logic (preview, execute, chance rolls)
- `backend/src/websocket/dispatcher.ts` — register `disassembly.*` handlers

### Shared Protocol
- `shared/protocol/index.ts` — add disassembly message types, DTOs, rejection reasons

### Frontend (game client)
- `frontend/src/ui/DisassemblyModal.ts` — new: 15-slot grid + kiln slot + output summary
- `frontend/src/ui/BuildingPanel.ts` — add `is_disassembler` dialog option
- `frontend/src/scenes/GameScene.ts` — wire disassembly message handlers

### Admin Backend
- `admin/backend/src/routes/items.ts` — add disassembly recipe CRUD to item endpoints
- `admin/backend/src/routes/npcs.ts` — add `is_disassembler` to NPC CRUD

### Admin Frontend
- `admin/frontend/src/ui/item-manager.ts` — convert inline form → modal, add recipe editor
- `admin/frontend/src/ui/item-modal.ts` — new: modal dialog for item add/edit with recipe section
- `admin/frontend/src/editor/api.ts` — add recipe API types + functions
- `admin/frontend/src/styles.css` — add item-modal styles (reuse item-picker pattern)

## Patterns to Follow

| Pattern | Reference File | What to Copy |
|---------|---------------|--------------|
| NPC boolean flag | `npcs` table (`is_crafter`) | Column + admin checkbox + dialog option |
| Tool type | `item_definitions` (`tool_type`) | CHECK constraint extension |
| WebSocket handler | `crafting-handler.ts` | open/execute/rejected pattern |
| Rejection reasons | `CraftingRejectionReason` | Typed union enum |
| NPC dialog option | `BuildingPanel.ts:724-864` | `buildDialogOption()` + callback |
| Drag-and-drop | `MarketplaceModal.ts:142-167` | `dragover`/`drop` with slot_id JSON |
| Admin modal | `item-picker.ts` / `image-gen-dialog.ts` | Overlay + centered modal |
| DB queries | `crafting.ts` | Recipe + output queries pattern |

## Dev Workflow

1. Run migration `027_item_disassembly.sql`
2. Create a kiln item definition via admin (category: tool, tool_type: kiln)
3. Configure disassembly recipes on test items via admin modal
4. Flag an NPC as disassembler via admin
5. In-game: visit building with disassembler NPC, interact, test full flow
