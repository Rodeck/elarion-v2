# Skill Development System — Mastering the Arts of Combat

## Context

Elarion's combat system currently features 9 abilities (damage, heal, buff, debuff, dot, reflect, drain) that characters learn from monster/boss drops and equip into a 4-slot loadout. However, once acquired, abilities are static — a level 1 Drain Life is identical to one obtained at level 50. This design introduces **skill leveling through skill books**, creating a meaningful long-term progression loop where players invest time and resources to strengthen their combat abilities.

**Core fantasy**: A warrior studying ancient combat tomes by candlelight, each reading deepening their mastery. The knowledge doesn't always stick perfectly — sometimes a flash of insight grants major progress, other times just incremental understanding.

**Player loops created**:
- **Boss farming loop**: Kill bosses for skill book drops, use books to level abilities
- **Expedition investment**: Send squires on long expeditions for rare skill book drops
- **Strategic choice**: Which ability to level first? Active combat ability or passive auto-slot?
- **Cooldown management**: Plan skill book usage around 6-hour cooldowns per ability

---

## Tier/Category Design

Skill levels scale ability stats progressively. Each level requires 100 skill points to advance.

| Level | Points Required | Cumulative Points | Stat Multiplier | Avg Books to Level |
|-------|----------------|-------------------|-----------------|-------------------|
| 1 (base) | 0 | 0 | 1.00x | — |
| 2 | 100 | 100 | defined per ability | ~6 books |
| 3 | 100 | 200 | defined per ability | ~6 books |
| 4 | 100 | 300 | defined per ability | ~6 books |
| 5 (max) | 100 | 400 | defined per ability | ~6 books |

**Skill book point distribution** (per use):
| Points | Chance | Expected Value Contribution |
|--------|--------|-----------------------------|
| 10 | 60% | 6.0 |
| 20 | 30% | 6.0 |
| 30 | 9% | 2.7 |
| 50 | 1% | 0.5 |
| **Expected points per book** | | **15.2** |

Average books to gain one level: `100 / 15.2 = ~6.6 books`
Average time to gain one level at max pace (6h cooldown): `6.6 * 6h = ~39.5 hours = ~1.6 days`
Average time to fully max one ability (levels 2-5): `~6.6 days`

---

## Items to Create (9 total)

### Skill Books (category: skill_book)

A new item category `skill_book` is introduced. Each skill book is linked to a specific ability via a new `ability_id` column on `item_definitions`. Skill books are stackable (players can stockpile them).

| # | Name | stack_size | ability_id | Description |
|---|------|-----------|------------|-------------|
| 1 | Power Strike Skill Book | 50 | (Power Strike) | A weathered manual detailing the mechanics of devastating strikes. Each page is stained with old sweat. |
| 2 | Mend Skill Book | 50 | (Mend) | Bound in pale leather, this healer's treatise describes the flow of restorative energy through flesh and bone. |
| 3 | Iron Skin Skill Book | 50 | (Iron Skin) | Dense pages of metallurgical lore, teaching how to harden the body against blows through sheer focus. |
| 4 | Venom Edge Skill Book | 50 | (Venom Edge) | A dark tome reeking of chemicals, cataloguing blade-coating techniques using various toxic compounds. |
| 5 | Battle Cry Skill Book | 50 | (Battle Cry) | A battered field officer's journal, annotating the precise vocal techniques that rally warriors to ferocity. |
| 6 | Shatter Skill Book | 50 | (Shatter) | Cracked-spine volume on structural weaknesses in armor and bone, with hand-drawn anatomical diagrams. |
| 7 | Execute Skill Book | 50 | (Execute) | A grim executioner's guide, its margins filled with notes on striking when an opponent is at their weakest. |
| 8 | Reflect Skill Book | 50 | (Reflect) | Smooth-worn pages describe the art of redirecting kinetic force, turning an attacker's strength against them. |
| 9 | Drain Life Skill Book | 50 | (Drain Life) | Forbidden text on siphoning vitality from the wounded. The ink seems to pulse faintly in dim light. |

