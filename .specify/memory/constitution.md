<!--
SYNC IMPACT REPORT
==================
Version change: 1.0.0 → 1.1.0
Bump type: MINOR — Architecture Constraints updated with resolved tech stack
decisions (TODO(TECH_STACK) and TODO(DATABASE) replaced with concrete choices).

Modified sections:
  - Architecture Constraints: TODO(TECH_STACK) → Node.js 20 LTS + TypeScript 5.x
    (backend); Phaser 3 + TypeScript (frontend).
  - Architecture Constraints: TODO(DATABASE) → PostgreSQL 16.

Added sections: None.
Removed sections: None.

Templates requiring updates:
  ✅ .specify/memory/constitution.md — this file (updated now).
  ✅ All other templates remain generic; no further changes required.

Deferred TODOs: None remaining.
-->

# Elarion Constitution

## Core Principles

### I. Real-Time Communication First

All client-server communication involving game state MUST use a persistent
connection — WebSocket (preferred) or a custom TCP connection. REST-style
request/response (HTTP endpoints) is PROHIBITED for any game state mutation or
real-time game event.

Rationale: multiplayer RPG gameplay demands low-latency, bi-directional messaging.
A persistent connection also gives the server a natural channel to push state
updates, reject invalid actions, and broadcast world events without polling.

### II. Server-Authoritative Design (NON-NEGOTIABLE)

The backend server is the ONLY source of truth for all game state. Every player
action received from the client MUST be validated and applied server-side before
any outcome is broadcast. Client-side state is a projection only; it MUST be
reconcilable with — and always overridable by — the server state.

Client-side prediction for visual smoothness is ALLOWED, but predicted state MUST
be rolled back if the server rejects or modifies the action.

Rationale: prevents bots, cheating, and desync. Any action that mutates shared
game state (movement, combat, item use, etc.) is untrusted until the server
approves it.

### III. Simplicity & YAGNI

Every design decision MUST solve a clearly defined current problem. Speculative
abstractions, future-proofing layers, or feature flags for hypothetical
requirements are PROHIBITED unless justified in writing.

Complexity MUST be documented in the plan's Complexity Tracking table with an
explicit rationale and a simpler alternative that was considered and rejected.

Rationale: a game server codebase that grows unchecked becomes unmaintainable.
Start with the simplest design that works; evolve based on real evidence.

### IV. Observability

Every subsystem MUST emit structured logs (JSON or equivalent key-value format)
for all significant events, including:
- Player connections and disconnections
- All validated and rejected player actions (with rejection reason)
- Game state transitions (level changes, spawns, deaths, etc.)
- Errors and unexpected conditions

System behaviour MUST be diagnosable from logs alone, without attaching a live
debugger. Debug-only log levels are ALLOWED but MUST be disabled in production
builds by default.

Rationale: multiplayer game servers run at scale and across unreliable networks.
Without structured observability, reproducing bugs and detecting abuse patterns is
infeasible.

### V. Independent Deployability

The frontend and the backend MUST be independently deployable and independently
testable. Neither deployment pipeline MUST depend on the other.

The WebSocket/TCP message protocol MUST be documented as a versioned contract in
`contracts/` for every feature that introduces or modifies message types.
Protocol changes MUST be backward-compatible OR carry a version increment with a
migration note.

Rationale: independent deployability enables continuous delivery, isolated
rollbacks, and parallel team work on client and server without coupling release
cycles.

## Architecture Constraints

- **Frontend**: Browser-native (JavaScript or TypeScript). No native runtime
  dependencies; MUST run in a standard web browser without plugins.
- **Backend**: Node.js 20 LTS + TypeScript 5.x. Server process that owns all
  game state.
- **Frontend**: Phaser 3 + TypeScript. Browser-native game client.
- **Shared types**: A `shared/protocol/` directory holds TypeScript interfaces
  for all WebSocket message payloads, used by both frontend and backend.
- **Communication layer**: WebSocket (`ws` library). JSON text frames, protocol
  version field `v` in every message envelope. REST endpoints MAY be used only
  for non-game-state operations (e.g., initial HTTP upgrade handshake).
- **Database**: PostgreSQL 16. Primary persistence for all durable game data
  (accounts, characters, combat logs, items). Redis deferred until measured need.
- **Anti-cheat boundary**: The server MUST treat ALL client input as untrusted.
  Validation of actions (rate limiting, legal-move checks, stat checks) MUST
  live on the server, never exclusively on the client.

## Quality Gates

These gates MUST be verified by the Constitution Check in every `plan.md`:

1. **No REST for game state**: Any feature that mutates game state MUST use the
   persistent connection protocol. REST endpoints for game actions are a gate
   failure.
2. **Server-side validation present**: Every player-action feature MUST include
   server-side validation logic. A feature that only implements client-side
   checks is incomplete.
3. **Structured logging required**: All code paths that touch the game loop or
   handle player actions MUST include structured log emission.
4. **Contract documented**: Any new message type introduced between client and
   server MUST be documented in `contracts/` before the task is considered done.
5. **Graceful rejection handling**: The frontend MUST handle server rejections
   gracefully (rollback + user feedback). A feature that panics or freezes on
   rejection is a gate failure.
6. **Complexity justified**: Any design element that violates Principle III MUST
   appear in the plan's Complexity Tracking table with a written justification.

## Governance

This constitution supersedes all other practices, style guides, and verbal
agreements for the Elarion project.

**Amendment procedure**:
1. Propose the amendment with written rationale.
2. Identify which principles, sections, or quality gates change.
3. Increment `CONSTITUTION_VERSION` following semantic versioning:
   - MAJOR: principle removed, redefined, or governance structure changed.
   - MINOR: new principle or section added, or materially expanded guidance.
   - PATCH: clarification, wording fix, or non-semantic refinement.
4. Update `LAST_AMENDED_DATE` to the amendment date (ISO 8601).
5. Run `/speckit.constitution` to propagate changes to dependent templates.

**Compliance review**: Every `plan.md` Constitution Check MUST derive its gate
conditions from the current version of this file. If the constitution changes
mid-feature, the active feature's Constitution Check MUST be re-evaluated.

**Stack decisions**: Resolved in `specs/001-game-design/research.md` (2026-02-28).
Architecture Constraints updated accordingly. Future stack changes MUST follow the
amendment procedure above.

**Version**: 1.1.0 | **Ratified**: 2026-02-28 | **Last Amended**: 2026-02-28
