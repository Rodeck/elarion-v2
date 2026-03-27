# Item Icon Spritesheet — Generation Prompt

## Spritesheet Specifications

- **Grid cell size**: 256 x 256 pixels
- **Layout**: 4 columns x 7 rows (28 cells, 1024 x 1792 total image)
- **Background**: Fully transparent (PNG with alpha channel)
- **Format**: PNG, RGBA
- **Items**: 26 icons (2 spare cells)

## Art Style Reference

Semi-realistic painted style, muted earthy and metallic tones, soft shadows and highlights, medieval fantasy RPG aesthetic. Each icon is a single object centered in its cell with no background — just the item floating on transparency. Consistent lighting from upper-left. Subtle texture detail (grain, scratches, patina). No outlines, no cel-shading, no pixel art.

## Generation Prompt

A 4x7 grid spritesheet of 256x256 pixel item icons on a fully transparent background. Semi-realistic painted style, muted medieval fantasy tones, soft upper-left lighting, no outlines, no cel-shading. Each cell contains one centered item:

**Row 1 — Raw Fish (common)**
- R1C1: A small dull-brown bottom-feeding fish with flat head and muddy scales. Short, stocky body. Muted olive and brown tones with a pale belly.
- R1C2: A small striped freshwater perch, silver and olive-green with faint dark vertical bars. Compact body, slightly spiny dorsal fin.
- R1C3: A sleek trout with bright silver scales that catch the light. Streamlined body, forked tail, faint pink streak along its flank.
- R1C4: A fat ornamental carp, deep gold and amber coloring with large round scales. Plump body, flowing fins, warm metallic sheen.

**Row 2 — Raw Fish (rare) + Trophy**
- R2C1: A long dark eel with ash-grey fins edged in black. Sinuous body, small eyes, slick oily skin texture. Soot-colored with subtle iridescence.
- R2C2: A pale eyeless fish with translucent skin showing faint blue veins. Elongated body, ghostly white, delicate needle-like teeth.
- R2C3: A medium fish with shimmering fog-colored scales that seem to shift between silver and grey. Elegant body, flowing translucent fins.
- R2C4: A single massive severed fin, dark as charcoal, with bony ridges and torn membrane edges. Wet sheen, veined texture, imposing scale.

**Row 3 — Cooked Fish**
- R3C1: A whole small fish grilled on a rough wooden stick, charred brown with crispy skin and faint smoke wisps. Simple, rustic presentation.
- R3C2: A pan-seared fish fillet on a small iron skillet, golden-brown crispy skin facing up, flaky white flesh visible at the edges.
- R3C3: A delicate fish fillet on a clay plate, silver-skinned and lightly seared, garnished with a small herb sprig. Clean, appetizing.
- R3C4: A steaming clay bowl of dark stew with chunks of eel visible in a rich brown-black broth. Wisps of steam rising, hearty and warm.

**Row 4 — Cooked Fish (premium) + Rings**
- R4C1: A generous portion of pale fish on a wooden platter, arranged with care. Rich, creamy flesh with subtle pink tones, drizzled with oil.
- R4C2: A simple band ring of tarnished green copper, slightly rough texture, unpolished. Thin band, no gemstone. Patina and age visible.
- R4C3: A delicate ring woven from tiny silver wire and fish-scale fragments that shimmer. Intricate braided band, elegant and light.
- R4C4: A dark iron ring with a small tooth-like setting — curved, sharp, slightly yellowed. Black iron has a subtle warm glow.

**Row 5 — Rings + Amulets**
- R5C1: A heavy coiled ring of dark blue-grey metal, like a miniature serpent wrapped around itself. Dense, cold appearance, faintly luminous.
- R5C2: A small tarnished pendant on a thin leather cord. Oval shape, dull bronze or copper, with a faintly warm inner glow showing through cracks.
- R5C3: An amulet made of overlapping fog-colored fish scales set in a bone frame. Circular, with scales arranged in a spiral pattern. Pale and ethereal.
- R5C4: A smooth dark river stone wrapped tightly in fine silver wire, hanging from a braided cord. Stone is deep grey-green with a polished sheen.

**Row 6 — Amulets + Fishing Rods (basic)**
- R6C1: An ornate talisman carved from something dark and ancient — almost black with faint veining. Oval, hung on a chain that doesn't tangle. Emanates subtle dark energy.
- R6C2: A crude fishing rod — a rough-cut branch with frayed twine wrapped around it. Bent, weathered wood, basic hook on a tangled line. Poor and makeshift.
- R6C3: A sturdier fishing rod — straight wooden pole with tightly wound linen cord and a better hook. Clean wrapping, functional, no decoration.
- R6C4: A reinforced fishing rod — dark wood braced with iron bands at stress points. Waxed line wound on a simple reel. Professional and durable.

**Row 7 — Fishing Rods (advanced)**
- R7C1: A master-crafted fishing rod — polished dark wood with steel fittings and joints. Silk line on a brass reel mechanism. Elegant craftsmanship visible.
- R7C2: A legendary fishing rod — made of pale ashwood with subtle alloy wire inlays that seem to glow faintly. Complex reel, flowing design, almost weapon-like quality.
- R7C3: (empty cell)
- R7C4: (empty cell)

## Post-Processing

1. Open the generated spritesheet in the admin panel's Sprite Sheet Tool
2. The tool auto-detects the 256x256 grid
3. Click each cell and assign to the corresponding item definition
4. Click "Cut" to extract and upload all icons at once

## Item ID Reference

| Cell | Item Name | Item ID | Category |
|------|-----------|---------|----------|
| R1C1 | Mudfish | pending | resource |
| R1C2 | River Perch | pending | resource |
| R1C3 | Silverscale Trout | pending | resource |
| R1C4 | Golden Carp | pending | resource |
| R2C1 | Ashfin Eel | pending | resource |
| R2C2 | Deep Lurker | pending | resource |
| R2C3 | Mistscale | pending | resource |
| R2C4 | Abyssal Leviathan Fin | pending | resource |
| R3C1 | Grilled Mudfish | pending | food |
| R3C2 | Pan-Seared Perch | pending | food |
| R3C3 | Silverscale Fillet | pending | food |
| R3C4 | Ashfin Stew | pending | food |
| R4C1 | Deep Lurker Feast | pending | food |
| R4C2 | Copper River Ring | pending | ring |
| R4C3 | Silverscale Band | pending | ring |
| R4C4 | Ashfin Loop | pending | ring |
| R5C1 | Leviathan's Coil | pending | ring |
| R5C2 | Tarnished River Pendant | pending | amulet |
| R5C3 | Mistscale Amulet | pending | amulet |
| R5C4 | Deep Current Charm | pending | amulet |
| R6C1 | Abyssal Talisman | pending | amulet |
| R6C2 | Crude Fishing Rod | pending | tool |
| R6C3 | Sturdy Fishing Rod | pending | tool |
| R6C4 | Reinforced Fishing Rod | pending | tool |
| R7C1 | Master Fishing Rod | pending | tool |
| R7C2 | Legendary Ashen Rod | pending | tool |
| R7C3 | (spare) | — | — |
| R7C4 | (spare) | — | — |
