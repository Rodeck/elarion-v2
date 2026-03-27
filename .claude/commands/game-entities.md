---
description: Create game entities (items, monsters, NPCs, recipes, abilities, building actions, encounters, quests, gathering actions) via the admin REST API. Use this skill when the user wants to add new game content.
---

## Goal

Create game entities by sending validated requests to the admin REST API (Express, port 4001). This avoids direct DB manipulation and respects all server-side validation.

## Prerequisites

- The admin backend must be running (`cd admin/backend && npm run dev`)
- Valid admin credentials (defaults: admin/admin)

## Script Location

`D:\projects\elarion-v2\scripts\game-entities.js` — standalone Node.js script using native `http` module.

Run via Bash: `node scripts/game-entities.js <command> '<json-data>'`

## Available Commands

| Command | Description | API Endpoint |
|---------|-------------|-------------|
| `create-item` | Create an item definition | POST `/api/items` |
| `create-monster` | Create a monster | POST `/api/monsters` |
| `create-monster-loot` | Add loot entry to a monster | POST `/api/monsters/:id/loot` |
| `create-npc` | Create an NPC | POST `/api/npcs` |
| `upload-npc-icon` | Upload PNG icon for NPC use | POST `/api/npcs/upload` |
| `set-npc-crafter` | Set/unset NPC crafter flag | PUT `/api/npcs/:id/crafter` |
| `create-recipe` | Create a crafting recipe | POST `/api/recipes` |
| `create-building-action` | Create building action (travel/explore/expedition/gather) | POST `/api/maps/:z/buildings/:b/actions` |
| `assign-building-npc` | Assign NPC to a building | POST `/api/maps/:z/buildings/:b/npcs` |
| `create-ability` | Create a combat ability | POST `/api/abilities` |
| `set-encounter` | Set night random encounter entry | PUT `/api/encounter-tables/:zoneId` |
| `create-quest` | Create a quest with objectives, prereqs, rewards, NPC givers | POST `/api/quests` |
| `update-quest` | Update an existing quest (pass id + fields to change) | PUT `/api/quests/:id` |
| `delete-quest` | Delete a quest by id | DELETE `/api/quests/:id` |
| `create-squire` | Create a squire definition | POST `/api/squire-definitions` |
| `upload-squire-icon` | Upload PNG icon for a squire definition | POST `/api/squire-definitions/:id/icon` |
| `create-monster-squire-loot` | Add squire loot entry to a monster | POST `/api/monsters/:id/squire-loot` |
| `set-npc-dismisser` | Set/unset NPC squire dismisser flag | PUT `/api/npcs/:id/squire-dismisser` |
| `create-fishing-loot` | Add a fishing loot entry | POST `/api/fishing-loot` |
| `update-fishing-loot` | Update a fishing loot entry | PUT `/api/fishing-loot/:id` |
| `delete-fishing-loot` | Delete a fishing loot entry | DELETE `/api/fishing-loot/:id` |
| `create-rod-tier` | Create a fishing rod tier | POST `/api/fishing-rod-tiers` |
| `update-rod-tier` | Update a fishing rod tier | PUT `/api/fishing-rod-tiers/:tier` |
| `delete-rod-tier` | Delete a fishing rod tier | DELETE `/api/fishing-rod-tiers/:tier` |

## Data Format Reference

### create-item
```json
{
  "name": "Iron Ore",           // required, max 64 chars
  "category": "resource",       // required: resource|food|heal|weapon|boots|shield|greaves|bracer|tool|helmet|chestplate|ring|amulet
  "description": "Raw iron",    // optional
  "stack_size": 20,             // required for resource/food/heal, forbidden otherwise
  "weapon_subtype": null,       // required for weapon: one_handed|two_handed|dagger|wand|staff|bow
  "attack": null,               // weapon only, integer >= 0
  "defence": null,              // boots/shield/greaves/bracer/helmet/chestplate only, integer >= 0
  "heal_power": null,           // heal only, integer >= 0
  "food_power": null,           // food only, integer >= 0
  "tool_type": null,            // tool only: pickaxe|axe|fishing_rod|kiln
  "max_durability": null,       // tool only, required for tools, integer >= 1
  "power": null,                // tool only, optional, integer >= 1
  "disassembly_cost": 0         // optional, crowns cost per unit to disassemble, integer >= 0
}
```

