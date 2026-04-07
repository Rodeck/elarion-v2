---
description: Generate AI image generation prompts for items, monsters, and NPCs defined in a game design document.
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Outline

Generate ready-to-use AI art prompts for all visual assets in a design. Items and monsters produce **spritesheet prompts** (one prompt = one image containing multiple icons in a grid). NPCs produce **individual prompts** (one prompt per NPC).

### Workflow

1. **Locate the design**:
   - If `$ARGUMENTS` is a design name: look for `game_design/<name>/design.md`
   - If empty: list `game_design/*/design.md` and ask the user which design to generate prompts for
   - Read `design.md` to find all items, monsters, and NPCs
   - Also read `execution-log.md` if it exists (to include entity IDs)

2. **Generate item spritesheet prompts** → `game_design/<name>/item_prompts.md` (or `_part1.md`, `_part2.md` if >25 items):

   **Batching rule**: Up to 25 items per spritesheet prompt. If the design has more than 25 items, split into multiple files (`item_prompts_part1.md`, `item_prompts_part2.md`, etc.) with up to 25 items each.

   **Grid layout**: Calculate the grid dimensions for the batch:
   - 1-5 items: single row (Nx1)
   - 6-10 items: 5 columns (5xN rows)
   - 11-25 items: 5 columns (5xN rows, last row may be partial)

   **File format**:

   ```markdown
   # Item Spritesheet Prompt

   **Items in this sheet (N)**: [numbered list of item names with IDs for reference]

   ## Prompt

   [Single complete prompt paragraph — ready to paste into image model. Describes the full spritesheet grid, art style, each item by grid position, and output format.]
   ```

   **Prompt structure** (single paragraph — the model must understand this is a sliceable grid):

   The prompt MUST follow this exact structure. Image models often ignore grid spacing instructions, so the prompt is designed to over-emphasize containment and isolation:

   1. **Grid as sliceable image**: Start with "A flat grid spritesheet image for a video game. The image is exactly [W]x[H] pixels. It contains a strict [cols]x[rows] grid of square cells. Each cell is exactly 256x256 pixels. There are zero pixels of margin, padding, or gap between cells — cells tile perfectly edge-to-edge so the image can be sliced into [total] equal squares by cutting at every 256-pixel boundary."
   2. **Item sizing and isolation** (critical for slicing): "Each item is drawn SMALL — occupying only the center 50-60% of its cell, leaving at least 50 pixels of empty transparent space on every side as a safety margin. No part of any item may come within 50 pixels of any cell edge. This is critical: every item must be an isolated floating object surrounded by transparent emptiness within its own square."
   3. **Background**: "Transparent background throughout the entire image."
   4. **Style**: "Style: fantasy RPG item icons, painted style like World of Warcraft inventory icons, bold readable shapes, warm palette, soft drop shadows beneath each item to ground them."
   5. **Weapon containment rule**: For weapons (swords, daggers, staves, bows, clubs, etc.), add: "Every weapon drawn vertically upright, NOT diagonal, NOT rotated, sized to fit within 50-60% of the cell with clear empty space on all sides."
   6. **Items by cell position using numbered references**: "Row 1 (cells 1-5, left to right): [1] a short description, [2] a short description, ... Row 2 (cells 1-N): [N+1] description, ..."
   7. **Partial rows**: If last row is partial: "Cells N-M of row R are completely empty and transparent."
   8. **Each item**: 8-15 words — the object, its dominant color, and one distinguishing feature. E.g., "[1] a dark wine bottle with red wax seal and cork", "[2] a glowing purple crystal shard with jagged edges"
   9. **Closing containment reminder**: "Every item is a single small centered object floating in transparent space. Items do not touch each other or their cell boundaries."
   10. **Negative**: "No text, no labels, no numbers, no borders, no frames, no background color anywhere."
   - DO NOT include art theory words like "brushstrokes", "specular highlights", "rim lighting" — keep it simple

