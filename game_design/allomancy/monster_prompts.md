# Monster Icon — Generation Prompts

## Icon Specifications

- **Size**: ~350 x 350 pixels per icon (roughly 300-400px, not pixel-exact)
- **Background**: Dark ambient vignette — dark brown/black gradient fading from center, creature in center with soft ambient glow. NOT transparent — monsters use a dark moody background.
- **Format**: PNG, RGBA
- **Generate each monster as a separate image** (not a spritesheet)

## Art Style Reference

Semi-realistic digital painting, dark fantasy RPG aesthetic. Creatures are painted with detailed textures (scales, fur, stone, chitin). Warm-to-neutral muted color palette with the creature's defining color as accent. Soft dramatic lighting from slightly above, creature facing roughly 3/4 view. Dark vignette background with subtle ambient glow around the creature. No outlines, no cel-shading, no pixel art. Similar to classic CRPG bestiary illustrations.

## Monster 1: Tunnel Crawler

```
A spider-like cave creature for a dark medieval fantasy RPG. Semi-realistic digital painting style. The Tunnel Crawler is a large arachnid with pale grey chitinous armor, eight segmented legs with sharp tips, and multiple small glowing amber eyes. Its body is low and flat, built for squeezing through narrow mine tunnels. Patches of mineral dust cling to its carapace. Menacing but not overly large — a common mine pest. Dark moody background with brown-black vignette. Warm amber lighting from above. Creature facing 3/4 view, slightly crouched. Approximately 350x350 pixels.
```

**Monster ID**: 14
**Stats context**: ATK 4, DEF 2, HP 20 — a weak, common encounter

---

## Monster 2: Ashvein Lurker

```
A large serpentine cave beast for a dark medieval fantasy RPG. Semi-realistic digital painting style. The Ashvein Lurker is a thick-bodied underground serpent with dark grey-blue scaled hide, a broad flat head with pale milky eyes, and a jaw lined with rows of jagged obsidian-like teeth. Faint veins of deep blue bioluminescence pulse along its flanks like glowing mineral deposits. Its body is partially coiled, rearing up from the mine floor. Ash and rock dust coat its lower scales. Intimidating and dangerous. Dark moody background with blue-black vignette. Cool blue-tinted lighting from the creature's own glow. Creature facing 3/4 view, rearing. Approximately 350x350 pixels.
```

**Monster ID**: 15
**Stats context**: ATK 8, DEF 5, HP 45 — a dangerous mid-tier encounter

---

## Post-Processing

1. Generate each monster icon separately
2. Upload via admin panel: `POST /api/monsters/batch-icons` with base64 PNG data
3. Or manually upload through the admin monster editor

## Monster ID Reference

| Monster | ID | Location |
|---------|-----|----------|
| Tunnel Crawler | 14 | Deep Tunnels gather encounter |
| Ashvein Lurker | 15 | Ashvein Drift gather encounter |