### create-monster
```json
{
  "name": "Goblin",             // required
  "attack": 5,                  // required, integer >= 0
  "defense": 2,                 // required, integer >= 0
  "hp": 30,                     // required, integer >= 1
  "xp_reward": 15,              // required, integer >= 0
  "min_crowns": 1,              // optional, default 0, must be <= max_crowns
  "max_crowns": 3               // optional, default 0
}
```

### create-monster-loot
```json
{
  "monster_id": 1,              // required, references existing monster
  "item_def_id": 5,             // required, references existing item
  "drop_chance": 30,            // required, 1-100
  "quantity": 1                 // optional, default 1, integer >= 1
}
```

### upload-npc-icon
```json
{
  "file_path": "/absolute/path/to/icon.png"  // required, must be valid PNG
}
```
Returns `{ "icon_filename": "uuid.png" }` — use this in create-npc.

### create-npc
```json
{
  "name": "Blacksmith",                // required
  "description": "Forges weapons",     // required
  "icon_filename": "uuid.png"          // required, from upload-npc-icon result
}
```

### set-npc-crafter
```json
{
  "npc_id": 1,                  // required
  "is_crafter": true            // required, boolean
}
```

### create-recipe
```json
{
  "name": "Iron Sword",               // required
  "npc_id": 1,                        // required, references crafter NPC
  "output_item_id": 10,               // required, references item
  "output_quantity": 1,                // required, integer >= 1
  "cost_crowns": 50,                   // required, integer >= 0
  "craft_time_seconds": 30,            // required, integer >= 0
  "ingredients": [                     // optional array
    { "item_def_id": 5, "quantity": 3 }
  ]
}
```

### create-building-action
```json
// Travel action
{
  "zone_id": 1, "building_id": 2,
  "action_type": "travel",
  "config": { "target_zone_id": 2, "target_node_id": 1 }
}

// Explore action
{
  "zone_id": 1, "building_id": 2,
  "action_type": "explore",
  "config": {
    "encounter_chance": 40,
    "monsters": [{ "monster_id": 1, "weight": 10 }]
  }
}

// Expedition action
{
  "zone_id": 1, "building_id": 2,
  "action_type": "expedition",
  "config": {
    "base_gold": 10, "base_exp": 20,
    "items": [{ "item_def_id": 5, "base_quantity": 2 }]
  }
}

// Gather action
{
  "zone_id": 1, "building_id": 3,
  "action_type": "gather",
  "config": {
    "required_tool_type": "pickaxe",    // required: pickaxe|axe
    "durability_per_second": 2,          // required, positive integer — tool durability consumed per second
    "min_seconds": 10,                   // required, positive integer — minimum gathering duration
    "max_seconds": 60,                   // required, positive integer — maximum gathering duration (>= min)
    "events": [                          // required, non-empty array — weighted random events per tick
      { "type": "resource", "weight": 50, "item_def_id": 5, "quantity": 1 },
      { "type": "gold", "weight": 20, "min_amount": 1, "max_amount": 5 },
      { "type": "nothing", "weight": 15 },
      { "type": "accident", "weight": 10, "hp_damage": 3 },
      { "type": "monster", "weight": 5, "monster_id": 1 }
    ]
  }
}
```

**Gather event types:**
- `resource` — grants item on session end: requires `item_def_id` (positive int), `quantity` (positive int)
- `gold` — grants crowns on session end: requires `min_amount` (non-negative int), `max_amount` (positive int, >= min)
- `monster` — triggers combat encounter (pauses gathering): requires `monster_id` (positive int)
- `accident` — deals immediate HP damage: requires `hp_damage` (positive int)
- `nothing` — no effect (silent tick)
- All events require `weight` (positive int) for weighted random selection

### assign-building-npc
```json
{
  "zone_id": 1,                 // required
  "building_id": 2,             // required
  "npc_id": 1                   // required
}
```

