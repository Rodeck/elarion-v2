# Weapon & Armor Sets — Core Equipment Progression

## Context

Elarion currently has only 3 equippable items in the game (Warhammer of Wrath, Holy Chestplate, Holy War Helmet) — all high-end items with no progression path. This design adds a complete equipment progression system: 36 weapons across 6 subtypes and 30 armor pieces across 5 tiers. Players can now gear up incrementally as they grow, making each level range feel meaningfully different in combat.

The weapon subtypes introduce tactical variety: one-handed swords pair with shields for defense, two-handed weapons sacrifice shields for raw damage, daggers build around critical strikes, staves ignore armor, bows deliver pre-combat bonus hits, and wands sustain mana for ability-heavy builds. This gives players meaningful loadout choices rather than "equip the biggest number."

---

## Tier/Category Design

### Weapons — 6 Subtypes, 6 Tiers Each

Each weapon subtype fills a distinct combat role. Tiers scale from starter gear through endgame.

| Subtype | Slot | Shield? | Special Mechanic | Stat Focus |
|---------|------|---------|------------------|------------|
| One-Handed | weapon | Yes | None — balanced baseline | ATK only |
| Two-Handed | weapon | No | Higher base ATK | ATK only |
| Dagger | weapon | Yes | Crit chance bonus | ATK + crit_chance |
| Staff | weapon | Yes | Armor penetration | ATK + armor_penetration |
| Bow | weapon | No | Pre-combat bonus hits | ATK + additional_attacks |
| Wand | weapon | Yes | Mana sustain | ATK + max_mana + mana_regen |

Two-handed weapons and bows cannot be used with a shield (enforced by `weapon_subtype`). Wands are one-handed, allowing shield pairing — compensating for their lower base ATK with mana utility for ability-focused builds.

### Armor — 5 Tiers, 6 Slots Each

Armor is organized in complete sets. Each set is a clear power step over the previous one.

| Set | Tier | Theme | Total DEF |
|-----|------|-------|-----------|
| Starter | 1 | Cloth & wood | 20 |
| Padded | 2 | Leather & padding | 36 |
| Iron | 3 | Studded metal | 57 |
| Steel | 4 | Full mail & plate | 79 |
| Knight | 5 | Masterwork plate | 104 |

Armor slot distribution follows a consistent pattern: chestplate has the highest DEF, shield next (if used), then greaves/bracers equal, and helmet/boots lowest.

---

## Items to Create (66 total)

### One-Handed Swords (category: weapon, weapon_subtype: one_handed)

| # | Name | attack | crit_chance | armor_penetration | additional_attacks | Description |
|---|------|--------|-------------|-------------------|--------------------|-------------|
| 1 | Rusty Iron Sword | 10 | 0 | 0 | 0 | A pitted blade scavenged from a roadside ditch. The edge is uneven but it cuts. |
| 2 | Militia Arming Sword | 14 | 0 | 0 | 0 | Standard-issue blade carried by town watchmen. Reliable if unremarkable. |
| 3 | Steel Falchion | 18 | 0 | 0 | 0 | A curved single-edged sword favored by mercenaries for its chopping power. |
| 4 | Knight's Longsword | 23 | 0 | 0 | 0 | A well-balanced blade bearing a noble house's mark on the crossguard. |
| 5 | Rune-Etched War Sword | 29 | 0 | 0 | 0 | Faint sigils glow along the fuller, etched by a forgotten smith. |
| 6 | Royal Lionblade | 36 | 0 | 0 | 0 | The lion-pommel blade of Elarion's elite guard. Its edge never seems to dull. |

### Two-Handed Weapons (category: weapon, weapon_subtype: two_handed)

| # | Name | attack | crit_chance | armor_penetration | additional_attacks | Description |
|---|------|--------|-------------|-------------------|--------------------|-------------|
| 1 | Wooden Club | 15 | 0 | 0 | 0 | A thick branch stripped of bark. Crude but heavy enough to crack bone. |
| 2 | Oak Greatclub | 20 | 0 | 0 | 0 | A hefty oak bludgeon reinforced with iron bands at the striking end. |
| 3 | Iron-Headed Maul | 26 | 0 | 0 | 0 | A forge hammer repurposed for war. The weight does most of the work. |
| 4 | Executioner's Greatsword | 33 | 0 | 0 | 0 | A broad-bladed sword built for decisive downward strokes. Not subtle. |
| 5 | Blacksteel Zweihander | 41 | 0 | 0 | 0 | Dark metal forged in deep furnaces. The blade hums when swung. |
| 6 | Giantbreaker Claymore | 50 | 0 | 0 | 0 | A massive blade said to have felled a mountain troll in a single arc. |

### Daggers (category: weapon, weapon_subtype: dagger)

