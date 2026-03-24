# Data Model: Quest System

**Feature**: 021-quest-system | **Date**: 2026-03-24

## Entity Relationship Diagram

```text
quest_definitions 1──* quest_objectives
quest_definitions 1──* quest_prerequisites
quest_definitions 1──* quest_rewards
quest_definitions *──* npcs  (via quest_npc_givers)

characters 1──* character_quests
quest_definitions 1──* character_quests
character_quests 1──* character_quest_objectives
quest_objectives 1──* character_quest_objectives
```

## Tables

### quest_definitions

Quest templates created by admins. Central entity for the quest system.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Auto-incrementing ID |
| name | TEXT | NOT NULL, UNIQUE | Display name |
| description | TEXT | NOT NULL | Player-facing description |
| quest_type | TEXT | NOT NULL, CHECK IN ('main','side','daily','weekly','monthly','repeatable') | Determines reset behavior |
| sort_order | INTEGER | NOT NULL DEFAULT 0 | Admin ordering |
| is_active | BOOLEAN | NOT NULL DEFAULT true | Soft toggle for availability |
| chain_id | TEXT | NULLABLE | Groups related chain quests (e.g., 'blacksmith_apprentice') |
| chain_step | INTEGER | NULLABLE | Ordering within a chain |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | Creation timestamp |

**Indexes**: `quest_type`, `chain_id WHERE NOT NULL`

---

### quest_objectives

Individual tasks within a quest that the player must complete.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Auto-incrementing ID |
| quest_id | INTEGER | NOT NULL, FK → quest_definitions(id) ON DELETE CASCADE | Parent quest |
| objective_type | TEXT | NOT NULL, CHECK IN ('kill_monster','collect_item','craft_item','spend_crowns','gather_resource','reach_level','visit_location','talk_to_npc') | Determines tracking behavior |
| target_id | INTEGER | NULLABLE | References monster/item/npc/zone/building depending on type |
| target_quantity | INTEGER | NOT NULL DEFAULT 1, CHECK > 0 | How many/how much |
| target_duration | INTEGER | NULLABLE | Seconds (gather_resource only) |
| description | TEXT | NULLABLE | Optional human-readable override |
| sort_order | INTEGER | NOT NULL DEFAULT 0 | Display ordering |

**Indexes**: `quest_id`

**target_id reference by type**:
- `kill_monster` → `monsters.id`
- `collect_item` → `item_definitions.id`
- `craft_item` → `item_definitions.id`
- `spend_crowns` → NULL (amount in target_quantity)
- `gather_resource` → `buildings.id`
- `reach_level` → NULL (level in target_quantity)
- `visit_location` → `map_zones.id`
- `talk_to_npc` → `npcs.id`

---

### quest_prerequisites

Conditions that must ALL be met (AND logic) for a player to accept a quest.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Auto-incrementing ID |
| quest_id | INTEGER | NOT NULL, FK → quest_definitions(id) ON DELETE CASCADE | Parent quest |
| prereq_type | TEXT | NOT NULL, CHECK IN ('min_level','has_item','completed_quest','class_required') | Type of condition |
| target_id | INTEGER | NULLABLE | item_def_id / quest_def_id / class_id depending on type |
| target_value | INTEGER | NOT NULL DEFAULT 1 | Level number or item quantity |

**Indexes**: `quest_id`

**target_id reference by type**:
- `min_level` → NULL (level in target_value)
- `has_item` → `item_definitions.id` (quantity in target_value)
- `completed_quest` → `quest_definitions.id` (enables chain quests)
- `class_required` → `character_classes.id`

---

### quest_rewards

Granted to the player upon quest completion.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Auto-incrementing ID |
| quest_id | INTEGER | NOT NULL, FK → quest_definitions(id) ON DELETE CASCADE | Parent quest |
| reward_type | TEXT | NOT NULL, CHECK IN ('item','xp','crowns') | What to grant |
| target_id | INTEGER | NULLABLE | item_definitions.id for item rewards |
| quantity | INTEGER | NOT NULL DEFAULT 1, CHECK > 0 | How many |

**Indexes**: `quest_id`

---

### quest_npc_givers

Many-to-many: which NPCs offer which quests.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Auto-incrementing ID |
| quest_id | INTEGER | NOT NULL, FK → quest_definitions(id) ON DELETE CASCADE | Quest being offered |
| npc_id | INTEGER | NOT NULL, FK → npcs(id) ON DELETE CASCADE | NPC offering it |

**Constraints**: UNIQUE(quest_id, npc_id)
**Indexes**: `npc_id`

---

### character_quests

Per-player quest tracking. One row per quest acceptance.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Auto-incrementing ID |
| character_id | UUID | NOT NULL, FK → characters(id) ON DELETE CASCADE | Player |
| quest_id | INTEGER | NOT NULL, FK → quest_definitions(id) | Quest template |
| status | TEXT | NOT NULL DEFAULT 'active', CHECK IN ('active','completed','failed','abandoned') | Current state |
| accepted_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | When accepted |
| completed_at | TIMESTAMPTZ | NULLABLE | When completed |
| reset_period_key | TEXT | NULLABLE | Period identifier for repeating quests |

**Constraints**: UNIQUE(character_id, quest_id, reset_period_key)
**Indexes**: `(character_id, status)`, `quest_id`

**reset_period_key values**:
- Daily: `'2026-03-24'` (ISO date)
- Weekly: `'2026-W13'` (ISO week)
- Monthly: `'2026-03'` (year-month)
- Main/Side: `NULL` (UNIQUE allows only one)
- Repeatable: ISO timestamp string (always unique)

---

### character_quest_objectives

Per-player progress on individual quest objectives.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | SERIAL | PRIMARY KEY | Auto-incrementing ID |
| character_quest_id | INTEGER | NOT NULL, FK → character_quests(id) ON DELETE CASCADE | Parent tracking row |
| objective_id | INTEGER | NOT NULL, FK → quest_objectives(id) | Objective template |
| current_progress | INTEGER | NOT NULL DEFAULT 0 | Current count |
| is_complete | BOOLEAN | NOT NULL DEFAULT false | Whether target met |

**Constraints**: UNIQUE(character_quest_id, objective_id)
**Indexes**: `character_quest_id`

---

### ALTER: npcs table

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| is_quest_giver | BOOLEAN | NOT NULL DEFAULT false | Flag for quest dialogue option |

## State Transitions

### character_quests.status

```text
          accept
(none) ────────→ active
                   │
         ┌─────────┼──────────┐
         │         │          │
    abandon    complete     fail
         │         │          │
         ▼         ▼          ▼
    abandoned  completed    failed
```

- `active → completed`: All objectives met, player turns in at NPC, rewards granted
- `active → abandoned`: Player voluntarily drops the quest
- `active → failed`: Reserved for future use (e.g., timed quests)
- Terminal states (completed/abandoned/failed) are immutable

## Validation Rules

- Quest name must be unique across all quest_definitions
- Each quest must have at least one objective
- target_quantity must be > 0
- reward quantity must be > 0
- A player cannot accept the same quest twice in the same reset period (UNIQUE constraint)
- A player cannot accept more than 25 active quests (runtime check)
- Prerequisites are checked server-side before quest acceptance
- All objectives must be complete AND inventory must have space before quest turn-in