### create-ability
```json
{
  "name": "Fireball",                  // required
  "effect_type": "damage",             // required: damage|heal|buff|debuff|dot|reflect|drain
  "mana_cost": 10,                     // required, integer >= 0
  "effect_value": 25,                  // required, integer >= 0
  "description": "A ball of fire",     // optional
  "duration_turns": 0,                 // optional, default 0
  "cooldown_turns": 0,                 // optional, default 0
  "slot_type": "both",                 // optional: auto|active|both (default: both)
  "priority_default": 1                // optional, 1-99 (default: 1)
}
```

### set-encounter
```json
{
  "zone_id": 1,                 // required, integer >= 1
  "monster_id": 1,              // required, integer >= 1
  "weight": 10                  // required, integer >= 1
}
```

### create-quest
```json
{
  "name": "Goblin Slayer",                    // required, unique
  "description": "Defeat goblins in the forest", // required
  "quest_type": "daily",                      // required: main|side|daily|weekly|monthly|repeatable
  "sort_order": 0,                            // optional, default 0
  "is_active": true,                          // optional, default true
  "chain_id": "goblin_saga",                  // optional, groups chain quests
  "chain_step": 1,                            // optional, ordering within chain
  "objectives": [                             // required, at least one
    {
      "objective_type": "kill_monster",        // required: kill_monster|collect_item|craft_item|spend_crowns|gather_resource|reach_level|visit_location|talk_to_npc
      "target_id": 1,                         // monster/item/npc/zone/building ID depending on type (null for spend_crowns, reach_level)
      "target_quantity": 5,                   // required, positive integer
      "target_duration": null,                // optional, seconds (gather_resource only)
      "description": null,                    // optional, human-readable override
      "dialog_prompt": null,                  // optional, for talk_to_npc: what player says (e.g. "Borin sent me")
      "dialog_response": null                 // optional, for talk_to_npc: what NPC replies (e.g. "Ah yes, tell him I said hello")
    }
  ],
  "prerequisites": [                          // optional
    { "prereq_type": "min_level", "target_id": null, "target_value": 5 },
    { "prereq_type": "has_item", "target_id": 10, "target_value": 1 },
    { "prereq_type": "completed_quest", "target_id": 3, "target_value": 1 },
    { "prereq_type": "class_required", "target_id": 1, "target_value": 1 }
  ],
  "rewards": [                                // optional — valid types: item, xp, crowns, squire, rod_upgrade_points
    { "reward_type": "item", "target_id": 12, "quantity": 2 },
    { "reward_type": "xp", "quantity": 100 },
    { "reward_type": "crowns", "quantity": 50 },
    { "reward_type": "rod_upgrade_points", "quantity": 20 }
  ],
  "npc_ids": [1, 3]                           // optional, NPC IDs that offer this quest
}
```

**Objective type → target_id reference:**
- `kill_monster` → monster ID (from `game-data monsters`)
- `collect_item` → item_definition ID (from `game-data items`)
- `craft_item` → item_definition ID
- `spend_crowns` → null (amount in target_quantity)
- `gather_resource` → building ID (from `game-data zone <id>`)
- `reach_level` → null (level in target_quantity)
- `visit_location` → zone ID (from `game-data maps`)
- `talk_to_npc` → NPC ID (from `game-data npcs`)

### update-quest
```json
{
  "id": 1,                                    // required, quest to update
  "description": "Updated description",       // any field from create-quest (except name uniqueness still applies)
  "objectives": [...],                        // replaces all objectives if provided
  "prerequisites": [...],                     // replaces all prerequisites if provided
  "rewards": [...],                           // replaces all rewards if provided
  "npc_ids": [1, 2]                           // replaces all NPC assignments if provided
}
```

### delete-quest
```json
{
  "id": 1                                     // required, quest to delete (cascades to objectives/prereqs/rewards/NPC assignments)
}
```

### create-squire
```json
{
  "name": "Brand",                            // required, unique name
  "power_level": 50                           // required, integer 0-100 (expedition bonus %)
}
```

### upload-squire-icon
```json
{
  "squire_def_id": 1,                         // required, squire definition id
  "file_path": "/abs/path/to/icon.png"        // required, absolute path to PNG file
}
```

### create-monster-squire-loot
```json
{
  "monster_id": 1,                            // required, monster id
  "squire_def_id": 1,                         // required, squire definition id
  "drop_chance": 10,                          // required, 1-100 percentage
  "squire_level": 5                           // optional, 1-20 (default 1)
}
```