| # | Name | attack | crit_chance | armor_penetration | additional_attacks | Description |
|---|------|--------|-------------|-------------------|--------------------|-------------|
| 1 | Penknife | 7 | 5 | 0 | 0 | A small folding blade meant for cutting cord, not throats. Surprisingly effective in a pinch. |
| 2 | Bone-Hilt Dagger | 10 | 7 | 0 | 0 | A hunting knife with a yellowed bone handle. The blade is narrow and sharp. |
| 3 | Stiletto Knife | 13 | 10 | 0 | 0 | A needle-thin blade designed to slip between armor plates. |
| 4 | Assassin's Rondel | 17 | 13 | 0 | 0 | A stiff triangular blade favored by those who kill for coin. |
| 5 | Moonfang Dagger | 22 | 17 | 0 | 0 | A curved blade that gleams pale silver. It finds gaps in armor like water finds cracks. |
| 6 | Shadowthorn Misericorde | 28 | 22 | 0 | 0 | A mercy blade carried by executioners. One thrust and it's done. |

### Staves (category: weapon, weapon_subtype: staff)

| # | Name | attack | crit_chance | armor_penetration | additional_attacks | Description |
|---|------|--------|-------------|-------------------|--------------------|-------------|
| 1 | Hazel Wood Staff | 9 | 0 | 1 | 0 | A straight hazel branch, bark still on. It strikes harder than it looks. |
| 2 | Ash Battle Staff | 12 | 0 | 3 | 0 | A stout ash pole hardened in smoke. The wood flexes but never breaks. |
| 3 | Ironbound Quarterstaff | 16 | 0 | 5 | 0 | Iron caps on both ends turn a walking stick into something lethal. |
| 4 | Bronze-Capped War Staff | 21 | 0 | 8 | 0 | Bronze fittings etched with old wards. Blows from this staff rattle plate armor. |
| 5 | White Oak Elder Staff | 27 | 0 | 12 | 0 | Carved from a tree that stood for centuries. Strikes bypass even the heaviest armor. |
| 6 | Starwood Archstaff | 34 | 0 | 16 | 0 | A pale staff cut from a tree that grew where a star fell. Armor means nothing to it. |

### Bows (category: weapon, weapon_subtype: bow)

| # | Name | attack | crit_chance | armor_penetration | additional_attacks | Description |
|---|------|--------|-------------|-------------------|--------------------|-------------|
| 1 | Slingshot | 10 | 0 | 0 | 1 | A forked stick and leather pouch. Fires stones before the enemy closes in. |
| 2 | Short Hunting Bow | 13 | 0 | 0 | 2 | A light bow for small game. Quick to draw and loose. |
| 3 | Yew Recurve Bow | 17 | 0 | 0 | 3 | A curved yew bow with surprising range. Each arrow finds its mark. |
| 4 | Horn Composite Bow | 22 | 0 | 0 | 4 | Layers of horn and sinew give this bow fearsome draw strength. |
| 5 | Ranger's Longbow | 28 | 0 | 0 | 5 | A tall bow that sings when drawn. Rangers swear by it for ambush work. |
| 6 | Warhawk Greatbow | 35 | 0 | 0 | 6 | A siege-grade bow that requires inhuman strength. Arrows punch through shield walls. |

### Wands (category: weapon, weapon_subtype: wand)

Wands sacrifice raw damage for mana sustainability. Lower ATK than one-handed swords at every tier, but they provide max_mana and mana_regen — making them the ideal choice for ability-focused characters who need to cast throughout a fight. ATK sits between daggers and staves; mana_regen scales 1–7, max_mana scales 5–30.

| # | Name | attack | max_mana | mana_regen | crit_chance | armor_penetration | additional_attacks | Description |
|---|------|--------|----------|------------|-------------|-------------------|--------------------|-------------|
| 1 | Crooked Twig Wand | 8 | 5 | 1 | 0 | 0 | 0 | A knotted branch that hums faintly when gripped. Hedge witches sell these for a few coppers. |
| 2 | Bone-Core Wand | 11 | 8 | 2 | 0 | 0 | 0 | A hollowed wand with a sliver of animal bone sealed inside. The marrow still holds some spark. |
| 3 | Amethyst Focus Wand | 15 | 12 | 3 | 0 | 0 | 0 | A polished amethyst set into the tip draws ambient energy and channels it through the shaft. |
| 4 | Ironwood Conduit | 20 | 17 | 4 | 0 | 0 | 0 | Dense ironwood carved with spiraling channels. Mana flows through it like water through a millrace. |
| 5 | Pale Ember Wand | 26 | 23 | 5 | 0 | 0 | 0 | A wand tipped with a shard of ever-burning coal. It feeds the caster's reserves with slow, steady heat. |
| 6 | Voidglass Scepter | 33 | 30 | 7 | 0 | 0 | 0 | A scepter of dark glass that seems to drink the light. Mana pools around it like fog in a hollow. |

