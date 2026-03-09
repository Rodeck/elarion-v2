# Research: Admin Commands System

**Feature**: 012-admin-commands
**Date**: 2026-03-08
**Status**: Complete — no NEEDS CLARIFICATION markers remained in spec.

---

## Finding 1: Admin Flag Already Exists in Database

**Decision**: Use the existing `accounts.is_admin BOOLEAN` column (added in migration 008).

**Rationale**: The column is already present in PostgreSQL; no new migration required.

**Gap identified**: The TypeScript `Account` interface in
`backend/src/db/queries/accounts.ts` does NOT currently include `is_admin`.
The login handler must be updated to read and propagate this flag.

**Alternatives considered**:
- Separate `admins` table: rejected — adds a join for every admin check with no benefit.
- Admin flag on `characters` table: rejected — admin is an account-level privilege, not per-character.

---

## Finding 2: Admin Check Delivery Strategy — JWT Claim (Cached at Login)

**Decision**: Encode `isAdmin: boolean` in the JWT claims at login. Store it on the
`AuthenticatedSession` object. Admin command handlers read `session.isAdmin` — no extra
DB round-trip per command.

**Rationale**:
- Admin status is stable for the lifetime of a session; re-reading from DB on every command
  is unnecessary overhead.
- The JWT approach is already used for `accountId` and `characterId` — it's consistent with
  the project pattern.
- If an admin's flag is revoked, the change takes effect on next login (acceptable).

**Alternatives considered**:
- DB lookup per admin command: rejected — adds latency for a low-frequency edge case.
- Middleware that caches account row in session: rejected — over-engineering for a single flag.

---

## Finding 3: Admin Commands Ride Existing `chat.send` Flow

**Decision**: Admin commands are entered in the chat box with a `/` prefix and sent
as ordinary `chat.send` messages. The `chat-handler.ts` intercepts messages beginning
with `/` before the normal broadcast path and routes them to the admin command parser.

**Rationale**:
- No new client-side message type is required; the chat input already exists.
- The server remains authoritative — the client never "knows" it is admin; it just sends a
  chat message and the server decides what to do.
- Non-admin slash attempts are silently handled server-side with an error reply.

**Alternatives considered**:
- New `admin.command` WS message type sent from frontend: rejected — requires the frontend
  to distinguish admin users and add new message serialisation/routing on both ends;
  violates YAGNI.
- HTTP REST endpoint for admin commands: **rejected** — explicitly prohibited by
  Constitution Principle I for game state mutations.

---

## Finding 4: Server Response — New `admin.command_result` Message Type

**Decision**: The server sends an `admin.command_result` message back only to the issuing
admin session. This message carries a `success: boolean`, a human-readable `message`, and
an optional `action` discriminator.

**Rationale**:
- Separating the response type from `chat.message` prevents polluting chat history and lets
  the frontend render admin feedback distinctly (e.g., in a console colour).
- A single structured response type covers success and failure uniformly.

**Alternatives considered**:
- Reuse `chat.message` with `channel: 'admin'`: rejected — conflates admin feedback with
  chat history; would require persisting admin noise to the `chat_messages` table.
- Reuse `server.error` for failures only: rejected — inconsistent; success path has no
  equivalent message, so the admin would get no confirmation.

---

## Finding 5: Player Lookup — By Character Name

**Decision**: Admin commands target players by **character name** (unique in the characters
table). A new query `getCharacterByName(name: string)` is added to
`backend/src/db/queries/characters.ts`.

**Rationale**: Character names are the user-visible identifier in-game. Looking up by name
matches how players reference each other (e.g., `/level_up Roddeck`). Names are enforced
unique in the DB schema.

**Alternatives considered**:
- Lookup by account username: rejected — players type character names in chat, not usernames.
- Lookup by UUID: rejected — impractical to type in chat.

---

## Finding 6: Inventory Clear — Scope Includes Equipped Items

**Decision**: `/clear_inventory` removes all rows from `inventory_items` for the target
character, including rows with a non-null `equipped_slot`.

**Rationale**: Admin inventory clear is a destructive reset used for testing and bug
recovery. Leaving equipped items would leave the character in a partially-equipped state
that could cause stat inconsistencies. A full wipe is safer and simpler.

**Alternatives considered**:
- Clear only unequipped items: rejected — partial clear leaves character in inconsistent
  state; requires two queries with little benefit.
- Unequip first then clear: rejected — additional complexity; same outcome with one DELETE.

---

## Finding 7: Level-Up — Reuse Existing `level-up-service.ts`

**Decision**: The `/level_up` admin command reuses `backend/src/game/progression/level-up-service.ts`
to apply level increases. This keeps level-up logic DRY and ensures stat recalculation
follows the same path as organic progression.

**Rationale**: A dedicated service already exists. Calling it N times (once per count)
reuses the stat-progression formula without duplication.

**Gap identified**: Need to verify the service accepts a `characterId` and applies one
level-up atomically. If it requires a character object in memory, the admin handler must
fetch the character first.

---

## Summary of Code Changes Required

| Area | File | Change |
|------|------|--------|
| Account model | `backend/src/db/queries/accounts.ts` | Add `is_admin` to `Account` interface; update `getAccountById` SELECT |
| JWT | `backend/src/auth/jwt.ts` | Add `isAdmin: boolean` to `JwtClaims` |
| Login | `backend/src/auth/login-handler.ts` | Include `isAdmin` when signing JWT |
| Session | `backend/src/websocket/server.ts` | Add `isAdmin: boolean` to `AuthenticatedSession` |
| Protocol | `shared/protocol/index.ts` | Add `AdminCommandResultPayload` type |
| Chat handler | `backend/src/game/chat/chat-handler.ts` | Intercept `/`-prefixed messages; route to admin handler |
| Admin handler | `backend/src/game/admin/admin-command-handler.ts` | New file: parse and execute admin commands |
| Character queries | `backend/src/db/queries/characters.ts` | Add `getCharacterByName(name)` |
| Inventory queries | `backend/src/db/queries/inventory.ts` | Add `clearAllInventory(characterId)` |
| No new migration | — | `is_admin` column already exists in DB |