**Note**: When new abilities are added to the game in the future, corresponding skill books should be created. The admin UI will support creating skill books linked to any ability.

---

## Ability Level Scaling

Each ability has per-level stat definitions stored in a new `ability_levels` table. Level 1 stats are the current base ability stats. Higher levels improve the ability's key stats.

### Level Scaling Definitions

**Power Strike** (damage, base: effect_value=150, mana_cost=20):
| Level | effect_value | mana_cost | cooldown_turns | duration_turns |
|-------|-------------|-----------|---------------|---------------|
| 1 | 150 | 20 | 0 | 0 |
| 2 | 175 | 22 | 0 | 0 |
| 3 | 200 | 24 | 0 | 0 |
| 4 | 230 | 26 | 0 | 0 |
| 5 | 260 | 28 | 0 | 0 |

**Mend** (heal, base: effect_value=20, mana_cost=30):
| Level | effect_value | mana_cost | cooldown_turns | duration_turns |
|-------|-------------|-----------|---------------|---------------|
| 1 | 20 | 30 | 0 | 0 |
| 2 | 24 | 32 | 0 | 0 |
| 3 | 28 | 34 | 0 | 0 |
| 4 | 33 | 36 | 0 | 0 |
| 5 | 38 | 38 | 0 | 0 |

**Iron Skin** (buff, base: effect_value=30, mana_cost=25, duration=3):
| Level | effect_value | mana_cost | cooldown_turns | duration_turns |
|-------|-------------|-----------|---------------|---------------|
| 1 | 30 | 25 | 0 | 3 |
| 2 | 35 | 27 | 0 | 3 |
| 3 | 40 | 29 | 0 | 4 |
| 4 | 46 | 31 | 0 | 4 |
| 5 | 52 | 33 | 0 | 5 |

**Venom Edge** (dot, base: effect_value=5, mana_cost=15, duration=4):
| Level | effect_value | mana_cost | cooldown_turns | duration_turns |
|-------|-------------|-----------|---------------|---------------|
| 1 | 5 | 15 | 0 | 4 |
| 2 | 7 | 16 | 0 | 4 |
| 3 | 9 | 17 | 0 | 5 |
| 4 | 11 | 18 | 0 | 5 |
| 5 | 14 | 20 | 0 | 6 |

**Battle Cry** (buff, base: effect_value=25, mana_cost=40, duration=3):
| Level | effect_value | mana_cost | cooldown_turns | duration_turns |
|-------|-------------|-----------|---------------|---------------|
| 1 | 25 | 40 | 0 | 3 |
| 2 | 30 | 42 | 0 | 3 |
| 3 | 35 | 44 | 0 | 4 |
| 4 | 40 | 46 | 0 | 4 |
| 5 | 46 | 48 | 0 | 5 |

**Shatter** (debuff, base: effect_value=20, mana_cost=35, duration=2):
| Level | effect_value | mana_cost | cooldown_turns | duration_turns |
|-------|-------------|-----------|---------------|---------------|
| 1 | 20 | 35 | 0 | 2 |
| 2 | 24 | 37 | 0 | 2 |
| 3 | 28 | 39 | 0 | 3 |
| 4 | 33 | 41 | 0 | 3 |
| 5 | 38 | 43 | 0 | 4 |

**Execute** (damage, base: effect_value=300, mana_cost=50):
| Level | effect_value | mana_cost | cooldown_turns | duration_turns |
|-------|-------------|-----------|---------------|---------------|
| 1 | 300 | 50 | 0 | 0 |
| 2 | 340 | 52 | 0 | 0 |
| 3 | 385 | 54 | 0 | 0 |
| 4 | 435 | 56 | 0 | 0 |
| 5 | 500 | 58 | 0 | 0 |

