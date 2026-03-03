# Research: Session Persistence & Logout

**Branch**: `005-session-persistence` | **Date**: 2026-03-03

---

## Decision 1: Token Storage Mechanism

**Decision**: Use `localStorage` (not `sessionStorage` or a cookie)

**Rationale**:
- `sessionStorage` (current implementation) is cleared when the browser tab is closed. It survives F5 refresh within the same tab, but not a new tab or browser restart. This fails the spec requirement of "page refresh should not require login again" broadly interpreted.
- `localStorage` persists until explicitly cleared, surviving page refresh, tab close, and browser restart — correct for this feature.
- HttpOnly cookies would require a backend session endpoint (REST or cookie-setting handler), contradicting the constitution's preference for WS-centric architecture and adding a new integration point.
- `localStorage` keeps the auth token client-side, consistent with the existing JWT-in-query-string pattern.

**Alternatives considered**:
- `sessionStorage`: Rejected — survives refresh within a tab but not browser restart.
- HttpOnly cookie: Rejected — requires a REST endpoint to set/clear the cookie, conflicts with constitution's WS-first principle.
- IndexedDB: Rejected — unnecessary complexity for a single small value.

**Assumption**: The game does not require cross-browser-tab session sharing. Each tab manages its own session independently.

---

## Decision 2: JWT Expiry Extension

**Decision**: Extend JWT expiry from `'10m'` to `'30d'`, with the value configurable via a `JWT_EXPIRY` environment variable (default `'30d'`)

**Rationale**:
- The 10-minute expiry means any session stored in localStorage will be expired before a player can resume after a short break. The current short expiry was appropriate when the token was only used for the duration of a WS connection, not for persistent storage.
- 30 days is a standard "remember me" duration for web applications. It balances security (token eventually expires) with usability (players don't need to log in repeatedly over days of play).
- Making it configurable via env var follows the existing pattern in `config.ts` and allows production environments to tighten security if needed.
- No refresh token mechanism is introduced — this would add significant complexity (rotation, storage, revocation) not justified by current needs.

**Alternatives considered**:
- Keep 10-minute expiry + implement token refresh: Rejected — adds client-side refresh logic (background WSClient connection, retry timing) and server-side refresh endpoint. Violates YAGNI; refresh can be added later if measured need arises.
- 7-day expiry: Viable. 30 days chosen because it matches common "remember me" patterns in games and reduces re-login friction for casual players.
- No expiry (`'365d'`): Rejected — tokens should eventually expire; 30 days is a reasonable security boundary.

---

## Decision 3: Session Validation Mechanism on Restore

**Decision**: Validate the stored token implicitly via the WebSocket upgrade handshake — no separate REST endpoint

**Rationale**:
- The existing WS server already runs `verifyToken()` during the HTTP upgrade and rejects with HTTP 401 if the token is invalid. This is a cryptographic validation (signature + expiry).
- The frontend can detect rejection by catching the WS `error`/`close` event on initial connection.
- Constitution Principle I and the "No REST for game state" gate explicitly permit this approach and discourage adding REST endpoints for game flow.

**Flow**:
1. BootScene reads token from localStorage
2. Connects to WS with token in query string
3. Server validates JWT on upgrade:
   - **Invalid/expired** → HTTP 401, WS never opens → frontend clears token, goes to LoginScene
   - **Valid, has character** → WS opens, server sends `world.state` → frontend goes to GameScene
   - **Valid, no character** → WS opens, server sends `auth.session_info { has_character: false }` → frontend goes to CharacterCreateScene

**Alternatives considered**:
- REST `/auth/validate` endpoint: Rejected — unnecessary extra round-trip and integration point. The WS handshake IS the validation.
- Decode JWT locally without server validation: Rejected — cannot detect server-side revocation; violates server-authoritative principle.

---

## Decision 4: "Authenticated but No Character" Signal

**Decision**: Introduce a new server-to-client message `auth.session_info` with payload `{ has_character: boolean }`

**Rationale**:
- When a valid token with no `characterId` connects, the server currently sends nothing (world state is only auto-sent when `session.characterId` is truthy). The client has no way to know it's authenticated but needs to create a character.
- Adding `auth.session_info` is the minimal change that gives the client the routing information it needs. This message is only sent on WS connection; it is not a recurring game-state message.
- The protocol already has `auth.success` and `auth.error`; this follows the same namespace pattern.

**Server send condition**: In `world-state-handler.ts`, when `sendWorldState` is called and `findByAccountId` returns null (no character), send `auth.session_info { has_character: false }` instead of silently returning.

**Alternatives considered**:
- Reuse `auth.success` with `has_character: false` and empty token: Confusing semantics (the player is already authenticated, this is not a login success event).
- Use `server.error` with `CHARACTER_REQUIRED`: Rejected — this code is used for different purposes (when a game action requires a character). Overloading it for session restore routing would be confusing.
- Timeout-based routing in BootScene (wait 2s for world.state, then assume no character): Rejected — unreliable, adds startup latency, fails on slow connections.

---

## Decision 5: Backend worldStateHandler Trigger Condition

**Decision**: Change `server.ts` worldStateHandler trigger from `session.characterId` to `session.accountId`

**Rationale**:
- Currently: `if (session.characterId && worldStateHandler)` — only sends world state when JWT has `characterId` claim.
- After character creation, the in-memory session has `session.characterId` updated, but the JWT token does NOT contain `characterId` (it was signed before the character existed). A new WS connection (e.g., after page refresh post-character-creation) will have `session.characterId = null` from the JWT, so world state is never sent even though a character exists in the DB.
- `sendWorldState` already queries the DB via `findByAccountId` — it doesn't rely on `session.characterId` at all. So changing the trigger to `session.accountId` (which is always set for authenticated connections) fixes both the session restore path AND a pre-existing bug where character creation doesn't properly set up the next GameScene connection.
- Pre-auth connections (empty token) have `session.accountId = ''` (falsy), so they are not affected.

---

## Decision 6: Logout Button Placement & Design

**Decision**: Separate `LogoutButton` HTML component mounted to `#top-bar`, positioned absolute top-right. Inline SVG exit icon. Native `title` attribute for tooltip.

**Rationale**:
- The `#top-bar` element is always visible when the player is in GameScene. Mounting directly to `#top-bar` follows the same pattern as `StatsBar`.
- A separate `LogoutButton` class (rather than modifying `StatsBar`) keeps StatsBar focused on displaying stats and avoids coupling unrelated concerns.
- An inline SVG "arrow-out-of-box" icon is universally recognizable as "sign out" and requires no external dependency. SVG matches the existing approach of using inline HTML strings.
- The native `title` attribute produces a browser tooltip on hover. This is sufficient for MVP (spec says "tooltip with descriptive text"). A custom-styled tooltip would add CSS complexity not justified by this spec.

**Icon**: Standard logout SVG path (rectangle + outward arrow), 18×18px, using CSS `currentColor` so it inherits the gold color theme.
