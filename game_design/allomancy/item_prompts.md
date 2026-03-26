# Item Icon Spritesheet — Generation Prompt

## Spritesheet Specifications

- **Grid cell size**: 256 x 256 pixels
- **Layout**: 4 columns x 4 rows (16 cells, 1024 x 1024 total image)
- **Background**: Fully transparent (PNG with alpha channel)
- **Format**: PNG, RGBA

## Art Style Reference

Semi-realistic painted style, muted earthy and metallic tones, soft shadows and highlights, medieval fantasy RPG aesthetic. Each icon is a single object centered in its cell with no background — just the item floating on transparency. Consistent lighting from upper-left. Subtle texture detail (grain, scratches, patina). No outlines, no cel-shading, no pixel art.

## Generation Prompt

```
A 4x4 grid spritesheet of medieval fantasy RPG item icons, each cell 256x256 pixels on a fully transparent background. Semi-realistic painted style with soft lighting from upper-left, muted earthy and metallic tones.

Row 1 (ores - rough, unrefined chunks of rock with visible metal):
Cell 1: Iron Ore — a heavy grey rock chunk streaked with rusty orange veins
Cell 2: Copper Ore — a rough greenish-brown rock with warm copper-green patina
Cell 3: Zinc Ore — a pale bluish-white crystalline rock fragment
Cell 4: Cobalt Ore — a deep blue-black rock that faintly glows with blue undertones

Row 2 (refined metal bars/ingots - clean, rectangular, polished):
Cell 1: Iron Bar — a rectangular dark grey metal ingot with a matte finish
Cell 2: Copper Bar — a warm reddish-copper polished rectangular ingot
Cell 3: Zinc Bar — a pale silvery-blue lightweight metal bar
Cell 4: Cobalt Bar — a deep blue metallic ingot with a subtle inner glow

Row 3 (alloys and rare metals):
Cell 1: Steel Bar — a strong grey alloy ingot with faint silver veining
Cell 2: Brass Bar — a golden-toned polished alloy bar with warm amber sheen
Cell 3: Mythril Shard — a small crystalline metallic fragment, pale iridescent shimmer, slightly translucent
Cell 4: Titanite Dust — a small pile or pouch of shimmering dark metallic powder with faint sparkles

Row 4 (fuel and tools):
Cell 1: Charite — a dense chunk of dark charcoal with an orange-hot ember core
Cell 2: Iron Pickaxe — a sturdy pickaxe with dark iron head and wooden handle
Cell 3: Steel Pickaxe — an elegant pickaxe with silvery steel head and reinforced handle
Cell 4: (empty/spare cell)

Each item centered in its cell, no background, painted semi-realistic style matching a dark medieval fantasy game.
```

## Post-Processing

1. Open the generated spritesheet in the admin panel's Sprite Sheet Tool
2. The tool auto-detects the 256x256 grid
3. Click each cell and assign to the corresponding item definition
4. Click "Cut" to extract and upload all icons at once

## Item ID Reference

| Cell | Item Name | Item ID |
|------|-----------|---------|
| R1C1 | Iron Ore | 17 |
| R1C2 | Copper Ore | 32 |
| R1C3 | Zinc Ore | 34 |
| R1C4 | Cobalt Ore | 36 |
| R2C1 | Iron Bar | 31 |
| R2C2 | Copper Bar | 33 |
| R2C3 | Zinc Bar | 35 |
| R2C4 | Cobalt Bar | 37 |
| R3C1 | Steel Bar | 38 |
| R3C2 | Brass Bar | 39 |
| R3C3 | Mythril Shard | 40 |
| R3C4 | Titanite Dust | 41 |
| R4C1 | Charite | 42 |
| R4C2 | Iron Pickaxe | 43 |
| R4C3 | Steel Pickaxe | 44 |
| R4C4 | (empty) | — |