**Reflect** (reflect, base: effect_value=40, mana_cost=30, duration=2):
| Level | effect_value | mana_cost | cooldown_turns | duration_turns |
|-------|-------------|-----------|---------------|---------------|
| 1 | 40 | 30 | 0 | 2 |
| 2 | 46 | 32 | 0 | 2 |
| 3 | 52 | 34 | 0 | 3 |
| 4 | 60 | 36 | 0 | 3 |
| 5 | 68 | 38 | 0 | 4 |

**Drain Life** (drain, base: effect_value=100, mana_cost=25):
| Level | effect_value | mana_cost | cooldown_turns | duration_turns |
|-------|-------------|-----------|---------------|---------------|
| 1 | 100 | 25 | 0 | 0 |
| 2 | 115 | 27 | 0 | 0 |
| 3 | 130 | 29 | 0 | 0 |
| 4 | 150 | 31 | 0 | 0 |
| 5 | 170 | 33 | 0 | 0 |

**Design rationale**: Mana costs increase slightly per level (2 per level) to maintain balance — higher-level abilities are stronger but slightly more expensive. Duration abilities gain extra turns at levels 3 and 5. Effect values scale roughly 15-20% per level, compounding to about 65-75% stronger at max level.

---

## Boss Loot Additions

Skill books drop from bosses as additional loot entries. Each boss drops 2-3 different skill books at low-moderate rates.

**Distribution logic**: Bosses drop skill books that thematically match their combat style. Drop chances are intentionally low (5-15%) to make skill books valuable.

| Boss | Skill Book Drops |
|------|-----------------|
| (All existing bosses) | Assign 2-3 skill books each, drop_chance 5-15%, quantity 1 |

Specific assignments will be determined during execution based on existing boss roster and their thematic fit. General guidelines:
- Aggressive/damage bosses: Power Strike, Execute, Battle Cry books
- Defensive/tanky bosses: Iron Skin, Reflect, Shatter books
- Magic/DoT bosses: Venom Edge, Drain Life, Mend books

---

## Expedition Reward Additions

Skill books appear as rare expedition drops. They are added to existing expedition building actions as additional reward items with low base_quantity.

| Expedition Location | Skill Book | base_quantity | Notes |
|--------------------|------------|--------------|-------|
| (Higher-tier expeditions) | Random skill books | 1 | Added to expedition config items array |

Specific expedition assignments will be determined during execution based on existing expedition locations. Only higher-tier/longer expeditions should include skill books (3h and 6h expeditions, not 1h).

---

## Economy Flow

```
[BOSS KILL] ──► Skill Book (5-15% drop)  ──► [INVENTORY]
[EXPEDITION] ──► Skill Book (rare)        ──► [INVENTORY]
                                                   │
                                          [USE FROM INVENTORY]
                                                   │
                                          Roll: 60%→10pts, 30%→20pts, 9%→30pts, 1%→50pts
                                                   │
                                          [ABILITY PROGRESS]
                                           100 pts = Level Up
                                                   │
                                          [STRONGER ABILITY IN COMBAT]
                                                   │
                                          6h COOLDOWN per ability ◄── prevents rushing
```

**Time investment to max one ability**: ~6.6 days at optimal pace (using book every 6h)
**Time to max all 9 abilities**: ~59 days (~2 months) at optimal pace — a substantial long-term goal
**Skill book value**: High — low drop rates from bosses, rare from expeditions. Players will need to farm bosses regularly.

---

## Code Changes Required

### Summary
| Change | Scope | Description |
|--------|-------|-------------|
| DB migration 035 | backend | New tables: `ability_levels`, `character_ability_progress`; ALTER `item_definitions` add `ability_id` column; new category `skill_book` |
| Shared protocol types | shared | New DTOs for skill progress, skill book usage, ability level data |
| Skill book handler | backend | New WS handler for `skill-book.use` message — validates, rolls points, updates progress |
| Ability level integration | backend | Combat engine reads ability level for character, uses level-scaled stats |
| Admin ability levels | admin backend + frontend | CRUD for ability level definitions; modal-based editing UI replacing left panel form |
| Frontend loadout UI | frontend | Show skill level, progress bar, cooldown timer on abilities; skill detail modal |
| Frontend inventory | frontend | "Use" button on skill book items in inventory detail panel |
| game-entities updates | scripts | New `create-skill-book` and `set-ability-levels` entity types |

