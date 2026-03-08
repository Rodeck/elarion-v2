# Feature Specification: AI Image Generation

**Feature Branch**: `010-ai-image-gen`
**Created**: 2026-03-08
**Status**: Draft
**Input**: User description: "Let's introduce feature to automatically generate required images using LLM via OpenRouter. Admin panel for prompt management with placeholders. Generate with AI button in item/monster creation. Admin config page for system settings including model selection."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Manage Image Generation Prompts (Priority: P1)

An admin navigates to the new "Image Prompts" section in the admin panel. They can view all existing prompts, create new ones with a name and template text containing placeholders (e.g., `<ITEM_NAME>`, `<MONSTER_NAME>`), edit existing prompts, and delete ones no longer needed. Prompts are saved in the database and persist across sessions.

**Why this priority**: Prompts are the foundation of the entire feature — no image generation is possible without prompt templates. This must exist before any other story.

**Independent Test**: Can be fully tested by navigating to the prompt management page and performing CRUD operations; delivers a working prompt library even before AI generation is wired up.

**Acceptance Scenarios**:

1. **Given** the admin is on the Image Prompts page, **When** they click "New Prompt", fill in a name and template text, and save, **Then** the new prompt appears in the list and persists after page refresh.
2. **Given** an existing prompt, **When** the admin edits the template text and saves, **Then** the updated text is reflected immediately and stored.
3. **Given** an existing prompt, **When** the admin deletes it, **Then** it is removed from the list and no longer available for selection.
4. **Given** a prompt template with placeholders like `<ITEM_NAME>`, **When** the admin saves it, **Then** the placeholder syntax is preserved exactly as entered.

---

### User Story 2 - Generate Item Image with AI (Priority: P2)

When an admin is creating or editing an item, instead of (or in addition to) uploading an image from their PC, they see a "Generate with AI" button. They select a prompt template from the saved prompts, review the prompt with the item name already injected in place of the placeholder, then trigger generation. The returned image is previewed and can be accepted as the item's image.

**Why this priority**: This is the primary user-facing value of the feature — reducing manual image sourcing for items, which are the most common entity needing images.

**Independent Test**: Can be fully tested by creating a test item and using the Generate with AI flow end-to-end; delivers value independently of monster image generation.

**Acceptance Scenarios**:

1. **Given** an admin is on the item creation/edit form, **When** they click "Generate with AI", **Then** a prompt selection UI appears showing saved prompts.
2. **Given** the admin selects a prompt template, **When** the item name is already filled in, **Then** the prompt preview shows the item name substituted for the placeholder.
3. **Given** the admin triggers generation, **When** the request succeeds, **Then** a preview of the generated image is displayed and the admin can accept it as the item image.
4. **Given** the admin accepts the generated image, **When** they save the item, **Then** the item is saved with the AI-generated image, identical in behavior to an uploaded image.
5. **Given** the generation request fails (e.g., API error, timeout), **When** the error occurs, **Then** the admin sees a clear error message and can retry or fall back to manual upload.

---

### User Story 3 - Generate Monster Image with AI (Priority: P3)

Same AI generation flow as items, applied to monster creation/editing. The admin can select a prompt (typically one designed for monsters, with `<MONSTER_NAME>` placeholder), trigger generation, preview, and accept the image.

**Why this priority**: Extends the same capability to monsters; lower priority than items since the mechanism is identical and items are typically created more frequently.

**Independent Test**: Can be tested independently by navigating to monster creation and using the Generate with AI flow.

**Acceptance Scenarios**:

1. **Given** an admin is on the monster creation/edit form, **When** they click "Generate with AI", **Then** the same prompt selection and generation flow works as for items.
2. **Given** a prompt with `<MONSTER_NAME>` placeholder, **When** the monster name is entered and the prompt is selected, **Then** the preview shows the monster name injected correctly.

---

### User Story 4 - Configure System Settings (Priority: P2)

An admin navigates to a new "Admin Config" page. They can view and update system-wide settings. The primary setting is the AI image generation model — a dropdown lists all available OpenRouter image models. The selected model is saved to the database and used for all subsequent image generation calls. If no configuration has been set, a sensible default model is used automatically.

**Why this priority**: Without model selection, all users share a hardcoded default, which may not be desirable. Config should be available alongside image generation so admins can tune behavior.

**Independent Test**: Can be tested independently by navigating to the Admin Config page, changing the model selection, saving, and verifying the setting persists after refresh.

**Acceptance Scenarios**:

1. **Given** a fresh installation with no config records, **When** an admin opens the Admin Config page, **Then** the model selector shows a default value pre-selected (no manual seeding required).
2. **Given** the admin selects a different model from the dropdown and saves, **Then** the new selection persists after page refresh.
3. **Given** the config is saved with a specific model, **When** the admin subsequently generates an image, **Then** that model is used for the generation request.
4. **Given** the available model list, **When** the admin opens the dropdown, **Then** all supported OpenRouter image models are listed: `google/gemini-2.5-flash-image`, `google/gemini-3-pro-image-preview`, `google/gemini-3.1-flash-image-preview`, `openai/gpt-5-image-mini`, `openai/gpt-5-image`, `google/gemini-2.5-flash-image-preview`.

