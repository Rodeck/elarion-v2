# Feature Specification: NPC System

**Feature Branch**: `014-npc-system`
**Created**: 2026-03-09
**Status**: Draft
**Input**: User description: "Let's create NPC system. Admin can create NPC in admin panel in new panel. Admin can specify NPC name, description and either upload icon or generate with AI. Once npc created, from map editing in building menu, admin can assign npc to a building. When player visits a building where is at least one npc, separate section in building menu is displayed with title: You can find here: and list of npc icon and name. User can then click on npc wich will open dialog options with given npc which is out of the scope of current task."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Admin Creates an NPC (Priority: P1)

An administrator opens the NPC management panel in the admin area. They fill in the NPC's name and description, then either upload a custom icon image or trigger AI generation to produce one. Once satisfied, they save the NPC, which becomes available for placement throughout the game world.

**Why this priority**: Creating NPCs is the foundational action — without it, no NPC can be assigned to buildings or seen by players. All other stories depend on this one.

**Independent Test**: Can be fully tested by creating an NPC with both icon methods and verifying the NPC appears in the NPC list, delivering a functional NPC management panel.

**Acceptance Scenarios**:

1. **Given** the admin is on the NPC management panel, **When** they enter a name, description, upload an icon, and save, **Then** the NPC appears in the NPC list with the correct name, description, and uploaded icon.
2. **Given** the admin is on the NPC management panel, **When** they enter a name, description, and use AI generation to produce an icon, **Then** an icon is generated and displayed for preview, and upon saving the NPC appears in the NPC list.
3. **Given** the admin attempts to save an NPC without a name, **When** they submit the form, **Then** the system shows a validation error and does not create the NPC.
4. **Given** an NPC exists in the list, **When** the admin edits its name or description and saves, **Then** the updated information is reflected immediately.
5. **Given** an NPC exists in the list, **When** the admin deletes it, **Then** it is removed from the NPC list and from any building assignments.

---

### User Story 2 - Admin Assigns NPCs to a Building (Priority: P2)

While editing the game map, an administrator opens the building configuration menu for a specific building. They see an NPC assignment section where they can add one or more NPCs from the existing NPC list to that building. They can also remove previously assigned NPCs.

**Why this priority**: Assignment is what connects created NPCs to the game world. Without it, players cannot encounter NPCs in buildings.

**Independent Test**: Can be fully tested by assigning an NPC to a building in the map editor and verifying the assignment is saved and reflects in the building's NPC list.

**Acceptance Scenarios**:

1. **Given** the admin opens a building's menu in the map editor and at least one NPC exists, **When** they assign an NPC to the building and save, **Then** the NPC is associated with that building.
2. **Given** an NPC is already assigned to a building, **When** the admin opens that building's menu, **Then** the assigned NPC is shown as already selected.
3. **Given** an NPC is assigned to a building, **When** the admin removes the assignment and saves, **Then** the NPC no longer appears in that building's configuration.
4. **Given** no NPCs have been created yet, **When** the admin opens a building's NPC assignment section, **Then** a message indicates no NPCs are available and prompts the admin to create one first.

---

### User Story 3 - Player Sees NPCs in a Building (Priority: P3)

When a player visits a building that has at least one assigned NPC, the building's interaction menu displays a dedicated section titled "You can find here:" followed by a list showing each NPC's icon and name. Buildings without NPCs show no such section. The NPC list items are interactive (clickable) but the dialog interaction itself is out of scope for this feature.

**Why this priority**: This is the player-facing deliverable — it is the visible outcome of the admin's work and validates the full feature end-to-end.

**Independent Test**: Can be fully tested by visiting a building with assigned NPCs and confirming the "You can find here:" section appears with correct NPC data, while a building without NPCs shows no such section.

**Acceptance Scenarios**:

1. **Given** a player visits a building with one or more assigned NPCs, **When** the building menu opens, **Then** a section titled "You can find here:" is displayed listing each NPC's icon and name.
2. **Given** a player visits a building with no assigned NPCs, **When** the building menu opens, **Then** no "You can find here:" section is shown.
3. **Given** a building has multiple NPCs assigned, **When** the player views the building menu, **Then** all assigned NPCs are listed with their individual icons and names.
4. **Given** the NPC section is visible, **When** the player clicks on an NPC entry, **Then** the UI acknowledges the click (e.g., visual feedback) — the actual dialog is out of scope and may show a placeholder.