### Armor — Set 1: Starter (category varies)

| # | Name | Category | defence | Description |
|---|------|----------|---------|-------------|
| 1 | Hood | helmet | 2 | A rough cloth hood that keeps rain off but not much else. |
| 2 | Cloth Shirt | chestplate | 4 | A sturdy linen tunic. Better than bare skin against a blade. |
| 3 | Footwraps | boots | 2 | Strips of cloth wound tight around the feet. Thin protection from thorns and stone. |
| 4 | Board Shield | shield | 6 | A plank of oak with a leather grip nailed to the back. It splinters, but it blocks. |
| 5 | Crude Greaves | greaves | 3 | Strips of boiled leather strapped over the shins. They've seen better days. |
| 6 | Cloth Pauldrons | bracer | 3 | Padded cloth shoulder pieces that absorb some of the sting from a blow. |

### Armor — Set 2: Padded (category varies)

| # | Name | Category | defence | Description |
|---|------|----------|---------|-------------|
| 1 | Padded Cap | helmet | 4 | Layers of quilted wool sewn into a fitted cap. Muffles blows to the head. |
| 2 | Gambeson | chestplate | 8 | A thick quilted jacket stuffed with cotton. Surprisingly effective against cuts. |
| 3 | Leather Boots | boots | 4 | Calf-high boots with hardened soles. Proper footwear for rough roads. |
| 4 | Round Shield | shield | 10 | A circular wooden shield faced with leather. The boss deflects glancing blows. |
| 5 | Leather Greaves | greaves | 5 | Shaped leather shin guards riveted to wool backing. |
| 6 | Leather Vambraces | bracer | 5 | Forearm guards of thick cowhide. They creak when flexed. |

### Armor — Set 3: Iron (category varies)

| # | Name | Category | defence | Description |
|---|------|----------|---------|-------------|
| 1 | Iron Cap | helmet | 7 | A simple iron dome that fits snug over the skull. Dents easily but saves lives. |
| 2 | Studded Brigandine | chestplate | 13 | A leather vest riveted with iron plates on the inside. |
| 3 | Reinforced Boots | boots | 6 | Leather boots with iron plates sewn over the toe and heel. |
| 4 | Kite Shield | shield | 15 | A tall, tapered shield that covers from shoulder to knee. |
| 5 | Iron Greaves | greaves | 8 | Hammered iron plates strapped over the shins with leather buckles. |
| 6 | Iron Bracers | bracer | 8 | Iron forearm guards lined with wool. Heavy but dependable. |

### Armor — Set 4: Steel (category varies)

| # | Name | Category | defence | Description |
|---|------|----------|---------|-------------|
| 1 | Nasal Helm | helmet | 10 | A steel helm with a nose guard. The mark of a professional soldier. |
| 2 | Mail Hauberk | chestplate | 18 | A knee-length shirt of interlocking steel rings. Weighs like sin but stops blades. |
| 3 | Steel Sabatons | boots | 9 | Articulated steel foot armor. Every step clanks on stone. |
| 4 | Heater Shield | shield | 20 | A curved steel-faced shield shaped like an inverted triangle. Built for mounted combat. |
| 5 | Steel Greaves | greaves | 11 | Polished steel shin plates with articulated knee guards. |
| 6 | Steel Vambraces | bracer | 11 | Hinged steel forearm guards that lock into place with a satisfying click. |

### Armor — Set 5: Knight (category varies)

| # | Name | Category | defence | Description |
|---|------|----------|---------|-------------|
| 1 | Visored Great Helm | helmet | 14 | A full-face helm with a hinged visor. The world narrows to a slit of light. |
| 2 | Tempered Cuirass | chestplate | 24 | A breastplate of hardened steel, shaped to deflect lance points and sword blows. |
| 3 | Knight-Captain Sabatons | boots | 12 | Ornate steel footwear bearing a captain's insignia. Built for ceremony and slaughter alike. |
| 4 | Tower Shield | shield | 26 | A wall of steel and oak tall enough to crouch behind. Practically a fortification. |
| 5 | Engraved Plate Greaves | greaves | 14 | Masterwork leg armor with scrollwork etched into the steel. |
| 6 | Runed Plate Bracers | bracer | 14 | Steel bracers inscribed with protective runes that seem to pulse faintly. |

---

## NPCs to Create (0)

No new NPCs needed. These items will enter the game through monster loot tables, quest rewards, marketplace trading, and crafting recipes (designed separately).

---

## Monsters

No new monsters in this design.

---

## Crafting Recipes

Deferred per user request — items only for now.

---

## Economy Flow

These items are pure equipment with no crafting dependencies. They will enter the economy through:

