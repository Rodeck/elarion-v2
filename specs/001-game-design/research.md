# Research: Elarion Core Game Design

**Branch**: `001-game-design` | **Phase**: 0 — Unknowns Resolution
**Resolves**: Constitution `TODO(TECH_STACK)` and `TODO(DATABASE)`

---

## 1. Backend Runtime & Language

**Decision**: Node.js 20 LTS + TypeScript 5.x

**Rationale**:
- Event-driven non-blocking I/O handles 200+ concurrent WebSocket connections
  efficiently without thread-per-connection overhead.
- Shared TypeScript across frontend and backend enables a `shared/protocol/`
  directory with authoritative message type definitions (required by Constitution
  Principle V — no type drift between client and server).
- Large, mature ecosystem for real-time game servers (`ws`, `pg`, `jose`).
- Fast iteration cycle (hot-reload with `ts-node-dev`); small-team friendly.

**Alternatives considered**:
- **Go**: Superior raw throughput; handles 50k+ connections. Overkill at 200
  concurrent players. Different language from frontend breaks the shared-types
  advantage. Revisit if scale demands it post-launch.
- **Python (asyncio/FastAPI)**: 4× slower than Node for WebSocket workloads in
  benchmarks; not suitable for sub-300ms game loops.

---

## 2. Frontend Game Framework

**Decision**: Phaser 3 (latest stable) + TypeScript

**Rationale**:
- Purpose-built 2D game engine: tile-map loading, sprite management, arcade
  physics, camera, scene lifecycle — all included without additional libraries.
- Native TMX (Tiled) map loader; no custom parsing required.
- 1800+ official examples and extensive documentation reduce research time for
  tile-based RPG patterns.
- TypeScript typings available (`@types/phaser`), compatible with the shared
  protocol types.

**Alternatives considered**:
- **PixiJS**: Faster renderer; no built-in game logic. Would require hand-building
  collision, tile-map, camera, and input systems — weeks of extra work for MVP.
- **Plain Canvas / WebGL**: Maximum control; maximum development cost. Only viable
  for teams with existing browser-game engine experience.

---

## 3. WebSocket Server Library

**Decision**: `ws` (npm package) — raw WebSocket server

**Rationale**:
- Minimal overhead; full control over the binary/text message protocol.
- Aligns with Constitution Principle I (persistent connection, not REST) and the
  intent to use a "custom protocol" over WebSocket.
- Handles the target concurrency (200 players) comfortably; benchmarks show 50k+
  concurrent connections per Node.js process with `ws`.
- No protocol abstraction layer that could hide bugs or limit message design.

**Alternatives considered**:
- **Socket.IO**: Auto-reconnect, rooms, HTTP long-polling fallback. Adds ~20%
  payload overhead and hides protocol details behind an abstraction. The game
  server controls its own reconnect and room (zone) logic, making Socket.IO's
  extras wasteful.

---

## 4. Database

**Decision**: PostgreSQL 16 (primary persistence)

**Rationale**:
- Relational model maps naturally to game entities: accounts, characters, items,
  combat logs (all have clear foreign-key relationships and consistent schemas).
- ACID transactions prevent data corruption when concurrent players affect shared
  state (e.g., two updates to the same monster row).
- JSON/JSONB column support for flexible game data (loot tables, class stat
  growth, ability configs) without a full document database.
- `pg` (or `postgres`) npm driver is mature and well-typed.

**Deferred — Redis for session/presence** (YAGNI):
- At 200 concurrent players, PostgreSQL handles session lookups comfortably.
- Redis as a hot-data cache (active player positions, combat state) will be
  evaluated post-launch based on measured latency. Not included in MVP.

**Alternatives considered**:
- **MongoDB**: Flexible document model, but ACID guarantees are weaker for
  concurrent game state mutations. PostgreSQL's JSONB covers the need for
  schema-less sub-documents without sacrificing consistency.
- **Redis alone**: In-memory only (data loss risk); not a replacement for durable
  persistence. Suitable as a future cache layer, not as primary storage.

---

## 5. Map Format and Tooling

**Decision**: Tiled map editor (TMX format) + Phaser's built-in TMX loader

**Rationale**:
- Industry standard for 2D tile-based games; visual editor removes the need to
  hand-code tile layouts.
- Custom properties in Tiled encode game logic (spawn points, zone boundaries,
  blocked tiles) directly in map files, keeping game data out of source code.
- Backend parses TMX XML at startup to extract collision data, spawn points, and
  zone metadata for the server-authoritative world model.
- Decouples map design from code: maps can be iterated without a code change.

**Alternatives considered**:
- **Custom JSON format**: More control, but requires a visual editor to be built
  or managed separately. No time savings for MVP.

---

## 6. Client–Server Message Protocol

**Decision**: JSON over WebSocket text frames

**Rationale**:
- Human-readable messages accelerate debugging during development (visible in
  browser DevTools Network tab as plain text).
- Zero serialization setup — JSON is native to both Node.js and the browser.
- At 200 concurrent players with a typical update rate (10 events/sec/player),
  aggregate bandwidth is ~2 Mbps with JSON — not a bottleneck. Optimization is
  premature.

**Migration path**: Switch to MessagePack post-launch if bandwidth profiling
identifies it as a bottleneck. The shared protocol types make this a one-location
change.

**Message envelope**:
```
{ "type": "string", "v": 1, "payload": { ... } }
```
`v` is the protocol version; included from day 1 to enable backward-compatible
upgrades per Constitution Principle V.

**Alternatives considered**:
- **MessagePack**: 30–40% smaller payloads; not human-readable. Adds tooling
  friction with no measured benefit at target scale.
- **Protocol Buffers**: Best compression; schema compilation step adds friction
  to protocol changes. Not appropriate for MVP iteration speed.

---

## 7. Authentication

**Decision**: Short-lived JWT (access token, 10-min expiry) issued on login,
sent by client on WebSocket handshake for fast stateless verification.

**Rationale**:
- No database query needed for each game action — JWT signature verification is
  a pure CPU operation (<1ms), keeping the game loop fast.
- On WebSocket upgrade request, the client includes the JWT in the query string
  or `Sec-WebSocket-Protocol` header; server verifies and extracts player identity
  before the socket is accepted.
- 10-minute expiry limits the ban grace window to an acceptable game-context
  level; a re-login (new JWT) is required after expiry.

**Session refresh** (deferred — YAGNI for MVP):
- Refresh tokens (stored in httpOnly cookie) for seamless re-authentication will
  be added in the auth hardening iteration, not in the MVP.

**Alternatives considered**:
- **Server-side sessions**: Require a DB lookup per connection upgrade and per
  session renewal. Acceptable for low-frequency HTTP; unnecessary overhead for a
  persistent WebSocket game server where the session is validated once at connect.
- **No authentication**: Obviously unsuitable for a multiplayer game.

---

## Resolved Constitution TODOs

| TODO | Resolution |
|------|------------|
| `TODO(TECH_STACK)` | Node.js 20 LTS + TypeScript 5.x (backend); Phaser 3 + TypeScript (frontend) |
| `TODO(DATABASE)` | PostgreSQL 16 |

**Action required**: Update `.specify/memory/constitution.md` Architecture
Constraints to replace TODO placeholders with resolved decisions; increment
version to 1.1.0 (MINOR — new concrete constraints added).