---

### Edge Cases

- What happens when the OpenRouter API key is not configured or is invalid? The admin sees an actionable error message; no partial/corrupted image data is stored.
- What happens if image generation returns an empty or malformed response? The admin is notified, the item/monster form is not submitted with a broken image.
- What happens when a placeholder in the prompt does not match any available context variable (e.g., `<UNKNOWN>` in an item form)? The placeholder is left unreplaced and the admin can see the issue in the prompt preview before triggering generation.
- What happens if a prompt is deleted that is referenced by a generation in progress? The generation completes using the resolved prompt text already sent; deletion only prevents future use.
- What happens when the item/monster name field is empty when the admin tries to generate an image? The Generate with AI button is disabled or the admin sees a validation message requiring the name first.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a dedicated admin page for managing image generation prompt templates (create, read, update, delete).
- **FR-002**: Each prompt template MUST have a name (human-readable identifier) and a body (template string with optional placeholders such as `<ITEM_NAME>`, `<MONSTER_NAME>`).
- **FR-003**: Prompt templates MUST be stored in the database and retrievable across sessions.
- **FR-004**: The item creation/editing form MUST include a "Generate with AI" button alongside the existing image upload option.
- **FR-005**: The monster creation/editing form MUST include a "Generate with AI" button alongside the existing image upload option.
- **FR-006**: When the admin clicks "Generate with AI", the system MUST present the list of saved prompt templates for selection.
- **FR-007**: Upon prompt selection, the system MUST display a preview of the resolved prompt with entity-specific placeholders replaced by the current form values (e.g., item name substituted for `<ITEM_NAME>`).
- **FR-008**: The system MUST send the resolved prompt to the OpenRouter image generation API and return the resulting image.
- **FR-009**: The generated image MUST be previewed to the admin before being committed to the entity record.
- **FR-010**: The admin MUST be able to accept the generated image (saving it to the entity) or discard it and return to manual upload.
- **FR-011**: System MUST provide an Admin Config page for system-wide settings.
- **FR-012**: The Admin Config page MUST include a model selector for AI image generation, listing all supported OpenRouter image models.
- **FR-013**: The selected model MUST be persisted in the database and used for all image generation requests.
- **FR-014**: System MUST have a default model value that applies automatically when no configuration record exists, requiring no manual database seeding.
- **FR-015**: All image generation requests MUST go through OpenRouter (no other image generation provider).
- **FR-016**: System MUST handle generation failures gracefully, displaying a user-friendly error message and allowing retry or fallback to manual upload.
- **FR-017**: The "Generate with AI" button MUST be disabled (or show a validation warning) when the entity name field is empty, as the name is required to resolve placeholders.

### Key Entities *(include if feature involves data)*

- **ImagePromptTemplate**: A reusable prompt with a unique name and a body string containing zero or more placeholders (e.g., `<ITEM_NAME>`). Stored in the database; managed via the admin prompt page.
- **AdminConfig**: A key-value store for system-wide settings. The image generation model is one such key. Defaults are code-defined and do not require database records to function.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Admins can create, update, and delete prompt templates in under 30 seconds per operation without assistance.
- **SC-002**: An admin can generate and apply an AI image to a new item from start to finish in under 2 minutes (excluding API response time).
- **SC-003**: Image generation works correctly for all listed OpenRouter image models without code changes when the admin switches models.
- **SC-004**: A fresh installation (empty database, no seeding) correctly uses the default image generation model without errors.
- **SC-005**: Generation failures surface a clear, actionable error message to the admin 100% of the time — no silent failures.
- **SC-006**: Generated images are visually equivalent in quality and usability to manually uploaded images within the admin panel.
- **SC-007**: The same prompt template can be reused across multiple item/monster creation sessions without degradation or data loss.

## Assumptions

- The admin frontend is an existing Express/Vite application; new pages follow its established navigation and styling patterns.
- OpenRouter API key is provided via environment variable and is not managed through the Admin Config UI (out of scope for this feature).
- "Accepting" a generated image saves it using the same storage mechanism as a manually uploaded image (no separate storage path needed).
- Placeholder syntax uses angle-bracket format: `<PLACEHOLDER_NAME>`. Only exact matches are substituted; case-sensitive.
- The initial set of supported entity types for AI generation is items and monsters; future entities (e.g., buildings, NPCs) will follow the same pattern but are out of scope.
- Performance of the OpenRouter API itself (latency, rate limits) is outside the system's control; the UI should indicate loading state during generation.