3. **Generate monster spritesheet prompts** → `game_design/<name>/monster_prompts.md` (or split if >25):

   Same batching and grid rules as items, but with monster-specific styling:

   **File format**:

   ```markdown
   # Monster Spritesheet Prompt

   **Monsters in this sheet (N)**: [numbered list of monster names with IDs for reference]

   ## Prompt

   [Single complete prompt paragraph — ready to paste.]
   ```

   **Prompt structure** (single paragraph — same containment-first approach as items):

   1. **Grid as sliceable image**: "A flat grid spritesheet image for a video game. The image is exactly [W]x[H] pixels. It contains a strict [cols]x[rows] grid of square cells. Each cell is exactly 350x350 pixels. There are zero pixels of margin, padding, or gap between cells — cells tile perfectly edge-to-edge so the image can be sliced into [total] equal squares by cutting at every 350-pixel boundary."
   2. **Creature sizing and isolation**: "Each creature is drawn to occupy only the center 60-70% of its cell, leaving at least 50 pixels of empty space on every side. No part of any creature may come within 50 pixels of any cell edge. Every creature must be fully contained within its own square."
   3. **Background**: "Dark vignette background in each cell."
   4. **Style**: "Style: fantasy RPG creature portraits, painted style like World of Warcraft bestiary, bold shapes, high contrast, 3/4 view, dramatic top lighting, readable at small size."
   5. **Monsters by cell position using numbered references**: "Row 1 (cells 1-N): [1] description, [2] description, ... Row 2: ..."
   6. **Each monster**: 8-15 words — body type, color, one signature feature. E.g., "[1] massive dark stone golem with glowing blue-green veins", "[2] coiled green serpent with golden eyes and dripping fangs"
   7. **Closing containment reminder**: "Every creature is fully contained within its cell. Creatures do not touch each other or their cell boundaries."
   8. **Negative**: "No text, no labels, no numbers, no decorative borders."
   - DO NOT include art theory words

4. **Generate NPC prompts** → `game_design/<name>/npc_prompts.md` (if design has NPCs):

   NPCs remain **individual prompts** — one per NPC, each a separate paragraph.

   ```markdown
   # NPC Prompts

   ## [NPC Name] (ID: [id])

   [Complete image generation prompt — one self-contained paragraph. Ready to paste.]

   ---

   [Repeat for each NPC]
   ```

   **NPC prompt structure** (all in one paragraph):
   - Style prefix: "Semi-realistic digital painting, medieval fantasy RPG character portrait"
   - Subject: age, build, facial features, expression, clothing/armor, accessories
   - Colors: specific palette
   - Lighting: "warm amber lighting, portrait framing showing head and upper shoulders"
   - Background: "dark warm brown vignette"
   - Format: "256x256 pixels, PNG"
   - Negative: "no outlines, no cel-shading, no pixel art, no text"

5. **Report**: List generated prompt files with item/monster counts per sheet.

## Output Rules

- **Item/monster prompts**: ONE prompt per file, describing the entire spritesheet grid. The prompt must be a single copy-pasteable paragraph.
- **NPC prompts**: One prompt per NPC as separate paragraphs in one file.
- **Item list as reference**: Include a numbered list of items ABOVE the prompt (not inside it) so the user knows which grid position maps to which entity.
- **No post-processing instructions** — no upload steps, no admin panel references, no technical workflow inside the prompt.
- **Consistent descriptions**: Every item/monster in the grid should have similar description length and detail level to ensure the model treats them equally.

## Art Style Guidelines

- **Stylized, not realistic**: Inspired by WoW/Diablo icon art — bold shapes, strong contrast, warm palette. NOT photorealistic.
- **Readability first**: Every icon must be recognizable at 48x48 pixels. Favor clear silhouettes and dominant colors over fine detail.
- **Keep descriptions concise**: 8-15 words per item focusing on shape + color + one distinguishing feature. Micro-details (hairline fractures, air bubbles, thread patterns) are wasted — the model either ignores them or adds noise.
- **Material focus**: For items — dominant material color and glossiness (not texture grain). For gems — glow color and shape.
- **Character through appearance**: For NPCs — clothing, tools, expression tell their story
- **Creature design logic**: Monsters should have one bold signature feature (crystal growths, iron shell, shadow wisps) that defines them visually

### Spritesheet Slicing Rules (Critical)

These rules exist because image models tend to draw items too large, too close together, or overlapping cell boundaries — making the spritesheet impossible to slice into individual icons.

- **Item sizing**: Every item occupies only the CENTER 50-60% of its cell. At least 50px of transparent empty space on all sides.
- **No-go zone**: No part of any item may come within 50 pixels of any cell edge. This is the #1 instruction to repeat and emphasize.
- **Isolation language**: Describe each item as "an isolated floating object surrounded by transparent emptiness" — this framing helps models understand spacing.
- **Numbered cell references**: Use `[1]`, `[2]`, etc. instead of prose like "top row left to right" — numbered positions are followed more reliably.
- **Drop shadows**: Add "soft drop shadows beneath each item" — this grounds items visually without needing them to fill the cell.
- **Containment bookend**: End the prompt with a containment reminder: "Every item is a single small centered object floating in transparent space. Items do not touch each other or their cell boundaries."
- **Weapon containment**: Long items (swords, staves, bows) must be drawn vertically upright, NOT diagonal, sized to 50-60% of cell height — diagonal placement causes overlap into adjacent cells.
- **No art theory words**: Avoid "brushstrokes", "specular highlights", "rim lighting", "volumetric" — these bloat the prompt without improving output.
