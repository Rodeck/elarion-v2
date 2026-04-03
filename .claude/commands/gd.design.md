---
description: Write a complete game design document with all entity definitions, stats, recipes, and execution plan.
handoffs:
  - label: Balance Review
    agent: gd.review
    prompt: Review this design for balance issues against existing game data
    send: true
  - label: Implement Code Changes
    agent: speckit.specify
    prompt: "Implement the code changes required by this game design. Read game_design/<name>/design.md — the 'Code Changes Required' section describes what needs to be built."
    send: true
  - label: Generate Art Prompts
    agent: gd.prompts
    prompt: Generate AI art prompts for items and monsters in this design
    send: true
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Outline

Write the full structured design document with all entity definitions ready for execution via the admin API.

### Workflow

1. **Locate the design**:
   - If `$ARGUMENTS` is a design name: look for `game_design/<name>/`
   - If empty: list `game_design/*/` and ask the user which design to write
   - Read `concept.md` and `research.md` if they exist
   - If no concept.md exists, the user is writing the design from scratch — that's fine, proceed with `$ARGUMENTS` as the design brief

2. **Write `game_design/<name>/design.md`** following the template below.

3. **Every entity definition must use exact field names matching the `game-entities` skill JSON schemas.** This ensures the execution phase can translate tables directly into API calls.

4. **Every stat must be justified** — either fits within research baselines or has an explicit reason for being outside the range.

5. **The execution plan must be dependency-ordered** — items before loot/recipes, NPCs before assignments, monsters before encounters.

### Design Document Template