```
Monster Loot ──► Player Inventory ──► Equipped / Marketplace / Disassembly
Quest Rewards ──►                 ──►
Future Crafting ──►               ──►
```

Distribution to monsters/quests will be designed separately once items exist in the database.

---

## Code Changes Required

None — entities only.

All item categories (`weapon`, `helmet`, `chestplate`, `boots`, `shield`, `greaves`, `bracer`) already exist in the DB CHECK constraint. All weapon subtypes (`one_handed`, `two_handed`, `dagger`, `wand`, `staff`, `bow`) already exist. The `crit_chance`, `armor_penetration`, `additional_attacks`, `max_mana`, and `mana_regen` columns exist on `item_definitions` (migrations 018 + 037). The admin API and frontend already support these fields via the 033-weapon-attributes feature branch.

---

## Execution Plan

All content is created via the `game-entities` skill (admin REST API). No dependencies between items, so order doesn't matter, but we group by type for clarity.

### Phase 1 — All 66 Items

1. **Create 6 one-handed swords** — weapon_subtype: one_handed, ATK only
2. **Create 6 two-handed weapons** — weapon_subtype: two_handed, ATK only
3. **Create 6 daggers** — weapon_subtype: dagger, ATK + crit_chance
4. **Create 6 staves** — weapon_subtype: staff, ATK + armor_penetration
5. **Create 6 bows** — weapon_subtype: bow, ATK + additional_attacks
6. **Create 6 wands** — weapon_subtype: wand, ATK + max_mana + mana_regen
7. **Create 6 Set 1 armor pieces** — Starter tier (helmet, chestplate, boots, shield, greaves, bracer)
8. **Create 6 Set 2 armor pieces** — Padded tier
9. **Create 6 Set 3 armor pieces** — Iron tier
10. **Create 6 Set 4 armor pieces** — Steel tier
11. **Create 6 Set 5 armor pieces** — Knight tier

### Phase 2 — Distribution (deferred)

- Assign items to monster loot tables (tier-appropriate)
- Add items as quest rewards
- Create crafting recipes for higher-tier items
- Set marketplace pricing defaults
- Configure disassembly recipes

---

## Testing Walkthrough

### Test 1: Equip a One-Handed Sword + Shield

1. **Grant Rusty Iron Sword to character** — appears in inventory
2. **Equip it** — weapon slot shows sword, ATK increases by 10
3. **Grant Board Shield** — appears in inventory
4. **Equip shield** — shield slot shows, DEF increases by 6
5. **Check stats panel** — ATK and DEF reflect both equipped items

### Test 2: Equip a Dagger — Verify Crit Chance

1. **Grant Stiletto Knife to character** — appears in inventory
2. **Equip it** — weapon slot shows dagger, ATK +13, crit chance +10%
3. **Check stats panel** — crit chance shows 10% from gear
4. **Enter combat** — crits should occur roughly 10% of the time

### Test 3: Equip a Staff — Verify Armor Penetration

1. **Grant Ironbound Quarterstaff** — equip it
2. **Check stats panel** — armor penetration shows 5%
3. **Fight a monster with known DEF** — effective DEF should be reduced by 5%

### Test 4: Equip a Bow — Verify Additional Attacks

1. **Grant Short Hunting Bow** — equip it
2. **Enter combat** — 2 bonus hits should occur before the first normal round
3. **Verify bonus hits deal normal (non-crit) damage**

### Test 5: Equip a Wand — Verify Mana Stats

1. **Grant Amethyst Focus Wand** — equip it
2. **Check stats panel** — ATK +15, max mana +12, mana regen +3
3. **Enter combat with abilities** — mana pool should be larger and regen each turn
4. **Swap to Rusty Iron Sword** — mana bonuses disappear, ATK increases to 10 (lower tier but no mana)
5. **Re-equip wand + Board Shield** — both slot correctly (wand is one-handed)

### Test 6: Full Armor Set Equip

1. **Grant all 6 Set 3 (Iron) pieces** — equip each to appropriate slot
2. **Check stats panel** — total DEF should be 57 (7+13+6+15+8+8)
3. **Unequip shield, equip two-handed weapon** — shield slot clears, DEF drops by 15

---

## Verification Checklist

- [ ] All 36 weapons created with correct ATK, crit_chance, armor_penetration, additional_attacks, max_mana, mana_regen
- [ ] All 30 armor pieces created with correct DEF and category
- [ ] Weapon subtypes display correctly in inventory/equipment UI
- [ ] One-handed/dagger/staff/wand allow shield; two-handed/bow do not
- [ ] Crit chance, armor penetration, additional attacks, max mana, mana regen show in stats panel
- [ ] Wand mana_regen and max_mana apply correctly in combat
- [ ] No name collisions with existing items
- [ ] Items appear in admin panel item list with correct stats
