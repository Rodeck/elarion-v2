---
description: Research existing game data to inform a game design. Queries items, monsters, economy, zones to establish balance baselines.
handoffs:
  - label: Write Full Design
    agent: gd.design
    prompt: Write the full design document based on research findings
    send: true
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Outline

Research the current game state to ground a design in real data. This skill bridges the concept phase and the full design phase by establishing balance baselines and identifying constraints.

### Workflow

1. **Locate the design**:
   - If `$ARGUMENTS` is a design name: look for `game_design/<name>/concept.md`
   - If empty: list `game_design/*/concept.md` and ask the user which design to research
   - Read `concept.md` to understand which systems are involved

2. **Run targeted `game-data` queries** based on "Game Systems Touched" in concept.md:

   Always run:
   ```bash
   node scripts/game-data.js overview
   ```

   Then based on systems involved:
   | System | Queries |
   |--------|---------|
   | Items/Economy | `node scripts/game-data.js items`, `node scripts/game-data.js economy` |
   | Monsters/Combat | `node scripts/game-data.js monsters`, `node scripts/game-data.js abilities` |
   | Crafting | `node scripts/game-data.js recipes`, `node scripts/game-data.js npcs` |
   | World/Zones | `node scripts/game-data.js maps`, `node scripts/game-data.js zone <id>` for relevant zones |
   | Quests | `node scripts/game-data.js quests` |
   | Gathering | `node scripts/game-data.js gathering`, `node scripts/game-data.js items tool` |

   Run queries in parallel where possible.

3. **Analyze the data** and write `game_design/<name>/research.md`:

```markdown
# [Design Name] — Research

## Game State Overview
[Summary from `overview` command — total entity counts, zones, etc.]

## Existing Related Content
[What's already in the game that relates to this design? Items, monsters, NPCs, etc. that overlap or connect]

## Balance Baselines

### Monster Stats (current ranges)
| Stat | Min | Max | Median | Notes |
|------|-----|-----|--------|-------|
| ATK | | | | |
| DEF | | | | |
| HP | | | | |
| XP | | | | |
| Crowns | | | | |

### Item Stats (current ranges by category)
[Relevant categories only — weapon attack ranges, armor defence ranges, tool durability/power, resource stack sizes]

### Recipe Costs
| Metric | Min | Max | Median |
|--------|-----|-----|--------|
| Crown cost | | | |
| Craft time (s) | | | |
| Ingredient count | | | |

### Economy Snapshot
- **Crown sources**: [monster drops, gathering gold, marketplace — with approximate rates]
- **Crown sinks**: [crafting costs, marketplace — with approximate rates]
- **Net flow assessment**: [surplus/deficit/balanced]

## Gap Analysis
[What's missing from the game that this design would fill?]
- [Gap 1: e.g., "No T2 gathering locations exist yet"]
- [Gap 2: e.g., "Only 2 monsters in zone 3, players have nothing to fight"]

## Design Constraints
[What existing content constrains the new design?]
- [Constraint 1: e.g., "T2 resources use stack_size 30, new T2 items should match"]
- [Constraint 2: e.g., "Building 12 already has a gather action, can't add another"]

## Resolved Questions
[Answers to open questions from concept.md, grounded in data]
- [Question]: [Answer based on data]
- [Question]: [Answer based on data]

## Recommendations for Design Phase
[Key numbers and guidelines to use when writing the full design]
- Suggested stat ranges for new monsters: [based on tier/zone analysis]
- Suggested recipe costs: [based on existing cost curves]
- Suggested drop rates: [based on existing loot tables]
```

4. **Report**: Summarize key findings and suggest `/gd.design` as next step.

## Guidelines

- **Data over assumptions**: Every baseline number must come from an actual `game-data` query
- **Be specific**: Don't say "monsters are balanced" — say "monster ATK ranges from 3-15, median 8"
- **Flag surprises**: If the data reveals something unexpected (economy imbalance, missing content), call it out
- **Resolve questions**: Every open question from concept.md should be answered or marked as "still open — needs user decision"