```markdown
# [Design Name] — [Subtitle]

## Context
[What this content adds to the game. Why it matters. What player roles/loops it creates.
Reference the core fantasy from concept.md. This section should make someone excited about the design.]

---

## Tier/Category Design
[How content is organized. Use a table showing progression tiers, categories, or groupings.
Explain the logic behind the organization.]

| Tier | Theme | Items | Monsters | Access |
|------|-------|-------|----------|--------|
| T1 | [name] | [list] | [list] | [how unlocked] |
| T2 | [name] | [list] | [list] | [how unlocked] |

---

## Items to Create (N total)

### [Category Name] (category: resource)
| # | Name | stack_size | Description |
|---|------|-----------|-------------|
| 1 | [name] | [int] | [description] |

### [Category Name] (category: weapon)
| # | Name | weapon_subtype | attack | Description |
|---|------|---------------|--------|-------------|
| N | [name] | [subtype] | [int] | [description] |

### [Category Name] (category: tool)
| # | Name | tool_type | max_durability | power | Description |
|---|------|-----------|---------------|-------|-------------|
| N | [name] | [type] | [int] | [int] | [description] |

### Skill Books (category: skill_book)
| # | Name | stack_size | ability_id | Description |
|---|------|-----------|------------|-------------|
| N | [name] | [int] | [ability id] | [description] |

[Use the appropriate columns for each item category. See game-entities skill for field reference.]

---

## NPCs to Create (N)

| NPC | Description | is_crafter | is_disassembler | is_trainer | Building Assignment |
|-----|-------------|------------|-----------------|------------|---------------------|
| [name] | [personality + role, 1-2 sentences] | [true/false] | [true/false] | [true/false] | [building name (id)] |

---

## Abilities to Create (N) [include only if design has abilities]

| Name | effect_type | mana_cost | effect_value | duration_turns | cooldown_turns | slot_type | Description |
|------|------------|-----------|-------------|---------------|---------------|-----------|-------------|
| [name] | [type] | [int] | [int] | [int] | [int] | [auto/active/both] | [description] |

### Ability Level Scaling [include only if abilities have skill books]

| Ability | Lv1 effect / mana / dur / cd | Lv2 | Lv3 | Lv4 | Lv5 |
|---------|------------------------------|-----|-----|-----|-----|
| [name] | [val]/[mana]/[dur]/[cd] | ... | ... | ... | ... |

---

## Monsters

### [Phase/Tier/Zone grouping]

| Monster | ATK | DEF | HP | XP | Crowns | Purpose |
|---------|-----|-----|-----|-----|--------|---------|
| [name] | [int] | [int] | [int] | [int] | [min–max] | [role in the game] |

**[Monster Name] Loot**: [item (drop%, qty), item (drop%, qty), ...]

[List loot for each monster directly below its table entry.]

---

## Crafting Recipes (N total)

### At [NPC Name]
| Recipe | Ingredients | Output | Crowns | Time |
|--------|-------------|--------|--------|------|
| [name] | [Nx Item, Nx Item] | [Nx Output Item] | [int] | [Ns] |

[Group recipes by the NPC that offers them.]

---

## Gathering Locations [include only if design has gathering]

### [Location Name] — [Building Name] (building [id])
- Tool: [pickaxe/axe], durability/sec: [int], duration: [min]–[max]s
- Events (weights sum to 100):
  - [Item Name] x[qty] ([weight]), [Item Name] x[qty] ([weight])
  - Gold [min]–[max] crowns ([weight]), Nothing ([weight]), Accident [N]hp ([weight])
  - [Monster Name] encounter ([weight])

---

## Quests [include only if design has quests]

### [Quest Name]
- **Type**: [main/side/daily/weekly/monthly/repeatable]
- **Chain**: [chain_id, step N] or [standalone]
- **Description**: [quest description text]
- **Objectives**:
  1. [objective_type]: [target] x[quantity] — [human description]
- **Prerequisites**: [list or "None"]
- **Rewards**: [xp, crowns, items, squires — with quantities]
- **NPC Givers**: [NPC names]

---

## Economy Flow

[ASCII diagram showing how materials/crowns flow through the system]

```
[SOURCE] ──► [PROCESS] ──► [OUTPUT] ──► [CONSUMPTION]
```

**Cost analysis for [key end-product]**: [full breakdown — materials needed, crown cost, craft time, gather sessions required]

---

## Code Changes Required

[List any code changes needed to support this design. If the design only adds entities (items, monsters, NPCs, recipes, etc.) via the admin API and no new game mechanics or systems are needed, write "None — entities only" and skip to Execution Plan.]

[If code changes ARE needed, describe each one:]

### Summary
| Change | Scope | Description |
|--------|-------|-------------|
| [DB migration] | backend | [what tables/columns to add or alter] |
| [WebSocket messages] | shared/backend/frontend | [new message types needed] |
| [Backend handler] | backend | [new game logic or handlers] |
| [Frontend UI] | frontend | [new screens, panels, or UI components] |
| [Admin support] | admin | [new admin routes or UI for managing the feature] |

### Detailed Requirements
[For each code change, describe:]
1. **[Change name]**: [What it does, why it's needed, how it connects to the game design. Include enough detail for a technical spec — expected behavior, edge cases, integration points with existing systems.]

### Implementation Sequence
[Code changes must be implemented BEFORE entity execution. The order is:]
1. `/speckit.specify` — Create technical spec from this section
2. `speckit.plan` → `speckit.tasks` → `speckit.implement` — Build the code
3. `/gd.execute` — Create entities via admin API (requires the code to be in place)

---

## Execution Plan

All content is created via the `game-entities` skill (admin REST API). Order matters for FK constraints.

### Phase 1 — [scope description]
1. **Create all N items** — [brief note]
2. **Create N NPCs** — [note about crafter flags]
3. **Create N monsters** — [note about which phase]
4. **Add monster loot entries** — [requires item IDs + monster IDs]
5. **Create N abilities** — [if any]
6. **Create N crafting recipes** — [requires item IDs + NPC IDs]
7. **Create N gathering actions** — [requires item IDs, monster IDs, building IDs]
8. **Assign NPCs to buildings** — [requires NPC IDs + building IDs]
9. **Set encounters** — [if any night encounters]
10. **Create N quests** — [if any, requires all entity IDs]

### Phase 2 — [future content, optional]
[Deferred content with explanation of why it's deferred]

---

## Testing Walkthrough

### Test 1: [Scenario Name]
[Step-by-step player actions with expected outcomes. Written as if guiding a QA tester.]
1. **[Action]** — [expected result]
2. **[Action]** — [expected result]

### Test N: [Scenario Name]
[Additional test scenarios covering different player paths]

---

## Verification Checklist
- [ ] [Entity type] created and visible in game
- [ ] [Mechanic] works as designed
- [ ] [Economy flow] is balanced
- [ ] [No duplicates] with existing content
```

6. **Report**: Print the design file path and suggest next steps based on the design:
   - If "Code Changes Required" is "None — entities only": suggest `/gd.review` → `/gd.execute`
   - If code changes are needed: suggest `/gd.review` → `/speckit.specify` → (implement) → `/gd.execute`
   - Always mention `/gd.prompts` for art assets

## Guidelines

- **Completeness**: Every entity referenced in recipes/loot/actions must be defined in the Items/Monsters/NPCs sections
- **Consistency**: Use the same names everywhere — if the item is "Iron Ore" in the items table, don't call it "Raw Iron" in a recipe
- **Balance justification**: If a stat is outside the research baseline range, add a note explaining why
- **Phased execution**: Put ambitious/risky content in Phase 2 — ship the core loop in Phase 1
- **Elarion tone**: Descriptions should be grounded medieval fantasy — dark, tactile, no generic fantasy cliches
- **Code change honesty**: Be explicit about whether a design needs code changes. Adding new entities to existing systems (items, monsters, recipes) typically needs no code. Adding new mechanics, new action types, new UI screens, or new DB tables DOES need code. Reference CLAUDE.md checklists (e.g., "Adding a New Building Action Type") when relevant.
