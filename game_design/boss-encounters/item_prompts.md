# Item Icon Spritesheet — Generation Prompt

## Spritesheet Specifications

- **Grid cell size**: 256 x 256 pixels
- **Layout**: 4 columns x 1 row (4 cells, 1024 x 256 total image)
- **Background**: Fully transparent (PNG with alpha channel)
- **Format**: PNG, RGBA

## Art Style Reference

Semi-realistic painted style, muted earthy and metallic tones, soft shadows and highlights, medieval fantasy RPG aesthetic. Each icon is a single object centered in its cell with no background — just the item floating on transparency. Consistent lighting from upper-left. Subtle texture detail (grain, scratches, patina). No outlines, no cel-shading, no pixel art.

## Generation Prompt

A 4-cell horizontal spritesheet on a fully transparent background. Each cell is 256x256 pixels. Each cell contains a single item icon, centered, with no background.

**Row 1, Cell 1 — Boss Challenge Token**: A heavy wax-sealed parchment warrant rolled into a tight scroll, bound with a dark crimson ribbon. A large wax seal in deep burgundy bears an embossed city crest — a tower flanked by crossed swords. The parchment is aged and slightly yellowed with visible fiber texture. The ribbon has a satin sheen. The wax seal catches the light with a glossy highlight. The overall feeling is official, weighty, and ominous — this document carries authority and consequence.

**Row 1, Cell 2 — (spare cell)**: Empty, transparent.

**Row 1, Cell 3 — (spare cell)**: Empty, transparent.

**Row 1, Cell 4 — (spare cell)**: Empty, transparent.

## Post-Processing

1. Open the generated spritesheet in the admin panel's Sprite Sheet Tool
2. The tool auto-detects the 256x256 grid
3. Click cell R1C1 and assign to item "Boss Challenge Token" (ID 97)
4. Click "Cut" to extract and upload the icon

## Item ID Reference

| Cell | Item Name | Item ID |
|------|-----------|---------|
| R1C1 | Boss Challenge Token | 97 |
| R1C2 | (spare cell) | — |
| R1C3 | (spare cell) | — |
| R1C4 | (spare cell) | — |
