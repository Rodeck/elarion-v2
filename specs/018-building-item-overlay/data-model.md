# Data Model: Building Item Overlay

**Feature**: 018-building-item-overlay
**Date**: 2026-03-18

## Overview

No new database tables or columns are required. This feature computes overlay data by joining existing tables. This document describes the query relationships and the derived data structures used in the API response and frontend rendering.

## Existing Tables Used (Read-Only)

### buildings
| Field | Type | Usage |
|-------|------|-------|
| id | integer (PK) | Building identifier, key for grouping overlay items |
| zone_id | integer (FK → city_maps) | Scoping query to current map |
| node_id | integer (FK → path_nodes) | Position reference for overlay placement |
| name | text | Included in tooltip display |

### building_actions
| Field | Type | Usage |
|-------|------|-------|
| id | integer (PK) | — |
| building_id | integer (FK → buildings) | Join to building |
| action_type | text | Filter: only `'explore'` actions have monster config |
| config | jsonb | Extract `config.monsters[].monster_id` for loot lookup |

### monsters
| Field | Type | Usage |
|-------|------|-------|
| id | integer (PK) | Join target from building_actions config |
| name | text | Included in tooltip (source monster name) |

### monster_loot
| Field | Type | Usage |
|-------|------|-------|
| monster_id | integer (FK → monsters) | Join from monsters |
| item_def_id | integer (FK → item_definitions) | Target item |
| drop_chance | integer | Informational (for tooltip) |

### building_npcs
| Field | Type | Usage |
|-------|------|-------|
| building_id | integer (FK → buildings) | Join to building |
| npc_id | integer (FK → npcs) | Join to NPC |

### npcs
| Field | Type | Usage |
|-------|------|-------|
| id | integer (PK) | Join target |
| name | text | Included in tooltip (source NPC name) |
| is_crafter | boolean | Filter: only crafter NPCs have recipes |

### crafting_recipes
| Field | Type | Usage |
|-------|------|-------|
| id | integer (PK) | — |
| npc_id | integer (FK → npcs) | Join from NPC |
| output_item_id | integer (FK → item_definitions) | Target item |
| name | text | Recipe name for tooltip |

### item_definitions
| Field | Type | Usage |
|-------|------|-------|
| id | integer (PK) | Item identifier |
| name | text | Display name in tooltip |
| icon_filename | text | Icon image filename for overlay rendering |

## Derived Data Structures

### BuildingItemsResponse (API response)

```
{
  buildings: [
    {
      building_id: number
      building_name: string
      items: [
        {
          item_id: number
          item_name: string
          icon_filename: string
          obtain_method: "loot" | "craft"
          source_name: string       // monster name or NPC name
        }
      ]
    }
  ]
}
```

### Query Flow: Loot Items

```
buildings (zone_id = :mapId)
  → building_actions (building_id, action_type = 'explore')
    → jsonb_array_elements(config->'monsters') → monster_id
      → monsters (id)
        → monster_loot (monster_id)
          → item_definitions (id = item_def_id)
```

Result: each row = one lootable item with obtain_method = "loot", source_name = monster.name

### Query Flow: Craftable Items

```
buildings (zone_id = :mapId)
  → building_npcs (building_id)
    → npcs (id, is_crafter = true)
      → crafting_recipes (npc_id)
        → item_definitions (id = output_item_id)
```

Result: each row = one craftable item with obtain_method = "craft", source_name = npc.name

### Deduplication

Items are NOT deduplicated across obtain methods. If the same item is both lootable and craftable at a building, it appears twice with different `obtain_method` values. Items ARE deduplicated within the same obtain method at the same building (e.g., if two monsters at the same building both drop "Iron Ore", it appears once as loot with either monster as source).

## Entity Relationship Diagram (Text)

```
buildings ──1:N──→ building_actions (explore) ──config──→ monsters ──1:N──→ monster_loot ──N:1──→ item_definitions
    │
    └──1:N──→ building_npcs ──N:1──→ npcs (is_crafter) ──1:N──→ crafting_recipes ──N:1──→ item_definitions
```
