# Data Model: AI Image Generation (010)

**Branch**: `010-ai-image-gen` | **Date**: 2026-03-08

---

## Migration File

`backend/src/db/migrations/013_ai_image_gen.sql`

---

## New Tables

### `image_prompt_templates`

Stores reusable prompt templates for AI image generation.

```sql
CREATE TABLE image_prompt_templates (
  id          SERIAL        PRIMARY KEY,
  name        VARCHAR(128)  NOT NULL UNIQUE,
  body        TEXT          NOT NULL,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
```

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | SERIAL | PK | Auto-increment |
| `name` | VARCHAR(128) | NOT NULL, UNIQUE | Human-readable identifier shown in dropdowns |
| `body` | TEXT | NOT NULL | Template string; may contain `<PLACEHOLDER>` tokens |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | |
| `updated_at` | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | Updated by UPDATE operations |

**No foreign keys.** Prompts are independent; deleting a prompt does not affect existing items/monsters (their icons are already saved as files).

---

### `admin_config`

Key-value store for system-wide admin settings. All keys have code-defined defaults; rows are optional.

```sql
CREATE TABLE admin_config (
  key        VARCHAR(128)  PRIMARY KEY,
  value      TEXT          NOT NULL,
  updated_at TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
```

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `key` | VARCHAR(128) | PK | Config key name |
| `value` | TEXT | NOT NULL | Config value (always serialized as text) |
| `updated_at` | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | |

**Known keys**:

| Key | Code Default | Valid Values |
|-----|-------------|--------------|
| `image_gen_model` | `google/gemini-2.5-flash-image` | Any of the 6 supported model IDs |

**No seeding required.** If a key row is absent, the backend returns the code default. The Admin Config UI shows the code default as the pre-selected value on first load.

---

## Unchanged Tables

No existing tables are modified by this feature.

- `item_definitions` (`icon_filename` column): Populated identically whether the icon came from file upload or AI generation. No schema change.
- `monsters` (`icon_filename` column): Same as above.

---

## Query Files (new)

| File | Purpose |
|------|---------|
| `backend/src/db/queries/image-prompts.ts` | CRUD queries for `image_prompt_templates` |
| `backend/src/db/queries/admin-config.ts` | Get/upsert queries for `admin_config` |

### `image-prompts.ts` interface

```typescript
export interface ImagePromptTemplate {
  id: number;
  name: string;
  body: string;
  created_at: Date;
  updated_at: Date;
}

export function getAllPrompts(): Promise<ImagePromptTemplate[]>
export function getPromptById(id: number): Promise<ImagePromptTemplate | null>
export function createPrompt(data: { name: string; body: string }): Promise<ImagePromptTemplate>
export function updatePrompt(id: number, data: { name?: string; body?: string }): Promise<ImagePromptTemplate | null>
export function deletePrompt(id: number): Promise<boolean>
```

### `admin-config.ts` interface

```typescript
// Code-defined defaults — no DB rows required
export const CONFIG_DEFAULTS: Record<string, string> = {
  image_gen_model: 'google/gemini-2.5-flash-image',
};

export const VALID_IMAGE_GEN_MODELS = [
  'google/gemini-2.5-flash-image',
  'google/gemini-2.5-flash-image-preview',
  'google/gemini-3-pro-image-preview',
  'google/gemini-3.1-flash-image-preview',
  'openai/gpt-5-image-mini',
  'openai/gpt-5-image',
] as const;

export function getConfigValue(key: string): Promise<string>  // returns DB value or code default
export function upsertConfigValue(key: string, value: string): Promise<void>
export function getAllConfig(): Promise<Record<string, string>>  // merges DB rows with defaults
```

---

## File Storage (unchanged from existing pattern)

AI-generated images are saved to the same directories as manually uploaded icons:

| Entity | Directory | Served at |
|--------|-----------|-----------|
| Items | `backend/assets/items/icons/<uuid>.png` | `/item-icons/<uuid>.png` |
| Monsters | `backend/assets/monsters/icons/<uuid>.png` | `/monster-icons/<uuid>.png` |

The `icon_filename` column in `item_definitions` / `monsters` stores only the filename (e.g., `abc123.png`), not the full path. This is the existing convention.
