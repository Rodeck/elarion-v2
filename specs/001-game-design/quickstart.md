# Quickstart: Elarion Local Development

**Branch**: `001-game-design`
**Purpose**: Verify the core game loop end-to-end in a local environment.

---

## Prerequisites

| Tool | Version | Check command |
|------|---------|---------------|
| Node.js | 20 LTS | `node --version` |
| npm | 10+ | `npm --version` |
| PostgreSQL | 16 | `psql --version` |

---

## Repository Layout

```
elarion/
├── backend/          # Node.js + TypeScript game server
├── frontend/         # Phaser 3 + TypeScript browser client
└── shared/
    └── protocol/     # Shared TypeScript types for WS messages
```

---

## 1. Database Setup

```bash
# Create the database
psql -U postgres -c "CREATE DATABASE elarion_dev;"

# Run migrations (from backend directory)
cd backend
npm install
npm run db:migrate
npm run db:seed          # Seeds character classes and starter map zones
```

---

## 2. Start the Backend Server

```bash
cd backend
npm run dev              # Starts server on ws://localhost:4000
```

Expected output:
```
[elarion] DB connected (elarion_dev)
[elarion] Zones loaded: Starter Plains (id=1)
[elarion] Monsters spawned: 12 instances in zone 1
[elarion] WebSocket server listening on :4000
```

---

## 3. Start the Frontend

```bash
cd frontend
npm install
npm run dev              # Starts dev server on http://localhost:3000
```

Open `http://localhost:3000` in a browser.

---

## 4. Validation Checklist

Work through each story in order. Each checkpoint is independently testable.

### US1 — Account + Character Creation
- [ ] Open `http://localhost:3000`; the landing/login page appears.
- [ ] Register a new account with username `tester1` and a password.
- [ ] Observe character creation screen (class selection).
- [ ] Select **Warrior** and name the character `Hero`.
- [ ] Observe: character appears on the game map in the starting zone.
- [ ] Verify in server logs: `[auth] account created: tester1`,
      `[world] character placed: Hero zone=1 pos=(5,5)`.
- [ ] Try registering again with `tester1` — confirm error "Username already taken".

### US2 — Movement
- [ ] Click or press arrow keys to move the character.
- [ ] Observe: character moves on the map; server log shows
      `[world] player moved: Hero (5,5)→(6,5)`.
- [ ] Open a second browser tab, log in as a new account (`tester2`).
- [ ] Move `tester2` into view of `tester1` — both players see each other.
- [ ] Attempt to walk into a wall tile — character stays in place.
- [ ] Verify server log: `[world] move rejected: Hero BLOCKED_TILE`.

### US3 — Automatic Combat
- [ ] Move `Hero` (Warrior) adjacent to a visible monster.
- [ ] Click the monster or the "Attack" button.
- [ ] Observe: combat log streams automatically (no player input needed).
  - Each round shows attacker name, damage, HP remaining.
- [ ] On monster death: experience gained and any item drops shown.
- [ ] Verify server log: `[combat] sim started combat_id=<uuid>`,
      `[combat] outcome=victory xp=50`.
- [ ] Let a monster defeat `Hero` — confirm respawn at zone spawn point
      with reduced HP, no disconnection.

### US4 — Level Up
- [ ] Defeat enough monsters to fill the XP bar (level 1 → 2 requires 100 XP).
- [ ] Observe level-up notification on screen; stats bar updates.
- [ ] Verify server log: `[progression] Hero levelled up to 2`.

### US5 — Chat
- [ ] With two logged-in testers in the same zone, send a local chat message
      from `tester1`.
- [ ] Verify `tester2` sees the message labelled `[tester1]` within ~500ms.
- [ ] Send a global message — verify a third tester in a different zone
      (if implemented) also sees it.
- [ ] Send 6 messages in under 3 seconds — verify "slow down" notice appears.

---

## 5. Structured Log Format Verification

All server log lines MUST be valid JSON. Spot-check with:

```bash
cd backend && npm run dev 2>&1 | head -20 | jq .
```

If `jq` parses without errors, structured logging is working.

---

## 6. Teardown

```bash
# Stop backend (Ctrl+C)
# Stop frontend dev server (Ctrl+C)
# Optional: drop DB
psql -U postgres -c "DROP DATABASE elarion_dev;"
```
