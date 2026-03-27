# NPC Portraits — Generation Prompts

## Portrait Specifications

- **Size**: 256 x 256 pixels
- **Background**: Dark gradient vignette (warm brown-black, darker at edges)
- **Format**: PNG, RGBA
- **Generate each NPC as a separate image**

## Art Style Reference

Semi-realistic digital painting, medieval fantasy RPG aesthetic. Characters are painted with detailed facial features and clothing textures. Warm lighting, portrait framing (head and upper shoulders). Character's personality and role should be visible in expression and attire. Dark warm vignette background. No outlines, no cel-shading. Similar to classic CRPG character portraits.

---

## NPC 1: Harlen the Fisherman

A weathered man in his late fifties with deep-set eyes and sun-darkened skin creased by decades of squinting at water. His face is lean and angular, with a strong jaw hidden under a short grey-white beard that's patchy and salt-stained. He wears a faded dark canvas coat over a rough linen shirt, collar open. A wide-brimmed leather hat, battered and shapeless, sits back on his head revealing a high, lined forehead. His expression is calm and knowing — the faint hint of a dry smile, like he's heard every fish story and believes none of them. A coil of thick fishing line hangs over one shoulder. His eyes are pale grey-blue, the color of river water. Warm amber light from the left, dark dock-wood tones in the vignette.

**NPC ID**: pending
**Role**: Quest giver, rod repairs, rod upgrades
**Location**: Docs (Elarion City)

---

## Post-Processing

1. Generate the NPC portrait as a separate 256x256 image
2. Upload via admin panel: use `game-entities upload-npc-icon` with the PNG file path
3. Then assign the returned icon_filename to the NPC via `create-npc`

## NPC ID Reference

| NPC | ID | Role | Location |
|-----|-----|------|----------|
| Harlen the Fisherman | pending | Quest giver / rod upgrades / repairs | Docs (Elarion City, building 4) |
