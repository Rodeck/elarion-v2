---
description: Brainstorm and outline a game design concept for Elarion. Generates an initial concept brief in game_design/.
handoffs:
  - label: Research Game State
    agent: gd.research
    prompt: Research existing game data to inform this design
    send: true
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Outline

The text the user typed after `/gd.concept` is the design idea. It could be anything: a new item set, a combat mechanic, a zone, a quest chain, an NPC faction, a gathering system, etc.

### Workflow

1. **Parse the idea** from `$ARGUMENTS`.
   - If empty: Ask the user what they'd like to design.

2. **Generate a short kebab-case name** (2-4 words) for the design directory:
   - Examples: `poison-alchemy`, `desert-zone`, `fishing-system`, `thieves-guild`, `frost-weapons`

3. **Check for existing designs**:
   - List `game_design/*/concept.md` to see what already exists
   - If a design with the same name exists, warn the user and ask whether to continue or rename

4. **Create the directory**: `game_design/<name>/`

5. **Write `game_design/<name>/concept.md`** with this structure:

```markdown
# [Design Name]

## Design Goal
[1-2 sentences: What player experience or game loop does this create? What problem does it solve or what gap does it fill?]

## Core Fantasy
[1-2 sentences: What is the thematic/narrative hook? What makes this feel exciting or meaningful to the player?]

## Game Systems Touched
[List which existing systems this interacts with, and how]
- **Combat**: [how it relates, or "Not involved"]
- **Economy**: [how it relates]
- **Progression**: [how it relates]
- **World/Zones**: [how it relates]
- **Social/Quests**: [how it relates]
- **Crafting**: [how it relates]
- **Gathering**: [how it relates]

## Content Scope Estimate
| Entity Type | Estimated Count | Notes |
|-------------|----------------|-------|
| Items | N | [categories: resource, weapon, tool, etc.] |
| NPCs | N | [roles: crafter, quest giver, etc.] |
| Monsters | N | [tiers and purposes] |
| Recipes | N | [at which NPCs] |
| Abilities | N | [types] |
| Quests | N | [types: main, side, daily, etc.] |
| Gathering Actions | N | [locations] |
| Building Actions | N | [types: explore, expedition, etc.] |

## Player Loop
[Describe the core gameplay loop this creates, step by step]
1. Player does X...
2. Which gives them Y...
3. They use Y to...
4. Which unlocks/improves...

## Tier/Progression Sketch
[How does content scale from easy to hard? What are the tiers or stages?]

| Tier | Theme | Access | Key Content |
|------|-------|--------|-------------|
| T1 | [name] | [how unlocked] | [main items/monsters] |
| T2 | [name] | [how unlocked] | [main items/monsters] |
| ... | | | |

## Dependencies
[What existing game content must exist for this design to work?]
- Requires: [buildings, zones, NPCs, items that must already exist]
- Builds on: [existing systems or content this extends]

## Open Questions
[Things to resolve during the research phase]
- [ ] [Question about balance, scope, or integration]
- [ ] [Question about existing content fit]
```

6. **Collaborate with the user**: After writing the concept, discuss it briefly:
   - Highlight the most interesting design choices
   - Flag any potential balance concerns
   - Ask if the scope feels right before proceeding to research

7. **Report**: Print the concept file path and suggest `/gd.research` as the next step.

## Guidelines

- **Think player-first**: Every concept should answer "why would a player engage with this?"
- **Scope realistically**: Consider what can be created through the admin API (items, monsters, NPCs, recipes, actions, quests) — no engine changes
- **Connect to existing systems**: New content should integrate with what's already in the game, not exist in isolation
- **Use Elarion's tone**: Medieval fantasy, dark and grounded, Mistborn-influenced metal/allomancy themes