### Detailed Requirements

1. **DB Migration `035_skill_development.sql`**:
   - Add `ability_id INTEGER REFERENCES abilities(id)` to `item_definitions` (nullable, only set for skill books)
   - Extend `item_definitions.category` CHECK to include `'skill_book'`
   - Create `ability_levels` table:
     ```
     ability_id INT NOT NULL REFERENCES abilities(id) ON DELETE CASCADE
     level SMALLINT NOT NULL CHECK (level BETWEEN 1 AND 5)
     effect_value INTEGER NOT NULL DEFAULT 0
     mana_cost SMALLINT NOT NULL DEFAULT 0
     duration_turns SMALLINT NOT NULL DEFAULT 0
     cooldown_turns SMALLINT NOT NULL DEFAULT 0
     PRIMARY KEY (ability_id, level)
     ```
   - Create `character_ability_progress` table:
     ```
     character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE
     ability_id INT NOT NULL REFERENCES abilities(id) ON DELETE CASCADE
     current_level SMALLINT NOT NULL DEFAULT 1 CHECK (current_level BETWEEN 1 AND 5)
     current_points SMALLINT NOT NULL DEFAULT 0 CHECK (current_points BETWEEN 0 AND 99)
     last_book_used_at TIMESTAMPTZ (nullable — null means never used / can use now)
     PRIMARY KEY (character_id, ability_id)
     ```
   - Insert level 1 rows into `ability_levels` for all existing abilities (using their current base stats)

2. **Shared Protocol Types** (`shared/protocol/index.ts`):
   - `AbilityProgressDto`: `{ ability_id, current_level, current_points, last_book_used_at: string | null, next_level_stats: { effect_value, mana_cost, duration_turns, cooldown_turns } | null }`
   - `SkillBookUsePayload` (C->S): `{ slot_id: number }` — inventory slot of the skill book
   - `SkillBookResultPayload` (S->C): `{ ability_id, ability_name, points_gained, new_points, new_level, leveled_up: boolean, cooldown_until: string }`
   - `SkillBookErrorPayload` (S->C): `{ message: string }`
   - `AbilityProgressStatePayload` (S->C): `{ progress: AbilityProgressDto[] }` — sent on login and after changes
   - Extend `OwnedAbilityDto` to include `level: number, points: number, points_to_next: number | null, cooldown_until: string | null, next_level_stats: {...} | null`
   - Add `'skill_book'` to `ItemCategory` union
   - Extend `ItemDefinitionDto` with `ability_id: number | null`
   - `AbilityLevelDto`: `{ level, effect_value, mana_cost, duration_turns, cooldown_turns }`
   - Extend `OwnedAbilityDto` with level info and `all_levels: AbilityLevelDto[]`

3. **Skill Book Usage Handler** (`backend/src/game/skill/skill-book-handler.ts`):
   - Register `skill-book.use` WS message
   - Flow:
     1. Validate character exists, not in combat
     2. Get inventory slot, validate it exists and category is `skill_book`
     3. Get the `ability_id` from `item_definitions`
     4. Check character owns the ability (`character_owned_abilities`)
     5. Check `character_ability_progress.last_book_used_at` — if within 6 hours, reject with time remaining
     6. Check ability not already at max level (5)
     7. Consume 1 item from inventory (decrement or delete)
     8. Roll points: `rand < 0.60 → 10, < 0.90 → 20, < 0.99 → 30, else → 50`
     9. Add points to `current_points`. If >= 100: `current_level += 1`, `current_points -= 100`
     10. Update `last_book_used_at = now()`
     11. Upsert `character_ability_progress` row (INSERT ON CONFLICT UPDATE)
     12. Send `skill-book.result` with outcome
     13. Send updated `inventory.state` and `ability-progress.state`

