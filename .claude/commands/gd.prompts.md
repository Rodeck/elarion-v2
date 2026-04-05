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

   **Prompt structure** (single paragraph, keep it tight):
   - Grid spec first with EXACT pixel dimensions: "Pixel-perfect spritesheet, exactly [W]x[H] pixels, [cols] columns x [rows] rows uniform grid, each cell exactly 256x256 pixels, no margins, no padding, no gaps, no borders, cells flush edge-to-edge starting at pixel 0,0."
   - If last row is partial: "Last row has N items then [empty] transparent cell(s)."
   - Background: "Transparent background."
   - Style: "Fantasy RPG item icons, stylized painted style like World of Warcraft icons, bold simple shapes, high contrast, readable at small size. Each item centered in its cell with generous padding, entirely contained within its cell boundaries — nothing may touch or cross cell edges."
   - **Weapon containment rule**: For weapons (swords, daggers, staves, bows, clubs, etc.), add: "Every weapon drawn vertically upright, NOT diagonal, NOT rotated, sized to fit within 60-70% of the cell with clear empty space on all sides." This prevents long diagonal weapons from overlapping into adjacent cells.
   - Items by row: "Top row left to right: [item], [item], [item]. Second row left to right: ..."
   - Each item: 3-8 words max — just the object and its dominant color. E.g., "dark wine bottle with cork", "glowing purple crystal shard", "clay pot of amber oil"
   - Negative: "No text, no labels, no decorative borders, no background color, no overlapping between cells."
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

   **Prompt structure** (single paragraph, keep it tight):
   - Grid spec first with EXACT pixel dimensions: "Pixel-perfect spritesheet, exactly [W]x[H] pixels, [cols] columns x [rows] rows uniform grid, each cell exactly 350x350 pixels, no margins, no padding, no gaps, no borders, cells flush edge-to-edge starting at pixel 0,0."
   - Background: "Dark vignette background in each cell."
   - Style: "Fantasy RPG creature portraits, stylized painted style like World of Warcraft bestiary, bold shapes, high contrast, 3/4 view, dramatic top lighting, readable at small size."
   - Monsters by row: "Top row left to right: [monster], [monster]. Bottom row: ..."
   - Each monster: 8-15 words max — body type, color, one signature feature. E.g., "massive dark stone golem with glowing blue-green veins", "coiled green serpent with golden eyes and dripping fangs"
   - Negative: "No text, no labels, no decorative borders."
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

- **Stylized, not realistic**: Inspired by WoW/Diablo icon art — bold shapes, strong contrast, painterly brushstrokes. NOT photorealistic.
- **Readability first**: Every icon must be recognizable at 48x48 pixels. Favor clear silhouettes and dominant colors over fine detail.
- **Keep descriptions short**: 10-20 words per item focusing on shape + color + one signature feature. Micro-details (hairline fractures, air bubbles, thread patterns) are wasted — the model either ignores them or adds noise.
- **Material focus**: For items — dominant material color and glossiness (not texture grain). For gems — glow color and shape.
- **Character through appearance**: For NPCs — clothing, tools, expression tell their story
- **Creature design logic**: Monsters should have one bold signature feature (crystal growths, iron shell, shadow wisps) that defines them visually
- **Spritesheet consistency**: Emphasize uniform lighting, scale, and style across all cells in the grid
- **Cell containment**: Every item MUST be fully contained within its grid cell with visible padding on all sides. Long items (swords, staves, bows) must be drawn vertically upright and sized to ~60-70% of cell height — NEVER diagonal, as diagonal placement causes weapons to overlap into adjacent cells and ruins the spritesheet for slicing. This is the #1 cause of unusable spritesheets.
