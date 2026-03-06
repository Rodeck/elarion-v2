# Quickstart: Squire Expeditions Development

## Prerequisites

- Node.js 20 LTS, npm
- PostgreSQL 16 running locally
- All packages installed: `npm install` from repo root

## Development Workflow

### 1. Run the DB migration

After checkout, apply the new migration:

```bash
cd backend && npm run migrate
```

This creates the `squires` and `squire_expeditions` tables and extends the
`building_actions.action_type` constraint to include `'expedition'`.

### 2. Verify existing characters get squires

Existing characters in the DB will **not** have squires until a DB seed or manual
insert is run. The easiest fix during development:

```sql
INSERT INTO squires (character_id, name)
SELECT id, 'Aldric'
FROM characters
WHERE id NOT IN (SELECT character_id FROM squires);
```

New characters created after the migration will automatically receive a squire.

### 3. Start all services

```bash
# Terminal 1 — game backend
cd backend && npm run dev

# Terminal 2 — admin backend
cd admin/backend && npm run dev

# Terminal 3 — game frontend
cd frontend && npm run dev

# Terminal 4 — admin frontend
cd admin/frontend && npm run dev
```

### 4. Configure an expedition in admin

1. Open the admin panel → Maps → select a city map
2. Select a building → Actions tab
3. Add action → type = **Expedition**
4. Fill in: base gold, base exp, optionally one or more item rewards
5. Save

### 5. Test the flow in-game

1. Log into the game client
2. Navigate to the building where you configured the expedition
3. Open the building panel — the "Send Squire" section should appear
4. Choose a duration (1h / 3h / 6h) and confirm dispatch
5. The squire is now "exploring" — the building shows remaining time
6. For quick testing: use a DB update to set `completes_at = now() - interval '1 minute'`
   on the active expedition, then reconnect — the notification should appear
7. Visit the building again and collect the rewards

### 6. Run lint and tests

```bash
npm test && npm run lint
```

## Key Files

| File | Purpose |
|------|---------|
| `backend/src/db/migrations/012_squire_expeditions.sql` | Schema changes |
| `backend/src/db/queries/squires.ts` | DB queries for squires + expeditions |
| `backend/src/game/expedition/expedition-service.ts` | Dispatch, collect, scaling logic |
| `backend/src/game/expedition/expedition-handler.ts` | WS message handlers |
| `shared/protocol/index.ts` | New message type definitions |
| `frontend/src/ui/BuildingPanel.ts` | Expedition UI in building menu |
| `admin/backend/src/routes/buildings.ts` | Admin REST validation for expedition type |
| `admin/frontend/src/ui/properties.ts` | Admin form fields for expedition action |

## Debugging Tips

- Check `backend/logs/game.log` for structured JSON logs; filter with
  `grep '"expedition"' backend/logs/game.log` to see expedition events.
- Query active expeditions: `SELECT * FROM squire_expeditions WHERE collected_at IS NULL;`
- Force expedition completion for testing:
  ```sql
  UPDATE squire_expeditions
  SET completes_at = now() - interval '1 second'
  WHERE id = <id>;
  ```
- Verify squire names at character creation by watching the `squire.created` log event.
