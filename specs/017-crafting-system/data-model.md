# Data Model: Crafting System

**Feature**: 017-crafting-system | **Date**: 2026-03-17

## Entity Relationship Diagram

```
npcs (existing)
├── + is_crafter: boolean
│
├── 1:N ──► crafting_recipes
│            ├── id
│            ├── npc_id → npcs.id
│            ├── name
│            ├── description
│            ├── output_item_id → item_definitions.id
│            ├── output_quantity
│            ├── cost_crowns
│            ├── craft_time_seconds (per unit)
│            ├── sort_order
│            ├── created_at
│            │
│            └── 1:N ──► recipe_ingredients
│                         ├── id
│                         ├── recipe_id → crafting_recipes.id
│                         ├── item_def_id → item_definitions.id
│                         └── quantity (per 1x craft)

characters (existing)
├── 1:N ──► crafting_sessions
│            ├── id
│            ├── character_id → characters.id
│            ├── recipe_id → crafting_recipes.id
│            ├── npc_id → npcs.id
│            ├── quantity (number of units being crafted)
│            ├── started_at
│            ├── total_duration_seconds
│            ├── cost_crowns (snapshot of total crowns spent)
│            ├── status: 'in_progress' | 'completed' | 'collected' | 'cancelled'
│            ├── created_at
│            │
│            └── 1:N ──► crafting_session_costs
│                         ├── id
│                         ├── session_id → crafting_sessions.id
│                         ├── item_def_id → item_definitions.id
│                         └── quantity_spent (total materials consumed)
```

## Entities

### crafting_recipes

Defines what can be crafted at a specific NPC.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Unique recipe identifier |
| npc_id | INTEGER | NOT NULL, FK → npcs(id) ON DELETE CASCADE | The crafting NPC that offers this recipe |
| name | TEXT | NOT NULL | Display name of the recipe |
| description | TEXT | | Optional flavor text |
| output_item_id | INTEGER | NOT NULL, FK → item_definitions(id) | The item produced |
| output_quantity | INTEGER | NOT NULL, DEFAULT 1, CHECK > 0 | Items produced per 1x craft |
| cost_crowns | INTEGER | NOT NULL, DEFAULT 0, CHECK >= 0 | Crown cost per 1x craft |
| craft_time_seconds | INTEGER | NOT NULL, CHECK > 0 | Seconds per 1x craft |
| sort_order | INTEGER | NOT NULL, DEFAULT 0 | Display ordering within NPC |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Creation timestamp |

### recipe_ingredients

Required input items for a recipe (1 to N per recipe).

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Unique identifier |
| recipe_id | INTEGER | NOT NULL, FK → crafting_recipes(id) ON DELETE CASCADE | Parent recipe |
| item_def_id | INTEGER | NOT NULL, FK → item_definitions(id) | Required item |
| quantity | INTEGER | NOT NULL, CHECK > 0 | Amount needed per 1x craft |

**Unique constraint**: (recipe_id, item_def_id) — each item appears at most once per recipe.

### crafting_sessions

Active and historical crafting jobs for players.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Unique session identifier |
| character_id | UUID | NOT NULL, FK → characters(id) ON DELETE CASCADE | The crafting player |
| recipe_id | INTEGER | NOT NULL, FK → crafting_recipes(id) | Recipe being crafted |
| npc_id | INTEGER | NOT NULL, FK → npcs(id) | NPC where crafting takes place |
| quantity | INTEGER | NOT NULL, CHECK > 0 | Number of units being crafted |
| started_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | When crafting began |
| total_duration_seconds | INTEGER | NOT NULL, CHECK > 0 | Total time for all units (craft_time × quantity) |
| cost_crowns | INTEGER | NOT NULL, DEFAULT 0 | Total crowns spent (snapshot) |
| status | TEXT | NOT NULL, DEFAULT 'in_progress', CHECK IN ('in_progress', 'completed', 'collected', 'cancelled') | Session lifecycle state |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Row creation timestamp |

**Unique constraint**: (character_id, recipe_id, npc_id) WHERE status = 'in_progress' — prevents duplicate active sessions for same recipe at same NPC.

### crafting_session_costs

Snapshot of materials consumed when crafting started (for refund calculation).

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Unique identifier |
| session_id | INTEGER | NOT NULL, FK → crafting_sessions(id) ON DELETE CASCADE | Parent session |
| item_def_id | INTEGER | NOT NULL, FK → item_definitions(id) | Item that was consumed |
| quantity_spent | INTEGER | NOT NULL, CHECK > 0 | Total amount consumed |

### npcs (existing table — modification)

| Field | Type | Change | Description |
|-------|------|--------|-------------|
| is_crafter | BOOLEAN | ADD, NOT NULL, DEFAULT false | Whether this NPC offers crafting |

## State Transitions

### Crafting Session Lifecycle

```
[Player starts craft]
        │
        ▼
   in_progress ──────────► cancelled
        │                  (player cancels → 50% refund)
        │
        │ (wall-clock time elapsed ≥ total_duration)
        ▼
   completed ─────────────► collected
        │                  (player collects items)
        │
        ▲
   [admin /crafting_finish forces this transition]
```

- `in_progress → completed`: Automatic when `now() - started_at >= total_duration_seconds`. Detected on next query, not via background job.
- `in_progress → cancelled`: Player-initiated. Triggers 50% material/crown refund.
- `completed → collected`: Player clicks Collect. Items granted to inventory.
- `in_progress → completed` (forced): Admin `/crafting_finish` command.

## Indexes

- `crafting_recipes(npc_id)` — fast lookup of recipes by NPC
- `crafting_sessions(character_id, status)` — fast lookup of active sessions for a player
- `crafting_session_costs(session_id)` — fast lookup of costs for refund calculation

## Migration File

`backend/src/db/migrations/019_crafting_system.sql`
