---
description: Generate AI image generation prompts for items, monsters, and NPCs defined in a game design document.
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Outline

Generate AI art prompts for all visual assets in a design, following established Elarion art style conventions.

### Workflow

1. **Locate the design**:
   - If `$ARGUMENTS` is a design name: look for `game_design/<name>/design.md`
   - If empty: list `game_design/*/design.md` and ask the user which design to generate prompts for
   - Read `design.md` to find all items, monsters, and NPCs
   - Also read `execution-log.md` if it exists (to include entity IDs in reference tables)

2. **Generate item prompts** → `game_design/<name>/item_prompts.md` (if design has items):

```markdown
# Item Icon Spritesheet — Generation Prompt

## Spritesheet Specifications

- **Grid cell size**: 256 x 256 pixels
- **Layout**: [C] columns x [R] rows ([total] cells, [W] x [H] total image)
- **Background**: Fully transparent (PNG with alpha channel)
- **Format**: PNG, RGBA

## Art Style Reference

Semi-realistic painted style, muted earthy and metallic tones, soft shadows and highlights, medieval fantasy RPG aesthetic. Each icon is a single object centered in its cell with no background — just the item floating on transparency. Consistent lighting from upper-left. Subtle texture detail (grain, scratches, patina). No outlines, no cel-shading, no pixel art.

## Generation Prompt

[Single combined prompt describing the full grid layout, row by row, cell by cell. Each cell gets a short visual description focusing on material, color, shape, and texture.]

## Post-Processing

1. Open the generated spritesheet in the admin panel's Sprite Sheet Tool
2. The tool auto-detects the 256x256 grid
3. Click each cell and assign to the corresponding item definition
4. Click "Cut" to extract and upload all icons at once

## Item ID Reference

| Cell | Item Name | Item ID |
|------|-----------|---------|
| R1C1 | [name] | [id or "pending"] |
```

   **Grid layout rules**:
   - Use 4 columns (1024px wide)
   - Group by category: resources in top rows, equipment in middle, tools/misc in bottom
   - Fill remaining cells with "(empty)" or "(spare cell)"
   - If more than 16 items: split into multiple spritesheets (item_prompts_1.md, item_prompts_2.md)

3. **Generate monster prompts** → `game_design/<name>/monster_prompts.md` (if design has monsters):

```markdown
# Monster Icons — Generation Prompts

## Icon Specifications

- **Size**: ~350 x 350 pixels per icon (roughly 300-400px, not pixel-exact)
- **Background**: Dark ambient vignette — dark brown/black gradient fading from center, creature in center with soft ambient glow. NOT transparent — monsters use a dark moody background.
- **Format**: PNG, RGBA
- **Generate each monster as a separate image** (not a spritesheet)

## Art Style Reference

Semi-realistic digital painting, dark fantasy RPG aesthetic. Creatures are painted with detailed textures (scales, fur, stone, chitin). Warm-to-neutral muted color palette with the creature's defining color as accent. Soft dramatic lighting from slightly above, creature facing roughly 3/4 view. Dark vignette background with subtle ambient glow around the creature. No outlines, no cel-shading, no pixel art. Similar to classic CRPG bestiary illustrations.

## Monster [N]: [Name]

[Detailed visual prompt describing the creature: body type, size impression, defining features, color palette, texture details, mood/feeling, pose. 3-5 sentences.]

**Monster ID**: [id or "pending"]
**Stats context**: ATK [N], DEF [N], HP [N] — [brief role description]

---

[Repeat for each monster]

## Post-Processing

1. Generate each monster icon separately
2. Upload via admin panel: `POST /api/monsters/batch-icons` with base64 PNG data
3. Or manually upload through the admin monster editor

## Monster ID Reference

| Monster | ID | Location |
|---------|-----|----------|
| [name] | [id or "pending"] | [where this monster appears] |
```

   **Monster prompt guidelines**:
   - Describe the creature's physicality, not just its name
   - Include size impression relative to a human (smaller, human-sized, larger)
   - Use sensory language: textures, colors, light effects
   - Reference the monster's stat context — a weak pest looks different from a dangerous predator
   - Mention the environment it lives in for atmospheric consistency

4. **Generate NPC prompts** → `game_design/<name>/npc_prompts.md` (if design has NPCs):

```markdown
# NPC Portraits — Generation Prompts

## Portrait Specifications

- **Size**: 256 x 256 pixels
- **Background**: Dark gradient vignette (similar to monster icons but warmer tones)
- **Format**: PNG, RGBA
- **Generate each NPC as a separate image**

## Art Style Reference

Semi-realistic digital painting, medieval fantasy RPG aesthetic. Characters are painted with detailed facial features and clothing textures. Warm lighting, portrait framing (head and upper shoulders). Character's personality and role should be visible in expression and attire. Dark warm vignette background. No outlines, no cel-shading. Similar to classic CRPG character portraits.

## NPC [N]: [Name]

[Detailed visual prompt: age, build, facial features, expression, clothing/armor, defining accessories or tools of their trade, color palette, lighting mood. 3-5 sentences. The prompt should convey the NPC's personality and role.]

**NPC ID**: [id or "pending"]
**Role**: [crafter/quest giver/merchant/etc.]
**Location**: [building name]

---

[Repeat for each NPC]

## Post-Processing

1. Generate each NPC portrait separately
2. Upload via admin panel: use `game-entities upload-npc-icon` with the PNG file path
3. Then assign the returned icon_filename to the NPC

## NPC ID Reference

| NPC | ID | Role | Location |
|-----|-----|------|----------|
| [name] | [id or "pending"] | [role] | [building] |
```

5. **Report**: List generated prompt files and remind user to generate images with their preferred AI art tool, then upload via admin panel.

## Guidelines

- **Visual consistency**: All prompts should maintain the established Elarion art style (semi-realistic, muted tones, medieval fantasy, no pixel art)
- **Descriptive over prescriptive**: Describe what the thing looks like, not how to draw it
- **Material focus**: For items, emphasize material properties (metal sheen, wood grain, leather texture, gemstone clarity)
- **Character through appearance**: For NPCs, let their clothing, tools, and expression tell their story
- **Creature design logic**: Monsters should look like they belong in their environment — cave creatures are pale/dark, forest creatures have green/brown tones