### set-npc-dismisser
```json
{
  "npc_id": 1,                                // required, NPC id
  "is_squire_dismisser": true                 // required, boolean
}
```

### create-fishing-loot
```json
{
  "min_rod_tier": 2,              // required, 1-5 — minimum rod tier to access this drop
  "item_def_id": 15,              // required, references existing item
  "drop_weight": 10               // required, integer >= 1 — relative weight for weighted random selection
}
```

### update-fishing-loot
```json
{
  "id": 1,                        // required, fishing loot entry id
  "min_rod_tier": 3,              // required, 1-5
  "drop_weight": 5                // required, integer >= 1
}
```

### delete-fishing-loot
```json
{
  "id": 1                         // required, fishing loot entry id
}
```

### create-rod-tier
```json
{
  "tier": 3,                      // required, 1-5
  "item_def_id": 22,              // required, references the fishing rod item definition for this tier
  "upgrade_points_cost": 100,     // required, integer >= 0 (T1 should be 0)
  "max_durability": 75,           // required, integer > 0
  "repair_crown_cost": 50         // required, integer >= 0
}
```

### update-rod-tier
```json
{
  "tier": 3,                      // required, 1-5
  "upgrade_points_cost": 120,     // required
  "max_durability": 80,           // required
  "repair_crown_cost": 60         // required
}
```

### delete-rod-tier
```json
{
  "tier": 3                       // required, 1-5
}
```

### Fishing building action (in create-building-action)
```json
{
  "zone_id": 1, "building_id": 5,
  "action_type": "fishing",
  "config": {
    "min_rod_tier": 1              // optional, minimum rod tier for this spot (default: any)
  }
}
```

### Rod upgrade points reward type (in create-quest rewards array)
```json
{
  "reward_type": "rod_upgrade_points",
  "quantity": 20                   // amount of rod upgrade points to award
}
```

### Squire reward type (in create-quest rewards array)
```json
{
  "reward_type": "squire",                    // squire reward type
  "target_id": 1,                             // squire_definitions.id
  "quantity": 5                               // squire level 1-20
}
```

### Squire gather event type (in create-building-action gather events)
```json
{
  "type": "squire",                           // squire event type
  "weight": 2,                                // weighted probability
  "squire_def_id": 1,                         // squire_definitions.id
  "squire_level": 3                           // level 1-20
}
```

## Workflow Pattern

When creating game entities, always follow this pattern:

1. **Query existing data** using `game-data` skill to understand current content and avoid duplicates
2. **Validate balance** — check that stats fit within existing ranges (use `game-data economy` and `game-data monsters`)
3. **Create entities** in dependency order: items before loot/recipes, NPCs before building assignment, monsters before encounters
4. **Verify creation** using `game-data` skill to confirm the entity exists

## Example Workflows

### Add a new monster with loot
```bash
# 1. Check existing monsters for balance reference
node scripts/game-data.js monsters

# 2. Check what items exist for potential loot
node scripts/game-data.js items

# 3. Create the monster
node scripts/game-entities.js create-monster '{"name":"Forest Wolf","attack":8,"defense":3,"hp":45,"xp_reward":20,"min_crowns":2,"max_crowns":5}'

# 4. Add loot entries (use the monster id from step 3)
node scripts/game-entities.js create-monster-loot '{"monster_id":NEW_ID,"item_def_id":5,"drop_chance":40,"quantity":1}'

# 5. Verify
node scripts/game-data.js monster NEW_ID
```

### Create a crafting recipe
```bash
# 1. Check existing recipes and NPCs
node scripts/game-data.js recipes
node scripts/game-data.js npcs

# 2. Check items for ingredients and output
node scripts/game-data.js items

# 3. Create the recipe
node scripts/game-entities.js create-recipe '{"name":"Steel Sword","npc_id":1,"output_item_id":10,"output_quantity":1,"cost_crowns":100,"craft_time_seconds":60,"ingredients":[{"item_def_id":5,"quantity":5},{"item_def_id":6,"quantity":2}]}'

# 4. Verify
node scripts/game-data.js recipes
```

