# Quickstart: Session Persistence & Logout

**Branch**: `005-session-persistence` | **Date**: 2026-03-03

---

## What This Feature Does

After this feature:
1. **Page refresh** → game resumes automatically (no login prompt)
2. **Logout button** → top-right corner of game UI, clears session, returns to login screen

---

## Environment Variables

One new optional backend environment variable:

```bash
# How long issued JWTs are valid (jose duration string format)
# Default: '30d'  — change for tighter security in production
JWT_EXPIRY=30d
```

Add to your `.env` file. If omitted, defaults to `'30d'`.

---

## Key Files Changed

| File | Change |
|------|--------|
| `backend/src/auth/jwt.ts` | `EXPIRY` reads from `JWT_EXPIRY` env, defaults to `'30d'` |
| `backend/src/websocket/server.ts` | Calls `worldStateHandler` when `session.accountId` is set (was `session.characterId`) |
| `backend/src/websocket/handlers/world-state-handler.ts` | Sends `auth.session_info { has_character: false }` when authenticated account has no character |
| `shared/protocol/index.ts` | Adds `AuthSessionInfoPayload` and `AuthSessionInfoMessage` |
| `frontend/src/auth/SessionStore.ts` | **New** — `save(token)`, `load(): string\|null`, `clear()` |
| `frontend/src/scenes/BootScene.ts` | Checks `SessionStore.load()` before routing to `LoginScene`; attempts WS auto-login |
| `frontend/src/scenes/LoginScene.ts` | Calls `SessionStore.save(token)` on `auth.success` |
| `frontend/src/scenes/GameScene.ts` | Creates `LogoutButton` in top bar, wires logout action |
| `frontend/src/ui/LogoutButton.ts` | **New** — HTML button with SVG icon, title tooltip, mounted to `#top-bar` |

---

## Session Flow After This Feature

```
Page loads
  └─► BootScene checks localStorage for token
        ├─► No token → LoginScene (unchanged)
        └─► Token found → connect WS
              ├─► 401 (expired/invalid) → clear token → LoginScene
              ├─► world.state received → GameScene (session restored)
              └─► auth.session_info { has_character: false } → CharacterCreateScene
```

---

## Logout Flow

```
Player clicks logout button (top-right of game UI)
  └─► SessionStore.clear()
  └─► wsClient.disconnect()
  └─► UI elements destroyed
  └─► LoginScene
```

---

## Testing Manually

1. Start game server and frontend dev server
2. Log in with valid credentials → game loads
3. Refresh page (F5 or Ctrl+R) → game should load without login prompt
4. Click the logout button (top-right corner) → login screen appears
5. Refresh again → login screen remains (session cleared)
6. Close browser, reopen, navigate to game URL → game loads automatically (no login prompt)

---

## Token Storage Key

```
localStorage key: 'elarion_token'
```
