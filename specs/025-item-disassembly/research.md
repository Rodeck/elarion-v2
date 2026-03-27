# Research: Item Disassembly System

**Feature Branch**: `025-item-disassembly`
**Date**: 2026-03-27

## Research Tasks & Findings

### 1. NPC Flag Pattern for Disassembler

**Decision**: Add `is_disassembler BOOLEAN NOT NULL DEFAULT false` column to `npcs` table.

**Rationale**: Follows the established pattern of `is_crafter`, `is_quest_giver`, `is_squire_dismisser` boolean flags on the `npcs` table (migrations 019, 022, 023). Each flag enables a specific dialog option in the BuildingPanel NPC dialog.

**Alternatives considered**:
- Building action type (`action_type = 'disassembly'`): Rejected. Disassembly is NPC-initiated via dialog (like crafting), not a building action button. Building actions are for zone-level interactions (travel, explore, gather, marketplace, fishing).
- Generic NPC capability system: Rejected per YAGNI — boolean flags work and are the established pattern.

### 2. Disassembly Recipe Storage

**Decision**: Two new tables — `disassembly_recipes` (chance entries) and `disassembly_recipe_outputs` (output items per entry). Plus `disassembly_cost` column on `item_definitions`.

**Rationale**: Mirrors the `crafting_recipes` + `recipe_ingredients` pattern from migration 019. Each disassembly recipe entry is a chance outcome (percentage) with multiple possible output items. The cost is per-item-definition since all instances of the same item type cost the same to disassemble.

**Alternatives considered**:
- JSON column on `item_definitions`: Rejected — no referential integrity, harder to query, and inconsistent with the relational pattern used by crafting.
- Single table with JSON outputs: Rejected — loses FK validation on output item IDs.

### 3. Kiln Tool Type

**Decision**: Extend `item_definitions.tool_type` CHECK constraint to include `'kiln'`. Kiln is a standard tool with `max_durability` and per-instance `current_durability` on `inventory_items`.

**Rationale**: The tool system from 020-tool-gathering already supports tool categories (`pickaxe`, `axe`, `fishing_rod`) with durability tracking. Adding `'kiln'` is a one-line CHECK constraint change. No new tables or columns needed — `inventory_items.current_durability` already tracks per-instance durability.

**Alternatives considered**:
- New item category `'kiln'`: Rejected — would require updating category CHECK constraints everywhere. Tool is the correct category; kiln is a tool type.
- Durability tracked on a separate table: Rejected — `inventory_items.current_durability` already exists for tools.

### 4. WebSocket Message Pattern

**Decision**: Use `disassembly.*` domain with standard patterns: `disassembly.open`, `disassembly.execute`, `disassembly.state`, `disassembly.result`, `disassembly.rejected`.

**Rationale**: Follows the `crafting.*` pattern exactly — NPC dialog opens modal, client sends open request, server responds with state (recipes for items in grid), client sends execute, server processes atomically and responds with result or rejection.

**Alternatives considered**:
- REST endpoint: Rejected — constitution prohibits REST for game state mutations (Quality Gate 1).
- Single request/response: Rejected — need separate open (get state) and execute (perform disassembly) messages.

### 5. Admin Item Modal Conversion

**Decision**: Convert item add/edit from inline left-panel form to a fixed-overlay modal dialog, reusing the `ImageGenDialog` / `ItemPickerDialog` modal CSS patterns already in the admin frontend.

**Rationale**: Current inline form (340px left column) has no room for disassembly recipe configuration (multiple chance entries, each with multiple output items). Existing modal patterns use `position: fixed; inset: 0; z-index: 1000` overlay with centered content div. The modal should be wider (800-900px) to accommodate the recipe editor alongside existing fields.

**Alternatives considered**:
- Tabbed inline form: Rejected — still width-constrained at 340px.
- Separate recipe management page: Rejected — breaks the workflow of editing an item and its recipes together.

### 6. Drag-and-Drop for Disassembly Window

**Decision**: Reuse the HTML5 drag-and-drop pattern from MarketplaceModal — inventory items set `text/plain` data with `{slot_id}` on `dragstart`, disassembly grid accepts `drop` events and extracts `slot_id`.

**Rationale**: MarketplaceModal already implements this exact pattern (lines 142-167). The disassembly window needs the same interaction but with a 15-slot grid (plus kiln slot) instead of a single drop zone. Items dragged back out of the grid return to inventory.

**Alternatives considered**:
- Click-to-add interface: Rejected — user specifically requested drag-and-drop like marketplace.
- Custom drag library: Rejected — HTML5 drag-and-drop already works in the project.

### 7. Inventory Space Calculation

**Decision**: Maximum possible output = for each item in grid, take the chance entry that produces the maximum total output quantity, then sum across all grid items. Check against free inventory slots.

**Rationale**: Worst-case approach prevents the situation where a lucky roll produces more items than the player can hold. Each item's recipes are rolled independently, so the worst case is the sum of each item's maximum possible output.

**Alternatives considered**:
- Average output check: Rejected — could still overflow on lucky rolls.
- Post-roll overflow to mail/bank: Rejected — no mail/bank system exists; adds complexity for an edge case better handled by upfront validation.

### 8. Chance Validation (100% Sum)

**Decision**: Enforce 100% sum at application layer (admin backend validation + admin frontend validation), not via database constraint.

**Rationale**: Cross-row sum constraints in PostgreSQL require triggers or CHECK constraints on auxiliary tables, which are fragile and hard to maintain. The crafting system similarly validates ingredient correctness at the application layer. Both admin backend (on save) and admin frontend (on form submit) will validate.

**Alternatives considered**:
- Database trigger: Rejected — harder to debug, maintain, and test. Application-layer validation provides better error messages.
