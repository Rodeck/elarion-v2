# Quickstart: Spell System

**Feature**: 039-spell-system

## Prerequisites

- Node.js 20 LTS
- PostgreSQL 16 running with Elarion database
- All migrations up to 042 applied

## Setup

1. Apply migration:
   ```bash
   psql -d elarion -f backend/src/db/migrations/043_spell_system.sql
   ```

2. Create spell icon directory:
   ```bash
   mkdir -p backend/assets/spells/icons
   ```

3. Start services (3 terminals):
   ```bash
   # Terminal 1: Backend
   cd backend && npm run dev

   # Terminal 2: Game frontend
   cd frontend && npm run dev

   # Terminal 3: Admin panel
   cd admin/backend && npm run dev
   # (admin frontend served via Vite on admin/frontend)
   ```

## Verification Checklist

1. **Admin — Create a spell**: Navigate to Spell Manager in admin panel. Create "Haste" with effect_type `movement_speed`, effect_value 50, duration 3600s. Add level costs.

2. **Admin — Create spell book item**: Create item with category `spell_book_spell`, link to Haste spell via `spell_id`.

3. **Grant for testing**: Use admin command `/spells.all <player>` or `/item <player> <spell_book_id> 5`.

4. **Player — Train spell**: Use spell book from inventory. Verify progress points and cooldown.

5. **Player — Cast on self**: Open Spells tab → click Haste → click Cast. Verify resources consumed, buff appears in buff bar.

6. **Player — Cast on other**: Open another player's detail modal → cast Haste. Verify target receives buff.

7. **Reconnect test**: Cast a buff, disconnect, reconnect. Verify buff persists with correct remaining time.

8. **XP ring**: Verify XP is displayed as circular ring around level badge. Hover shows exact values.

## Key Files

| Area | Path |
|------|------|
| Migration | `backend/src/db/migrations/043_spell_system.sql` |
| Spell queries | `backend/src/db/queries/spells.ts` |
| Spell progress queries | `backend/src/db/queries/spell-progress.ts` |
| Buff queries | `backend/src/db/queries/spell-buffs.ts` |
| Cast handler | `backend/src/game/spell/spell-cast-handler.ts` |
| Book handler | `backend/src/game/spell/spell-book-handler.ts` |
| State handler | `backend/src/game/spell/spell-state-handler.ts` |
| Buff service | `backend/src/game/spell/spell-buff-service.ts` |
| Stat integration | `backend/src/game/combat/combat-stats-service.ts` |
| Protocol types | `shared/protocol/index.ts` |
| Spells tab UI | `frontend/src/ui/SpellPanel.ts` |
| Spell detail | `frontend/src/ui/SpellDetailModal.ts` |
| Buff bar | `frontend/src/ui/BuffBar.ts` |
| Admin routes | `admin/backend/src/routes/spells.ts` |
| Admin UI | `admin/frontend/src/ui/spell-manager.ts` |

## Admin Commands

| Command | Description |
|---------|-------------|
| `/spells.all <player>` | Grant all defined spells to player |
| `/abilities.all <player>` | Grant all abilities (renamed from `/skill_all`) |
