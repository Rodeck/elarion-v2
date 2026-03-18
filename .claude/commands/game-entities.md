---
description: Create game entities (items, monsters, NPCs, recipes, abilities, building actions, encounters) via the admin REST API. Use this skill when the user wants to add new game content.
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
| `create-building-action` | Create building action (travel/explore/expedition) | POST `/api/maps/:z/buildings/:b/actions` |
| `assign-building-npc` | Assign NPC to a building | POST `/api/maps/:z/buildings/:b/npcs` |
| `create-ability` | Create a combat ability | POST `/api/abilities` |
| `set-encounter` | Set night random encounter entry | PUT `/api/encounter-tables/:zoneId` |

## Data Format Reference

### create-item
```json
{
  "name": "Iron Ore",           // required, max 64 chars
  "category": "resource",       // required: resource|food|heal|weapon|boots|shield|greaves|bracer|tool|helmet|chestplate
  "description": "Raw iron",    // optional
  "stack_size": 20,             // required for resource/food/heal, forbidden otherwise
  "weapon_subtype": null,       // required for weapon: one_handed|two_handed|dagger|wand|staff|bow
  "attack": null,               // weapon only, integer >= 0
  "defence": null,              // boots/shield/greaves/bracer/helmet/chestplate only, integer >= 0
  "heal_power": null,           // heal only, integer >= 0
  "food_power": null            // food only, integer >= 0
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
```

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
