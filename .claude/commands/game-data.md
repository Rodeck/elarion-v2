---
description: Connect to the game database and fetch items, NPCs, maps, buildings, monsters, abilities, crafting recipes, gathering actions, and economy data. Use this skill when planning game changes, designing new content, or reviewing existing game data.
---

## Goal

Query the Elarion game database to retrieve current game content for planning, analysis, and content design.

## Script Location

`D:\projects\elarion-v2\scripts\game-data.js` — standalone Node.js script using `pg` to query PostgreSQL.

Run via Bash: `node scripts/game-data.js <command> [args...]`

## Available Commands

| Command | Description |
|---------|-------------|
| `overview` | High-level counts of all entities + zone summary |
| `items [category]` | All items, optionally filtered (resource, food, heal, weapon, boots, shield, greaves, bracer, tool, helmet, chestplate) |
| `item <id>` | Single item detail: stats, which monsters drop it, recipe usage, expedition sources |
| `monsters` | All monsters with loot and ability drop summaries |
| `monster <id>` | Monster detail: stats, full loot table, zone appearances, random encounters |
| `maps` | All zones with building/node counts |
| `zone <id>` | Full zone breakdown: buildings, actions (travel/explore/expedition), NPCs, night encounters |
| `npcs` | All NPCs with building locations and recipe counts |
| `recipes [npc_id]` | Crafting recipes with ingredients, optionally filtered by NPC |
| `abilities` | All abilities with effect details and monster drop sources |
| `quests [type]` | All quests with objective/reward/NPC counts, optionally filtered (main, side, daily, weekly, monthly, repeatable) |
| `quest <id>` | Quest detail: objectives with resolved target names, prerequisites, rewards, NPC givers, player stats |
| `gathering` | All gathering actions with tool requirements, duration ranges, events (resource/gold/monster/accident/nothing), and tool items |
| `economy` | Crown sources (monster drops), crown sinks (crafting costs), equipment stats, expedition rewards, gathering rewards |
| `search <term>` | Cross-entity name search (items, monsters, NPCs, buildings, abilities, recipes) |
| `sql "<query>"` | Run a raw SELECT query for ad-hoc analysis |

## Usage Pattern

When the user wants to plan game content changes:

1. **Start with `overview`** to understand the current game scale
2. **Drill into specifics** using `items`, `monsters`, `zone`, etc.
3. **Cross-reference** using `item <id>` to see where items appear across systems
4. **Check economy** to ensure new content fits existing balance
5. **Search** to find related content by name

## Example Workflows

### "I want to add a new crafting recipe"
1. `node scripts/game-data.js items` — see existing items for ingredients/outputs
2. `node scripts/game-data.js npcs` — see which NPCs are crafters and where they are
3. `node scripts/game-data.js recipes` — review existing recipe balance (costs, times)
4. `node scripts/game-data.js economy` — check crown balance

### "I want to add a new monster"
1. `node scripts/game-data.js monsters` — review existing monster stat ranges
2. `node scripts/game-data.js items weapon` — see available loot options
3. `node scripts/game-data.js abilities` — see abilities it could drop
4. `node scripts/game-data.js maps` — decide which zone it should appear in
5. `node scripts/game-data.js zone <id>` — check zone's existing encounters

### "I want to add or review quests"
1. `node scripts/game-data.js quests` — see existing quests, types, NPC assignments
2. `node scripts/game-data.js quest <id>` — full quest detail with objectives, prereqs, rewards
3. `node scripts/game-data.js npcs` — see which NPCs could be quest givers
4. `node scripts/game-data.js monsters` — see monsters for kill objectives
5. `node scripts/game-data.js items` — see items for collect/craft objectives and rewards

### "I want to add or review gathering actions"
1. `node scripts/game-data.js gathering` — see all gathering actions with tool types, durations, events
2. `node scripts/game-data.js items tool` — see existing tool items (pickaxe, axe)
3. `node scripts/game-data.js items resource` — see resource items available as rewards
4. `node scripts/game-data.js zone <id>` — check which buildings could host gathering
5. `node scripts/game-data.js monsters` — see monsters for encounter events

### "I want to review game balance"
1. `node scripts/game-data.js economy` — full economic overview (includes gathering rewards)
2. `node scripts/game-data.js monsters` — compare HP/attack/rewards across all monsters
3. `node scripts/game-data.js items weapon` — compare weapon stats
4. `node scripts/game-data.js recipes` — check crafting costs vs reward value

## Database Connection

Uses `DATABASE_URL` env var or defaults to: `postgresql://postgres:password@localhost:5432/elarion_dev`

The database must be running for queries to work. If connection fails, suggest the user start the database.

## Important Notes

- The `sql` command only runs SELECT queries for safety — it does NOT modify data
- All data modifications should go through proper migrations or admin API
- Use this skill for READ-ONLY analysis and planning — never suggest direct SQL INSERT/UPDATE
- When planning new content, always cross-reference with existing data to maintain balance
- The output uses formatted tables; for very large result sets, suggest filtering by category or using `search`
