---
description: Fetch and analyze the backend game server logs for debugging. Reads backend/logs/game.log which is written by the backend Node.js process.
---

## Goal

Read and analyze the backend game server log file to help diagnose issues.

## Log File Location

The log file is at `backend/logs/game.log` relative to the project root (`D:\projects\elarion-v2`).

Absolute path: `D:\projects\elarion-v2\backend\logs\game.log`

## Log Format

Each line is a JSON object with these fields:

```json
{ "ts": "2026-03-06T12:34:56.789Z", "level": "info", "subsystem": "world-state", "event": "sent", "characterId": "...", ... }
```

- `ts` — ISO timestamp
- `level` — `debug` | `info` | `warn` | `error`
- `subsystem` — component that emitted the log (e.g. `world-state`, `city-movement`, `zone-broadcasts`, `bootstrap`, `disconnect`)
- `event` — specific event name within that subsystem
- Additional fields vary by event

## Important Behaviors

- The log is **truncated on every server restart** — it only contains logs from the current running session.
- The server is started via `npm run dev` in the project root, which runs all four packages (backend, frontend, admin-backend, admin-frontend) in parallel.
- The backend process writes to this file using `fs.appendFileSync`, so all output is in append order.

## How to Read

Use the `Read` tool with the absolute path:

```
Read file: D:\projects\elarion-v2\backend\logs\game.log
```

If the file is large, read the tail (last N lines) using `offset` and `limit` parameters.

## Key Events to Look For

| Subsystem | Event | What it means |
|-----------|-------|----------------|
| `world-state` | `sent` | Server sent world.state to a client; check `players_count` and `players_ids` |
| `world-state` | `session_restore_no_character` | Client connected but has no character |
| `zone-broadcasts` | `player_entered_zone_broadcast` | A player entered a zone; check `entering` and `notifying_count` |
| `city-movement` | `movement_started` | City node movement began |
| `city-movement` | `step` | Each node step during movement |
| `city-movement` | `movement_completed` | Movement finished |
| `disconnect` | any | Player disconnect / grace period events |
| `bootstrap` | `complete` | Server finished starting up |

## Analysis Tips

- If two players cannot see each other, look at the `world.state` `sent` events for each player and check `players_ids` — it should list the other player's ID and name.
- If `players_count` is 0 when it should not be, the zone registry did not have the other player registered at the time `world.state` was sent (race condition or disconnect issue).
- Check `zone-broadcasts` logs to confirm the `player.entered_zone` broadcast was actually sent and to whom.
- `notifying_count: 0` in `player_entered_zone_broadcast` means no one was in the zone to notify at broadcast time.