4. **Combat Engine Level Integration** (`backend/src/game/combat/combat-engine.ts`):
   - When building combat ability snapshots, look up `character_ability_progress` for each equipped ability
   - Query `ability_levels` for the character's current level of each ability
   - Use level-scaled stats (effect_value, mana_cost, duration_turns, cooldown_turns) instead of base ability stats
   - If no progress row exists, use level 1 (current base stats — backward compatible)
   - Same applies to boss combat handler

5. **Admin Ability Management Overhaul** (`admin/frontend/src/ui/ability-manager.ts`, `admin/backend/src/routes/abilities.ts`):
   - **Remove left-side form panel** — replace with ability card grid as full-width
   - **Add/Edit via modal**: Clicking "Add" or "Edit" opens a centered modal overlay with all ability fields
   - **Level stats tab in modal**: After creating/saving base ability, modal shows a "Level Stats" tab/section
     - Table with 5 rows (levels 1-5), columns: effect_value, mana_cost, duration_turns, cooldown_turns
     - Level 1 pre-filled from base ability stats
     - Save button persists all level rows to `ability_levels` via new admin API endpoint
   - **Admin API additions**:
     - `GET /api/abilities/:id/levels` — returns all level rows
     - `PUT /api/abilities/:id/levels` — bulk upsert all 5 level rows
     - `POST /api/abilities` and `PUT /api/abilities/:id` — unchanged, still manage base ability
   - **game-entities script** additions:
     - `create-skill-book` entity type: creates item with category `skill_book` and `ability_id` set
     - `set-ability-levels` entity type: sets all 5 level stat rows for an ability

6. **Frontend Loadout UI Changes** (`frontend/src/ui/LoadoutPanel.ts`):
   - **Ability slots**: Show skill level badge (e.g., "Lv.3") on each occupied slot
   - **Owned ability list rows**: Show level + mini progress bar (100px wide, gold fill)
   - **Cooldown indicator**: If `cooldown_until > now`, show remaining time (e.g., "4h 23m") in red text
   - **Click handler on owned abilities**: Opens a **Skill Detail Modal**

7. **Skill Detail Modal** (new: `frontend/src/ui/SkillDetailModal.ts`):
   - Overlay modal matching existing modal patterns (dark bg, gold border)
   - Content:
     - Ability icon + name + effect type chip
     - Current level display (e.g., "Level 3 / 5")
     - Progress bar to next level (current_points / 100)
     - Current stats table (effect_value, mana_cost, duration, cooldown)
     - Next level stats table (grayed/highlighted showing the improvement)
     - Cooldown timer: "Can use skill book in: 4h 23m" or "Ready"
     - Close button
   - At max level (5): Progress bar full, "MASTERED" badge, no next level stats

8. **Frontend Inventory Skill Book Usage** (`frontend/src/ui/InventoryPanel.ts`):
   - When a `skill_book` category item is selected in detail panel, show a "Use" button
   - Clicking "Use" sends `skill-book.use` message with `{ slot_id }`
   - Handle `skill-book.result`: Show toast/notification with points gained and level-up if applicable
   - Handle `skill-book.error`: Show error message (e.g., "You haven't learned this ability", "Cooldown: 4h 23m remaining", "Already at max level", "Inventory error")

### Implementation Sequence

1. `/speckit.specify` — Create technical spec from Code Changes Required section
2. `speckit.plan` -> `speckit.tasks` -> `speckit.implement` — Build the code:
   - Phase A: Migration + shared types + backend handler + combat integration
   - Phase B: Admin ability manager overhaul (modal UI + level stats CRUD)
   - Phase C: Frontend loadout changes + skill detail modal + inventory use button
3. `/gd.execute` — Create skill book items and ability level definitions via admin API

---

## Execution Plan

All content is created via the `game-entities` skill (admin REST API). Order matters for FK constraints. **Code changes must be implemented first** — the `skill_book` category, `ability_id` column, and `ability_levels` table must exist before execution.

### Phase 1 — Skill Books and Level Definitions (after code is deployed)