### Create a daily quest
```bash
# 1. Check existing quests, monsters, items, NPCs
node scripts/game-data.js quests
node scripts/game-data.js monsters
node scripts/game-data.js items
node scripts/game-data.js npcs

# 2. Create the quest
node scripts/game-entities.js create-quest '{"name":"Daily Goblin Hunt","description":"The village needs protection from goblins. Defeat them and collect their teeth as proof.","quest_type":"daily","objectives":[{"objective_type":"kill_monster","target_id":1,"target_quantity":5},{"objective_type":"collect_item","target_id":12,"target_quantity":3}],"rewards":[{"reward_type":"xp","quantity":75},{"reward_type":"crowns","quantity":30},{"reward_type":"item","target_id":8,"quantity":1}],"npc_ids":[1]}'

# 3. Verify
node scripts/game-data.js quest NEW_ID
```

### Create a chain quest
```bash
# 1. Create quest A (first in chain)
node scripts/game-entities.js create-quest '{"name":"Blacksmith Apprentice I","description":"Gather materials for the blacksmith.","quest_type":"main","chain_id":"blacksmith_apprentice","chain_step":1,"objectives":[{"objective_type":"collect_item","target_id":5,"target_quantity":10}],"rewards":[{"reward_type":"xp","quantity":100}],"npc_ids":[1]}'

# 2. Create quest B (requires A — use quest A's ID as target_id in completed_quest prerequisite)
node scripts/game-entities.js create-quest '{"name":"Blacksmith Apprentice II","description":"Now craft your first weapon.","quest_type":"main","chain_id":"blacksmith_apprentice","chain_step":2,"objectives":[{"objective_type":"craft_item","target_id":10,"target_quantity":1}],"prerequisites":[{"prereq_type":"completed_quest","target_id":QUEST_A_ID,"target_value":1}],"rewards":[{"reward_type":"item","target_id":10,"quantity":1},{"reward_type":"xp","quantity":200}],"npc_ids":[1]}'

# 3. Verify chain
node scripts/game-data.js quests
```

### Add a gathering action to a building
```bash
# 1. Check zone buildings to pick a location
node scripts/game-data.js zone 1

# 2. Check existing gathering actions for balance reference
node scripts/game-data.js gathering

# 3. Check tool items (need matching tool_type)
node scripts/game-data.js items tool

# 4. Check resource items for rewards
node scripts/game-data.js items resource

# 5. Check monsters for encounter events
node scripts/game-data.js monsters

# 6. Create the gather action
node scripts/game-entities.js create-building-action '{"zone_id":1,"building_id":3,"action_type":"gather","config":{"required_tool_type":"pickaxe","durability_per_second":2,"min_seconds":10,"max_seconds":60,"events":[{"type":"resource","weight":50,"item_def_id":5,"quantity":1},{"type":"gold","weight":20,"min_amount":1,"max_amount":5},{"type":"nothing","weight":15},{"type":"accident","weight":10,"hp_damage":3},{"type":"monster","weight":5,"monster_id":1}]}}'

# 7. Verify
node scripts/game-data.js gathering
```

### Set up an explore encounter in a building
```bash
# 1. Check zone buildings
node scripts/game-data.js zone 1

# 2. Check available monsters
node scripts/game-data.js monsters

# 3. Create explore action
node scripts/game-entities.js create-building-action '{"zone_id":1,"building_id":2,"action_type":"explore","config":{"encounter_chance":50,"monsters":[{"monster_id":1,"weight":10},{"monster_id":2,"weight":5}]}}'

# 4. Verify
node scripts/game-data.js zone 1
```

## Important Notes

- The admin backend must be running on port 4001 for all commands to work
- NPC icons require a two-step process: first `upload-npc-icon`, then use the returned `icon_filename` in `create-npc`
- Use `game-data` skill to query existing content before creating — avoid duplicates and ensure balance
- The script outputs JSON: `{"success": true, "command": "...", "data": {...}}` on success, `{"success": false, "command": "...", "errors": [...]}` on failure
- All validation happens client-side first, then server-side — you'll get clear error messages either way
- This skill does NOT handle map topology (nodes, edges, zone creation) — only entity content within existing maps
