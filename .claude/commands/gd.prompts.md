---
description: Generate AI image generation prompts for items, monsters, and NPCs defined in a game design document.
---

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Outline

Generate ready-to-use AI art prompts for all visual assets in a design. Each prompt should be a complete, self-contained text that can be pasted directly into an image generation model (Midjourney, DALL-E, Stable Diffusion, etc.) with no editing needed.

### Workflow

1. **Locate the design**:
   - If `$ARGUMENTS` is a design name: look for `game_design/<name>/design.md`
   - If empty: list `game_design/*/design.md` and ask the user which design to generate prompts for
   - Read `design.md` to find all items, monsters, and NPCs
   - Also read `execution-log.md` if it exists (to include entity IDs)

2. **Generate item prompts** → `game_design/<name>/item_prompts.md` (if design has items):

```markdown
# Item Prompts

## [Item Name] (ID: [id])

[Complete image generation prompt — one self-contained paragraph. Include: art style, subject description, materials, colors, lighting, composition, background, output format. Ready to paste into any image model.]

---

[Repeat for each item]
```

   **Item prompt structure** (all in one paragraph):
   - Style prefix: "Semi-realistic digital painting, medieval fantasy RPG item icon"
   - Subject: what the item is, its shape, materials, textures, wear/age
   - Colors: specific palette (e.g., "tarnished brass with dark brown patina")
   - Lighting: "soft upper-left lighting with subtle metallic highlights"
   - Composition: "single object centered, floating on fully transparent background"
   - Format: "256x256 pixels, PNG with alpha channel, no background"
   - Negative: "no outlines, no cel-shading, no pixel art, no text"

3. **Generate monster prompts** → `game_design/<name>/monster_prompts.md` (if design has monsters):

```markdown
# Monster Prompts

## [Monster Name] (ID: [id])

[Complete image generation prompt — one self-contained paragraph. Ready to paste.]

---

[Repeat for each monster]
```

   **Monster prompt structure** (all in one paragraph):
   - Style prefix: "Semi-realistic digital painting, dark fantasy RPG creature portrait"
   - Subject: body type, size, defining features, pose, expression
   - Textures: skin/scales/fur/armor detail
   - Colors: specific palette with accent colors
   - Lighting: "dramatic lighting from slightly above, 3/4 view"
   - Background: "dark brown-black vignette with subtle ambient glow"
   - Format: "350x350 pixels, PNG"
   - Negative: "no outlines, no cel-shading, no pixel art, no text"

4. **Generate NPC prompts** → `game_design/<name>/npc_prompts.md` (if design has NPCs):

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

5. **Report**: List generated prompt files.

## Output Rules

- **Each prompt must be a single, complete, copy-pasteable paragraph** — no bullet points, no sections within a prompt, no metadata mixed in
- **No post-processing instructions** — no upload steps, no admin panel references, no technical workflow
- **No specification headers** (size, format, background) as separate sections — bake these into each prompt directly
- **Entity ID only as a heading reference** — `## Monster Name (ID: 16)` so the user knows which entity the prompt is for
- **No reference tables, no stat context blocks** — just the prompt text under each heading

## Art Style Guidelines

- **Visual consistency**: Semi-realistic, muted earthy/metallic tones, medieval fantasy, painted look
- **Descriptive over prescriptive**: Describe what the thing looks like, not how to draw it
- **Material focus**: For items — metal sheen, wood grain, leather texture, gemstone clarity
- **Character through appearance**: For NPCs — clothing, tools, expression tell their story
- **Creature design logic**: Monsters should look like they belong in their environment
