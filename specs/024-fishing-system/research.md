# Research: Fishing System

**Feature**: 024-fishing-system | **Date**: 2026-03-26

## Decision 1: Fishing as a New Action Type (Not Gathering)

**Decision**: Fishing is a new `building_action` type (`'fishing'`) with its own handler and session manager, NOT an extension of the existing gathering system.

**Rationale**: The gathering system is tick-based (2-second intervals, passive, time-limited). Fishing requires active player input (tension meter mini-game with real-time reaction). The interaction models are incompatible — shoehorning fishing into gathering would require extensive modifications to the tick-based event loop and break the gathering service's clean abstraction.

**Alternatives considered**:
- Reuse gathering service with custom event type → Rejected: gathering ticks fire automatically; fishing needs player-driven input events. Would require adding conditional branching throughout the tick loop.
- New action type on existing building_action infrastructure → **Chosen**: building_action already supports multiple types via CHECK constraint and handler dispatch. Adding `'fishing'` follows the same pattern as `'gather'`, `'explore'`, `'marketplace'`.

## Decision 2: Mini-Game Protocol — Batch Validation

**Decision**: The server sends mini-game parameters (bite delay, pull pattern seed, catch window) on cast. The client runs the mini-game locally, then sends all timing data in a single `fishing.complete` message. The server validates everything at once.

**Rationale**: This avoids real-time per-input round-trips during the mini-game (latency-sensitive). The server remains authoritative — it determines the fish, the pattern, and validates all timing data. A bot would need to reverse-engineer the pattern-to-visual mapping, and the snap check catches inhuman consistency regardless.

**Alternatives considered**:
- Real-time server validation per input → Rejected: adds latency to every click, poor UX on high-ping connections, complex state machine.
- Fully client-side with result reporting → Rejected: violates server-authoritative principle; client could report fake results.

## Decision 3: Rod Upgrade Points as Character Column

**Decision**: Rod Upgrade Points are stored as an INTEGER column on the `characters` table (like `crowns`), not as an inventory item or separate table.

**Rationale**: Points are a simple accumulating currency consumed during upgrades. They don't stack, trade, or appear in inventory. A column on characters is the simplest storage that works (mirrors `crowns`).

**Alternatives considered**:
- Inventory item → Rejected: adds unnecessary inventory slots for a non-tradeable currency.
- Separate `character_currencies` table → Rejected: over-engineered for a single additional currency. Can be refactored later if more currencies emerge (YAGNI).

## Decision 4: Ring & Amulet as New Equipment Categories

**Decision**: Add `'ring'` and `'amulet'` to `ItemCategory`, `EquipSlot`, `EquipmentSlotsDto`, and the DB CHECK constraints via migration 026.

**Rationale**: The equipment system is designed for extension — adding new categories and slots follows the established pattern. The `SLOT_CATEGORY_MAP` in `equipment-handler.ts` maps slots to allowed categories, and `computeCombatStats` in `combat-stats-service.ts` already sums all equipped item stats generically. No combat engine changes needed — rings/amulets use the same stat columns (`dodge_chance`, `crit_chance`, `mana_regen`, etc.) already on `item_definitions`.

**Alternatives considered**:
- Separate accessories table → Rejected: creates unnecessary divergence from the unified equipment model.

## Decision 5: Fishing Loot Table Design

**Decision**: New `fishing_loot` table with columns: `id`, `min_rod_tier`, `item_def_id`, `drop_weight`. Loot resolution filters by `min_rod_tier <= player_rod_tier` and uses weighted random selection.

**Rationale**: Loot pools are tier-gated (concept doc specifies which items appear at each tier). Weighted random with a tier filter is simple, configurable via admin, and matches the existing `monster_loot` pattern (just with tier gating instead of monster_id).

**Alternatives considered**:
- JSONB config on building_action (like gathering events) → Rejected: fishing loot is rod-tier-dependent, not spot-dependent. Duplicating loot config across multiple fishing spots would be error-prone.
- Per-spot loot tables → Deferred: the spec allows different zones to have different loot modifiers, but the MVP uses rod tier as the primary gate. Zone modifiers can be added later with an optional `zone_id` column.

## Decision 6: Daily Quest Integration

**Decision**: Fishing daily quests use the existing quest system with `quest_type: 'daily'`. A new objective type `'catch_fish'` is added (or reuse `'collect_item'` since catching fish grants the item to inventory). Rod Upgrade Points are a new `RewardType` value `'rod_upgrade_points'`.

**Rationale**: The quest system already supports daily quests with reset_period_key, NPC quest givers, and multiple objective/reward types. Adding a new reward type follows the existing `grantQuestRewards()` pattern in `quest-service.ts`. For objectives, `'collect_item'` already works because the QuestTracker's `onInventoryChanged` checks inventory for the target item — when a fish is caught and added to inventory, quest progress updates automatically.

**Alternatives considered**:
- Custom fishing quest system → Rejected: duplicates quest infrastructure unnecessarily.
- New `'catch_fish'` objective type → Considered but deferred: `'collect_item'` already triggers on inventory changes, which covers fish catches. A dedicated type could be added later if we need to distinguish "caught via fishing" from "bought on marketplace".

## Decision 7: Anti-Bot Snap Check Implementation

**Decision**: Server-side statistical analysis of player timing data across multiple casts. Track the last N cast timing profiles per character. Flag if standard deviation of reaction times falls below a threshold (inhuman consistency).

**Rationale**: Bots produce unnaturally consistent timing. Humans have natural variance. The server already has all timing data from `fishing.complete` messages. A rolling window of recent casts provides enough data for statistical detection without storing long-term history.

**Alternatives considered**:
- Client-side CAPTCHA → Rejected: breaks immersion, poor UX.
- Rate limiting only → Insufficient: bots can fish at human speed.
- Machine learning detection → Over-engineered for initial implementation.

## Existing System Touchpoints

| System | File | Change Needed |
|--------|------|---------------|
| Equipment types | `shared/protocol/index.ts` | Add `'ring'`, `'amulet'` to ItemCategory, EquipSlot, EquipmentSlotsDto |
| Equipment handler | `backend/src/game/equipment/equipment-handler.ts` | Add ring/amulet to VALID_SLOTS and SLOT_CATEGORY_MAP |
| Equipment DB | `backend/src/db/queries/equipment.ts` | No changes — generic stat aggregation works |
| Combat stats | `backend/src/game/combat/combat-stats-service.ts` | No changes — already sums all equipped item stats |
| Building actions | DB CHECK constraint | Add `'fishing'` to action_type |
| Building action handler | `backend/src/game/world/building-action-handler.ts` | Add `'fishing'` case to dispatch |
| Tool types | DB CHECK constraint | Add `'fishing_rod'` to tool_type |
| Quest rewards | `shared/protocol/index.ts` | Add `'rod_upgrade_points'` to RewardType |
| Quest service | `backend/src/game/quest/quest-service.ts` | Add `'rod_upgrade_points'` case in grantQuestRewards() |
| Protocol types | `shared/protocol/index.ts` | Add fishing message types and DTOs |
| Item definitions | DB migration | Add new items (rods, fish, rings, amulets) |
| NPC system | DB + admin | Create Fisherman NPC with quest_giver flag |
