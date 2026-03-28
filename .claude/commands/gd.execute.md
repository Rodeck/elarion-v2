---
description: Execute a game design by creating all entities via the admin REST API in dependency order.
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Outline

Create all entities defined in a design document by calling the admin REST API through the `game-entities` script. This is the final step — it turns a design document into live game content.

### Prerequisites

- The admin backend must be running (`cd admin/backend && npm run dev`) on port 4001
- The game backend should be running for verification (`cd backend && npm run dev`)
- A review has been completed (check for `review.md` with "Ready to execute" verdict) — warn if missing but don't block
- **Code changes check**: Read `design.md` and check the "Code Changes Required" section:
  - If it says "None — entities only": proceed normally
  - If code changes are listed: check whether they have been implemented:
    - Look for a matching `specs/` directory (e.g., `specs/*-<design-name>/`)
    - Check if `tasks.md` exists and all tasks are marked `[X]` (completed)
    - If code changes are NOT implemented: **STOP** and warn the user: "This design requires code changes that haven't been implemented yet. Run `/speckit.specify` with this design first, then come back to `/gd.execute`."
    - If code changes appear implemented: proceed with entity creation

### Workflow

1. **Locate the design**:
   - If `$ARGUMENTS` is a design name: look for `game_design/<name>/design.md`
   - If empty: list `game_design/*/design.md` and ask the user which to execute
   - Read `design.md` — focus on entity tables and the Execution Plan section
   - If `review.md` exists, check its verdict — warn if "Needs revision"

2. **Present execution summary** and ask for confirmation:
   ```
   Ready to create:
   - N items (resource: X, weapon: Y, tool: Z)
   - N NPCs (N crafters)
   - N monsters
   - N loot entries
   - N recipes
   - N building actions
   - N NPC assignments
   - N quests

   Proceed? (y/n)
   ```

3. **Execute in strict dependency order** using `node scripts/game-entities.js`:

   **Phase 1: Items** (`create-item`)
   - Create each item from the Items tables
   - Record returned IDs: `{ "Item Name": created_id }`
   - Verify each: `node scripts/game-data.js search "<name>"`

   **Phase 2: NPCs** (`create-npc`, `set-npc-crafter`, `set-npc-dismisser`)
   - If NPC icons exist: `upload-npc-icon` first, use returned `icon_filename`
   - Create each NPC
   - Set crafter/dismisser flags as specified
   - Record returned IDs

   **Phase 3: Monsters** (`create-monster`)
   - Create each monster
   - Record returned IDs

   **Phase 4: Monster Loot** (`create-monster-loot`)
   - Requires: item IDs (Phase 1) + monster IDs (Phase 3)
   - Create each loot entry using recorded IDs

   **Phase 5: Abilities** (`create-ability`) — if any
   - Create each ability
   - Record returned IDs

   **Phase 6: Recipes** (`create-recipe`)
   - Requires: item IDs (Phase 1) + NPC IDs (Phase 2)
   - Map ingredient names to item IDs
   - Map output item name to item ID
   - Create each recipe

   **Phase 7: Building Actions** (`create-building-action`)
   - Requires: item IDs (Phase 1), monster IDs (Phase 3), existing building IDs
   - For gather actions: map event item/monster names to IDs
   - For explore actions: map monster names to IDs
   - Create each action

   **Phase 8: NPC Assignments** (`assign-building-npc`)
   - Requires: NPC IDs (Phase 2) + existing building IDs
   - Assign each NPC to their designated building

   **Phase 9: Encounters** (`set-encounter`) — if any
   - Requires: monster IDs (Phase 3) + zone IDs
   - Set night random encounters

   **Phase 10: Quests** (`create-quest`) — if any
   - Requires: all entity IDs from previous phases
   - Map objective target names to IDs (monster IDs, item IDs, NPC IDs, zone IDs, building IDs)
   - Map reward target names to IDs
   - Map NPC giver names to NPC IDs
   - Create each quest

   **Phase 11: Squires** (`create-squire`, `create-monster-squire-loot`) — if any
   - Create squire definitions
   - Add squire loot to monsters

   **Phase 12: Fishing** (`create-rod-tier`, `create-fishing-loot`) — if any
   - Requires: item IDs for fishing rods, fish, rings, amulets (Phase 1)
   - Create rod tier definitions (link rod item_def_id to tier)
   - Create fishing loot entries (min_rod_tier + item_def_id + drop_weight)
   - Create fishing building actions on water buildings

4. **Track all created IDs** in an ID map throughout execution.

5. **Write `game_design/<name>/execution-log.md`**:

```markdown
# [Design Name] — Execution Log

**Executed**: [date]
**Status**: [Complete / Partial — N of M entities created]

## Created Entity IDs

### Items
| # | Name | Item ID |
|---|------|---------|
| 1 | [name] | [id] |

### NPCs
| NPC | NPC ID | Icon |
|-----|--------|------|
| [name] | [id] | [filename or "pending"] |

### Monsters
| Monster | Monster ID |
|---------|-----------|
| [name] | [id] |

### Loot Entries
| Monster | Item | Drop % | Status |
|---------|------|--------|--------|
| [name] | [name] | [%] | Created |

### Recipes
| Recipe | Recipe ID | NPC |
|--------|-----------|-----|
| [name] | [id] | [npc name] |

### Building Actions
| Building | Action Type | Status |
|----------|-------------|--------|
| [name (id)] | [type] | Created |

### NPC Assignments
| NPC | Building | Status |
|-----|----------|--------|
| [name] | [name (id)] | Assigned |

### Quests (if any)
| Quest | Quest ID |
|-------|----------|
| [name] | [id] |

## Errors
[Any failed operations with error messages]

## Verification
[Results of post-creation game-data queries confirming entities exist]
```

6. **Final verification**: Run `node scripts/game-data.js overview` and compare entity counts to pre-execution state.

7. **Report**: Summarize what was created, any errors, and the execution log path.

## Error Handling

- If a `create-*` call fails: log the error, continue with remaining entities that don't depend on the failed one
- If a dependency is missing (e.g., item creation failed, so recipe can't reference it): skip the dependent entity and log it
- At the end: report all failures and suggest fixes
- **Never retry silently** — if something fails, the user should know

## Guidelines

- **One entity at a time**: Don't batch API calls — create sequentially so errors are traceable
- **Verify after each phase**: Quick `game-data` check to confirm entities exist before moving to dependent phases
- **Preserve the design doc**: Don't modify design.md — all execution state goes in execution-log.md
- **Idempotent awareness**: If re-running after a partial execution, check what already exists via `game-data search` before creating duplicates
