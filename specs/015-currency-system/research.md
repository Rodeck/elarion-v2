# Research: Currency System (Crowns)

**Feature**: 015-currency-system
**Date**: 2026-03-11

---

## Decision 1: Crown Balance Storage Location

**Decision**: Add a `crowns INTEGER NOT NULL DEFAULT 0` column directly to the `characters` table.

**Rationale**: Crown balance is a scalar property of a character (like `level`, `experience`, `current_hp`). It belongs on the `characters` table rather than a separate wallet table. The existing `updateCharacter` function uses dynamic field building, but since atomic increment (`SET crowns = crowns + $n`) is safer for concurrent loot drops, a dedicated `addCrowns` query function is introduced.

**Alternatives considered**:
- Separate `character_wallets` table: overkill for a single integer field with no historical requirement.
- Storing in a JSON metadata column: non-relational, hard to query or validate.

---

## Decision 2: Monster Crown Range Storage Location

**Decision**: Add `min_crowns INTEGER NOT NULL DEFAULT 0` and `max_crowns INTEGER NOT NULL DEFAULT 0` columns directly to the `monsters` table.

**Rationale**: Crown range is a static property of a monster type, analogous to `xp_reward`. It lives on the `monsters` table alongside the other reward fields. This keeps the existing `createMonster` / `updateMonster` / `getMonsterById` query pattern consistent.

**Alternatives considered**:
- Separate `monster_crown_config` table: unnecessary join for a simple two-integer config.
- Making it part of the loot table (like item drops): crowns are always dropped on kill (no drop_chance roll), so the loot table model doesn't fit.

---

## Decision 3: Crown Award Concurrency

**Decision**: Use a SQL atomic increment (`UPDATE characters SET crowns = crowns + $amount WHERE id = $id`) rather than read-then-write.

**Rationale**: Two combat events could resolve for the same character in the same millisecond (e.g., multi-monster night tile step in future). An atomic SQL increment prevents balance corruption without needing application-level locks. PostgreSQL row-level locking on the UPDATE ensures safety.

**Alternatives considered**:
- Read current, add, write: susceptible to read-modify-write race conditions under concurrent WS handlers.
- Application mutex: more complex, unnecessary given PostgreSQL's ACID guarantees.

---

## Decision 4: WebSocket Protocol for Crown Balance Updates

**Decision**: Two mechanisms:
1. `crowns_gained?: number` field added to `BuildingExploreResultPayload` and `NightEncounterResultPayload` — informs the UI how many Crowns were earned from this combat.
2. New server→client message `character.crowns_changed` carrying `{ crowns: number }` — sent after admin `/crown` grants to push the new authoritative balance.

**Rationale**: Follows the established pattern in the codebase: combat result messages carry deltas (`xp_gained`), while out-of-band state changes use dedicated push messages (`character.levelled_up`). This avoids a second message on every combat win while still enabling real-time admin grant updates.

**Alternatives considered**:
- Always send `character.crowns_changed` (even on combat win): would double the messages on every win. Unnecessary for combat since the result message already carries `crowns_gained`.
- Include `crowns` (absolute) in the explore/night result payload: works but is redundant given `crowns_gained`, and conflates two responsibilities.
- Client-only increment without authoritative push: violates constitution Principle II (server-authoritative). Admin grants would require the target player to reconnect to see their balance.

---

## Decision 5: Admin Command Name

**Decision**: `/crown <PlayerName> <Amount>` (not `/gold` as in the user's example).

**Rationale**: Currency name is "Crowns", not "gold". Command should match the noun. The user's example was illustrative. Pattern matches existing commands (`/level_up`, `/item`, `/clear_inventory`, `/day`, `/night`).

**Alternatives considered**:
- `/gold` — confusingly named given gold is a resource, not the currency.
- `/givecrown` — verbose; shorter is more consistent with existing admin commands.

---

## Decision 6: `CharacterData` Protocol Update

**Decision**: Add `crowns: number` to the existing `CharacterData` interface in `shared/protocol/index.ts`.

**Rationale**: `CharacterData` is sent as part of `WorldStatePayload.my_character` on login/reconnect, giving the client the initial Crown balance. Extending `CharacterData` is the least-disruptive change — no new protocol type, and the frontend already reads `CharacterData` fields to populate the StatsBar.

**Alternatives considered**:
- Sending crowns via a separate initial message: adds a second round-trip and complicates client initialization logic.
- Adding `crowns` to `WorldStatePayload` directly: inconsistent — balance is a character property, not a zone property.

---

## Decision 7: Frontend Display Location

**Decision**: Add a Crowns row to the existing `StatsBar` HTML component (`frontend/src/ui/StatsBar.ts`), displayed as a plain text stat (e.g., `CR  1,250`) in the same combat stats row area.

**Rationale**: StatsBar already handles all character stats. Adding Crowns as a stat-chip style element alongside ATK/DEF keeps the UI consistent. The existing `updateStats(attack, defence)` pattern is extended with a new `setCrowns(amount)` method.

**Alternatives considered**:
- Separate Crowns widget outside StatsBar: inconsistent with the current layout and harder to synchronize.
- Showing Crowns as a bar (like HP/XP): doesn't make sense for a currency with no max value.

---

## Decision 8: Admin Panel Integration

**Decision**: Extend the existing monster form in `admin/frontend/src/ui/monster-manager.ts` with `Min Crowns` and `Max Crowns` inputs (type=number, min=0). Extend `admin/backend/src/routes/monsters.ts` to read/write/validate the two new fields.

**Rationale**: Follows the exact pattern used for `xp_reward` in both the admin route and the monster manager UI. No new admin panel page or route needed.

**Alternatives considered**:
- Separate "loot config" endpoint for crown range: unnecessary indirection for two integer fields.

---

## Migration Number

Next migration file: `017_currency.sql` (highest existing: `016_npcs.sql`).

---

## Files to Modify Summary

| File | Change |
|------|--------|
| `backend/src/db/migrations/017_currency.sql` | New — adds `crowns` to `characters`, `min_crowns`/`max_crowns` to `monsters` |
| `backend/src/db/queries/characters.ts` | Add `crowns` field; add `addCrowns(id, amount)` function |
| `backend/src/db/queries/monsters.ts` | Add `min_crowns`, `max_crowns` fields; update create/update functions |
| `backend/src/game/currency/crown-service.ts` | New — `awardCrowns(characterId, amount)` service function |
| `backend/src/game/combat/explore-combat-service.ts` | Call `awardCrowns`; include `crowns_gained` in win payload |
| `backend/src/game/world/night-encounter-service.ts` | Same as explore-combat-service |
| `backend/src/game/admin/admin-command-handler.ts` | Add `/crown` command case |
| `shared/protocol/index.ts` | Add `crowns` to `CharacterData`; add `crowns_gained?` to explore/night result; add `CharacterCrownsChangedPayload` type |
| `frontend/src/ui/StatsBar.ts` | Add `crownsEl`; add `setCrowns(amount)` method; update constructor |
| `frontend/src/scenes/GameScene.ts` | Pass `crowns` to StatsBar on init; handle `character.crowns_changed` message |
| `admin/backend/src/routes/monsters.ts` | Read/validate/write `min_crowns`, `max_crowns` |
| `admin/frontend/src/ui/monster-manager.ts` | Add min/max crowns inputs to form; populate on edit; submit with save |