---

### Edge Cases

- What happens when an NPC is deleted while it is still assigned to one or more buildings? The NPC must be automatically removed from all building assignments, and those buildings must no longer display it.
- What happens when AI icon generation fails (e.g., service unavailable)? The admin receives a clear error message and can retry or upload a manual icon instead.
- What happens when an uploaded icon file is invalid format or too large? The system rejects it with a descriptive error message before saving.
- What happens when a building has NPCs assigned but the player has not yet loaded updated building data? The player sees the most recent server-provided NPC list upon opening the building menu.
- What happens if an admin tries to assign the same NPC to the same building twice? The system prevents duplicates and shows a notice that the NPC is already assigned.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a dedicated NPC management panel in the admin area where admins can create, view, edit, and delete NPCs.
- **FR-002**: Each NPC MUST have a name (required), a description (required), and an icon (required — either uploaded or AI-generated).
- **FR-003**: Admins MUST be able to upload a custom image as the NPC icon during creation or editing.
- **FR-004**: Admins MUST be able to trigger AI-based icon generation during NPC creation or editing, with a preview shown before saving.
- **FR-005**: System MUST validate that NPC name is non-empty before allowing save; descriptive validation errors must be displayed.
- **FR-006**: Admins MUST be able to assign one or more NPCs to a building from within the building configuration menu in the map editor.
- **FR-007**: Admins MUST be able to remove NPC assignments from a building in the map editor.
- **FR-008**: System MUST prevent assigning the same NPC to the same building more than once.
- **FR-009**: When an NPC is deleted, the system MUST automatically remove its assignment from all buildings.
- **FR-010**: When a player opens a building menu for a building that has at least one assigned NPC, the menu MUST display a section titled "You can find here:" listing each NPC's icon and name.
- **FR-011**: Buildings with no assigned NPCs MUST NOT display the "You can find here:" section in the player-facing menu.
- **FR-012**: Each NPC entry in the player-facing building menu MUST be visually interactive (clickable), with click handling prepared as a stub for future dialog integration.

### Key Entities

- **NPC**: Represents a non-player character with a name, description, and icon. Can be assigned to multiple buildings. Managed exclusively by admins.
- **Building**: An existing game entity. Extended to support a list of zero or more assigned NPCs.
- **NPC–Building Assignment**: A relationship linking a specific NPC to a specific building. A building can have many NPCs; an NPC can appear in many buildings.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Admins can create a fully configured NPC (name, description, icon) in under 2 minutes, including AI icon generation wait time.
- **SC-002**: All NPC changes (create, edit, delete, assign, unassign) are reflected in the game world within 5 seconds without requiring a page or game reload.
- **SC-003**: Players visiting a building with assigned NPCs see the "You can find here:" section 100% of the time when the building has NPCs and 0% of the time when it does not.
- **SC-004**: Deleting an NPC removes it from all building views — no building should display a deleted NPC after the next building menu open.
- **SC-005**: 100% of NPC icon upload attempts with invalid format or oversized files are rejected with a user-visible error before any data is saved.

## Assumptions

- The AI icon generation capability leverages the existing infrastructure introduced in feature `010-ai-image-gen`; no new AI provider integration is needed.
- An NPC can be assigned to multiple buildings simultaneously (many-to-many relationship).
- NPC icons are stored and served the same way as other icon assets in the project (same directory conventions and serving mechanism).
- Only authenticated administrators can access the NPC management panel and building assignment functionality — regular players have no admin access.
- The player-facing NPC list is read-only in this feature; clicking an NPC will not open a dialog (a stub interaction is sufficient for now).
- NPC descriptions are not displayed in the player-facing building menu in this feature — only the icon and name are shown.
- The map editor's building configuration menu already exists; this feature extends it with an NPC assignment section without redesigning existing functionality.

## Out of Scope

- NPC dialog system (conversation options, branching dialogue, quest triggers).
- NPC behavior, pathfinding, or movement within the game world.
- Player-facing NPC detail page or full profile view.
- NPC categories, tags, or filtering in the admin panel.
- Role-based NPC access (e.g., NPCs visible only to specific player classes or levels).
