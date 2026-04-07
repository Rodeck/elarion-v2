# Research: Energy & Movement Speed System

**Branch**: `038-energy-system` | **Date**: 2026-04-07

## Decisions

### 1. Energy Storage — Database Column Type

**Decision**: Use `SMALLINT` for `current_energy`, `max_energy`, and `movement_speed` on the `characters` table.
**Rationale**: Matches existing pattern for character stats (`max_hp`, `current_hp`, `attack_power`, `defence`, all attribute columns). SMALLINT range (-32768 to 32767) is more than sufficient for energy cap of 1000 and movement speed of 100.
**Alternatives considered**: INTEGER (unnecessary range, wastes storage), NUMERIC (overhead for exact precision not needed for integer values).

### 2. Energy Regen Architecture — Separate Service vs Extending HP Regen

**Decision**: Create a separate `energy-regen-service.ts` alongside `hp-regen-service.ts`.
**Rationale**: HP regen and energy regen have different default intervals, different config keys, different SQL queries, and different WS message types. Merging them into one service adds coupling without benefit. Separate services can have independent tick intervals controlled by admin config.
**Alternatives considered**: Combined `regen-service.ts` with both HP and energy in one tick (rejected: different intervals needed, harder to configure independently).

### 3. Admin Config Storage — Existing Key-Value Store vs New Table

**Decision**: Extend existing `admin_config` key-value store with 4 new keys.
**Rationale**: The existing `CONFIG_DEFAULTS` pattern in `admin-config.ts` is exactly designed for this. Adding keys is trivial. The fatigue system used a dedicated table because it had per-combat-type rows — energy/HP regen config is global (one value each), fitting the key-value pattern perfectly.
**Alternatives considered**: Dedicated `regen_config` table (rejected: overkill for 4 scalar values, breaks consistency with existing admin config pattern).

### 4. Item Consumption Handler — New File vs Extending Existing

**Decision**: Create new `backend/src/game/inventory/inventory-use-handler.ts`.
**Rationale**: No existing handler for item use exists. The `inventory.delete_item` handler in the inventory module is for discarding items, not using them. A new handler keeps concerns separated. The `inventory/` directory path groups it with related inventory operations.
**Alternatives considered**: Adding to `building-action-handler.ts` (rejected: item use is not a building action), adding to a generic `game-handler.ts` (rejected: no such file exists, would be a grab-bag).

### 5. Gathering Energy Deduction — Per-Tick vs Upfront

**Decision**: Per-tick deduction (every 2-second gathering tick).
**Rationale**: The spec requires "energy per second" configurable per gathering action. The gathering system already runs a 2-second tick interval. Deducting `energy_per_second * 2` per tick aligns naturally. This also enables the "end gathering when energy runs out" behavior without calculating upfront whether the player has enough energy for the full duration.
**Alternatives considered**: Upfront flat cost (rejected: doesn't match spec's per-second requirement, can't end mid-session on depletion), per-second with separate timer (rejected: unnecessary complexity, gathering already has a tick).

### 6. Movement Speed Formula

**Decision**: `effectiveDelay = baseDelay * (100 / effectiveSpeed)` where `effectiveSpeed = energy > 0 ? movementSpeed : movementSpeed * 0.5`.
**Rationale**: At base speed 100, delay = 300ms (unchanged). At speed 200, delay = 150ms (twice as fast). At speed 50 (depleted), delay = 600ms (half speed). Linear scaling is intuitive and easy to balance.
**Alternatives considered**: Logarithmic scaling (rejected: harder to reason about for game balance), percentage reduction (rejected: same result as linear with more complex implementation).

### 7. Death Energy Penalty — Implementation Location

**Decision**: Add energy halving in three locations: `combat-session.ts` (monster combat), `boss-combat-handler.ts` (boss combat), and `gathering-service.ts` (gathering death from accidents/monsters).
**Rationale**: Death is handled separately in each combat context. There is no centralized "character died" function. Each location already has a `current_hp = 0` check and DB update. Adding `current_energy = FLOOR(current_energy / 2)` to the same UPDATE query is minimal.
**Alternatives considered**: Centralized death handler (rejected: would require refactoring three existing systems, violates YAGNI for this feature).

### 8. HP Regen Configurability — Retrofit Approach

**Decision**: Modify `hp-regen-service.ts` to read interval and percentage from `admin_config` on each tick (with fallback to current hardcoded defaults).
**Rationale**: The spec requires making HP regen configurable via admin panel. Reading config per-tick is cheap (one DB query) and ensures changes take effect without restart. The current hardcoded `REGEN_INTERVAL_MS = 10 * 60 * 1000` and `0.10` percentage become fallback defaults.
**Alternatives considered**: Restart-required config (rejected: spec explicitly says "without server restart"), in-memory cache with refresh interval (rejected: premature optimization, admin config reads are fast).

### 9. Energy Cost for City Movement — Per-Step Deduction

**Decision**: Deduct 2 energy per node step during city movement, checked and applied on each `setTimeout` callback in the path walk loop.
**Rationale**: The spec says "moving between node A and adjacent consumes 2 energy" and "traveling through 10 nodes consumes 20 energy". Per-step deduction in `city-movement-handler.ts`'s step loop naturally handles this. When energy hits 0 mid-path, the remaining steps switch to penalized speed (not cancelled).
**Alternatives considered**: Upfront deduction for entire path (rejected: can't apply speed penalty mid-path), deduction only on path start (rejected: doesn't match per-node cost spec).

### 10. Frontend Energy Bar — Color and Position

**Decision**: Energy bar uses a distinct color (blue/cyan) from HP (red/green), positioned below the HP bar in collapsed mode.
**Rationale**: Energy and HP are both vital resources but serve different purposes. Distinct colors prevent confusion. Collapsed StatsBar already shows an HP bar; adding a second bar below follows the same rendering pattern.
**Alternatives considered**: Shared bar with segmented display (rejected: confusing UX), energy as numeric-only display (rejected: spec requires "energy bar").