1. **Create 9 skill book items** — One per existing ability, category `skill_book`, stack_size 50, linked via ability_id
2. **Set ability level definitions for all 9 abilities** — 5 levels each (45 rows total) using the scaling tables above
3. **Add skill book drops to existing bosses** — 2-3 books per boss, drop_chance 5-15%, quantity 1
4. **Add skill book drops to high-tier expeditions** — 1-2 books per expedition, base_quantity 1

### Phase 2 — Future Abilities (deferred)

When new abilities are added to the game:
- Create corresponding skill book item
- Define 5-level stat scaling
- Add to boss/expedition loot tables
- No code changes needed — the system is generic

---

## Testing Walkthrough

### Test 1: Basic Skill Book Usage
1. **Admin creates skill book items and level definitions** — Verify items appear in admin panel with correct ability_id links
2. **Grant a skill book to player** (admin command or boss drop) — Verify it appears in inventory as `skill_book` category
3. **Player does NOT own the ability** — Click "Use" on skill book in inventory — **Expected: Error "You haven't learned Drain Life yet"**
4. **Grant the ability to player** — Verify it appears in loadout as Level 1
5. **Use the skill book from inventory** — **Expected: Toast showing "Gained X points toward Drain Life"**
6. **Check loadout** — Progress bar shows points gained, level still 1 if < 100 points
7. **Try using same ability's skill book again immediately** — **Expected: Error "Cooldown: 5h 59m remaining"**

### Test 2: Level Up
1. **Grant enough skill books to accumulate 100+ points** (use admin to bypass cooldown or wait)
2. **Use skill book that pushes points over 100** — **Expected: Level up notification, level becomes 2, excess points carry over**
3. **Check loadout** — Level badge shows "Lv.2", progress bar shows new points
4. **Enter combat** — **Expected: Ability uses level 2 stats (higher effect_value, slightly higher mana_cost)**

### Test 3: Max Level
1. **Set ability to level 5 via direct DB** for testing
2. **Try using skill book** — **Expected: Error "Drain Life is already at maximum level"**
3. **Check skill detail modal** — Shows "MASTERED", full progress bar, no next level stats

### Test 4: Loadout Display
1. **Have multiple abilities at different levels** — Verify each shows correct level badge
2. **One ability on cooldown, one ready** — Verify cooldown timer shows on the one, "Ready" on the other
3. **Click ability in owned list** — Verify skill detail modal opens with correct stats

### Test 5: Combat Integration
1. **Level up Power Strike to level 3** (effect_value = 200)
2. **Enter combat with Power Strike equipped** — **Expected: Damage calculation uses 200% attack, not 150%**
3. **Verify mana cost is 24** (level 3) not 20 (level 1)

### Test 6: Admin Ability Management
1. **Open admin ability manager** — Verify left panel form is gone, abilities show as full-width card grid
2. **Click "Add"** — Verify modal opens with all fields
3. **Create ability, save** — Verify card appears in grid
4. **Click "Edit" on ability card** — Verify modal opens with pre-filled values and "Level Stats" section
5. **Edit level 2-5 stats** — Save — Verify stats persist (re-open modal to confirm)
6. **Delete ability** — Verify card removed and cascades work

---

## Verification Checklist
- [ ] 9 skill book items created with correct ability_id links
- [ ] All 9 abilities have 5-level stat definitions
- [ ] Skill books usable from inventory with correct point rolling
- [ ] 6-hour cooldown enforced per ability (not globally)
- [ ] Combat engine uses level-scaled stats
- [ ] Loadout panel shows level, progress bar, cooldown timer
- [ ] Skill detail modal shows current/next level stats
- [ ] Error messages for: no ability, on cooldown, max level, not enough books
- [ ] Boss loot tables include skill books
- [ ] Expedition rewards include skill books (high-tier only)
- [ ] Admin ability manager uses modal-based editing
- [ ] Admin ability manager supports per-level stat definitions
- [ ] No duplicate skill book items for same ability
- [ ] Existing characters with abilities default to level 1 (backward compatible)
