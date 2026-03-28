---
description: Review a game design document for balance, consistency, and completeness against existing game data.
handoffs:
  - label: Execute Design (entities only)
    agent: gd.execute
    prompt: Execute this design by creating entities via admin API
    send: true
  - label: Implement Code Changes First
    agent: speckit.specify
    prompt: "Implement the code changes required by this game design. Read game_design/<name>/design.md — the 'Code Changes Required' section describes what needs to be built. After code is implemented, run /gd.execute to create entities."
    send: true
  - label: Revise Design
    agent: gd.design
    prompt: Revise the design based on review feedback
    send: true
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Outline

Balance-review a game design against live game data. This is the quality gate before execution.

### Workflow

1. **Locate the design**:
   - If `$ARGUMENTS` is a design name: look for `game_design/<name>/design.md`
   - If empty: list `game_design/*/design.md` and ask the user which to review
   - Read `design.md` thoroughly

2. **Query fresh game data** (data may have changed since research phase):
   ```bash
   node scripts/game-data.js overview
   node scripts/game-data.js monsters
   node scripts/game-data.js items
   node scripts/game-data.js economy
   node scripts/game-data.js recipes
   ```
   Plus any system-specific queries based on design content (gathering, quests, abilities, zones).

3. **Run balance checks** and write `game_design/<name>/review.md`:

```markdown
# [Design Name] — Balance Review

## Summary Verdict

| Category | Status | Notes |
|----------|--------|-------|
| Stat Curve Fit | PASS/WARN/FAIL | [brief note] |
| Economy Flow | PASS/WARN/FAIL | [brief note] |
| Loot Tables | PASS/WARN/FAIL | [brief note] |
| Crafting Costs | PASS/WARN/FAIL | [brief note] |
| Time-to-Reward | PASS/WARN/FAIL | [brief note] |
| Power Progression | PASS/WARN/FAIL | [brief note] |
| Completeness | PASS/WARN/FAIL | [brief note] |
| Naming Conflicts | PASS/WARN/FAIL | [brief note] |

**Overall Verdict**: Ready to execute / Needs revision

---

## Stat Curve Fit
[Do new monster/item stats fit existing ranges?]

### Monsters — New vs Existing
| Monster | ATK | DEF | HP | XP | Crowns | Comparable To |
|---------|-----|-----|-----|-----|--------|---------------|
| [new monster] | [stat] | [stat] | [stat] | [stat] | [range] | [existing monster with similar stats] |

[Flag any outliers — too strong, too weak, or stat ratios that don't match the curve]

### Items — New vs Existing
[Compare new weapon ATK, armor DEF, tool durability/power against existing items in same tier]

---

## Economy Flow Analysis
[Calculate the net crown impact of this design]

### Crown Sources Added
| Source | Rate | Expected crowns/hour |
|--------|------|---------------------|
| [monster drops] | [calculation] | [amount] |
| [gathering gold] | [calculation] | [amount] |

### Crown Sinks Added
| Sink | Cost | Expected drain/hour |
|------|------|---------------------|
| [recipe costs] | [per craft] | [amount] |

**Net Impact**: [+/- crowns/hour, compared to current economy]

---

## Loot Table Sanity
[Check drop rates are reasonable]
- Total expected value per kill for each monster
- Compare with existing monsters at similar tier
- Flag if any single drop is too generous or too stingy

---

## Crafting Cost Analysis
[Is the material chain realistic?]

| End Product | Materials Needed | Gather Sessions | Total Time | Total Crowns |
|-------------|-----------------|----------------|------------|--------------|
| [item] | [breakdown] | [estimate] | [estimate] | [estimate] |

[Flag if time-to-craft is too short (trivializes progression) or too long (player burnout)]

---

## Completeness Check
- [ ] All items referenced in recipes/loot exist in Items section
- [ ] All NPCs referenced in recipes/assignments exist in NPCs section
- [ ] All monsters referenced in loot/encounters exist in Monsters section
- [ ] All buildings referenced in actions/assignments exist in game
- [ ] Execution plan covers all entities in correct dependency order
- [ ] No orphaned entities (created but never used anywhere)

---

## Naming Conflict Check
[Results of `game-data search <name>` for each new entity]

| Entity | Name | Conflict? | Resolution |
|--------|------|-----------|------------|
| [type] | [name] | [yes/no] | [rename suggestion if yes] |

---

## Issues Found

### Critical (must fix before execution)
1. [Issue description + recommended fix]

### Warnings (should fix, not blocking)
1. [Issue description + recommended fix]

### Suggestions (nice-to-have improvements)
1. [Suggestion]

---

## Code Changes Assessment

| Needs Code Changes? | Scope |
|---------------------|-------|
| [Yes / No] | [Brief description or "Entities only — no code changes needed"] |

[If Yes:]
- **What**: [Summarize the code changes from the design's "Code Changes Required" section]
- **Validated**: [Are the described code changes complete and realistic? Any missing pieces?]
- **Next step**: Run `/speckit.specify` before `/gd.execute`

[If No:]
- **Next step**: Proceed directly to `/gd.execute`

---

## Recommendations
[Summary of what needs to change before execution, or confirmation that the design is ready]
```

4. **Report**: Summarize the verdict and key findings. Route the user to the correct next step:
   - If "Code Changes Required" is "None — entities only" AND verdict is "Ready to execute": suggest `/gd.execute`
   - If code changes are needed AND verdict is "Ready to execute": suggest `/speckit.specify` to implement code first, THEN `/gd.execute`
   - If verdict is "Needs revision": suggest `/gd.design` to revise

## Balance Check Details

### Stat Curve Fit
- New monster ATK/DEF/HP should be within ±20% of existing monsters at the same tier
- XP reward should scale proportionally with difficulty (HP × ATK is a rough proxy)
- Crown drops should match the zone's intended economy tier

### Economy Flow
- New crown sources should not increase total supply by more than 15-20%
- New crown sinks should exist for every significant crown source added
- Material chains should have clear sinks — no stockpiling dead-end items

### Loot Tables
- Common drops (30-50%): items the player needs regularly
- Uncommon drops (10-25%): items that feel rewarding but not rare
- Rare drops (3-10%): exciting drops that drive repeated engagement
- Total drop value per kill should be proportional to monster difficulty

### Time-to-Reward
- A single gather→craft cycle should take 2-5 minutes for basic items
- End-tier items should require 3-5 sessions (15-30 minutes total investment)
- No single craft should take more than 2 minutes of real-time waiting

### Naming Conflicts
- Search for each new entity name against existing game data
- Flag exact matches and close matches (e.g., "Iron Bar" vs "Iron Ingot")
