# Feature Specification: Sprite Animation System

**Feature Branch**: `004-sprite-animation`
**Created**: 2026-03-03
**Status**: Draft
**Input**: User description: "Let's introduce animation system. It should use png sprites, example can be located here: C:\Users\pajak\Downloads\Medieval_knight it has metadata json, animations with 8 different directions. Animations mechanism should be flexible to be later applied to monsters, npcs etc. In mvp i want to have player character to play idle animation, and be rotated based on direction of the movement (movement animations to be added later)"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Player Character Plays Idle Animation (Priority: P1)

When a player loads into the game world, their character is visible on screen playing a smooth looping idle animation (breathing/standing). The animation gives the character life and presence rather than displaying a static image. The character always faces the direction they last moved.

**Why this priority**: This is the MVP deliverable — it proves the animation system works end-to-end and gives visual feedback that the character is alive. All subsequent animation work (walking, attacking) builds on this foundation.

**Independent Test**: Launch the game, log in, enter the world — the player character visually breathes/idles with a looping animation. No code changes needed for the other stories to observe this.

**Acceptance Scenarios**:

1. **Given** the player is in the game world and not moving, **When** the scene loads, **Then** the player character displays a multi-frame idle animation that loops continuously
2. **Given** the idle animation is running, **When** a full animation cycle completes, **Then** the animation seamlessly loops back to the first frame without a visible jump or flicker
3. **Given** the player loads in for the first time, **When** no movement has occurred yet, **Then** the character faces a default direction (south/toward viewer)

---

### User Story 2 - Character Faces Direction of Movement (Priority: P2)

When the player moves in any of the 8 compass directions (N, NE, E, SE, S, SW, W, NW), the character sprite rotates to face that direction. When the player stops moving, the character continues to face the last direction they were moving. The idle animation plays in the correct directional variant.

**Why this priority**: Direction-facing is essential for spatial awareness in a top-down game. Without it, the character looks disconnected from player input.

**Independent Test**: Move the player character in each of the 8 directions and observe that the displayed sprite correctly shows the character facing that direction while playing the idle animation.

**Acceptance Scenarios**:

1. **Given** the player is moving east, **When** they stop, **Then** the character faces east and plays the east-facing idle animation
2. **Given** the player was facing south, **When** they move northwest, **Then** the character sprite updates to face northwest
3. **Given** the player moves in all 8 diagonal and cardinal directions sequentially, **Then** the character displays the correct directional sprite for each direction
4. **Given** a direction that shares its sprite with another direction via mirroring (e.g. north-east mirrored from north-west), **When** moving in that direction, **Then** the character still visually faces the correct way without obvious distortion

---

### User Story 3 - Animation System Supports Multiple Character Types (Priority: P3)

The animation system is structured so that any game entity (monster, NPC, second player character) can be given the same animation capabilities as the player character without duplicating animation logic. Adding a new animated character type requires only providing a compatible sprite package (metadata JSON + PNG files), not rewriting animation code.

**Why this priority**: Foundational architecture concern — doing it right now avoids expensive refactors when monsters and NPCs are added. However, no monster/NPC implementation is needed in this MVP.

**Independent Test**: Verify the system design supports passing different sprite metadata to create independently animated entities. Can be validated by creating a second animated entity (even a test/debug instance of the same knight sprite) alongside the player.

**Acceptance Scenarios**:

1. **Given** a second character entity is created with its own sprite metadata, **When** both characters are on screen, **Then** each independently plays its own animation without interference
2. **Given** a new character type's sprite package follows the same metadata format, **When** it is registered with the animation system, **Then** it animates correctly without changes to the core animation logic

---

### Edge Cases

- What happens when an animation direction is missing from the sprite package (e.g., only 4 of 8 directions have animation frames)? → System mirrors/flips the available frames to cover the missing directions
- What happens if the sprite metadata JSON is missing or malformed? → Character falls back to a static placeholder or logs an error without crashing the game
- What happens if the player moves diagonally but no diagonal animation exists? → The nearest available directional animation is used
- What happens when the player moves between two directions very quickly? → The sprite updates to the latest direction without queuing intermediate frames

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST load sprite animations from a metadata JSON file that describes available animations, directions, and frame paths
- **FR-002**: The system MUST support at least 8 movement directions (N, NE, E, SE, S, SW, W, NW) for sprite orientation
- **FR-003**: The player character MUST display a looping idle animation when stationary
- **FR-004**: The player character MUST face the direction of their most recent movement input
- **FR-005**: The system MUST select the correct directional variant of an animation based on the current facing direction
- **FR-006**: When a sprite package does not provide frames for all 8 directions, the system MUST derive the missing directions by horizontally mirroring the closest available directional frames
- **FR-007**: The animation system MUST be reusable — any game entity (monster, NPC, remote player) MUST be able to use it by supplying a compatible sprite metadata package
- **FR-008**: The system MUST NOT require changes to core animation logic when adding a new character type with the same sprite format
- **FR-009**: Each entity instance MUST maintain its own independent animation state (current animation, current frame, facing direction)

### Key Entities

- **Sprite Package**: A character's complete visual asset set — metadata JSON describing character dimensions, available animations, directions count, and paths to all frame images
- **Animation Definition**: A named set of frame sequences keyed by direction (e.g., "breathing-idle" → { south: [frame0, frame1, ...], east: [...] })
- **Animated Entity**: Any game character (player, monster, NPC) that uses the animation system, each holding its own animation state
- **Animation State**: Per-entity runtime data — which animation is active, which direction it faces, which frame is currently displayed, and frame timing

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The player character's idle animation is visible and smoothly looping within 2 seconds of entering the game world
- **SC-002**: Direction changes are visually reflected within one animation frame update (no lag between input direction change and sprite update)
- **SC-003**: All 8 facing directions produce a correctly oriented character sprite with no visual artifacts
- **SC-004**: A second independent animated entity can be added to the scene with a different or the same sprite package, and both animate without interfering with each other
- **SC-005**: Adding a new character type using the same metadata format requires zero changes to the core animation system code

## Assumptions

- The sprite package format described in `C:\Users\pajak\Downloads\Medieval_knight` (64×64 PNG frames, metadata.json, `animations/<name>/<direction>/frame_NNN.png` structure) is the canonical format all characters will use
- The breathing-idle animation (the only animation in the sample package) provides frames for 4 of 8 directions; the system mirrors frames for the remaining 4 directions
- Movement animations (walk, run) are explicitly out of scope for this MVP — the idle animation plays even while the player is moving; direction-facing is achieved by switching the idle directional variant
- The 8 directions use compass names: south, south-east, east, north-east, north, north-west, west, south-west
- Frame timing/playback speed defaults are acceptable to tune during implementation without revisiting this spec

## Out of Scope (MVP)

- Walk or run animations triggered by movement
- Attack, death, or any combat animations
- Animation blending or transition effects between animations
- Monster or NPC visual implementation (system must support them architecturally, but no concrete monster/NPC sprites are added)
- Animation editor or runtime configuration UI
